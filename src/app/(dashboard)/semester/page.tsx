import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireFeature } from '@/lib/auth/require-feature'
import { createSemester } from './actions'
import SemesterActivateForm from './semester-activate-form'

type Tahun = { id: string; nama: string }
type Semester = {
  id: string
  tahun_ajaran_id: string
  jenis: string
  tanggal_mulai: string
  tanggal_selesai: string
  is_aktif: boolean
}

export default async function SemesterPage() {
  await requireAdmin()
  await requireFeature('semester')

  const supabase = createServiceRoleClient()
  const [{ data: tahun }, { data: semester }] = await Promise.all([
    supabase.from('tahun_ajaran').select('id, nama').order('nama', { ascending: false }),
    supabase
      .from('semester')
      .select('id, tahun_ajaran_id, jenis, tanggal_mulai, tanggal_selesai, is_aktif')
      .order('tanggal_mulai', { ascending: false }),
  ])

  const years = (tahun ?? []) as Tahun[]
  const semesters = (semester ?? []) as Semester[]
  const yearMap = new Map(years.map((item) => [item.id, item.nama]))

  return (
    <div className="w-full min-w-0 space-y-5 font-sans text-[#1C2321] sm:space-y-6">
      {/* Header Section */}
      <header className="pb-2 border-b border-[#DCE4E2]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0F766E]">
          ADMINISTRATOR
        </span>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-[#0B4F49] sm:text-2xl">
          Kelola Semester Aktif
        </h1>
        <p className="mt-0.5 text-xs text-[#5B6B68]">
          Pergantian semester menentukan cakupan default data absensi, rekapitulasi, dan laporan sekolah.
        </p>
      </header>

      {/* Form Tambah Semester */}
      <section className="rounded-[6px] border border-[#DCE4E2] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
        <h2 className="text-xs font-semibold text-[#0B4F49]">Tambah Semester Baru</h2>
        <form action={createSemester} className="mt-4 grid gap-3 md:grid-cols-4">
          <select
            name="tahun_ajaran_id"
            required
            className="rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
          >
            <option value="">Pilih Tahun Ajaran</option>
            {years.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nama}
              </option>
            ))}
          </select>

          <select
            name="jenis"
            required
            className="rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
          >
            <option value="">Jenis Semester</option>
            <option value="ganjil">Ganjil</option>
            <option value="genap">Genap</option>
          </select>

          <input
            name="tanggal_mulai"
            type="date"
            required
            className="rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
          />

          <input
            name="tanggal_selesai"
            type="date"
            required
            className="rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
          />

          <button
            type="submit"
            className="rounded-[6px] bg-[#0F766E] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#0B4F49] md:col-span-4"
          >
            Simpan Semester
          </button>
        </form>
      </section>

      {/* Daftar Semester */}
      <section className="overflow-hidden rounded-[6px] border border-[#DCE4E2] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="border-b border-[#DCE4E2] bg-[#F7FAF9] px-5 py-3">
          <h2 className="text-xs font-semibold text-[#0B4F49]">Daftar Riwayat Semester</h2>
        </div>

        <div className="divide-y divide-[#DCE4E2]">
          {semesters.map((item) => {
            const label = `Semester ${item.jenis} · ${yearMap.get(item.tahun_ajaran_id) ?? '-'}`
            return (
              <div
                key={item.id}
                className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-[#F7FAF9]/50 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div>
                  <p className="text-xs font-semibold capitalize text-[#1C2321]">{label}</p>
                  <p className="mt-0.5 text-[11px] text-[#5B6B68]">
                    Periode:{' '}
                    <span className="font-mono tabular-nums">
                      {item.tanggal_mulai}
                    </span>{' '}
                    s.d.{' '}
                    <span className="font-mono tabular-nums">
                      {item.tanggal_selesai}
                    </span>
                  </p>
                </div>

                {item.is_aktif ? (
                  <span className="w-fit rounded-[4px] border border-[#0F766E]/20 bg-[#E4F5F3] px-2.5 py-0.5 text-[11px] font-medium text-[#0F766E]">
                    Aktif
                  </span>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="rounded-[4px] border border-[#DCE4E2] bg-[#F7FAF9] px-2.5 py-0.5 text-[11px] font-medium text-[#5B6B68]">
                      Nonaktif
                    </span>
                    <SemesterActivateForm id={item.id} label={label} />
                  </div>
                )}
              </div>
            )
          })}

          {semesters.length === 0 && (
            <p className="px-5 py-10 text-center text-xs text-[#5B6B68]">
              Belum ada data semester yang terdaftar.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
