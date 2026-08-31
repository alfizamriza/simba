'use client'

import { useActionState, useState } from 'react'
import { simpanGuru, type SimpanGuruState } from './actions'

interface ClassOption {
  id: string
  nama: string
  tingkat: number
}

interface TambahGuruFormProps {
  classes: ClassOption[]
  kelasTerpakaiIds: string[]
}

const initialState: SimpanGuruState = { ok: false, message: '' }

export default function TambahGuruForm({ classes, kelasTerpakaiIds }: TambahGuruFormProps) {
  const [state, formAction, pending] = useActionState(simpanGuru, initialState)
  const [password, setPassword] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  
  const availableClasses = classes.filter((c) => !kelasTerpakaiIds.includes(c.id))

  function generatePassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
    let generated = ''
    const randomArray = new Uint32Array(12)
    window.crypto.getRandomValues(randomArray)
    for (let i = 0; i < randomArray.length; i++) {
      generated += chars[randomArray[i] % chars.length]
    }
    setPassword(generated)
  }

  function handleRoleChange(role: string, checked: boolean) {
    if (checked) {
      setSelectedRoles((prev) => [...prev, role])
    } else {
      setSelectedRoles((prev) => prev.filter((r) => r !== role))
    }
  }

  return (
    <section className="rounded-[6px] border border-[#DCE4E2] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <h2 className="text-xs font-semibold text-[#0B4F49]">Tambah Guru Baru</h2>
      <form action={formAction} className="mt-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#1C2321]">NIP / Username</label>
            <input
              name="nip"
              required
              placeholder="Contoh: 19801010..."
              className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 font-mono text-xs text-[#1C2321] placeholder-[#5B6B68] focus:border-[#0F766E] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#1C2321]">Nama Lengkap</label>
            <input
              name="nama"
              required
              placeholder="Nama lengkap beserta gelar..."
              className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] placeholder-[#5B6B68] focus:border-[#0F766E] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#1C2321]">Nomor Telepon / WA (Opsional)</label>
            <input
              name="no_hp"
              placeholder="Contoh: 081234567..."
              className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] placeholder-[#5B6B68] focus:border-[#0F766E] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#1C2321]">Password Awal</label>
            <div className="flex gap-2">
              <input
                name="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter..."
                className="flex-1 rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] placeholder-[#5B6B68] focus:border-[#0F766E] focus:outline-none"
              />
              <button
                type="button"
                onClick={generatePassword}
                className="rounded-[6px] border border-[#DCE4E2] bg-[#F7FAF9] px-3 py-1.5 text-xs font-medium text-[#1C2321] transition-colors hover:bg-[#E4F5F3] hover:text-[#0F766E]"
              >
                Generate Otomatis
              </button>
            </div>
          </div>
        </div>

        <fieldset className="rounded-[6px] border border-[#DCE4E2] bg-[#F7FAF9] p-4">
          <legend className="px-1 text-[11px] font-semibold text-[#5B6B68]">Hak Role Guru</legend>
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

        {/* Conditional inputs */}
        {selectedRoles.includes('wali_kelas') && (
          <div className="rounded-[6px] border border-[#DCE4E2] bg-[#F7FAF9] p-4">
            <label className="mb-1 block text-xs font-semibold text-[#0B4F49]">Pilih Kelas Wali</label>
            <select
              name="kelas_id"
              required
              className="w-full max-w-md rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
            >
              <option value="">-- Pilih Kelas --</option>
              {availableClasses.map((item) => (
                <option key={item.id} value={item.id}>
                  Kelas {item.nama}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-[#5B6B68]">Hanya menampilkan kelas yang belum memiliki wali kelas aktif.</p>
          </div>
        )}

        {selectedRoles.includes('guru_mapel') && (
          <div className="rounded-[6px] border border-[#DCE4E2] bg-[#F7FAF9] p-4">
            <label className="mb-2 block text-xs font-semibold text-[#0B4F49]">Pilih Kelas Diajar (Bisa lebih dari satu)</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {classes.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-xs text-[#1C2321]">
                  <input
                    type="checkbox"
                    name="mapel_kelas_ids"
                    value={item.id}
                    className="h-3.5 w-3.5 rounded border-[#DCE4E2] text-[#0F766E] focus:ring-[#0F766E]"
                  />
                  Kelas {item.nama}
                </label>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-[6px] bg-[#0F766E] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0B4F49] disabled:opacity-50"
        >
          {pending ? 'Menyimpan Akun...' : 'Simpan Akun Guru'}
        </button>

        {state.message && (
          <div
            className={`rounded-[4px] border px-3 py-2 text-xs ${
              state.ok ? 'border-[#0F766E] bg-[#E4F5F3] text-[#0F766E]' : 'border-[#B91C1C] bg-[#FEE2E2] text-[#B91C1C]'
            }`}
          >
            {state.message}
          </div>
        )}
      </form>
    </section>
  )
}
