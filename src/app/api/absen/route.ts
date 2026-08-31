import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

// Endpoint ini dipanggil oleh ESP32 setiap kali ada kartu di-tap.
// Body yang diharapkan: { "uid_kartu": "AA BB CC DD" }
// Header yang diharapkan: "x-api-key": "<api key perangkat>"

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-device-key') ?? request.headers.get('x-api-key')
  if (!apiKey) {
    return NextResponse.json({ sukses: false, pesan: 'API key tidak ada' }, { status: 401 })
  }

  const body = await request.json()
  const deviceId = String(body.device_id ?? '').trim()
  const uidKartu = String(body.uid_kartu ?? '').trim().toUpperCase().replace(/\s+/g, ' ')
  if (!uidKartu) {
    return NextResponse.json({ sukses: false, pesan: 'uid_kartu wajib diisi' }, { status: 400 })
  }

  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex')
  const supabase = createServiceRoleClient()

  // 1. Validasi perangkat
  let query = supabase
    .from('perangkat_iot')
    .select('id, is_aktif')
    .eq('api_key_hash', apiKeyHash)

  if (deviceId) {
    query = query.eq('device_id', deviceId)
  }

  const { data: perangkat, error: perangkatError } = await query.maybeSingle()

  if (perangkatError || !perangkat || !perangkat.is_aktif) {
    return NextResponse.json({ sukses: false, pesan: 'Perangkat tidak dikenali atau tidak aktif' }, { status: 401 })
  }

  const sekarangUTC = new Date()
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const formatted = formatter.format(sekarangUTC).replace(' ', 'T')
  const sekarang = new Date(formatted + '+07:00')
  const tanggalJakarta = formatted.split('T')[0]

  await supabase.from('perangkat_iot').update({ last_seen_at: sekarangUTC.toISOString() }).eq('id', perangkat.id)
  await supabase.from('tap_log').insert({ uid_kartu: uidKartu, perangkat_id: perangkat.id })

  // 2. Cari siswa dari UID kartu
  const { data: kartu } = await supabase
    .from('kartu_rfid')
    .select('siswa_id, is_aktif')
    .eq('uid_kartu', uidKartu)
    .single()

  if (!kartu || !kartu.is_aktif) {
    // Hapus request pairing lama (jika ada) dan masukkan kembali untuk memicu event INSERT di Supabase Realtime
    await supabase.from('pairing_requests').delete().eq('uid_kartu', uidKartu)
    await supabase.from('pairing_requests').insert({
      perangkat_id: perangkat.id,
      uid_kartu: uidKartu,
      created_at: sekarangUTC.toISOString()
    })

    return NextResponse.json({ sukses: false, pesan: 'Kartu tidak terdaftar' }, { status: 404 })
  }

  // 3. Ambil semester aktif
  const { data: semesterAktif } = await supabase
    .from('semester')
    .select('id')
    .eq('is_aktif', true)
    .single()

  if (!semesterAktif) {
    return NextResponse.json({ sukses: false, pesan: 'Tidak ada semester aktif' }, { status: 500 })
  }

  // 4. Cari kelas siswa untuk mencocokkan jadwal sekolah
  const { data: siswa } = await supabase
    .from('siswa')
    .select('kelas_id')
    .eq('id', kartu.siswa_id)
    .single()

  if (!siswa || !siswa.kelas_id) {
    return NextResponse.json({ sukses: false, pesan: 'Siswa tidak terdaftar di kelas manapun' }, { status: 400 })
  }

  // Tentukan hari dalam database (1 = Senin, ..., 7 = Minggu)
  const jsDay = sekarang.getDay()
  const hariDb = jsDay === 0 ? 7 : jsDay

  // Ambil jadwal jam masuk kelas siswa untuk hari ini
  const { data: jadwal } = await supabase
    .from('jadwal_jam_masuk')
    .select('jam_masuk, batas_terlambat, jam_pulang, is_aktif')
    .eq('kelas_id', siswa.kelas_id)
    .eq('hari', hariDb)
    .maybeSingle()

  if (!jadwal || !jadwal.is_aktif) {
    return NextResponse.json({ sukses: false, pesan: 'Hari libur / bukan hari sekolah' }, { status: 400 })
  }

  // Cek tanggal merah / hari libur nasional secara defensif (jika tabel hari_libur ada)
  const { data: libur, error: liburError } = await supabase
    .from('hari_libur')
    .select('keterangan')
    .eq('tanggal', tanggalJakarta)
    .maybeSingle()

  if (!liburError && libur) {
    return NextResponse.json({ sukses: false, pesan: `Hari libur nasional: ${libur.keterangan}` }, { status: 400 })
  }

  const jamSekarang = sekarang.getHours()
  const menitSekarang = sekarang.getMinutes()
  const waktuSekarangMenit = jamSekarang * 60 + menitSekarang

  // Batas akhir siswa boleh absen masuk adalah jam pulang kelas untuk hari ini (default 15:00)
  const [pulangH, pulangM] = (jadwal.jam_pulang ?? '15:00').split(':').map(Number)
  const BATAS_ABSEN_TUTUP_MENIT = pulangH * 60 + pulangM

  if (waktuSekarangMenit > BATAS_ABSEN_TUTUP_MENIT) {
    return NextResponse.json({ sukses: false, pesan: 'Absensi hari ini sudah ditutup (luar jam sekolah)' }, { status: 400 })
  }

  // Cek apakah data absensi siswa untuk hari ini sudah ada
  const { data: absensiHariIni } = await supabase
    .from('log_absensi')
    .select('id')
    .eq('siswa_id', kartu.siswa_id)
    .eq('tanggal', tanggalJakarta)
    .maybeSingle()

  if (absensiHariIni) {
    return NextResponse.json({ sukses: false, pesan: 'Siswa sudah absen masuk hari ini' }, { status: 409 })
  }

  // Tentukan status masuk: terlambat atau hadir
  const [batasH, batasM] = jadwal.batas_terlambat.split(':').map(Number)
  const batasTerlambatMenit = batasH * 60 + batasM

  const status = waktuSekarangMenit > batasTerlambatMenit ? 'terlambat' : 'hadir'

  const { error: insertError } = await supabase
    .from('log_absensi')
    .insert({
      siswa_id: kartu.siswa_id,
      semester_id: semesterAktif.id,
      tanggal: tanggalJakarta,
      waktu_scan: sekarangUTC.toISOString(),
      status,
      sumber: 'rfid'
    })

  if (insertError) {
    return NextResponse.json({ sukses: false, pesan: 'Gagal menyimpan absensi: ' + insertError.message }, { status: 500 })
  }

  return NextResponse.json({ sukses: true, pesan: `Absen berhasil: ${status}`, status })
}
