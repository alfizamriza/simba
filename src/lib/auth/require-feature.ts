import { redirect } from 'next/navigation'
import { getGuruSession } from '@/lib/auth/get-role'
import { hasFeature, type FeatureGuru } from '@/lib/auth/roles'

export async function requireFeature(feature: FeatureGuru) {
  const session = await getGuruSession()

  if (!session) redirect('/login')
  if (!hasFeature(session, feature)) redirect('/dashboard')

  return session
}
