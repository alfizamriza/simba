import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { requireFeature } from '@/lib/auth/require-feature'
import { DeviceKeyControl, PerangkatForm } from './perangkat-form'
import { setPerangkatStatus } from './actions'

type Perangkat = {
  id: string
  device_id: string
  nama: string
  is_aktif: boolean
  last_seen_at: string | null
}

function isOnline(lastSeen: string | null) {
  return Boolean(lastSeen && Date.now() - new Date(lastSeen).getTime() <= 24 * 60 * 60 * 1000)
}

export default async function PerangkatPage() {
  await requireAdmin()
  await requireFeature('perangkat')

  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('perangkat_iot')
    .select('id, device_id, nama, is_aktif, last_seen_at')
    .order('nama')

  const devices = (data ?? []) as Perangkat[]

  return (
    <div className="w-full min-w-0 space-y-5 font-sans text-[#1C2321] sm:space-y-6">
      {/* Header Section */}
      <header className="pb-2 border-b border-[#DCE4E2]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0F766E]">
          ADMINISTRATOR
        </span>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-[#0B4F49] sm:text-2xl">
          Kelola Perangkat IoT
        </h1>
        <p className="mt-0.5 text-xs text-[#5B6B68]">
          Status perangkat otomatis menjadi offline jika tidak mengirimkan data selama lebih dari 24 jam.
        </p>
      </header>

      {/* Form Tambah Perangkat */}
      <section className="rounded-[6px] border border-[#DCE4E2] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
        <h2 className="text-xs font-semibold text-[#0B4F49]">Tambah Perangkat Baru</h2>
        <div className="mt-4">
          <PerangkatForm />
        </div>
      </section>

      {/* Daftar Perangkat IoT */}
      <section className="overflow-hidden rounded-[6px] border border-[#DCE4E2] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="border-b border-[#DCE4E2] bg-[#F7FAF9] px-5 py-3">
          <h2 className="text-xs font-semibold text-[#0B4F49]">Daftar Perangkat Terdaftar</h2>
        </div>

        <div className="divide-y divide-[#DCE4E2]">
          {devices.map((device) => {
            const online = isOnline(device.last_seen_at) && device.is_aktif
            return (
              <div key={device.id} className="space-y-3 px-4 py-4 transition-colors hover:bg-[#F7FAF9]/50 sm:px-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#1C2321]">{device.nama}</p>
                    <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[#5B6B68]">
                      ID: {device.device_id}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#5B6B68]">
                      Terakhir Aktif:{' '}
                      <span className="font-mono tabular-nums">
                        {device.last_seen_at
                          ? new Date(device.last_seen_at).toLocaleString('id-ID')
                          : 'Belum pernah terhubung'}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-[4px] border px-2.5 py-0.5 text-[11px] font-medium ${online
                          ? 'border-[#0F766E]/20 bg-[#E4F5F3] text-[#0F766E]'
                          : 'border-[#B91C1C]/20 bg-[#FEE2E2] text-[#B91C1C]'
                        }`}
                    >
                      {online ? 'Online' : 'Offline'}
                    </span>

                    <form action={setPerangkatStatus}>
                      <input type="hidden" name="id" value={device.id} />
                      <input type="hidden" name="is_aktif" value={String(!device.is_aktif)} />
                      <button
                        type="submit"
                        className="rounded-[6px] border border-[#DCE4E2] bg-white px-3 py-1 text-xs font-medium text-[#1C2321] transition-colors hover:bg-[#F7FAF9]"
                      >
                        {device.is_aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </form>
                  </div>
                </div>

                {/* Sub-card API Key */}
                <div className="flex flex-col gap-2 rounded-[6px] border border-[#DCE4E2] bg-[#F7FAF9] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-[#5B6B68]">API Key Perangkat</p>
                    <code className="block max-w-full overflow-hidden text-ellipsis font-mono text-xs text-[#1C2321]">
                      ••••••••••••••••••••••••••••••••
                    </code>
                  </div>
                  <DeviceKeyControl id={device.id} />
                </div>
              </div>
            )
          })}

          {devices.length === 0 && (
            <p className="px-5 py-10 text-center text-xs text-[#5B6B68]">
              Belum ada perangkat IoT yang terdaftar.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
