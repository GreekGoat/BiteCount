import { motion, useScroll, useTransform } from 'motion/react'

/** The soft colour behind the glass. Static, with a slight parallax as the page scrolls. */
export function Wallpaper() {
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, (v) => -Math.min(Math.max(v, 0), 2400) * 0.03)
  return <motion.div className="wallpaper" style={{ y }} aria-hidden />
}
