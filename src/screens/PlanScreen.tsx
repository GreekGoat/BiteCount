import { motion } from 'motion/react'
import { RotateCcw, Scale, Target, TrendingDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { hapticSuccess } from '../lib/haptics'
import { bmi, bmiLabel, PLAN_DEFAULTS, projectGoal } from '../lib/plan'
import { usePlan, useStore } from '../lib/store'
import { fmt, formatWeight, kgToLb, lbToKg } from '../lib/units'
import { Chip, SectionTitle } from '../ui/Controls'
import { Ruler } from '../ui/Ruler'
import { Sheet } from '../ui/Sheet'
import { AnimatedNumber, Press, Reveal } from '../ui/motion'
import { useToast } from '../ui/Toast'

export function PlanScreen() {
  const profile = useStore((s) => s.profile)
  const planSettings = useStore((s) => s.plan)
  const updatePlan = useStore((s) => s.updatePlan)
  const logWeight = useStore((s) => s.logWeight)
  const plan = usePlan()
  const toast = useToast()

  const [weighIn, setWeighIn] = useState(false)
  const [draftWeight, setDraftWeight] = useState(profile.weightKg)

  const imperial = profile.units === 'imperial'
  const projection = useMemo(() => projectGoal(profile.weightKg, profile.goalKg, plan.deficitKcal), [profile, plan.deficitKcal])
  const bodyMass = bmi(profile.weightKg, profile.heightCm)

  const isDefault = planSettings.deficitPct === PLAN_DEFAULTS.deficitPct && planSettings.proteinPerKg === PLAN_DEFAULTS.proteinPerKg && planSettings.fatPerKg === PLAN_DEFAULTS.fatPerKg

  return (
    <div className="space-y-4">
      <header className="pt-1">
        <h1 className="font-display text-[27px] leading-tight font-extrabold tracking-tight">Your plan</h1>
        <p className="mt-1 text-[14px] text-ink-2">Worked out from your weight, the way you asked for it.</p>
      </header>

      {/* Weight */}
      <Reveal>
        <div className="card flex items-center gap-4 p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-line">
            <Scale size={19} className="text-ink-2" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-semibold tracking-wide text-ink-3 uppercase">Current weight</div>
            <div className="font-display text-[22px] leading-tight font-extrabold">{formatWeight(profile.weightKg, profile.units)}</div>
            <div className="text-[12px] text-ink-3">
              BMI {bodyMass.toFixed(1)} · {bmiLabel(bodyMass)}
            </div>
          </div>
          <Press
            onTap={() => {
              setDraftWeight(profile.weightKg)
              setWeighIn(true)
            }}
            className="rounded-full border border-line px-4 py-2 text-[13.5px] font-semibold"
          >
            Update
          </Press>
        </div>
      </Reveal>

      {/* Step 1 */}
      <Reveal delay={0.04}>
        <StepCard
          step={1}
          title="Maintenance calories"
          icon={<Target size={16} />}
          value={plan.maintenance}
          unit="kcal a day"
          lines={[
            { label: 'Body weight', value: `${profile.weightKg.toFixed(1)} kg` },
            { label: '× 2.2', value: `${plan.weightLb} lb` },
            { label: '× 15', value: `${fmt(plan.maintenance)} kcal` },
          ]}
        />
      </Reveal>

      {/* Step 2 */}
      <Reveal delay={0.08}>
        <div className="card p-5">
          <StepHeading step={2} title="Create a deficit" icon={<TrendingDown size={16} />} />
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="tabular text-[14px] text-ink-2">
              {fmt(plan.maintenance)} − {fmt(plan.deficitKcal)}
            </div>
            <div className="text-right">
              <AnimatedNumber value={plan.budget} className="grad-text font-display text-[34px] leading-none font-extrabold" />
              <div className="text-[11.5px] text-ink-3">kcal budget</div>
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={25}
            step={1}
            value={planSettings.deficitPct}
            onChange={(e) => updatePlan({ deficitPct: Number(e.target.value) })}
            className="mt-4 w-full accent-[var(--b2)]"
            aria-label="Deficit percentage"
          />
          <div className="flex items-center justify-between text-[12px] text-ink-3">
            <span>Maintain</span>
            <span className="font-semibold text-ink">{planSettings.deficitPct}% deficit</span>
            <span>25%</span>
          </div>
          {planSettings.deficitPct === 0 && <p className="mt-2 text-[12.5px] text-ink-3">At 0% you are eating at maintenance — steady weight.</p>}
          {planSettings.deficitPct > 20 && <p className="mt-2 text-[12.5px] text-warn">Above 20% gets hard to hold and costs you muscle. 10% is the recommendation.</p>}
        </div>
      </Reveal>

      {/* Step 3 */}
      <Reveal delay={0.12}>
        <div className="card p-5">
          <StepHeading step={3} title="Set macros" icon={<Scale size={16} />} />

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <MacroTile label="Protein" grams={plan.protein} kcal={plan.proteinKcal} color="var(--protein)" />
            <MacroTile label="Carbs" grams={plan.carbs} kcal={plan.carbs * 4} color="var(--carbs)" />
            <MacroTile label="Fat" grams={plan.fat} kcal={plan.fatKcal} color="var(--fat)" />
          </div>

          <div className="mt-4 space-y-3">
            <SliderRow
              label="Protein"
              value={planSettings.proteinPerKg}
              onChange={(v) => updatePlan({ proteinPerKg: v })}
              min={1}
              max={3}
              step={0.1}
              suffix="g per kg"
              note={`${profile.weightKg.toFixed(1)} × ${planSettings.proteinPerKg.toFixed(1)} = ${plan.protein} g`}
            />
            <SliderRow
              label="Fat"
              value={planSettings.fatPerKg}
              onChange={(v) => updatePlan({ fatPerKg: v })}
              min={0.4}
              max={1.5}
              step={0.05}
              suffix="g per kg"
              note={`${profile.weightKg.toFixed(1)} × ${planSettings.fatPerKg.toFixed(2)} = ${plan.fat} g`}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-line p-3.5">
            <div className="text-[12.5px] font-semibold tracking-wide text-ink-3 uppercase">Carbs fill what is left</div>
            <div className="tabular mt-1 text-[14px] text-ink-2">
              {fmt(plan.budget)} − {fmt(plan.proteinKcal)} − {fmt(plan.fatKcal)} = {fmt(plan.carbsKcal)} kcal ÷ 4 ={' '}
              <span className="font-bold text-ink">{plan.carbs} g</span>
            </div>
          </div>

          {!isDefault && (
            <Chip
              className="mt-3"
              onClick={() => {
                updatePlan({ ...PLAN_DEFAULTS })
                hapticSuccess()
                toast('Back to the standard formula', 'success')
              }}
            >
              <RotateCcw size={12} className="mr-1 inline" /> Reset to the formula
            </Chip>
          )}
        </div>
      </Reveal>

      {projection && (
        <Reveal delay={0.16}>
          <div className="card p-5">
            <SectionTitle>Where this lands</SectionTitle>
            <p className="text-[14px] leading-relaxed text-ink-2">
              A {fmt(plan.deficitKcal)} kcal daily deficit is about{' '}
              <span className="font-semibold text-ink">{projection.kgPerWeek.toFixed(2)} kg</span> a week. At that pace you reach{' '}
              {formatWeight(profile.goalKg!, profile.units)} in roughly <span className="font-semibold text-ink">{projection.weeks} weeks</span>, around{' '}
              {projection.date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.
            </p>
            <p className="mt-2 text-[12.5px] text-ink-3">An estimate — as your weight drops, maintenance drops with it, so the last few kilos take longer.</p>
          </div>
        </Reveal>
      )}

      <Sheet open={weighIn} onClose={() => setWeighIn(false)} height="auto" label="Log your weight">
        <div className="px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <h2 className="font-display py-2 text-[21px] font-bold tracking-tight">Today's weight</h2>
          {imperial ? (
            <Ruler value={kgToLb(draftWeight)} onChange={(lb) => setDraftWeight(lbToKg(lb))} min={66} max={441} step={1} majorEvery={10} unit="lb" format={(lb) => lb.toFixed(0)} />
          ) : (
            <Ruler value={draftWeight} onChange={setDraftWeight} min={30} max={200} step={0.1} majorEvery={50} unit="kg" format={(kg) => kg.toFixed(1)} />
          )}
          <Press
            onTap={() => {
              logWeight(Math.round(draftWeight * 10) / 10)
              hapticSuccess()
              setWeighIn(false)
              toast('Weight logged — your plan has been updated', 'success')
            }}
            className="grad mt-6 w-full rounded-2xl py-3.5 text-[16px] font-bold text-white shadow-lg"
          >
            Save weight
          </Press>
        </div>
      </Sheet>
    </div>
  )
}

function StepHeading({ step, title, icon }: { step: number; title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grad grid size-7 place-items-center rounded-lg text-[12px] font-extrabold text-white">{step}</span>
      <h2 className="font-display flex-1 text-[18px] font-bold tracking-tight">{title}</h2>
      <span className="text-ink-3">{icon}</span>
    </div>
  )
}

function StepCard({
  step,
  title,
  icon,
  value,
  unit,
  lines,
}: {
  step: number
  title: string
  icon: React.ReactNode
  value: number
  unit: string
  lines: { label: string; value: string }[]
}) {
  return (
    <div className="card p-5">
      <StepHeading step={step} title={title} icon={icon} />
      <div className="mt-3 flex items-end justify-between gap-4">
        <ul className="min-w-0 flex-1 space-y-1">
          {lines.map((line) => (
            <li key={line.label} className="flex justify-between gap-2 text-[13.5px]">
              <span className="text-ink-3">{line.label}</span>
              <span className="tabular font-semibold text-ink-2">{line.value}</span>
            </li>
          ))}
        </ul>
        <div className="shrink-0 text-right">
          <AnimatedNumber value={value} className="font-display text-[34px] leading-none font-extrabold" />
          <div className="text-[11.5px] text-ink-3">{unit}</div>
        </div>
      </div>
    </div>
  )
}

function MacroTile({ label, grams, kcal, color }: { label: string; grams: number; kcal: number; color: string }) {
  return (
    <div className="rounded-2xl border border-line p-3">
      <div className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-ink-2">
        <span className="inline-block size-2 rounded-full" style={{ background: color }} /> {label}
      </div>
      <div className="font-display mt-1 text-[23px] leading-none font-extrabold">
        <AnimatedNumber value={grams} />
        <span className="text-[13px] font-bold text-ink-3">g</span>
      </div>
      <div className="tabular mt-0.5 text-[11px] text-ink-3">{fmt(kcal)} kcal</div>
    </div>
  )
}

function SliderRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  note,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  suffix: string
  note: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13.5px]">
        <span className="font-semibold text-ink-2">{label}</span>
        <span className="tabular text-ink-3">
          <span className="font-bold text-ink">{value.toFixed(2).replace(/0$/, '')}</span> {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--b2)]"
        aria-label={`${label} per kilogram`}
      />
      <motion.div layout className="tabular text-[11.5px] text-ink-3">
        {note}
      </motion.div>
    </div>
  )
}
