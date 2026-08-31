'use client'

import { useEffect, useState } from 'react'

interface TopbarProps {
    judul: string
    deskripsi?: string
}

export default function Topbar({ judul, deskripsi }: TopbarProps) {
    const [time, setTime] = useState<string>('')

    useEffect(() => {
        const updateTime = () => {
            const now = new Date()
            setTime(
                now.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                })
            )
        }
        updateTime()
        const timer = setInterval(updateTime, 1000)
        return () => clearInterval(timer)
    }, [])

    const hariIni = new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })

    return (
        <div className="mb-5 flex min-w-0 flex-col justify-between gap-3 border-b border-[#DCE4E2] pb-4 sm:flex-row sm:items-end">
            <div className="min-w-0">
                <h1 className="text-lg font-bold tracking-tight text-[#0B4F49] sm:text-xl">
                    {judul}
                </h1>
                {deskripsi && (
                    <p className="mt-0.5 text-xs text-[#5B6B68]">{deskripsi}</p>
                )}
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 rounded-[6px] border border-[#DCE4E2] bg-[#F7FAF9] px-3 py-1.5 text-xs sm:w-auto">
                <span className="font-medium text-[#1C2321]">{hariIni}</span>
                <span className="text-[#DCE4E2]">|</span>
                <span className="font-mono text-[#0F766E] tabular-nums font-semibold">
                    {time || '--:--:--'}
                </span>
            </div>
        </div>
    )
}
