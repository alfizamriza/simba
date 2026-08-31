'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { writeAuditLog } from '@/lib/audit'
import { FEATURES, defaultFeaturePermissions, type FeatureGuru, type RoleGuru } from '@/lib/auth/roles'
import { z } from 'zod'
import { randomBytes } from 'crypto'

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

const simpanGuruSchema = z.object({
  nip: z.string().min(1, 'NIP wajib diisi').regex(/^[a-zA-Z0-9_-]+$/, 'NIP hanya boleh alfanumerik, dash, dan underscore'),
  nama: z.string().min(1, 'Nama wajib diisi'),
  noHp: z.string().optional(),
  password: z.string().min(8, 'Password awal minimal 8 karakter'),
  roles: z.array(z.enum(['admin', 'wali_kelas', 'guru_mapel', 'kepala_sekolah'])).min(1, 'Pilih minimal satu role'),
  kelasId: z.string().uuid('ID kelas wali tidak valid').nullable().optional(),
  mapelKelasIds: z.array(z.string().uuid('ID kelas mapel tidak valid')).optional()
})

const updateGuruSchema = z.object({
  id: z.string().uuid('ID guru tidak valid'),
  userId: z.string().uuid('ID Auth User tidak valid'),
  nama: z.string().min(1, 'Nama wajib diisi'),
  noHp: z.string().optional(),
  roles: z.array(z.enum(['admin', 'wali_kelas', 'guru_mapel', 'kepala_sekolah'])).min(1, 'Pilih minimal satu role'),
  kelasId: z.string().uuid('ID kelas wali tidak valid').nullable().optional(),
  mapelKelasIds: z.array(z.string().uuid('ID kelas mapel tidak valid')).optional(),
  isAktif: z.boolean()
})

const resetPasswordSchema = z.object({
  id: z.string().uuid('ID guru tidak valid'),
  userId: z.string().uuid('ID Auth User tidak valid')
})

const setGuruFeatureSchema = z.object({
  guruId: z.string().uuid('ID guru tidak valid'),
  fitur: z.enum(['dashboard', 'siswa', 'pengajuan', 'laporan', 'kelas', 'guru', 'pairing-kartu', 'perangkat', 'semester']),
  isAktif: z.boolean()
})

export type SimpanGuruState = { ok: boolean; message: string }

export async function simpanGuru(_previousState: any, formData: FormData): Promise<SimpanGuruState> {
  let admin: any
  try {
    admin = await requireAdmin()
  } catch {
    return { ok: false, message: 'Unauthorized' }
  }

  const nip = text(formData.get('nip'))
  const nama = text(formData.get('nama'))
  const noHp = text(formData.get('no_hp'))
  const password = text(formData.get('password'))
  const selectedRoles = formData.getAll('roles').map((value) => String(value)).filter(Boolean)
  const kelasId = text(formData.get('kelas_id')) || null
  const mapelKelasIds = formData.getAll('mapel_kelas_ids').map((value) => String(value)).filter(Boolean)

  const result = simpanGuruSchema.safeParse({
    nip,
    nama,
    noHp: noHp || undefined,
    password,
    roles: selectedRoles,
    kelasId: kelasId || undefined,
    mapelKelasIds
  })

  if (!result.success) {
    return { ok: false, message: result.error.issues[0]?.message ?? 'Data tidak valid' }
  }

  // Validasi tambahan
  if (selectedRoles.includes('wali_kelas') && !kelasId) {
    return { ok: false, message: 'Guru dicentang "Wali Kelas" tetapi tidak memilih kelas.' }
  }
  if (selectedRoles.includes('guru_mapel') && mapelKelasIds.length === 0) {
    return { ok: false, message: 'Guru dicentang "Guru Mapel" tetapi tidak memilih kelas sama sekali.' }
  }

  const supabase = createServiceRoleClient()

  // 1. Validasi NIP belum dipakai
  const { data: existingNip, error: nipCheckError } = await supabase
    .from('guru')
    .select('id')
    .eq('nip', nip)
    .maybeSingle()

  if (nipCheckError) return { ok: false, message: nipCheckError.message }
  if (existingNip) return { ok: false, message: 'NIP sudah terdaftar.' }

  // 2. Validasi kelas wali kelas belum terpakai oleh wali kelas aktif lain
  if (selectedRoles.includes('wali_kelas') && kelasId) {
    const { data: existingWali, error: waliCheckError } = await supabase
      .from('guru_roles')
      .select('id, guru(is_aktif)')
      .eq('role', 'wali_kelas')
      .eq('kelas_id', kelasId)

    if (waliCheckError) return { ok: false, message: waliCheckError.message }
    const hasActiveWali = (existingWali ?? []).some((item: any) => item.guru?.is_aktif)
    if (hasActiveWali) {
      return { ok: false, message: 'Kelas tersebut sudah memiliki wali kelas aktif lain. Silakan pilih kelas lain atau nonaktifkan wali kelas sebelumnya terlebih dahulu.' }
    }
  }

  // 3. Panggil Supabase Admin API buat bikin auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: `${nip}@simba.internal`,
    password,
    email_confirm: true,
  })
  if (authError) return { ok: false, message: authError.message }

  try {
    // 4. Insert ke tabel guru
    const { data: guru, error: guruError } = await supabase
      .from('guru')
      .insert({ user_id: authData.user.id, nip, nama, no_hp: noHp || null })
      .select('id')
      .single()
    
    if (guruError) {
      throw new Error(guruError.code === '23505' ? 'NIP sudah terdaftar.' : guruError.message)
    }

    // 5. Insert ke guru_roles
    const rolesToInsert: any[] = []
    for (const r of selectedRoles) {
      if (r === 'wali_kelas') {
        rolesToInsert.push({ guru_id: guru.id, role: 'wali_kelas', kelas_id: kelasId })
      } else if (r === 'guru_mapel') {
        for (const cid of mapelKelasIds) {
          rolesToInsert.push({ guru_id: guru.id, role: 'guru_mapel', kelas_id: cid })
        }
      } else {
        rolesToInsert.push({ guru_id: guru.id, role: r, kelas_id: null })
      }
    }

    const { error: roleError } = await supabase.from('guru_roles').insert(rolesToInsert)
    if (roleError) throw new Error(roleError.message)

    const defaultPermissions = defaultFeaturePermissions(selectedRoles as RoleGuru[])
    const { error: permissionError } = await supabase
      .from('guru_permissions')
      .insert(FEATURES.map((fitur) => ({ guru_id: guru.id, fitur, is_aktif: defaultPermissions[fitur] })))
    if (permissionError) {
      // ignore
    }

    // Catat audit log
    await writeAuditLog({
      tabel: 'guru',
      recordId: guru.id,
      aksi: 'INSERT',
      dataSesudah: { nip, nama, roles: selectedRoles, kelasId, mapelKelasIds },
      dilakukanOleh: admin.guruId
    })

  } catch (err: any) {
    // Rollback: Hapus auth user yang baru dibuat
    await supabase.auth.admin.deleteUser(authData.user.id)
    return { ok: false, message: err.message || 'Gagal menyimpan data guru.' }
  }

  revalidatePath('/guru')
  return { ok: true, message: 'Akun guru berhasil dibuat.' }
}

