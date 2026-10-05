import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
import { hapticSuccess } from '../lib/haptics'
import { bmi, bmiLabel, computePlan, PLAN_DEFAULTS, projectGoal, type PlanSettings } from '../lib/plan'
import { DEFAULT_PROFILE, useStore, type Profile, type Sex } from '../lib/store'
import { fmt, kgToLb, lbToKg, type Units } from '../lib/units'
import { Confetti } from '../ui/Confetti'
import { Button, OptionCard, Segmented, Slider, TextInput } from '../ui/Controls'
import { AnimatedNumber, spring } from '../ui/motion'
import { GlassButton } from '../ui/Nav'
import { Ruler } from '../ui/Ruler'

const SEXES: { id: Sex; label: string }[] = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'unspecified', label: 'Rather not say' },
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
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-5" style={{ paddingTop: 'var(--sat)' }}>
      {/* Nav */}
      <div className="flex h-[52px] items-center gap-3">
        <div className="w-11">
          {step > 0 && (
            <GlassButton onTap={() => go(step - 1)} label="Back">
              <ChevronLeft size={22} strokeWidth={2.4} />
            </GlassButton>
          )}
        </div>
        <div className="flex flex-1 justify-center">
          <div className="h-[5px] w-28 overflow-hidden rounded-full bg-fill" role="progressbar" aria-valuemin={1} aria-valuemax={steps} aria-valuenow={step + 1} aria-label="Setup progress">
            <motion.div className="h-full rounded-full bg-tint" animate={{ width: `${((step + 1) / steps) * 100}%` }} transition={spring} />
          </div>
        </div>
        <div className="w-11" />
      </div>

      <div className="relative flex-1 pt-6">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: direction * 36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -36 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === 0 && (
              <Step title="What should I call you?" subtitle="It only ever shows on your own phone.">
                <TextInput
                  autoFocus
                  value={profile.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && canContinue && go(1)}
                  enterKeyHint="next"
                  placeholder="Your name"
                  aria-label="Your name"
                  maxLength={24}
                  className="min-h-[56px] text-center text-[20px] font-semibold"
                />
              </Step>
            )}

            {step === 1 && (
              <Step title="A little about you" subtitle="Used for your BMI and to keep the numbers sensible.">
                <div className="space-y-2">
                  {SEXES.map((sex) => (
                    <OptionCard key={sex.id} label={sex.label} selected={profile.sex === sex.id} onSelect={() => patch({ sex: sex.id })} />
                  ))}
                </div>
                <div className="mt-8">
                  <p className="mb-3 text-center text-[15px] font-semibold text-ink-3">Age</p>
                  <Ruler value={profile.age} onChange={(v) => patch({ age: Math.round(v) })} min={14} max={90} step={1} majorEvery={5} unit="years" />
                </div>
              </Step>
            )}

            {step === 2 && (
              <Step title="How tall are you?" subtitle="Switch units any time.">
                <Segmented
                  className="mx-auto mb-8 max-w-[16rem]"
                  label="Units"
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
                  <Ruler value={kgToLb(profile.weightKg)} onChange={(lb) => patch({ weightKg: lbToKg(lb) })} min={66} max={441} step={1} majorEvery={10} unit="lb" format={(lb) => lb.toFixed(0)} />
                ) : (
                  <Ruler value={profile.weightKg} onChange={(kg) => patch({ weightKg: kg })} min={30} max={200} step={0.5} majorEvery={10} unit="kg" format={(kg) => kg.toFixed(1)} />
                )}
                <p className="mt-6 text-center text-[15px] text-ink-2">
                  BMI <span className="tabular font-semibold text-ink">{bmi(profile.weightKg, profile.heightCm).toFixed(1)}</span> · {bmiLabel(bmi(profile.weightKg, profile.heightCm))}
                </p>
              </Step>
            )}

            {step === 4 && (
              <Step title="Where do you want to get to?" subtitle="Optional. It adds a finish line to your progress.">
                <Segmented
                  className="mx-auto mb-8 max-w-[18rem]"
                  label="Target"
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
                    <Ruler value={profile.goalKg ?? profile.weightKg} onChange={(kg) => patch({ goalKg: kg })} min={30} max={200} step={0.5} majorEvery={10} unit="kg" format={(kg) => kg.toFixed(1)} />
                  ))}
              </Step>
            )}

            {step === 5 && <PlanStep profile={profile} plan={plan} setPlan={setPlan} hasGoal={hasGoal} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="sticky bottom-0 -mx-5 bg-gradient-to-t from-bg via-bg to-transparent px-5 pt-6" style={{ paddingBottom: 'max(20px, var(--sab))' }}>
        {step < steps - 1 ? (
          <Button onTap={() => canContinue && go(step + 1)} disabled={!canContinue} className="w-full">
            Continue
          </Button>
        ) : (
          <Button onTap={finish} className="w-full">
            Start logging
          </Button>
        )}
      </div>
    </div>
  )
}

