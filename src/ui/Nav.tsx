import { motion, useScroll, useTransform } from 'motion/react'
import { Moon, Sun } from 'lucide-react'
import { useSyncExternalStore, type ReactNode } from 'react'
import { useStore } from '../lib/store'
import { litGlass, Press, spring } from './motion'

/*
 * The iOS navigation layer: a bar pinned under the status bar whose glass
 * buttons stay put, a scroll-edge blur that appears once content slides under
 * it, and an inline title that takes over from the large title.
 */

/** Pixels scrolled before the large title has slid under the bar. */
const TITLE_GONE = 46

export function NavBar({ title, leading, trailing }: { title: string; leading?: ReactNode; trailing?: ReactNode }) {
  const { scrollY } = useScroll()
  const edge = useTransform(scrollY, [4, 30], [0, 1])
  const inline = useTransform(scrollY, [TITLE_GONE - 12, TITLE_GONE + 6], [0, 1])
  const inlineY = useTransform(scrollY, [TITLE_GONE - 12, TITLE_GONE + 6], [6, 0])

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30">
      <motion.div className="edge-top absolute inset-x-0 top-0 h-[calc(var(--sat)+84px)]" style={{ opacity: edge }} aria-hidden />
      <div className="relative mx-auto flex h-[52px] max-w-[560px] items-center gap-2 px-4" style={{ marginTop: 'var(--sat)' }}>
        <div className="pointer-events-auto flex min-w-[44px] items-center gap-2">{leading}</div>
        <motion.div
          className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold"
          style={{ opacity: inline, y: inlineY }}
          aria-hidden
        >
          {title}
        </motion.div>
        <div className="pointer-events-auto flex min-w-[44px] items-center justify-end gap-2">{trailing}</div>
      </div>
    </header>
  )
}

/** The large title at the top of a screen's content. */
export function LargeTitle({ children, kicker, accessory }: { children: ReactNode; kicker?: ReactNode; accessory?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3 px-1">
      <div className="min-w-0">
        {kicker && <p className="text-[15px] font-semibold text-ink-3">{kicker}</p>}
        <h1 className="truncate text-[34px] leading-[41px] font-bold tracking-[0.01em]">{children}</h1>
      </div>
      {accessory}
    </div>
  )
}

/** A round Liquid Glass button. Like iOS 27 glass, it swells and lights up under the finger. */
export function GlassButton({ onTap, label, children, className }: { onTap?: () => void; label: string; children: ReactNode; className?: string }) {
  return (
    <Press onTap={onTap} aria-label={label} scale={1.14} {...litGlass} className={`glass rim grid size-11 place-items-center rounded-full text-ink ${className ?? ''}`}>
      {children}
    </Press>
  )
}

/** A monogram, the way Contacts draws one. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '·'
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: 'linear-gradient(180deg, #a5abb8, #858994)',
        fontFamily: 'var(--font-rounded)',
      }}
      aria-hidden
    >
      {initials}
    </span>
  )
}

/** Avatar in a glass ring, opening You. */
export function AvatarButton({ onTap }: { onTap: () => void }) {
  const name = useStore((s) => s.profile.name)
  return (
    <Press onTap={onTap} aria-label="Open your profile and settings" scale={1.14} {...litGlass} className="glass rim grid size-11 place-items-center rounded-full">
      <Avatar name={name} size={36} />
    </Press>
  )
}

const LIGHT_QUERY = '(prefers-color-scheme: light)'
const subscribeScheme = (onChange: () => void) => {
  const mq = matchMedia(LIGHT_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/** One tap between dark and light. System, Light and Dark all live in You. */
export function ThemeButton() {
  const theme = useStore((s) => s.settings.theme)
  const updateSettings = useStore((s) => s.updateSettings)
  const systemLight = useSyncExternalStore(subscribeScheme, () => matchMedia(LIGHT_QUERY).matches)
  const resolved = theme === 'system' ? (systemLight ? 'light' : 'dark') : theme
  const next = resolved === 'dark' ? 'light' : 'dark'
  return (
    <GlassButton onTap={() => updateSettings({ theme: next })} label={`Switch to ${next} mode`}>
      <motion.span key={resolved} initial={{ rotate: -70, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} transition={spring}>
        {resolved === 'dark' ? <Sun size={20} strokeWidth={2.2} /> : <Moon size={20} strokeWidth={2.2} />}
      </motion.span>
    </GlassButton>
  )
}
