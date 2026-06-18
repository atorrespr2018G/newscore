'use client'



import { useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { ADMIN_WORKFLOW_ROUTES } from '@/lib/api/admin-routes'



/** Legacy login route — editorial workflows no longer require sign-in. */

export default function AdminLoginRedirectPage(): null {

  const router = useRouter()



  useEffect(() => {

    router.replace(ADMIN_WORKFLOW_ROUTES[0])

  }, [router])



  return null

}


