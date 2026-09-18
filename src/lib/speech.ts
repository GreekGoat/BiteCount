/** Dictation through the browser's speech recognition, where it exists (Safari and Chrome). */

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type Ctor = new () => SpeechRecognitionLike

const getCtor = (): Ctor | null => {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const speechSupported = () => getCtor() !== null

export interface Dictation {
  stop: () => void
}

interface DictationHandlers {
  onText: (text: string, final: boolean) => void
  onEnd: () => void
  onError: (message: string) => void
}

export function startDictation({ onText, onEnd, onError }: DictationHandlers): Dictation | null {
  const Ctor = getCtor()
  if (!Ctor) return null

  const recognition = new Ctor()
  recognition.lang = navigator.language || 'en-US'
  recognition.continuous = true
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  recognition.onresult = (event) => {
    let text = ''
    let final = false
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i]
      text += result[0]?.transcript ?? ''
      if (result.isFinal) final = true
    }
    onText(text.trim(), final)
  }
  recognition.onerror = (event) => {
    const message =
      event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'Microphone access was blocked. Allow it in your browser settings.'
        : event.error === 'no-speech'
          ? 'I did not catch that. Try again.'
          : 'Dictation stopped unexpectedly.'
    onError(message)
  }
  recognition.onend = onEnd

  try {
    recognition.start()
  } catch {
    return null
  }
  return { stop: () => recognition.stop() }
}
