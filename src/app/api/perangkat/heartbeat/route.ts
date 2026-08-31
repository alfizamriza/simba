import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import { z } from 'zod'

const heartbeatBodySchema = z.object({
  device_id: z.string().optional()
})

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-device-key') ?? request.headers.get('x-api-key')
  if (!apiKey) {
    return NextResponse.json({ sukses: false, pesan: 'API key tidak ada' }, { status: 401 })
  }

  let body: any = {}
  try {
    const raw = await request.text()
    if (raw) {
      body = JSON.parse(raw)
    }
  } catch {
    // Ignore JSON parsing issues, continue validation using apiKey headers
  }

  const result = heartbeatBodySchema.safeParse(body)
  const device_id = result.success ? result.data.device_id : undefined

  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex')
  const supabase = createServiceRoleClient()

  // Validasi perangkat
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

  // Update last_seen_at
  const { error: updateError } = await supabase
    .from('perangkat_iot')
    .update({ last_seen_at: sekarang })
    .eq('id', perangkat.id)

  if (updateError) {
    return NextResponse.json({ sukses: false, pesan: 'Gagal memperbarui detak jantung: ' + updateError.message }, { status: 500 })
  }

  return NextResponse.json({ sukses: true, pesan: 'Detak jantung diterima' })
}
