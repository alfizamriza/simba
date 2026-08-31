'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { updateGuru, resetGuruPassword } from '../actions'

interface ClassOption {
  id: string
  nama: string
  tingkat: number
}

interface Teacher {
  id: string
  user_id: string
  nip: string
  nama: string
  no_hp: string | null;
  is_aktif: boolean
}

interface TeacherRole {
  role: string
  kelas_id: string | null
}

interface EditGuruClientProps {
  teacher: Teacher
  teacherRoles: TeacherRole[]
  classes: ClassOption[]
  kelasTerpakaiIds: string[]
}

const initialUpdateState = { ok: false, message: '' }

export default function EditGuruClient({
  teacher,
  teacherRoles,
  classes,
  kelasTerpakaiIds,
}: EditGuruClientProps) {
  const [updateState, updateAction, updatePending] = useActionState(updateGuru, initialUpdateState)
  const [resetState, setResetState] = useState<{ ok: boolean; message: string; password?: string } | null>(null)
  const [resetPending, setResetPending] = useState(false)

  const initialRoleList = teacherRoles.map((r) => r.role)
  const [selectedRoles, setSelectedRoles] = useState<string[]>(initialRoleList)
  
  const initialWaliClass = teacherRoles.find((r) => r.role === 'wali_kelas')?.kelas_id ?? ''
  const [waliClassId, setWaliClassId] = useState(initialWaliClass)

  const initialMapelClasses = teacherRoles.filter((r) => r.role === 'guru_mapel').map((r) => r.kelas_id).filter(Boolean) as string[]
  const [mapelClassIds, setMapelClassIds] = useState<string[]>(initialMapelClasses)

  const [isAktif, setIsAktif] = useState(teacher.is_aktif)

  const availableClassesForWali = classes.filter((c) => !kelasTerpakaiIds.includes(c.id))

  function handleRoleChange(role: string, checked: boolean) {
    if (checked) {
      setSelectedRoles((prev) => [...prev, role])
    } else {
      setSelectedRoles((prev) => prev.filter((r) => r !== role))
    }
  }

  function handleMapelClassChange(classId: string, checked: boolean) {
    if (checked) {
      setMapelClassIds((prev) => [...prev, classId])
    } else {
      setMapelClassIds((prev) => prev.filter((id) => id !== classId))
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!window.confirm('Apakah Anda yakin ingin mereset password guru ini?')) return
    setResetPending(true)
    setResetState(null)
    
    const formData = new FormData()
    formData.append('id', teacher.id)
    formData.append('user_id', teacher.user_id)

    try {
      const res = await resetGuruPassword(formData)
      setResetState(res)
    } catch (err: any) {
      setResetState({ ok: false, message: err.message || 'Gagal mereset password.' })
    } finally {
      setResetPending(false)
    }
  }

  return (
    <div className="w-full space-y-6 font-sans text-[#1C2321] p-6 lg:p-8">
      <div className="space-y-2">
        <Link href="/guru" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F766E] hover:underline">
          &larr; Kembali ke Daftar Guru
        </Link>
        <header className="pb-2 border-b border-[#DCE4E2]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0F766E]">
            EDIT AKUN GURU
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0B4F49]">
            {teacher.nama}
          </h1>
          <p className="mt-0.5 text-xs text-[#5B6B68]">
            NIP: <span className="font-mono tabular-nums">{teacher.nip}</span> · Status: {isAktif ? 'Aktif' : 'Nonaktif'}
          </p>
        </header>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <form action={updateAction} className="rounded-[6px] border border-[#DCE4E2] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] space-y-4">
            <h2 className="text-xs font-semibold text-[#0B4F49] uppercase tracking-wider">Informasi Akun & Akses</h2>

            <input type="hidden" name="id" value={teacher.id} />
            <input type="hidden" name="user_id" value={teacher.user_id} />
            <input type="hidden" name="is_aktif" value={String(isAktif)} />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#1C2321]">Nama Lengkap</label>
                <input
                  name="nama"
                  required
                  defaultValue={teacher.nama}
                  className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#1C2321]">Nomor Telepon / WA (Opsional)</label>
                <input
                  name="no_hp"
                  defaultValue={teacher.no_hp ?? ''}
                  className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
                />
              </div>
            </div>

            <fieldset className="rounded-[6px] border border-[#DCE4E2] bg-[#F7FAF9] p-4">
              <legend className="px-1 text-[11px] font-semibold text-[#5B6B68]">Peran (Role) Guru</legend>
              <div className="grid gap-3 pt-1 sm:grid-cols-4">
                {(['admin', 'wali_kelas', 'guru_mapel', 'kepala_sekolah'] as const).map((role) => (
                  <label key={role} className="flex items-center gap-2 text-xs font-medium text-[#1C2321] capitalize">
                    <input
                      type="checkbox"
                      name="roles"
                      value={role}
                      checked={selectedRoles.includes(role)}
                      onChange={(e) => handleRoleChange(role, e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-[#DCE4E2] text-[#0F766E] focus:ring-[#0F766E]"
                    />
                    {role.replace('_', ' ')}
                  </label>
                ))}
              </div>
            </fieldset>

            {selectedRoles.includes('wali_kelas') && (
              <div className="rounded-[6px] border border-[#DCE4E2] bg-[#F7FAF9] p-4">
                <label className="mb-1 block text-xs font-semibold text-[#0B4F49]">Alokasi Kelas Wali</label>
                <select
                  name="kelas_id"
                  required
                  value={waliClassId}
                  onChange={(e) => setWaliClassId(e.target.value)}
                  className="w-full max-w-md rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
                >
                  <option value="">-- Pilih Kelas --</option>
                  {waliClassId && !availableClassesForWali.some((c) => c.id === waliClassId) && (
                    <option value={waliClassId}>
                      Kelas {classes.find((c) => c.id === waliClassId)?.nama ?? ''} (Saat ini)
                    </option>
                  )}
                  {availableClassesForWali.map((item) => (
                    <option key={item.id} value={item.id}>
                      Kelas {item.nama}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-[#5B6B68]">Menampilkan kelas yang belum diisi oleh wali kelas aktif lain.</p>
              </div>
            )}

            {selectedRoles.includes('guru_mapel') && (
              <div className="rounded-[6px] border border-[#DCE4E2] bg-[#F7FAF9] p-4">
                <label className="mb-2 block text-xs font-semibold text-[#0B4F49]">Kelas Diajar Mapel (Bisa pilih banyak)</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {classes.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-xs text-[#1C2321]">
                      <input
                        type="checkbox"
                        name="mapel_kelas_ids"
                        value={item.id}
                        checked={mapelClassIds.includes(item.id)}
                        onChange={(e) => handleMapelClassChange(item.id, e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-[#DCE4E2] text-[#0F766E] focus:ring-[#0F766E]"
                      />
                      Kelas {item.nama}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-[#DCE4E2]">
              <button
                type="submit"
                disabled={updatePending}
                className="rounded-[6px] bg-[#0F766E] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0B4F49] disabled:opacity-50"
              >
                {updatePending ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>

            {updateState.message && (
              <div
                className={`rounded-[4px] border px-3 py-2 text-xs ${
                  updateState.ok ? 'border-[#0F766E] bg-[#E4F5F3] text-[#0F766E]' : 'border-[#B91C1C] bg-[#FEE2E2] text-[#B91C1C]'
                }`}
              >
                {updateState.message}
              </div>
            )}
          </form>
        </div>

        <div className="space-y-6">
          <section className="rounded-[6px] border border-[#DCE4E2] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] space-y-4">
            <h2 className="text-xs font-semibold text-[#0B4F49] uppercase tracking-wider">Status Akun & Kontrol</h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-[4px] border border-[#DCE4E2] bg-[#F7FAF9] p-3">
                <div>
                  <p className="text-xs font-semibold text-[#1C2321]">
                    {isAktif ? 'Akun Aktif' : 'Akun Nonaktif'}
                  </p>
                  <p className="text-[10px] text-[#5B6B68]">
                    {isAktif ? 'Guru dapat masuk ke aplikasi SIMBA.' : 'Guru diblokir dari sistem.'}
                  </p>
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (isAktif) {
                        if (window.confirm('Apakah Anda yakin ingin menonaktifkan akun guru ini? Guru ini tidak akan bisa login lagi.')) {
                          setIsAktif(false)
                        }
                      } else {
                        setIsAktif(true)
                      }
                    }}
                    className={`rounded-[4px] border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isAktif
                        ? 'border-[#B91C1C]/20 bg-[#FEE2E2] text-[#B91C1C] hover:bg-[#FCA5A5]/30'
                        : 'border-[#0F766E]/20 bg-[#E4F5F3] text-[#0F766E] hover:bg-[#99F6E4]/40'
                    }`}
                  >
                    {isAktif ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-[#5B6B68]">
                * Perubahan status akun hanya akan diterapkan setelah Anda mengklik tombol "Simpan Perubahan" di panel sebelah kiri.
              </p>
            </div>
          </section>

          <section className="rounded-[6px] border border-[#DCE4E2] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] space-y-4">
            <h2 className="text-xs font-semibold text-[#0B4F49] uppercase tracking-wider">Reset Password Akun</h2>
            <p className="text-xs text-[#5B6B68]">
              Gunakan fitur ini jika guru lupa kata sandi mereka. Sistem akan membuat sandi baru secara acak.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <button
                type="submit"
                disabled={resetPending}
                className="w-full rounded-[6px] border border-[#DCE4E2] bg-[#F7FAF9] px-4 py-2 text-xs font-semibold text-[#1C2321] transition-colors hover:bg-[#E4F5F3] hover:text-[#0F766E] disabled:opacity-50"
              >
                {resetPending ? 'Mereset Kata Sandi...' : 'Reset Kata Sandi'}
              </button>

              {resetState && (
                <div
                  className={`rounded-[4px] border p-3 text-xs ${
                    resetState.ok ? 'border-[#0F766E] bg-[#E4F5F3] text-[#0F766E]' : 'border-[#B91C1C] bg-[#FEE2E2] text-[#B91C1C]'
                  }`}
                >
                  <p className="font-semibold">{resetState.message}</p>
                  {resetState.password && (
                    <div className="mt-2 rounded-[4px] bg-white border border-[#DCE4E2] p-2 font-mono text-center text-sm font-bold text-[#1C2321] select-all">
                      {resetState.password}
                    </div>
                  )}
                  {resetState.password && (
                    <p className="mt-1.5 text-[10px] text-[#5B6B68] leading-tight">
                      * Salin dan catat sandi ini sekarang. Sandi ini hanya ditampilkan **satu kali ini saja** demi keamanan.
                    </p>
                  )}
                </div>
              )}
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
