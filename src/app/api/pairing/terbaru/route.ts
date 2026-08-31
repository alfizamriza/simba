import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Pastikan user terautentikasi (guru)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ sukses: false, pesan: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const perangkatId = searchParams.get('perangkat_id')
  const deviceId = searchParams.get('device_id')

  const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString()
  let query = supabase
    .from('pairing_requests')
    .select('uid_kartu, created_at')
    .gte('created_at', thirtySecondsAgo)
    .order('created_at', { ascending: false })
    .limit(1)

  if (perangkatId) {
    query = query.eq('perangkat_id', perangkatId)
  } else if (deviceId) {
    // Resolve device_id ke perangkat_id
    const { data: dev } = await supabase.from('perangkat_iot').select('id').eq('device_id', deviceId).maybeSingle()
    if (dev) {
      query = query.eq('perangkat_id', dev.id)
    } else {
      return NextResponse.json({ sukses: true, uid_kartu: null })
    }
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    return NextResponse.json({ sukses: false, pesan: error.message }, { status: 500 })
  }

  return NextResponse.json({ sukses: true, uid_kartu: data?.uid_kartu ?? null })
}
