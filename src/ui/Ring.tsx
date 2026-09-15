import { motion } from 'motion/react'
import { useId, type ReactNode } from 'react'

interface RingProps {
  /** 0–1 (values above 1 wrap into the over-budget ring). */
  progress: number
  size?: number
  stroke?: number
  children?: ReactNode
  /** Colour when the value has gone past the target. */
  over?: boolean
  className?: string
}

export function Ring({ progress, size = 232, stroke = 16, children, over = false, className }: RingProps) {
  const gradientId = useId()
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, progress))
  const overflow = Math.max(0, Math.min(1, progress - 1))

  return (
    <div className={`relative grid place-items-center ${className ?? ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--b1)" />
            <stop offset="52%" stopColor="var(--b2)" />
            <stop offset="100%" stopColor="var(--b3)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={over ? 'var(--warn)' : `url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped) }}
          transition={{ type: 'spring', stiffness: 90, damping: 22, mass: 1 }}
        />
        {overflow > 0 && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--danger)"
            strokeWidth={stroke * 0.55}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - overflow) }}
            transition={{ type: 'spring', stiffness: 90, damping: 22, mass: 1, delay: 0.1 }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

interface BarProps {
  value: number
  target: number
  color: string
  label: string
  unit?: string
  compact?: boolean
}

/** A macro row: label, value and a thin meter. */
export function MacroBar({ value, target, color, label, unit = 'g', compact = false }: BarProps) {
  const pct = target > 0 ? Math.min(1, value / target) : 0
  const over = target > 0 && value > target
  return (
    <div className={compact ? '' : 'min-w-0 flex-1'}>
      <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
        <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        {label}
      </div>
      <div className="tabular mt-0.5 text-[12.5px] whitespace-nowrap text-ink-3">
        <span className="text-[14px] font-bold text-ink">{Math.round(value)}</span>
        {` / ${Math.round(target)} ${unit}`}
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: 'var(--line)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: over ? 'var(--warn)' : color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ type: 'spring', stiffness: 110, damping: 20 }}
        />
      </div>
    </div>
  )
}
