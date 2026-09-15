import { AnimatePresence, motion, useScroll, useSpring, useTransform } from 'motion/react'
import { ArrowRight, Camera, ChevronDown, Sparkles, WifiOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { computePlan, PLAN_DEFAULTS } from '../lib/plan'
import { Ring } from '../ui/Ring'
import { AnimatedNumber, Press, Reveal, SplitText } from '../ui/motion'

const ROTATING = ['counted.', 'understood.', 'handled.', 'effortless.']

const DEMO = [
  { emoji: '🍛', name: 'Chicken curry', detail: 'medium bowl · restaurant style', kcal: 497 },
  { emoji: '🫓', name: '2 rotis', detail: 'with a little ghee', kcal: 253 },
  { emoji: '🍵', name: 'Cha', detail: 'milk, 2 sugars', kcal: 105 },
  { emoji: '🥭', name: 'Mango', detail: 'one large', kcal: 180 },
]

const MARQUEE_A = ['🍛 Chicken curry', '🍚 Bhat', '🫓 Roti', '🍜 Ramen', '🍕 Pizza slice', '🥭 Mango', '☕ Latte', '🍣 Sushi']
const MARQUEE_B = ['🥗 Salad', '🍔 Burger', '🥟 Momos', '🍫 Chocolate', '🥚 Omelette', '🍩 Donut', '🧋 Lassi', '🍤 Prawns']

export function Landing({ onStart }: { onStart: () => void }) {
  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 500], [0, -60])
  const heroFade = useTransform(scrollY, [0, 320], [1, 0])
  const progress = useSpring(useTransform(scrollY, [0, 2200], [0, 1]), { stiffness: 120, damping: 28 })

  const [word, setWord] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setWord((w) => (w + 1) % ROTATING.length), 2300)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="mx-auto w-full max-w-[520px] px-5 pb-20">
      <motion.div className="grad fixed inset-x-0 top-0 z-50 h-[3px] origin-left" style={{ scaleX: progress }} aria-hidden />

      {/* Hero */}
      <motion.header style={{ y: heroY, opacity: heroFade }} className="relative pt-[max(26px,env(safe-area-inset-top))]">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-2.5"
        >
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="size-9 rounded-[11px] shadow-lg" />
          <span className="font-display text-[19px] font-bold tracking-tight">BiteCount</span>
        </motion.div>

        <h1 className="mt-14 font-display text-[clamp(42px,13vw,60px)] leading-[1.02] font-extrabold tracking-[-0.03em]">
          <SplitText text="Every bite," />
          <br />
          <span className="relative inline-block h-[1.1em] w-full overflow-hidden align-top">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={ROTATING[word]}
                className="grad-text absolute inset-x-0"
                initial={{ y: '110%', opacity: 0, filter: 'blur(10px)' }}
                animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                exit={{ y: '-110%', opacity: 0, filter: 'blur(10px)' }}
                transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
              >
                {ROTATING[word]}
              </motion.span>
            </AnimatePresence>
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7 }}
          className="mt-5 text-[17px] leading-relaxed text-ink-2"
        >
          Say what you ate the way you'd say it out loud — <span className="text-ink">"2 rotis and a bowl of chicken curry"</span>. BiteCount asks
          the few details that matter and does the maths.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.66, duration: 0.7 }} className="mt-8 flex flex-col gap-3">
          <Press onTap={onStart} className="shine grad relative w-full rounded-2xl py-4 text-[17px] font-bold text-white shadow-xl">
            <span className="relative flex items-center justify-center gap-2">
              Set up my plan <ArrowRight size={19} strokeWidth={2.6} />
            </span>
          </Press>
          <span className="text-center text-[13px] text-ink-3">Takes about a minute · everything stays on your phone</span>
        </motion.div>

        <motion.div
          className="mt-12 flex justify-center text-ink-3"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        >
          <ChevronDown size={22} />
        </motion.div>
      </motion.header>

      <DemoCard />

      {/* Features */}
      <section className="mt-16 space-y-4">
        <Reveal>
          <h2 className="font-display text-[30px] leading-tight font-extrabold tracking-tight">
            It understands <span className="grad-text">real food</span>.
          </h2>
        </Reveal>

        <FeatureCard
          delay={0.05}
          icon={<Sparkles size={18} />}
          title="Anything you type"
          body="Chicken curry, khichuri, a cheeky samosa. If a dish is not in the book, BiteCount asks what it is closest to and estimates it."
        />
        <FeatureCard
          delay={0.1}
          icon={<Camera size={18} />}
          title="Or a photo of the plate"
          body="Point your camera at dinner. With AI turned on it reads the plate, asks about portion size, and breaks the meal into items."
        />
        <FeatureCard
          delay={0.15}
          icon={<WifiOff size={18} />}
          title="Works with no signal"
          body="The food database, the maths and your log all live on your phone. Add it to your home screen and it opens like an app."
        />
      </section>

      <FormulaPreview />

      {/* Marquees */}
      <section className="mt-16 -mx-5 space-y-3 overflow-hidden py-2" aria-hidden>
        <Marquee items={MARQUEE_A} duration={42} />
        <Marquee items={MARQUEE_B} duration={36} reverse />
      </section>

      <Reveal className="mt-16">
        <div className="card grad-border overflow-hidden p-6 text-center">
          <h2 className="font-display text-[27px] leading-tight font-extrabold tracking-tight">Start with your numbers</h2>
          <p className="mx-auto mt-2 max-w-[24rem] text-[15px] text-ink-2">
            Your maintenance calories, a sensible deficit and macros that fit — worked out from your weight in a few taps.
          </p>
          <Press onTap={onStart} className="grad mt-5 w-full rounded-2xl py-4 text-[17px] font-bold text-white shadow-lg">
            Let's go
          </Press>
        </div>
      </Reveal>
    </div>
  )
}

