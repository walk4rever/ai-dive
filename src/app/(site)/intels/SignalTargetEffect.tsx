'use client'

import { useEffect } from 'react'

export function SignalTargetEffect() {
  useEffect(() => {
    let active: HTMLElement | null = null

    function apply() {
      active?.classList.remove('is-targeted')
      active = null

      const hash = window.location.hash.slice(1)
      if (!hash) return

      let id = hash
      try {
        id = decodeURIComponent(hash)
      } catch {
        // Keep the raw fragment when it contains a malformed percent escape.
      }

      const target = document.getElementById(id)
      if (!target?.classList.contains('signal-entry')) return

      target.classList.add('is-targeted')
      active = target
    }

    apply()
    const timer = window.setTimeout(apply, 120)
    window.addEventListener('hashchange', apply)
    window.addEventListener('popstate', apply)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('hashchange', apply)
      window.removeEventListener('popstate', apply)
      active?.classList.remove('is-targeted')
    }
  }, [])

  return null
}
