import { createServiceRoleClient } from '@/lib/supabase/server'
import { getVisibleClassIds, type GuruSession } from '@/lib/auth/roles'

export type ReportStatus = '' | 'hadir' | 'terlambat' | 'sakit' | 'izin' | 'alpa'
export type ReportFilters = { from: string; to: string; kelasId: string; semesterId: string; status: ReportStatus }
export type ReportRow = { siswaId: string; nama: string; nis: string; kelas: string; hadir: number; terlambat: number; sakit: number; izin: number; alpa: number; total: number }
export type ClassSummary = { kelas: string; hadir: number; terlambat: number; sakit: number; izin: number; alpa: number; total: number; persentase: number }
export type DailyTrend = { tanggal: string; hadir: number; terlambat: number; alpa: number }
export type TodaySummary = { hadir: string[]; terlambat: string[]; sakit: string[]; izin: string[]; alpa: string[] }

type Student = { id: string; nis: string; nama: string; kelas_id: string | null; is_aktif: boolean }
type Class = { id: string; nama: string }
type Attendance = { siswa_id: string; tanggal: string; status: ReportStatus }

export function defaultReportFilters(): ReportFilters {
  const today = new Date()
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString().slice(0, 10)
  return { from, to: today.toISOString().slice(0, 10), kelasId: '', semesterId: '', status: '' }
}

export function parseReportFilters(params: URLSearchParams | Record<string, string | string[] | undefined>): ReportFilters {
  const get = (key: string) => params instanceof URLSearchParams ? params.get(key) ?? '' : typeof params[key] === 'string' ? params[key] as string : ''
  const defaults = defaultReportFilters()
  const rawStatus = get('status') as ReportStatus
  return { from: get('from') || defaults.from, to: get('to') || defaults.to, kelasId: get('kelas_id'), semesterId: get('semester_id'), status: ['', 'hadir', 'terlambat', 'sakit', 'izin', 'alpa'].includes(rawStatus) ? rawStatus : '' }
}

function emptyCounts() { return { hadir: 0, terlambat: 0, sakit: 0, izin: 0, alpa: 0 } }

export async function loadAttendanceReport(filters: ReportFilters, session: GuruSession) {
  const supabase = createServiceRoleClient()
  const { data: activeSemester } = await supabase.from('semester').select('id').eq('is_aktif', true).maybeSingle()
  const semesterId = filters.semesterId || activeSemester?.id || '00000000-0000-0000-0000-000000000000'
  const visibleClassIds = getVisibleClassIds(session)

  const classQuery = supabase.from('kelas').select('id, nama').order('nama')
  if (visibleClassIds) classQuery.in('id', visibleClassIds.length ? visibleClassIds : ['00000000-0000-0000-0000-000000000000'])
  const { data: classes } = await classQuery
  const classList = (classes ?? []) as Class[]
  const classIds = filters.kelasId
    ? visibleClassIds === null || visibleClassIds.includes(filters.kelasId)
      ? [filters.kelasId]
      : ['00000000-0000-0000-0000-000000000000']
    : visibleClassIds

  let studentQuery = supabase.from('siswa').select('id, nis, nama, kelas_id, is_aktif').order('nama')
  if (classIds) studentQuery = studentQuery.in('kelas_id', classIds.length ? classIds : ['00000000-0000-0000-0000-000000000000'])
  const { data: students } = await studentQuery
  const studentList = (students ?? []) as Student[]
  const studentIds = studentList.map((student) => student.id)

  let attendanceQuery = supabase.from('log_absensi').select('siswa_id, tanggal, status').eq('semester_id', semesterId).gte('tanggal', filters.from).lte('tanggal', filters.to)
  if (filters.status) attendanceQuery = attendanceQuery.eq('status', filters.status)
  if (studentIds.length) attendanceQuery = attendanceQuery.in('siswa_id', studentIds)
  else attendanceQuery = attendanceQuery.in('siswa_id', ['00000000-0000-0000-0000-000000000000'])
  const { data: attendance } = await attendanceQuery
  const countsByStudent = new Map<string, ReturnType<typeof emptyCounts>>()
  const dailyMap = new Map<string, DailyTrend>()
  for (const row of (attendance ?? []) as Attendance[]) {
    const counts = countsByStudent.get(row.siswa_id) ?? emptyCounts()
    if (row.status in counts) counts[row.status as keyof ReturnType<typeof emptyCounts>] += 1
    countsByStudent.set(row.siswa_id, counts)
    const daily = dailyMap.get(row.tanggal) ?? { tanggal: row.tanggal, hadir: 0, terlambat: 0, alpa: 0 }
    if (row.status === 'hadir') daily.hadir += 1
    if (row.status === 'terlambat') daily.terlambat += 1
    if (row.status === 'alpa') daily.alpa += 1
    dailyMap.set(row.tanggal, daily)
  }
  const classMap = new Map(classList.map((item) => [item.id, item.nama]))
  const studentLabel = (student: Student) => {
    const kelas = student.kelas_id ? classMap.get(student.kelas_id) : null
    return kelas ? `${student.nama} - Kelas ${kelas}` : `${student.nama} - Belum berkelas`
  }
  const today = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const todaySummary: TodaySummary = { hadir: [], terlambat: [], sakit: [], izin: [], alpa: [] }
  const { data: todayAttendance } = studentIds.length
    ? await supabase
      .from('log_absensi')
      .select('siswa_id, status')
      .eq('semester_id', semesterId)
      .eq('tanggal', today)
      .in('siswa_id', studentIds)
    : { data: [] }
  const studentsById = new Map(studentList.map((student) => [student.id, student]))
  const attendedTodayIds = new Set<string>()
  for (const row of (todayAttendance ?? []) as { siswa_id: string; status: ReportStatus }[]) {
    const student = studentsById.get(row.siswa_id)
    if (!student || !(row.status in todaySummary)) continue
    todaySummary[row.status as keyof TodaySummary].push(studentLabel(student))
    attendedTodayIds.add(row.siswa_id)
  }
  for (const student of studentList) {
    if (student.is_aktif && !attendedTodayIds.has(student.id)) todaySummary.alpa.push(studentLabel(student))
  }

  const rows: ReportRow[] = studentList.map((student) => {
    const counts = countsByStudent.get(student.id) ?? emptyCounts()
    return { siswaId: student.id, nama: student.nama, nis: student.nis, kelas: student.kelas_id ? classMap.get(student.kelas_id) ?? '-' : '-', ...counts, total: Object.values(counts).reduce((sum, value) => sum + value, 0) }
  })
  const byClass = new Map<string, ClassSummary>()
  for (const row of rows) {
    const summary = byClass.get(row.kelas) ?? { kelas: row.kelas, hadir: 0, terlambat: 0, sakit: 0, izin: 0, alpa: 0, total: 0, persentase: 0 }
    for (const key of ['hadir', 'terlambat', 'sakit', 'izin', 'alpa'] as const) summary[key] += row[key]
    summary.total += row.total
    byClass.set(row.kelas, summary)
  }
  const classSummary = [...byClass.values()].map((summary) => ({ ...summary, persentase: summary.total ? Math.round(((summary.hadir + summary.terlambat) / summary.total) * 100) : 0 }))
  const totals = rows.reduce((result, row) => { for (const key of ['hadir', 'terlambat', 'sakit', 'izin', 'alpa'] as const) result[key] += row[key]; return result }, emptyCounts())
  return { rows, classSummary, totals, trend: [...dailyMap.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal)), filters, semesterId, classes: classList, todaySummary }
}
