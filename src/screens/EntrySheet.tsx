import { BookmarkPlus, CopyPlus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { dayKey, MEALS, type Meal } from '../lib/date'
import { hapticSuccess } from '../lib/haptics'
import { useStore, type LogEntry } from '../lib/store'
import { fmt } from '../lib/units'
import { Segmented, Stepper } from '../ui/Controls'
import { Sheet } from '../ui/Sheet'
import { Press } from '../ui/motion'
import { useToast } from '../ui/Toast'

/** Adjust, move, copy or delete one logged item. */
export function EntrySheet({ entry, onClose }: { entry: LogEntry | null; onClose: () => void }) {
  const updateEntry = useStore((s) => s.updateEntry)
  const removeEntry = useStore((s) => s.removeEntry)
  const restoreEntry = useStore((s) => s.restoreEntry)
  const addEntries = useStore((s) => s.addEntries)
  const saveFood = useStore((s) => s.saveFood)
  const toast = useToast()

  const [scale, setScale] = useState(1)
  const [meal, setMeal] = useState<Meal>('lunch')

  useEffect(() => {
    if (entry) {
      setScale(1)
      setMeal(entry.meal)
    }
  }, [entry])

  if (!entry) {
    return (
      <Sheet open={false} onClose={onClose}>
        <span />
      </Sheet>
    )
  }

  const scaled = {
    kcal: Math.round(entry.kcal * scale),
    p: Math.round(entry.p * scale * 10) / 10,
    c: Math.round(entry.c * scale * 10) / 10,
    f: Math.round(entry.f * scale * 10) / 10,
  }

  const apply = () => {
    updateEntry(entry.id, { ...scaled, meal, portion: scale === 1 ? entry.portion : `${entry.portion} × ${scale}` })
    hapticSuccess()
    onClose()
  }

  return (
    <Sheet open onClose={onClose} height="auto" label={entry.name}>
      <div className="overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3 py-3">
          <span className="grid size-12 place-items-center rounded-2xl border border-line text-[23px]">{entry.emoji}</span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display truncate text-[20px] font-bold tracking-tight">{entry.name}</h2>
            <p className="truncate text-[13px] text-ink-3">{entry.portion}</p>
          </div>
        </div>

        <div className="card flex items-center justify-between p-4">
          <div>
            <div className="text-[12.5px] font-semibold tracking-wide text-ink-3 uppercase">Amount</div>
            <div className="tabular text-[13px] text-ink-2">
              {fmt(scaled.kcal)} kcal · {scaled.p}P {scaled.c}C {scaled.f}F
            </div>
          </div>
          <Stepper value={scale} onChange={setScale} step={0.25} min={0.25} max={6} format={(v) => `×${v}`} label="portion" />
        </div>

        <div className="mt-4">
          <div className="mb-2 text-[12.5px] font-semibold tracking-wide text-ink-3 uppercase">Meal</div>
          <Segmented options={MEALS.map((m) => ({ id: m.id, label: m.label }))} value={meal} onChange={setMeal} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Press
            onTap={() => {
              const { id: _id, createdAt: _createdAt, ...rest } = entry
              addEntries([{ ...rest, ...scaled, date: dayKey(), meal }])
              hapticSuccess()
              toast('Logged again for today', 'success')
              onClose()
            }}
            className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-card p-3 text-[12px] font-semibold text-ink-2"
          >
            <CopyPlus size={17} /> Log again
          </Press>
          <Press
            onTap={() => {
              saveFood({ name: entry.name, emoji: entry.emoji, portion: entry.portion, macros: { kcal: entry.kcal, p: entry.p, c: entry.c, f: entry.f } })
              hapticSuccess()
              toast('Saved to My foods', 'success')
            }}
            className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-card p-3 text-[12px] font-semibold text-ink-2"
          >
            <BookmarkPlus size={17} /> Save food
          </Press>
          <Press
            onTap={() => {
              removeEntry(entry.id)
              hapticSuccess()
              toast(`${entry.name} removed`, 'default', { label: 'Undo', onAction: () => restoreEntry(entry) })
              onClose()
            }}
            className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-card p-3 text-[12px] font-semibold text-danger"
          >
            <Trash2 size={17} /> Delete
          </Press>
        </div>

        <Press onTap={apply} className="grad mt-4 w-full rounded-2xl py-3.5 text-[16px] font-bold text-white shadow-lg">
          Save changes
        </Press>
      </div>
    </Sheet>
  )
}
