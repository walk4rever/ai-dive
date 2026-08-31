'use client'

import { useState } from 'react'

interface ConfirmDeleteDialogProps {
  title: string
  /** What gets destroyed — spelled out so nobody confirms without reading it. */
  description: string
  /** The exact string the admin must type to enable the confirm button — an email,
   *  a slug, whatever uniquely names the thing being deleted. Prevents a reflexive
   *  double-click on a plain confirm() from taking out the wrong row. */
  confirmValue: string
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** A stronger gate than window.confirm() for genuinely destructive, cascading
 *  deletes — first used by user deletion (wipes agents/orders/credit history via
 *  ON DELETE CASCADE). Not wired into post/deck delete, which stay on the lighter
 *  confirm() since those aren't cascading and are easy to recreate. */
export function ConfirmDeleteDialog({ title, description, confirmValue, busy, onConfirm, onCancel }: ConfirmDeleteDialogProps) {
  const [input, setInput] = useState('')
  const canConfirm = input === confirmValue && !busy

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="ring-whisper w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-serif text-xl font-medium">{title}</p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
        <p className="mt-4 text-xs text-[var(--muted)]">
          输入 <span className="font-mono text-[var(--foreground)]">{confirmValue}</span> 确认：
        </p>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)] transition"
        />
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm text-[var(--foreground-soft)] transition-colors hover:border-[var(--ring)]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="rounded-[var(--radius-md)] bg-red-600 px-4 py-2 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? '删除中…' : '确认删除'}
          </button>
        </div>
      </div>
    </div>
  )
}
