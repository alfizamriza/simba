import { createServiceRoleClient } from '@/lib/supabase/server'

interface AuditLogPayload {
  tabel: string
  recordId: string
  aksi: 'INSERT' | 'UPDATE' | 'DELETE' | string
  dataSebelum?: any
  dataSesudah?: any
  dilakukanOleh: string
}

export async function writeAuditLog(payload: AuditLogPayload) {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('audit_log').insert({
    tabel: payload.tabel,
    record_id: payload.recordId,
    aksi: payload.aksi,
    data_sebelum: payload.dataSebelum || null,
    data_sesudah: payload.dataSesudah || null,
    dilakukan_oleh: payload.dilakukanOleh,
  })
  if (error) {
    console.error('Gagal menulis audit log:', error)
  }
}
