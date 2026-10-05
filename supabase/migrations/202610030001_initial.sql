create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 64),
  name text not null check (length(trim(name)) between 1 and 80),
  description text not null default '' check (length(description) <= 240),
  location text not null default '' check (length(location) <= 100),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'ended')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
-- 초기 버전은 행사 1개 운영. 여러 행사 지원 시 이 인덱스와 관리 화면을 함께 확장한다.
create unique index one_event_per_installation on public.events ((true));

create table public.booths (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 60),
  description text not null default '' check (length(description) <= 160),
  location text not null default '' check (length(location) <= 80),
  icon text not null default 'sparkles' check (icon in ('coffee', 'palette', 'leaf', 'camera', 'music', 'sparkles', 'gift', 'heart')),
  color text not null default 'peach' check (color in ('peach', 'lilac', 'sage', 'sky', 'butter', 'rose')),
  sort_order integer not null default 0 check (sort_order between 0 and 9999),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index booths_event_order on public.booths(event_id, sort_order);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.booth_qr_codes (
  id uuid primary key default gen_random_uuid(),
  booth_id uuid not null references public.booths(id) on delete restrict,
  token text not null unique check (token ~ '^[a-f0-9]{64}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index one_active_qr_per_booth on public.booth_qr_codes(booth_id) where is_active;

create table public.stamps (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references auth.users(id) on delete cascade,
  booth_id uuid not null references public.booths(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (participant_id, booth_id)
);
create index stamps_booth on public.stamps(booth_id);

create table public.claim_rate_limits (
  participant_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  requests integer not null check (requests > 0)
);

alter table public.events enable row level security;
alter table public.booths enable row level security;
alter table public.admin_users enable row level security;
alter table public.booth_qr_codes enable row level security;
alter table public.stamps enable row level security;
alter table public.claim_rate_limits enable row level security;

-- Supabase의 기본 권한을 명시적으로 제거하고 필요한 조회만 허용한다.
revoke all on public.events, public.booths, public.admin_users, public.booth_qr_codes, public.stamps, public.claim_rate_limits from anon, authenticated;
grant select on public.events, public.booths to anon, authenticated;
grant select on public.stamps to authenticated;
grant all on public.events, public.booths, public.admin_users, public.booth_qr_codes, public.stamps, public.claim_rate_limits to service_role;

create policy published_events on public.events for select to anon, authenticated
  using (status in ('published', 'ended'));
create policy visible_booths on public.booths for select to anon, authenticated
  using (is_active and exists (select 1 from public.events e where e.id = event_id and e.status in ('published', 'ended')));
create policy own_stamps on public.stamps for select to authenticated
  using (participant_id = (select auth.uid()));

create function public.keep_event_slug() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.slug is distinct from new.slug then
    raise exception 'Event slug cannot change after creation';
  end if;
  return new;
end;
$$;
create trigger immutable_event_slug before update on public.events
  for each row execute function public.keep_event_slug();

-- 서비스 역할로만 실행. p_participant는 Edge Function이 검증한 JWT에서 결정한다.
create function public.claim_stamp(p_participant uuid, p_slug text, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_booth_id uuid;
  v_active boolean;
  v_status text;
  v_start timestamptz;
  v_end timestamptz;
  v_stamp public.stamps%rowtype;
  v_requests integer;
  v_now timestamptz := statement_timestamp();
begin
  insert into public.claim_rate_limits(participant_id, window_start, requests)
  values (p_participant, date_trunc('minute', v_now), 1)
  on conflict (participant_id) do update set
    window_start = excluded.window_start,
    requests = case when claim_rate_limits.window_start = excluded.window_start then claim_rate_limits.requests + 1 else 1 end
  where claim_rate_limits.window_start <> excluded.window_start or claim_rate_limits.requests < 60
  returning requests into v_requests;
  if v_requests is null then return jsonb_build_object('code', 'RATE_LIMITED'); end if;

  -- QR 재발급·부스 비활성화·행사 상태 변경과 같은 트랜잭션 경계에서 검증한다.
  select b.id, b.is_active, e.status, e.starts_at, e.ends_at
    into v_booth_id, v_active, v_status, v_start, v_end
    from public.booth_qr_codes q
    join public.booths b on b.id = q.booth_id
    join public.events e on e.id = b.event_id
    where q.token = p_token and q.is_active and e.slug = p_slug
    for share of e, b, q;
  if not found then return jsonb_build_object('code', 'INVALID_QR'); end if;
  if not v_active then return jsonb_build_object('code', 'BOOTH_INACTIVE'); end if;
  if v_status <> 'published' or v_now < v_start or v_now >= v_end then
    return jsonb_build_object('code', 'EVENT_CLOSED');
  end if;

  insert into public.stamps(participant_id, booth_id)
    values (p_participant, v_booth_id)
    on conflict (participant_id, booth_id) do nothing returning * into v_stamp;
  if found then
    return jsonb_build_object('status', 'claimed', 'booth_id', v_stamp.booth_id, 'created_at', v_stamp.created_at);
  end if;
  select * into v_stamp from public.stamps where participant_id = p_participant and booth_id = v_booth_id;
  return jsonb_build_object('status', 'already_claimed', 'booth_id', v_stamp.booth_id, 'created_at', v_stamp.created_at);
end;
$$;

create function public.rotate_booth_qr(p_booth uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_qr public.booth_qr_codes%rowtype;
begin
  perform 1 from public.booths where id = p_booth for update;
  if not found then return jsonb_build_object('code', 'NOT_FOUND'); end if;
  update public.booth_qr_codes set is_active = false where booth_id = p_booth and is_active;
  insert into public.booth_qr_codes(booth_id, token) values(p_booth, p_token) returning * into v_qr;
  return to_jsonb(v_qr);
end;
$$;

revoke all on function public.claim_stamp(uuid, text, text) from public, anon, authenticated;
revoke all on function public.rotate_booth_qr(uuid, text) from public, anon, authenticated;
revoke all on function public.keep_event_slug() from public, anon, authenticated;
grant execute on function public.claim_stamp(uuid, text, text) to service_role;
grant execute on function public.rotate_booth_qr(uuid, text) to service_role;
