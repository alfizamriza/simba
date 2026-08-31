import Link from 'next/link'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/auth/require-feature'
import { defaultReportFilters, loadAttendanceReport, parseReportFilters } from '@/lib/reports/attendance'

type Semester = { id: string; jenis: string; tahun_ajaran: { nama: string } | null }

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireFeature('laporan')
  const params = await searchParams
  const filters = parseReportFilters(params)
  const report = await loadAttendanceReport(filters, session)
  const supabase = createServiceRoleClient()

  const { data: semesterData } = await
    supabase
      .from('semester')
      .select('id, jenis, tahun_ajaran(nama)')
      .order('tanggal_mulai', { ascending: false })

  const semesters = (semesterData ?? []).map((item) => ({
    ...item,
    tahun_ajaran: Array.isArray(item.tahun_ajaran) ? item.tahun_ajaran[0] ?? null : item.tahun_ajaran,
  })) as Semester[]

  const exportQuery = new URLSearchParams({ from: filters.from, to: filters.to })
  if (filters.kelasId) exportQuery.set('kelas_id', filters.kelasId)
  if (filters.status) exportQuery.set('status', filters.status)
  if (filters.semesterId) exportQuery.set('semester_id', filters.semesterId)
  const defaults = defaultReportFilters()

  // Helper pemetaan gaya status SIMBA
  const getStatusCardStyle = (key: string) => {
    switch (key) {
      case 'hadir':
        return { border: 'border-l-[#0F766E]', labelText: 'text-[#0F766E]' }
      case 'terlambat':
        return { border: 'border-l-[#B45309]', labelText: 'text-[#B45309]' }
      case 'sakit':
        return { border: 'border-l-[#0369A1]', labelText: 'text-[#0369A1]' }
      case 'izin':
        return { border: 'border-l-[#6D28D9]', labelText: 'text-[#6D28D9]' }
      case 'alpa':
        return { border: 'border-l-[#B91C1C]', labelText: 'text-[#B91C1C]' }
      default:
        return { border: 'border-l-[#DCE4E2]', labelText: 'text-[#5B6B68]' }
    }
  }
  const todayStatusLabels = {
    terlambat: 'Terlambat',
    sakit: 'Sakit',
    izin: 'Izin',
    alpa: 'Tanpa Keterangan',
  } as const

  return (
    <div className="w-full min-w-0 space-y-5 font-sans text-[#1C2321] sm:space-y-6">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 border-b border-[#DCE4E2] pb-4 sm:flex-row sm:items-end">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0F766E]">
            REKAPITULASI PRESENSI
          </span>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-[#0B4F49] sm:text-2xl">Laporan Absensi</h1>
          <p className="mt-0.5 text-xs text-[#5B6B68]">
            Rekapitasi data presensi siswa berdasarkan semester, periode, dan hak akses kelas.
          </p>
          <p className="mt-1 text-[11px] font-medium text-[#0F766E]">
            Kelas terlihat: {report.classes.map((item) => item.nama).join(', ') || 'Belum ada kelas yang ditugaskan'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Link
            href={`/api/laporan/export/excel?${exportQuery}`}
            className="rounded-[6px] bg-[#0F766E] px-3.5 py-2 text-center text-xs font-medium text-white transition-colors hover:bg-[#0B4F49] sm:py-1.5"
          >
            Export Excel
          </Link>
          <Link
            href={`/api/laporan/export/pdf?${exportQuery}`}
            className="rounded-[6px] border border-[#DCE4E2] bg-white px-3.5 py-2 text-center text-xs font-medium text-[#1C2321] transition-colors hover:bg-[#F7FAF9] sm:py-1.5"
          >
            Export PDF
          </Link>
        </div>
      </header>

      {/* Filter Form */}
      <section className="rounded-[6px] border border-[#DCE4E2] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
        <form method="get" className="grid gap-3 md:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#1C2321]">Dari Tanggal</label>
            <input
              name="from"
              type="date"
              defaultValue={filters.from}
              className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 font-mono text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#1C2321]">Sampai Tanggal</label>
            <input
              name="to"
              type="date"
              defaultValue={filters.to}
              className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 font-mono text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#1C2321]">Semester</label>
            <select
              name="semester_id"
              defaultValue={filters.semesterId}
              className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
            >
              <option value="">Semester aktif</option>
              {semesters.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.tahun_ajaran?.nama ?? '-'} · {item.jenis}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#1C2321]">Kelas</label>
            <select
              name="kelas_id"
              defaultValue={filters.kelasId}
              className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
            >
              <option value="">Semua kelas</option>
              {report.classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nama}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#1C2321]">Status</label>
            <select
              name="status"
              defaultValue={filters.status}
              className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
            >
              <option value="">Semua status</option>
              <option value="hadir">Hadir</option>
              <option value="terlambat">Terlambat</option>
              <option value="sakit">Sakit</option>
              <option value="izin">Izin</option>
              <option value="alpa">Alpa</option>
            </select>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end md:flex-col lg:flex-row">
            <button className="flex-1 rounded-[6px] bg-[#0F766E] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0B4F49]">
              Terapkan
            </button>
            <Link
              href={`/laporan?from=${defaults.from}&to=${defaults.to}`}
              className="rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs font-medium text-[#5B6B68] transition-colors hover:bg-[#F7FAF9] hover:text-[#1C2321]"
            >
              Reset
            </Link>
          </div>
        </form>
      </section>

      {/* Ringkasan Status Totals */}
      <section className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 md:grid-cols-5">
        {(['hadir', 'terlambat', 'sakit', 'izin', 'alpa'] as const).map((key) => {
          const style = getStatusCardStyle(key)
          return (
            <div
              key={key}
              className={`rounded-[6px] border border-[#DCE4E2] border-l-4 ${style.border} bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5B6B68]">{key}</p>
              <p className={`mt-1 font-mono text-2xl font-bold tabular-nums ${style.labelText}`}>
                {report.totals[key]}
              </p>
            </div>
          )
        })}
      </section>

      <section className="rounded-[6px] border border-[#DCE4E2] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
        <h2 className="text-xs font-semibold text-[#0B4F49]">Detail Kehadiran Hari Ini</h2>
        <p className="text-[11px] text-[#5B6B68]">
          Nama siswa yang terlambat, sakit, izin, atau belum tercatat hadir pada kelas yang dapat Anda lihat.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {(['terlambat', 'sakit', 'izin', 'alpa'] as const).map((key) => {
            const style = getStatusCardStyle(key)
            const students = report.todaySummary[key]
            return (
              <div key={key} className={`rounded-[6px] border border-[#DCE4E2] border-l-4 ${style.border} bg-[#F7FAF9] p-3`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className={`text-xs font-bold ${style.labelText}`}>{todayStatusLabels[key]}</h3>
                  <span className="rounded-[4px] bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-[#1C2321]">
                    {students.length}
                  </span>
                </div>
                {students.length ? (
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1 text-xs text-[#1C2321]">
                    {students.map((student) => (
                      <li key={student} className="truncate font-medium" title={student}>
                        {student}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[11px] italic text-[#5B6B68]">Tidak ada data.</p>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Tren Kehadiran Harian */}
      <section className="rounded-[6px] border border-[#DCE4E2] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xs font-semibold text-[#0B4F49]">Tren Kehadiran Harian</h2>
            <p className="text-[11px] text-[#5B6B68]">Perbandingan jumlah Hadir, Terlambat, dan Alpa pada rentang terpilih.</p>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] font-medium">
            <span className="text-[#0F766E]">● Hadir</span>
            <span className="text-[#B45309]">● Terlambat</span>
            <span className="text-[#B91C1C]">● Alpa</span>
          </div>
        </div>
        <div className="mt-5 flex h-48 items-end gap-1 overflow-x-auto border-b border-[#DCE4E2] pb-1">
          {report.trend.map((day) => {
            const max = Math.max(
              1,
              ...report.trend.map((item) => Math.max(item.hadir, item.terlambat, item.alpa))
            )
            return (
              <div
                key={day.tanggal}
                title={`${day.tanggal}: hadir ${day.hadir}, terlambat ${day.terlambat}, alpa ${day.alpa}`}
                className="flex min-w-8 flex-1 items-end justify-center gap-0.5"
              >
                <div
                  className="w-2 rounded-t-[2px] bg-[#0F766E]"
                  style={{ height: `${(day.hadir / max) * 100}%` }}
                />
                <div
                  className="w-2 rounded-t-[2px] bg-[#B45309]"
                  style={{ height: `${(day.terlambat / max) * 100}%` }}
                />
                <div
                  className="w-2 rounded-t-[2px] bg-[#B91C1C]"
                  style={{ height: `${(day.alpa / max) * 100}%` }}
                />
              </div>
            )
          })}
          {report.trend.length === 0 && (
            <p className="m-auto text-xs text-[#5B6B68]">Belum ada data tren untuk periode ini.</p>
          )}
        </div>
      </section>

      {/* Persentase Kehadiran per Kelas */}
      <section className="rounded-[6px] border border-[#DCE4E2] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
        <h2 className="text-xs font-semibold text-[#0B4F49]">Persentase Kehadiran per Kelas</h2>
        <p className="text-[11px] text-[#5B6B68]">
          Tingkat kehadiran (Hadir & Terlambat) dibanding total catatan absensi.
        </p>
        <div className="mt-4 space-y-3.5">
          {report.classSummary.map((item) => (
            <div key={item.kelas}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-[#1C2321]">{item.kelas}</span>
                <span className="font-mono font-medium text-[#0F766E] tabular-nums">{item.persentase}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-[4px] bg-[#F7FAF9] border border-[#DCE4E2]">
                <div
                  className="h-full rounded-[2px] bg-[#0F766E]"
                  style={{ width: `${item.persentase}%` }}
                />
              </div>
            </div>
          ))}
          {report.classSummary.length === 0 && (
            <p className="text-xs text-[#5B6B68]">Tidak ada ringkasan data kelas.</p>
          )}
        </div>
      </section>

      {/* Rekap per Siswa */}
      <section className="overflow-hidden rounded-[6px] border border-[#DCE4E2] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="border-b border-[#DCE4E2] bg-[#F7FAF9] px-4 py-3">
          <h2 className="text-xs font-semibold text-[#0B4F49]">Rekapitulasi Detail per Siswa</h2>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-xs">
            <thead className="border-b border-[#DCE4E2] bg-[#F7FAF9] text-[11px] font-semibold text-[#5B6B68]">
              <tr>
                <th className="px-4 py-3">Nama Siswa</th>
                <th className="px-4 py-3">NIS</th>
                <th className="px-4 py-3">Kelas</th>
                <th className="px-4 py-3 text-center">Hadir</th>
                <th className="px-4 py-3 text-center">Terlambat</th>
                <th className="px-4 py-3 text-center">Sakit</th>
                <th className="px-4 py-3 text-center">Izin</th>
                <th className="px-4 py-3 text-center">Alpa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4E2] text-[#1C2321]">
              {report.rows.map((row) => (
                <tr key={row.siswaId} className="transition-colors hover:bg-[#F7FAF9]">
                  <td className="px-4 py-3 font-medium text-[#1C2321]">{row.nama}</td>
                  <td className="px-4 py-3 font-mono text-[#5B6B68] tabular-nums">{row.nis}</td>
                  <td className="px-4 py-3 text-[#5B6B68]">{row.kelas}</td>
                  <td className="px-4 py-3 text-center font-mono font-medium text-[#0F766E] tabular-nums">
                    {row.hadir}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-medium text-[#B45309] tabular-nums">
                    {row.terlambat}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-medium text-[#0369A1] tabular-nums">
                    {row.sakit}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-medium text-[#6D28D9] tabular-nums">
                    {row.izin}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-medium text-[#B91C1C] tabular-nums">
                    {row.alpa}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.rows.length === 0 && (
            <p className="px-5 py-12 text-center text-xs text-[#5B6B68]">
              Tidak ada data rekapan yang sesuai dengan kriteria filter.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
