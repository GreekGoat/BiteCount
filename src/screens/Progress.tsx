import { Flame, Table2, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNav } from '../App'
import { dayKey, fromKey, lastNDays, type DayKey } from '../lib/date'
import { streakOf, sumEntries, usePlan, useStore } from '../lib/store'
import { fmt, kgToLb } from '../lib/units'
import { CalorieChart, DataTable, WeightChart } from '../ui/Charts'
import { Segmented } from '../ui/Controls'
import { AnimatedNumber } from '../ui/motion'
import { AvatarButton, LargeTitle, NavBar, ThemeButton } from '../ui/Nav'

type Range = '7' | '30' | '90'

export function Progress() {
  const { openYou } = useNav()
  const entries = useStore((s) => s.entries)
  const weights = useStore((s) => s.weights)
  const profile = useStore((s) => s.profile)
  const plan = usePlan()
  const [range, setRange] = useState<Range>('7')
  const [showTable, setShowTable] = useState(false)

  const days = Number(range)
  const imperial = profile.units === 'imperial'

  const daily = useMemo(() => {
    const keys = lastNDays(days)
    const totals = new Map<DayKey, number>()
    for (const e of entries) totals.set(e.date, (totals.get(e.date) ?? 0) + e.kcal)
    return keys.map((date) => ({ date, kcal: Math.round(totals.get(date) ?? 0) }))
  }, [entries, days])

  const logged = daily.filter((d) => d.kcal > 0)
  const average = logged.length ? Math.round(logged.reduce((sum, d) => sum + d.kcal, 0) / logged.length) : 0
  const onTarget = logged.filter((d) => d.kcal <= plan.budget).length
  const streak = streakOf(entries)

  const macroAvg = useMemo(() => {
    const keys = new Set(lastNDays(days))
    const inRange = entries.filter((e) => keys.has(e.date))
    const dayCount = new Set(inRange.map((e) => e.date)).size || 1
    const total = sumEntries(inRange)
    return { p: total.p / dayCount, c: total.c / dayCount, f: total.f / dayCount }
  }, [entries, days])

  const weightSeries = useMemo(() => {
    const cutoff = lastNDays(days)[0]
    const inRange = weights.filter((w) => w.date >= cutoff)
    return inRange.length >= 1 ? inRange : weights.slice(-2)
  }, [weights, days])

  const weightChange = weightSeries.length > 1 ? weightSeries[weightSeries.length - 1].kg - weightSeries[0].kg : 0

  const summary = useMemo(() => {
    if (!logged.length) return ''
    const gap = average - plan.budget
    const perWeek = (-gap * 7) / 7700
    const share = Math.round((onTarget / logged.length) * 100)
    if (gap <= 0) {
      return `You averaged ${fmt(average)} kcal over ${logged.length} logged ${logged.length === 1 ? 'day' : 'days'}, ${fmt(-gap)} under budget, and stayed on target ${share}% of the time. Held steady, that is about ${perWeek.toFixed(2)} kg a week.`
    }
    return `You averaged ${fmt(average)} kcal, ${fmt(gap)} over the ${fmt(plan.budget)} budget on a typical day. You were on target ${share}% of the time; one or two lighter days would flip the average.`
  }, [logged.length, average, plan.budget, onTarget])

  return (
    <>
      <NavBar
        title="Progress"
        trailing={
          <>
            <ThemeButton />
            <AvatarButton onTap={openYou} />
          </>
        }
      />
      <LargeTitle>Progress</LargeTitle>

      <Segmented
        label="Time range"
        options={[
          { id: '7' as Range, label: 'Week' },
          { id: '30' as Range, label: 'Month' },
          { id: '90' as Range, label: '3 months' },
        ]}
        value={range}
        onChange={setRange}
      />

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <Stat label="Average" value={average} unit="kcal a day" />
        <Stat label="On target" value={onTarget} unit={`of ${logged.length} days`} />
        <Stat label="Streak" value={streak} unit={streak === 1 ? 'day' : 'days'} icon={<Flame size={14} className="text-[#ff9500]" fill="#ff9500" />} />
      </div>

      {logged.length > 0 && (
        <section className="surface mt-4 p-5">
          <h2 className="text-[20px] leading-tight font-bold">How it is going</h2>
          <p className="mt-2 text-[17px] leading-snug text-ink-2">{summary}</p>
        </section>
      )}

      <section className="surface mt-4 p-4 pb-3">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <h2 className="text-[20px] leading-tight font-bold">Calories</h2>
          <button onClick={() => setShowTable((v) => !v)} className="-mr-1 flex min-h-[36px] items-center gap-1.5 rounded-full bg-fill px-3 text-[15px] font-semibold text-tint">
            <Table2 size={15} /> {showTable ? 'Chart' : 'Table'}
          </button>
        </div>
        {showTable ? (
          <DataTable
            head={['Day', 'kcal', 'vs budget']}
            rows={daily
              .slice()
              .reverse()
              .map((d) => [
                fromKey(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                d.kcal ? fmt(d.kcal) : '—',
                d.kcal ? (d.kcal > plan.budget ? `+${fmt(d.kcal - plan.budget)}` : `−${fmt(plan.budget - d.kcal)}`) : '—',
              ])}
          />
        ) : (
          <CalorieChart data={daily} budget={plan.budget} />
        )}
      </section>

      <section className="surface mt-4 p-4 pb-3">
        <h2 className="mb-2 px-1 text-[20px] leading-tight font-bold">Weight</h2>
        {weights.length ? (
          <>
            <WeightChart
              data={weightSeries}
              unitLabel={imperial ? 'lb' : 'kg'}
              convert={(kg) => (imperial ? kgToLb(kg) : kg)}
              goal={profile.goalKg ? (imperial ? kgToLb(profile.goalKg) : profile.goalKg) : undefined}
            />
            {weightSeries.length > 1 && (
              <p className="mt-1 flex items-center justify-center gap-1.5 text-[15px] text-ink-2">
                {weightChange <= 0 ? <TrendingDown size={16} className="text-good" /> : <TrendingUp size={16} className="text-warn" />}
                {weightChange <= 0 ? 'Down' : 'Up'}{' '}
                <span className="tabular font-semibold text-ink">
                  {Math.abs(imperial ? kgToLb(weightChange) : weightChange).toFixed(1)} {imperial ? 'lb' : 'kg'}
                </span>{' '}
                in this period
              </p>
            )}
          </>
        ) : (
          <p className="py-6 text-center text-[15px] text-ink-3">Log your weight on the Plan tab to see a trend here.</p>
        )}
      </section>

      <section className="surface mt-4 p-4">
        <h2 className="mb-3 px-1 text-[20px] leading-tight font-bold">Average macros a day</h2>
        <div className="grid grid-cols-3 gap-2.5">
          <MacroAvg label="Protein" value={macroAvg.p} target={plan.protein} color="var(--protein)" />
          <MacroAvg label="Carbs" value={macroAvg.c} target={plan.carbs} color="var(--carbs)" />
          <MacroAvg label="Fat" value={macroAvg.f} target={plan.fat} color="var(--fat)" />
        </div>
      </section>

      <p className="mt-4 pb-2 text-center text-[13px] text-ink-3">
        {fromKey(lastNDays(days)[0]).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} to{' '}
        {fromKey(dayKey()).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
      </p>
    </>
  )
}

function Stat({ label, value, unit, icon }: { label: string; value: number; unit: string; icon?: React.ReactNode }) {
  return (
    <div className="surface rounded-[20px] px-3.5 py-3">
      <div className="flex items-center gap-1 text-[13px] font-semibold text-ink-3">
        {icon}
        {label}
      </div>
      <div className="font-rounded tabular mt-0.5 text-[26px] leading-tight font-bold">
        <AnimatedNumber value={value} from={0} />
      </div>
      <div className="truncate text-[13px] text-ink-3">{unit}</div>
    </div>
  )
}

function MacroAvg({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.round((value / target) * 100) : 0
  return (
    <div className="min-w-0 rounded-[16px] bg-surface-2 px-2.5 py-2.5">
      <div className="truncate text-[13px] font-semibold" style={{ color }}>
        {label}
      </div>
      <div className="font-rounded tabular text-[clamp(18px,5.6vw,22px)] leading-tight font-bold whitespace-nowrap">
        {Math.round(value)}
        <span className="text-[15px] font-semibold text-ink-3"> g</span>
      </div>
      <div className="tabular text-[13px] leading-tight text-ink-3">{pct}% of target</div>
    </div>
  )
}
