import { Flame, Table2, TrendingDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { dayKey, fromKey, lastNDays, type DayKey } from '../lib/date'
import { usePlan, streakOf, sumEntries, useStore } from '../lib/store'
import { fmt, kgToLb } from '../lib/units'
import { CalorieChart, DataTable, WeightChart } from '../ui/Charts'
import { Segmented, SectionTitle } from '../ui/Controls'
import { AnimatedNumber, Reveal } from '../ui/motion'

type Range = '7' | '30' | '90'

export function Progress() {
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

  const best = logged.length ? logged.reduce((a, b) => (Math.abs(b.kcal - plan.budget) < Math.abs(a.kcal - plan.budget) ? b : a)) : { date: dayKey(), kcal: 0 }

  const summary = useMemo(() => {
    if (!logged.length) return ''
    const gap = average - plan.budget
    const perWeek = (-gap * 7) / 7700
    const share = Math.round((onTarget / logged.length) * 100)
    if (gap <= 0) {
      return `You averaged ${fmt(average)} kcal across ${logged.length} logged ${logged.length === 1 ? 'day' : 'days'} — ${fmt(-gap)} under budget, and on target ${share}% of the time. Held steady, that is about ${perWeek.toFixed(2)} kg a week.`
    }
    return `You averaged ${fmt(average)} kcal, which is ${fmt(gap)} over the ${fmt(plan.budget)} budget on a typical day. You were on target ${share}% of the time — one or two lighter days would flip the average.`
  }, [logged.length, average, plan.budget, onTarget])

  return (
    <div className="space-y-4">
      <header className="pt-1">
        <h1 className="font-display text-[27px] leading-tight font-extrabold tracking-tight">Progress</h1>
        <p className="mt-1 text-[14px] text-ink-2">How the last {days} days have gone.</p>
      </header>

      <Segmented
        options={[
          { id: '7' as Range, label: '7 days' },
          { id: '30' as Range, label: '30 days' },
          { id: '90' as Range, label: '90 days' },
        ]}
        value={range}
        onChange={setRange}
      />

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Daily average" value={average} unit="kcal" />
        <Stat label="On target" value={onTarget} unit={`of ${logged.length} days`} />
        <Stat label="Streak" value={streak} unit={streak === 1 ? 'day' : 'days'} icon={<Flame size={13} className="text-brand-1" />} />
      </div>

      {logged.length > 0 && (
        <Reveal>
          <section className="card p-5">
            <SectionTitle>How it is going</SectionTitle>
            <p className="text-[14px] leading-relaxed text-ink-2">{summary}</p>
            {logged.length >= 3 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MiniStat label="Best day" value={`${fmt(best.kcal)} kcal`} detail={fromKey(best.date).toLocaleDateString(undefined, { weekday: 'long' })} />
                <MiniStat
                  label="Average vs budget"
                  value={`${average > plan.budget ? '+' : '−'}${fmt(Math.abs(average - plan.budget))}`}
                  detail={average > plan.budget ? 'over each day' : 'under each day'}
                />
              </div>
            )}
          </section>
        </Reveal>
      )}

      <Reveal>
        <section className="card p-4">
          <SectionTitle
            action={
              <button onClick={() => setShowTable((v) => !v)} className="-mr-2 flex items-center gap-1 rounded-full px-2 py-1.5 text-[12.5px] font-semibold text-ink-3">
                <Table2 size={13} /> {showTable ? 'Chart' : 'Table'}
              </button>
            }
          >
            Calories a day
          </SectionTitle>
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
      </Reveal>

      <Reveal delay={0.05}>
        <section className="card p-4">
          <SectionTitle>Weight</SectionTitle>
          {weights.length ? (
            <>
              <WeightChart
                data={weightSeries}
                unitLabel={imperial ? 'lb' : 'kg'}
                convert={(kg) => (imperial ? kgToLb(kg) : kg)}
                goal={profile.goalKg ? (imperial ? kgToLb(profile.goalKg) : profile.goalKg) : undefined}
              />
              {weightSeries.length > 1 && (
                <p className="mt-1 flex items-center justify-center gap-1.5 text-[13px] text-ink-2">
                  <TrendingDown size={14} className={weightChange <= 0 ? 'text-good' : 'text-warn'} />
                  {weightChange <= 0 ? 'Down' : 'Up'}{' '}
                  <span className="tabular font-semibold text-ink">
                    {Math.abs(imperial ? kgToLb(weightChange) : weightChange).toFixed(1)} {imperial ? 'lb' : 'kg'}
                  </span>{' '}
                  over this period
                </p>
              )}
            </>
          ) : (
            <p className="py-6 text-center text-[13.5px] text-ink-3">Log your weight on the Plan tab to see a trend here.</p>
          )}
        </section>
      </Reveal>

      <Reveal delay={0.1}>
        <section className="card p-4">
          <SectionTitle>Average macros a day</SectionTitle>
          <div className="grid grid-cols-3 gap-2 text-center">
            <MacroAvg label="Protein" value={macroAvg.p} target={plan.protein} color="var(--protein)" />
            <MacroAvg label="Carbs" value={macroAvg.c} target={plan.carbs} color="var(--carbs)" />
            <MacroAvg label="Fat" value={macroAvg.f} target={plan.fat} color="var(--fat)" />
          </div>
        </section>
      </Reveal>

      <p className="pb-2 text-center text-[12px] text-ink-3">Since {fromKey(lastNDays(days)[0]).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} · today is {fromKey(dayKey()).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</p>
    </div>
  )
}

function MiniStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-line p-3">
      <div className="text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">{label}</div>
      <div className="tabular font-display mt-0.5 text-[17px] leading-tight font-extrabold">{value}</div>
      <div className="truncate text-[11.5px] text-ink-3">{detail}</div>
    </div>
  )
}

function Stat({ label, value, unit, icon }: { label: string; value: number; unit: string; icon?: React.ReactNode }) {
  return (
    <div className="card p-3.5">
      <div className="flex items-center gap-1 text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">
        {icon}
        {label}
      </div>
      <div className="font-display mt-1 text-[24px] leading-none font-extrabold">
        <AnimatedNumber value={value} from={0} />
      </div>
      <div className="text-[11px] text-ink-3">{unit}</div>
    </div>
  )
}

function MacroAvg({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.round((value / target) * 100) : 0
  return (
    <div className="rounded-2xl border border-line p-3">
      <div className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-ink-2">
        <span className="inline-block size-2 rounded-full" style={{ background: color }} /> {label}
      </div>
      <div className="font-display mt-1 text-[21px] leading-none font-extrabold">
        {Math.round(value)}
        <span className="text-[12px] font-bold text-ink-3">g</span>
      </div>
      <div className="tabular mt-0.5 text-[11px] text-ink-3">{pct}% of target</div>
    </div>
  )
}