export async function resetGuruPassword(formData: FormData): Promise<{ ok: boolean; message: string; password?: string }> {
  let admin: any
  try {
    admin = await requireAdmin()
  } catch {
    return { ok: false, message: 'Unauthorized' }
  }

  const id = text(formData.get('id'))
  const userId = text(formData.get('user_id'))

  const result = resetPasswordSchema.safeParse({ id, userId })
  if (!result.success) {
    return { ok: false, message: result.error.issues[0]?.message ?? 'Data tidak valid' }
  }

  // Generate random password
  const newPassword = randomBytes(6).toString('hex') // 12-char alphanumeric password
  const supabase = createServiceRoleClient()

  const { error } = await supabase.auth.admin.updateUserById(userId, { password: newPassword })
  if (error) {
    return { ok: false, message: 'Gagal mereset password: ' + error.message }
  }

  // Audit log
  await writeAuditLog({
    tabel: 'guru',
    recordId: id,
    aksi: 'UPDATE_PASSWORD',
    dataSesudah: { info: 'Password direset oleh admin' },
    dilakukanOleh: admin.guruId
  })

  return { ok: true, message: 'Password berhasil direset.', password: newPassword }
}

export async function updateGuru(_previousState: any, formData: FormData): Promise<{ ok: boolean; message: string }> {
  let admin: any
  try {
    admin = await requireAdmin()
  } catch {
    return { ok: false, message: 'Unauthorized' }
  }

  const id = text(formData.get('id'))
  const userId = text(formData.get('user_id'))
  const nama = text(formData.get('nama'))
  const noHp = text(formData.get('no_hp'))
  const selectedRoles = formData.getAll('roles').map((value) => String(value)).filter(Boolean)
  const kelasId = text(formData.get('kelas_id')) || null
  const mapelKelasIds = formData.getAll('mapel_kelas_ids').map((value) => String(value)).filter(Boolean)
  const isAktif = formData.get('is_aktif') === 'true' || formData.get('is_aktif') === 'on'

  const result = updateGuruSchema.safeParse({
    id,
    userId,
    nama,
    noHp: noHp || undefined,
    roles: selectedRoles,
    kelasId: kelasId || undefined,
    mapelKelasIds,
    isAktif
  })

  if (!result.success) {
    return { ok: false, message: result.error.issues[0]?.message ?? 'Data tidak valid' }
  }

  // Validasi tambahan
  if (selectedRoles.includes('wali_kelas') && !kelasId) {
    return { ok: false, message: 'Wali kelas harus memiliki kelas.' }
  }
  if (selectedRoles.includes('guru_mapel') && mapelKelasIds.length === 0) {
    return { ok: false, message: 'Guru mapel harus memilih minimal satu kelas.' }
  }

  const supabase = createServiceRoleClient()

  // 1. Cek apakah guru ini adalah admin aktif terakhir
  const { data: adminRoles } = await supabase
    .from('guru_roles')
    .select('guru_id, guru(is_aktif)')
    .eq('role', 'admin')

  const activeAdmins = (adminRoles ?? []).filter((item: any) => item.guru?.is_aktif)
  const isCurrentlyActiveAdmin = activeAdmins.some((item: any) => item.guru_id === id)
  const isDisabling = !isAktif
  const isRemovingAdminRole = !selectedRoles.includes('admin')

  if (isCurrentlyActiveAdmin && (isDisabling || isRemovingAdminRole) && activeAdmins.length <= 1) {
    return { ok: false, message: 'Gagal: Sistem harus selalu memiliki minimal satu admin aktif.' }
  }

  // 2. Validasi wali kelas ganda
  if (selectedRoles.includes('wali_kelas') && kelasId) {
    const { data: existingWali } = await supabase
      .from('guru_roles')
      .select('id, guru_id, guru(is_aktif)')
      .eq('role', 'wali_kelas')
      .eq('kelas_id', kelasId)

    const otherActiveWali = (existingWali ?? []).some((item: any) => item.guru_id !== id && item.guru?.is_aktif)
    if (otherActiveWali) {
      return { ok: false, message: 'Kelas tersebut sudah memiliki wali kelas aktif lain. Silakan pilih kelas lain atau nonaktifkan wali kelas sebelumnya terlebih dahulu.' }
    }
  }

  // 3. Ambil data sebelum update untuk audit log
  const { data: oldGuru } = await supabase.from('guru').select('nama, no_hp, is_aktif').eq('id', id).single()

  // 4. Update data guru di database
  const { error: guruError } = await supabase.from('guru').update({ nama, no_hp: noHp || null, is_aktif: isAktif }).eq('id', id)
  if (guruError) return { ok: false, message: guruError.message }

  // 5. Update di Supabase Auth (blokir/buka blokir)
  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: isAktif ? 'none' : '87600h'
  })
  if (authError) {
    await supabase.from('guru').update({ is_aktif: oldGuru?.is_aktif }).eq('id', id)
    return { ok: false, message: 'Gagal memperbarui status login di Supabase Auth: ' + authError.message }
  }

  // 6. Update guru_roles
  const { error: deleteRoleError } = await supabase.from('guru_roles').delete().eq('guru_id', id)
  if (deleteRoleError) return { ok: false, message: deleteRoleError.message }

  const rolesToInsert: any[] = []
  for (const r of selectedRoles) {
    if (r === 'wali_kelas') {
      rolesToInsert.push({ guru_id: id, role: 'wali_kelas', kelas_id: kelasId })
    } else if (r === 'guru_mapel') {
      for (const cid of mapelKelasIds) {
        rolesToInsert.push({ guru_id: id, role: 'guru_mapel', kelas_id: cid })
      }
    } else {
      rolesToInsert.push({ guru_id: id, role: r, kelas_id: null })
    }
  }

  const { error: roleError } = await supabase.from('guru_roles').insert(rolesToInsert)
  if (roleError) return { ok: false, message: roleError.message }

  // Catat audit log
  await writeAuditLog({
    tabel: 'guru',
    recordId: id,
    aksi: 'UPDATE',
    dataSebelum: { nama: oldGuru?.nama, no_hp: oldGuru?.no_hp, is_aktif: oldGuru?.is_aktif },
    dataSesudah: { nama, no_hp: noHp || null, is_aktif: isAktif, roles: selectedRoles, kelasId, mapelKelasIds },
    dilakukanOleh: admin.guruId
  })

  revalidatePath('/guru')
  revalidatePath(`/guru/${id}`)
  return { ok: true, message: 'Data guru berhasil diperbarui.' }
}

export async function setGuruFeature(formData: FormData) {
  await requireAdmin()
  const guruId = text(formData.get('guru_id'))
  const fitur = text(formData.get('fitur')) as FeatureGuru
  const isAktif = formData.get('is_aktif') === 'true'

  const result = setGuruFeatureSchema.safeParse({ guruId, fitur, isAktif })
  if (!result.success) throw new Error(result.error.issues[0]?.message)

  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('guru_permissions')
    .upsert({ guru_id: guruId, fitur, is_aktif: isAktif }, { onConflict: 'guru_id,fitur' })
  if (error) {
    if (error.code === 'PGRST205') redirect('/guru?error=permissions-table')
    throw new Error(error.message)
  }
  revalidatePath('/guru')
}
