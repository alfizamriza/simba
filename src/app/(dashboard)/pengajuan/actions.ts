'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/auth/require-feature'
import { bisaAjukanPengajuan, bisaApprovePengajuan, type GuruSession } from '@/lib/auth/roles'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

export type PengajuanActionState = { ok: boolean; message: string }

function text(value: FormDataEntryValue | null) { return String(value ?? '').trim() }

function datesBetween(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(`${end}T00:00:00Z`)
  const dates: string[] = []
  for (const cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) dates.push(cursor.toISOString().slice(0, 10))
  return dates
}

const submitPengajuanSchema = z.object({
  siswaId: z.string().uuid('ID siswa tidak valid'),
  tanggalMulai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal mulai harus YYYY-MM-DD'),
  tanggalSelesai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal selesai harus YYYY-MM-DD'),
  jenis: z.enum(['izin', 'sakit']),
  keterangan: z.string().optional()
})

const decidePengajuanSchema = z.object({
  id: z.string().uuid('ID pengajuan tidak valid'),
  status: z.enum(['approved', 'rejected']),
  catatanApproval: z.string().optional()
})

export async function submitPengajuan(_previousState: PengajuanActionState, formData: FormData): Promise<PengajuanActionState> {
  let session: GuruSession
  try {
    session = await requireFeature('pengajuan')
  } catch {
    return { ok: false, message: 'Unauthorized' }
  }
  if (!bisaAjukanPengajuan(session)) return { ok: false, message: 'Anda hanya memiliki akses baca pengajuan.' }

  const siswaId = text(formData.get('siswa_id'))
  const tanggalMulai = text(formData.get('tanggal_mulai'))
  const tanggalSelesai = text(formData.get('tanggal_selesai')) || tanggalMulai
  const jenis = text(formData.get('jenis'))
  const keterangan = text(formData.get('keterangan'))
  const file = formData.get('lampiran')

  const result = submitPengajuanSchema.safeParse({ siswaId, tanggalMulai, tanggalSelesai, jenis, keterangan })
  if (!result.success) {
    return { ok: false, message: result.error.issues[0]?.message ?? 'Data tidak valid' }
  }

  const dates = datesBetween(tanggalMulai, tanggalSelesai)
  if (dates.length > 31) return { ok: false, message: 'Rentang pengajuan maksimal 31 hari.' }

  const supabase = await createClient()
  const { data: semester } = await supabase.from('semester').select('id').eq('is_aktif', true).maybeSingle()
  if (!semester) return { ok: false, message: 'Belum ada semester aktif.' }

  let lampiranUrl: string | null = null
  if (file instanceof File && file.size > 0) {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type) || file.size > 5 * 1024 * 1024) return { ok: false, message: 'Lampiran harus PDF/JPG/PNG/WEBP dan maksimal 5 MB.' }
    const storagePath = `${session.guruId}/${siswaId}/${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const storage = createServiceRoleClient()
    const { error: uploadError } = await storage.storage.from('lampiran-pengajuan').upload(storagePath, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
    if (uploadError) return { ok: false, message: `Upload lampiran gagal: ${uploadError.message}` }
    lampiranUrl = storagePath
  }

  const attendanceRows = dates.map((tanggal) => ({ siswa_id: siswaId, semester_id: semester.id, tanggal, status: jenis, sumber: 'manual', keterangan: keterangan || null, dicatat_oleh: session.guruId, waktu_scan: null }))
  const { error: attendanceError } = await supabase.from('log_absensi').upsert(attendanceRows, { onConflict: 'siswa_id,tanggal' })
  if (attendanceError) return { ok: false, message: `Absensi gagal disimpan: ${attendanceError.message}` }

  const requestRows = dates.map((tanggal) => ({ siswa_id: siswaId, tanggal, jenis, keterangan: keterangan || null, lampiran_url: lampiranUrl, status: 'pending', diajukan_oleh: session.guruId, disetujui_oleh: null }))
  const { error: requestError } = await supabase.from('pengajuan_izin').insert(requestRows)
  if (requestError) return { ok: false, message: `Riwayat pengajuan gagal disimpan: ${requestError.message}` }
  revalidatePath('/pengajuan')
  revalidatePath('/laporan')
  return { ok: true, message: `${dates.length} hari pengajuan berhasil dicatat.` }
}

export async function decidePengajuan(formData: FormData) {
  const session = await requireFeature('pengajuan')
  if (!bisaApprovePengajuan(session)) throw new Error('Anda tidak memiliki hak untuk menyetujui pengajuan.')
  const id = text(formData.get('id'))
  const status = text(formData.get('status'))
  const approvalNote = text(formData.get('catatan_approval'))

  const result = decidePengajuanSchema.safeParse({ id, status, catatanApproval: approvalNote })
  if (!result.success) throw new Error(result.error.issues[0]?.message)

  const supabase = await createClient()
  const { data: request, error: requestError } = await supabase.from('pengajuan_izin').select('id, siswa_id, tanggal, jenis, keterangan, status').eq('id', id).single()
  if (requestError || !request) throw new Error(requestError?.message ?? 'Pengajuan tidak ditemukan.')
  const { error: updateError } = await supabase.from('pengajuan_izin').update({ status, disetujui_oleh: session.guruId, catatan_approval: approvalNote || null }).eq('id', id).eq('status', 'pending')
  if (updateError) throw new Error(updateError.message)
  if (status === 'approved') {
    const { data: semester } = await supabase.from('semester').select('id').eq('is_aktif', true).maybeSingle()
    if (!semester) throw new Error('Belum ada semester aktif.')
    const { error: attendanceError } = await supabase.from('log_absensi').upsert({ siswa_id: request.siswa_id, semester_id: semester.id, tanggal: request.tanggal, status: request.jenis, sumber: 'manual', keterangan: request.keterangan, dicatat_oleh: session.guruId, waktu_scan: null }, { onConflict: 'siswa_id,tanggal' })
    if (attendanceError) throw new Error(attendanceError.message)
  }

  // Catat audit log untuk perubahan keputusan pengajuan
  await writeAuditLog({
    tabel: 'pengajuan_izin',
    recordId: id,
    aksi: 'UPDATE',
    dataSebelum: { status: request.status },
    dataSesudah: { status, catatan_approval: approvalNote || null, disetujui_oleh: session.guruId },
    dilakukanOleh: session.guruId
  })

  revalidatePath('/pengajuan')
  revalidatePath('/laporan')
}
