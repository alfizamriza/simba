export type RoleGuru = 'admin' | 'wali_kelas' | 'guru_mapel' | 'kepala_sekolah'
export type FeatureGuru = 'dashboard' | 'siswa' | 'pengajuan' | 'laporan' | 'kelas' | 'guru' | 'pairing-kartu' | 'perangkat' | 'semester'

export interface GuruSession {
  guruId: string
  nama: string
  roles: { role: RoleGuru; kelasId: string | null }[]
  permissions: Partial<Record<FeatureGuru, boolean>>
}

export const FEATURES: FeatureGuru[] = [
  'dashboard',
  'siswa',
  'pengajuan',
  'laporan',
  'kelas',
  'guru',
  'pairing-kartu',
  'perangkat',
  'semester',
]

const FEATURE_ACCESS: Record<FeatureGuru, RoleGuru[]> = {
  dashboard: ['admin', 'wali_kelas', 'guru_mapel', 'kepala_sekolah'],
  siswa: ['admin', 'wali_kelas', 'guru_mapel', 'kepala_sekolah'],
  pengajuan: ['admin', 'wali_kelas', 'kepala_sekolah'],
  laporan: ['admin', 'wali_kelas', 'guru_mapel', 'kepala_sekolah'],
  kelas: ['admin'],
  guru: ['admin'],
  'pairing-kartu': ['admin'],
  perangkat: ['admin'],
  semester: ['admin'],
}

export function isAdmin(session: GuruSession | null): boolean {
  return session?.roles.some((r) => r.role === 'admin') ?? false
}

export function isWaliKelas(session: GuruSession | null): boolean {
  return session?.roles.some((r) => r.role === 'wali_kelas') ?? false
}

export function isGuruMapel(session: GuruSession | null): boolean {
  return session?.roles.some((r) => r.role === 'guru_mapel') ?? false
}

export function isKepalaSekolah(session: GuruSession | null): boolean {
  return session?.roles.some((r) => r.role === 'kepala_sekolah') ?? false
}

export function bisaEdit(session: GuruSession): boolean {
  return session.roles.some(
    (r) =>
      r.role === 'admin' ||
      r.role === 'wali_kelas' ||
      r.role === 'guru_mapel' ||
      r.role === 'kepala_sekolah'
  )
}

export function bisaAjukanPengajuan(session: GuruSession): boolean {
  return session.roles.some((r) => r.role === 'admin' || r.role === 'wali_kelas')
}

export function bisaApprovePengajuan(session: GuruSession): boolean {
  return session.roles.some((r) => r.role === 'admin' || r.role === 'wali_kelas' || r.role === 'kepala_sekolah')
}

export function canSeeAllClasses(session: GuruSession | null): boolean {
  return session?.roles.some((r) => r.role === 'admin' || r.role === 'kepala_sekolah') ?? false
}

export function getScopedClassIds(session: GuruSession | null): string[] {
  if (!session) return []

  return Array.from(
    new Set(
      session.roles
        .filter((r) => (r.role === 'wali_kelas' || r.role === 'guru_mapel') && r.kelasId)
        .map((r) => r.kelasId as string)
    )
  )
}

export function getVisibleClassIds(session: GuruSession | null): string[] | null {
  if (canSeeAllClasses(session)) return null
  return getScopedClassIds(session)
}

export function defaultFeaturePermissions(roles: RoleGuru[]): Record<FeatureGuru, boolean> {
  return Object.fromEntries(
    FEATURES.map((feature) => [feature, roles.some((role) => FEATURE_ACCESS[feature].includes(role))])
  ) as Record<FeatureGuru, boolean>
}

export function hasFeature(session: GuruSession | null, feature: FeatureGuru): boolean {
  if (!session) return false

  const allowedByRole = session.roles.some((r) => FEATURE_ACCESS[feature].includes(r.role))
  if (!allowedByRole) return false

  return session.permissions[feature] ?? true
}