function Step({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-center text-[34px] leading-[41px] font-bold">{title}</h1>
      {subtitle && <p className="mx-auto mt-2 max-w-[22rem] text-center text-[17px] leading-snug text-ink-2">{subtitle}</p>}
      <div className="mt-9">{children}</div>
    </div>
  )
}

function PlanStep({ profile, plan, setPlan, hasGoal }: { profile: Profile; plan: PlanSettings; setPlan: (p: PlanSettings) => void; hasGoal: boolean }) {
  const result = useMemo(() => computePlan(profile.weightKg, plan), [profile.weightKg, plan])
  const projection = hasGoal ? projectGoal(profile.weightKg, profile.goalKg, result.deficitKcal) : null
  const first = profile.name.trim().split(' ')[0]

  return (
    <div>
      <Confetti />
      <h1 className="text-center text-[34px] leading-[41px] font-bold">{first ? `Here is your plan, ${first}` : 'Here is your plan'}</h1>

      <section className="surface mt-7 p-5">
        <p className="text-[15px] font-semibold text-ink-3">Daily budget</p>
        <div className="flex items-baseline gap-1.5">
          <AnimatedNumber value={result.budget} from={0} className="font-rounded tabular text-[48px] leading-tight font-bold" />
          <span className="text-[20px] font-semibold text-ink-3">kcal</span>
        </div>
        <p className="tabular text-[15px] text-ink-3">
          {profile.weightKg.toFixed(1)} kg × 2.2 × 15 = {fmt(result.maintenance)}, less {plan.deficitPct}%
        </p>

        <div className="mt-4">
          <Slider value={plan.deficitPct} onChange={(deficitPct) => setPlan({ ...plan, deficitPct })} min={0} max={25} step={1} label="Deficit percentage" />
          <div className="flex justify-between text-[13px] text-ink-3">
            <span>Maintain</span>
            <span className={plan.deficitPct === 10 ? 'font-semibold text-tint' : ''}>10% recommended</span>
            <span>25%</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <Macro label="Protein" value={result.protein} color="var(--protein)" />
          <Macro label="Carbs" value={result.carbs} color="var(--carbs)" />
          <Macro label="Fat" value={result.fat} color="var(--fat)" />
        </div>
      </section>

      {projection && (
        <p className="mt-4 text-center text-[15px] leading-snug text-ink-2">
          At this pace you reach your target in about <span className="font-semibold text-ink">{projection.weeks} weeks</span>, around{' '}
          {projection.date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.
        </p>
      )}
      <p className="mt-3 text-center text-[13px] text-ink-3">You can change any of this later on the Plan tab.</p>
    </div>
  )
}

function Macro({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-[16px] bg-surface-2 px-3 py-2.5">
      <div className="text-[13px] font-semibold" style={{ color }}>
        {label}
      </div>
      <div className="font-rounded tabular text-[24px] leading-tight font-bold">
        <AnimatedNumber value={value} from={0} />
        <span className="text-[15px] font-semibold text-ink-3"> g</span>
      </div>
    </div>
  )
}
