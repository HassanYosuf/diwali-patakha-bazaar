-- Brand placements: slots, campaigns, stats and enquiries.
-- Players never touch these tables; they call bazaar_ads(). Writes from players go through the
-- track and enquire Edge Functions, which use the service role.

create table public.admins (
  email text primary key check (email = lower(email))
);

create table public.slots (
  id text primary key,
  kind text not null check (kind in ('premium_stall', 'hoarding', 'basic_stall')),
  label text not null,
  enabled boolean not null default false
);

-- every slot the game knows how to draw; positions live in index.html
insert into public.slots (id, kind, label, enabled) values
  ('stall-ring',       'premium_stall', 'Ring stall, between Diya Ghar and Sivakasi Wale', true),
  ('stall-ring-b',     'premium_stall', 'Ring stall, across the north path',              false),
  ('hoarding-entry',   'hoarding',      'Entry lane hoarding',                             true),
  ('hoarding-entry-b', 'hoarding',      'Entry lane hoarding, other side',                 false),
  ('hoarding-jhoola',  'hoarding',      'Jhoola ground billboard',                         true);

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  brand text not null check (char_length(brand) between 1 and 80),
  name text not null check (char_length(name) between 1 and 80),
  contact text not null check (char_length(contact) between 3 and 120),
  interest text not null check (interest in ('hoarding', 'premium_stall', 'basic_stall', 'not_sure')),
  message text not null default '' check (char_length(message) <= 1000),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  note text not null default ''
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (char_length(brand) between 1 and 80),
  slot_id text not null references public.slots (id),
  link text not null check (link ~ '^https://[^[:space:]]+$'),
  art jsonb not null default '{}'::jsonb,
  lines jsonb,
  starts_on date not null,
  ends_on date not null,
  enabled boolean not null default true,
  share smallint not null default 1 check (share between 1 and 10),
  enquiry_id uuid references public.enquiries (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index campaigns_live_idx on public.campaigns (slot_id, starts_on, ends_on);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger campaigns_touch before update on public.campaigns
  for each row execute function public.touch_updated_at();

create table public.stats_daily (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  day date not null,
  views int not null default 0,
  clicks int not null default 0,
  primary key (campaign_id, day)
);

-- bookkeeping for the Edge Functions
create table public.track_seen (
  visit text not null,
  campaign_id uuid not null,
  kind text not null,
  day date not null,
  at timestamptz not null default now(),
  primary key (visit, campaign_id, kind, day)
);
create table public.rate_hits (
  key text not null,
  win timestamptz not null,
  n int not null default 0,
  primary key (key, win)
);

-- access: RLS on everything; players get no table privileges at all
alter table public.admins      enable row level security;
alter table public.slots       enable row level security;
alter table public.campaigns   enable row level security;
alter table public.stats_daily enable row level security;
alter table public.enquiries   enable row level security;
alter table public.track_seen  enable row level security;
alter table public.rate_hits   enable row level security;
revoke all on public.admins, public.slots, public.campaigns, public.stats_daily, public.enquiries,
  public.track_seen, public.rate_hits from anon;
revoke all on public.track_seen, public.rate_hits from authenticated;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where email = lower(coalesce(auth.jwt() ->> 'email', '')))
$$;
revoke execute on function public.is_admin() from public, anon;

create policy admins_read on public.admins for select to authenticated using (public.is_admin());
create policy slots_admin on public.slots for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy campaigns_admin on public.campaigns for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy stats_read on public.stats_daily for select to authenticated using (public.is_admin());
create policy enquiries_read on public.enquiries for select to authenticated using (public.is_admin());
create policy enquiries_update on public.enquiries for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy enquiries_delete on public.enquiries for delete to authenticated using (public.is_admin());

-- what players see: switched-on slots and the campaigns live in them today (India time)
create function public.bazaar_ads(p_today date default (now() at time zone 'Asia/Kolkata')::date) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'kind', s.kind) order by s.id)
      from public.slots s where s.enabled), '[]'::jsonb),
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'brand', c.brand, 'slot_id', c.slot_id, 'link', c.link,
                                          'art', c.art, 'lines', c.lines, 'share', c.share) order by c.created_at, c.id)
      from public.campaigns c join public.slots s on s.id = c.slot_id and s.enabled
      where c.enabled and p_today between c.starts_on and c.ends_on), '[]'::jsonb))
$$;
revoke execute on function public.bazaar_ads(date) from public;
grant execute on function public.bazaar_ads(date) to anon, authenticated;

-- one view or click per visit, campaign and day; unknown campaigns are ignored
create function public.track_event(p_visit text, p_campaign uuid, p_kind text, p_day date) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_kind not in ('v', 'c') then raise exception 'unknown event type %', p_kind; end if;
  if not exists (select 1 from public.campaigns where id = p_campaign) then return false; end if;
  insert into public.track_seen (visit, campaign_id, kind, day) values (p_visit, p_campaign, p_kind, p_day)
    on conflict do nothing;
  if not found then return false; end if;
  insert into public.stats_daily (campaign_id, day, views, clicks)
    values (p_campaign, p_day, (p_kind = 'v')::int, (p_kind = 'c')::int)
    on conflict (campaign_id, day) do update
      set views = public.stats_daily.views + excluded.views, clicks = public.stats_daily.clicks + excluded.clicks;
  return true;
end $$;
revoke execute on function public.track_event(text, uuid, text, date) from public, anon, authenticated;
grant execute on function public.track_event(text, uuid, text, date) to service_role;

-- fixed-window counter: true while the key is within p_max hits for the current window
create function public.rate_hit(p_key text, p_window_s int, p_max int) returns boolean
language sql volatile security definer set search_path = '' as $$
  insert into public.rate_hits (key, win, n)
    values (p_key, to_timestamp(floor(extract(epoch from now()) / p_window_s) * p_window_s), 1)
  on conflict (key, win) do update set n = public.rate_hits.n + 1
  returning n <= p_max
$$;
revoke execute on function public.rate_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_hit(text, int, int) to service_role;

-- artwork: anyone can view, only admins can change; size and type enforced by the bucket too
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-art', 'brand-art', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy brand_art_read on storage.objects for select to authenticated
  using (bucket_id = 'brand-art' and public.is_admin());
create policy brand_art_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-art' and public.is_admin());
create policy brand_art_update on storage.objects for update to authenticated
  using (bucket_id = 'brand-art' and public.is_admin()) with check (bucket_id = 'brand-art' and public.is_admin());
create policy brand_art_delete on storage.objects for delete to authenticated
  using (bucket_id = 'brand-art' and public.is_admin());

-- daily clean-up of bookkeeping older than two days
create extension if not exists pg_cron;
select cron.schedule('purge-brand-bookkeeping', '0 3 * * *', $$
  delete from public.track_seen where at < now() - interval '2 days';
  delete from public.rate_hits where win < now() - interval '2 days';
$$);
