'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/toast'
import { EditorScopeProvider } from '@/context/editor-scope-context'
import { EditorialPreviewSyncProvider } from '@/context/editorial-preview-sync-context'
import { ADMIN_WORKFLOW_ROUTES } from '@/lib/api/admin-routes'
import { ensureDevEditorialSession } from '@/lib/api/auth'

const Masthead = dynamic(() => import('@/components/ui/masthead').then((mod) => mod.Masthead), {
  ssr: false,
})

interface IAdminLayoutProps {
  children: ReactNode
}

/** Editorial workflow pages using the public masthead (Reporter / Editor / Preview tabs). */
export default function AdminLayout({ children }: IAdminLayoutProps): JSX.Element {
  const [queryClient] = useState(() => new QueryClient())
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    void ensureDevEditorialSession()
    if (pathname === '/admin' || pathname === '/admin/login') {
      router.replace(ADMIN_WORKFLOW_ROUTES[0])
    }
  }, [pathname, router])

  return (
    <QueryClientProvider client={queryClient}>
      <EditorScopeProvider>
        <EditorialPreviewSyncProvider>
          <ToastProvider>
            <Masthead showAdRibbon={false} />
            <main id="main-content" className="site-container py-8">
              {children}
            </main>
          </ToastProvider>
        </EditorialPreviewSyncProvider>
      </EditorScopeProvider>
    </QueryClientProvider>
  )
}
