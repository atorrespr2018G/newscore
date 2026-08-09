'use client'

import Link from '@tiptap/extension-link'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

/** Localized labels for the rich-text editor toolbar controls. */
export interface IRichTextToolbarLabels {
  bold: string
  italic: string
  heading2: string
  heading3: string
  bulletList: string
  orderedList: string
  blockquote: string
  link: string
  unlink: string
  linkPrompt: string
  undo: string
  redo: string
}

/** Imperative helpers for reading the live editor document. */
export interface IRichTextEditorHandle {
  getHTML: () => string
}

interface IRichTextEditorProps {
  value: string
  onChange: (html: string) => void
  labels: IRichTextToolbarLabels
  ariaLabel?: string
  editable?: boolean
}

interface IToolbarButtonProps {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

const EMPTY_HTML = '<p></p>'

/** Normalize empty TipTap documents for equality checks. */
function normalizeEditorHtml(html: string): string {
  const compact = html
    .replace(/<br class="ProseMirror-trailingBreak">/g, '')
    .replace(/<br\s*\/?>/g, '')
    .trim()
  if (compact === '' || compact === '<p></p>') return EMPTY_HTML
  return html.trim()
}

/** A single toolbar control rendered as an accessible toggle button. */
function ToolbarButton({ label, active, disabled, onClick }: IToolbarButtonProps): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={active ?? false}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={[
        'rounded px-2 py-1 text-sm font-medium transition-colors disabled:opacity-40',
        active ? 'bg-brand text-white' : 'text-slate-700 hover:bg-brand-paper',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

/** Prompt for a URL and apply or clear a link on the current selection. */
function applyLink(editor: Editor, promptLabel: string): void {
  const previous = editor.getAttributes('link').href as string | undefined
  const url = window.prompt(promptLabel, previous ?? 'https://')
  if (url === null) return
  if (url.trim() === '') {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
}

/** Formatting toolbar bound to a TipTap editor instance. */
function RichTextToolbar({
  editor,
  labels,
}: {
  editor: Editor | null
  labels: IRichTextToolbarLabels
}): JSX.Element | null {
  if (!editor) return null
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-brand-line bg-brand-paper px-2 py-1.5">
      <ToolbarButton label={labels.bold} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolbarButton label={labels.italic} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolbarButton
        label={labels.heading2}
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        label={labels.heading3}
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />
      <ToolbarButton label={labels.bulletList} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <ToolbarButton label={labels.orderedList} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <ToolbarButton label={labels.blockquote} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      <ToolbarButton label={labels.link} active={editor.isActive('link')} onClick={() => applyLink(editor, labels.linkPrompt)} />
      <ToolbarButton label={labels.unlink} disabled={!editor.isActive('link')} onClick={() => editor.chain().focus().unsetLink().run()} />
      <ToolbarButton label={labels.undo} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} />
      <ToolbarButton label={labels.redo} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} />
    </div>
  )
}

/**
 * Controlled WYSIWYG editor matching the NewsCore reporter body toolbar.
 * @param props - Current HTML value, change handler, labels, and aria label.
 * @returns The toolbar plus editable content surface.
 */
export const RichTextEditor = forwardRef<IRichTextEditorHandle, IRichTextEditorProps>(
  function RichTextEditor(
    { value, onChange, labels, ariaLabel, editable = true },
    ref,
  ): JSX.Element {
    const emittedHtmlRef = useRef(normalizeEditorHtml(value || EMPTY_HTML))
    const editor = useEditor({
      immediatelyRender: false,
      editable,
      extensions: [
        StarterKit,
        Link.configure({
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer' },
        }),
      ],
      content: value || EMPTY_HTML,
      editorProps: {
        attributes: {
          'aria-label': ariaLabel ?? '',
          class: 'me-prose min-h-[12rem] px-3 py-2 focus:outline-none',
        },
      },
      onUpdate: ({ editor: current }) => {
        const html = current.getHTML()
        emittedHtmlRef.current = normalizeEditorHtml(html)
        onChange(html)
      },
    })

    useImperativeHandle(ref, () => ({
      getHTML: () => editor?.getHTML() ?? emittedHtmlRef.current,
    }), [editor])

    useEffect(() => {
      if (!editor) return
      editor.setEditable(editable)
    }, [editor, editable])

    useEffect(() => {
      if (!editor) return
      const next = normalizeEditorHtml(value || EMPTY_HTML)
      const live = normalizeEditorHtml(editor.getHTML())
      if (next === live) return
      if (editor.isFocused) return
      // Parent can lag the last keystroke after blur; keep non-empty live docs.
      // Still allow hydration when the editor is empty and saved HTML arrives.
      if (live === emittedHtmlRef.current && live !== EMPTY_HTML && next !== live) return
      editor.commands.setContent(value || EMPTY_HTML, { emitUpdate: false })
      emittedHtmlRef.current = next
    }, [editor, value])

    return (
      <div className="mt-1 overflow-hidden rounded-xl border border-brand-line bg-white">
        <RichTextToolbar editor={editor} labels={labels} />
        <EditorContent editor={editor} />
      </div>
    )
  },
)
