'use client'

import { useState } from 'react'
import type { IEditorStatus } from '@/interfaces/editor-article'

/**
 * Hold the shared error/message/loading/saving banners for the editor page.
 *
 * @returns Status flags and their setters.
 */
export function useEditorStatus(): IEditorStatus {
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  return { error, message, loading, saving, setError, setMessage, setLoading, setSaving }
}
