import { useEffect, useRef, useState } from 'react'
import { haptic } from '../lib/haptics'

interface RulerProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  /** Label every N steps. */
  majorEvery?: number
  unit?: string
  format?: (value: number) => string
}

const TICK = 12

/** A scrollable measuring-tape picker - the fastest way to set a weight or height on a phone. */
export function Ruler({ value, onChange, min, max, step = 0.5, majorEvery = 10, unit, format }: RulerProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const lastHaptic = useRef(value)
  const [ready, setReady] = useState(false)
  const steps = Math.round((max - min) / step)
  const width = steps * TICK

  // Scroll to the current value on mount (and when it changes from outside).
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const target = ((value - min) / step) * TICK
    if (Math.abs(el.scrollLeft - target) > TICK / 2) el.scrollLeft = target
    setReady(true)
    // Only re-sync when the value changes externally; scrolling reports its own values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const labels: { left: number; text: string }[] = []
  const majorStep = step * majorEvery
  for (let v = Math.ceil(min / majorStep) * majorStep; v <= max; v += majorStep) {
    labels.push({ left: ((v - min) / step) * TICK, text: format ? format(v) : String(Math.round(v)) })
  }

  return (
    <div className="relative select-none">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center">
        <div className="h-9 w-[3px] rounded-full" style={{ background: 'var(--b2)' }} />
      </div>
      <div
        ref={scroller}
        className="no-scrollbar relative overflow-x-auto overflow-y-hidden overscroll-x-contain"
        style={{ paddingInline: '50%', opacity: ready ? 1 : 0 }}
        onScroll={(e) => {
          const raw = min + (e.currentTarget.scrollLeft / TICK) * step
          const next = Math.min(max, Math.max(min, Math.round(raw / step) * step))
          const rounded = Math.round(next * 100) / 100
          if (rounded !== value) onChange(rounded)
          if (Math.abs(rounded - lastHaptic.current) >= step * 2) {
            lastHaptic.current = rounded
            haptic(4)
          }
        }}
      >
        <div
          className="ruler-ticks relative h-11"
          style={{ width, ['--minor-gap' as string]: `${TICK}px`, ['--major-gap' as string]: `${TICK * majorEvery}px` }}
        >
          {labels.map((label) => (
            <span key={label.left} className="tabular absolute top-11 -translate-x-1/2 text-[11px] text-ink-3" style={{ left: label.left }}>
              {label.text}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-6 text-center">
        <span className="font-display text-[44px] leading-none font-bold tracking-tight">{format ? format(value) : value}</span>
        {unit && <span className="ml-1.5 text-[17px] font-semibold text-ink-3">{unit}</span>}
      </div>
    </div>
  )
}
