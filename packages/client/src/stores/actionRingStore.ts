import { create } from 'zustand'

export type WidgetType = 'pomodoro' | 'ai-assistant'

export interface WidgetConfig {
  id: string
  type: WidgetType
}

interface ActionRingStore {
  isExpanded: boolean
  activeWidget: string | null
  widgets: WidgetConfig[]
  setExpanded: (v: boolean) => void
  setActiveWidget: (id: string | null) => void
}

export const useActionRingStore = create<ActionRingStore>(() => ({
  isExpanded: false,
  activeWidget: null,
  widgets: [
    { id: 'pomodoro', type: 'pomodoro' },
    { id: 'ai-assistant', type: 'ai-assistant' },
  ],
  setExpanded: (v) => useActionRingStore.setState({ isExpanded: v }),
  setActiveWidget: (id) => useActionRingStore.setState({ activeWidget: id }),
}))
