'use client'



import { useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { ADMIN_WORKFLOW_ROUTES } from '@/lib/api/admin-routes'



/** Redirect `/admin` to the Reporter workflow page. */

export default function AdminIndexPage(): JSX.Element | null {

  const router = useRouter()



  useEffect(() => {

    router.replace(ADMIN_WORKFLOW_ROUTES[0])

  }, [router])



  return (

    <p className="text-neutral-600" aria-live="polite">

      Redirecting…

    </p>

  )

}


