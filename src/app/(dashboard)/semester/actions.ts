'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'

function text(value: FormDataEntryValue | null) { return String(value ?? '').trim() }

export async function createSemester(formData: FormData) {
  await requireAdmin()
  const tahunAjaranId = text(formData.get('tahun_ajaran_id'))
  const jenis = text(formData.get('jenis'))
  const tanggalMulai = text(formData.get('tanggal_mulai'))
  const tanggalSelesai = text(formData.get('tanggal_selesai'))
  if (!tahunAjaranId || !['ganjil', 'genap'].includes(jenis) || !tanggalMulai || !tanggalSelesai) throw new Error('Data semester belum lengkap.')
  if (tanggalSelesai <= tanggalMulai) throw new Error('Tanggal selesai harus setelah tanggal mulai.')
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('semester').insert({ tahun_ajaran_id: tahunAjaranId, jenis, tanggal_mulai: tanggalMulai, tanggal_selesai: tanggalSelesai })
  if (error) throw new Error(error.code === '23505' ? 'Semester tersebut sudah ada.' : error.message)
  revalidatePath('/semester')
}

export async function activateSemester(formData: FormData) {
  await requireAdmin()
  const id = text(formData.get('id'))
  if (!id) throw new Error('Semester tidak ditemukan.')
  const supabase = await createClient()
  const { error } = await supabase.rpc('activate_semester', { target_semester_id: id })
  if (error) throw new Error(error.message)
  revalidatePath('/semester')
}