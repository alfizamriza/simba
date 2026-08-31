'use client'

import { useActionState } from 'react'
import { submitPengajuan, type PengajuanActionState } from './actions'

type StudentOption = { id: string; label: string }
const initialState: PengajuanActionState = { ok: false, message: '' }

export default function PengajuanForm({ students }: { students: StudentOption[] }) {
  const [state, formAction, pending] = useActionState(submitPengajuan, initialState)

  return (
    <form action={formAction} className="space-y-3.5">
      <div>
        <label htmlFor="student-search" className="mb-1 block text-xs font-medium text-[#1C2321]">
          Siswa
        </label>
        <select
          id="student-search"
          name="siswa_id"
          required
          defaultValue=""
          className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
        >
          <option value="" disabled>
            Pilih nama siswa...
          </option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="tanggal-mulai" className="mb-1 block text-xs font-medium text-[#1C2321]">
            Tanggal Mulai
          </label>
          <input
            id="tanggal-mulai"
            name="tanggal_mulai"
            type="date"
            required
            className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 font-mono text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="tanggal-selesai" className="mb-1 block text-xs font-medium text-[#1C2321]">
            Tanggal Selesai
          </label>
          <input
            id="tanggal-selesai"
            name="tanggal_selesai"
            type="date"
            className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 font-mono text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
          />
          <p className="mt-0.5 text-[10px] text-[#5B6B68]">Kosongkan bila 1 hari.</p>
        </div>
      </div>

      <div>
        <label htmlFor="jenis" className="mb-1 block text-xs font-medium text-[#1C2321]">
          Jenis Pengajuan
        </label>
        <select
          id="jenis"
          name="jenis"
          required
          className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] focus:border-[#0F766E] focus:outline-none"
        >
          <option value="izin">Izin</option>
          <option value="sakit">Sakit</option>
        </select>
      </div>

      <div>
        <label htmlFor="keterangan" className="mb-1 block text-xs font-medium text-[#1C2321]">
          Keterangan
        </label>
        <textarea
          id="keterangan"
          name="keterangan"
          rows={3}
          placeholder="Alasan ketidakhadiran secara singkat..."
          className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1.5 text-xs text-[#1C2321] placeholder-[#5B6B68] focus:border-[#0F766E] focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="lampiran" className="mb-1 block text-xs font-medium text-[#1C2321]">
          Lampiran Berkas (Opsional)
        </label>
        <input
          id="lampiran"
          name="lampiran"
          type="file"
          accept="image/*,.pdf"
          className="block w-full text-xs text-[#5B6B68] file:mr-3 file:rounded-[4px] file:border file:border-[#DCE4E2] file:bg-[#F7FAF9] file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-[#1C2321] hover:file:bg-[#E4F5F3]"
        />
        <p className="mt-0.5 text-[10px] text-[#5B6B68]">PDF, JPG, PNG (Maksimal 5 MB)</p>
      </div>

      <button
        disabled={pending}
        className="w-full rounded-[6px] bg-[#0F766E] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#0B4F49] disabled:opacity-50"
      >
        {pending ? 'Menyimpan Data...' : 'Simpan Pengajuan'}
      </button>

      {state.message && (
        <div
          role="status"
          className={`rounded-[4px] border px-3 py-2 text-xs ${state.ok
              ? 'border-[#0F766E] bg-[#E4F5F3] text-[#0F766E]'
              : 'border-[#B91C1C] bg-[#FEE2E2] text-[#B91C1C]'
            }`}
        >
          {state.message}
        </div>
      )}
    </form>
  )
}