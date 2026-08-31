-- Migration: Create pairing_requests table and set up RLS/realtime

create table if not exists public.pairing_requests (
    id uuid primary key default gen_random_uuid(),
    perangkat_id uuid not null references public.perangkat_iot(id) on delete cascade,
    uid_kartu text not null,
    created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.pairing_requests enable row level security;

-- Drop existing policies if any
drop policy if exists pairing_requests_admin_all on public.pairing_requests;
drop policy if exists pairing_requests_authenticated_read on public.pairing_requests;

-- Create policies
create policy pairing_requests_admin_all on public.pairing_requests
    for all using (public.is_admin()) with check (public.is_admin());

create policy pairing_requests_authenticated_read on public.pairing_requests
    for select to authenticated using (true);

-- Grant privileges
grant select, insert, update, delete on table public.pairing_requests to authenticated, service_role;

-- Add table to supabase_realtime publication for dashboard listening
do $$
begin
	if not exists (
		select 1
		from pg_publication_tables
		where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pairing_requests'
	) then
		alter publication supabase_realtime add table public.pairing_requests;
	end if;
end
$$;
