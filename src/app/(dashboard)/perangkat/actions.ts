'use server'

import { createHash, randomBytes, randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { decryptDeviceKey, encryptDeviceKey } from '@/lib/iot/device-secrets'

export type DeviceActionState = { ok: boolean; message: string; deviceId: string | null; apiKey: string | null }
const emptyState: DeviceActionState = { ok: false, message: '', deviceId: null, apiKey: null }
function text(value: FormDataEntryValue | null) { return String(value ?? '').trim() }

export async function createPerangkat(_previousState: DeviceActionState, formData: FormData): Promise<DeviceActionState> {
  await requireAdmin()
  const nama = text(formData.get('nama'))
  if (!nama) return { ...emptyState, message: 'Nama atau lokasi perangkat wajib diisi.' }
  const deviceId = `dev_${randomUUID()}`
  const apiKey = randomBytes(32).toString('hex')
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('perangkat_iot').insert({ device_id: deviceId, nama, api_key_hash: createHash('sha256').update(apiKey).digest('hex'), api_key_encrypted: encryptDeviceKey(apiKey) })
  if (error) return { ...emptyState, message: error.message }
  revalidatePath('/perangkat')
  return { ok: true, message: 'Perangkat berhasil dibuat. Simpan API key sekarang.', deviceId, apiKey }
}

export async function regeneratePerangkat(_previousState: DeviceActionState, formData: FormData): Promise<DeviceActionState> {
  await requireAdmin()
  const id = text(formData.get('id'))
  if (!id) return { ...emptyState, message: 'Perangkat tidak ditemukan.' }
  const apiKey = randomBytes(32).toString('hex')
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('perangkat_iot').update({ api_key_hash: createHash('sha256').update(apiKey).digest('hex'), api_key_encrypted: encryptDeviceKey(apiKey) }).eq('id', id)
  if (error) return { ...emptyState, message: error.message }
  revalidatePath('/perangkat')
  return { ok: true, message: 'API key baru aktif. Key lama sudah tidak berlaku.', deviceId: null, apiKey }
}

export async function revealPerangkat(_previousState: DeviceActionState, formData: FormData): Promise<DeviceActionState> {
  await requireAdmin()
  const id = text(formData.get('id'))
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.from('perangkat_iot').select('device_id, api_key_encrypted').eq('id', id).single()
  if (error || !data?.api_key_encrypted) return { ...emptyState, message: 'API key belum tersedia. Regenerate API key terlebih dahulu.' }
  try {
    return { ok: true, message: 'API key ditampilkan.', deviceId: data.device_id, apiKey: decryptDeviceKey(data.api_key_encrypted) }
  } catch {
    return { ...emptyState, message: 'API key terenkripsi tidak dapat dibaca.' }
  }
}

export async function setPerangkatStatus(formData: FormData) {
  await requireAdmin()
  const id = text(formData.get('id'))
  const isAktif = formData.get('is_aktif') === 'true'
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('perangkat_iot').update({ is_aktif: isAktif }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/perangkat')
}
