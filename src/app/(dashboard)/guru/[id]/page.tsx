import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireFeature } from '@/lib/auth/require-feature'
import { notFound } from 'next/navigation'
import EditGuruClient from './edit-guru-client'

type Kelas = { id: string; nama: string; tingkat: number }
type Teacher = { id: string; user_id: string; nip: string; nama: string; no_hp: string | null; is_aktif: boolean }
type TeacherRole = { role: string; kelas_id: string | null }

export default async function EditGuruPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  await requireFeature('guru')

  const { id } = await params
  const supabase = createServiceRoleClient()

  // 1. Fetch guru data
  const { data: teacher, error: teacherError } = await supabase
    .from('guru')
    .select('id, user_id, nip, nama, no_hp, is_aktif')
    .eq('id', id)
    .single()

  if (teacherError || !teacher) {
    notFound()
  }

  // 2. Fetch roles
  const { data: roles } = await supabase
    .from('guru_roles')
    .select('role, kelas_id')
    .eq('guru_id', id)

  const teacherRoles = (roles ?? []) as TeacherRole[]

  // 3. Fetch all classes
  const { data: kelas } = await supabase.from('kelas').select('id, nama, tingkat').order('nama')
  const classes = (kelas ?? []) as Kelas[]

  // 4. Find classes already assigned to other active wali kelas
  const { data: activeWaliRoles } = await supabase
    .from('guru_roles')
    .select('kelas_id, guru_id, guru(is_aktif)')
    .eq('role', 'wali_kelas')
    .not('kelas_id', 'is', null)

  const kelasTerpakaiIds = (activeWaliRoles ?? [])
    .filter((item: any) => item.guru_id !== id && item.guru?.is_aktif)
    .map((item: any) => item.kelas_id as string)

  return (
    <EditGuruClient
      teacher={teacher as Teacher}
      teacherRoles={teacherRoles}
      classes={classes}
      kelasTerpakaiIds={kelasTerpakaiIds}
    />
  )
}
