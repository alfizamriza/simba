import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import { z } from 'zod'

const pairingBodySchema = z.object({
  uid_kartu: z.string().transform((val) => val.trim().toUpperCase().replace(/\s+/g, ' ')),
  device_id: z.string().optional()
})

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-device-key') ?? request.headers.get('x-api-key')
  if (!apiKey) {
    return NextResponse.json({ sukses: false, pesan: 'API key tidak ada' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ sukses: false, pesan: 'Body JSON tidak valid' }, { status: 400 })
  }

  const result = pairingBodySchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ sukses: false, pesan: 'Format data tidak valid', error: result.error.format() }, { status: 400 })
  }

  const { uid_kartu, device_id } = result.data

  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex')
  const supabase = createServiceRoleClient()

  // 1. Validasi perangkat
  let query = supabase
    .from('perangkat_iot')
    .select('id, is_aktif')
    .eq('api_key_hash', apiKeyHash)

  if (device_id) {
    query = query.eq('device_id', device_id)
  }

  const { data: perangkat, error: perangkatError } = await query.maybeSingle()

  if (perangkatError || !perangkat || !perangkat.is_aktif) {
    return NextResponse.json({ sukses: false, pesan: 'Perangkat tidak dikenali atau tidak aktif' }, { status: 401 })
  }

  const sekarang = new Date().toISOString()

  // Update last seen perangkat
  await supabase.from('perangkat_iot').update({ last_seen_at: sekarang }).eq('id', perangkat.id)

  // 2. Insert ke pairing_requests (hapus yang lama agar memicu event INSERT real-time)
  await supabase.from('pairing_requests').delete().eq('uid_kartu', uid_kartu)
  
  const { error: insertError } = await supabase.from('pairing_requests').insert({
    perangkat_id: perangkat.id,
    uid_kartu,
    created_at: sekarang
  })

  if (insertError) {
    return NextResponse.json({ sukses: false, pesan: 'Gagal memasukkan kartu ke antrean pairing: ' + insertError.message }, { status: 500 })
  }

  return NextResponse.json({ sukses: true, pesan: 'Kartu masuk ke antrean pairing' })
}
