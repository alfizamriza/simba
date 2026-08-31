-- Run after the base schema and admin-data-api-grants.sql.
-- Admin mutations in the Next.js server use service_role after requireAdmin().

alter function public.is_admin() set search_path = public;
alter function public.kelas_wali_saya() set search_path = public;

create or replace function public.kelas_diajar_saya()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select gr.kelas_id
  from public.guru_roles gr
  join public.guru g on g.id = gr.guru_id
  where g.user_id = auth.uid()
    and gr.role = 'guru_mapel'
    and gr.kelas_id is not null;
$$;

create or replace function public.is_kepala_sekolah()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.guru_roles gr
    join public.guru g on g.id = gr.guru_id
    where g.user_id = auth.uid()
      and gr.role = 'kepala_sekolah'
  );
$$;

grant execute on function public.kelas_diajar_saya() to authenticated;
grant execute on function public.is_kepala_sekolah() to authenticated;

create or replace function public.activate_semester(target_semester_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang boleh mengaktifkan semester';
  end if;
  if not exists (select 1 from public.semester where id = target_semester_id) then
    raise exception 'Semester tidak ditemukan';
  end if;
  update public.semester set is_aktif = false where is_aktif = true;
  update public.semester set is_aktif = true where id = target_semester_id;
end;
$$;

grant execute on function public.activate_semester(uuid) to authenticated;

alter table public.guru enable row level security;
alter table public.guru_roles enable row level security;
alter table public.guru_permissions enable row level security;
alter table public.tahun_ajaran enable row level security;
alter table public.semester enable row level security;
alter table public.kelas enable row level security;
alter table public.siswa enable row level security;
alter table public.kartu_rfid enable row level security;
alter table public.perangkat_iot enable row level security;
alter table public.log_absensi enable row level security;
alter table public.pengajuan_izin enable row level security;

alter table public.tap_log enable row level security;
drop policy if exists tap_log_admin_read on public.tap_log;
create policy tap_log_admin_read on public.tap_log for select using (public.is_admin());

drop policy if exists guru_self_read on public.guru;
drop policy if exists guru_admin_all on public.guru;
create policy guru_self_read on public.guru for select using (user_id = auth.uid() or public.is_admin());
create policy guru_admin_all on public.guru for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists guru_roles_self_read on public.guru_roles;
drop policy if exists guru_roles_admin_all on public.guru_roles;
create policy guru_roles_self_read on public.guru_roles for select using (
  guru_id in (select id from public.guru where user_id = auth.uid()) or public.is_admin()
);
create policy guru_roles_admin_all on public.guru_roles for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists guru_permissions_self_read on public.guru_permissions;
drop policy if exists guru_permissions_admin_all on public.guru_permissions;
create policy guru_permissions_self_read on public.guru_permissions for select using (
  guru_id in (select id from public.guru where user_id = auth.uid()) or public.is_admin()
);
create policy guru_permissions_admin_all on public.guru_permissions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists tahun_ajaran_authenticated_read on public.tahun_ajaran;
drop policy if exists tahun_ajaran_admin_all on public.tahun_ajaran;
create policy tahun_ajaran_authenticated_read on public.tahun_ajaran for select to authenticated using (true);
create policy tahun_ajaran_admin_all on public.tahun_ajaran for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists semester_authenticated_read on public.semester;
drop policy if exists semester_admin_all on public.semester;
create policy semester_authenticated_read on public.semester for select to authenticated using (true);
create policy semester_admin_all on public.semester for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists kelas_admin_all on public.kelas;
drop policy if exists kelas_wali_read on public.kelas;
drop policy if exists kelas_guru_mapel_read on public.kelas;
drop policy if exists kelas_kepsek_read on public.kelas;
create policy kelas_admin_all on public.kelas for all using (public.is_admin()) with check (public.is_admin());
create policy kelas_wali_read on public.kelas for select using (id in (select public.kelas_wali_saya()));
create policy kelas_guru_mapel_read on public.kelas for select using (id in (select public.kelas_diajar_saya()));
create policy kelas_kepsek_read on public.kelas for select using (public.is_kepala_sekolah());

drop policy if exists kartu_admin_all on public.kartu_rfid;
drop policy if exists kartu_wali_read on public.kartu_rfid;
drop policy if exists kartu_guru_mapel_read on public.kartu_rfid;
drop policy if exists kartu_kepsek_read on public.kartu_rfid;
create policy kartu_admin_all on public.kartu_rfid for all using (public.is_admin()) with check (public.is_admin());
create policy kartu_wali_read on public.kartu_rfid for select using (
  siswa_id in (select id from public.siswa where kelas_id in (select public.kelas_wali_saya()))
);
create policy kartu_guru_mapel_read on public.kartu_rfid for select using (
  siswa_id in (select id from public.siswa where kelas_id in (select public.kelas_diajar_saya()))
);
create policy kartu_kepsek_read on public.kartu_rfid for select using (public.is_kepala_sekolah());

drop policy if exists admin_full_access_siswa on public.siswa;
drop policy if exists wali_kelas_akses_siswa_sendiri on public.siswa;
drop policy if exists wali_kelas_update_siswa_sendiri on public.siswa;
drop policy if exists guru_mapel_lihat_siswa on public.siswa;
drop policy if exists kepsek_lihat_siswa on public.siswa;
create policy admin_full_access_siswa on public.siswa for all using (public.is_admin()) with check (public.is_admin());
create policy wali_kelas_akses_siswa_sendiri on public.siswa for select using (kelas_id in (select public.kelas_wali_saya()));
create policy wali_kelas_update_siswa_sendiri on public.siswa for update using (kelas_id in (select public.kelas_wali_saya())) with check (kelas_id in (select public.kelas_wali_saya()));
create policy guru_mapel_lihat_siswa on public.siswa for select using (kelas_id in (select public.kelas_diajar_saya()));
create policy kepsek_lihat_siswa on public.siswa for select using (public.is_kepala_sekolah());

drop policy if exists admin_full_access_absensi on public.log_absensi;
drop policy if exists wali_kelas_akses_absensi_kelasnya on public.log_absensi;
drop policy if exists wali_kelas_update_absensi_kelasnya on public.log_absensi;
drop policy if exists guru_mapel_lihat_absensi on public.log_absensi;
drop policy if exists kepsek_lihat_absensi on public.log_absensi;
drop policy if exists kepsek_update_absensi on public.log_absensi;
create policy admin_full_access_absensi on public.log_absensi for all using (public.is_admin()) with check (public.is_admin());
create policy wali_kelas_akses_absensi_kelasnya on public.log_absensi for select using (siswa_id in (select id from public.siswa where kelas_id in (select public.kelas_wali_saya())));
create policy wali_kelas_update_absensi_kelasnya on public.log_absensi for update using (siswa_id in (select id from public.siswa where kelas_id in (select public.kelas_wali_saya()))) with check (siswa_id in (select id from public.siswa where kelas_id in (select public.kelas_wali_saya())));
create policy guru_mapel_lihat_absensi on public.log_absensi for select using (
  siswa_id in (select id from public.siswa where kelas_id in (select public.kelas_diajar_saya()))
);
create policy kepsek_lihat_absensi on public.log_absensi for select using (public.is_kepala_sekolah());
create policy kepsek_update_absensi on public.log_absensi for update using (public.is_kepala_sekolah()) with check (public.is_kepala_sekolah());

drop policy if exists wali_kelas_insert_absensi on public.log_absensi;
drop policy if exists kepsek_insert_absensi on public.log_absensi;
create policy wali_kelas_insert_absensi on public.log_absensi for insert with check (
  public.is_admin() or siswa_id in (select id from public.siswa where kelas_id in (select public.kelas_wali_saya()))
);
create policy kepsek_insert_absensi on public.log_absensi for insert with check (public.is_kepala_sekolah());

drop policy if exists admin_full_access_pengajuan on public.pengajuan_izin;
drop policy if exists wali_kelas_kelola_pengajuan_kelasnya on public.pengajuan_izin;
drop policy if exists guru_mapel_lihat_pengajuan on public.pengajuan_izin;
drop policy if exists kepsek_lihat_pengajuan on public.pengajuan_izin;
drop policy if exists kepsek_update_pengajuan on public.pengajuan_izin;
create policy admin_full_access_pengajuan on public.pengajuan_izin for all using (public.is_admin()) with check (public.is_admin());
create policy wali_kelas_kelola_pengajuan_kelasnya on public.pengajuan_izin for all using (siswa_id in (select id from public.siswa where kelas_id in (select public.kelas_wali_saya()))) with check (siswa_id in (select id from public.siswa where kelas_id in (select public.kelas_wali_saya())));
create policy guru_mapel_lihat_pengajuan on public.pengajuan_izin for select using (
  siswa_id in (select id from public.siswa where kelas_id in (select public.kelas_diajar_saya()))
);
create policy kepsek_lihat_pengajuan on public.pengajuan_izin for select using (public.is_kepala_sekolah());
create policy kepsek_update_pengajuan on public.pengajuan_izin for update using (public.is_kepala_sekolah()) with check (public.is_kepala_sekolah());

insert into storage.buckets (id, name, public)
values ('lampiran-pengajuan', 'lampiran-pengajuan', false)
on conflict (id) do nothing;
