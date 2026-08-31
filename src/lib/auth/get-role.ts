import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { GuruSession, RoleGuru } from '@/lib/auth/roles'

// Ambil data guru yang sedang login beserta semua role-nya.
// Dipakai di Server Component/layout buat tentukan menu & akses apa yang muncul.
export async function getGuruSession(): Promise<GuruSession | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  let { data: guru } = await supabase
    .from('guru')
    .select('id, nama, is_aktif')
    .eq('user_id', user.id)
    .single()

  if (!guru) {
    const serviceSupabase = createServiceRoleClient()
    const result = await serviceSupabase
      .from('guru')
      .select('id, nama, is_aktif')
      .eq('user_id', user.id)
      .single()
    guru = result.data
  }

  if (!guru || !guru.is_aktif) return null

  let { data: roles } = await supabase
    .from('guru_roles')
    .select('role, kelas_id')
    .eq('guru_id', guru.id)

  if (!roles?.length) {
    const serviceSupabase = createServiceRoleClient()
    const result = await serviceSupabase
      .from('guru_roles')
      .select('role, kelas_id')
      .eq('guru_id', guru.id)
    roles = result.data
  }

  let { data: permissions } = await supabase
    .from('guru_permissions')
    .select('fitur, is_aktif')
    .eq('guru_id', guru.id)

  if (!permissions?.length) {
    const serviceSupabase = createServiceRoleClient()
    const result = await serviceSupabase
      .from('guru_permissions')
      .select('fitur, is_aktif')
      .eq('guru_id', guru.id)
    permissions = result.data
  }

  return {
    guruId: guru.id,
    nama: guru.nama,
    roles: (roles as { role: RoleGuru; kelas_id: string | null }[] | null)?.map((r) => ({
      role: r.role,
      kelasId: r.kelas_id,
    })) ?? [],
    permissions: Object.fromEntries((permissions ?? []).map((item) => [item.fitur, item.is_aktif])),
  }
}
