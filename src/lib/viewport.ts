import { useEffect, useState } from 'react'

/*
 * When the on-screen keyboard opens, iOS Safari does not resize the page. It
 * shrinks the *visual* viewport and scrolls the layout viewport up so the focused
 * field clears the keyboard. Anything `position: fixed` is pinned to the layout
 * viewport, so it rides up with it — which is how a bottom sheet ends up with its
 * top edge behind the status bar.
 *
 * Reading visualViewport lets us re-anchor overlays to the part of the screen the
 * user can actually see.
 */

export interface ViewportMetrics {
  /** Height of the visible area — shrinks while the keyboard is up. */
  height: number
  /** How far down the page the visible area starts. */
  offsetTop: number
  /** A keyboard (or similar panel) is covering part of the screen. */
  keyboardOpen: boolean
}

function read(): ViewportMetrics {
  if (typeof window === 'undefined') return { height: 0, offsetTop: 0, keyboardOpen: false }
  const vv = window.visualViewport
  const layoutHeight = window.innerHeight
  const height = vv?.height ?? layoutHeight
  return {
    height,
    offsetTop: vv?.offsetTop ?? 0,
    // A keyboard takes a big bite; toolbars appearing and going are much smaller.
    keyboardOpen: layoutHeight - height > 120,
  }
}

/** Tracks the visible viewport while `active` is true. */
export function useViewport(active: boolean): ViewportMetrics {
  const [metrics, setMetrics] = useState<ViewportMetrics>(read)

  useEffect(() => {
    if (!active) return
    const update = () => setMetrics(read())
    update()

    const vv = window.visualViewport
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [active])

  return metrics
}
