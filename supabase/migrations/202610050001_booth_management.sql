-- Photos live in Storage; only their immutable object paths live in Postgres.
alter table public.booths add column thumbnail_path text
  check (thumbnail_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.webp$');

-- An explicitly confirmed booth deletion removes its QR codes and visits atomically.
alter table public.booth_qr_codes drop constraint booth_qr_codes_booth_id_fkey;
alter table public.booth_qr_codes add constraint booth_qr_codes_booth_id_fkey
  foreign key (booth_id) references public.booths(id) on delete cascade;
alter table public.stamps drop constraint stamps_booth_id_fkey;
alter table public.stamps add constraint stamps_booth_id_fkey
  foreign key (booth_id) references public.booths(id) on delete cascade;

-- Edge generates cryptographically random tokens. Lock in stable order, sharing
-- the same booth lock as rotation, so retries never replace an existing QR.
create function public.generate_missing_booth_qrs(p_event uuid, p_codes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_booth uuid;
  v_token text;
  v_generated integer := 0;
begin
  if not exists (select 1 from public.events where id = p_event) then
    return jsonb_build_object('code', 'NOT_FOUND');
  end if;
  for v_booth in
    select id from public.booths
    where event_id = p_event and is_active
    order by id for update
  loop
    if exists (select 1 from public.booth_qr_codes where booth_id = v_booth and is_active) then
      continue;
    end if;
    select c.token into v_token from jsonb_to_recordset(p_codes) as c(booth_id uuid, token text)
      where c.booth_id = v_booth;
    -- A booth added after the snapshot can be generated on the next request.
    if v_token is null then continue; end if;
    insert into public.booth_qr_codes(booth_id, token) values(v_booth, v_token);
    v_generated := v_generated + 1;
  end loop;
  return jsonb_build_object('generated', v_generated);
end;
$$;
revoke all on function public.generate_missing_booth_qrs(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.generate_missing_booth_qrs(uuid, jsonb) to service_role;
