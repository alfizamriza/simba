import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { requireFeature } from '@/lib/auth/require-feature'
import { loadAttendanceReport, parseReportFilters } from '@/lib/reports/attendance'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const session = await requireFeature('laporan')
  const filters = parseReportFilters(request.nextUrl.searchParams)
  const report = await loadAttendanceReport(filters, session)
  const workbook = XLSX.utils.book_new()
  const rows = report.rows.map((row) => ({
    'Nama Siswa': row.nama,
    NIS: row.nis,
    Kelas: row.kelas,
    Hadir: row.hadir,
    Terlambat: row.terlambat,
    Sakit: row.sakit,
    Izin: row.izin,
    Alpa: row.alpa,
  }))
  const classRows = report.classSummary.map((row) => ({ Kelas: row.kelas, Hadir: row.hadir, Terlambat: row.terlambat, Sakit: row.sakit, Izin: row.izin, Alpa: row.alpa, 'Persentase Kehadiran': `${row.persentase}%` }))
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Rekap Siswa')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(classRows), 'Rekap Kelas')
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
  return new Response(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="laporan-absensi-${filters.from}-${filters.to}.xlsx"` } })
}
