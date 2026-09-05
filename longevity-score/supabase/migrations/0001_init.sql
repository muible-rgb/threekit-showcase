-- Longevity Score v1 - initial schema
-- Design rules encoded here (not just in docs):
--   1. results are append-only. Enforced by trigger, not convention.
--   2. The battery is versioned. A second battery is an INSERT, not a migration.
--   3. RLS: you see your own data, plus data from sessions you are in,
--      plus any session board that has been made public by its host.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type sex_t          as enum ('M', 'F');
create type direction_t    as enum ('higher_better', 'lower_better');
create type session_status as enum ('open', 'locked');
create type measurement_kind as enum ('sit_reach', 'hr_finish', 'hr_1min', 'resting_hr');

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  sex          sex_t not null,
  birth_date   date not null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Battery definition (reference data)
-- ---------------------------------------------------------------------------
create table capacities (
  id   uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

create table test_variants (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  capacity_id      uuid not null references capacities (id),
  name             text not null,
  unit             text not null,
  direction        direction_t not null,
  protocol_md      text not null,
  norms_file       text not null,          -- path under /data/norms/
  demo_video_id    text,                   -- YouTube id, blank for now
  value_min        numeric,                -- input sanity bounds
  value_max        numeric,
  value_step       numeric not null default 1,
  order_in_battery int not null
);

create table battery_versions (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text not null,
  created_at  timestamptz not null default now()
);

create table battery_version_tests (
  battery_version_id uuid not null references battery_versions (id) on delete cascade,
  test_variant_id    uuid not null references test_variants (id),
  position           int  not null,
  primary key (battery_version_id, test_variant_id),
  unique (battery_version_id, position)
);

-- One capacity may appear only once per battery version. This is what keeps
-- composites comparable across battery versions: every battery is 10 capacities,
-- so the composite is always the mean of the same 10 things.
create or replace function battery_capacity_is_unique() returns trigger
language plpgsql as $$
declare
  cap uuid;
  dupes int;
begin
  select capacity_id into cap from test_variants where id = new.test_variant_id;
  select count(*) into dupes
    from battery_version_tests bvt
    join test_variants tv on tv.id = bvt.test_variant_id
   where bvt.battery_version_id = new.battery_version_id
     and tv.capacity_id = cap
     and bvt.test_variant_id <> new.test_variant_id;
  if dupes > 0 then
    raise exception 'battery version % already covers capacity %',
      new.battery_version_id, cap;
  end if;
  return new;
end;
$$;

create trigger battery_version_tests_one_per_capacity
  before insert or update on battery_version_tests
  for each row execute function battery_capacity_is_unique();

-- ---------------------------------------------------------------------------
-- People taking tests. A participant may be a guest (no user_id yet).
-- ---------------------------------------------------------------------------
create table participants (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users (id) on delete set null,
  guest_name       text,
  guest_sex        sex_t,
  guest_birth_date date,
  claim_email      text,
  claimed_at       timestamptz,
  created_at       timestamptz not null default now(),
  -- Either linked to a user, or carrying enough guest detail to be scored.
  constraint participant_identified check (
    user_id is not null
    or (guest_name is not null and guest_sex is not null and guest_birth_date is not null)
  )
);

create index participants_user_id_idx on participants (user_id);

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------
create table sessions (
  id                 uuid primary key default gen_random_uuid(),
  host_user_id       uuid not null references auth.users (id) on delete cascade,
  battery_version_id uuid not null references battery_versions (id),
  name               text not null,
  code               text not null unique,
  status             session_status not null default 'open',
  starts_at          timestamptz,
  location_text      text,
  locked_at          timestamptz,
  created_at         timestamptz not null default now()
);

create table session_participants (
  session_id     uuid not null references sessions (id) on delete cascade,
  participant_id uuid not null references participants (id) on delete cascade,
  bodyweight_kg  numeric,
  joined_at      timestamptz not null default now(),
  primary key (session_id, participant_id)
);

-- 6-char join code, unambiguous alphabet (no O/0/I/1).
create or replace function gen_session_code() returns text
language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out text := '';
  i int;
begin
  loop
    out := '';
    for i in 1..6 loop
      out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from sessions where code = out);
  end loop;
  return out;
