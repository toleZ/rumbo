import { useState, useRef, useEffect } from 'react'
import {
  DndContext, DragOverlay, defaultDropAnimationSideEffects, closestCorners, pointerWithin, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, type DragOverEvent, type CollisionDetection,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus, Loader2, Kanban, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useTaskStore } from '../../stores/taskStore'
import { useBoardLoader } from '../layout/DataLoader'
import { trpc } from '../../lib/trpc'
import { useUIStore } from '../../stores/uiStore'
import { KanbanColumn } from './KanbanColumn'
import { TaskCard } from './TaskCard'
import { TaskModal } from './TaskModal'
import { TaskPanel } from './TaskPanel'
import { ColumnModal } from './ColumnModal'
import { Button } from '../ui/Button'
import type { Task, Column } from '../../types'

// An empty column's only droppable is its full-size container (header + list +
// "add task" button), much larger than a task card. closestCorners' averaged
// corner-distance heuristic is biased toward similarly-sized rects, so it often
// resolves to a nearby card in another column instead of that oversized rect —
// the drop then silently fails. pointerWithin checks literal cursor containment
// instead (sorted smallest-rect-first, so a task card still wins over its own
// column when the cursor is over both), which reliably finds an empty column.
// Fall back to closestCorners only when the pointer isn't over any droppable.
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  return pointerCollisions.length > 0 ? pointerCollisions : closestCorners(args)
}

