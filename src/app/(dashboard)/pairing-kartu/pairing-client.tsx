'use client'

import { useActionState, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { pairKartu, type PairActionState } from './actions'

type StudentOption = { id: string; label: string }
type Tap = { uid_kartu: string; created_at: string }
const initialState: PairActionState = { ok: false, message: '' }

export default function PairingClient({ students, initialTaps, pairedUids }: { students: StudentOption[]; initialTaps: Tap[]; pairedUids: string[] }) {
  const [state, formAction, pending] = useActionState(pairKartu, initialState)
  const [uid, setUid] = useState(initialTaps[0]?.uid_kartu ?? '')
  const [listening, setListening] = useState(false)
  const [recentTaps, setRecentTaps] = useState(initialTaps)

  useEffect(() => {
    const supabase = createClient()
    const paired = new Set(pairedUids)
    const channel = supabase.channel('pairing-requests-realtime').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pairing_requests' }, (payload) => {
      const tap = payload.new as Tap
      if (!tap.uid_kartu || paired.has(tap.uid_kartu)) return
      setUid(tap.uid_kartu)
      setRecentTaps((current) => [tap, ...current.filter((item) => item.uid_kartu !== tap.uid_kartu)].slice(0, 10))
    }).subscribe((status) => setListening(status === 'SUBSCRIBED'))
    return () => { void supabase.removeChannel(channel) }
  }, [pairedUids])

  return <div className="space-y-5 sm:space-y-6">
    <div className={`rounded-xl border p-4 sm:p-5 ${listening ? 'border-teal-200 bg-teal-50' : 'border-amber-200 bg-amber-50'}`}><div className="flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${listening ? 'bg-teal-500 animate-pulse' : 'bg-amber-500'}`} /><div><p className="font-semibold text-slate-900">{listening ? 'Listening aktif' : 'Menghubungkan ke Realtime...'}</p><p className="text-xs text-slate-600">Tap kartu yang belum terpasang pada reader IoT.</p></div></div>{uid && <div className="mt-4 rounded-lg border border-white bg-white p-3 sm:p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">UID terakhir terdeteksi</p><p className="mt-1 break-all font-mono text-lg font-bold tracking-widest text-teal-700 sm:text-xl">{uid}</p></div>}</div>
    <form action={formAction} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="font-semibold text-slate-900">Pasangkan ke Siswa</h2><div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]"><input name="uid_kartu" value={uid} onChange={(event) => setUid(event.target.value.toUpperCase())} required placeholder="UID kartu" className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" /><select name="siswa_id" required defaultValue="" className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Pilih siswa tanpa kartu</option>{students.map((student) => <option key={student.id} value={student.id}>{student.label}</option>)}</select><button disabled={pending || !uid} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Memasangkan...' : 'Pasangkan'}</button></div>{state.message && <p role="status" className={`mt-3 rounded-lg border px-3 py-2 text-sm ${state.ok ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{state.message}</p>}</form>
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="font-semibold text-slate-900">Tap Terbaru yang Belum Terpasang</h2><div className="mt-3 space-y-2">{recentTaps.map((tap) => <button type="button" key={`${tap.uid_kartu}-${tap.created_at}`} onClick={() => setUid(tap.uid_kartu)} className={`flex w-full flex-col gap-1 rounded-lg border px-3 py-2 text-left min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between ${uid === tap.uid_kartu ? 'border-teal-300 bg-teal-50' : 'border-slate-200'}`}><span className="break-all font-mono text-sm font-semibold">{tap.uid_kartu}</span><span className="text-xs text-slate-500">{new Date(tap.created_at).toLocaleTimeString('id-ID')}</span></button>)}{recentTaps.length === 0 && <p className="text-sm text-slate-500">Belum ada tap baru.</p>}</div></div>
  </div>
}
