import { useMotionValue, useSpring, useTransform, useVelocity, type MotionValue } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { haptic } from '../lib/haptics'

/*
 * The iOS 27 "liquid lens": the selection indicator in tab bars and segmented
 * controls. Tap a slot and the lens glides there, stretching as it moves.
 * Press and hold, and it lifts into a glass droplet that follows the finger,
 * magnifies what is under it and ticks at each slot; let go and it settles.
 *
 * Everything that moves per frame is a motion value, so dragging never
 * re-renders React except when the finger crosses into another slot.
 */

export interface LiquidTrack {
  /** Centre of the lens in px from the track's left edge, smoothed by a spring. */
  x: MotionValue<number>
  /** Stretch along the direction of travel, and the matching squash. */
  scaleX: MotionValue<number>
  scaleY: MotionValue<number>
  /** 0 at rest, 1 while a finger is down; sprung, for the lift. */
  press: MotionValue<number>
  pressed: boolean
  /** The slot under the finger while pressed, the selected slot otherwise. */
  hover: number
  /** Width of a slot, for sizing the lens. */
  slotWidth: number
  /** Live geometry, read by useNearness without re-rendering. */
  geometry: { centers: RefObject<number[]>; slotWidth: RefObject<number> }
  handlers: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void
    onPointerMove: (e: PointerEvent<HTMLElement>) => void
    onPointerUp: (e: PointerEvent<HTMLElement>) => void
    onPointerCancel: (e: PointerEvent<HTMLElement>) => void
  }
}

interface Options {
  index: number
  /** Called with the slot the finger was lifted over (or tapped). */
  onCommit: (slot: number) => void
  /** Slots the lens may rest on; others (like an add button) only act. */
  restable?: (slot: number) => boolean
}

export function useLiquidTrack(ref: RefObject<HTMLElement | null>, { index, onCommit, restable = () => true }: Options): LiquidTrack {
  const target = useMotionValue(0)
  const x = useSpring(target, { stiffness: 520, damping: 34, mass: 0.7 })
  const velocity = useVelocity(x)
  const scaleX = useTransform(velocity, [-2200, 0, 2200], [1.32, 1, 1.32], { clamp: true })
  const scaleY = useTransform(velocity, [-2200, 0, 2200], [0.84, 1, 0.84], { clamp: true })
  const pressTarget = useMotionValue(0)
  const press = useSpring(pressTarget, { stiffness: 420, damping: 26, mass: 0.6 })

  const [pressed, setPressed] = useState(false)
  const [hover, setHover] = useState(index)
  const [slotWidth, setSlotWidth] = useState(0)
  const hoverRef = useRef(index)
  const centers = useRef<number[]>([])
  const slotWidthRef = useRef(0)
  const gesture = useRef<{ id: number; left: number } | null>(null)
  const placed = useRef(false)

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const slots = Array.from(el.querySelectorAll<HTMLElement>('[data-slot]'))
    centers.current = slots.map((s) => s.offsetLeft + s.offsetWidth / 2)
    const restWidths = slots.filter((_, i) => restable(i)).map((s) => s.offsetWidth)
    slotWidthRef.current = restWidths.length ? Math.min(...restWidths) : (slots[0]?.offsetWidth ?? 0)
    setSlotWidth(slotWidthRef.current)
  }, [ref, restable])

  const slotAt = (px: number) => {
    let best = 0
    centers.current.forEach((c, i) => {
      if (Math.abs(c - px) < Math.abs(centers.current[best] - px)) best = i
    })
    return best
  }

  const clampX = (px: number) => {
    const c = centers.current
    return c.length ? Math.min(c[c.length - 1], Math.max(c[0], px)) : px
  }

  // Rest on the selected slot: jump there the first time, glide afterwards.
  useLayoutEffect(() => {
    measure()
    if (gesture.current) return
    const c = centers.current[index]
    if (c == null) return
    if (!placed.current) {
      target.jump(c)
      x.jump(c)
      placed.current = true
    } else target.set(c)
    hoverRef.current = index
    setHover(index)
  }, [index, measure, target, x])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      measure()
      const c = centers.current[index]
      if (c != null && !gesture.current) {
        target.jump(c)
        x.jump(c)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, index, measure, target, x])

  const local = (e: PointerEvent<HTMLElement>) => e.clientX - (gesture.current?.left ?? ref.current!.getBoundingClientRect().left)

  const end = (slot: number | null) => {
    gesture.current = null
    setPressed(false)
    pressTarget.set(0)
    const rest = slot != null && restable(slot) ? slot : index
    target.set(centers.current[rest] ?? target.get())
    hoverRef.current = rest
    setHover(rest)
  }

  return {
    x,
    scaleX,
    scaleY,
    press,
    pressed,
    hover,
    slotWidth,
    geometry: { centers, slotWidth: slotWidthRef },
    handlers: {
      onPointerDown: (e) => {
        if (e.button !== 0 || !ref.current) return
        measure()
        ref.current.setPointerCapture(e.pointerId)
        gesture.current = { id: e.pointerId, left: ref.current.getBoundingClientRect().left }
        setPressed(true)
        pressTarget.set(1)
        const px = local(e)
        target.set(clampX(px))
        const slot = slotAt(px)
        if (slot !== hoverRef.current) {
          hoverRef.current = slot
          setHover(slot)
        }
      },
      onPointerMove: (e) => {
        if (!gesture.current || gesture.current.id !== e.pointerId) return
        const px = local(e)
        target.set(clampX(px))
        const slot = slotAt(px)
        if (slot !== hoverRef.current) {
          hoverRef.current = slot
          setHover(slot)
          haptic(4)
        }
      },
      onPointerUp: (e) => {
        if (!gesture.current || gesture.current.id !== e.pointerId) return
        const slot = slotAt(local(e))
        end(slot)
        onCommit(slot)
      },
      onPointerCancel: () => {
        if (gesture.current) end(null)
      },
    },
  }
}

/** 0 when the lens sits on this slot, rising to 1 a slot away. Drives the magnifier. */
export function useNearness(track: LiquidTrack, slot: number): MotionValue<number> {
  return useTransform(track.x, (v) => {
    const c = track.geometry.centers.current[slot]
    const w = track.geometry.slotWidth.current
    if (c == null || !w) return 1
    return Math.min(1, Math.abs(v - c) / w)
  })
}
