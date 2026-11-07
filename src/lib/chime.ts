import { useCallback, useEffect, useState } from 'react'

/**
 * The new-order chime: two soft notes made with the Web Audio API, so there is no audio file to load.
 * Browsers only allow sound after the person has touched the page, so the first tap anywhere on the
 * dashboard (or the sound toggle) unlocks it.
 */
const STORAGE_KEY = 'altitude.dashboard.sound'

let context: AudioContext | null = null

function audio(): AudioContext | null {
  if (context) return context
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  context = new Ctor()
  return context
}

export function unlockAudio(): void {
  const ctx = audio()
  if (ctx && ctx.state === 'suspended') void ctx.resume()
}

export function playChime(): void {
  const ctx = audio()
  if (!ctx || ctx.state !== 'running') return
  const start = ctx.currentTime + 0.02
  ;[
    { freq: 880, at: 0 },
    { freq: 1174.66, at: 0.17 },
  ].forEach(({ freq, at }) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, start + at)
    gain.gain.exponentialRampToValueAtTime(0.22, start + at + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.55)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start + at)
    osc.stop(start + at + 0.6)
  })
}

/** Sound on or off for the dashboard, remembered on this device. */
export function useSoundPreference() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'off'
    } catch {
      return true
    }
  })

  useEffect(() => {
    // Any first touch unlocks audio, so the alert works without finding the toggle.
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const toggle = useCallback(() => {
    setEnabled((on) => {
      const next = !on
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
      } catch {
        /* ignore */
      }
      if (next) {
        unlockAudio()
        // Let the staff member hear what the alert sounds like.
        window.setTimeout(playChime, 80)
      }
      return next
    })
  }, [])

  return { enabled, toggle }
}
