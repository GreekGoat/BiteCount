import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Check, Download, ExternalLink, Eye, EyeOff, Info, Loader2, Share, Sparkles, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { PROVIDERS, providerInfo } from '../food/ai-models'
import { hapticSuccess } from '../lib/haptics'
import { useStore, type Sex } from '../lib/store'
import { formatHeight, formatWeight, type Units } from '../lib/units'
import { Field, OptionCard, SectionTitle, Segmented, TextInput, Toggle } from '../ui/Controls'
import { Press, Reveal, spring } from '../ui/motion'
import { useToast } from '../ui/Toast'

export function Profile() {
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
  const toast = useToast()

  const [showKey, setShowKey] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [keyError, setKeyError] = useState<{ message: string; hint?: string } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const info = providerInfo(settings.aiProvider)
  const active = settings.ai[settings.aiProvider] ?? { key: '', model: info.defaultModel }
  const models = active.models?.length ? active.models : info.fallbackModels

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
      toast(found.length ? `Key works — ${found.length} models available` : 'Key works', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not check that key'
      const hint = error && typeof error === 'object' && 'hint' in error ? (error as { hint?: string }).hint : undefined
      setKeyError({ message, hint })
      toast(message, 'error')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="space-y-4">
      <header className="pt-1">
        <h1 className="font-display text-[27px] leading-tight font-extrabold tracking-tight">You</h1>
        <p className="mt-1 text-[14px] text-ink-2">{entries.length} items logged so far.</p>
      </header>

      {/* Profile */}
      <Reveal>
        <section className="card space-y-4 p-5">
          <SectionTitle>Your details</SectionTitle>
          <Field label="Name">
            <TextInput value={profile.name} onChange={(e) => updateProfile({ name: e.target.value })} placeholder="Your name" maxLength={24} />
          </Field>

          <Field label="Units">
            <Segmented
              options={[
                { id: 'metric' as Units, label: 'kg · cm' },
                { id: 'imperial' as Units, label: 'lb · ft' },
              ]}
              value={profile.units}
              onChange={(units) => updateProfile({ units })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Height">
              <div className="rounded-2xl border border-line bg-card px-4 py-3 text-[15px] font-semibold">{formatHeight(profile.heightCm, profile.units)}</div>
            </Field>
            <Field label="Weight">
              <div className="rounded-2xl border border-line bg-card px-4 py-3 text-[15px] font-semibold">{formatWeight(profile.weightKg, profile.units)}</div>
            </Field>
          </div>
          <p className="-mt-1 text-[12px] text-ink-3">Weight and height are updated from the Plan tab, so your numbers stay in step.</p>

          <Field label="Age">
            <input
              type="number"
              min={14}
              max={100}
              value={profile.age}
              onChange={(e) => updateProfile({ age: Math.max(14, Math.min(100, Number(e.target.value) || 0)) })}
              className="w-full rounded-2xl border border-line bg-card px-4 py-3 focus:border-brand focus:outline-none"
            />
          </Field>

          <Field label="Sex">
            <Segmented
              options={[
                { id: 'male' as Sex, label: 'Male' },
                { id: 'female' as Sex, label: 'Female' },
                { id: 'unspecified' as Sex, label: 'Skip' },
              ]}
              value={profile.sex}
              onChange={(sex) => updateProfile({ sex })}
            />
          </Field>
        </section>
      </Reveal>

      {/* AI */}
      <Reveal delay={0.04}>
        <section className="card space-y-4 p-5">
          <div className="flex items-start gap-3">
            <span className="grad grid size-9 shrink-0 place-items-center rounded-2xl text-white">
              <Sparkles size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[19px] font-bold tracking-tight">AI estimation</h2>
              <p className="text-[13px] text-ink-2">For dishes the offline database does not know, and for meal photos.</p>
            </div>
            <Toggle checked={settings.aiEnabled} onChange={(aiEnabled) => updateSettings({ aiEnabled })} label="Use AI estimation" />
          </div>

          <AnimatePresence initial={false}>
            {settings.aiEnabled && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring} className="space-y-4 overflow-hidden">
                <Field label="Provider">
                  <Segmented
                    options={PROVIDERS.map((p) => ({ id: p.id, label: p.short }))}
                    value={settings.aiProvider}
                    onChange={(aiProvider) => updateSettings({ aiProvider })}
                  />
                </Field>

                <Field label={`${info.label} API key`} hint={info.keyHint}>
                  <div className="relative">
                    <TextInput
                      type={showKey ? 'text' : 'password'}
                      value={active.key}
                      onChange={(e) => updateProvider(settings.aiProvider, { key: e.target.value.trim() })}
                      placeholder={info.keyPlaceholder}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="pr-12 font-mono text-[13px]"
                    />
                    <button
                      onClick={() => setShowKey((v) => !v)}
                      aria-label={showKey ? 'Hide key' : 'Show key'}
                      className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-xl text-ink-3"
                    >
                      {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </Field>

                <a
                  href={info.keyUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 py-1.5 text-[13px] font-semibold text-brand"
                >
                  Get a key at {info.keyUrlLabel} <ExternalLink size={13} />
                </a>

                <Press
                  onTap={verify}
                  disabled={!active.key.trim() || verifying}
                  className="w-full rounded-2xl border border-line bg-card py-3 text-[15px] font-semibold disabled:opacity-40"
                >
                  <span className="flex items-center justify-center gap-2">
                    {verifying ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />} Check key and load models
                  </span>
                </Press>

                {keyError && (
                  <div className="rounded-2xl border border-danger/40 bg-danger/5 p-3.5">
                    <p className="flex items-start gap-2 text-[13.5px] font-semibold text-danger">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      {keyError.message}
                    </p>
                    {keyError.hint && <p className="mt-1.5 pl-6 text-[12.5px] leading-relaxed text-ink-2">{keyError.hint}</p>}
                  </div>
                )}

                {info.proxyable && (
                  <Field
                    label="Server proxy (optional)"
                    hint="Deploy server/groq-proxy and paste its URL here. The key then lives on the server and the phone never holds one."
                  >
                    <TextInput
                      type="url"
                      inputMode="url"
                      value={active.proxyUrl ?? ''}
                      onChange={(e) => updateProvider(settings.aiProvider, { proxyUrl: e.target.value.trim() })}
                      placeholder="https://your-worker.workers.dev"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="font-mono text-[13px]"
                    />
                  </Field>
                )}

                {!info.vision && (
                  <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-3">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    {info.short} handles typed descriptions only. Meal photos need Gemini or Claude.
                  </p>
                )}

                <Field label="Model">
                  <div className="space-y-2">
                    {models.map((model) => (
                      <OptionCard
                        key={model.id}
                        label={model.label}
                        hint={model.id}
                        selected={active.model === model.id}
                        onSelect={() => updateProvider(settings.aiProvider, { model: model.id })}
                      />
                    ))}
                  </div>
                  {!active.models?.length && (
                    <p className="mt-1.5 text-[12px] text-ink-3">Check your key to see exactly which models it can use.</p>
                  )}
                </Field>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </Reveal>

      {/* Preferences */}
      <Reveal delay={0.08}>
        <section className="card space-y-4 p-5">
          <SectionTitle>Preferences</SectionTitle>
          <Field label="Theme">
            <Segmented
              options={[
                { id: 'system' as const, label: 'System' },
                { id: 'dark' as const, label: 'Dark' },
                { id: 'light' as const, label: 'Light' },
              ]}
              value={settings.theme}
              onChange={(theme) => updateSettings({ theme })}
            />
          </Field>
          <Row label="Haptic feedback" hint="A tap you can feel on supported phones.">
            <Toggle checked={settings.haptics} onChange={(haptics) => updateSettings({ haptics })} label="Haptic feedback" />
          </Row>
          <Row label="Reduce motion" hint="Calms the background and transitions.">
            <Toggle checked={settings.reduceMotion} onChange={(reduceMotion) => updateSettings({ reduceMotion })} label="Reduce motion" />
          </Row>
          <Field label="Water goal">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1000}
                max={5000}
                step={250}
                value={settings.waterGoal}
                onChange={(e) => updateSettings({ waterGoal: Number(e.target.value) })}
                className="flex-1 accent-[var(--b2)]"
                aria-label="Daily water goal"
              />
              <span className="tabular w-16 text-right text-[15px] font-semibold">{(settings.waterGoal / 1000).toFixed(2)} L</span>
            </div>
          </Field>
        </section>
      </Reveal>

      {/* Saved foods */}
      {saved.length > 0 && (
        <Reveal delay={0.1}>
          <section className="card p-5">
            <SectionTitle>My foods</SectionTitle>
            <ul className="space-y-2">
              {saved.slice(0, 12).map((food) => (
                <li key={food.id} className="flex items-center gap-3 rounded-2xl border border-line p-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line text-[17px]">{food.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold">{food.name}</span>
                    <span className="block truncate text-[12px] text-ink-3">{food.portion}</span>
                  </span>
                  <span className="tabular text-[13.5px] font-bold">{Math.round(food.macros.kcal)}</span>
                  <Press onTap={() => removeSaved(food.id)} aria-label={`Remove ${food.name}`} className="grid size-9 place-items-center rounded-full text-ink-3">
                    <Trash2 size={15} />
                  </Press>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      )}

      {/* Data */}
      <Reveal delay={0.12}>
        <section className="card space-y-3 p-5">
          <SectionTitle>Your data</SectionTitle>
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            Everything lives in this browser on this phone — no account, no server. Back it up before clearing your browser data or switching phones.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Press onTap={exportData} className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-card py-3 text-[14.5px] font-semibold">
              <Download size={16} /> Export
            </Press>
            <Press onTap={() => fileRef.current?.click()} className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-card py-3 text-[14.5px] font-semibold">
              <Upload size={16} /> Import
            </Press>
          </div>
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
                const data = JSON.parse(await file.text())
                importState(data)
                hapticSuccess()
                toast('Backup restored', 'success')
              } catch {
                toast('That file could not be read', 'error')
              }
            }}
          />

          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} className="w-full py-2 text-[13.5px] font-semibold text-danger">
              Delete everything and start over
            </button>
          ) : (
            <div className="rounded-2xl border border-danger/40 p-3">
              <p className="text-[13.5px] text-ink-2">This deletes your profile, your log and your saved foods on this phone. It cannot be undone.</p>
              <div className="mt-3 flex gap-2">
                <Press onTap={() => setConfirmReset(false)} className="flex-1 rounded-xl border border-line py-2.5 text-[14px] font-semibold">
                  Keep my data
                </Press>
                <Press
                  onTap={() => {
                    resetAll()
                    toast('Everything cleared')
                  }}
                  className="flex-1 rounded-xl bg-danger py-2.5 text-[14px] font-semibold text-white"
                >
                  Delete it all
                </Press>
              </div>
            </div>
          )}
        </section>
      </Reveal>

      {/* About */}
      <Reveal delay={0.14}>
        <section className="card space-y-2 p-5">
          <SectionTitle>Install on your phone</SectionTitle>
          <p className="flex items-start gap-2 text-[13.5px] leading-relaxed text-ink-2">
            <Share size={16} className="mt-0.5 shrink-0 text-ink-3" />
            In Safari, tap Share then <span className="font-semibold text-ink">Add to Home Screen</span>. BiteCount then opens full screen and works with no
            signal.
          </p>
          <p className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-3">
            <Info size={16} className="mt-0.5 shrink-0" />
            Calorie figures are estimates from standard food tables. Useful for steering, not for medical decisions.
          </p>
        </section>
      </Reveal>
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold">{label}</div>
        {hint && <div className="text-[12.5px] text-ink-3">{hint}</div>}
      </div>
      {children}
    </div>
  )
}
