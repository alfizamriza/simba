import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/auth/require-feature'
import { bisaEdit, getVisibleClassIds, isAdmin } from '@/lib/auth/roles'
import { saveSiswa, setSiswaStatus } from '../actions'
import { unpairKartu } from '../../pairing-kartu/actions'
import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const supabase = createServiceRoleClient()
  const { data: student } = await supabase.from('siswa').select('nama').eq('id', id).maybeSingle()
  
  return {
    title: student ? `${student.nama} - Detail Siswa` : 'Detail Siswa',
    description: student ? `Profil lengkap, riwayat absensi, dan kartu RFID atas nama ${student.nama} di SIMBA.` : 'Detail Siswa',
  }
}

type Siswa = { id: string; nis: string; nama: string; kelas_id: string | null; is_aktif: boolean }
type Kelas = { id: string; nama: string; tingkat: number }
type Kartu = { id: string; uid_kartu: string; is_aktif: boolean }
type Log = { id: string; tanggal: string; status: string; sumber: string; keterangan: string | null; waktu_scan: string | null }

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatTanggalIndo(dateStr: string) {
  try {
    // Menghindari timezone shift dengan parse YYYY-MM-DD sebagai waktu lokal
    const [year, month, day] = dateStr.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export default async function SiswaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ month?: string }>
}) {
  const session = await requireFeature('siswa')
  const { id } = await params
  const { month = new Date().toISOString().slice(0, 7) } = await searchParams
  const validMonth = /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7)
  const monthStart = `${validMonth}-01`
  const monthEndDate = new Date(`${monthStart}T00:00:00Z`)
  monthEndDate.setUTCMonth(monthEndDate.getUTCMonth() + 1)
  monthEndDate.setUTCDate(0)

  const supabase = createServiceRoleClient()
  const visibleClassIds = getVisibleClassIds(session)

  let studentQuery = supabase.from('siswa').select('id, nis, nama, kelas_id, is_aktif').eq('id', id)
  if (visibleClassIds) {
    studentQuery = studentQuery.in(
      'kelas_id',
      visibleClassIds.length ? visibleClassIds : ['00000000-0000-0000-0000-000000000000']
    )
  }

  const { data: siswa } = await studentQuery.maybeSingle()
  if (!siswa) notFound()

  const { data: activeSemester } = await supabase.from('semester').select('id').eq('is_aktif', true).maybeSingle()
  const [{ data: allKelas }, { data: cards }, { data: logs }] = await Promise.all([
    supabase.from('kelas').select('id, nama, tingkat').order('tingkat').order('nama'),
    supabase.from('kartu_rfid').select('id, uid_kartu, is_aktif').eq('siswa_id', siswa.id),
    supabase
      .from('log_absensi')
      .select('id, tanggal, status, sumber, keterangan, waktu_scan')
      .eq('siswa_id', siswa.id)
      .eq('semester_id', activeSemester?.id ?? '00000000-0000-0000-0000-000000000000')
      .gte('tanggal', monthStart)
      .lte('tanggal', dateKey(monthEndDate))
      .order('tanggal', { ascending: false }),
  ])

  const student = siswa as Siswa
  const allClasses = (allKelas ?? []) as Kelas[]
  const classData = allClasses.find((c) => c.id === student.kelas_id) ?? null
  const cardList = (cards ?? []) as Kartu[]
  const logList = (logs ?? []) as Log[]
  const admin = isAdmin(session)
  const canEdit = bisaEdit(session)

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <Link href="/siswa" className="inline-block text-sm font-semibold text-teal-700 hover:underline">
        Kembali ke Data Siswa
      </Link>

      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">Detail Siswa</p>
            <h1 className="mt-1 break-words text-xl font-bold text-slate-900 sm:text-2xl">{student.nama}</h1>
            <p className="mt-1 text-sm text-slate-500">
              NIS {student.nis} - {classData ? `${classData.nama} - Tingkat ${classData.tingkat}` : 'Belum ada kelas'}
            </p>
          </div>
          <span className={`h-fit w-fit rounded-full px-3 py-1 text-xs font-semibold ${student.is_aktif ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
            {student.is_aktif ? 'Aktif' : 'Nonaktif'}
          </span>
        </div>

        {canEdit && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <form action={saveSiswa} className="grid gap-3 md:grid-cols-[180px_1fr_220px_auto]">
              <input type="hidden" name="id" value={student.id} />
              <input name="nis" defaultValue={student.nis} required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="nama" defaultValue={student.nama} required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select name="kelas_id" defaultValue={student.kelas_id ?? ''} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Belum ada kelas</option>
                {allClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    Kelas {item.nama}
                  </option>
                ))}
              </select>
              <button className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white">Simpan</button>
            </form>
            <form action={setSiswaStatus} className="mt-3">
              <input type="hidden" name="id" value={student.id} />
              <input type="hidden" name="is_aktif" value={String(!student.is_aktif)} />
              <button className="text-xs font-semibold text-rose-600">
                {student.is_aktif ? 'Nonaktifkan siswa' : 'Aktifkan siswa'}
              </button>
            </form>
          </div>
        )}
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold text-slate-900">Kartu RFID</h2>
          {cardList.length === 0 && <span className="text-sm text-slate-500">Belum terpasang</span>}
        </div>
        {cardList.map((card) => (
          <div key={card.id} className="mt-3 flex flex-col gap-3 rounded-lg bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="break-all font-mono text-sm font-semibold">{card.uid_kartu}</p>
              <p className="text-xs text-slate-500">{card.is_aktif ? 'Aktif' : 'Nonaktif'}</p>
            </div>
            {admin && (
              <form action={unpairKartu}>
                <input type="hidden" name="id" value={card.id} />
                <button className="text-xs font-semibold text-rose-600">Lepas pairing</button>
              </form>
            )}
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
          <div>
            <h2 className="font-semibold text-slate-900">Riwayat Absensi</h2>
            <p className="text-xs text-slate-500">{logList.length} catatan pada bulan yang dipilih.</p>
          </div>
          <form method="get" className="grid gap-2 min-[420px]:grid-cols-[1fr_auto]">
            <input type="month" name="month" defaultValue={validMonth} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Filter</button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Tanggal</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Sumber</th>
                <th className="px-5 py-3">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logList.map((log) => (
                <tr key={log.id}>
                  <td className="px-5 py-3">
                    <span className="font-semibold text-slate-800">{formatTanggalIndo(log.tanggal)}</span>
                    {log.waktu_scan && (
                      <span className="ml-2.5 inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600">
                        {new Date(log.waktu_scan).toLocaleTimeString('id-ID', { 
                          hour: '2-digit', 
                          minute: '2-digit', 
                          timeZone: 'Asia/Jakarta' 
                        })} WIB
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 capitalize">{log.status}</td>
                  <td className="px-5 py-3 uppercase text-slate-500">{log.sumber}</td>
                  <td className="px-5 py-3 text-slate-500">{log.keterangan ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logList.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-slate-500">Belum ada riwayat pada bulan ini.</p>
          )}
        </div>
      </section>
    </div>
  )
}
