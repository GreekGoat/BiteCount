import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { hapticSuccess } from '../lib/haptics'
import { computePlan, PLAN_DEFAULTS, bmi, bmiLabel, projectGoal, type PlanSettings } from '../lib/plan'
import { DEFAULT_PROFILE, useStore, type Profile, type Sex } from '../lib/store'
import { kgToLb, lbToKg, type Units } from '../lib/units'
import { Confetti } from '../ui/Confetti'
import { OptionCard, Segmented, TextInput } from '../ui/Controls'
import { Ruler } from '../ui/Ruler'
import { AnimatedNumber, Press, spring } from '../ui/motion'

const SEXES: { id: Sex; label: string; emoji: string }[] = [
  { id: 'male', label: 'Male', emoji: '👨' },
  { id: 'female', label: 'Female', emoji: '👩' },
  { id: 'unspecified', label: 'Rather not say', emoji: '🙂' },
]

export function Onboarding({ onDone }: { onDone: () => void }) {
  const finishOnboarding = useStore((s) => s.finishOnboarding)
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const [plan, setPlan] = useState<PlanSettings>({ ...PLAN_DEFAULTS })
  const [hasGoal, setHasGoal] = useState(false)

  const patch = (p: Partial<Profile>) => setProfile((prev) => ({ ...prev, ...p }))
  const imperial = profile.units === 'imperial'
  const steps = 6

  const go = (next: number) => {
    setDirection(next > step ? 1 : -1)
    setStep(next)
    window.scrollTo({ top: 0 })
  }

  const canContinue = step !== 0 || profile.name.trim().length > 0

  const finish = () => {
    hapticSuccess()
    finishOnboarding({ ...profile, goalKg: hasGoal ? profile.goalKg : undefined }, plan)
    onDone()
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-5 pt-[max(18px,env(safe-area-inset-top))] pb-[max(18px,env(safe-area-inset-bottom))]">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <Press
          onTap={() => (step === 0 ? undefined : go(step - 1))}
          aria-label="Back"
          className={`grid size-9 place-items-center rounded-full border border-line bg-card ${step === 0 ? 'pointer-events-none opacity-0' : ''}`}
        >
          <ArrowLeft size={17} />
        </Press>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <motion.div className="grad h-full rounded-full" animate={{ width: `${((step + 1) / steps) * 100}%` }} transition={spring} />
        </div>
        <span className="tabular w-10 text-right text-[12.5px] font-semibold text-ink-3">
          {step + 1}/{steps}
        </span>
      </div>

      <div className="relative flex-1 pt-8">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === 0 && (
              <Step title="First, what should I call you?" subtitle="This only ever shows up on your own phone.">
                <TextInput
                  autoFocus
                  value={profile.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="Your name"
                  maxLength={24}
                  className="text-center text-[19px] font-semibold"
                />
              </Step>
            )}

            {step === 1 && (
              <Step title="A little about you" subtitle="Used for your BMI and to keep the numbers sensible.">
                <div className="space-y-2.5">
                  {SEXES.map((sex) => (
                    <OptionCard key={sex.id} label={sex.label} emoji={sex.emoji} selected={profile.sex === sex.id} onSelect={() => patch({ sex: sex.id })} />
                  ))}
                </div>
                <div className="mt-7">
                  <Label>Age</Label>
                  <Ruler value={profile.age} onChange={(v) => patch({ age: Math.round(v) })} min={14} max={90} step={1} majorEvery={5} unit="years" />
                </div>
              </Step>
            )}

            {step === 2 && (
              <Step title="How tall are you?" subtitle="Switch units any time.">
                <Segmented
                  className="mx-auto mb-7 max-w-[15rem]"
                  options={[
                    { id: 'metric' as Units, label: 'Metric' },
                    { id: 'imperial' as Units, label: 'Imperial' },
                  ]}
                  value={profile.units}
                  onChange={(units) => patch({ units })}
                />
                {imperial ? (
                  <Ruler
                    value={profile.heightCm}
                    onChange={(v) => patch({ heightCm: v })}
                    min={122}
                    max={213}
                    step={1.27}
                    majorEvery={10}
                    format={(cm) => `${Math.floor(cm / 30.48)}′${Math.round((cm % 30.48) / 2.54)}″`}
                  />
                ) : (
                  <Ruler value={profile.heightCm} onChange={(v) => patch({ heightCm: Math.round(v) })} min={120} max={215} step={1} majorEvery={10} unit="cm" />
                )}
              </Step>
            )}

            {step === 3 && (
              <Step title="And your weight?" subtitle="Everything in your plan is worked out from this.">
                {imperial ? (
                  <Ruler
                    value={kgToLb(profile.weightKg)}
                    onChange={(lb) => patch({ weightKg: lbToKg(lb) })}
                    min={66}
                    max={441}
                    step={1}
                    majorEvery={10}
                    unit="lb"
                    format={(lb) => lb.toFixed(0)}
                  />
                ) : (
                  <Ruler value={profile.weightKg} onChange={(kg) => patch({ weightKg: kg })} min={30} max={200} step={0.5} majorEvery={10} unit="kg" format={(kg) => kg.toFixed(1)} />
                )}
                <div className="mt-6 text-center text-[13.5px] text-ink-2">
                  BMI <span className="tabular font-semibold text-ink">{bmi(profile.weightKg, profile.heightCm).toFixed(1)}</span> ·{' '}
                  {bmiLabel(bmi(profile.weightKg, profile.heightCm))}
                </div>
              </Step>
            )}

            {step === 4 && (
              <Step title="Where do you want to get to?" subtitle="Optional — it just adds a finish line to your progress.">
                <div className="mb-5 flex justify-center">
                  <Segmented
                    className="max-w-[17rem]"
                    options={[
                      { id: 'no', label: 'No target' },
                      { id: 'yes', label: 'Set a target' },
                    ]}
                    value={hasGoal ? 'yes' : 'no'}
                    onChange={(v) => {
                      const on = v === 'yes'
                      setHasGoal(on)
                      if (on && !profile.goalKg) patch({ goalKg: Math.max(35, Math.round((profile.weightKg - 5) * 2) / 2) })
                    }}
                  />
                </div>
                {hasGoal &&
                  (imperial ? (
                    <Ruler
                      value={kgToLb(profile.goalKg ?? profile.weightKg)}
                      onChange={(lb) => patch({ goalKg: lbToKg(lb) })}
                      min={66}
                      max={441}
                      step={1}
                      majorEvery={10}
                      unit="lb"
                      format={(lb) => lb.toFixed(0)}
                    />
                  ) : (
                    <Ruler
                      value={profile.goalKg ?? profile.weightKg}
                      onChange={(kg) => patch({ goalKg: kg })}
                      min={30}
                      max={200}
                      step={0.5}
                      majorEvery={10}
                      unit="kg"
                      format={(kg) => kg.toFixed(1)}
                    />
                  ))}
              </Step>
            )}

            {step === 5 && <PlanStep profile={profile} plan={plan} setPlan={setPlan} hasGoal={hasGoal} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="pt-6">
        {step < steps - 1 ? (
          <Press
            onTap={() => canContinue && go(step + 1)}
            disabled={!canContinue}
            className="grad w-full rounded-2xl py-4 text-[17px] font-bold text-white shadow-lg disabled:opacity-40"
          >
            <span className="flex items-center justify-center gap-2">
              Continue <ArrowRight size={18} strokeWidth={2.6} />
            </span>
          </Press>
        ) : (
          <Press onTap={finish} className="grad w-full rounded-2xl py-4 text-[17px] font-bold text-white shadow-lg">
            <span className="flex items-center justify-center gap-2">
              Start logging <Check size={19} strokeWidth={3} />
            </span>
          </Press>
        )}
      </div>
    </div>
  )
}

function Step({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-[30px] leading-[1.1] font-extrabold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-2 text-[15px] text-ink-2">{subtitle}</p>}
      <div className="mt-8">{children}</div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 text-center text-[13px] font-semibold tracking-wide text-ink-3 uppercase">{children}</div>
}

function PlanStep({ profile, plan, setPlan, hasGoal }: { profile: Profile; plan: PlanSettings; setPlan: (p: PlanSettings) => void; hasGoal: boolean }) {
  const result = useMemo(() => computePlan(profile.weightKg, plan), [profile.weightKg, plan])
  const projection = hasGoal ? projectGoal(profile.weightKg, profile.goalKg, result.deficitKcal) : null

  return (
    <div>
      <Confetti />
      <div className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-brand uppercase">
        <Sparkles size={15} /> Your plan
      </div>
      <h1 className="font-display mt-1 text-[30px] leading-[1.1] font-extrabold tracking-tight">
        {profile.name.trim() ? `Here you go, ${profile.name.trim().split(' ')[0]}` : 'Here you go'}
      </h1>

      <div className="card mt-5 space-y-4 p-5">
        <Row label="Maintenance" formula={`${profile.weightKg.toFixed(1)} kg × 2.2 × 15`} value={result.maintenance} unit="kcal" />
        <div className="hairline" />
        <div>
          <Row label={`Deficit (${plan.deficitPct}%)`} formula={`− ${result.deficitKcal} kcal`} value={result.budget} unit="kcal a day" highlight />
          <input
            type="range"
            min={0}
            max={25}
            step={1}
            value={plan.deficitPct}
            onChange={(e) => setPlan({ ...plan, deficitPct: Number(e.target.value) })}
            className="mt-3 w-full accent-[var(--b2)]"
            aria-label="Deficit percentage"
          />
          <div className="flex justify-between text-[11.5px] text-ink-3">
            <span>Maintain</span>
            <span className={plan.deficitPct === 10 ? 'font-semibold text-ink' : ''}>10% recommended</span>
            <span>Aggressive</span>
          </div>
        </div>
        <div className="hairline" />
        <div className="grid grid-cols-3 gap-2 text-center">
          <Macro label="Protein" value={result.protein} color="var(--protein)" />
          <Macro label="Carbs" value={result.carbs} color="var(--carbs)" />
          <Macro label="Fat" value={result.fat} color="var(--fat)" />
        </div>
      </div>

      {projection && (
        <p className="mt-4 text-center text-[13.5px] text-ink-2">
          At this pace you would reach your target in about <span className="font-semibold text-ink">{projection.weeks} weeks</span> — around{' '}
          {projection.date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.
        </p>
      )}
      <p className="mt-3 text-center text-[12.5px] text-ink-3">You can change any of this later on the Plan tab.</p>
    </div>
  )
}

function Row({ label, formula, value, unit, highlight }: { label: string; formula: string; value: number; unit: string; highlight?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">{label}</div>
        <div className="tabular truncate text-[13.5px] text-ink-2">{formula}</div>
      </div>
      <div className="shrink-0 text-right">
        <AnimatedNumber
          value={value}
          from={0}
          className={`font-display text-[26px] leading-none font-extrabold ${highlight ? 'grad-text' : ''}`}
        />
        <div className="text-[11px] text-ink-3">{unit}</div>
      </div>
    </div>
  )
}

function Macro({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border border-line p-3">
      <div className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-ink-2">
        <span className="inline-block size-2 rounded-full" style={{ background: color }} /> {label}
      </div>
      <div className="font-display mt-1 text-[22px] leading-none font-extrabold">
        <AnimatedNumber value={value} from={0} />
        <span className="text-[13px] font-bold text-ink-3">g</span>
      </div>
    </div>
  )
}
