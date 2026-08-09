/**
 * Label a Media Desk handoff asset as a standalone picture or video.
 *
 * @param asset Asset being labeled.
 * @param _familyAssets Unused; kept for call-site compatibility.
 * @returns Display badge.
 */
export function mediaDeskVersionLabel(
  asset: {
    id: string
    file_type?: string
    title?: string | null
    original_filename?: string
    version_of?: string | null
  },
  _familyAssets?: unknown,
): string {
  const name = `${asset.title ?? ''} ${asset.original_filename ?? ''}`.toLowerCase()
  if (name.includes('edit') || (asset.original_filename ?? '').startsWith('edited-')) {
    return 'Edit'
  }
  return asset.file_type === 'video' ? 'Video' : 'Picture'
}
