import { motion } from 'motion/react'
import { MessageSquareText, Sparkles, Target, WifiOff, type LucideIcon } from 'lucide-react'
import { Button } from '../ui/Controls'

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: MessageSquareText,
    title: 'A whole day in one message',
    body: '"Breakfast was 2 parathas, lunch biryani, dal for dinner." Every item lands in the right meal.',
  },
  {
    icon: Sparkles,
    title: 'A coach that knows your day',
    body: 'Ask what to eat next, or whether that pizza fits. It answers from your own log.',
  },
  {
    icon: Target,
    title: 'Built on your formula',
    body: 'Weight × 2.2 × 15, a 10% deficit, and macros worked out from your weight.',
  },
  {
    icon: WifiOff,
    title: 'Private, and works offline',
    body: 'Your log stays on your phone. The food list works with no signal.',
  },
]

const ease = [0.16, 1, 0.3, 1] as const

/** The first screen, in the style of an iOS welcome sheet. */
export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-6" style={{ paddingTop: 'calc(var(--sat) + 40px)' }}>
      <div className="flex flex-col items-center text-center">
        <AppIcon />
        <motion.h1
          className="mt-7 text-[34px] leading-[41px] font-bold"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7, ease }}
        >
          Welcome to BiteCount
        </motion.h1>
        <motion.p
          className="mt-2 max-w-[22rem] text-[17px] leading-snug text-ink-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.7, ease }}
        >
          Say what you ate the way you would say it out loud. BiteCount does the counting.
        </motion.p>
      </div>

      <ul className="mt-9 space-y-6">
        {FEATURES.map((feature, i) => (
          <motion.li
            key={feature.title}
            className="flex gap-4"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + i * 0.09, duration: 0.7, ease }}
          >
            <feature.icon size={30} strokeWidth={1.9} className="mt-0.5 shrink-0 text-tint" />
            <div>
              <h2 className="text-[17px] leading-snug font-semibold">{feature.title}</h2>
              <p className="mt-0.5 text-[15px] leading-snug text-ink-2">{feature.body}</p>
            </div>
          </motion.li>
        ))}
      </ul>

      <motion.div
        className="sticky bottom-0 mt-auto -mx-6 bg-gradient-to-t from-bg via-bg to-transparent px-6 pt-10"
        style={{ paddingBottom: 'max(20px, var(--sab))' }}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.6, ease }}
      >
        <Button onTap={onStart} className="w-full">
          Continue
        </Button>
        <p className="mt-3 text-center text-[13px] text-ink-3">Setup takes about a minute.</p>
      </motion.div>
    </div>
  )
}

/** The app icon popping in while its calorie ring draws around it. */
function AppIcon() {
  const size = 132
  const r = 60
  const c = 2 * Math.PI * r
  return (
    <motion.div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      initial={{ scale: 0.55, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18, mass: 0.9 }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="welcome-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--b1)" />
            <stop offset="52%" stopColor="var(--b2)" />
            <stop offset="100%" stopColor="var(--b3)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill)" strokeWidth={6} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#welcome-ring)"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * 0.26 }}
          transition={{ delay: 0.25, duration: 1.4, ease }}
        />
      </svg>
      <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="size-[96px] rounded-[22px] shadow-[0_12px_30px_-10px_rgba(12,144,227,0.55)]" />
    </motion.div>
  )
}
