import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/auth/require-feature'
import { getVisibleClassIds } from '@/lib/auth/roles'

type StudentRow = { id: string; nama: string; kelas_id: string | null }
type ClassRow = { id: string; nama: string }
type AttendanceStudent = { nama: string; kelas_id: string | null }
type LateStudent = { nama: string; kelas?: { nama: string } | { nama: string }[] | null }
type AttendanceRow = { status: string; siswa_id: string; siswa?: AttendanceStudent | AttendanceStudent[] | null }
type LateRow = { siswa_id: string; siswa?: LateStudent | LateStudent[] | null }

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export default async function DashboardPage() {
  const session = await requireFeature('dashboard')
  const supabase = createServiceRoleClient()
  const visibleClassIds = getVisibleClassIds(session)
  const emptyClassId = '00000000-0000-0000-0000-000000000000'
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
  const hariIni = formatted.split('T')[0]
  const { data: semesterAktif } = await supabase.from('semester').select('id').eq('is_aktif', true).maybeSingle()

  const classQuery = supabase.from('kelas').select('id, nama').order('nama')
  if (visibleClassIds) classQuery.in('id', visibleClassIds.length ? visibleClassIds : [emptyClassId])
  const { data: kelasTerlihat } = await classQuery
  const visibleClasses = (kelasTerlihat ?? []) as ClassRow[]
  const classMap = new Map(visibleClasses.map((item) => [item.id, item.nama]))

  // Ambil rekap status hari ini beserta nama dan ID siswa, serta semua siswa aktif untuk perhitungan alpa otomatis
  let studentQuery = supabase.from('siswa').select('id, nama, kelas_id').eq('is_aktif', true)
  if (visibleClassIds) studentQuery = studentQuery.in('kelas_id', visibleClassIds.length ? visibleClassIds : [emptyClassId])

  const [{ data: semuaSiswa }, { data: rekap }] = await Promise.all([
    studentQuery,
    supabase
      .from('log_absensi')
      .select('status, siswa_id, siswa(nama, kelas_id)')
      .eq('semester_id', semesterAktif?.id ?? '00000000-0000-0000-0000-000000000000')
      .eq('tanggal', hariIni),
  ])
  const students = (semuaSiswa ?? []) as StudentRow[]
  const studentIds = new Set(students.map((student) => student.id))
  const attendanceRows = ((rekap ?? []) as unknown as AttendanceRow[]).filter((row) => studentIds.has(row.siswa_id))

  const displayStudent = (student: { nama: string; kelas_id: string | null }) => {
    const kelas = student.kelas_id ? classMap.get(student.kelas_id) : null
    return kelas ? `${student.nama} - Kelas ${kelas}` : `${student.nama} - Belum berkelas`
  }

  // Cari siswa yang belum absen sama sekali hari ini (Tanpa Keterangan / Alpa)
  const siswaSudahAbsenIds = new Set(attendanceRows.map((r) => r.siswa_id).filter(Boolean))
  const siswaAlpa = students.filter((s) => !siswaSudahAbsenIds.has(s.id)).map(displayStudent)

  const hitung = (status: string) => {
    if (status === 'alpa') {
      return siswaAlpa.length
    }
    return attendanceRows.filter((r) => r.status === status).length
  }

  const getSiswaList = (status: string) => {
    if (status === 'alpa') {
      return siswaAlpa
    }
    return attendanceRows
      ?.filter((r) => r.status === status)
      .map((r) => {
        const student = firstRelation(r.siswa)
        return student ? displayStudent(student) : null
      })
      .filter(Boolean) as string[] ?? []
  }

  // Konfigurasi ringkasan sesuai palet warna status SIMBA (tanpa gradasi, border tipis, indikator vertikal)
  const ringkasan = [
    {
      label: 'Hadir',
      jumlah: hitung('hadir'),
      siswaList: getSiswaList('hadir'),
      color: '#0F766E', // Tosca-700
      badgeBg: 'bg-[#0F766E]/10 text-[#0F766E] border-[#0F766E]/20'
    },
    {
      label: 'Terlambat',
      jumlah: hitung('terlambat'),
      siswaList: getSiswaList('terlambat'),
      color: '#B45309', // Amber gelap
      badgeBg: 'bg-[#B45309]/10 text-[#B45309] border-[#B45309]/20'
    },
    {
      label: 'Sakit',
      jumlah: hitung('sakit'),
      siswaList: getSiswaList('sakit'),
      color: '#0369A1', // Biru slate
      badgeBg: 'bg-[#0369A1]/10 text-[#0369A1] border-[#0369A1]/20'
    },
    {
      label: 'Izin',
      jumlah: hitung('izin'),
      siswaList: getSiswaList('izin'),
      color: '#6D28D9', // Ungu redup
      badgeBg: 'bg-[#6D28D9]/10 text-[#6D28D9] border-[#6D28D9]/20'
    },
    {
      label: 'Tanpa Keterangan',
      jumlah: hitung('alpa'),
      siswaList: getSiswaList('alpa'),
      color: '#B91C1C', // Merah bata gelap
      badgeBg: 'bg-[#B91C1C]/10 text-[#B91C1C] border-[#B91C1C]/20'
    },
  ]

  // Siswa yang paling sering terlambat bulan ini
  const awalBulan = new Date()
  awalBulan.setDate(1)
  let lateQuery = supabase
    .from('log_absensi')
    .select('siswa_id, siswa(nama, kelas:kelas_id(nama))')
    .eq('semester_id', semesterAktif?.id ?? '00000000-0000-0000-0000-000000000000')
    .eq('status', 'terlambat')
    .gte('tanggal', awalBulan.toISOString().split('T')[0])
  if (studentIds.size) lateQuery = lateQuery.in('siswa_id', Array.from(studentIds))
  else lateQuery = lateQuery.in('siswa_id', [emptyClassId])
  const { data: seringTerlambat } = await lateQuery

  const rekapTerlambat = new Map<string, { nama: string; kelas: string; jumlah: number }>()
  ;((seringTerlambat ?? []) as unknown as LateRow[]).forEach((row) => {
    const key = row.siswa_id
    const student = firstRelation(row.siswa)
    const kelas = firstRelation(student?.kelas)
    const existing = rekapTerlambat.get(key)
    if (existing) {
      existing.jumlah += 1
    } else {
      rekapTerlambat.set(key, {
        nama: student?.nama ?? '-',
        kelas: kelas?.nama ?? '-',
        jumlah: 1,
      })
    }
  })

  const topTerlambat = Array.from(rekapTerlambat.values())
    .sort((a, b) => b.jumlah - a.jumlah)
    .slice(0, 5)

  const tanggalFormatted = sekarang.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="space-y-6">

      {/* Header Section */}
      <div className="flex flex-col gap-3 border-b border-[#DCE4E2] pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#0B4F49] sm:text-2xl">
            Ringkasan Absensi
          </h1>
          <p className="text-sm text-[#5B6B68]">
            Laporan kehadiran siswa harian dan evaluasi bulanan.
          </p>
          <p className="mt-1 text-[11px] font-medium text-[#0F766E]">
            Kelas terlihat: {visibleClasses.map((item) => item.nama).join(', ') || 'Belum ada kelas yang ditugaskan'}
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs font-medium text-[#1C2321] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {/* Signature Dot/Indicator */}
          <span className="h-1.5 w-1.5 rounded-full bg-[#0F766E]"></span>
          {tanggalFormatted}
        </div>
      </div>

      {/* Metric Cards Grid - Flat design dengan border konsisten dan garis indikator vertikal */}
      <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 md:grid-cols-5">
        {ringkasan.map((item) => (
          <div
            key={item.label}
            className="relative overflow-hidden rounded-[8px] border border-[#DCE4E2] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-[#0F766E]/50 sm:p-5"
          >
            {/* Signature Element: Garis vertikal tipis di sisi kiri sesuai warna status */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ backgroundColor: item.color }}
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5B6B68]">
                {item.label}
              </span>
              <span className={`inline-block rounded-[4px] border px-2 py-0.5 text-[10px] font-semibold ${item.badgeBg}`}>
                Status
              </span>
            </div>
            <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-[#1C2321]">
              {item.jumlah}
            </p>

            {/* Menampilkan daftar nama siswa untuk status Sakit, Izin, Terlambat, dan Tanpa Keterangan */}
            {item.label !== 'Hadir' && item.siswaList && item.siswaList.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Siswa:</p>
                <ul className="text-xs text-slate-600 space-y-1 max-h-24 overflow-y-auto pr-1">
                  {item.siswaList.map((nama, idx) => (
                    <li key={idx} className="truncate font-semibold text-[#1C2321]" title={nama}>
                      • {nama}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>      {/* Grid untuk Informasi Detail Hari Ini & Evaluasi Bulanan */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Detail Ketidakhadiran & Keterlambatan Hari Ini */}
        <div className="rounded-[8px] border border-[#DCE4E2] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#DCE4E2] bg-[#F7FAF9] px-4 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-bold text-[#0B4F49]">
                Detail Kehadiran Hari Ini
              </h2>
              <p className="text-xs text-[#5B6B68]">
                Daftar siswa terlambat, sakit, izin, atau tanpa keterangan hari ini
              </p>
            </div>
            <span className="rounded-[4px] border border-[#0F766E]/20 bg-[#E4F5F3] px-2.5 py-1 text-xs font-semibold text-[#0F766E]">
              Real-time
            </span>
          </div>

          <div className="p-4 sm:p-6">
            {attendanceRows.filter((r) => r.status !== 'hadir').length === 0 && siswaAlpa.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-[#5B6B68]">
                  Semua siswa hadir tepat waktu hari ini. Nilai kehadiran sempurna!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {/* Kolom Keterlambatan */}
                <div className="rounded-[6px] border border-[#DCE4E2] bg-[#F7FAF9] p-3 space-y-2">
                  <h3 className="text-xs font-bold text-[#B45309] border-b border-[#B45309]/10 pb-1.5 flex justify-between items-center">
                    <span>Terlambat</span>
                    <span className="rounded-full bg-[#B45309]/10 px-2 py-0.5 text-[10px]">{getSiswaList('terlambat').length}</span>
                  </h3>
                  {getSiswaList('terlambat').length === 0 ? (
                    <p className="text-[11px] text-[#5B6B68] italic">Tidak ada siswa terlambat.</p>
                  ) : (
                    <ul className="text-xs text-[#1C2321] space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {getSiswaList('terlambat').map((nama, idx) => (
                        <li key={idx} className="flex items-center gap-1.5 truncate" title={nama}>
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#B45309]"></span>
                          <span className="font-semibold truncate">{nama}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Kolom Sakit */}
                <div className="rounded-[6px] border border-[#DCE4E2] bg-[#F7FAF9] p-3 space-y-2">
                  <h3 className="text-xs font-bold text-[#0369A1] border-b border-[#0369A1]/10 pb-1.5 flex justify-between items-center">
                    <span>Sakit</span>
                    <span className="rounded-full bg-[#0369A1]/10 px-2 py-0.5 text-[10px]">{getSiswaList('sakit').length}</span>
                  </h3>
                  {getSiswaList('sakit').length === 0 ? (
                    <p className="text-[11px] text-[#5B6B68] italic">Tidak ada siswa sakit.</p>
                  ) : (
                    <ul className="text-xs text-[#1C2321] space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {getSiswaList('sakit').map((nama, idx) => (
                        <li key={idx} className="flex items-center gap-1.5 truncate" title={nama}>
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0369A1]"></span>
                          <span className="font-semibold truncate">{nama}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Kolom Izin */}
                <div className="rounded-[6px] border border-[#DCE4E2] bg-[#F7FAF9] p-3 space-y-2">
                  <h3 className="text-xs font-bold text-[#6D28D9] border-b border-[#6D28D9]/10 pb-1.5 flex justify-between items-center">
                    <span>Izin</span>
                    <span className="rounded-full bg-[#6D28D9]/10 px-2 py-0.5 text-[10px]">{getSiswaList('izin').length}</span>
                  </h3>
                  {getSiswaList('izin').length === 0 ? (
                    <p className="text-[11px] text-[#5B6B68] italic">Tidak ada siswa izin.</p>
                  ) : (
                    <ul className="text-xs text-[#1C2321] space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {getSiswaList('izin').map((nama, idx) => (
                        <li key={idx} className="flex items-center gap-1.5 truncate" title={nama}>
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#6D28D9]"></span>
                          <span className="font-semibold truncate">{nama}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Kolom Tanpa Keterangan (Alpa) */}
                <div className="rounded-[6px] border border-[#DCE4E2] bg-[#F7FAF9] p-3 space-y-2">
                  <h3 className="text-xs font-bold text-[#B91C1C] border-b border-[#B91C1C]/10 pb-1.5 flex justify-between items-center">
                    <span>Tanpa Keterangan</span>
                    <span className="rounded-full bg-[#B91C1C]/10 px-2 py-0.5 text-[10px]">{getSiswaList('alpa').length}</span>
                  </h3>
                  {getSiswaList('alpa').length === 0 ? (
                    <p className="text-[11px] text-[#5B6B68] italic">Tidak ada alpa.</p>
                  ) : (
                    <ul className="text-xs text-[#1C2321] space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {getSiswaList('alpa').map((nama, idx) => (
                        <li key={idx} className="flex items-center gap-1.5 truncate" title={nama}>
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#B91C1C]"></span>
                          <span className="font-semibold truncate">{nama}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Siswa Sering Terlambat Bulan Ini */}
        <div className="rounded-[8px] border border-[#DCE4E2] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[#DCE4E2] bg-[#F7FAF9] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-base font-bold text-[#0B4F49]">
                Siswa Sering Terlambat
              </h2>
              <p className="text-xs text-[#5B6B68]">
                Top 5 siswa dengan frekuensi keterlambatan tertinggi bulan ini
              </p>
            </div>
            <span className="rounded-[4px] border border-[#DCE4E2] bg-white px-2.5 py-1 text-xs font-semibold text-[#5B6B68]">
              Bulan Ini
            </span>
          </div>

          <div className="p-4 sm:p-6">
            {topTerlambat.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-[#5B6B68]">
                  Tidak ada data keterlambatan yang tercatat bulan ini.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] text-left text-sm text-[#1C2321]">
                  <thead>
                    <tr className="border-b border-[#DCE4E2] text-xs font-semibold uppercase tracking-wider text-[#5B6B68]">
                      <th scope="col" className="pb-3 pl-2">Nama Siswa</th>
                      <th scope="col" className="pb-3">Kelas</th>
                      <th scope="col" className="pb-3 pr-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE4E2]">
                    {topTerlambat.map((s, i) => (
                      <tr key={i} className="transition-colors hover:bg-[#F7FAF9]">
                        <td className="py-3.5 pl-2 font-medium text-[#1C2321]">{s.nama}</td>
                        <td className="py-3.5 text-[#5B6B68]">{s.kelas}</td>
                        <td className="py-3.5 pr-2 text-right">
                          <span className="inline-flex items-center gap-1 rounded-[4px] border border-[#B45309]/20 bg-[#B45309]/10 px-2 py-0.5 font-mono text-xs font-semibold text-[#B45309]">
                            {s.jumlah}x
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
