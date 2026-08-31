import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/auth/require-feature'
import { bisaAjukanPengajuan, bisaApprovePengajuan } from '@/lib/auth/roles'
import { decidePengajuan } from './actions'
import PengajuanForm from './pengajuan-form'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pengajuan Izin / Sakit',
  description: 'Kelola permohonan status ketidakhadiran, sakit, atau izin siswa SMP Sukma Bangsa Pidie.',
}

type Siswa = { id: string; nis: string; nama: string }
type Pengajuan = {
  id: string
  siswa_id: string
  tanggal: string
  jenis: string
  keterangan: string | null
  status: string
  lampiran_url: string | null
  catatan_approval: string | null
}

const tabs = [
  { key: 'pending', label: 'Menunggu Approval' },
  { key: 'approved', label: 'Disetujui' },
  { key: 'rejected', label: 'Ditolak' },
]

function getStatusLabel(status: string) {
  if (status === 'approved') return 'Disetujui'
  if (status === 'rejected') return 'Ditolak'
  return 'Menunggu'
}

function getStatusBadgeStyle(status: string) {
  if (status === 'approved') return 'bg-[#E4F5F3] text-[#0F766E]'
  if (status === 'rejected') return 'bg-[#FEE2E2] text-[#B91C1C]'
  return 'bg-[#FEF3C7] text-[#B45309]'
}

