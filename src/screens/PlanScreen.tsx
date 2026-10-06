import { RotateCcw, Scale } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNav } from '../App'
import { hapticSuccess } from '../lib/haptics'
import { bmi, bmiLabel, PLAN_DEFAULTS, projectGoal } from '../lib/plan'
import { usePlan, useStore } from '../lib/store'
import { fmt, formatWeight, kgToLb, lbToKg } from '../lib/units'
import { Button, Slider } from '../ui/Controls'
import { IconTile, Row, Section } from '../ui/List'
import { AnimatedNumber } from '../ui/motion'
import { AvatarButton, LargeTitle, NavBar, ThemeButton } from '../ui/Nav'
import { Ruler } from '../ui/Ruler'
import { Sheet, SheetHeader } from '../ui/Sheet'
import { useToast } from '../ui/Toast'

export function PlanScreen() {
  const { openYou } = useNav()
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
  const isDefault =
    planSettings.deficitPct === PLAN_DEFAULTS.deficitPct && planSettings.proteinPerKg === PLAN_DEFAULTS.proteinPerKg && planSettings.fatPerKg === PLAN_DEFAULTS.fatPerKg

  return (
    <>
      <NavBar
        title="Plan"
        trailing={
          <>
            <ThemeButton />
            <AvatarButton onTap={openYou} />
          </>
        }
      />
      <LargeTitle>Plan</LargeTitle>

      {/* The answer first */}
      <section className="surface p-5">
        <p className="text-[15px] font-semibold text-ink-3">Daily budget</p>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <AnimatedNumber value={plan.budget} className="font-rounded tabular text-[52px] leading-none font-bold" />
          <span className="text-[20px] font-semibold text-ink-3">kcal</span>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <MacroTile label="Protein" grams={plan.protein} kcal={plan.proteinKcal} color="var(--protein)" />
          <MacroTile label="Carbs" grams={plan.carbs} kcal={plan.carbs * 4} color="var(--carbs)" />
          <MacroTile label="Fat" grams={plan.fat} kcal={plan.fatKcal} color="var(--fat)" />
        </div>
      </section>

      <Section className="mt-6" inset={58}>
        <Row
          icon={
            <IconTile color="#0a84ff">
              <Scale size={17} strokeWidth={2.3} />
            </IconTile>
          }
          title={formatWeight(profile.weightKg, profile.units)}
          subtitle={`BMI ${bodyMass.toFixed(1)} · ${bmiLabel(bodyMass)}`}
          accessory={
            <Button
              kind="gray"
              size="small"
              onTap={() => {
                setDraftWeight(profile.weightKg)
                setWeighIn(true)
              }}
            >
              Log weight
            </Button>
          }
        />
      </Section>

      <Section className="mt-6" header={<h2 className="mb-2 px-1 text-[22px] leading-tight font-bold">How it is worked out</h2>} footer="Your formula: weight in kg × 2.2 × 15 for maintenance, less the deficit you choose.">
        <Row title="Body weight" detail={<span className="tabular">{profile.weightKg.toFixed(1)} kg</span>} />
        <Row title="× 2.2" detail={<span className="tabular">{plan.weightLb} lb</span>} />
        <Row title="× 15, maintenance" detail={<span className="tabular">{fmt(plan.maintenance)} kcal</span>} />
        <Row title={`− ${planSettings.deficitPct}% deficit`} detail={<span className="tabular">−{fmt(plan.deficitKcal)} kcal</span>} />
        <Row title={<span className="font-semibold">Daily budget</span>} detail={<span className="tabular font-semibold text-ink">{fmt(plan.budget)} kcal</span>} />
      </Section>

      <Section
        className="mt-6"
        header="Deficit"
        footer={
          planSettings.deficitPct === 0
            ? 'At 0% you eat at maintenance and hold your weight.'
            : planSettings.deficitPct > 20
              ? 'Above 20% gets hard to hold and costs muscle. 10% is the recommendation.'
              : `${fmt(plan.deficitKcal)} kcal a day under maintenance.`
        }
      >
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[17px]">Deficit</span>
            <span className="tabular text-[17px] text-ink-2">{planSettings.deficitPct}%</span>
          </div>
          <Slider value={planSettings.deficitPct} onChange={(deficitPct) => updatePlan({ deficitPct })} min={0} max={25} step={1} label="Deficit percentage" />
          <div className="flex justify-between text-[13px] text-ink-3">
            <span>Maintain</span>
            <span>25%</span>
          </div>
        </div>
      </Section>

      <Section className="mt-6" header="Macros" footer={`Carbs fill what is left: ${fmt(plan.budget)} − ${fmt(plan.proteinKcal)} − ${fmt(plan.fatKcal)} = ${fmt(plan.carbsKcal)} kcal ÷ 4 = ${plan.carbs} g.`}>
        <SliderRow
          label="Protein"
          color="var(--protein)"
          value={planSettings.proteinPerKg}
          onChange={(proteinPerKg) => updatePlan({ proteinPerKg })}
          min={1}
          max={3}
          step={0.1}
          note={`${plan.protein} g a day`}
        />
        <SliderRow
          label="Fat"
          color="var(--fat)"
          value={planSettings.fatPerKg}
          onChange={(fatPerKg) => updatePlan({ fatPerKg })}
          min={0.4}
          max={1.5}
          step={0.05}
          note={`${plan.fat} g a day`}
        />
        {!isDefault && (
          <Row
            icon={<RotateCcw size={19} className="text-tint" />}
            title="Back to the standard formula"
            action
            onTap={() => {
              updatePlan({ ...PLAN_DEFAULTS })
              hapticSuccess()
              toast('Back to the standard formula', 'success')
            }}
          />
        )}
      </Section>

      {projection && (
        <section className="surface mt-6 p-5">
          <h2 className="text-[22px] leading-tight font-bold">Where this lands</h2>
          <p className="mt-2 text-[17px] leading-snug text-ink-2">
            About <span className="font-semibold text-ink">{projection.kgPerWeek.toFixed(2)} kg</span> a week. You reach{' '}
            {formatWeight(profile.goalKg!, profile.units)} in roughly <span className="font-semibold text-ink">{projection.weeks} weeks</span>, around{' '}
            {projection.date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.
          </p>
          <p className="mt-2 text-[13px] leading-snug text-ink-3">An estimate. As your weight drops, maintenance drops with it, so the last few kilos take longer.</p>
        </section>
      )}

      <Sheet open={weighIn} onClose={() => setWeighIn(false)} size="auto" label="Log your weight">
        <SheetHeader
          title="Today's weight"
          onClose={() => setWeighIn(false)}
          doneLabel="Save weight"
          onDone={() => {
            logWeight(Math.round(draftWeight * 10) / 10)
            hapticSuccess()
            setWeighIn(false)
            toast('Weight logged. Your plan is updated.', 'success')
          }}
        />
        <div className="px-4 pt-3 pb-[max(24px,calc(var(--sab)-4px))]">
          {imperial ? (
            <Ruler value={kgToLb(draftWeight)} onChange={(lb) => setDraftWeight(lbToKg(lb))} min={66} max={441} step={1} majorEvery={10} unit="lb" format={(lb) => lb.toFixed(0)} />
          ) : (
            <Ruler value={draftWeight} onChange={setDraftWeight} min={30} max={200} step={0.1} majorEvery={50} unit="kg" format={(kg) => kg.toFixed(1)} />
          )}
        </div>
      </Sheet>
    </>
  )
}

function MacroTile({ label, grams, kcal, color }: { label: string; grams: number; kcal: number; color: string }) {
  return (
    <div className="min-w-0 rounded-[16px] bg-surface-2 px-2 py-2.5">
      <div className="truncate text-[13px] font-semibold" style={{ color }}>
        {label}
      </div>
      <div className="font-rounded tabular mt-0.5 text-[clamp(19px,6vw,24px)] leading-tight font-bold whitespace-nowrap">
        <AnimatedNumber value={grams} />
        <span className="text-[15px] font-semibold text-ink-3"> g</span>
      </div>
      <div className="tabular text-[12px] whitespace-nowrap text-ink-3">{fmt(kcal)} kcal</div>
    </div>
  )
}

function SliderRow({
  label,
  color,
  value,
  onChange,
  min,
  max,
  step,
  note,
}: {
  label: string
  color: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  note: string
}) {
  return (
    <div className="px-4 pt-3 pb-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 text-[17px]">
          <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />
          {label}
        </span>
        <span className="tabular text-[15px] text-ink-3">
          <span className="text-[17px] text-ink-2">{value.toFixed(2).replace(/0$/, '')} g/kg</span> · {note}
        </span>
      </div>
      <Slider value={value} onChange={onChange} min={min} max={max} step={step} label={`${label} grams per kilogram`} />
    </div>
  )
}
