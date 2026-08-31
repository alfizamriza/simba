import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireFeature } from '@/lib/auth/require-feature'
import { assignWaliKelas, deleteKelas, moveSiswa, saveKelas, saveTahunAjaran } from './actions'

type TahunAjaran = { id: string; nama: string }
type Kelas = { id: string; tahun_ajaran_id: string; nama: string; tingkat: number }
type Guru = { id: string; nama: string; is_aktif: boolean }
type GuruRole = { guru_id: string; role: string; kelas_id: string | null }
type Siswa = { id: string; nis: string; nama: string; kelas_id: string | null; is_aktif: boolean }

export default async function KelasPage() {
  await requireAdmin()
  await requireFeature('kelas')
  const supabase = createServiceRoleClient()

  const [{ data: tahunAjaran }, { data: kelas }, { data: guru }, { data: guruRoles }, { data: siswa }] =
    await Promise.all([
      supabase.from('tahun_ajaran').select('id, nama').order('nama', { ascending: false }),
      supabase.from('kelas').select('id, tahun_ajaran_id, nama, tingkat').order('tingkat').order('nama'),
      supabase.from('guru').select('id, nama, is_aktif').eq('is_aktif', true).order('nama'),
      supabase.from('guru_roles').select('guru_id, role, kelas_id').eq('role', 'wali_kelas'),
      supabase.from('siswa').select('id, nis, nama, kelas_id, is_aktif').order('nama'),
    ])

  const tahun = (tahunAjaran ?? []) as TahunAjaran[]
  const daftarKelas = (kelas ?? []) as Kelas[]
  const daftarRole = (guruRoles ?? []) as GuruRole[]
  const semuaGuru = (guru ?? []) as Guru[]
  const daftarGuru = semuaGuru.filter((teacher) =>
    daftarRole.some((role) => role.guru_id === teacher.id)
  )
  const daftarSiswa = (siswa ?? []) as Siswa[]
  const namaTahun = new Map(tahun.map((item) => [item.id, item.nama]))
  const guruMap = new Map(daftarGuru.map((item) => [item.id, item.nama]))
  const waliMap = new Map(
    daftarRole.filter((item) => item.kelas_id).map((item) => [item.kelas_id as string, item.guru_id])
  )
  const siswaByClass = new Map<string, Siswa[]>()
  for (const student of daftarSiswa) {
    if (student.kelas_id) {
      siswaByClass.set(student.kelas_id, [...(siswaByClass.get(student.kelas_id) ?? []), student])
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5 font-sans text-[#1C2321] sm:space-y-6">
      {/* Header */}
      <header className="pb-2 border-b border-[#DCE4E2]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0F766E]">
          ADMINISTRATOR
        </span>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-[#0B4F49] sm:text-2xl">Kelola Kelas</h1>
        <p className="mt-0.5 text-xs text-[#5B6B68]">
          Manajemen data kelas, penugasan wali kelas, serta pemindahan siswa antar kelas.
        </p>
      </header>

      {/* Grid Layout Utama */}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Sidebar Form Tambah */}
        <section className="h-fit space-y-6">
          {/* Form Tahun Ajaran Baru */}
          <div className="rounded-[6px] border border-[#DCE4E2] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
            <h2 className="text-xs font-semibold text-[#0B4F49]">Tahun Ajaran Baru</h2>
            <p className="mt-0.5 text-[11px] text-[#5B6B68]">Format penulisan: YYYY/YYYY (misal: 2026/2027)</p>
            <form action={saveTahunAjaran} className="mt-3 space-y-3">
              <input
                name="nama"
                required
                pattern="\d{4}/\d{4}"
                placeholder="2026/2027"
                className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 font-mono text-xs text-[#1C2321] placeholder-[#5B6B68] focus:border-[#0F766E] focus:outline-none"
              />
              <button className="w-full rounded-[6px] bg-[#0F766E] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0B4F49]">
                Tambah Tahun Ajaran
              </button>
            </form>
            <div className="mt-4 space-y-1.5 border-t border-[#DCE4E2] pt-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5B6B68]">
                Daftar Tahun Ajaran
              </span>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {tahun.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[4px] bg-[#F7FAF9] border border-[#DCE4E2] px-2.5 py-1 font-mono text-xs text-[#1C2321]"
                  >
                    {item.nama}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Form Tambah Kelas */}
          <div className="rounded-[6px] border border-[#DCE4E2] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
            <h2 className="text-xs font-semibold text-[#0B4F49]">Tambah Kelas Baru</h2>
            <form action={saveKelas} className="mt-3 space-y-3">
              <select
                name="tahun_ajaran_id"
                required
                className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
              >
                <option value="">Pilih tahun ajaran...</option>
                {tahun.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nama}
                  </option>
                ))}
              </select>
              <select
                name="tingkat"
                required
                className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
              >
                <option value="">Pilih tingkat...</option>
                <option value="7">Tingkat 7</option>
                <option value="8">Tingkat 8</option>
                <option value="9">Tingkat 9</option>
              </select>
              <input
                name="nama"
                required
                placeholder="Nama kelas (Contoh: 7A)"
                className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] placeholder-[#5B6B68] focus:border-[#0F766E] focus:outline-none"
              />
              <button className="w-full rounded-[6px] bg-[#0F766E] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0B4F49]">
                Simpan Kelas
              </button>
            </form>
          </div>
        </section>

        {/* Daftar Kelas */}
        <section className="space-y-4">
          {daftarKelas.map((item) => {
            const students = siswaByClass.get(item.id) ?? []
            const waliId = waliMap.get(item.id) ?? ''
            return (
              <details
                key={item.id}
                open
                className="group overflow-hidden rounded-[6px] border border-[#DCE4E2] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              >
                <summary className="flex cursor-pointer list-none flex-col gap-3 border-b border-[#DCE4E2] bg-[#F7FAF9] px-4 py-3 transition-colors hover:bg-[#E4F5F3] sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-xs text-[#0B4F49]">{item.nama}</p>
                    <p className="text-[11px] text-[#5B6B68]">
                      Tingkat {item.tingkat} · {namaTahun.get(item.tahun_ajaran_id) ?? '-'} ·{' '}
                      <span className="font-mono tabular-nums">{students.length}</span> siswa
                    </p>
                  </div>
                  <span className="inline-block rounded-[4px] bg-[#E4F5F3] px-2.5 py-0.5 text-[11px] font-medium text-[#0F766E] border border-[#DCE4E2]">
                    {waliId ? guruMap.get(waliId) ?? 'Wali tidak ditemukan' : 'Belum ada wali'}
                  </span>
                </summary>

                <div className="space-y-4 p-4">
                  {/* Outer Panel Pengaturan & Wali */}
                  <div className="flex flex-col gap-3 rounded-[6px] border border-[#DCE4E2] bg-[#F7FAF9] p-3.5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-xs font-semibold text-[#0B4F49]">Pengaturan Kelas & Wali</h3>
                      <form action={deleteKelas}>
                        <input type="hidden" name="id" value={item.id} />
                        <button className="text-xs font-medium text-[#B91C1C] hover:underline">
                          Hapus Kelas
                        </button>
                      </form>
                    </div>

                    <form action={saveKelas} className="grid gap-2 sm:grid-cols-4">
                      <input type="hidden" name="id" value={item.id} />
                      <select
                        name="tahun_ajaran_id"
                        defaultValue={item.tahun_ajaran_id}
                        className="rounded-[6px] border border-[#DCE4E2] bg-white px-2.5 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
                      >
                        {tahun.map((year) => (
                          <option key={year.id} value={year.id}>
                            {year.nama}
                          </option>
                        ))}
                      </select>
                      <select
                        name="tingkat"
                        defaultValue={item.tingkat}
                        className="rounded-[6px] border border-[#DCE4E2] bg-white px-2.5 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
                      >
                        <option value="7">7</option>
                        <option value="8">8</option>
                        <option value="9">9</option>
                      </select>
                      <input
                        name="nama"
                        defaultValue={item.nama}
                        className="rounded-[6px] border border-[#DCE4E2] bg-white px-2.5 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
                      />
                      <button className="rounded-[6px] bg-[#0F766E] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0B4F49]">
                        Simpan Ubah
                      </button>
                    </form>

                    <form action={assignWaliKelas} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input type="hidden" name="kelas_id" value={item.id} />
                      <select
                        name="guru_id"
                        defaultValue={waliId}
                        className="rounded-[6px] border border-[#DCE4E2] bg-white px-2.5 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
                      >
                        <option value="">Belum ada wali kelas</option>
                        {daftarGuru.map((teacher) => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.nama}
                            {daftarRole.some((role) => role.guru_id === teacher.id) ? ' · Wali Kelas' : ''}
                          </option>
                        ))}
                      </select>
                      <button className="rounded-[6px] bg-[#1C2321] px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0B4F49]">
                        Simpan Wali
                      </button>
                    </form>
                  </div>

                  {/* List Siswa di Kelas Ini */}
                  <div>
                    <h3 className="mb-2 text-xs font-semibold text-[#0B4F49]">
                      Daftar Siswa Terdaftar ({students.length})
                    </h3>
                    <div className="divide-y divide-[#DCE4E2] rounded-[6px] border border-[#DCE4E2] bg-white">
                      {students.map((student) => (
                        <div
                          key={student.id}
                          className="flex flex-col gap-2 px-3.5 py-2.5 transition-colors hover:bg-[#F7FAF9] sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-xs font-medium text-[#1C2321]">{student.nama}</p>
                            <p className="text-[11px] text-[#5B6B68]">
                              <span className="font-mono tabular-nums">{student.nis}</span> ·{' '}
                              <span
                                className={`font-medium ${student.is_aktif ? 'text-[#0F766E]' : 'text-[#5B6B68]'
                                  }`}
                              >
                                {student.is_aktif ? 'Aktif' : 'Nonaktif'}
                              </span>
                            </p>
                          </div>
                          <form action={moveSiswa} className="grid gap-2 min-[420px]:grid-cols-[1fr_auto] sm:flex">
                            <input type="hidden" name="siswa_id" value={student.id} />
                            <select
                              name="kelas_id"
                              defaultValue={item.id}
                              className="rounded-[6px] border border-[#DCE4E2] bg-white px-2.5 py-1 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
                            >
                              <option value="">Tanpa kelas</option>
                              {daftarKelas
                                .filter((target) => target.id !== item.id)
                                .map((target) => (
                                  <option key={target.id} value={target.id}>
                                    {target.nama}
                                  </option>
                                ))}
                            </select>
                            <button className="rounded-[6px] border border-[#DCE4E2] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1C2321] transition-colors hover:bg-[#F7FAF9]">
                              Pindahkan
                            </button>
                          </form>
                        </div>
                      ))}
                      {students.length === 0 && (
                        <p className="px-3 py-6 text-center text-xs text-[#5B6B68]">
                          Belum ada siswa yang terdaftar di kelas ini.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </details>
            )
          })}

          {daftarKelas.length === 0 && (
            <div className="rounded-[6px] border border-dashed border-[#DCE4E2] bg-white p-12 text-center text-xs text-[#5B6B68]">
              Belum ada data kelas. Tambahkan kelas melalui form di samping.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