export default async function PengajuanPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await requireFeature('pengajuan')
  const { tab: rawTab = 'pending' } = await searchParams
  const tab = tabs.some((item) => item.key === rawTab) ? rawTab : 'pending'
  const supabase = await createClient()
  const canSubmit = bisaAjukanPengajuan(session)
  const canApprove = bisaApprovePengajuan(session)

  const [{ data: siswa }, { data: pengajuan }] = await Promise.all([
    supabase.from('siswa').select('id, nis, nama').eq('is_aktif', true).order('nama'),
    supabase
      .from('pengajuan_izin')
      .select('id, siswa_id, tanggal, jenis, keterangan, status, lampiran_url, catatan_approval')
      .eq('status', tab)
      .order('tanggal', { ascending: false })
      .limit(200),
  ])

  const students = (siswa ?? []) as Siswa[]
  const requests = (pengajuan ?? []) as Pengajuan[]
  const studentMap = new Map(students.map((item) => [item.id, item]))

  // Helper pemetaan gaya badge jenis pengajuan
  const getJenisBadgeStyle = (jenis: string) => {
    switch (jenis.toLowerCase()) {
      case 'sakit':
        return 'bg-[#E0F2FE] text-[#0369A1]'
      case 'izin':
        return 'bg-[#F3E8FF] text-[#6D28D9]'
      default:
        return 'bg-[#F7FAF9] text-[#5B6B68] border border-[#DCE4E2]'
    }
  }

  // Helper pemetaan indikator garis vertikal SIMBA
  const getBorderIndicator = (jenis: string) => {
    switch (jenis.toLowerCase()) {
      case 'sakit':
        return 'border-l-[#0369A1]'
      case 'izin':
        return 'border-l-[#6D28D9]'
      default:
        return 'border-l-[#DCE4E2]'
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5 font-sans text-[#1C2321] sm:space-y-6">
      {/* Header */}
      <header className="pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0F766E]">
          PRESENSI AKADEMIK
        </span>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-[#0B4F49] sm:text-2xl">
          Pengajuan Izin / Sakit
        </h1>
        <p className="mt-0.5 text-xs text-[#5B6B68]">
          Ajukan dan verifikasi permohonan status ketidakhadiran siswa.
        </p>
      </header>

      {/* Grid Layout Layout Utama */}
      <div className={`grid gap-6 ${canSubmit ? 'lg:grid-cols-[380px_1fr]' : ''}`}>
        {/* Section Form Tambah Pengajuan */}
        {canSubmit && (
          <section className="h-fit rounded-[6px] border border-[#DCE4E2] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
            <h2 className="mb-4 text-xs font-semibold text-[#0B4F49]">Ajukan Permohonan Baru</h2>
            <PengajuanForm
              students={students.map((item) => ({
                id: item.id,
                label: `${item.nama} (${item.nis})`,
              }))}
            />
          </section>
        )}

        {/* Section Daftar Pengajuan */}
        <section className="overflow-hidden rounded-[6px] border border-[#DCE4E2] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {/* Tab Navigation */}
          <nav className="flex overflow-x-auto border-b border-[#DCE4E2] bg-[#F7FAF9] px-2 sm:px-4">
            {tabs.map((item) => {
              const isActive = tab === item.key
              return (
                <Link
                  key={item.key}
                  href={`/pengajuan?tab=${item.key}`}
                  className={`shrink-0 border-b-2 px-3 py-3 text-xs font-medium transition-colors sm:px-4 ${isActive
                      ? 'border-[#0F766E] font-semibold text-[#0F766E]'
                      : 'border-transparent text-[#5B6B68] hover:text-[#1C2321]'
                    }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* List Content */}
          <div className="divide-y divide-[#DCE4E2]">
            {requests.map((item) => {
              const student = studentMap.get(item.siswa_id)
              return (
                <div
                  key={item.id}
                  className={`border-l-4 ${getBorderIndicator(item.jenis)} px-4 py-4 transition-colors hover:bg-[#F7FAF9] sm:px-5`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-xs text-[#1C2321]">
                          {student?.nama ?? 'Siswa'}
                        </p>
                        <span
                          className={`rounded-[4px] px-2 py-0.5 text-[10px] font-medium capitalize ${getJenisBadgeStyle(
                            item.jenis
                          )}`}
                        >
                          {item.jenis}
                        </span>
                      </div>

                      <p className="text-xs text-[#5B6B68]">
                        <span className="font-mono tabular-nums">{item.tanggal}</span>
                        {' · '}
                        <span>{item.keterangan || 'Tanpa keterangan'}</span>
                      </p>

                      {item.lampiran_url && (
                        <a
                          href={item.lampiran_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block text-[11px] font-medium text-[#0F766E] hover:underline"
                        >
                          Lihat Lampiran Berkas
                        </a>
                      )}

                      {item.catatan_approval && (
                        <p className="text-xs text-[#5B6B68] bg-[#F7FAF9] p-2 rounded-[4px] border border-[#DCE4E2] mt-1">
                          <span className="font-medium text-[#1C2321]">Catatan Verifikasi:</span>{' '}
                          {item.catatan_approval}
                        </p>
                      )}
                    </div>

                    {/* Form Keputusan / Badge Status */}
                    {tab === 'pending' && canApprove ? (
                      <form action={decidePengajuan} className="flex flex-col gap-2 sm:min-w-[220px]">
                        <input type="hidden" name="id" value={item.id} />
                        <input
                          name="catatan_approval"
                          placeholder="Catatan verifikasi (opsional)"
                          className="rounded-[6px] border border-[#DCE4E2] bg-white px-2.5 py-1.5 text-xs text-[#1C2321] placeholder-[#5B6B68] focus:border-[#0F766E] focus:outline-none"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            name="status"
                            value="approved"
                            className="flex-1 rounded-[6px] bg-[#0F766E] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0B4F49]"
                          >
                            Setujui
                          </button>
                          <button
                            name="status"
                            value="rejected"
                            className="flex-1 rounded-[6px] border border-[#B91C1C] bg-white px-3 py-1.5 text-xs font-medium text-[#B91C1C] transition-colors hover:bg-[#FEE2E2]"
                          >
                            Tolak
                          </button>
                        </div>
                      </form>
                    ) : (
                      <span
                        className={`inline-block self-start rounded-[4px] px-2.5 py-0.5 text-[11px] font-medium ${getStatusBadgeStyle(
                          item.status
                        )}`}
                      >
                        {getStatusLabel(item.status)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}

            {requests.length === 0 && (
              <p className="px-5 py-12 text-center text-xs text-[#5B6B68]">
                Belum ada pengajuan pada kategori ini.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
