import { motion } from 'motion/react'
import { Check, Minus, Plus } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { haptic } from '../lib/haptics'
import { Press, spring } from './motion'

interface SegmentedProps<T extends string> {
  options: { id: T; label: string; icon?: ReactNode }[]
  value: T
  onChange: (id: T) => void
  className?: string
}

export function Segmented<T extends string>({ options, value, onChange, className }: SegmentedProps<T>) {
  const layoutId = useId()
  return (
    <div className={`flex gap-1 rounded-full border border-line bg-card p-1 ${className ?? ''}`} role="tablist">
      {options.map((option) => {
        const active = option.id === value
        return (
          <button
            key={option.id}
            role="tab"
            aria-selected={active}
            onClick={() => {
              haptic()
              onChange(option.id)
            }}
            className={`relative flex-1 rounded-full px-3 py-2 text-[13px] font-semibold transition-colors ${active ? 'text-white' : 'text-ink-2'}`}
          >
            {active && <motion.span layoutId={layoutId} className="grad absolute inset-0 rounded-full" transition={spring} />}
            <span className="relative flex items-center justify-center gap-1.5">
              {option.icon}
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

interface OptionCardProps {
  label: string
  hint?: string
  emoji?: string
  selected: boolean
  onSelect: () => void
  multi?: boolean
}

/** A big tappable answer to a follow-up question. */
export function OptionCard({ label, hint, emoji, selected, onSelect, multi }: OptionCardProps) {
  return (
    <Press
      onTap={onSelect}
      aria-pressed={selected}
      className={`relative flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
        selected ? 'border-transparent bg-brand/12' : 'border-line bg-card'
      }`}
    >
      {selected && <span className="grad-border pointer-events-none absolute inset-0 rounded-2xl" />}
      {emoji && <span className="text-2xl">{emoji}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink">{label}</span>
        {hint && <span className="block text-[12.5px] leading-tight text-ink-3">{hint}</span>}
      </span>
      <span
        className={`grid size-6 shrink-0 place-items-center border transition-all ${multi ? 'rounded-lg' : 'rounded-full'} ${
          selected ? 'grad border-transparent' : 'border-line-strong'
        }`}
      >
        {selected && <Check size={14} strokeWidth={3.5} className="text-white" />}
      </span>
    </Press>
  )
}

export function Chip({ children, onClick, active, className }: { children: ReactNode; onClick?: () => void; active?: boolean; className?: string }) {
  return (
    <Press
      onTap={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-2 text-[13.5px] font-medium whitespace-nowrap transition-colors ${
        active ? 'border-transparent bg-brand/15 text-ink' : 'border-line bg-card text-ink-2'
      } ${className ?? ''}`}
    >
      {children}
    </Press>
  )
}

interface StepperProps {
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  format?: (value: number) => string
  label?: string
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, format = String, label }: StepperProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  return (
    <div className="flex items-center gap-2">
      <Press
        aria-label={`Less ${label ?? ''}`}
        onTap={() => onChange(clamp(value - step))}
        disabled={value <= min}
        className="grid size-10 place-items-center rounded-full border border-line bg-card text-ink disabled:opacity-35"
      >
        <Minus size={17} strokeWidth={2.6} />
      </Press>
      <span className="tabular min-w-[4.5rem] text-center text-[17px] font-semibold">{format(value)}</span>
      <Press
        aria-label={`More ${label ?? ''}`}
        onTap={() => onChange(clamp(value + step))}
        disabled={value >= max}
        className="grid size-10 place-items-center rounded-full border border-line bg-card text-ink disabled:opacity-35"
      >
        <Plus size={17} strokeWidth={2.6} />
      </Press>
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        haptic()
        onChange(!checked)
      }}
      className={`relative h-[30px] w-[52px] shrink-0 rounded-full border transition-colors ${checked ? 'grad border-transparent' : 'border-line bg-card'}`}
    >
      <motion.span
        layout
        transition={spring}
        className="absolute top-[3px] size-[22px] rounded-full bg-white shadow-md"
        style={{ left: checked ? 27 : 3 }}
      />
    </button>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold tracking-wide text-ink-2 uppercase">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12.5px] text-ink-3">{hint}</span>}
    </label>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-line bg-card px-4 py-3 text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none ${props.className ?? ''}`}
    />
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-3">
      <h2 className="font-display text-[19px] font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  )
}
