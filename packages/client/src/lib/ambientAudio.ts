export type SoundType = 'rain' | 'ocean' | 'night'

const SOURCES: Record<SoundType, string> = {
  rain:  'https://raw.githubusercontent.com/bradtraversy/ambient-sound-mixer/master/audio/rain.mp3',
  ocean: 'https://raw.githubusercontent.com/bradtraversy/ambient-sound-mixer/master/audio/ocean.mp3',
  night: 'https://raw.githubusercontent.com/bradtraversy/ambient-sound-mixer/master/audio/night.mp3',
}

class AmbientAudio {
  private el: HTMLAudioElement | null = null

  play(sound: SoundType, volume: number): Promise<void> {
    this.stop()
    this.el = new Audio(SOURCES[sound])
    this.el.loop = true
    this.el.volume = volume
    return this.el.play()
  }

  stop(): void {
    if (!this.el) return
    this.el.pause()
    this.el.removeAttribute('src')
    this.el.load()
    this.el = null
  }

  setVolume(volume: number): void {
    if (this.el) this.el.volume = volume
  }
}

export const ambientAudio = new AmbientAudio()
