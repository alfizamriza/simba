import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { saveJadwal, addHariLibur, deleteHariLibur } from '../actions'

type Kelas = { id: string; nama: string }
type Jadwal = { 
  kelas_id: string; 
  hari: number; 
  jam_masuk: string; 
  batas_terlambat: string; 
  jam_pulang: string; 
  is_aktif: boolean 
}

const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export default async function JadwalPage() {
  await requireAdmin()
  const supabase = createServiceRoleClient()

  // Ambil kelas, jadwal, dan daftar hari libur secara bersamaan
  const [{ data: kelas }, resJadwal, resLibur] = await Promise.all([
    supabase.from('kelas').select('id, nama').order('nama'),
    supabase.from('jadwal_jam_masuk').select('kelas_id, hari, jam_masuk, batas_terlambat, jam_pulang, is_aktif'),
    supabase.from('hari_libur').select('tanggal, keterangan').order('tanggal', { ascending: true }),
  ])

  const classes = (kelas ?? []) as Kelas[]
  let schedules: Jadwal[] = []

  // Fallback pengisian jadwal jika kolom jam_pulang / is_aktif belum ada di database
  if (resJadwal.data) {
    schedules = resJadwal.data.map((item: any) => ({
      kelas_id: item.kelas_id,
      hari: item.hari,
      jam_masuk: item.jam_masuk,
      batas_terlambat: item.batas_terlambat,
      jam_pulang: item.jam_pulang ?? '15:00:00',
      is_aktif: item.is_aktif ?? true,
    }))
  } else {
    const { data: fallbackData } = await supabase.from('jadwal_jam_masuk').select('kelas_id, hari, jam_masuk, batas_terlambat')
    if (fallbackData) {
      schedules = fallbackData.map((item: any) => ({
        kelas_id: item.kelas_id,
        hari: item.hari,
        jam_masuk: item.jam_masuk,
        batas_terlambat: item.batas_terlambat,
        jam_pulang: '15:00:00',
        is_aktif: true,
      }))
    }
  }

  const scheduleMap = new Map(schedules.map((item) => [`${item.kelas_id}:${item.hari}`, item]))
  const holidays = resLibur?.data ?? []

  return (
    <div className="w-full min-w-0 space-y-6 font-sans text-[#1C2321] sm:space-y-8">
      {/* Header Section */}
      <header className="pb-2 border-b border-[#DCE4E2]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0F766E]">
          ADMINISTRATOR
        </span>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-[#0B4F49] sm:text-2xl">
          Jadwal & Hari Libur Sekolah
        </h1>
        <p className="mt-0.5 text-xs text-[#5B6B68]">
          Atur jam sekolah harian, aktifkan/nonaktifkan hari KBM (seperti Sabtu/Minggu), dan kelola libur nasional.
        </p>
      </header>

      {/* Daftar Kelas & Form Jadwal */}
      {classes.map((kelas) => (
        <section
          key={kelas.id}
          className="rounded-[6px] border border-[#DCE4E2] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5"
        >
          <h2 className="text-xs font-bold text-[#0B4F49] border-b border-[#DCE4E2]/60 pb-2 mb-4">Kelas {kelas.nama}</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {days.map((day, index) => {
              const item = scheduleMap.get(`${kelas.id}:${index + 1}`)
              return (
                <form
                  key={day}
                  action={saveJadwal}
                  className="rounded-[6px] border border-[#DCE4E2] bg-[#F7FAF9] p-3.5 flex flex-col justify-between"
                >
                  <input type="hidden" name="kelas_id" value={kelas.id} />
                  <input type="hidden" name="hari" value={index + 1} />

                  <div className="space-y-2.5">
                    <p className="text-xs font-bold text-[#1C2321] border-b border-[#DCE4E2]/50 pb-1">{day}</p>

                    <label className="block text-[11px] font-medium text-[#5B6B68]">
                      Status Hari KBM
                      <select
                        name="is_aktif"
                        defaultValue={String(item?.is_aktif ?? true)}
                        className="mt-1 w-full rounded-[6px] border border-[#DCE4E2] bg-white px-2 py-1 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none font-medium"
                      >
                        <option value="true">Aktif (Sekolah)</option>
                        <option value="false">Libur (Tutup)</option>
                      </select>
                    </label>

                    <label className="block text-[11px] font-medium text-[#5B6B68]">
                      Jam Masuk
                      <input
                        name="jam_masuk"
                        type="time"
                        defaultValue={item?.jam_masuk?.slice(0, 5) ?? '07:15'}
                        className="mt-1 w-full rounded-[6px] border border-[#DCE4E2] bg-white px-2 py-1 font-mono text-xs tabular-nums text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
                      />
                    </label>

                    <label className="block text-[11px] font-medium text-[#5B6B68]">
                      Batas Terlambat
                      <input
                        name="batas_terlambat"
                        type="time"
                        defaultValue={item?.batas_terlambat?.slice(0, 5) ?? '07:30'}
                        className="mt-1 w-full rounded-[6px] border border-[#DCE4E2] bg-white px-2 py-1 font-mono text-xs tabular-nums text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
                      />
                    </label>

                    <label className="block text-[11px] font-medium text-[#5B6B68]">
                      Jam Pulang (Tutup Absen)
                      <input
                        name="jam_pulang"
                        type="time"
                        defaultValue={item?.jam_pulang?.slice(0, 5) ?? '15:00'}
                        className="mt-1 w-full rounded-[6px] border border-[#DCE4E2] bg-white px-2 py-1 font-mono text-xs tabular-nums text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="mt-4 w-full rounded-[6px] bg-[#0F766E] px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0B4F49]"
                  >
                    Simpan Jadwal
                  </button>
                </form>
              )
            })}
          </div>
        </section>
      ))}

      {classes.length === 0 && (
        <div className="rounded-[6px] border border-dashed border-[#DCE4E2] bg-white p-10 text-center text-xs text-[#5B6B68]">
          Belum ada data kelas yang terdaftar.
        </div>
      )}

      {/* Kelola Hari Libur / Tanggal Merah */}
      <section className="rounded-[6px] border border-[#DCE4E2] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="border-b border-[#DCE4E2] bg-[#F7FAF9] px-5 py-3">
          <h2 className="text-xs font-bold text-[#0B4F49]">Kelola Hari Libur & Tanggal Merah</h2>
          <p className="text-[11px] text-[#5B6B68] mt-0.5">Daftarkan tanggal libur sekolah/nasional agar siswa tidak bisa melakukan absensi.</p>
        </div>

        <div className="p-4 sm:p-5 space-y-5">
          {/* Form Tambah Hari Libur */}
          <form action={addHariLibur} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] items-end border-b border-[#DCE4E2] pb-5">
            <label className="block text-xs font-semibold text-[#5B6B68]">
              Tanggal Libur
              <input
                type="date"
                required
                name="tanggal"
                className="mt-1 w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 font-mono text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
              />
            </label>
            <label className="block text-xs font-semibold text-[#5B6B68]">
              Keterangan Libur (misal: Tahun Baru Islam)
              <input
                type="text"
                required
                name="keterangan"
                placeholder="Keterangan hari libur..."
                className="mt-1 w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className="rounded-[6px] bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0B4F49]"
            >
              Tambah Libur
            </button>
          </form>

          {/* Daftar Hari Libur */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#0B4F49] mb-3">Daftar Tanggal Merah Terdaftar</h3>
            
            {holidays.length === 0 ? (
              <p className="text-center py-6 text-xs text-[#5B6B68] bg-[#F7FAF9] rounded-[6px] border border-dashed border-[#DCE4E2]">
                Belum ada tanggal merah yang terdaftar.
              </p>
            ) : (
              <div className="divide-y divide-[#DCE4E2] border border-[#DCE4E2] rounded-[6px] overflow-hidden bg-white">
                {holidays.map((holiday: any) => (
                  <div key={holiday.tanggal} className="flex items-center justify-between px-4 py-3 hover:bg-[#F7FAF9] transition-colors">
                    <div>
                      <p className="font-mono text-xs font-semibold text-[#1C2321]">
                        {new Date(holiday.tanggal).toLocaleDateString('id-ID', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                      <p className="text-[11px] text-[#5B6B68] mt-0.5">{holiday.keterangan}</p>
                    </div>
                    <form action={deleteHariLibur}>
                      <input type="hidden" name="tanggal" value={holiday.tanggal} />
                      <button
                        type="submit"
                        className="rounded-[6px] border border-[#FECDD3] bg-white px-2.5 py-1 text-xs font-medium text-[#E11D48] transition-colors hover:bg-[#FFE4E6]"
                      >
                        Hapus
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
