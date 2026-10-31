-- ========================================================
-- Elevate Chamber / BetterPO - Complete Supabase Setup
-- Includes:
-- 1. Full Schema with Timer math support
-- 2. Permanent platform_metrics table (Lifetime Analytics)
-- 3. Automatic Triggers for rooms, debaters, and speeches
-- 4. 14-day SpeechDrop-style Auto-Cleanup Function (Storage Protection)
-- 5. Row Level Security & Realtime Publications
-- ========================================================

create extension if not exists "uuid-ossp";

-- 1. ROOMS TABLE
create table if not exists public.rooms (
    id uuid primary key default gen_random_uuid(),
    code varchar(8) unique not null,
    name text not null,
    po_passcode text not null,
    status text not null default 'in_session' check (status in ('in_session', 'recess', 'adjourned')),
    current_legislation text default '',
    current_speaker_id uuid default null,
    active_bill_id uuid default null,
    last_speech_side text default null,
    recess_end_time timestamptz default null,
    settings jsonb default '{"cx_mode": "direct", "author_cx_duration": 120, "grace_period": 10}'::jsonb not null,
    active_amendment jsonb default null,
    global_speech_sequence integer default 0 not null,
    global_question_sequence integer default 0 not null,
    -- Local Timestamp Timer Math Columns (Zero Per-Second DB writes)
    timer_status text default 'reset' check (timer_status in ('running', 'paused', 'reset')),
    timer_remaining_seconds integer default 190,
    timer_duration integer default 190,
    timer_updated_at timestamptz default now(),
    timer_mode text default 'speech',
    created_at timestamptz default now() not null
);

-- Ensure timer and settings columns exist on pre-existing rooms table
alter table public.rooms
    add column if not exists settings jsonb default '{"cx_mode": "direct", "author_cx_duration": 120, "grace_period": 10}'::jsonb not null,
    add column if not exists active_amendment jsonb default null,
    add column if not exists timer_status text default 'reset',
    add column if not exists timer_remaining_seconds integer default 190,
    add column if not exists timer_duration integer default 190,
    add column if not exists timer_updated_at timestamptz default now(),
    add column if not exists timer_mode text default 'speech';

-- 2. REPRESENTATIVES TABLE
create table if not exists public.representatives (
    id uuid primary key default gen_random_uuid(),
    room_id uuid references public.rooms(id) on delete cascade not null,
    name text not null,
    school text default '',
    speeches_count integer default 0 not null check (speeches_count >= 0),
    last_speech_order integer default 0 not null,
    questions_count integer default 0 not null check (questions_count >= 0),
    last_question_order integer default 0 not null,
    active boolean default true not null,
    is_present boolean default true not null
);

alter table public.representatives
    add column if not exists is_present boolean default true not null;

-- 3. BILLS / DOCKET TABLE
create table if not exists public.bills (
    id uuid primary key default gen_random_uuid(),
    room_id uuid references public.rooms(id) on delete cascade not null,
    bill_number text not null,
    title text not null,
    author_school text default '',
    speech_count integer default 0 not null check (speech_count >= 0),
    cycle_broken boolean default false not null,
    status text not null default 'active' check (status in ('active', 'passed', 'failed', 'tabled', 'upcoming')),
    created_at timestamptz default now() not null
);

-- Foreign Keys on rooms
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'fk_rooms_current_speaker') then
        alter table public.rooms
            add constraint fk_rooms_current_speaker
            foreign key (current_speaker_id)
            references public.representatives(id)
            on delete set null;
    end if;

    if not exists (select 1 from pg_constraint where conname = 'fk_rooms_active_bill') then
        alter table public.rooms
            add constraint fk_rooms_active_bill
            foreign key (active_bill_id)
            references public.bills(id)
            on delete set null;
    end if;
end $$;

-- 4. ROUND_EVENTS TABLE (Immutable Ledger)
create table if not exists public.round_events (
    id uuid primary key default gen_random_uuid(),
    room_id uuid references public.rooms(id) on delete cascade not null,
    representative_id uuid references public.representatives(id) on delete cascade not null,
    bill_id uuid references public.bills(id) on delete set null,
    event_type text not null,
    sequence_number integer not null,
    legislation text default '',
    created_at timestamptz default now() not null
);

-- Indexes
create index if not exists idx_rooms_code on public.rooms(code);
create index if not exists idx_rooms_created_at on public.rooms(created_at);
create index if not exists idx_representatives_room_id on public.representatives(room_id);
create index if not exists idx_bills_room_id on public.bills(room_id, status);
create index if not exists idx_round_events_room_id on public.round_events(room_id, created_at desc);

