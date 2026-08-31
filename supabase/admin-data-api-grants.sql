-- Run this in the Supabase SQL Editor after creating the domain tables.
-- Keep RLS enabled and add row-level policies separately for each workflow.

create table if not exists public.tap_log (
	id uuid primary key default gen_random_uuid(),
	uid_kartu text not null,
	perangkat_id uuid references public.perangkat_iot(id) on delete set null,
	created_at timestamptz not null default now()
);

create index if not exists idx_tap_log_created_at on public.tap_log (created_at desc);

alter table public.perangkat_iot add column if not exists device_id text;
alter table public.perangkat_iot add column if not exists api_key_encrypted text;
update public.perangkat_iot set device_id = 'legacy_' || id::text where device_id is null;
alter table public.perangkat_iot alter column device_id set not null;
create unique index if not exists idx_perangkat_iot_device_id on public.perangkat_iot (device_id);

do $$
begin
	if not exists (
		select 1
		from pg_publication_tables
		where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tap_log'
	) then
		alter publication supabase_realtime add table public.tap_log;
	end if;
end
$$;

create table if not exists public.guru_permissions (
	id uuid primary key default gen_random_uuid(),
	guru_id uuid not null references public.guru(id) on delete cascade,
	 fitur text not null check (fitur in ('dashboard', 'siswa', 'pengajuan', 'laporan', 'kelas', 'guru', 'pairing-kartu', 'perangkat', 'semester')),
	is_aktif boolean not null default true,
	created_at timestamptz not null default now(),
	unique (guru_id, fitur)
);

alter table public.guru_permissions drop constraint if exists guru_permissions_fitur_check;
alter table public.guru_permissions add constraint guru_permissions_fitur_check check (fitur in ('dashboard', 'siswa', 'pengajuan', 'laporan', 'kelas', 'guru', 'pairing-kartu', 'perangkat', 'semester'));

insert into public.guru_permissions (guru_id, fitur, is_aktif)
select
	g.id,
	fitur.nama,
	case
		when fitur.nama in ('dashboard', 'siswa', 'laporan') then exists (
			select 1 from public.guru_roles gr
			where gr.guru_id = g.id
				and gr.role in ('admin', 'wali_kelas', 'guru_mapel', 'kepala_sekolah')
		)
		when fitur.nama = 'pengajuan' then exists (
			select 1 from public.guru_roles gr
			where gr.guru_id = g.id
				and gr.role in ('admin', 'wali_kelas', 'kepala_sekolah')
		)
		when fitur.nama in ('kelas', 'guru', 'pairing-kartu', 'perangkat', 'semester') then exists (
			select 1 from public.guru_roles gr
			where gr.guru_id = g.id
				and gr.role = 'admin'
		)
		else false
	end
from public.guru g
cross join (values ('dashboard'), ('siswa'), ('pengajuan'), ('laporan'), ('kelas'), ('guru'), ('pairing-kartu'), ('perangkat'), ('semester')) as fitur(nama)
on conflict (guru_id, fitur) do nothing;

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on table public.guru to authenticated, service_role;
grant select, insert, update, delete on table public.guru_roles to authenticated, service_role;
grant select, insert, update, delete on table public.guru_permissions to authenticated, service_role;
grant select, insert, update, delete on table public.tahun_ajaran to authenticated, service_role;
grant select, insert, update, delete on table public.kelas to authenticated, service_role;
grant select, insert, update, delete on table public.jadwal_jam_masuk to authenticated, service_role;
grant select, insert, update, delete on table public.siswa to authenticated, service_role;
grant select, insert, update, delete on table public.kartu_rfid to authenticated, service_role;
grant select, insert, update, delete on table public.perangkat_iot to authenticated, service_role;
grant select, insert, update, delete on table public.semester to authenticated, service_role;
grant select, insert, update, delete on table public.log_absensi to authenticated, service_role;
grant select, insert, update, delete on table public.pengajuan_izin to authenticated, service_role;
alter table public.pengajuan_izin add column if not exists catatan_approval text;
grant select on table public.tap_log to authenticated, service_role;

grant usage, select on all sequences in schema public to authenticated, service_role;
