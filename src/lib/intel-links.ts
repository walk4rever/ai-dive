import type { Signal } from '@/types'

export function intelDatePath(date: string) {
  return `/intels/${date}`
}

export function signalAnchorId(id: string) {
  return `signal-${id}`
}

export function signalIntelHref(signal: Pick<Signal, 'id' | 'signal_date'>) {
  return `${intelDatePath(signal.signal_date)}#${signalAnchorId(signal.id)}`
}
