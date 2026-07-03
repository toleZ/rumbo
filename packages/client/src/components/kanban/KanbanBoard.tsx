import { useState, useRef, useEffect } from 'react'
import {
  DndContext, DragOverlay, closestCorners, pointerWithin, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, type DragOverEvent, type CollisionDetection,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus, Loader2, Kanban } from 'lucide-react'
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

  const [activeTask, setActiveTask] = useState<Task | null>(null)
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

  const moveMutation = trpc.tasks.move.useMutation({
    onError: (_, vars) => {
      if (dragSnapshotRef.current) {
        moveTask(vars.taskId, dragSnapshotRef.current.columnId, dragSnapshotRef.current.order)
      }
      toast.error(i18n('kanban.failedMove'))
    },
  })

  const reorderMutation = trpc.tasks.reorder.useMutation({
    onError: () => {
      toast.error(i18n('kanban.failedReorder'))
    },
  })

  const createColumnMutation = trpc.columns.create.useMutation({
    onSuccess: (data) => {
      useTaskStore.setState((s) => ({
        columns: [...s.columns, { id: data.id, title: data.title, boardId: data.boardId, order: data.order }],
      }))
    },
    onError: () => toast.error(i18n('kanban.failedAddColumn')),
  })

  const updateColumnMutation = trpc.columns.update.useMutation()

  const deleteColumnMutation = trpc.columns.delete.useMutation()

  const reorderColumnsMutation = trpc.columns.reorder.useMutation()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const boardColumns = columns.filter((c) => c.boardId === activeBoardId).sort((a, b) => a.order - b.order)
  const boardTasks = tasks.filter((t) => t.boardId === activeBoardId)
  const activeBoard = boards.find((b) => b.id === activeBoardId)

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'column') {
      columnOrderSnapshotRef.current = boardColumns.map((c) => c.id)
      return
    }
    const task = boardTasks.find((t) => t.id === event.active.id)
    if (task) {
      setActiveTask(task)
      dragSnapshotRef.current = { columnId: task.columnId, order: task.order }
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    if (event.active.data.current?.type === 'column') return
    const { active, over } = event
    if (!over) return
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

    if (active.data.current?.type === 'column') {
      if (!over || active.id === over.id) { columnOrderSnapshotRef.current = null; return }
      const oldIndex = boardColumns.findIndex((c) => c.id === active.id)
      const newIndex = boardColumns.findIndex((c) => c.id === over.id)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(boardColumns, oldIndex, newIndex)
        const ids = reordered.map((c) => c.id)
        reorderColumns(ids)
        const snapshot = columnOrderSnapshotRef.current
        reorderColumnsMutation.mutate({ columnIds: ids }, {
          onError: () => {
            if (snapshot) reorderColumns(snapshot)
            toast.error(i18n('kanban.failedReorderColumn'))
          },
        })
      }
      columnOrderSnapshotRef.current = null
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
          className="px-2 py-1 text-xs font-medium text-white bg-[var(--danger)] rounded-[6px] hover:opacity-90"
        >
          {i18n('common.delete')}
        </button>
        <button onClick={() => toast.dismiss(toastRef.id)} className="px-2 py-1 text-xs font-medium text-[var(--label)] bg-[var(--surface-2)] rounded-[6px] hover:bg-[var(--surface-3)]">{i18n('common.cancel')}</button>
      </div>
    ), { duration: 8000 })
  }

  if (boards.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[var(--bg)] gap-4">
        <div className="w-12 h-12 rounded-[12px] bg-[var(--accent-f)] flex items-center justify-center">
          <Kanban className="w-6 h-6 text-[var(--accent)]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-[var(--label)]">{i18n('kanban.noBoards')}</p>
        </div>
        <button
          onClick={openCreateBoardModal}
          className="px-4 py-2 rounded-[8px] bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-h)] transition-colors active:scale-[0.97]"
        >
          {i18n('kanban.noBoardsCta')}
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--sep)] bg-[var(--bg)]">
        <h2 className="text-lg font-bold text-[var(--label)] flex items-center gap-2">
          {activeBoard?.name || i18n('nav.board')}
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-[var(--label-3)]" />}
        </h2>
        <button
          onClick={() => setShowAddColumn(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--label)] bg-[var(--surface-2)] rounded-[8px] hover:bg-[var(--surface-3)] transition-[colors,transform] duration-[160ms] active:scale-[0.97]"
        >
          <Plus className="w-4 h-4" /> {i18n('kanban.addColumn')}
        </button>
      </div>
      <div className="flex-1 overflow-x-auto p-6 bg-[var(--bg-2)]">
        <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <SortableContext items={boardColumns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-4 h-full stagger-children">
              {boardColumns.map((column) => (
                <KanbanColumn key={column.id} column={column} tasks={boardTasks.filter((t) => t.columnId === column.id)} labels={labels} onAddTask={(id) => setAddingToColumn(id)} onEditTask={(task) => setPanelTaskId(task.id)} onEditColumn={(col) => setEditingColumn(col)} onDeleteColumn={handleDeleteColumn} />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>{activeTask && <div className="rotate-[2deg] scale-[1.02] shadow-[0_8px_24px_rgba(0,0,0,0.15)]"><TaskCard task={activeTask} labels={labels} onClick={() => {}} /></div>}</DragOverlay>
        </DndContext>
      </div>
      {addingToColumn && <TaskModal task={null} columnId={addingToColumn} onClose={() => setAddingToColumn(null)} />}
      {panelTaskId && <TaskPanel taskId={panelTaskId} onClose={() => setPanelTaskId(null)} />}
      {(editingColumn || showAddColumn) && (
        <ColumnModal
          column={editingColumn}
          onClose={() => { setEditingColumn(null); setShowAddColumn(false) }}
          onSave={(title) => {
            if (editingColumn) {
              const snapshot = editingColumn.title
              updateColumn(editingColumn.id, title)
              updateColumnMutation.mutate({ id: editingColumn.id, title }, {
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
