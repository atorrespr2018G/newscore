import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { purgeEditorPreviewCaches } from '@/lib/editor/purge-editor-preview-caches'
import { editorKeys } from '@/lib/editor/query-keys'
import type { IEditorScope } from '@/lib/editor/editor-scope'

const usScope: IEditorScope = {
  marketCode: 'us',
  townId: null,
  countyId: null,
  pageName: 'homepage',
}

const flScope: IEditorScope = {
  marketCode: 'us',
  townId: null,
  countyId: 'us-fl',
  pageName: 'homepage',
}

describe('purgeEditorPreviewCaches flash prevention', () => {
  it('drops other-market preview caches so a deleted story cannot flash', () => {
    const client = new QueryClient()
    const deletedId = 'article-deleted'
    client.setQueryData(editorKeys.previewFeed(usScope), {
      slots: [{ position_key: 'hero', articles: [{ id: deletedId, title: 'Gone' }] }],
    })
    client.setQueryData(editorKeys.previewFeed(flScope), {
      slots: [{ position_key: 'hero', articles: [{ id: deletedId, title: 'Gone' }] }],
    })
    client.setQueryData(editorKeys.slots(flScope), [{ id: 'slot-fl', pinned_ids: [deletedId] }])

    purgeEditorPreviewCaches(client)

    expect(client.getQueryData(editorKeys.previewFeed(usScope))).toBeUndefined()
    expect(client.getQueryData(editorKeys.previewFeed(flScope))).toBeUndefined()
    expect(client.getQueryData(editorKeys.slots(flScope))).toBeUndefined()
  })
})
