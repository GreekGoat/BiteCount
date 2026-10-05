import {
  CircleAlert,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Hand,
  Loader2,
  Palette,
  Share,
  Sparkles,
  Trash2,
  Upload,
  Wind,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { PROVIDERS, providerInfo, type AiProvider } from '../food/ai-models'
import { hapticSuccess } from '../lib/haptics'
import { useAiSettings, useStore, type Sex } from '../lib/store'
import { formatHeight, formatWeight, type Units } from '../lib/units'
import { Segmented, Slider, Stepper, Toggle } from '../ui/Controls'
import { IconTile, Row, Section } from '../ui/List'
import { Avatar } from '../ui/Nav'
import { Sheet, SheetHeader } from '../ui/Sheet'
import { useToast } from '../ui/Toast'

/** Profile and settings, laid out like the iOS Settings app. */
export function YouSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} label="You">
      <SheetHeader title="You" onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(var(--sab)+28px)]">
        <YouContent />
      </div>
    </Sheet>
  )
}

function YouContent() {
  const profile = useStore((s) => s.profile)
  const settings = useStore((s) => s.settings)
  const saved = useStore((s) => s.saved)
  const entries = useStore((s) => s.entries)
  const updateProfile = useStore((s) => s.updateProfile)
  const updateSettings = useStore((s) => s.updateSettings)
  const removeSaved = useStore((s) => s.removeSaved)
  const resetAll = useStore((s) => s.resetAll)
  const importState = useStore((s) => s.importState)
  const updateProvider = useStore((s) => s.updateProvider)
  const inUse = useAiSettings()
  const toast = useToast()

  const [showKey, setShowKey] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [keyError, setKeyError] = useState<{ message: string; hint?: string } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const info = providerInfo(settings.aiProvider)
  const active = settings.ai[settings.aiProvider] ?? { key: '', model: info.defaultModel }
  const models = active.models?.length ? active.models : info.fallbackModels
  const imperial = profile.units === 'imperial'

  const exportData = () => {
    const state = useStore.getState()
    const data = JSON.stringify(
      {
        onboarded: state.onboarded,
        profile: state.profile,
        plan: state.plan,
        entries: state.entries,
        weights: state.weights,
        water: state.water,
        saved: state.saved,
        // Keys stay on the phone; a backup file should never carry them.
        settings: {
          ...state.settings,
          ai: Object.fromEntries(Object.entries(state.settings.ai).map(([id, p]) => [id, { ...p, key: '' }])),
        },
      },
      null,
      2,
    )
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `bitecount-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast('Backup downloaded', 'success')
  }

  const verify = async () => {
    setVerifying(true)
    setKeyError(null)
    try {
      const { verifyKey } = await import('../food/ai')
      const found = await verifyKey(settings.aiProvider, active.key)
      const model = found.some((m) => m.id === active.model) ? active.model : (found[0]?.id ?? info.defaultModel)
      updateProvider(settings.aiProvider, { models: found, model })
      hapticSuccess()
      toast(found.length ? `Key works. ${found.length} models available.` : 'Key works', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not check that key'
      const hint = error && typeof error === 'object' && 'hint' in error ? (error as { hint?: string }).hint : undefined
      setKeyError({ message, hint })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="space-y-7 pt-2">
      {/* Who */}
      <div className="flex flex-col items-center text-center">
        <Avatar name={profile.name} size={84} />
        <h2 className="mt-3 text-[24px] leading-tight font-bold">{profile.name.trim() || 'You'}</h2>
        <p className="tabular mt-0.5 text-[15px] text-ink-3">
          {formatWeight(profile.weightKg, profile.units)} · {formatHeight(profile.heightCm, profile.units)} · {entries.length} items logged
        </p>
      </div>

      <Section header="Your details">
        <Row
          title="Name"
          accessory={
            <input
              value={profile.name}
              onChange={(e) => updateProfile({ name: e.target.value })}
              placeholder="Your name"
              maxLength={24}
              aria-label="Name"
              className="min-h-[44px] min-w-0 flex-1 self-stretch bg-transparent text-right text-[17px] text-ink-2 outline-none"
            />
          }
        />
        <Row title="Age" accessory={<Stepper value={profile.age} onChange={(age) => updateProfile({ age })} min={14} max={100} label="age" />} />
        <Row
          title="Sex"
          accessory={
            <select className="ios-select min-h-[44px] text-[17px]" value={profile.sex} onChange={(e) => updateProfile({ sex: e.target.value as Sex })} aria-label="Sex">
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="unspecified">Not set</option>
            </select>
          }
        />
        <Row
          title="Height"
          accessory={
            <Stepper
              value={profile.heightCm}
              onChange={(heightCm) => updateProfile({ heightCm })}
              step={imperial ? 2.54 : 1}
              min={120}
              max={215}
              format={(cm) => formatHeight(cm, profile.units)}
              label="height"
            />
          }
        />
        <Row
          title="Goal weight"
          accessory={
            <Stepper
              value={profile.goalKg ?? profile.weightKg}
              onChange={(goalKg) => updateProfile({ goalKg })}
              step={0.5}
              min={30}
              max={200}
              format={(kg) => formatWeight(kg, profile.units)}
              label="goal weight"
            />
          }
        />
        <Row
          title="Units"
          accessory={
            <select className="ios-select min-h-[44px] text-[17px]" value={profile.units} onChange={(e) => updateProfile({ units: e.target.value as Units })} aria-label="Units">
              <option value="metric">kg, cm</option>
              <option value="imperial">lb, ft</option>
            </select>
          }
        />
      </Section>
      <p className="-mt-5 px-4 text-[13px] leading-snug text-ink-3">Log your weight on the Plan tab. Your plan updates from it.</p>

      {/* AI */}
      <div className="space-y-2">
        <Section
          header="AI and the coach"
          inset={58}
          footer={
            inUse.ready && inUse.provider !== settings.aiProvider
              ? `${info.short} has no key yet, so the coach is using your ${providerInfo(inUse.provider).short} key.`
              : 'Used by the coach, and for dishes the offline food list does not know.'
          }
        >
          <Row
            icon={
              <IconTile color="var(--tint-fill)">
                <Sparkles size={17} strokeWidth={2.3} />
              </IconTile>
            }
            title="Use AI"
            accessory={<Toggle checked={settings.aiEnabled} onChange={(aiEnabled) => updateSettings({ aiEnabled })} label="Use AI" />}
          />
          {settings.aiEnabled && (
            <>
              <Row
                title="Provider"
                className="pl-[58px]"
                accessory={
                  <select
                    className="ios-select min-h-[44px] text-[17px]"
                    value={settings.aiProvider}
                    onChange={(e) => {
                      setKeyError(null)
                      updateSettings({ aiProvider: e.target.value as AiProvider })
                    }}
                    aria-label="AI provider"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.short}
                      </option>
                    ))}
                  </select>
                }
              />
              <div className="flex min-h-[52px] items-center gap-2 pr-2 pl-[58px]">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={active.key}
                  onChange={(e) => updateProvider(settings.aiProvider, { key: e.target.value.trim() })}
                  placeholder={`${info.short} API key`}
                  aria-label={`${info.label} API key`}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="min-h-[44px] min-w-0 flex-1 bg-transparent font-mono text-[15px] outline-none"
                />
                <button onClick={() => setShowKey((v) => !v)} aria-label={showKey ? 'Hide key' : 'Show key'} className="grid size-11 place-items-center rounded-full text-ink-3">
                  {showKey ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
              <Row
                title={
                  <span className="flex items-center gap-2">
                    {verifying && <Loader2 size={17} className="animate-spin" />}
                    Check key and load models
                  </span>
                }
                action
                className="pl-[58px]"
                disabled={!active.key.trim() || verifying}
                onTap={verify}
              />
            </>
          )}
        </Section>

        {keyError && (
          <div className="flex gap-2.5 rounded-[18px] bg-surface px-4 py-3">
            <CircleAlert size={19} className="mt-0.5 shrink-0 text-danger" />
            <div>
              <p className="text-[15px] font-semibold text-danger">{keyError.message}</p>
              {keyError.hint && <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{keyError.hint}</p>}
            </div>
          </div>
        )}

        {settings.aiEnabled && (
          <p className="px-4 text-[13px] leading-snug text-ink-3">
            Keys stay on this phone.{' '}
            <a href={info.keyUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-semibold text-tint">
              Get a key at {info.keyUrlLabel} <ExternalLink size={12} />
            </a>
            {!info.vision && ` ${info.short} reads text only; photos need Gemini or Claude.`}
          </p>
        )}
      </div>

      {settings.aiEnabled && (
        <Section header="Model" footer={!active.models?.length ? 'Check your key to see exactly which models it can use.' : undefined}>
          {models.map((model) => (
            <Row
              key={model.id}
              title={model.label}
              subtitle={model.id}
              accessory={active.model === model.id ? 'check' : 'none'}
              onTap={() => updateProvider(settings.aiProvider, { model: model.id })}
            />
          ))}
        </Section>
      )}

      {settings.aiEnabled && info.proxyable && (
        <Section header="Server proxy (optional)" footer="Deploy server/groq-proxy and paste its address. The key then lives on the server instead of this phone.">
          <div className="flex min-h-[52px] items-center px-4">
            <input
              type="url"
              inputMode="url"
              value={active.proxyUrl ?? ''}
              onChange={(e) => updateProvider(settings.aiProvider, { proxyUrl: e.target.value.trim() })}
              placeholder="https://your-worker.workers.dev"
              aria-label="Proxy address"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="min-h-[44px] min-w-0 flex-1 bg-transparent font-mono text-[15px] outline-none"
            />
          </div>
        </Section>
      )}

      {/* Appearance */}
      <Section header="Appearance" inset={58}>
        <div className="space-y-3 px-4 py-3.5">
          <Segmented
            label="Theme"
            options={[
              { id: 'system' as const, label: 'Automatic' },
              { id: 'light' as const, label: 'Light' },
              { id: 'dark' as const, label: 'Dark' },
            ]}
            value={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
          />
        </div>
        <Row
          icon={
            <IconTile color="#5856d6">
              <Palette size={17} strokeWidth={2.3} />
            </IconTile>
          }
          title="Glass"
          accessory={
            <Segmented
              label="Glass"
              className="w-[160px]"
              options={[
                { id: 'clear' as const, label: 'Clear' },
                { id: 'tinted' as const, label: 'Tinted' },
              ]}
              value={settings.glass ?? 'clear'}
              onChange={(glass) => updateSettings({ glass })}
            />
          }
        />
        <Row
          icon={
            <IconTile color="#ff9500">
              <Hand size={17} strokeWidth={2.3} />
            </IconTile>
          }
          title="Haptics"
          accessory={<Toggle checked={settings.haptics} onChange={(haptics) => updateSettings({ haptics })} label="Haptics" />}
        />
        <Row
          icon={
            <IconTile color="#8e8e93">
              <Wind size={17} strokeWidth={2.3} />
            </IconTile>
          }
          title="Reduce motion"
          accessory={<Toggle checked={settings.reduceMotion} onChange={(reduceMotion) => updateSettings({ reduceMotion })} label="Reduce motion" />}
        />
      </Section>

      <Section header="Daily water goal">
        <div className="flex items-center gap-4 px-4 py-3">
          <Slider value={settings.waterGoal} onChange={(waterGoal) => updateSettings({ waterGoal })} min={1000} max={5000} step={250} label="Daily water goal" />
          <span className="tabular w-16 shrink-0 text-right text-[17px] text-ink-2">{(settings.waterGoal / 1000).toFixed(2)} L</span>
        </div>
      </Section>

      {saved.length > 0 && (
        <Section header="My foods" inset={60}>
          {saved.slice(0, 20).map((food) => (
            <Row
              key={food.id}
              icon={
                <span className="grid size-[32px] place-items-center rounded-[9px] bg-fill text-[18px]" aria-hidden>
                  {food.emoji}
                </span>
              }
              title={<span className="block truncate">{food.name}</span>}
              subtitle={`${food.portion} · ${Math.round(food.macros.kcal)} kcal`}
              accessory={
                <button onClick={() => removeSaved(food.id)} aria-label={`Remove ${food.name}`} className="-mr-2 grid size-11 place-items-center rounded-full text-ink-3">
                  <Trash2 size={18} />
                </button>
              }
            />
          ))}
        </Section>
      )}

      <Section header="Your data" inset={52} footer="Everything lives in this browser on this phone. No account, no server. Back it up before clearing browser data or changing phones.">
        <Row icon={<Download size={20} className="text-tint" />} title="Export a backup" action onTap={exportData} />
        <Row icon={<Upload size={20} className="text-tint" />} title="Restore a backup" action onTap={() => fileRef.current?.click()} />
        {!confirmReset ? (
          <Row icon={<Trash2 size={20} className="text-danger" />} title="Delete everything" destructive onTap={() => setConfirmReset(true)} />
        ) : (
          <div className="px-4 py-3.5">
            <p className="text-[15px] leading-snug text-ink-2">This deletes your profile, your log and your saved foods on this phone. It cannot be undone.</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setConfirmReset(false)} className="min-h-[44px] flex-1 rounded-full bg-fill text-[16px] font-semibold">
                Keep my data
              </button>
              <button
                onClick={() => {
                  resetAll()
                  toast('Everything deleted')
                }}
                className="min-h-[44px] flex-1 rounded-full bg-danger text-[16px] font-semibold text-white"
              >
                Delete it all
              </button>
            </div>
          </div>
        )}
      </Section>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          try {
            importState(JSON.parse(await file.text()))
            hapticSuccess()
            toast('Backup restored', 'success')
          } catch {
            toast('That file could not be read', 'error')
          }
        }}
      />

      <div className="space-y-2 px-4 pb-2 text-[13px] leading-snug text-ink-3">
        <p className="flex items-start gap-2">
          <Share size={15} className="mt-px shrink-0" />
          <span>
            In Safari, tap Share, then Add to Home Screen. BiteCount then opens full screen and works with no signal.
          </span>
        </p>
        <p>Calorie figures are estimates from standard food tables. Use them for steering, not for medical decisions.</p>
      </div>
    </div>
  )
}
