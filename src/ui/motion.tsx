import { animate, motion, useInView, useMotionValue, type HTMLMotionProps, type Transition } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { haptic } from '../lib/haptics'

export const spring: Transition = { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }
export const softSpring: Transition = { type: 'spring', stiffness: 220, damping: 28, mass: 0.9 }
export const sheetSpring: Transition = { type: 'spring', stiffness: 320, damping: 36, mass: 0.9 }

type PressProps = Omit<HTMLMotionProps<'button'>, 'onTap'> & {
  haptics?: boolean
  scale?: number
  /** Fires on click, so taps, keyboard Enter and assistive tech all work. */
  onTap?: (event: React.MouseEvent<HTMLButtonElement>) => void
}

/** A button that springs under the finger and taps out a haptic. */
export function Press({ haptics = true, scale = 0.955, onTap, onClick, children, ...props }: PressProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale }}
      transition={spring}
      onClick={(event) => {
        if (haptics) haptic()
        onTap?.(event)
        onClick?.(event)
      }}
      {...props}
    >
      {children}
    </motion.button>
  )
}

/** Fades and lifts its children into view the first time they are scrolled to. */
export function Reveal({ children, delay = 0, y = 26, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-12% 0px -8% 0px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(10px)' }}
      animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : undefined}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

interface AnimatedNumberProps {
  value: number
  format?: (v: number) => string
  className?: string
  /** Start the count from here on first render (for a count-up on arrival). */
  from?: number
  duration?: number
}

/** Counts to its value with a spring, writing text directly to avoid re-rendering. */
export function AnimatedNumber({ value, format = (v) => Math.round(v).toLocaleString(), className, from, duration }: AnimatedNumberProps) {
  const mv = useMotionValue(from ?? value)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const write = (v: number) => {
      if (ref.current) ref.current.textContent = format(v)
    }
    write(mv.get())
    const unsubscribe = mv.on('change', write)
    return unsubscribe
    // format is stable in practice; re-subscribing on every render would thrash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mv])

  useEffect(() => {
    const controls = animate(mv, value, duration ? { duration, ease: [0.16, 1, 0.3, 1] } : { type: 'spring', stiffness: 130, damping: 24, mass: 0.8 })
    return () => controls.stop()
  }, [value, mv, duration])

  return <span ref={ref} className={className} />
}

/** Letters fly in one after another. */
export function SplitText({ text, className, delay = 0, stagger = 0.032 }: { text: string; className?: string; delay?: number; stagger?: number }) {
  const words = text.split(' ')
  let index = 0
  return (
    <span className={className} aria-label={text}>
      {words.map((word, w) => (
        <span key={`${word}-${w}`} className="inline-block whitespace-nowrap">
          {Array.from(word).map((char, c) => {
            const i = index++
            return (
              <motion.span
                key={`${char}-${c}`}
                aria-hidden
                className="inline-block"
                initial={{ opacity: 0, y: '0.5em', filter: 'blur(8px)', rotateX: -60 }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)', rotateX: 0 }}
                transition={{ delay: delay + i * stagger, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              >
                {char}
              </motion.span>
            )
          })}
          {w < words.length - 1 && <span className="inline-block">&nbsp;</span>}
        </span>
      ))}
    </span>
  )
}

/** The moving colour wash behind everything. */
export function Aurora() {
  return (
    <>
      <div className="aurora" aria-hidden>
        <span className="a1" />
        <span className="a2" />
        <span className="a3" />
      </div>
      <div className="grain" aria-hidden />
    </>
  )
}
