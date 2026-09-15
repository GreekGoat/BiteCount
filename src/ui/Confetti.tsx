import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rotation: number
  spin: number
  color: string
  life: number
}

const COLORS = ['#ff6b2d', '#ff2f7e', '#6f45ff', '#2fd48a', '#ffb020']

/** A short burst of confetti. Mount it with a key to fire it again. */
export function Confetti({ count = 90, duration = 1900 }: { count?: number; duration?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const originX = width / 2
    const originY = height * 0.42
    const particles: Particle[] = Array.from({ length: count }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.1
      const speed = 5 + Math.random() * 9
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 7,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.35,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: 1,
      }
    })

    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const elapsed = now - start
      ctx.clearRect(0, 0, width, height)
      for (const p of particles) {
        p.vy += 0.32
        p.vx *= 0.995
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.spin
        p.life = Math.max(0, 1 - elapsed / duration)
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.5)
        ctx.restore()
      }
      if (elapsed < duration) frame = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, width, height)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [count, duration])

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[60] size-full" />
}
