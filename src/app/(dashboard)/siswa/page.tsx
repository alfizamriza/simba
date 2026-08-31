import Link from 'next/link'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/auth/require-feature'
import { bisaEdit, getVisibleClassIds, isAdmin } from '@/lib/auth/roles'
import { saveSiswa } from './actions'
import ImportSiswaForm from './import-siswa-form'
import SiswaTableClient from './siswa-table-client'

type Kelas = { id: string; nama: string; tingkat: number }
type Siswa = { id: string; nis: string; nama: string; kelas_id: string | null; is_aktif: boolean }
type Kartu = { siswa_id: string; is_aktif: boolean }
type Kehadiran = { siswa_id: string; status: string }

function valueOf(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : ''
}

export default async function SiswaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireFeature('siswa')
  const params = await searchParams
  const search = valueOf(params.search).trim()
  const kelasId = valueOf(params.kelas_id)
  const activeStatus = valueOf(params.status)
  const page = Math.max(1, Number.parseInt(valueOf(params.page) || '1', 10) || 1)
  const pageSize = 20

  const supabase = createServiceRoleClient()

  const visibleClassIds = getVisibleClassIds(session)

  const classQuery = supabase.from('kelas').select('id, nama, tingkat').order('tingkat').order('nama')
  if (visibleClassIds) {
    classQuery.in('id', visibleClassIds.length ? visibleClassIds : ['00000000-0000-0000-0000-000000000000'])
  }
  const { data: kelas } = await classQuery
  const classes = (kelas ?? []) as Kelas[]

  let studentQuery = supabase
    .from('siswa')
    .select('id, nis, nama, kelas_id, is_aktif', { count: 'exact' })
    .order('nama')
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (visibleClassIds) {
    studentQuery = studentQuery.in(
      'kelas_id',
      visibleClassIds.length ? visibleClassIds : ['00000000-0000-0000-0000-000000000000']
    )
  }
  
  if (kelasId === 'unassigned') {
    studentQuery = studentQuery.is('kelas_id', null)
  } else if (kelasId) {
    studentQuery = studentQuery.eq('kelas_id', kelasId)
  }

  if (activeStatus === 'aktif') studentQuery = studentQuery.eq('is_aktif', true)
  if (activeStatus === 'nonaktif') studentQuery = studentQuery.eq('is_aktif', false)
  if (search) {
    studentQuery = studentQuery.or(
      `nama.ilike.%${search.replace(/[,%()]/g, ' ')}%,nis.ilike.%${search.replace(/[,%()]/g, ' ')}%`
    )
  }

  const { data: siswa, count } = await studentQuery
  const students = (siswa ?? []) as Siswa[]
  const ids = students.map((student) => student.id)

  const [{ data: kartu }, { data: attendance }] = ids.length
    ? await Promise.all([
      supabase.from('kartu_rfid').select('siswa_id, is_aktif').in('siswa_id', ids),
      supabase
        .from('log_absensi')
        .select('siswa_id, status')
        .eq('tanggal', new Date().toISOString().slice(0, 10))
        .in('siswa_id', ids),
    ])
    : [{ data: [] }, { data: [] }]

  const cardSet = new Set(((kartu ?? []) as Kartu[]).filter((item) => item.is_aktif).map((item) => item.siswa_id))
  const attendanceMap = new Map(((attendance ?? []) as Kehadiran[]).map((item) => [item.siswa_id, item.status]))
  const classMap = new Map(classes.map((item) => [item.id, item]))
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize))
  const admin = isAdmin(session)
  const canEdit = bisaEdit(session)

  const pageHref = (nextPage: number) => {
    const query = new URLSearchParams()
    if (search) query.set('search', search)
    if (kelasId) query.set('kelas_id', kelasId)
    if (activeStatus) query.set('status', activeStatus)
    query.set('page', String(nextPage))
    return `/siswa?${query}`
  }

  return (
    <div className="w-full min-w-0 space-y-5 font-sans text-[#1C2321] sm:space-y-6">
      {/* Header */}
      <header className="pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0F766E]">
          DATA AKADEMIK
        </span>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-[#0B4F49] sm:text-2xl">Data Siswa</h1>
        <p className="mt-0.5 text-xs text-[#5B6B68]">
          Kelola data induk, kartu RFID, dan status kehadiran siswa harian.
        </p>
        <p className="mt-1 text-[11px] font-medium text-[#0F766E]">
          Kelas terlihat: {classes.map((item) => item.nama).join(', ') || 'Belum ada kelas yang ditugaskan'}
        </p>
      </header>

      {/* Form Import Batch Siswa */}
      {admin && <ImportSiswaForm />}

      {/* Form Tambah Siswa Baru */}
      {canEdit && (
        <section className="rounded-[6px] border border-[#DCE4E2] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
          <h2 className="text-xs font-semibold text-[#0B4F49]">Tambah Siswa Baru</h2>
          <form action={saveSiswa} className="mt-3 grid gap-3 md:grid-cols-[180px_1fr_220px_auto]">
            <input
              name="nis"
              required
              placeholder="NIS"
              className="rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 font-mono text-xs text-[#1C2321] placeholder-[#5B6B68] focus:border-[#0F766E] focus:outline-none"
            />
            <input
              name="nama"
              required
              placeholder="Nama lengkap siswa"
              className="rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] placeholder-[#5B6B68] focus:border-[#0F766E] focus:outline-none"
            />
            <select
              name="kelas_id"
              className="rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#5B6B68] focus:border-[#0F766E] focus:outline-none"
            >
              <option value="">Belum ada kelas</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nama} · Tingkat {item.tingkat}
                </option>
              ))}
            </select>
            <button className="rounded-[6px] bg-[#0F766E] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#0B4F49]">
              Simpan Data
            </button>
          </form>
        </section>
      )}

      {/* Filter & Tabel Data Siswa */}
      <section className="w-full overflow-hidden rounded-[6px] border border-[#DCE4E2] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {/* Filter Toolbar */}
        <div className="border-b border-[#DCE4E2] bg-[#F7FAF9] p-3 sm:p-4 space-y-2">
          <form method="get" className="grid gap-3 md:grid-cols-[1fr_200px_160px_auto]">
            <input
              name="search"
              defaultValue={search}
              placeholder="Cari nama atau NIS..."
              className="rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] placeholder-[#5B6B68] focus:border-[#0F766E] focus:outline-none"
            />
            <select
              name="kelas_id"
              defaultValue={kelasId}
              className="rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
            >
              <option value="">Semua kelas</option>
              <option value="unassigned">Belum Berkelas (IS NULL)</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  Kelas {item.nama}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={activeStatus}
              className="rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
            >
              <option value="">Semua status</option>
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
            <button className="rounded-[6px] bg-[#0F766E] px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#0B4F49]">
              Cari
            </button>
          </form>

          {/* Quick Filter Pintas */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link
              href={kelasId === 'unassigned' ? '/siswa' : '/siswa?kelas_id=unassigned'}
              className={`inline-block rounded-[4px] border px-2.5 py-1 text-xs font-medium ${
                kelasId === 'unassigned'
                  ? 'border-[#0F766E] bg-[#E4F5F3] text-[#0F766E]'
                  : 'border-[#DCE4E2] bg-white text-[#5B6B68] hover:bg-[#F7FAF9] hover:text-[#1C2321]'
              }`}
            >
              {kelasId === 'unassigned' ? 'Tampilkan Semua Siswa' : 'Tampilkan hanya siswa belum berkelas'}
            </Link>
          </div>
        </div>

        {/* Client Table Component with bulk operations */}
        <SiswaTableClient
          students={students}
          classes={classes}
          cardSetIds={Array.from(cardSet)}
          attendanceRecord={Object.fromEntries(attendanceMap)}
          classRecord={Object.fromEntries(classMap)}
          canEdit={canEdit}
        />

        {/* Footer Paginasi */}
        <div className="flex flex-col gap-3 border-t border-[#DCE4E2] bg-[#F7FAF9] px-4 py-3 text-xs text-[#5B6B68] sm:flex-row sm:items-center sm:justify-between">
          <span>
            Halaman <span className="font-mono font-medium text-[#1C2321] tabular-nums">{page}</span> dari{' '}
            <span className="font-mono font-medium text-[#1C2321] tabular-nums">{totalPages}</span> · Total{' '}
            <span className="font-mono font-medium text-[#1C2321] tabular-nums">{count ?? 0}</span> siswa
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={pageHref(page - 1)}
                className="rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1 font-medium text-[#1C2321] transition-colors hover:bg-[#F7FAF9]"
              >
                Sebelumnya
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={pageHref(page + 1)}
                className="rounded-[6px] bg-[#0F766E] px-3 py-1 font-medium text-white transition-colors hover:bg-[#0B4F49]"
              >
                Berikutnya
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
