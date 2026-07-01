import { useEffect, useRef, useState } from 'react'

// Minimal typings for the Web Speech API (not part of TS's DOM lib).
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): { transcript: string }
  [index: number]: { transcript: string }
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number
  readonly results: { length: number; item(i: number): SpeechRecognitionResultLike; [i: number]: SpeechRecognitionResultLike }
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
}

interface UseSpeechRecognition {
  supported: boolean
  listening: boolean
  start: (lang: string) => void
  stop: () => void
}

/**
 * Thin wrapper over the browser Web Speech API. Calls `onTranscript` with each
 * finalized chunk of recognized speech, and `onError` for failures (e.g. denied
 * microphone permission). Gracefully reports `supported: false` where the API is
 * unavailable (e.g. Firefox).
 */
export function useSpeechRecognition(
  onTranscript: (text: string) => void,
  onError?: (error: string) => void,
): UseSpeechRecognition {
  const Ctor = typeof window !== 'undefined' ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined
  const supported = !!Ctor

  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  // Keep the latest callbacks without recreating the recognition instance.
  const onTranscriptRef = useRef(onTranscript)
  const onErrorRef = useRef(onError)
  onTranscriptRef.current = onTranscript
  onErrorRef.current = onError

  // Stop recognition if the component using the hook unmounts.
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  const start = (lang: string) => {
    if (!Ctor || recognitionRef.current) return
    const recognition = new Ctor()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onresult = (e) => {
      let finalText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        if (result.isFinal) finalText += result[0].transcript
      }
      const trimmed = finalText.trim()
      if (trimmed) onTranscriptRef.current(trimmed)
    }
    recognition.onerror = (e) => {
      onErrorRef.current?.(e.error)
      setListening(false)
    }
    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      setListening(true)
    } catch {
      // start() throws if called while already active — ignore.
    }
  }

  const stop = () => {
    recognitionRef.current?.stop()
  }

  return { supported, listening, start, stop }
}
