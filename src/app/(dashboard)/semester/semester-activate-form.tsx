'use client'

import { activateSemester } from './actions'

export default function SemesterActivateForm({ id, label }: { id: string; label: string }) {
  return <form action={(formData) => { if (window.confirm(`Aktifkan ${label}? Semester aktif saat ini akan otomatis dinonaktifkan.`)) activateSemester(formData) }}><input type="hidden" name="id" value={id} /><button className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50">Jadikan Aktif</button></form>
}