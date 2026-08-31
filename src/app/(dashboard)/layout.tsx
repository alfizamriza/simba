import { getGuruSession } from '@/lib/auth/get-role'
import { isAdmin, isWaliKelas } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SidebarNav from '@/components/SidebarNav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getGuruSession()

  if (!session) {
    redirect('/login')
  }

  const admin = isAdmin(session)
  const waliKelas = isWaliKelas(session)

  async function logout() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F7FAF9] font-sans text-[#1C2321] antialiased lg:flex-row">
      <SidebarNav
        session={session}
        admin={admin}
        waliKelas={waliKelas}
        logoutAction={logout}
      />

      {/* Konten Utama */}
      <main className="min-w-0 flex-1 p-3 sm:p-4 lg:p-6">
        <div className="min-h-[calc(100vh-3rem)] min-w-0 rounded-[8px] border border-[#DCE4E2] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] sm:p-5 lg:p-7">
          {children}
        </div>
      </main>
    </div>
  )
}