end;
$$;

alter table sessions alter column code set default gen_session_code();

-- ---------------------------------------------------------------------------
-- Results. Immutable.
-- ---------------------------------------------------------------------------
create table results (
  id                       uuid primary key default gen_random_uuid(),
  participant_id           uuid not null references participants (id) on delete cascade,
  session_id               uuid references sessions (id) on delete set null,
  test_variant_id          uuid not null references test_variants (id),
  raw_value                numeric not null,
  recorded_at              timestamptz not null default now(),
  recorded_by_participant_id uuid references participants (id),
  witnessed                boolean not null default false,
  notes                    text,
  -- A correction points at the row it replaces. The old row still stands.
  supersedes_result_id     uuid references results (id),
  created_at               timestamptz not null default now()
);

create index results_participant_idx on results (participant_id, test_variant_id, recorded_at desc);
create index results_session_idx on results (session_id);

create or replace function results_are_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'results rows are immutable; insert a new row with supersedes_result_id instead';
end;
$$;

create trigger results_no_update before update on results
  for each row execute function results_are_immutable();
create trigger results_no_delete before delete on results
  for each row execute function results_are_immutable();

-- ---------------------------------------------------------------------------
-- Unscored measurements. Stored and displayed, never in the composite.
-- ---------------------------------------------------------------------------
create table unscored_measurements (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants (id) on delete cascade,
  session_id     uuid references sessions (id) on delete set null,
  kind           measurement_kind not null,
  value          numeric not null,
  recorded_at    timestamptz not null default now()
);

