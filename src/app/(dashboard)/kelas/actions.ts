'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

export async function saveKelas(formData: FormData) {
  await requireAdmin()

  const id = text(formData.get('id'))
  const tahunAjaranId = text(formData.get('tahun_ajaran_id'))
  const nama = text(formData.get('nama'))
  const tingkat = Number(formData.get('tingkat'))

  if (!tahunAjaranId || !nama || ![7, 8, 9].includes(tingkat)) {
    throw new Error('Tahun ajaran, nama kelas, dan tingkat wajib diisi dengan benar.')
  }

  const supabase = createServiceRoleClient()
  const query = id
    ? supabase.from('kelas').update({ tahun_ajaran_id: tahunAjaranId, nama, tingkat }).eq('id', id)
    : supabase.from('kelas').insert({ tahun_ajaran_id: tahunAjaranId, nama, tingkat })
  const { error } = await query

  if (error) throw new Error(error.code === '23505' ? 'Kelas dengan nama itu sudah ada pada tahun ajaran tersebut.' : error.message)
  revalidatePath('/kelas')
}

export async function deleteKelas(formData: FormData) {
  await requireAdmin()
  const id = text(formData.get('id'))
  if (!id) throw new Error('ID kelas tidak ditemukan.')

  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('kelas').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/kelas')
}

export async function saveTahunAjaran(formData: FormData) {
  await requireAdmin()
  const nama = text(formData.get('nama'))
  if (!/^\d{4}\/\d{4}$/.test(nama)) throw new Error('Format tahun ajaran harus seperti 2026/2027.')

  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('tahun_ajaran').insert({ nama })
  if (error) throw new Error(error.code === '23505' ? 'Tahun ajaran sudah ada.' : error.message)
  revalidatePath('/kelas')
}

export async function assignWaliKelas(formData: FormData) {
  await requireAdmin()
  const kelasId = text(formData.get('kelas_id'))
  const guruId = text(formData.get('guru_id')) || null
  if (!kelasId) throw new Error('Kelas tidak ditemukan.')

  const supabase = createServiceRoleClient()
  const { error: removeError } = await supabase.from('guru_roles').delete().eq('role', 'wali_kelas').eq('kelas_id', kelasId)
  if (removeError) throw new Error(removeError.message)
  if (guruId) {
    const { error: assignError } = await supabase.from('guru_roles').insert({ guru_id: guruId, role: 'wali_kelas', kelas_id: kelasId })
    if (assignError) throw new Error(assignError.message)
  }
  revalidatePath('/kelas')
  revalidatePath('/guru')
}

export async function moveSiswa(formData: FormData) {
  await requireAdmin()
  const siswaId = text(formData.get('siswa_id'))
  const kelasId = text(formData.get('kelas_id')) || null
  if (!siswaId) throw new Error('Siswa tidak ditemukan.')

  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('siswa').update({ kelas_id: kelasId }).eq('id', siswaId)
  if (error) throw new Error(error.message)
  revalidatePath('/kelas')
  revalidatePath('/siswa')
}

export async function saveJadwal(formData: FormData) {
  await requireAdmin()
  const kelasId = text(formData.get('kelas_id'))
  const hari = Number(formData.get('hari'))
  const jamMasuk = text(formData.get('jam_masuk'))
  const batasTerlambat = text(formData.get('batas_terlambat'))
  const jamPulang = text(formData.get('jam_pulang'))
  const isAktif = formData.get('is_aktif') === 'true'

  if (!kelasId || ![1, 2, 3, 4, 5, 6, 7].includes(hari) || !jamMasuk || !batasTerlambat || !jamPulang) {
    throw new Error('Data jadwal belum lengkap.')
  }
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('jadwal_jam_masuk').upsert({
    kelas_id: kelasId,
    hari,
    jam_masuk: jamMasuk,
    batas_terlambat: batasTerlambat,
    jam_pulang: jamPulang,
    is_aktif: isAktif
  }, { onConflict: 'kelas_id,hari' })

  if (error) throw new Error(error.message)
  revalidatePath('/kelas/jadwal')
}

export async function addHariLibur(formData: FormData) {
  await requireAdmin()
  const tanggal = text(formData.get('tanggal'))
  const keterangan = text(formData.get('keterangan'))

  if (!tanggal || !keterangan) {
    throw new Error('Tanggal dan keterangan hari libur wajib diisi.')
  }

  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('hari_libur').insert({
    tanggal,
    keterangan
  })

  if (error) throw new Error('Gagal menambahkan hari libur: ' + error.message)
  revalidatePath('/kelas/jadwal')
}

export async function deleteHariLibur(formData: FormData) {
  await requireAdmin()
  const tanggal = text(formData.get('tanggal'))

  if (!tanggal) {
    throw new Error('Tanggal hari libur wajib disertakan.')
  }

  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('hari_libur').delete().eq('tanggal', tanggal)

  if (error) throw new Error('Gagal menghapus hari libur: ' + error.message)
  revalidatePath('/kelas/jadwal')
}