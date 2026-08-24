/**
 * Strip a trailing slash from a URL base.
 *
 * @param url REST or GraphQL base URL.
 * @returns URL without a trailing slash.
 */
function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '')
}

interface IResolveRestApiBaseOptions {
  publicUrl: string | undefined
  serviceInternalUrl: string | undefined
  directDevDefault: string
}

/**
 * REST base URL for the current runtime (browser vs Next server in Docker).
 *
 * Browser code uses the public Nginx/host URL. Server components inside Docker
 * must reach services through the internal gateway, not `localhost`.
 *
 * @param options Public env, optional service-specific internal override, dev fallback.
 * @returns Normalized REST API base URL.
 */
function resolveRestApiBase(options: IResolveRestApiBaseOptions): string {
  if (typeof window === 'undefined') {
    const serviceInternal = options.serviceInternalUrl?.trim()
    if (serviceInternal) {
      return stripTrailingSlash(serviceInternal)
    }
    const gateway = process.env.API_INTERNAL_URL?.trim()
    const publicUrl = options.publicUrl?.trim()
    if (gateway && publicUrl?.includes('/api/v1/')) {
      const pathSuffix = publicUrl.replace(/^https?:\/\/[^/]+/, '')
      return stripTrailingSlash(`${stripTrailingSlash(gateway)}${pathSuffix}`)
    }
  }
  return stripTrailingSlash(options.publicUrl ?? options.directDevDefault)
}

/** REST API base URLs (prefer /api/v1/* via Nginx in production). */
export const apiConfig = {
  get admin(): string {
    return resolveRestApiBase({
      publicUrl: process.env.NEXT_PUBLIC_ADMIN_API_URL,
      serviceInternalUrl: process.env.ADMIN_INTERNAL_URL,
      directDevDefault: 'http://localhost:5001',
    })
  },
  get news(): string {
    return resolveRestApiBase({
      publicUrl: process.env.NEXT_PUBLIC_NEWS_API_URL,
      serviceInternalUrl: process.env.NEWS_INTERNAL_URL,
      directDevDefault: 'http://localhost:5002',
    })
  },
  get layout(): string {
    return resolveRestApiBase({
      publicUrl: process.env.NEXT_PUBLIC_LAYOUT_API_URL,
      serviceInternalUrl: process.env.LAYOUT_INTERNAL_URL,
      directDevDefault: 'http://localhost:5003',
    })
  },
  get mediaEditor(): string {
    return resolveRestApiBase({
      publicUrl: process.env.NEXT_PUBLIC_MEDIA_EDITOR_API_URL,
      serviceInternalUrl: process.env.MEDIA_EDITOR_INTERNAL_URL,
      directDevDefault: 'http://localhost:5004/api/v1/media-editor',
    })
  },
}
