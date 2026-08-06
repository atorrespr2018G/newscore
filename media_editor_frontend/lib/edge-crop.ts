/** Pure helpers for independent left/right/top/bottom image edge crops. */

export interface IEdgeCropInsets {
  left: number
  right: number
  top: number
  bottom: number
}

export interface IImageSize {
  width: number
  height: number
}

const MIN_OUTPUT_PX = 1

/**
 * Load an image URL into an HTMLImageElement.
 * @param sourceUrl - Same-origin or CORS-safe image URL.
 * @returns Resolved image element.
 * @throws When the image fails to load.
 */
export function loadImageElement(sourceUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to load image for edge crop'))
    image.src = sourceUrl
  })
}

/**
 * Read natural pixel size from an image URL.
 * @param sourceUrl - Image URL to measure.
 * @returns Width and height in pixels.
 */
export async function readImageSize(sourceUrl: string): Promise<IImageSize> {
  const image = await loadImageElement(sourceUrl)
  return { width: image.naturalWidth, height: image.naturalHeight }
}

/**
 * Clamp edge insets so the remaining crop stays at least one pixel.
 * @param size - Source image size.
 * @param insets - Requested left/right/top/bottom trims in pixels.
 * @returns Safe insets that fit inside the image.
 */
export function clampEdgeInsets(size: IImageSize, insets: IEdgeCropInsets): IEdgeCropInsets {
  const maxHorizontal = Math.max(0, size.width - MIN_OUTPUT_PX)
  const maxVertical = Math.max(0, size.height - MIN_OUTPUT_PX)
  const left = clampInt(insets.left, 0, maxHorizontal)
  const right = clampInt(insets.right, 0, maxHorizontal - left)
  const top = clampInt(insets.top, 0, maxVertical)
  const bottom = clampInt(insets.bottom, 0, maxVertical - top)
  return { left, right, top, bottom }
}

/**
 * Whether any edge trim is greater than zero.
 * @param insets - Edge trim values.
 * @returns True when at least one side will be cropped.
 */
export function hasEdgeCrop(insets: IEdgeCropInsets): boolean {
  return insets.left > 0 || insets.right > 0 || insets.top > 0 || insets.bottom > 0
}

/**
 * Crop an image by trimming each side independently.
 * @param sourceUrl - Image URL to crop.
 * @param insets - Pixels to remove from left, right, top, and bottom.
 * @returns PNG blob of the cropped region.
 * @throws When the crop region is empty or canvas export fails.
 */
export async function cropImageByEdges(
  sourceUrl: string,
  insets: IEdgeCropInsets,
): Promise<Blob> {
  const image = await loadImageElement(sourceUrl)
  const size = { width: image.naturalWidth, height: image.naturalHeight }
  const safe = clampEdgeInsets(size, insets)
  const width = size.width - safe.left - safe.right
  const height = size.height - safe.top - safe.bottom
  if (width < MIN_OUTPUT_PX || height < MIN_OUTPUT_PX) {
    throw new Error('Edge crop leaves no image remaining')
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to create crop canvas')
  context.drawImage(image, safe.left, safe.top, width, height, 0, 0, width, height)
  const blob = await canvasToPngBlob(canvas)
  if (!blob) throw new Error('Edge crop export failed')
  return blob
}

/**
 * Clamp an integer into an inclusive range.
 * @param value - Raw numeric input.
 * @param min - Minimum allowed value.
 * @param max - Maximum allowed value.
 * @returns Clamped non-negative integer.
 */
function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

/**
 * Export a canvas as a PNG blob.
 * @param canvas - Source canvas.
 * @returns PNG blob or null when export fails.
 */
function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}
