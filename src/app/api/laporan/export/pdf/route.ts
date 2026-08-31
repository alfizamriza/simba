import { NextRequest } from 'next/server'
import PDFDocument from 'pdfkit'
import { requireFeature } from '@/lib/auth/require-feature'
import { loadAttendanceReport, parseReportFilters } from '@/lib/reports/attendance'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const session = await requireFeature('laporan')
  const filters = parseReportFilters(request.nextUrl.searchParams)
  const report = await loadAttendanceReport(filters, session)
  const document = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' })
  const chunks: Buffer[] = []
  document.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
  const result = new Promise<Buffer>((resolve) => document.on('end', () => resolve(Buffer.concat(chunks))))
  document.fontSize(16).text('Laporan Absensi', { align: 'center' })
  document.moveDown(0.5).fontSize(9).text(`Periode: ${filters.from} s/d ${filters.to}${filters.status ? ` | Status: ${filters.status}` : ''}`)
  document.moveDown().fontSize(10).text('Rekap per Siswa')
  document.moveDown(0.4).fontSize(8)
  document.text('Nama Siswa                    NIS              Kelas              Hadir  Telat  Sakit  Izin  Alpa')
  document.moveDown(0.2)
  for (const row of report.rows) document.text(`${row.nama.slice(0, 28).padEnd(30)} ${row.nis.slice(0, 14).padEnd(16)} ${row.kelas.slice(0, 16).padEnd(18)} ${String(row.hadir).padStart(5)} ${String(row.terlambat).padStart(6)} ${String(row.sakit).padStart(6)} ${String(row.izin).padStart(5)} ${String(row.alpa).padStart(5)}`)
  document.moveDown().fontSize(10).text('Persentase Kehadiran per Kelas')
  document.moveDown(0.3).fontSize(8)
  for (const row of report.classSummary) document.text(`${row.kelas.padEnd(20)} ${row.persentase}% (${row.hadir + row.terlambat}/${row.total} catatan hadir/terlambat)`)
  document.end()
  const buffer = await result
  return new Response(new Uint8Array(buffer), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="laporan-absensi-${filters.from}-${filters.to}.pdf"` } })
}
