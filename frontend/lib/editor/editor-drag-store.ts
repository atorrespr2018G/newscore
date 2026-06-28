/**
 * Cross-window store for the article id currently being dragged.
 *
 * Native HTML5 drag-and-drop does not reliably carry its `dataTransfer` payload
 * into a different browser window, so the dragged story id is mirrored in
 * `localStorage` (shared across same-origin windows) on drag start and read back
 * as a fallback when a Placement window receives the drop with an empty payload.
 */

/** localStorage key holding the id of the story currently being dragged. */
const DRAGGING_ARTICLE_ID_KEY = 'editor-dragging-article-id'
const DRAGGING_ARTICLE_ID_TTL_MS = 30_000

interface IDraggingArticlePayload {
  articleId: string
  expiresAt: number
}

/**
 * Parse the persisted drag payload and evict invalid/expired values.
 *
 * @returns A valid drag payload or null when missing/stale/corrupt.
 */
function readDraggingPayload(): IDraggingArticlePayload | null {
  if (typeof window === 'undefined') {
    return null
  }
  const raw = localStorage.getItem(DRAGGING_ARTICLE_ID_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as IDraggingArticlePayload
    if (!parsed.articleId?.trim() || parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(DRAGGING_ARTICLE_ID_KEY)
      return null
    }
    return parsed
  } catch {
    localStorage.removeItem(DRAGGING_ARTICLE_ID_KEY)
    return null
  }
}

/**
 * Record the story id being dragged so another window can read it on drop.
 *
 * @param articleId Id of the story the editor started dragging.
 */
export function setDraggingArticleId(articleId: string): void {
  if (typeof window === 'undefined') {
    return
  }
  const payload: IDraggingArticlePayload = {
    articleId,
    expiresAt: Date.now() + DRAGGING_ARTICLE_ID_TTL_MS,
  }
  localStorage.setItem(DRAGGING_ARTICLE_ID_KEY, JSON.stringify(payload))
}

/**
 * Read the story id currently being dragged, if any.
 *
 * @returns The dragged story id, or null when no drag is in progress/recorded.
 */
export function getDraggingArticleId(): string | null {
  const payload = readDraggingPayload()
  return payload?.articleId ?? null
}

/**
 * Read and clear the story id currently being dragged, if any.
 *
 * @returns The dragged story id, or null when none is available.
 */
export function consumeDraggingArticleId(): string | null {
  const articleId = getDraggingArticleId()
  if (articleId) {
    clearDraggingArticleId()
  }
  return articleId
}

/** Clear the recorded dragging story id once a drag ends. */
export function clearDraggingArticleId(): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.removeItem(DRAGGING_ARTICLE_ID_KEY)
}
