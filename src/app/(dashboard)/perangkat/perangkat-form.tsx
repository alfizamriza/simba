'use client'

import { useActionState } from 'react'
import { createPerangkat, regeneratePerangkat, revealPerangkat, type DeviceActionState } from './actions'

const initialState: DeviceActionState = { ok: false, message: '', deviceId: null, apiKey: null }

export function PerangkatForm() {
  const [state, formAction, pending] = useActionState(createPerangkat, initialState)
  return <><form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><input name="nama" required placeholder="Reader Gerbang Utama" className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm" /><button disabled={pending} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Membuat...' : 'Tambah Perangkat'}</button></form>{state.message && <DeviceResult state={state} />}</>
}

export function DeviceKeyControl({ id }: { id: string }) {
  const [revealState, revealAction, revealPending] = useActionState(revealPerangkat, initialState)
  const [regenerateState, regenerateAction, regeneratePending] = useActionState(regeneratePerangkat, initialState)
  const state = regenerateState.message ? regenerateState : revealState
  return <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center"><form action={revealAction}><input type="hidden" name="id" value={id} /><button disabled={revealPending} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 sm:w-auto">{revealPending ? 'Membuka...' : 'Reveal'}</button></form><form action={(formData) => { if (window.confirm('Regenerate API key? Key lama langsung tidak berlaku.')) regenerateAction(formData) }}><input type="hidden" name="id" value={id} /><button disabled={regeneratePending} className="w-full rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 sm:w-auto">{regeneratePending ? 'Regenerate...' : 'Regenerate'}</button></form>{state.message && <DeviceResult state={state} compact />}</div>
}

function DeviceResult({ state, compact = false }: { state: DeviceActionState; compact?: boolean }) {
  return <div className={`${compact ? 'basis-full' : 'mt-4'} rounded-lg border p-3 text-sm ${state.ok ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}><p>{state.message}</p>{state.deviceId && <p className="mt-1 font-mono text-xs">Device ID: {state.deviceId}</p>}{state.apiKey && <code className="mt-2 block break-all rounded bg-white p-2 font-mono text-xs">API key: {state.apiKey}</code>}</div>
}
