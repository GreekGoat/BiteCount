import { BookmarkPlus, CopyPlus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { dayKey, MEALS, type Meal } from '../lib/date'
import { hapticSuccess } from '../lib/haptics'
import { useStore, type LogEntry } from '../lib/store'
import { fmt } from '../lib/units'
import { Segmented, Stepper } from '../ui/Controls'
import { Row, Section } from '../ui/List'
import { Sheet, SheetHeader } from '../ui/Sheet'
import { useToast } from '../ui/Toast'

/** Adjust, move, copy or delete one logged item. */
export function EntrySheet({ entry, onClose }: { entry: LogEntry | null; onClose: () => void }) {
  const updateEntry = useStore((s) => s.updateEntry)
  const removeEntry = useStore((s) => s.removeEntry)
  const restoreEntry = useStore((s) => s.restoreEntry)
  const addEntries = useStore((s) => s.addEntries)
  const removeEntries = useStore((s) => s.removeEntries)
  const saveFood = useStore((s) => s.saveFood)
  const toast = useToast()

  const [scale, setScale] = useState(1)
  const [meal, setMeal] = useState<Meal>('lunch')
  // Keep the last entry while the sheet slides away, so it does not go blank mid-exit.
  const [shown, setShown] = useState<LogEntry | null>(entry)

  useEffect(() => {
    if (entry) {
      setShown(entry)
      setScale(1)
      setMeal(entry.meal)
    }
  }, [entry])

  const current = entry ?? shown
  const scaled = current
    ? {
        kcal: Math.round(current.kcal * scale),
        p: Math.round(current.p * scale * 10) / 10,
        c: Math.round(current.c * scale * 10) / 10,
        f: Math.round(current.f * scale * 10) / 10,
      }
    : { kcal: 0, p: 0, c: 0, f: 0 }

  const apply = () => {
    if (!current) return
    updateEntry(current.id, { ...scaled, meal, portion: scale === 1 ? current.portion : `${current.portion} × ${scale}` })
    hapticSuccess()
    onClose()
  }

  return (
    <Sheet open={!!entry} onClose={onClose} size="auto" label={current?.name}>
      {current && (
        <>
          <SheetHeader title="" onClose={onClose} onDone={apply} doneLabel="Save changes" />
          <div className="overflow-y-auto px-4 pb-[max(20px,calc(var(--sab)-6px))]">
            <div className="flex flex-col items-center pb-5 text-center">
              <span className="grid size-16 place-items-center rounded-[18px] bg-fill text-[34px]" aria-hidden>
                {current.emoji}
              </span>
              <h2 className="mt-3 text-[22px] leading-tight font-bold">{current.name}</h2>
              <p className="mt-0.5 text-[15px] text-ink-3">{current.portion}</p>
              <p className="tabular mt-3 text-[15px] text-ink-2">
                <span className="font-rounded text-[28px] font-bold text-ink">{fmt(scaled.kcal)}</span> kcal · {scaled.p} g protein · {scaled.c} g carbs ·{' '}
                {scaled.f} g fat
              </p>
            </div>

            <Section>
              <Row
                title="Amount"
                accessory={<Stepper value={scale} onChange={setScale} step={0.25} min={0.25} max={6} format={(v) => `×${v}`} label="portion" />}
              />
            </Section>

            <Segmented className="mt-4" label="Meal" options={MEALS.map((m) => ({ id: m.id, label: m.label }))} value={meal} onChange={setMeal} />

            <Section className="mt-4" inset={52}>
              <Row
                icon={<CopyPlus size={20} className="text-tint" />}
                title="Log again today"
                action
                onTap={() => {
                  const { id: _id, createdAt: _createdAt, ...rest } = current
                  const added = addEntries([{ ...rest, ...scaled, date: dayKey(), meal }])
                  hapticSuccess()
                  toast('Logged again for today', 'success', { label: 'Undo', onAction: () => removeEntries(added.map((e) => e.id)) })
                  onClose()
                }}
              />
              <Row
                icon={<BookmarkPlus size={20} className="text-tint" />}
                title="Save to My Foods"
                action
                onTap={() => {
                  saveFood({ name: current.name, emoji: current.emoji, portion: current.portion, macros: { kcal: current.kcal, p: current.p, c: current.c, f: current.f } })
                  hapticSuccess()
                  toast('Saved to My Foods', 'success')
                }}
              />
              <Row
                icon={<Trash2 size={20} className="text-danger" />}
                title="Delete"
                destructive
                onTap={() => {
                  removeEntry(current.id)
                  hapticSuccess()
                  toast(`${current.name} deleted`, 'default', { label: 'Undo', onAction: () => restoreEntry(current) })
                  onClose()
                }}
              />
            </Section>
          </div>
        </>
      )}
    </Sheet>
  )
}
