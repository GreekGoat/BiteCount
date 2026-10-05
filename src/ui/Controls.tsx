import { motion, useTransform } from 'motion/react'
import { Check, Minus, Plus } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { haptic } from '../lib/haptics'
import { useLiquidTrack } from './liquid'
import { Press, spring } from './motion'

/* ── Buttons ─────────────────────────────────────────────────────────── */

type ButtonKind = 'prominent' | 'gray' | 'plain' | 'destructive'

const BUTTON_KIND: Record<ButtonKind, string> = {
  prominent: 'glass-tint font-semibold',
  gray: 'bg-fill text-ink font-semibold',
  plain: 'text-tint font-semibold',
  destructive: 'bg-fill text-danger font-semibold',
}

interface ButtonProps {
  kind?: ButtonKind
  size?: 'large' | 'medium' | 'small'
  onTap?: () => void
  disabled?: boolean
  className?: string
  children: ReactNode
  'aria-label'?: string
}

/** iOS 27 buttons are capsules: prominent (tinted glass), gray, plain or destructive. */
export function Button({ kind = 'prominent', size = 'large', onTap, disabled, className, children, ...rest }: ButtonProps) {
  const sizing = size === 'large' ? 'min-h-[52px] px-6 text-[17px]' : size === 'medium' ? 'min-h-[44px] px-5 text-[16px]' : 'min-h-[34px] px-3.5 text-[15px]'
  return (
    <Press
      onTap={onTap}
      disabled={disabled}
      aria-label={rest['aria-label']}
      className={`inline-flex items-center justify-center gap-2 rounded-full transition-opacity disabled:opacity-35 ${sizing} ${BUTTON_KIND[kind]} ${className ?? ''}`}
    >
      {children}
    </Press>
  )
}

/* ── Segmented control ───────────────────────────────────────────────── */

interface SegmentedProps<T extends string> {
  options: { id: T; label: string; icon?: ReactNode }[]
  value: T
  onChange: (id: T) => void
  className?: string
  label?: string
}

/**
 * The iOS 27 segmented control: a raised thumb that glides with a stretch.
 * Press and slide to drag the thumb across, as on iOS; it lifts into glass
 * while held.
 */
