'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/auth/require-feature'
import { requireAdmin } from '@/lib/auth/require-admin'
import { bisaEdit, isAdmin } from '@/lib/auth/roles'
import { writeAuditLog } from '@/lib/audit'

function text(value: FormDataEntryValue | null) { return String(value ?? '').trim() }

export async function saveSiswa(formData: FormData) {
  const session = await requireFeature('siswa')
  const id = text(formData.get('id'))
  const nis = text(formData.get('nis'))
  const nama = text(formData.get('nama'))
  const kelasId = text(formData.get('kelas_id')) || null
  if (!bisaEdit(session)) throw new Error('Anda hanya memiliki akses baca data siswa.')
  if (!id && !isAdmin(session)) throw new Error('Hanya admin yang boleh menambah siswa baru.')
  if (!nis || !nama) throw new Error('NIS dan nama siswa wajib diisi.')

  const supabase = await createClient()
  const query = id
    ? supabase.from('siswa').update({ nis, nama, kelas_id: kelasId }).eq('id', id)
    : supabase.from('siswa').insert({ nis, nama, kelas_id: kelasId })
  const { error } = await query
  if (error) throw new Error(error.code === '23505' ? 'NIS sudah terdaftar.' : error.message)
  revalidatePath('/siswa')
}

export async function setSiswaStatus(formData: FormData) {
  const session = await requireFeature('siswa')
  const id = text(formData.get('id'))
  const isAktif = formData.get('is_aktif') === 'true'
  if (!bisaEdit(session)) throw new Error('Anda hanya memiliki akses baca data siswa.')
  if (!id) throw new Error('Siswa tidak ditemukan.')
  const supabase = await createClient()
  const { error } = await supabase.from('siswa').update({ is_aktif: isAktif }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/siswa')
}

export type ImportSiswaState = { ok: boolean; message: string }

export async function importSiswa(_previousState: ImportSiswaState, formData: FormData): Promise<ImportSiswaState> {
  await requireAdmin()
  const rawRows = String(formData.get('rows_json') ?? '')
  try {
    const rows = JSON.parse(rawRows) as { nis?: string; nama?: string; kelas?: string }[]
    if (!rows.length || rows.length > 2000) return { ok: false, message: 'File kosong atau melebihi 2.000 baris.' }
    const supabase = createServiceRoleClient()
    const { data: classes } = await supabase.from('kelas').select('id, nama')
    const classMap = new Map((classes ?? []).map((item) => [item.nama.toLowerCase(), item.id]))
    const records = rows.map((row) => ({ nis: String(row.nis ?? '').trim(), nama: String(row.nama ?? '').trim(), kelas_id: row.kelas ? classMap.get(row.kelas.trim().toLowerCase()) ?? null : null })).filter((row) => row.nis && row.nama)
    if (!records.length) return { ok: false, message: 'Kolom NIS dan nama tidak menghasilkan data valid.' }
    const { error } = await supabase.from('siswa').upsert(records, { onConflict: 'nis' })
    if (error) return { ok: false, message: error.message }
    revalidatePath('/siswa')
    return { ok: true, message: `${records.length} siswa berhasil diimport.` }
  } catch {
    return { ok: false, message: 'Format data import tidak valid.' }
  }
}

export async function pindahkanSiswaMassal(siswaIds: string[], kelasIdTujuan: string) {
  const session = await requireFeature('siswa')
  if (!bisaEdit(session)) {
    return { sukses: false, pesan: 'Anda tidak memiliki hak akses untuk memindahkan siswa.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('siswa')
    .update({ kelas_id: kelasIdTujuan || null })
    .in('id', siswaIds)
    .select('id')

  if (error) {
    return { sukses: false, pesan: 'Gagal memindahkan siswa: ' + error.message }
  }

  await writeAuditLog({
    tabel: 'siswa',
    recordId: kelasIdTujuan || 'unassigned',
    aksi: 'bulk_update_kelas',
    dataSesudah: { siswa_ids: siswaIds, kelas_id_tujuan: kelasIdTujuan },
    dilakukanOleh: session.guruId,
  })

  revalidatePath('/siswa')
  return { sukses: true, pesan: `${data?.length ?? 0} siswa berhasil dipindahkan.` }
}
