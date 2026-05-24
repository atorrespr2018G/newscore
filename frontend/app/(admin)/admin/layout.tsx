'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { clearToken, getStoredToken } from '@/lib/api/auth'

interface IAdminLayoutProps {
  children: ReactNode
}

export default function AdminLayout({ children }: IAdminLayoutProps): JSX.Element {
  const pathname = usePathname()
  const router = useRouter()
  const isLogin = pathname === '/admin/login'

  useEffect(() => {
    if (isLogin) return
    if (!getStoredToken()) {
      router.replace('/admin/login')
    }
  }, [isLogin, router])

  if (isLogin) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-serif text-xl font-bold text-brand">
              NewsCore Admin
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/admin" className="text-neutral-700 hover:text-brand">
                Articles
              </Link>
              <Link href="/" className="text-neutral-500 hover:text-neutral-800">
                Public site
              </Link>
            </nav>
          </div>
          <button
            type="button"
            onClick={() => {
              clearToken()
              router.push('/admin/login')
            }}
            className="text-sm text-neutral-600 hover:text-brand"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
