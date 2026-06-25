import { create } from 'zustand'
import type { SoundType } from '../lib/ambientAudio'

export type { SoundType }

interface AmbientStore {
  isPlaying: boolean
  sound: SoundType
  volume: number
  setPlaying: (v: boolean) => void
  setSound: (s: SoundType) => void
  setVolume: (v: number) => void
}

export const useAmbientStore = create<AmbientStore>(() => ({
  isPlaying: false,
  sound: 'rain',
  volume: 0.4,
  setPlaying: (v) => useAmbientStore.setState({ isPlaying: v }),
  setSound: (s) => useAmbientStore.setState({ sound: s }),
  setVolume: (v) => useAmbientStore.setState({ volume: v }),
}))
