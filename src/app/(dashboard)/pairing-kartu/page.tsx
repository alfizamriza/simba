import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireFeature } from '@/lib/auth/require-feature'
import PairingClient from './pairing-client'
import { setKartuStatus, unpairKartu } from './actions'

type Siswa = { id: string; nis: string; nama: string }
type Kartu = { id: string; uid_kartu: string; siswa_id: string; is_aktif: boolean }
type Tap = { uid_kartu: string; created_at: string }

export default async function PairingKartuPage() {
  await requireAdmin()
  await requireFeature('pairing-kartu')

  const supabase = createServiceRoleClient()
  const [{ data: siswa }, { data: kartu }, { data: taps }] = await Promise.all([
    supabase.from('siswa').select('id, nis, nama').eq('is_aktif', true).order('nama'),
    supabase.from('kartu_rfid').select('id, uid_kartu, siswa_id, is_aktif').order('uid_kartu'),
    supabase.from('pairing_requests').select('uid_kartu, created_at').order('created_at', { ascending: false }).limit(20),
  ])

  const students = (siswa ?? []) as Siswa[]
  const cards = (kartu ?? []) as Kartu[]
  const pairedUids = new Set(cards.filter((card) => card.is_aktif).map((card) => card.uid_kartu))
  const unpairedStudents = students
    .filter((student) => !cards.some((card) => card.siswa_id === student.id && card.is_aktif))
    .map((student) => ({ id: student.id, label: `${student.nama} · ${student.nis}` }))
  const initialTaps = ((taps ?? []) as Tap[]).filter((tap) => !pairedUids.has(tap.uid_kartu))
  const studentMap = new Map(students.map((student) => [student.id, student]))

  return (
    <div className="w-full min-w-0 space-y-5 font-sans text-[#1C2321] sm:space-y-6">
      {/* Header Section */}
      <header className="pb-2 border-b border-[#DCE4E2]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0F766E]">
          ADMINISTRATOR
        </span>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-[#0B4F49] sm:text-2xl">
          Pairing Kartu RFID
        </h1>
        <p className="mt-0.5 text-xs text-[#5B6B68]">
          Tap kartu pada reader IoT, pilih siswa yang bersangkutan, lalu pasangkan UID yang terdeteksi.
        </p>
      </header>

      {/* Component Interaktif Client */}
      <PairingClient students={unpairedStudents} initialTaps={initialTaps} pairedUids={[...pairedUids]} />

      {/* Tabel / Lista Kartu Terpasang */}
      <section className="overflow-hidden rounded-[6px] border border-[#DCE4E2] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="border-b border-[#DCE4E2] bg-[#F7FAF9] px-5 py-3">
          <h2 className="text-xs font-semibold text-[#0B4F49]">Daftar Kartu Terpasang</h2>
        </div>

        <div className="divide-y divide-[#DCE4E2]">
          {cards.map((card) => {
            const student = studentMap.get(card.siswa_id)
            return (
              <div key={card.id} className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-[#F7FAF9] sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tabular-nums text-[#1C2321]">
                    {card.uid_kartu}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#5B6B68]">
                    {student?.nama ?? 'Siswa tidak ditemukan'} · <span className="font-mono tabular-nums">{student?.nis ?? '-'}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                  <form action={setKartuStatus}>
                    <input type="hidden" name="id" value={card.id} />
                    <input type="hidden" name="is_aktif" value={String(!card.is_aktif)} />
                    <button
                      type="submit"
                      className={`rounded-[6px] px-3 py-1.5 text-xs font-medium transition-colors ${card.is_aktif
                          ? 'bg-[#E4F5F3] text-[#0F766E] hover:bg-[#0F766E]/20'
                          : 'bg-[#F7FAF9] border border-[#DCE4E2] text-[#5B6B68] hover:bg-[#E4F5F3]/50'
                        }`}
                    >
                      {card.is_aktif ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </form>

                  <form action={unpairKartu}>
                    <input type="hidden" name="id" value={card.id} />
                    <button
                      type="submit"
                      className="rounded-[6px] border border-[#FECDD3] bg-white px-3 py-1.5 text-xs font-medium text-[#E11D48] transition-colors hover:bg-[#FFE4E6]"
                    >
                      Lepas Pair
                    </button>
                  </form>
                </div>
              </div>
            )
          })}

          {cards.length === 0 && (
            <p className="px-5 py-8 text-center text-xs text-[#5B6B68]">
              Belum ada kartu RFID yang terpasang.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
