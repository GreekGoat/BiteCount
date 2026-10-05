import { Check, ChevronRight } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { haptic } from '../lib/haptics'

/*
 * iOS inset grouped lists: rounded sections on the grouped background, rows
 * divided by hairlines that start where the text starts.
 */

interface SectionProps {
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
  /** Where the row separators start, in px from the left edge. */
  inset?: number
}

export function Section({ header, footer, children, className, inset = 16 }: SectionProps) {
  return (
    <section className={className}>
      {header && (typeof header === 'string' ? <h3 className="mb-1.5 px-4 text-[13px] text-ink-3">{header}</h3> : header)}
      <div className="ios-list overflow-hidden rounded-[24px] bg-surface" style={{ ['--sep-inset' as string]: `${inset}px` } as CSSProperties}>
        {children}
      </div>
      {footer && <div className="mt-1.5 px-4 text-[13px] leading-snug text-ink-3">{footer}</div>}
    </section>
  )
}

/** A coloured rounded-square icon, as in Settings. */
export function IconTile({ children, color, size = 30 }: { children: ReactNode; color: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-[8px] text-white" style={{ background: color, width: size, height: size }}>
      {children}
    </span>
  )
}

interface RowProps {
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** Value text on the right, in secondary colour. */
  detail?: ReactNode
  accessory?: 'chevron' | 'check' | 'none' | ReactNode
  onTap?: () => void
  /** Red title, for delete-type rows. */
  destructive?: boolean
  /** Tinted title, for action rows ("Check key"). */
  action?: boolean
  className?: string
  disabled?: boolean
}

export function Row({ icon, title, subtitle, detail, accessory = 'none', onTap, destructive, action, className, disabled }: RowProps) {
  const titleColor = destructive ? 'text-danger' : action ? 'text-tint' : 'text-ink'
  const body = (
    <>
      {icon}
      <span className="min-w-0 flex-1 py-[11px]">
        <span className={`block text-[17px] leading-[22px] ${titleColor}`}>{title}</span>
        {subtitle && <span className="block text-[13px] leading-[18px] text-ink-3">{subtitle}</span>}
      </span>
      {detail != null && <span className="max-w-[55%] shrink-0 truncate text-right text-[17px] text-ink-3">{detail}</span>}
      {accessory === 'chevron' ? (
        <ChevronRight size={18} strokeWidth={2.4} className="-mr-1 shrink-0 text-ink-4" />
      ) : accessory === 'check' ? (
        <Check size={20} strokeWidth={2.6} className="shrink-0 text-tint" />
      ) : accessory === 'none' ? null : (
        accessory
      )}
    </>
  )

  const base = `flex min-h-[52px] w-full items-center gap-3 px-4 text-left ${className ?? ''}`
  if (!onTap) return <div className={base}>{body}</div>
  return (
    <button
      disabled={disabled}
      onClick={() => {
        haptic(5)
        onTap()
      }}
      className={`${base} transition-colors active:bg-fill disabled:opacity-40`}
    >
      {body}
    </button>
  )
}
