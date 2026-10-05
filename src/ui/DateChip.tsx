import { CalendarDays, ChevronDown } from 'lucide-react'
import { dayKey, relativeDayLabel, type DayKey } from '../lib/date'
import { haptic } from '../lib/haptics'

/**
 * Which day something is logged to. Tapping it opens the native iOS date
 * picker (a real date input laid invisibly over the chip). Past days stand
 * out in the tint so logging to yesterday is never a surprise.
 */
export function DateChip({ value, onChange, label = 'Date to log to' }: { value: DayKey; onChange: (date: DayKey) => void; label?: string }) {
  const today = dayKey()
  const past = value !== today
  return (
    <span
      className={`relative inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${past ? 'bg-tint-soft text-tint' : 'bg-fill text-ink-2'}`}
    >
      <CalendarDays size={14} strokeWidth={2.2} />
      {relativeDayLabel(value)}
      <ChevronDown size={13} strokeWidth={2.4} />
      <input
        type="date"
        className="date-overlay"
        value={value}
        max={today}
        aria-label={label}
        onChange={(e) => {
          const next = e.target.value
          if (!next) return
          haptic()
          onChange(next > today ? today : next)
        }}
      />
    </span>
  )
}