export function Segmented<T extends string>({ options, value, onChange, className, label }: SegmentedProps<T>) {
  const ref = useRef<HTMLDivElement>(null)
  const index = Math.max(0, options.findIndex((o) => o.id === value))
  const commit = (slot: number) => {
    const option = options[slot]
    if (!option || option.id === value) return
    haptic()
    onChange(option.id)
  }
  const track = useLiquidTrack(ref, { index, onCommit: commit })
  const thumbX = useTransform(track.x, (v) => v - track.geometry.slotWidth.current / 2)
  const thumbScale = useTransform(track.press, (p) => 1 + p * 0.08)

  return (
    <div
      ref={ref}
      {...track.handlers}
      role="radiogroup"
      aria-label={label}
      className={`relative flex touch-pan-y rounded-full bg-fill p-[3px] select-none ${className ?? ''}`}
    >
      <motion.span
        aria-hidden
        className={`absolute top-[3px] bottom-[3px] left-0 rounded-full ${track.pressed ? 'lens-lifted' : 'seg-thumb'}`}
        style={{ x: thumbX, width: track.slotWidth, scaleX: track.scaleX, scaleY: track.scaleY, scale: thumbScale }}
      />
      {options.map((option, i) => {
        const active = option.id === value
        const lit = track.pressed ? track.hover === i : active
        return (
          <button
            key={option.id}
            data-slot
            role="radio"
            aria-checked={active}
            // Pointer taps are handled by the track; this is for the keyboard.
            onClick={(e) => e.detail === 0 && commit(i)}
            className="relative min-h-[34px] min-w-0 flex-1 rounded-full px-2.5 text-[14px] font-semibold"
          >
            <span className={`relative flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors duration-150 ${lit ? 'text-ink' : 'text-ink-2'}`}>
              {option.icon}
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ── Selection rows ──────────────────────────────────────────────────── */

interface OptionCardProps {
  label: string
  hint?: string
  emoji?: string
  icon?: ReactNode
  selected: boolean
  onSelect: () => void
  multi?: boolean
}

/** A tappable answer: a grouped row with a checkmark, like an iOS selection list. */
export function OptionCard({ label, hint, emoji, icon, selected, onSelect, multi }: OptionCardProps) {
  return (
    <Press
      onTap={onSelect}
      scale={0.98}
      aria-pressed={selected}
      className={`surface flex min-h-[52px] w-full items-center gap-3 rounded-[20px] px-4 py-2.5 text-left transition-colors ${
        selected ? 'ring-2 ring-tint/70' : ''
      }`}
    >
      {emoji && <span className="text-[22px] leading-none">{emoji}</span>}
      {icon && <span className="shrink-0 text-tint">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] leading-snug text-ink">{label}</span>
        {hint && <span className="block text-[13px] leading-tight text-ink-3">{hint}</span>}
      </span>
      <span
        className={`grid size-[22px] shrink-0 place-items-center transition-all ${multi ? 'rounded-[7px]' : 'rounded-full'} ${
          selected ? 'bg-tint text-white dark:text-black' : 'border-[1.5px] border-ink-4'
        }`}
      >
        {selected && <Check size={14} strokeWidth={3.2} />}
      </span>
    </Press>
  )
}

export function Chip({ children, onClick, active, className }: { children: ReactNode; onClick?: () => void; active?: boolean; className?: string }) {
  return (
    <Press
      onTap={onClick}
      className={`flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-medium whitespace-nowrap transition-colors ${
        active ? 'bg-tint text-white dark:text-black' : 'bg-fill text-ink'
      } ${className ?? ''}`}
    >
      {children}
    </Press>
  )
}

/* ── Stepper ─────────────────────────────────────────────────────────── */

interface StepperProps {
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  format?: (value: number) => string
  label?: string
  /** Show the value beside the control. */
  showValue?: boolean
}

/** The iOS stepper: one capsule, minus and plus split by a hairline. */
export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, format = String, label, showValue = true }: StepperProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  const bump = (delta: number) => {
    haptic(6)
    onChange(clamp(value + delta))
  }
  return (
    <div className="flex items-center gap-3">
      {showValue && <span className="tabular min-w-[3rem] text-right text-[17px] text-ink-2">{format(value)}</span>}
      <div className="flex h-[34px] items-center rounded-full bg-fill">
        <button
          aria-label={`Less ${label ?? ''}`.trim()}
          onClick={() => bump(-step)}
          disabled={value <= min}
          className="grid h-full w-[46px] place-items-center text-ink active:opacity-40 disabled:opacity-30"
        >
          <Minus size={18} strokeWidth={2.4} />
        </button>
        <span className="h-[18px] w-[0.5px] bg-separator" aria-hidden />
        <button
          aria-label={`More ${label ?? ''}`.trim()}
          onClick={() => bump(step)}
          disabled={value >= max}
          className="grid h-full w-[46px] place-items-center text-ink active:opacity-40 disabled:opacity-30"
        >
          <Plus size={18} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  )
}

/* ── Switch ──────────────────────────────────────────────────────────── */

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <motion.button
      whileTap="pressed"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        haptic()
        onChange(!checked)
      }}
      className="relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200"
      style={{ background: checked ? 'var(--switch-on)' : 'var(--fill-2)' }}
    >
      {/* The knob stretches and turns to clear glass while held, as on iOS 27. */}
      <motion.span
        className="absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full shadow-[0_3px_8px_rgba(0,0,0,0.15),0_3px_1px_rgba(0,0,0,0.06)]"
        initial={false}
        animate={{ x: checked ? 20 : 0, width: 27, backgroundColor: 'rgba(255,255,255,1)', scale: 1 }}
        variants={{ pressed: { x: checked ? 12 : 0, width: 35, backgroundColor: 'rgba(255,255,255,0.62)', scale: 1.14 } }}
        transition={spring}
      />
    </motion.button>
  )
}

/* ── Slider ──────────────────────────────────────────────────────────── */

interface SliderProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  label: string
}

export function Slider({ value, onChange, min, max, step, label }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      className="ios-range"
      style={{ ['--pct' as string]: `${pct}%` }}
    />
  )
}

/* ── Fields ──────────────────────────────────────────────────────────── */

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-4 text-[13px] text-ink-3">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block px-4 text-[13px] leading-snug text-ink-3">{hint}</span>}
    </label>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-[48px] w-full rounded-[16px] bg-surface px-4 text-[17px] text-ink shadow-[inset_0_1px_0_var(--card-hi),inset_0_0_0_0.5px_var(--card-edge)] outline-none placeholder:text-ink-4 focus:ring-2 focus:ring-tint/40 ${props.className ?? ''}`}
    />
  )
}

/** A prominent section header, sentence case, the iOS 27 way. */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3 px-1">
      <h2 className="text-[22px] leading-tight font-bold tracking-[-0.01em]">{children}</h2>
      {action}
    </div>
  )
}
