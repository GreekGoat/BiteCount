import { useEffect, useState } from 'react'

/** Seconds left until a moment, ticking down. */
export function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])
  return <span className="tabular">{Math.max(1, Math.ceil((until - now) / 1000))}</span>
}
