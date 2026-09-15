let enabled = true
let label: HTMLLabelElement | null = null

export function setHapticsEnabled(on: boolean) {
  enabled = on
}

/**
 * Light tap feedback. Android gets the Vibration API; iOS Safari has no vibration
 * API, but toggling a native `<input switch>` through its label plays the system haptic.
 */
export function haptic(pattern: number | number[] = 8) {
  if (!enabled || typeof document === 'undefined') return
  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      if (navigator.vibrate(pattern)) return
    }
    if (!label) {
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.id = 'bc-haptic'
      input.setAttribute('switch', '')
      input.setAttribute('aria-hidden', 'true')
      input.tabIndex = -1
      input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;left:-99px'
      label = document.createElement('label')
      label.htmlFor = input.id
      label.style.cssText = input.style.cssText
      label.setAttribute('aria-hidden', 'true')
      document.body.append(input, label)
    }
    label.click()
  } catch {
    // Haptics are a nicety; never let them break a tap.
  }
}

export const hapticSuccess = () => haptic([10, 40, 18])
