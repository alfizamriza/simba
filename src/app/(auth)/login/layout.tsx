import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Masuk',
  description: 'Masuk ke SIMBA (Sistem Absensi SMP Sukma Bangsa Pidie) untuk mengelola absensi siswa, jadwal pelajaran, dan laporan absensi.',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