/** A miniature of the app that logs a meal by itself, on a loop. */
function DemoCard() {
  const [count, setCount] = useState(1)
  const budget = 1782
  const shown = DEMO.slice(0, count)
  const total = shown.reduce((sum, item) => sum + item.kcal, 0)

  useEffect(() => {
    const id = setInterval(() => setCount((c) => (c >= DEMO.length ? 1 : c + 1)), 2000)
    return () => clearInterval(id)
  }, [])

  return (
    <Reveal className="mt-6">
      <div className="card overflow-hidden p-5">
        <div className="flex items-center gap-4">
          <Ring progress={total / budget} size={132} stroke={11}>
            <div>
              <AnimatedNumber value={budget - total} className="font-display block text-[27px] leading-none font-extrabold tracking-tight" />
              <span className="text-[10.5px] font-semibold tracking-wide text-ink-3 uppercase">left today</span>
            </div>
          </Ring>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase">Logged just now</div>
            <ul className="mt-2 space-y-1.5">
              <AnimatePresence initial={false} mode="popLayout">
                {shown.map((item) => (
                  <motion.li
                    key={item.name}
                    layout
                    initial={{ opacity: 0, x: 26, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, x: -14, filter: 'blur(6px)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="flex items-center gap-2"
                  >
                    <span className="text-[17px]">{item.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold">{item.name}</span>
                      <span className="block truncate text-[11.5px] text-ink-3">{item.detail}</span>
                    </span>
                    <span className="tabular text-[13px] font-bold">{item.kcal}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        </div>
      </div>
    </Reveal>
  )
}

function FeatureCard({ icon, title, body, delay }: { icon: React.ReactNode; title: string; body: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  return (
    <Reveal delay={delay}>
      <motion.div
        ref={ref}
        className="card p-5"
        style={{ transformPerspective: 900 }}
        animate={{ rotateX: tilt.x, rotateY: tilt.y }}
        transition={{ type: 'spring', stiffness: 220, damping: 20 }}
        onPointerMove={(e) => {
          const rect = ref.current?.getBoundingClientRect()
          if (!rect) return
          const px = (e.clientX - rect.left) / rect.width - 0.5
          const py = (e.clientY - rect.top) / rect.height - 0.5
          setTilt({ x: -py * 9, y: px * 11 })
        }}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      >
        <span className="grad grid size-10 place-items-center rounded-2xl text-white shadow-lg">{icon}</span>
        <h3 className="font-display mt-3.5 text-[19px] font-bold tracking-tight">{title}</h3>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{body}</p>
      </motion.div>
    </Reveal>
  )
}

/** The three-step method, previewed with the example numbers. */
function FormulaPreview() {
  const plan = computePlan(60, PLAN_DEFAULTS)
  const steps = [
    { n: 1, title: 'Maintenance', formula: '60 kg × 2.2 × 15', value: plan.maintenance, unit: 'kcal' },
    { n: 2, title: 'Take off 10%', formula: `${plan.maintenance.toLocaleString()} − ${plan.deficitKcal}`, value: plan.budget, unit: 'kcal a day' },
    { n: 3, title: 'Set macros', formula: `2 g/kg · then ${plan.fat} g fat, ${plan.carbs} g carbs`, value: plan.protein, unit: 'g protein' },
  ]

  return (
    <section className="mt-16">
      <Reveal>
        <h2 className="font-display text-[30px] leading-tight font-extrabold tracking-tight">
          Built on <span className="grad-text">your formula</span>.
        </h2>
        <p className="mt-2 text-[15px] text-ink-2">The method, shown with a 60 kg example. Your own numbers come next.</p>
      </Reveal>
      <div className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <Reveal key={step.n} delay={i * 0.08}>
            <div className="card flex items-center gap-4 p-4">
              <span className="grad-text font-display text-[34px] leading-none font-extrabold">{step.n}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">{step.title}</div>
                <div className="tabular truncate text-[13.5px] text-ink-2">{step.formula}</div>
              </div>
              <div className="shrink-0 text-right">
                <AnimatedNumber value={step.value} from={0} className="font-display text-[23px] leading-none font-extrabold" />
                <div className="max-w-[9rem] text-[11px] leading-tight text-ink-3">{step.unit}</div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Marquee({ items, duration, reverse }: { items: string[]; duration: number; reverse?: boolean }) {
  const doubled = [...items, ...items]
  return (
    <div className="flex overflow-hidden">
      <div className={`marquee-track gap-3 ${reverse ? 'reverse' : ''}`} style={{ ['--marquee-duration' as string]: `${duration}s` }}>
        {doubled.map((item, i) => (
          <span key={`${item}-${i}`} className="glass rounded-full px-4 py-2 text-[13.5px] font-medium whitespace-nowrap text-ink-2">
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
