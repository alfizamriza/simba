'use client'

import { useActionState, useState } from 'react'
import * as XLSX from 'xlsx'
import { importSiswa, type ImportSiswaState } from './actions'

type Row = { nis: string; nama: string; kelas: string }
const initialState: ImportSiswaState = { ok: false, message: '' }

export default function ImportSiswaForm() {
  const [rows, setRows] = useState<Row[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [matrix, setMatrix] = useState<string[][]>([])
  const [mapping, setMapping] = useState({ nis: 0, nama: 1, kelas: 2 })
  const [state, formAction, pending] = useActionState(importSiswa, initialState)

  function mappedRows(source: string[][], selected: { nis: number; nama: number; kelas: number }) {
    return source.slice(0, 2000).map((row) => ({ nis: String(row[selected.nis] ?? ''), nama: String(row[selected.nama] ?? ''), kelas: String(row[selected.kelas] ?? '') }))
  }

  async function readFile(file: File) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
    const [firstRow, ...dataRows] = matrix
    const normalizedHeaders = (firstRow ?? []).map((item) => String(item).trim())
    const nextMatrix = dataRows.map((row) => row.map((value) => String(value)))
    setHeaders(normalizedHeaders)
    setMatrix(nextMatrix)
    setRows(mappedRows(nextMatrix, mapping))
  }

  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="font-semibold text-slate-900">Import dari Excel</h2><p className="mt-1 text-xs text-slate-500">Upload file, mapping kolom, lalu periksa preview sebelum simpan.</p><input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file) }} className="mt-4 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold" />{headers.length > 0 && <><p className="mt-3 break-words text-xs text-slate-500">Header terdeteksi: {headers.join(', ')}</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{(['nis', 'nama', 'kelas'] as const).map((field) => <label key={field} className="text-xs font-semibold capitalize text-slate-600">Kolom {field}<select value={mapping[field]} onChange={(event) => { const next = { ...mapping, [field]: Number(event.target.value) }; setMapping(next); setRows(mappedRows(matrix, next)) }} className="mt-1 w-full rounded border px-2 py-1 text-xs">{headers.map((header, index) => <option key={index} value={index}>{header || `Kolom ${index + 1}`}</option>)}</select></label>)}</div></>}{rows.length > 0 && <><div className="mt-4 max-h-48 overflow-auto rounded-lg border border-slate-200"><table className="w-full min-w-[420px] text-left text-xs"><thead className="sticky top-0 bg-slate-50"><tr><th className="px-3 py-2">NIS</th><th className="px-3 py-2">Nama</th><th className="px-3 py-2">Kelas</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.slice(0, 10).map((row, index) => <tr key={index}><td className="px-3 py-2">{row.nis}</td><td className="px-3 py-2">{row.nama}</td><td className="px-3 py-2">{row.kelas || '-'}</td></tr>)}</tbody></table></div><form action={formAction} className="mt-3"><input type="hidden" name="rows_json" value={JSON.stringify(rows)} /><button disabled={pending} className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">{pending ? 'Mengimpor...' : `Simpan ${rows.length} Baris`}</button></form></>}{state.message && <p className={`mt-3 rounded-lg border px-3 py-2 text-sm ${state.ok ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{state.message}</p>}</div>
}