export function KanbanBoard() {
  const { t: i18n } = useTranslation()
  const { tasks, columns, labels, boards, activeBoardId, moveTask, reorderTasks, reorderColumns, updateColumn, deleteColumn } = useTaskStore(useShallow(s => ({
    tasks: s.tasks,
    columns: s.columns,
    labels: s.labels,
    boards: s.boards,
    activeBoardId: s.activeBoardId,
    moveTask: s.moveTask,
    reorderTasks: s.reorderTasks,
    reorderColumns: s.reorderColumns,
    updateColumn: s.updateColumn,
    deleteColumn: s.deleteColumn,
  })))
  const { selectedTaskId, setSelectedTaskId, openCreateBoardModal } = useUIStore(useShallow(s => ({
    selectedTaskId: s.selectedTaskId,
    setSelectedTaskId: s.setSelectedTaskId,
    openCreateBoardModal: s.openCreateBoardModal,
  })))
  const { isLoading } = useBoardLoader(activeBoardId)
  const utils = trpc.useUtils()

  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [activeColumn, setActiveColumn] = useState<Column | null>(null)
  const [panelTaskId, setPanelTaskId] = useState<string | null>(null)
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null)
  const [editingColumn, setEditingColumn] = useState<Column | null>(null)
  const [showAddColumn, setShowAddColumn] = useState(false)

  useEffect(() => {
    if (selectedTaskId) {
      setPanelTaskId(selectedTaskId)
      setSelectedTaskId(null)
    }
  }, [selectedTaskId])

  const dragSnapshotRef = useRef<{ columnId: string; order: number } | null>(null)
  const columnOrderSnapshotRef = useRef<string[] | null>(null)

  // Every mutation below also invalidates the board's cached tasks.list/columns.list
  // query on success. useBoardLoader remounts on every page navigation (KanbanBoard
  // sits under AppErrorBoundary, keyed by page) and re-hydrates the store straight
  // from that cache — without invalidating it here, navigating away and back within
  // the query's staleTime would silently revert an already-persisted change back to
  // the pre-mutation snapshot still sitting in the cache.
  const moveMutation = trpc.tasks.move.useMutation({
    onSuccess: () => { if (activeBoardId) utils.tasks.list.invalidate({ boardId: activeBoardId }) },
    onError: (_, vars) => {
      if (dragSnapshotRef.current) {
        moveTask(vars.taskId, dragSnapshotRef.current.columnId, dragSnapshotRef.current.order)
      }
      toast.error(i18n('kanban.failedMove'))
    },
  })

  const reorderMutation = trpc.tasks.reorder.useMutation({
    onSuccess: () => { if (activeBoardId) utils.tasks.list.invalidate({ boardId: activeBoardId }) },
    onError: () => {
      toast.error(i18n('kanban.failedReorder'))
    },
  })

  const createColumnMutation = trpc.columns.create.useMutation({
    onSuccess: (data) => {
      useTaskStore.setState((s) => ({
        columns: [...s.columns, { id: data.id, title: data.title, boardId: data.boardId, order: data.order, isDone: data.isDone }],
      }))
      if (activeBoardId) utils.columns.list.invalidate({ boardId: activeBoardId })
    },
    onError: () => toast.error(i18n('kanban.failedAddColumn')),
  })

  const updateColumnMutation = trpc.columns.update.useMutation({
    onSuccess: () => { if (activeBoardId) utils.columns.list.invalidate({ boardId: activeBoardId }) },
  })

  const deleteColumnMutation = trpc.columns.delete.useMutation({
    onSuccess: () => {
      if (!activeBoardId) return
      utils.columns.list.invalidate({ boardId: activeBoardId })
      utils.tasks.list.invalidate({ boardId: activeBoardId })
    },
  })

  const reorderColumnsMutation = trpc.columns.reorder.useMutation({
    onSuccess: () => { if (activeBoardId) utils.columns.list.invalidate({ boardId: activeBoardId }) },
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const boardColumns = columns.filter((c) => c.boardId === activeBoardId).sort((a, b) => a.order - b.order)
  const boardTasks = tasks.filter((t) => t.boardId === activeBoardId)
  const activeBoard = boards.find((b) => b.id === activeBoardId)

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'column') {
      columnOrderSnapshotRef.current = boardColumns.map((c) => c.id)
      setActiveColumn(boardColumns.find((c) => c.id === event.active.id) ?? null)
      return
    }
    const task = boardTasks.find((t) => t.id === event.active.id)
    if (task) {
      setActiveTask(task)
      dragSnapshotRef.current = { columnId: task.columnId, order: task.order }
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    // Columns reorder live while dragging — the board shifts to show exactly
    // where the column will land, mirroring how task drags behave. `over` is
    // usually a task (pointerWithin resolves smallest-rect-first), so map it
    // to its parent column.
    if (event.active.data.current?.type === 'column') {
      const overColumnId = boardColumns.some((c) => c.id === over.id)
        ? (over.id as string)
        : boardTasks.find((t) => t.id === over.id)?.columnId
      if (!overColumnId || overColumnId === active.id) return
      const oldIndex = boardColumns.findIndex((c) => c.id === active.id)
      const newIndex = boardColumns.findIndex((c) => c.id === overColumnId)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        reorderColumns(arrayMove(boardColumns, oldIndex, newIndex).map((c) => c.id))
      }
      return
    }

    const activeTaskItem = boardTasks.find((t) => t.id === (active.id as string))
    if (!activeTaskItem) return
    const overColumn = boardColumns.find((c) => c.id === (over.id as string))
    if (overColumn && activeTaskItem.columnId !== overColumn.id) {
      moveTask(active.id as string, overColumn.id, 0)
      return
    }
    const overTask = boardTasks.find((t) => t.id === (over.id as string))
    if (overTask && activeTaskItem.columnId !== overTask.columnId) {
      moveTask(active.id as string, overTask.columnId, overTask.order)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    setActiveColumn(null)

    if (active.data.current?.type === 'column') {
      // Order was already applied live during dragOver — read the final order
      // from the store and persist it if it changed from the drag-start snapshot.
      const snapshot = columnOrderSnapshotRef.current
      columnOrderSnapshotRef.current = null
      const ids = useTaskStore.getState().columns
        .filter((c) => c.boardId === activeBoardId)
        .sort((a, b) => a.order - b.order)
        .map((c) => c.id)
      if (snapshot && snapshot.join() !== ids.join()) {
        reorderColumnsMutation.mutate({ columnIds: ids }, {
          onError: () => {
            reorderColumns(snapshot)
            toast.error(i18n('kanban.failedReorderColumn'))
          },
        })
      }
      return
    }

    if (!over || active.id === over.id) {
      dragSnapshotRef.current = null
      return
    }

    const activeTaskItem = boardTasks.find((t) => t.id === (active.id as string))
    if (!activeTaskItem) { dragSnapshotRef.current = null; return }

    const snapshot = dragSnapshotRef.current
    const movedToNewColumn = snapshot && activeTaskItem.columnId !== snapshot.columnId

    if (movedToNewColumn) {
      const columnTasks = boardTasks
        .filter((t) => t.columnId === activeTaskItem.columnId && t.id !== activeTaskItem.id)
        .sort((a, b) => a.order - b.order)
      const newOrder = columnTasks.length

      moveMutation.mutate({
        taskId: activeTaskItem.id,
        columnId: activeTaskItem.columnId,
        order: newOrder,
      })
    } else {
      const columnTasks = boardTasks
        .filter((t) => t.columnId === activeTaskItem.columnId)
        .sort((a, b) => a.order - b.order)
      const oldIndex = columnTasks.findIndex((t) => t.id === (active.id as string))
      const newIndex = columnTasks.findIndex((t) => t.id === (over.id as string))

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(columnTasks, oldIndex, newIndex)
        reorderTasks(activeTaskItem.columnId, reordered.map((t) => t.id))
        reorderMutation.mutate({
          columnId: activeTaskItem.columnId,
          taskIds: reordered.map((t) => t.id),
        })
      }
    }

    dragSnapshotRef.current = null
  }

  const handleDeleteColumn = (columnId: string) => {
    const col = boardColumns.find((c) => c.id === columnId)
    const colTasks = boardTasks.filter((t) => t.columnId === columnId)
    const colTitle = col?.title
      ? (col.title.startsWith('board.col.') ? i18n(col.title) : col.title)
      : ''
    toast((toastRef) => (
      <div className="flex items-center gap-3">
        <span className="text-sm">
          {i18n('kanban.deleteColumnConfirm', {
            title: colTitle,
            tasks: colTasks.length > 0 ? i18n('kanban.deleteColumnTasks', { count: colTasks.length }) : '',
          })}
        </span>
        <button
          onClick={() => {
            const { columns: cSnap, tasks: tSnap } = useTaskStore.getState()
            deleteColumn(columnId)
            toast.dismiss(toastRef.id)
            toast.success(i18n('kanban.columnDeleted'))
            deleteColumnMutation.mutate({ id: columnId }, {
              onError: () => {
                useTaskStore.setState(() => ({ columns: cSnap, tasks: tSnap }))
                toast.error(i18n('kanban.failedDeleteColumn'))
              },
            })
          }}
          className="px-2 py-1 text-xs font-medium text-white bg-[var(--danger)] rounded-[var(--radius-sm)] hover:opacity-90"
        >
          {i18n('common.delete')}
        </button>
        <button onClick={() => toast.dismiss(toastRef.id)} className="px-2 py-1 text-xs font-medium text-[var(--label)] bg-[var(--surface-2)] rounded-[var(--radius-sm)] hover:bg-[var(--surface-3)]">{i18n('common.cancel')}</button>
      </div>
    ), { duration: 8000 })
  }

  const handleToggleDone = (column: Column) => {
    const nextIsDone = !column.isDone
    const snapshot = column.isDone
    updateColumn(column.id, { isDone: nextIsDone })
    updateColumnMutation.mutate({ id: column.id, isDone: nextIsDone }, {
      onError: () => {
        updateColumn(column.id, { isDone: snapshot })
        toast.error(i18n('kanban.failedUpdateColumn'))
      },
    })
  }

  if (boards.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[var(--bg)] gap-4">
        <div className="w-12 h-12 rounded-[var(--radius-xl)] bg-[var(--accent-f)] flex items-center justify-center">
          <Kanban className="w-6 h-6 text-[var(--accent)]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-[var(--label)]">{i18n('kanban.noBoards')}</p>
        </div>
        <Button onClick={openCreateBoardModal}>{i18n('kanban.noBoardsCta')}</Button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 h-16 border-b border-[var(--sep)] bg-[var(--bg)]">
        <h2 className="text-lg font-bold text-[var(--label)] flex items-center gap-2">
          {activeBoard?.name || i18n('nav.board')}
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-[var(--label-3)]" />}
        </h2>
        <button
          onClick={() => setShowAddColumn(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--label)] bg-[var(--surface-2)] rounded-[var(--radius-md)] hover:bg-[var(--surface-3)] transition-[colors,transform] duration-[160ms] active:scale-[0.97]"
        >
          <Plus className="w-4 h-4" /> {i18n('kanban.addColumn')}
        </button>
      </div>
      <div className="flex-1 overflow-x-auto p-6 bg-[var(--bg-2)]">
        <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <SortableContext items={boardColumns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-4 h-full stagger-children">
              {boardColumns.map((column) => (
                <KanbanColumn key={column.id} column={column} tasks={boardTasks.filter((t) => t.columnId === column.id)} labels={labels} draggingTaskId={activeTask?.id ?? null} onAddTask={(id) => setAddingToColumn(id)} onEditTask={(task) => setPanelTaskId(task.id)} onEditColumn={(col) => setEditingColumn(col)} onDeleteColumn={handleDeleteColumn} onToggleDone={handleToggleDone} />
              ))}
            </div>
          </SortableContext>
          <DragOverlay
            dropAnimation={{
              duration: 220,
              easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
              sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
            }}
          >
            {activeTask && <div className="rotate-[2deg] scale-[1.02] shadow-[0_8px_24px_rgba(0,0,0,0.15)]"><TaskCard task={activeTask} labels={labels} onClick={() => {}} /></div>}
            {activeColumn && (
              // Full column template — the overlay is sized to the real
              // column's measured rect, so h-full reproduces it 1:1.
              <div className="h-full w-72 flex flex-col rounded-[12px] p-3 bg-[var(--surface-2)] rotate-[1deg] shadow-[0_16px_40px_rgba(0,0,0,0.2)] ring-1 ring-[var(--accent)]">
                <div className="flex items-center gap-2 px-1 mb-3">
                  <GripVertical className="w-3.5 h-3.5 text-[var(--label-3)]" />
                  <h3 className="text-xs font-semibold text-[var(--label)] uppercase tracking-wider">
                    {activeColumn.title.startsWith('board.col.') ? i18n(activeColumn.title) : activeColumn.title}
                  </h3>
                  <span className="text-[10px] font-semibold text-[var(--label-3)] bg-[var(--surface-3)] px-1.5 py-0.5 rounded-full">
                    {boardTasks.filter((t) => t.columnId === activeColumn.id).length}
                  </span>
                </div>
                <div className="flex-1 space-y-2 overflow-hidden">
                  {boardTasks
                    .filter((t) => t.columnId === activeColumn.id)
                    .sort((a, b) => a.order - b.order)
                    .map((t) => <TaskCard key={t.id} task={t} labels={labels} onClick={() => {}} />)}
                </div>
                <div className="flex items-center gap-2 px-3 py-2 mt-2 text-sm text-[var(--label-3)]">
                  <Plus className="w-4 h-4" />
                  {i18n('kanban.addTask')}
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
      {addingToColumn && <TaskModal task={null} columnId={addingToColumn} onClose={() => setAddingToColumn(null)} />}
      {panelTaskId && <TaskPanel taskId={panelTaskId} onClose={() => setPanelTaskId(null)} />}
      {(editingColumn || showAddColumn) && (
        <ColumnModal
          column={editingColumn}
          onClose={() => { setEditingColumn(null); setShowAddColumn(false) }}
          onSave={(title, isDone) => {
            if (editingColumn) {
              const snapshot = { title: editingColumn.title, isDone: editingColumn.isDone }
              updateColumn(editingColumn.id, { title, isDone })
              updateColumnMutation.mutate({ id: editingColumn.id, title, isDone }, {
                onError: () => {
                  updateColumn(editingColumn.id, snapshot)
                  toast.error(i18n('kanban.failedUpdateColumn'))
                },
              })
            } else {
              if (!activeBoardId) return
              createColumnMutation.mutate({ title, boardId: activeBoardId })
            }
            setEditingColumn(null)
            setShowAddColumn(false)
          }}
        />
      )}
    </div>
  )
}
