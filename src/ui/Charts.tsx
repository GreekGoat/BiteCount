import { motion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fromKey, type DayKey } from '../lib/date'
import { fmt } from '../lib/units'

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

const shortDay = (key: DayKey) => fromKey(key).toLocaleDateString(undefined, { weekday: 'short' })
const shortDate = (key: DayKey) => fromKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

interface CalorieChartProps {
  data: { date: DayKey; kcal: number }[]
  budget: number
}

/** Calories per day against the budget line. */
export function CalorieChart({ data, budget }: CalorieChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const height = 180
  const padTop = 16
  const padBottom = 26
  const plot = height - padTop - padBottom

  const peak = Math.max(budget * 1.2, ...data.map((d) => d.kcal), 1)
  const y = (value: number) => padTop + plot * (1 - value / peak)
  const band = width / Math.max(1, data.length)
  const barWidth = Math.max(6, Math.min(24, band - (data.length > 14 ? 3 : 8)))
  const budgetY = y(budget)
  const ticks = [0, peak / 2, peak]

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={`Calories per day compared with a budget of ${fmt(budget)} kcal`}>
          {ticks.map((tick) => (
            <line key={tick} x1={0} x2={width} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeWidth={1} />
          ))}

          {data.map((d, i) => {
            const over = d.kcal > budget
            const barHeight = d.kcal > 0 ? Math.max(3, plot * (d.kcal / peak)) : 0
            const x = i * band + (band - barWidth) / 2
            const isActive = active === i
            return (
              <g key={d.date} onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive((a) => (a === i ? null : a))}>
                <rect x={i * band} y={0} width={band} height={height} fill="transparent" onPointerDown={() => setActive(i)} />
                <motion.rect
                  x={x}
                  width={barWidth}
                  rx={4}
                  initial={{ height: 0, y: padTop + plot }}
                  animate={{ height: barHeight, y: padTop + plot - barHeight }}
                  transition={{ type: 'spring', stiffness: 150, damping: 20, delay: Math.min(i * 0.02, 0.3) }}
                  fill={over ? 'var(--warn)' : 'var(--b2)'}
                  opacity={active == null || isActive ? 1 : 0.45}
                />
              </g>
            )
          })}

          {/* Budget reference */}
          <line x1={0} x2={width} y1={budgetY} y2={budgetY} stroke="var(--ink-3)" strokeWidth={1} />
          <text x={0} y={budgetY - 5} fill="var(--ink-3)" fontSize={10.5} className="tabular">
            Budget {fmt(budget)}
          </text>

          {data.length <= 8 &&
            data.map((d, i) => (
              <text key={d.date} x={i * band + band / 2} y={height - 8} textAnchor="middle" fontSize={10.5} fill="var(--ink-3)">
                {shortDay(d.date)[0]}
              </text>
            ))}
        </svg>
      )}
      <div className="mt-1 min-h-[22px] text-center text-[12.5px] text-ink-2">
        {active != null && data[active] ? (
          <span>
            <span className="font-semibold text-ink">{fmt(data[active].kcal)} kcal</span>
            {` · ${shortDate(data[active].date)} · `}
            {data[active].kcal > budget ? `${fmt(data[active].kcal - budget)} over` : `${fmt(budget - data[active].kcal)} left`}
          </span>
        ) : (
          <span className="text-ink-3">Tap a bar for that day</span>
        )}
      </div>
    </div>
  )
}

interface WeightChartProps {
  data: { date: DayKey; kg: number }[]
  unitLabel: string
  convert: (kg: number) => number
  goal?: number
}

/** Weight over time. */
export function WeightChart({ data, unitLabel, convert, goal }: WeightChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const height = 170
  const padTop = 18
  const padBottom = 24
  const padX = 10
  const plot = height - padTop - padBottom
  const inner = Math.max(1, width - padX * 2)

  const values = data.map((d) => convert(d.kg))
  const withGoal = goal != null ? [...values, goal] : values
  const min = Math.min(...withGoal)
  const max = Math.max(...withGoal)
  const span = Math.max(1, max - min)
  const lo = min - span * 0.2
  const hi = max + span * 0.2

  const x = (i: number) => padX + (data.length === 1 ? inner / 2 : (inner * i) / (data.length - 1))
  const y = (value: number) => padTop + plot * (1 - (value - lo) / (hi - lo))
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${path} L${x(values.length - 1).toFixed(1)},${padTop + plot} L${x(0).toFixed(1)},${padTop + plot} Z`
  const last = values.length - 1

  useEffect(() => setActive(null), [data.length])

  return (
    <div ref={ref} className="w-full">
      {width > 0 && values.length > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Weight over time"
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const rel = e.clientX - rect.left - padX
            const i = Math.round((rel / inner) * (data.length - 1))
            setActive(Math.max(0, Math.min(data.length - 1, i)))
          }}
          onPointerLeave={() => setActive(null)}
        >
          {goal != null && (
            <>
              <line x1={0} x2={width} y1={y(goal)} y2={y(goal)} stroke="var(--good)" strokeWidth={1} />
              <text x={width} y={y(goal) - 5} textAnchor="end" fontSize={10.5} fill="var(--good)">
                Goal {goal.toFixed(1)}
              </text>
            </>
          )}
          <path d={area} fill="var(--b2)" opacity={0.1} />
          <motion.path
            d={path}
            fill="none"
            stroke="var(--b2)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
          {active != null && (
            <>
              <line x1={x(active)} x2={x(active)} y1={padTop} y2={padTop + plot} stroke="var(--line-strong)" strokeWidth={1} />
              <circle cx={x(active)} cy={y(values[active])} r={5} fill="var(--b2)" stroke="var(--bg)" strokeWidth={2} />
            </>
          )}
          <circle cx={x(last)} cy={y(values[last])} r={5} fill="var(--b2)" stroke="var(--bg)" strokeWidth={2} />
          <text x={x(last)} y={y(values[last]) - 12} textAnchor="end" fontSize={11.5} fill="var(--ink)" fontWeight={600} className="tabular">
            {values[last].toFixed(1)}
          </text>
        </svg>
      )}
      <div className="mt-1 min-h-[22px] text-center text-[12.5px] text-ink-2">
        {active != null && data[active] ? (
          <span>
            <span className="tabular font-semibold text-ink">
              {values[active].toFixed(1)} {unitLabel}
            </span>
            {` · ${shortDate(data[active].date)}`}
          </span>
        ) : (
          <span className="text-ink-3">{data.length > 1 ? 'Drag across the line to read a day' : 'Log your weight again to see a trend'}</span>
        )}
      </div>
    </div>
  )
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="max-h-64 overflow-auto rounded-2xl border border-line">
      <table className="w-full text-left text-[13px]">
        <thead className="sticky top-0 bg-card-solid">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold text-ink-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-line">
              {row.map((cell, j) => (
                <td key={j} className={`px-3 py-2 ${j > 0 ? 'tabular text-ink-2' : 'text-ink'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
