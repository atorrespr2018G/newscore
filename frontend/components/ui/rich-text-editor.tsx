'use client'

import Link from '@tiptap/extension-link'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'

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

interface IRichTextEditorProps {
  value: string
  onChange: (html: string) => void
  labels: IRichTextToolbarLabels
  ariaLabel?: string
}

interface IToolbarButtonProps {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

const EMPTY_HTML = '<p></p>'

/**
 * A single toolbar control rendered as an accessible toggle button.
 *
 * @param props Visible label, active/disabled state, and click handler.
 * @returns The styled toolbar button.
 */
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
        active ? 'bg-brand text-white' : 'text-neutral-700 hover:bg-neutral-100',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

/**
 * Prompt for a URL and apply (or clear) a link on the current selection.
 *
 * @param editor Active TipTap editor instance.
 * @param promptLabel Localized prompt shown to the user.
 */
function applyLink(editor: Editor, promptLabel: string): void {
  const previous = editor.getAttributes('link').href as string | undefined
  const url = window.prompt(promptLabel, previous ?? 'https://')
  if (url === null) {
    return
  }
  if (url.trim() === '') {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
}

/**
 * Formatting toolbar bound to a TipTap editor instance.
 *
 * @param props Editor instance and localized labels.
 * @returns The toolbar element, or null until the editor is ready.
 */
function RichTextToolbar({
  editor,
  labels,
}: {
  editor: Editor | null
  labels: IRichTextToolbarLabels
}): JSX.Element | null {
  if (!editor) {
    return null
  }
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-neutral-300 bg-neutral-50 px-2 py-1.5">
      <ToolbarButton label={labels.bold} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolbarButton label={labels.italic} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolbarButton label={labels.heading2} active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
      <ToolbarButton label={labels.heading3} active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
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
 * Controlled WYSIWYG editor that emits sanitized-on-save HTML.
 *
 * The editor manages its own document model; external `value` changes are synced
 * in only when they differ from the current HTML to avoid cursor jumps.
 *
 * @param props Current HTML value, change handler, labels, and aria label.
 * @returns The toolbar plus editable content surface.
 */
export function RichTextEditor({
  value,
  onChange,
  labels,
  ariaLabel,
}: IRichTextEditorProps): JSX.Element {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } }),
    ],
    content: value || EMPTY_HTML,
    editorProps: {
      attributes: {
        'aria-label': ariaLabel ?? '',
        class: 'prose max-w-none min-h-[16rem] px-3 py-2 focus:outline-none',
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  })

  useEffect(() => {
    if (!editor) {
      return
    }
    const next = value || EMPTY_HTML
    if (next !== editor.getHTML()) {
      editor.commands.setContent(next, { emitUpdate: false })
    }
  }, [editor, value])

  return (
    <div className="mt-1 overflow-hidden rounded border border-neutral-300 bg-white">
      <RichTextToolbar editor={editor} labels={labels} />
      <EditorContent editor={editor} />
    </div>
  )
}