create index unscored_participant_idx on unscored_measurements (participant_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- Derived: one row per participant per completed 10-test battery.
-- Fully recomputable. Nothing here is a source of truth.
-- ---------------------------------------------------------------------------
create table battery_completions (
  id                 uuid primary key default gen_random_uuid(),
  participant_id     uuid not null references participants (id) on delete cascade,
  session_id         uuid references sessions (id) on delete set null,
  battery_version_id uuid not null references battery_versions (id),
  composite          numeric(4,1) not null,
  test_percentiles   jsonb not null,   -- { test_variant_slug: { raw, percentile, band, provisional } }
  fitness_age        numeric(4,1),
  fitness_age_approx boolean not null default false,
  norms_version      text not null,
  completed_at       timestamptz not null,
  computed_at        timestamptz not null default now(),
  public_slug        text unique default encode(gen_random_bytes(9), 'base64')
);

create index completions_participant_idx on battery_completions (participant_id, completed_at desc);
create index completions_session_idx on battery_completions (session_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table profiles              enable row level security;
alter table participants          enable row level security;
alter table sessions              enable row level security;
alter table session_participants  enable row level security;
alter table results               enable row level security;
alter table unscored_measurements enable row level security;
alter table battery_completions   enable row level security;

-- Reference data is world-readable; only service role writes it.
alter table capacities            enable row level security;
alter table test_variants         enable row level security;
alter table battery_versions      enable row level security;
alter table battery_version_tests enable row level security;

create policy ref_read_capacities   on capacities            for select using (true);
create policy ref_read_variants     on test_variants         for select using (true);
create policy ref_read_batteries    on battery_versions      for select using (true);
create policy ref_read_battery_tests on battery_version_tests for select using (true);

-- Helper: participant ids belonging to the calling user.
create or replace function my_participant_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from participants where user_id = auth.uid();
$$;

-- Helper: sessions the caller hosts or participates in.
create or replace function my_session_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from sessions where host_user_id = auth.uid()
  union
  select sp.session_id from session_participants sp
   where sp.participant_id in (select id from participants where user_id = auth.uid());
$$;

create policy profiles_self on profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy participants_visible on participants
  for select using (
    user_id = auth.uid()
    or id in (select participant_id from session_participants
               where session_id in (select my_session_ids()))
  );

create policy participants_insert on participants
  for insert with check (user_id = auth.uid() or user_id is null);

create policy participants_claim on participants
  for update using (user_id is null or user_id = auth.uid())
  with check (user_id = auth.uid());

create policy sessions_visible on sessions
  for select using (host_user_id = auth.uid() or id in (select my_session_ids()));

create policy sessions_host_writes on sessions
  for insert with check (host_user_id = auth.uid());

create policy sessions_host_updates on sessions
  for update using (host_user_id = auth.uid()) with check (host_user_id = auth.uid());

create policy session_participants_visible on session_participants
  for select using (session_id in (select my_session_ids()));

create policy session_participants_join on session_participants
  for insert with check (
    session_id in (select id from sessions where status = 'open')
  );

create policy results_visible on results
  for select using (
    participant_id in (select my_participant_ids())
    or session_id in (select my_session_ids())
  );

-- Anyone in an open session may record for anyone else in it (the host enters
-- for guests). Outside a session you may only record for yourself.
create policy results_insert on results
  for insert with check (
    (session_id is null and participant_id in (select my_participant_ids()))
    or (session_id in (select my_session_ids())
        and exists (select 1 from sessions s
                     where s.id = session_id and s.status = 'open'))
  );

create policy unscored_visible on unscored_measurements
  for select using (
    participant_id in (select my_participant_ids())
    or session_id in (select my_session_ids())
  );

create policy unscored_insert on unscored_measurements
  for insert with check (
    participant_id in (select my_participant_ids())
    or session_id in (select my_session_ids())
  );

-- Completions are readable by the owner, by co-participants, and publicly by
-- public_slug (the share link). The public path goes through a security-definer
-- RPC rather than a permissive policy.
create policy completions_visible on battery_completions
  for select using (
    participant_id in (select my_participant_ids())
    or session_id in (select my_session_ids())
  );

create policy completions_insert on battery_completions
  for insert with check (
    participant_id in (select my_participant_ids())
    or session_id in (select my_session_ids())
  );

create or replace function public_completion(slug text)
returns table (
  composite numeric,
  test_percentiles jsonb,
  fitness_age numeric,
  fitness_age_approx boolean,
  completed_at timestamptz,
  display_name text,
  sex sex_t,
  age_band text
)
language sql stable security definer set search_path = public as $$
  select bc.composite,
         bc.test_percentiles,
         bc.fitness_age,
         bc.fitness_age_approx,
         bc.completed_at,
         coalesce(p.display_name, pa.guest_name) as display_name,
         coalesce(p.sex, pa.guest_sex) as sex,
         to_char(
           5 * floor(extract(year from age(bc.completed_at,
             coalesce(p.birth_date, pa.guest_birth_date)))::int / 5.0), 'FM999'
         ) as age_band
    from battery_completions bc
    join participants pa on pa.id = bc.participant_id
    left join profiles p on p.user_id = pa.user_id
   where bc.public_slug = slug;
$$;

-- Public session board: readable by anyone holding the link.
create or replace function public_session_board(session_code text)
returns table (
  session_name text,
  status session_status,
  location_text text,
  starts_at timestamptz,
  participant_id uuid,
  display_name text,
  composite numeric,
  tests_completed int
)
language sql stable security definer set search_path = public as $$
  select s.name,
         s.status,
         s.location_text,
         s.starts_at,
         pa.id,
         coalesce(pr.display_name, pa.guest_name),
         bc.composite,
         (select count(distinct r.test_variant_id)::int
            from results r
           where r.session_id = s.id and r.participant_id = pa.id)
    from sessions s
    join session_participants sp on sp.session_id = s.id
    join participants pa on pa.id = sp.participant_id
    left join profiles pr on pr.user_id = pa.user_id
    left join battery_completions bc
           on bc.session_id = s.id and bc.participant_id = pa.id
   where s.code = upper(session_code);
$$;
