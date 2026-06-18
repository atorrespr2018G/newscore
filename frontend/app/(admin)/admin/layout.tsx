'use client'



import dynamic from 'next/dynamic'

import { usePathname, useRouter } from 'next/navigation'

import { useEffect, type ReactNode } from 'react'

import { ADMIN_WORKFLOW_ROUTES } from '@/lib/api/admin-routes'

import { ensureDevEditorialSession } from '@/lib/api/auth'

import { AdminWorkflowNav } from '@/components/ui/admin-workflow-nav'
import { EditorialPreviewSyncProvider } from '@/context/editorial-preview-sync-context'



const Masthead = dynamic(() => import('@/components/ui/masthead').then((mod) => mod.Masthead), {

  ssr: false,

})



interface IAdminLayoutProps {

  children: ReactNode

}



/** Editorial workflow pages using the public masthead (Reporter / Editor / Preview tabs). */

export default function AdminLayout({ children }: IAdminLayoutProps): JSX.Element {

  const pathname = usePathname()

  const router = useRouter()



  useEffect(() => {

    void ensureDevEditorialSession()



    if (pathname === '/admin' || pathname === '/admin/login') {

      router.replace(ADMIN_WORKFLOW_ROUTES[0])

    }

  }, [pathname, router])



  return (

    <EditorialPreviewSyncProvider>

      <Masthead />

      <main id="main-content" className="site-container py-8">

        <AdminWorkflowNav />

        {children}

      </main>

    </EditorialPreviewSyncProvider>

  )

}


