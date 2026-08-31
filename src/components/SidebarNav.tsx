'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { GuruSession, FeatureGuru } from '@/lib/auth/roles'
import { hasFeature } from '@/lib/auth/roles'

interface SidebarNavProps {
    session: GuruSession
    admin: boolean
    waliKelas: boolean
    logoutAction: () => Promise<void>
}

export default function SidebarNav({
    session,
    admin,
    waliKelas,
    logoutAction,
}: SidebarNavProps) {
    const pathname = usePathname()
    const [mobileOpen, setMobileOpen] = useState(false)

    const can = (feature: FeatureGuru) => hasFeature(session, feature)

    const isActive = (path: string) => {
        if (path === '/dashboard') return pathname === '/dashboard'
        return pathname.startsWith(path)
    }

    const getNavClass = (path: string) => {
        const active = isActive(path)
        return `group relative flex items-center gap-3 rounded-[6px] py-2 px-3 text-xs font-medium transition-all duration-150 ${active
                ? 'bg-[#E4F5F3] font-semibold text-[#0F766E]'
                : 'text-[#5B6B68] hover:bg-[#E4F5F3]/50 hover:text-[#0F766E]'
            }`
    }

    const getIconClass = (path: string) => {
        const active = isActive(path)
        return `h-4 w-4 shrink-0 transition-colors ${active ? 'text-[#0F766E]' : 'text-[#5B6B68] group-hover:text-[#0F766E]'
            }`
    }

    const NavItem = ({
        path,
        icon,
        label,
    }: {
        path: string
        icon: React.ReactNode
        label: string
    }) => (
        <Link
            href={path}
            onClick={() => setMobileOpen(false)}
            className={getNavClass(path)}
        >
            {/* Indicator bar tipis */}
            <span
                className={`absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-[#0F766E] transition-all duration-200 ${isActive(path) ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-50'
                    }`}
            />
            <svg
                className={getIconClass(path)}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
            >
                {icon}
            </svg>
            <span className="truncate">{label}</span>
        </Link>
    )

    const sidebarContent = (
        <div className="flex h-full min-h-0 flex-col justify-between p-4 lg:p-5">
            <div className="min-h-0 space-y-6 overflow-y-auto pr-1">
                {/* Brand Mark */}
                <div className="flex items-center gap-3 px-1">
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[#0F766E] shadow-sm overflow-hidden p-1">
                        <img
                            src="/logoSukma.png"
                            alt="Logo Sukma"
                            className="h-full w-full object-contain"
                            style={{ filter: 'brightness(0) invert(1)' }}
                        />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[15px] font-bold leading-tight tracking-tight text-[#0B4F49]">
                            SIMBA
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5B6B68]">
                            Sistem Presensi
                        </span>
                    </div>
                </div>

                {/* Navigation Item Groups */}
                <nav className="space-y-4">
                    <div className="space-y-0.5">
                        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                            Menu Utama
                        </p>
                        {can('dashboard') && (
                            <NavItem
                                path="/dashboard"
                                label="Ringkasan"
                                icon={
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                                    />
                                }
                            />
                        )}
                        {can('siswa') && (
                            <NavItem
                                path="/siswa"
                                label="Data Siswa"
                                icon={
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                                    />
                                }
                            />
                        )}
                        {can('pengajuan') && (
                            <NavItem
                                path="/pengajuan"
                                label="Pengajuan Izin/Sakit"
                                icon={
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                }
                            />
                        )}
                        {can('laporan') && (
                            <NavItem
                                path="/laporan"
                                label="Laporan"
                                icon={
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                }
                            />
                        )}
                    </div>

                    {admin &&
                        (can('kelas') ||
                            can('guru') ||
                            can('pairing-kartu') ||
                            can('perangkat') ||
                            can('semester')) && (
                            <div className="space-y-0.5 pt-2">
                                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                                    Administrator
                                </p>
                                {can('kelas') && (
                                    <NavItem
                                        path="/kelas"
                                        label="Kelola Kelas"
                                        icon={
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                            />
                                        }
                                    />
                                )}
                                {can('guru') && (
                                    <NavItem
                                        path="/guru"
                                        label="Kelola Guru & Role"
                                        icon={
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 012-2h2a2 2 0 012 2v1m-6 0h6"
                                            />
                                        }
                                    />
                                )}
                                {can('pairing-kartu') && (
                                    <NavItem
                                        path="/pairing-kartu"
                                        label="Pairing Kartu RFID"
                                        icon={
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 0121 9z"
                                            />
                                        }
                                    />
                                )}
                                {can('perangkat') && (
                                    <NavItem
                                        path="/perangkat"
                                        label="Perangkat IoT"
                                        icon={
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                                            />
                                        }
                                    />
                                )}
                                {can('semester') && (
                                    <NavItem
                                        path="/semester"
                                        label="Semester Aktif"
                                        icon={
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                            />
                                        }
                                    />
                                )}
                                {can('kelas') && (
                                    <NavItem
                                        path="/kelas/jadwal"
                                        label="Jadwal Jam Masuk"
                                        icon={
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                        }
                                    />
                                )}
                            </div>
                        )}
                </nav>
            </div>

            {/* User Session Footer */}
            <div className="shrink-0 border-t border-[#DCE4E2] pt-4">
                <div className="mb-3 flex items-center gap-3 rounded-[6px] border border-[#DCE4E2] bg-white p-2 shadow-sm">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-[#E4F5F3] font-mono text-xs font-bold text-[#0F766E]">
                        {session.nama ? session.nama.charAt(0).toUpperCase() : 'G'}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-[#1C2321]">
                            {session.nama}
                        </p>
                        <p className="truncate text-[10px] text-[#5B6B68]">
                            {admin ? 'Administrator' : waliKelas ? 'Wali Kelas' : 'Guru'}
                        </p>
                    </div>
                </div>

                <form action={logoutAction}>
                    <button
                        type="submit"
                        className="flex w-full items-center justify-center gap-2 rounded-[6px] border border-[#B91C1C]/20 bg-[#FEE2E2]/30 px-3 py-1.5 text-xs font-medium text-[#B91C1C] transition-colors hover:bg-[#FEE2E2]"
                    >
                        <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                            />
                        </svg>
                        Keluar Sesi
                    </button>
                </form>
            </div>
        </div>
    )

    return (
        <>
            {/* Mobile Bar Header */}
            <div className="flex h-14 items-center justify-between border-b border-[#DCE4E2] bg-[#F7FAF9] px-4 lg:hidden">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#0F766E] overflow-hidden p-0.5">
                        <img
                            src="/logoSukma.png"
                            alt="Logo Sukma"
                            className="h-full w-full object-contain"
                            style={{ filter: 'brightness(0) invert(1)' }}
                        />
                    </div>
                    <span className="text-sm font-bold tracking-tight text-[#0B4F49]">
                        SIMBA
                    </span>
                </div>
                <button
                    type="button"
                    aria-label={mobileOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
                    onClick={() => setMobileOpen(!mobileOpen)}
                    className="rounded-[6px] border border-[#DCE4E2] bg-white p-1.5 text-[#1C2321]"
                >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
                        />
                    </svg>
                </button>
            </div>

            {/* Drawer Overlay Mobile */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar Sidebar Desktop & Drawer Mobile */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-[min(18rem,calc(100vw-2rem))] border-r border-[#DCE4E2] bg-[#F7FAF9] transition-transform lg:static lg:w-64 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {sidebarContent}
            </aside>
        </>
    )
}
