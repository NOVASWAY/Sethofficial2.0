import { useEffect, useCallback } from 'react'

interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  handler: (e: KeyboardEvent) => void
  description?: string
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean
  shortcuts: KeyboardShortcut[]
}

/**
 * Hook for managing keyboard shortcuts
 * @param options - Configuration for keyboard shortcuts
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   enabled: true,
 *   shortcuts: [
 *     {
 *       key: 'n',
 *       ctrl: true,
 *       handler: () => setIsNewOpen(true),
 *       description: 'Create new item'
 *     },
 *     {
 *       key: 'Escape',
 *       handler: () => setIsOpen(false),
 *       description: 'Close dialog'
 *     }
 *   ]
 * })
 * ```
 */
export function useKeyboardShortcuts({
  enabled = true,
  shortcuts,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return

      // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable elements
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Find matching shortcut
      const shortcut = shortcuts.find((s) => {
        const keyMatch = s.key.toLowerCase() === e.key.toLowerCase()
        const ctrlMatch = s.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey
        const altMatch = s.alt ? e.altKey : !e.altKey

        return keyMatch && ctrlMatch && shiftMatch && altMatch
      })

      if (shortcut) {
        e.preventDefault()
        shortcut.handler(e)
      }
    },
    [enabled, shortcuts]
  )

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, handleKeyDown])
}

/**
 * Common keyboard shortcuts for dashboards
 */
export const COMMON_SHORTCUTS = {
  NEW: { key: 'n', ctrl: true, description: 'Create new item' },
  SEARCH: { key: 'k', ctrl: true, description: 'Focus search' },
  REFRESH: { key: 'r', ctrl: true, description: 'Refresh data' },
  CLOSE: { key: 'Escape', description: 'Close dialog/modal' },
  SAVE: { key: 's', ctrl: true, description: 'Save changes' },
  DELETE: { key: 'Delete', description: 'Delete selected item' },
  EDIT: { key: 'e', description: 'Edit selected item' },
  VIEW: { key: 'v', description: 'View details' },
} as const

