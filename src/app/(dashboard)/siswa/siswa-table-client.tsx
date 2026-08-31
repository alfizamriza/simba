'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { setSiswaStatus, pindahkanSiswaMassal } from './actions'

interface Kelas {
  id: string
  nama: string
  tingkat: number
}

interface Siswa {
  id: string
  nis: string
  nama: string
  kelas_id: string | null;
  is_aktif: boolean
}

interface SiswaTableClientProps {
  students: Siswa[]
  classes: Kelas[]
  cardSetIds: string[]
  attendanceRecord: Record<string, string>
  classRecord: Record<string, Kelas>
  canEdit: boolean
}

export default function SiswaTableClient({
  students,
  classes,
  cardSetIds,
  attendanceRecord,
  classRecord,
  canEdit,
}: SiswaTableClientProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [kelasIdTujuan, setKelasIdTujuan] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ sukses: boolean; teks: string } | null>(null)

  const cardSet = new Set(cardSetIds)

  function handleSelectRow(id: string, checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => [...prev, id])
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id))
    }
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(students.map((s) => s.id))
    } else {
      setSelectedIds([])
    }
  }

  function handleCancelSelection() {
    setSelectedIds([])
    setKelasIdTujuan('')
  }

  async function handleSubmitBulkMove(e: React.FormEvent) {
    e.preventDefault()
    if (!kelasIdTujuan || selectedIds.length === 0) return

    const targetClass = classes.find((c) => c.id === kelasIdTujuan)
    const targetClassName = targetClass ? `Kelas ${targetClass.nama}` : 'Belum Berkelas'

    const confirmMsg = `Apakah Anda yakin ingin memindahkan ${selectedIds.length} siswa ke ${targetClassName}?`
    if (!window.confirm(confirmMsg)) return

    setLoading(true)
    setMessage(null)

    try {
      const res = await pindahkanSiswaMassal(selectedIds, kelasIdTujuan === 'unassigned' ? '' : kelasIdTujuan)
      if (res.sukses) {
        setMessage({ sukses: true, teks: res.pesan })
        setSelectedIds([])
        setKelasIdTujuan('')
        router.refresh()
      } else {
        setMessage({ sukses: false, teks: res.pesan })
      }
    } catch (err: any) {
      setMessage({ sukses: false, teks: err.message || 'Gagal memindahkan siswa.' })
    } finally {
      setLoading(false)
    }
  }

  const isAllSelected = students.length > 0 && selectedIds.length === students.length

  const getStatusStyle = (status: string | undefined) => {
    switch (status) {
      case 'hadir':
        return {
          border: 'border-l-[#0F766E]',
          badge: 'bg-[#E4F5F3] text-[#0F766E]',
          label: 'Hadir',
        }
      case 'terlambat':
        return {
          border: 'border-l-[#B45309]',
          badge: 'bg-[#FEF3C7] text-[#B45309]',
          label: 'Terlambat',
        }
      case 'sakit':
        return {
          border: 'border-l-[#0369A1]',
          badge: 'bg-[#E0F2FE] text-[#0369A1]',
          label: 'Sakit',
        }
      case 'izin':
        return {
          border: 'border-l-[#6D28D9]',
          badge: 'bg-[#F3E8FF] text-[#6D28D9]',
          label: 'Izin',
        }
      case 'alpa':
        return {
          border: 'border-l-[#B91C1C]',
          badge: 'bg-[#FEE2E2] text-[#B91C1C]',
          label: 'Alpa',
        }
      default:
        return {
          border: 'border-l-[#DCE4E2]',
          badge: 'bg-[#F7FAF9] text-[#5B6B68] border border-[#DCE4E2]',
          label: 'Belum Absen',
        }
    }
  }

  const selectedClassName = kelasIdTujuan === 'unassigned'
    ? 'Belum Berkelas'
    : classes.find((c) => c.id === kelasIdTujuan)?.nama
      ? `Kelas ${classes.find((c) => c.id === kelasIdTujuan)?.nama}`
      : ''

  return (
    <div className="relative">
      {/* Sticky Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-[6px] bg-[#0B4F49] p-3 text-xs text-white shadow-md transition-all duration-300">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{selectedIds.length} siswa dipilih</span>
          </div>

          <form onSubmit={handleSubmitBulkMove} className="flex flex-wrap items-center gap-2">
            <select
              required
              value={kelasIdTujuan}
              onChange={(e) => setKelasIdTujuan(e.target.value)}
              className="rounded-[4px] border border-white/20 bg-white/10 px-2 py-1 text-xs text-white focus:border-white focus:outline-none"
            >
              <option value="" className="text-[#1C2321]">-- Pindahkan ke Kelas --</option>
              <option value="unassigned" className="text-[#1C2321]">Belum Berkelas</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id} className="text-[#1C2321]">
                  Kelas {item.nama}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={loading || !kelasIdTujuan}
              className="rounded-[4px] bg-white px-3 py-1 font-semibold text-[#0B4F49] transition-colors hover:bg-white/90 disabled:opacity-50"
            >
              {loading ? 'Memindahkan...' : `Pindahkan ke ${selectedClassName}`}
            </button>

            <button
              type="button"
              onClick={handleCancelSelection}
              className="rounded-[4px] border border-white/30 bg-transparent px-3 py-1 font-medium text-white transition-colors hover:bg-white/10"
            >
              Batal Pilih
            </button>
          </form>
        </div>
      )}

      {/* Toast Alert */}
      {message && (
        <div
          onClick={() => setMessage(null)}
          className={`cursor-pointer rounded-[6px] border p-3.5 my-3 text-xs flex justify-between items-center transition-all ${
            message.sukses
              ? 'border-[#0F766E]/20 bg-[#E4F5F3] text-[#0F766E]'
              : 'border-[#B91C1C]/20 bg-[#FEE2E2] text-[#B91C1C]'
          }`}
        >
          <span>{message.teks}</span>
          <span className="font-bold opacity-60 hover:opacity-100">&times;</span>
        </div>
      )}

      {/* Tabel Data */}
      <div className="w-full overflow-x-auto mt-3">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="border-b border-[#DCE4E2] bg-[#F7FAF9] text-[11px] font-semibold text-[#5B6B68]">
            <tr>
              <th className="w-10 px-4 py-3 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-[#DCE4E2] text-[#0F766E] focus:ring-[#0F766E] cursor-pointer"
                />
              </th>
              <th className="px-4 py-3">Nama Siswa</th>
              <th className="px-4 py-3">NIS</th>
              <th className="px-4 py-3">Kelas</th>
              <th className="px-4 py-3">Kartu RFID</th>
              <th className="px-4 py-3">Kehadiran Hari Ini</th>
              <th className="px-4 py-3">Status AKA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DCE4E2] text-[#1C2321]">
            {students.map((student) => {
              const rawStatus = attendanceRecord[student.id]
              const statusStyle = getStatusStyle(rawStatus)
              const classData = student.kelas_id ? classRecord[student.kelas_id] : null
              const hasCard = cardSet.has(student.id)
              const isSelected = selectedIds.includes(student.id)

              return (
                <tr
                  key={student.id}
                  className={`border-l-4 ${statusStyle.border} transition-colors ${
                    isSelected ? 'bg-[#E4F5F3]/30' : 'hover:bg-[#F7FAF9]'
                  }`}
                >
                  <td className="w-10 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleSelectRow(student.id, e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-[#DCE4E2] text-[#0F766E] focus:ring-[#0F766E] cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/siswa/${student.id}`}
                      className="text-[#0F766E] hover:underline"
                    >
                      {student.nama}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-[#5B6B68] tabular-nums">{student.nis}</td>
                  <td className="px-4 py-3 text-[#1C2321]">{classData?.nama ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-[4px] px-2 py-0.5 text-[11px] font-medium ${
                        hasCard
                          ? 'bg-[#E4F5F3] text-[#0F766E]'
                          : 'bg-[#F7FAF9] text-[#5B6B68] border border-[#DCE4E2]'
                      }`}
                    >
                      {hasCard ? 'Terpasang' : 'Belum Ada'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-[4px] px-2 py-0.5 text-[11px] font-medium ${statusStyle.badge}`}>
                      {statusStyle.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canEdit ? (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault()
                          const formData = new FormData()
                          formData.append('id', student.id)
                          formData.append('is_aktif', String(!student.is_aktif))
                          await setSiswaStatus(formData)
                          router.refresh()
                        }}
                      >
                        <button
                          type="submit"
                          className={`text-xs font-medium transition-colors ${
                            student.is_aktif ? 'text-[#0F766E] hover:text-[#0B4F49]' : 'text-[#5B6B68] hover:text-[#1C2321]'
                          }`}
                        >
                          {student.is_aktif ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </form>
                    ) : (
                      <span className={`text-xs font-medium ${student.is_aktif ? 'text-[#0F766E]' : 'text-[#5B6B68]'}`}>
                        {student.is_aktif ? 'Aktif' : 'Nonaktif'}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {students.length === 0 && (
          <p className="px-5 py-12 text-center text-xs text-[#5B6B68]">
            Tidak ada data siswa yang cocok dengan kriteria pencarian.
          </p>
        )}
      </div>
    </div>
  )
}
