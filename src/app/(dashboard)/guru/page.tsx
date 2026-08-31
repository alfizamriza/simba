import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireFeature } from '@/lib/auth/require-feature'
import Link from 'next/link'
import TambahGuruForm from './tambah-guru-form'

type Guru = { id: string; user_id: string; nip: string; nama: string; no_hp: string | null; is_aktif: boolean }
type Role = { guru_id: string; role: string; kelas_id: string | null }
type Kelas = { id: string; nama: string; tingkat: number }

function valueOf(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : ''
}

export default async function GuruPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()
  const params = await searchParams
  await requireFeature('guru')

  const search = valueOf(params.search).trim()
  const roleFilter = valueOf(params.role)
  const statusFilter = valueOf(params.status)
  const page = Math.max(1, Number.parseInt(valueOf(params.page) || '1', 10) || 1)
  const pageSize = 20

  const supabase = createServiceRoleClient()

  // 1. Ambil data kelas untuk mapping dan form
  const { data: kelas } = await supabase.from('kelas').select('id, nama, tingkat').order('nama')
  const classes = (kelas ?? []) as Kelas[]
  const classMap = new Map(classes.map((item) => [item.id, item.nama]))

  // 2. Cari kelas yang sudah memiliki wali kelas aktif
  const { data: activeWaliRoles } = await supabase
    .from('guru_roles')
    .select('kelas_id, guru(is_aktif)')
    .eq('role', 'wali_kelas')
    .not('kelas_id', 'is', null)

  const kelasTerpakaiIds = (activeWaliRoles ?? [])
    .filter((item: any) => item.guru?.is_aktif)
    .map((item: any) => item.kelas_id as string)

  // 3. Bangun query pencarian guru
  let query = supabase.from('guru').select('id, user_id, nip, nama, no_hp, is_aktif', { count: 'exact' })

  if (statusFilter === 'aktif') query = query.eq('is_aktif', true)
  if (statusFilter === 'nonaktif') query = query.eq('is_aktif', false)
  if (search) {
    query = query.or(`nama.ilike.%${search.replace(/[,%()]/g, ' ')}%,nip.ilike.%${search.replace(/[,%()]/g, ' ')}%`)
  }

  // Filter berdasarkan role
  let filteredGuruIds: string[] | null = null
  if (roleFilter) {
    const { data: matchingRoles } = await supabase.from('guru_roles').select('guru_id').eq('role', roleFilter)
    filteredGuruIds = (matchingRoles ?? []).map((r) => r.guru_id)
    if (filteredGuruIds.length === 0) {
      filteredGuruIds = ['00000000-0000-0000-0000-000000000000']
    }
  }

  if (filteredGuruIds) {
    query = query.in('id', filteredGuruIds)
  }

  query = query.order('nama').range((page - 1) * pageSize, page * pageSize - 1)
  const { data: guru, count } = await query
  const teachers = (guru ?? []) as Guru[]

  // 4. Ambil role untuk guru yang muncul di halaman ini
  const teacherIds = teachers.map((t) => t.id)
  const { data: roleRows } = teacherIds.length
    ? await supabase.from('guru_roles').select('guru_id, role, kelas_id').in('guru_id', teacherIds)
    : { data: [] }
  
  const allRoles = (roleRows ?? []) as Role[]
  const rolesByGuru = new Map<string, Role[]>()
  for (const role of allRoles) {
    rolesByGuru.set(role.guru_id, [...(rolesByGuru.get(role.guru_id) ?? []), role])
  }

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize))

  const pageHref = (nextPage: number) => {
    const q = new URLSearchParams()
    if (search) q.set('search', search)
    if (roleFilter) q.set('role', roleFilter)
    if (statusFilter) q.set('status', statusFilter)
    q.set('page', String(nextPage))
    return `/guru?${q}`
  }

  const getRoleBadges = (teacherRoles: Role[]) => {
    if (teacherRoles.length === 0) {
      return <span className="inline-block rounded-[4px] border border-[#DCE4E2] bg-[#F7FAF9] px-2 py-0.5 text-[10px] font-semibold text-[#5B6B68]">Belum ada role</span>
    }

    return teacherRoles.map((r, i) => {
      let label = r.role.replace('_', ' ')
      let badgeStyle = 'bg-[#F7FAF9] text-[#5B6B68] border-[#DCE4E2]'
      
      if (r.role === 'admin') {
        badgeStyle = 'bg-[#E4F5F3] text-[#0F766E] border-[#0F766E]/20'
      } else if (r.role === 'wali_kelas') {
        const className = r.kelas_id ? classMap.get(r.kelas_id) ?? '' : ''
        label = `Wali Kelas ${className}`
        badgeStyle = 'bg-[#E0F2FE] text-[#0369A1] border-[#0369A1]/20'
      } else if (r.role === 'guru_mapel') {
        const className = r.kelas_id ? classMap.get(r.kelas_id) ?? '' : ''
        label = `Guru Mapel ${className}`
        badgeStyle = 'bg-[#F3E8FF] text-[#6D28D9] border-[#6D28D9]/20'
      } else if (r.role === 'kepala_sekolah') {
        badgeStyle = 'bg-[#FEF3C7] text-[#B45309] border-[#B45309]/20'
      }

      return (
        <span key={i} className={`inline-block rounded-[4px] border px-2 py-0.5 text-[10px] font-bold capitalize ${badgeStyle} mr-1 mb-1`}>
          {label}
        </span>
      )
    })
  }

  return (
    <div className="w-full space-y-6 font-sans text-[#1C2321] p-6 lg:p-8">
      {/* Header Section */}
      <header className="pb-2 border-b border-[#DCE4E2]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0F766E]">
          ADMINISTRATOR
        </span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0B4F49]">
          Kelola Akun Guru
        </h1>
        <p className="mt-0.5 text-xs text-[#5B6B68]">
          Pengaturan akun guru, pendelegasian role, penetapan kelas wali, dan kontrol hak akses.
        </p>
      </header>

      {/* Form Tambah Guru */}
      <TambahGuruForm classes={classes} kelasTerpakaiIds={kelasTerpakaiIds} />

      {/* Daftar Guru Table */}
      <section className="overflow-hidden rounded-[6px] border border-[#DCE4E2] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {/* Filter Toolbar */}
        <form method="get" className="grid gap-3 border-b border-[#DCE4E2] bg-[#F7FAF9] p-4 md:grid-cols-[1fr_200px_160px_auto]">
          <input
            name="search"
            defaultValue={search}
            placeholder="Cari nama atau NIP..."
            className="rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] placeholder-[#5B6B68] focus:border-[#0F766E] focus:outline-none"
          />
          <select
            name="role"
            defaultValue={roleFilter}
            className="rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
          >
            <option value="">Semua Role</option>
            <option value="admin">Admin</option>
            <option value="wali_kelas">Wali Kelas</option>
            <option value="guru_mapel">Guru Mapel</option>
            <option value="kepala_sekolah">Kepala Sekolah</option>
          </select>
          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
          >
            <option value="">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
          <button className="rounded-[6px] bg-[#0F766E] px-5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0B4F49]">
            Terapkan
          </button>
        </form>

        {/* Tabel Data */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#DCE4E2] bg-[#F7FAF9] text-[11px] font-semibold text-[#5B6B68]">
              <tr>
                <th className="px-4 py-3">Nama Guru</th>
                <th className="px-4 py-3">NIP</th>
                <th className="px-4 py-3">Role & Penugasan</th>
                <th className="px-4 py-3">No. HP</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4E2] text-[#1C2321]">
              {teachers.map((teacher) => {
                const teacherRoles = rolesByGuru.get(teacher.id) ?? []

                return (
                  <tr key={teacher.id} className="transition-colors hover:bg-[#F7FAF9]">
                    <td className="px-4 py-3 font-semibold text-[#0F766E]">
                      <Link href={`/guru/${teacher.id}`} className="hover:underline">
                        {teacher.nama}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-[#5B6B68] tabular-nums">{teacher.nip}</td>
                    <td className="px-4 py-3 max-w-xs sm:max-w-md md:max-w-lg">
                      <div className="flex flex-wrap pt-1">{getRoleBadges(teacherRoles)}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[#5B6B68] tabular-nums">{teacher.no_hp ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-[4px] border px-2 py-0.5 text-[10px] font-semibold ${
                        teacher.is_aktif
                          ? 'border-[#0F766E]/20 bg-[#E4F5F3] text-[#0F766E]'
                          : 'border-[#DCE4E2] bg-[#F7FAF9] text-[#5B6B68]'
                      }`}>
                        {teacher.is_aktif ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {teachers.length === 0 && (
            <p className="px-5 py-12 text-center text-xs text-[#5B6B68]">
              Tidak ada data guru yang cocok dengan kriteria pencarian.
            </p>
          )}
        </div>

        {/* Footer Paginasi */}
        <div className="flex items-center justify-between border-t border-[#DCE4E2] bg-[#F7FAF9] px-4 py-3 text-xs text-[#5B6B68]">
          <span>
            Halaman <span className="font-mono font-medium text-[#1C2321] tabular-nums">{page}</span> dari{' '}
            <span className="font-mono font-medium text-[#1C2321] tabular-nums">{totalPages}</span> · Total{' '}
            <span className="font-mono font-medium text-[#1C2321] tabular-nums">{count ?? 0}</span> guru
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
