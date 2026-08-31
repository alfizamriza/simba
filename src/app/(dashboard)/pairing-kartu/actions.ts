'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

function text(value: FormDataEntryValue | null) { return String(value ?? '').trim() }

export type PairActionState = { ok: boolean; message: string }

const pairKartuSchema = z.object({
  uidKartu: z.string().transform((val) => val.trim().toUpperCase().replace(/\s+/g, ' ')).refine((val) => val.length > 0, 'UID kartu wajib diisi'),
  siswaId: z.string().uuid('ID siswa tidak valid')
})

export async function pairKartu(_previousState: PairActionState, formData: FormData): Promise<PairActionState> {
  let admin: any
  try {
    admin = await requireAdmin()
  } catch {
    return { ok: false, message: 'Unauthorized' }
  }

  const rawUid = text(formData.get('uid_kartu'))
  const rawSiswaId = text(formData.get('siswa_id'))

  const result = pairKartuSchema.safeParse({ uidKartu: rawUid, siswaId: rawSiswaId })
  if (!result.success) {
    const errorMsg = result.error.issues[0]?.message ?? 'Data tidak valid'
    return { ok: false, message: errorMsg }
  }

  const { uidKartu, siswaId } = result.data

  const supabase = createServiceRoleClient()

  // Ambil data siswa untuk audit log
  const { data: siswa } = await supabase.from('siswa').select('nama').eq('id', siswaId).maybeSingle()

  const { data: existing } = await supabase.from('kartu_rfid').select('id').eq('uid_kartu', uidKartu).maybeSingle()
  if (existing) return { ok: false, message: 'UID kartu sudah terdaftar pada siswa lain.' }

  const { data: kartu, error } = await supabase
    .from('kartu_rfid')
    .insert({ uid_kartu: uidKartu, siswa_id: siswaId, didaftarkan_oleh: admin.guruId })
    .select('id')
    .single()

  if (error) return { ok: false, message: error.code === '23505' ? 'UID kartu sudah dipasangkan.' : error.message }

  // Hapus dari pairing_requests jika ada
  await supabase.from('pairing_requests').delete().eq('uid_kartu', uidKartu)

  // Catat audit log untuk pairing
  await writeAuditLog({
    tabel: 'kartu_rfid',
    recordId: kartu.id,
    aksi: 'INSERT',
    dataSesudah: { uid_kartu: uidKartu, siswa_id: siswaId, siswa_nama: siswa?.nama },
    dilakukanOleh: admin.guruId
  })

  revalidatePath('/pairing-kartu')
  return { ok: true, message: 'Kartu berhasil dipasangkan.' }
}

const statusKartuSchema = z.object({
  id: z.string().uuid('ID kartu tidak valid'),
  isAktif: z.boolean()
})

export async function setKartuStatus(formData: FormData) {
  const admin = await requireAdmin()
  const id = text(formData.get('id'))
  const isAktif = formData.get('is_aktif') === 'true'

  const result = statusKartuSchema.safeParse({ id, isAktif })
  if (!result.success) throw new Error(result.error.issues[0]?.message)

  const supabase = createServiceRoleClient()

  // Ambil status sebelum untuk audit log
  const { data: oldKartu } = await supabase.from('kartu_rfid').select('is_aktif, uid_kartu, siswa_id').eq('id', id).single()

  const { error } = await supabase.from('kartu_rfid').update({ is_aktif: isAktif }).eq('id', id)
  if (error) throw new Error(error.message)

  // Catat audit log untuk perubahan status (nonaktifkan / aktifkan)
  await writeAuditLog({
    tabel: 'kartu_rfid',
    recordId: id,
    aksi: 'UPDATE',
    dataSebelum: { is_aktif: oldKartu?.is_aktif },
    dataSesudah: { is_aktif: isAktif },
    dilakukanOleh: admin.guruId
  })

  revalidatePath('/pairing-kartu')
}

const unpairKartuSchema = z.object({
  id: z.string().uuid('ID kartu tidak valid')
})

export async function unpairKartu(formData: FormData) {
  const admin = await requireAdmin()
  const id = text(formData.get('id'))

  const result = unpairKartuSchema.safeParse({ id })
  if (!result.success) throw new Error(result.error.issues[0]?.message)

  const supabase = createServiceRoleClient()

  // Ambil info sebelum hapus
  const { data: oldKartu } = await supabase.from('kartu_rfid').select('uid_kartu, siswa_id').eq('id', id).single()

  const { error } = await supabase.from('kartu_rfid').delete().eq('id', id)
  if (error) throw new Error(error.message)

  // Catat audit log
  await writeAuditLog({
    tabel: 'kartu_rfid',
    recordId: id,
    aksi: 'DELETE',
    dataSebelum: oldKartu,
    dilakukanOleh: admin.guruId
  })

  revalidatePath('/pairing-kartu')
}