-- ========================================================
-- 5. PERMANENT PLATFORM METRICS TABLE (Lifetime Analytics)
-- ========================================================
create table if not exists public.platform_metrics (
    id text primary key default 'global',
    total_rooms_all_time bigint default 0 not null,
    total_debaters_all_time bigint default 0 not null,
    total_speeches_all_time bigint default 0 not null,
    updated_at timestamptz default now() not null
);

-- Seed global row
insert into public.platform_metrics (id, total_rooms_all_time, total_debaters_all_time, total_speeches_all_time)
values ('global', 0, 0, 0)
on conflict (id) do nothing;

-- Triggers for Platform Metrics
create or replace function public.increment_platform_rooms()
returns trigger as $$
begin
    insert into public.platform_metrics (id, total_rooms_all_time, updated_at)
    values ('global', 1, now())
    on conflict (id) do update set
        total_rooms_all_time = public.platform_metrics.total_rooms_all_time + 1,
        updated_at = now();
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_increment_rooms on public.rooms;
create trigger trg_increment_rooms
    after insert on public.rooms
    for each row execute function public.increment_platform_rooms();

create or replace function public.increment_platform_debaters()
returns trigger as $$
begin
    insert into public.platform_metrics (id, total_debaters_all_time, updated_at)
    values ('global', 1, now())
    on conflict (id) do update set
        total_debaters_all_time = public.platform_metrics.total_debaters_all_time + 1,
        updated_at = now();
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_increment_representatives on public.representatives;
create trigger trg_increment_representatives
    after insert on public.representatives
    for each row execute function public.increment_platform_debaters();

create or replace function public.increment_platform_speeches()
returns trigger as $$
begin
    if new.event_type like 'speech_%' then
        insert into public.platform_metrics (id, total_speeches_all_time, updated_at)
        values ('global', 1, now())
        on conflict (id) do update set
            total_speeches_all_time = public.platform_metrics.total_speeches_all_time + 1,
            updated_at = now();
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_increment_speeches on public.round_events;
create trigger trg_increment_speeches
    after insert on public.round_events
    for each row execute function public.increment_platform_speeches();

-- ========================================================
-- 6. AUTO-CLEANUP FUNCTION: SpeechDrop-style 14-day Purge
-- ========================================================
create or replace function public.cleanup_expired_rooms()
returns json as $$
declare
    deleted_count integer;
begin
    delete from public.rooms
    where created_at < now() - interval '14 days';
    get diagnostics deleted_count = row_count;
    return json_build_object(
        'status', 'success',
        'deleted_rooms_count', deleted_count,
        'timestamp', now()
    );
end;
$$ language plpgsql security definer;

grant execute on function public.cleanup_expired_rooms() to anon, authenticated, service_role;

-- ========================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================
alter table public.rooms enable row level security;
alter table public.representatives enable row level security;
alter table public.bills enable row level security;
alter table public.round_events enable row level security;
alter table public.platform_metrics enable row level security;

drop policy if exists "Rooms are viewable by everyone" on public.rooms;
drop policy if exists "Rooms can be created by anyone" on public.rooms;
drop policy if exists "Rooms can be updated by anyone" on public.rooms;
create policy "Rooms are viewable by everyone" on public.rooms for select using (true);
create policy "Rooms can be created by anyone" on public.rooms for insert with check (true);
create policy "Rooms can be updated by anyone" on public.rooms for update using (true);

drop policy if exists "Representatives viewable by everyone" on public.representatives;
drop policy if exists "Representatives manageable by anyone" on public.representatives;
create policy "Representatives viewable by everyone" on public.representatives for select using (true);
create policy "Representatives manageable by anyone" on public.representatives for all using (true) with check (true);

drop policy if exists "Bills viewable by everyone" on public.bills;
drop policy if exists "Bills manageable by anyone" on public.bills;
create policy "Bills viewable by everyone" on public.bills for select using (true);
create policy "Bills manageable by anyone" on public.bills for all using (true) with check (true);

drop policy if exists "Round events viewable by everyone" on public.round_events;
drop policy if exists "Round events manageable by anyone" on public.round_events;
create policy "Round events viewable by everyone" on public.round_events for select using (true);
create policy "Round events manageable by anyone" on public.round_events for all using (true) with check (true);

drop policy if exists "Platform metrics viewable by everyone" on public.platform_metrics;
create policy "Platform metrics viewable by everyone" on public.platform_metrics for select using (true);

-- ========================================================
-- 8. REALTIME REPLICATION (PO & Admin Channels)
-- ========================================================
alter table public.rooms replica identity full;
alter table public.representatives replica identity full;
alter table public.bills replica identity full;
alter table public.round_events replica identity full;

do $$
begin
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'rooms') then
        alter publication supabase_realtime add table public.rooms;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'representatives') then
        alter publication supabase_realtime add table public.representatives;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'bills') then
        alter publication supabase_realtime add table public.bills;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'round_events') then
        alter publication supabase_realtime add table public.round_events;
    end if;
end $$;

