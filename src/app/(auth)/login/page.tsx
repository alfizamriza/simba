'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Domain dummy buat konversi NIP -> format email (Supabase Auth wajib pakai email).
// Guru tidak pernah melihat ini, cukup masukkan NIP saja.
const DOMAIN_INTERNAL = 'simba.internal'

export default function LoginPage() {
  const router = useRouter()

  const [nip, setNip] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const emailInternal = `${nip.trim()}@${DOMAIN_INTERNAL}`
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email: emailInternal,
      password,
    })

    setLoading(false)

    if (error) {
      setError('NIP atau password salah.')
      return
    }

    router.push('/dashboard')
    router.refresh() // penting: supaya proxy baca ulang session terbaru
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7FAF9] px-4 font-sans text-[#1C2321] antialiased">
      {/* Card Login: Flat, border netral-200, tanpa drop shadow tebal */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-[8px] border border-[#DCE4E2] bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">

        {/* Signature Element SIMBA: Indikator garis vertikal tipis di sisi kiri kartu */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0F766E]" />

        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight text-[#0B4F49]">
            SIMBA
          </h1>
          <p className="mt-1 text-sm text-[#5B6B68]">
            Sistem Absensi — SMP Sukma Bangsa Pidie
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#5B6B68]">
              NIP
            </label>
            <input
              type="text"
              required
              inputMode="numeric"
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-2 font-mono text-sm text-[#1C2321] placeholder-[#5B6B68]/60 transition-colors focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
              placeholder="Contoh: 198501012010011001"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#5B6B68]">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-2 text-sm text-[#1C2321] transition-colors focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
            />
          </div>

          {/* Alert Error: Menggunakan warna merah bata gelap institusional dengan background tint 10% */}
          {error && (
            <div className="rounded-[4px] border border-[#B91C1C]/20 bg-[#B91C1C]/10 px-3 py-2 text-sm text-[#B91C1C]">
              {error}
            </div>
          )}

          {/* Tombol Utama: Flat tosca-700, hover tosca-900, border-radius 6px */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[6px] bg-[#0F766E] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0B4F49] focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Masuk ke SIMBA'}
          </button>
        </form>

        <p className="mt-6 border-t border-[#DCE4E2] pt-4 text-center text-xs leading-relaxed text-[#5B6B68]">
          Akun guru didaftarkan oleh admin. Hubungi admin sekolah jika belum memiliki akses.
        </p>
      </div>
    </div>
  )
}