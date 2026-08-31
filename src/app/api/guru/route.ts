import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { writeAuditLog } from '@/lib/audit'
import { FEATURES, defaultFeaturePermissions, type RoleGuru } from '@/lib/auth/roles'
import { z } from 'zod'

const ROLES = ['admin', 'wali_kelas', 'guru_mapel', 'kepala_sekolah'] as const

function text(value: FormDataEntryValue | null) { return String(value ?? '').trim() }
function redirectWith(request: NextRequest, key: string, message: string) { return NextResponse.redirect(new URL(`/guru?${key}=${encodeURIComponent(message)}`, request.url), 303) }

const createGuruRouteSchema = z.object({
  nip: z.string().min(1, 'NIP wajib diisi'),
  nama: z.string().min(1, 'Nama wajib diisi'),
  noHp: z.string().optional(),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  roles: z.array(z.enum(ROLES)).min(1, 'Pilih minimal satu role'),
  kelasId: z.string().uuid().nullable().or(z.literal(''))
})

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  const formData = await request.formData()
  const nip = text(formData.get('nip'))
  const nama = text(formData.get('nama'))
  const noHp = text(formData.get('no_hp'))
  const password = text(formData.get('password'))
  const role = text(formData.get('role'))
  const selectedRoles = formData.getAll('roles').map((value) => String(value)).filter(Boolean)
  const roles = selectedRoles.length ? selectedRoles : [role]
  const kelasId = text(formData.get('kelas_id')) || null

  const result = createGuruRouteSchema.safeParse({
    nip,
    nama,
    noHp: noHp || undefined,
    password,
    roles,
    kelasId: kelasId || null
  })

  if (!result.success) {
    const errorMsg = result.error.issues[0]?.message ?? 'Data tidak valid'
    return redirectWith(request, 'error', errorMsg)
  }

  if (roles.includes('wali_kelas') && !kelasId) {
    return redirectWith(request, 'error', 'Wali kelas harus memiliki kelas.')
  }

  const supabase = createServiceRoleClient()
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({ email: `${nip}@simba.internal`, password, email_confirm: true })
  if (authError) return redirectWith(request, 'error', authError.message)

  const { data: guru, error: guruError } = await supabase.from('guru').insert({ user_id: authData.user.id, nip, nama, no_hp: noHp || null }).select('id').single()
  if (guruError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    return redirectWith(request, 'error', guruError.code === '23505' ? 'NIP sudah terdaftar.' : guruError.message)
  }

  const { error: roleError } = await supabase.from('guru_roles').insert(roles.map((item) => ({ guru_id: guru.id, role: item, kelas_id: item === 'wali_kelas' ? kelasId : null })))
  if (roleError) {
    await supabase.from('guru').delete().eq('id', guru.id)
    await supabase.auth.admin.deleteUser(authData.user.id)
    return redirectWith(request, 'error', roleError.message)
  }

  const defaultPermissions = defaultFeaturePermissions(roles as RoleGuru[])
  const { error: permissionError } = await supabase
    .from('guru_permissions')
    .insert(FEATURES.map((fitur) => ({ guru_id: guru.id, fitur, is_aktif: defaultPermissions[fitur] })))
  if (permissionError && permissionError.code !== 'PGRST205') {
    // Abaikan error duplikasi/tabel permissions, lanjutkan audit logging
  }

  // Catat audit log untuk penambahan guru
  await writeAuditLog({
    tabel: 'guru',
    recordId: guru.id,
    aksi: 'INSERT',
    dataSesudah: { nip, nama, roles, kelasId },
    dilakukanOleh: admin.guruId
  })

  revalidatePath('/guru')
  return redirectWith(request, 'created', 'Akun guru berhasil dibuat.')
}
