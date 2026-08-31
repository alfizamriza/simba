import { redirect } from 'next/navigation'
import { getGuruSession } from '@/lib/auth/get-role'
import { isAdmin } from '@/lib/auth/roles'

export async function requireAdmin() {
  const session = await getGuruSession()

  if (!session) redirect('/login')
  if (!isAdmin(session)) redirect('/dashboard')

  return session
}
