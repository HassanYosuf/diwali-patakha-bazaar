begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

-- start from empty brand tables whatever other test suites left behind (rolled back at the end)
delete from public.stats_daily; delete from public.campaigns; delete from public.enquiries;
update public.slots set enabled = id in ('stall-ring', 'hoarding-entry', 'hoarding-jhoola');

-- fixtures (as postgres)
insert into public.admins(email) values ('admin@test.local') on conflict do nothing;
insert into public.campaigns(id, brand, slot_id, link, art, starts_on, ends_on, enabled) values
  ('00000000-0000-0000-0000-0000000000a1', 'Acme',   'hoarding-entry', 'https://acme.example/', '{"wide":"https://cdn.example/a.jpg"}', '2026-11-01', '2026-11-01', true),
  ('00000000-0000-0000-0000-0000000000a2', 'Off',    'hoarding-entry', 'https://off.example/',  '{"wide":"https://cdn.example/b.jpg"}', '2026-11-01', '2026-11-30', false),
  ('00000000-0000-0000-0000-0000000000a3', 'Hidden', 'stall-ring-b',   'https://hid.example/',  '{"wide":"https://cdn.example/c.jpg"}', '2026-11-01', '2026-11-30', true),
  ('00000000-0000-0000-0000-0000000000a4', 'Today',  'hoarding-jhoola','https://now.example/',  '{"wide":"https://cdn.example/d.jpg"}',
     (now() at time zone 'Asia/Kolkata')::date, (now() at time zone 'Asia/Kolkata')::date, true);
insert into public.enquiries(brand, name, contact, interest) values ('Bolt', 'Asha', 'asha@bolt.example', 'hoarding');
insert into public.stats_daily(campaign_id, day, views, clicks) values ('00000000-0000-0000-0000-0000000000a1', '2026-11-01', 5, 1);

-- check constraints
select throws_ok($$insert into public.campaigns(brand, slot_id, link, starts_on, ends_on) values ('X','hoarding-entry','javascript:alert(1)','2026-11-01','2026-11-02')$$, '23514', null, 'non-https link rejected');
select throws_ok($$insert into public.campaigns(brand, slot_id, link, starts_on, ends_on, share) values ('X','hoarding-entry','https://x.example','2026-11-01','2026-11-02',0)$$, '23514', null, 'share 0 rejected');
select throws_ok($$insert into public.campaigns(brand, slot_id, link, starts_on, ends_on, share) values ('X','hoarding-entry','https://x.example','2026-11-01','2026-11-02',11)$$, '23514', null, 'share 11 rejected');
select throws_ok($$insert into public.campaigns(brand, slot_id, link, starts_on, ends_on) values ('X','hoarding-entry','https://x.example','2026-11-02','2026-11-01')$$, '23514', null, 'end before start rejected');

-- service role: counting and rate limits
set local role service_role;
select is(public.track_event('visit-1', '00000000-0000-0000-0000-0000000000a1', 'v', '2026-11-02'), true,  'first view counts');
select is(public.track_event('visit-1', '00000000-0000-0000-0000-0000000000a1', 'v', '2026-11-02'), false, 'repeat view from the same visit does not');
select is((select views from public.stats_daily where campaign_id = '00000000-0000-0000-0000-0000000000a1' and day = '2026-11-02'), 1, 'one view stored');
select is(public.track_event('visit-2', '00000000-0000-0000-0000-0000000000a1', 'v', '2026-11-02'), true, 'another visit counts');
select is(public.track_event('visit-2', '00000000-0000-0000-0000-0000000000a1', 'c', '2026-11-02'), true, 'a click counts separately');
select results_eq($$select views, clicks from public.stats_daily where campaign_id = '00000000-0000-0000-0000-0000000000a1' and day = '2026-11-02'$$,
                  $$values (2, 1)$$, 'two views, one click');
select is(public.track_event('visit-3', '00000000-0000-0000-0000-00000000dead', 'v', '2026-11-02'), false, 'unknown campaign is ignored, not an error');
select throws_ok($$select public.track_event('visit-3', '00000000-0000-0000-0000-0000000000a1', 'x', '2026-11-02')$$, null, null, 'unknown event type rejected');
select is(public.rate_hit('k', 60, 2), true,  'rate hit 1 of 2');
select is(public.rate_hit('k', 60, 2), true,  'rate hit 2 of 2');
select is(public.rate_hit('k', 60, 2), false, 'rate hit 3 is over');
reset role;

-- players (anon key)
set local role anon;
select is(jsonb_array_length(public.bazaar_ads('2026-11-01')->'slots'), 3, 'three slots are on');
select ok(public.bazaar_ads('2026-11-01')->'campaigns' @> '[{"id":"00000000-0000-0000-0000-0000000000a1"}]', 'campaign live on its only day');
select ok(not (public.bazaar_ads('2026-11-02')->'campaigns' @> '[{"id":"00000000-0000-0000-0000-0000000000a1"}]'), 'gone the day after');
select ok(not (public.bazaar_ads('2026-10-31')->'campaigns' @> '[{"id":"00000000-0000-0000-0000-0000000000a1"}]'), 'not yet live the day before');
select ok(not (public.bazaar_ads('2026-11-05')->'campaigns' @> '[{"id":"00000000-0000-0000-0000-0000000000a2"}]'), 'switched-off campaign never shows');
select ok(not (public.bazaar_ads('2026-11-05')->'campaigns' @> '[{"id":"00000000-0000-0000-0000-0000000000a3"}]'), 'campaign on a switched-off slot never shows');
select is((select array_agg(k order by k) from jsonb_object_keys(public.bazaar_ads('2026-11-01')->'campaigns'->0) k),
          array['art','brand','id','lines','link','share','slot_id'], 'players get only public fields');
-- "today" is India's date whatever the session time zone (these two zones cover every hour of the IST day between them)
set local timezone = 'Pacific/Kiritimati';
select ok(public.bazaar_ads()->'campaigns' @> '[{"id":"00000000-0000-0000-0000-0000000000a4"}]', 'IST today, session at UTC+14');
set local timezone = 'Pacific/Pago_Pago';
select ok(public.bazaar_ads()->'campaigns' @> '[{"id":"00000000-0000-0000-0000-0000000000a4"}]', 'IST today, session at UTC-11');
select throws_ok('select * from public.campaigns',   '42501', null, 'players cannot read campaigns');
select throws_ok('select * from public.stats_daily', '42501', null, 'players cannot read stats');
select throws_ok('select * from public.enquiries',   '42501', null, 'players cannot read enquiries');
select throws_ok('select * from public.admins',      '42501', null, 'players cannot read admins');
select throws_ok($$insert into public.campaigns(brand, slot_id, link, starts_on, ends_on) values ('X','hoarding-entry','https://x.example','2026-11-01','2026-11-02')$$, '42501', null, 'players cannot add campaigns');
select throws_ok($$select public.track_event('v', '00000000-0000-0000-0000-0000000000a1', 'v', '2026-11-02')$$, '42501', null, 'players cannot call track_event directly');
select throws_ok($$select public.rate_hit('k', 60, 2)$$, '42501', null, 'players cannot call rate_hit directly');
reset role;

-- a signed-in user who is not an admin
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","email":"user@test.local","role":"authenticated"}';
select is((select count(*)::int from public.campaigns), 0, 'non-admin sees no campaigns');
select is((select count(*)::int from public.enquiries), 0, 'non-admin sees no enquiries');
select throws_ok($$insert into public.campaigns(brand, slot_id, link, starts_on, ends_on) values ('X','hoarding-entry','https://x.example','2026-11-01','2026-11-02')$$, '42501', null, 'non-admin cannot add campaigns');
update public.slots set enabled = true where id = 'stall-ring-b';
select throws_ok($$insert into storage.objects(bucket_id, name) values ('brand-art', 'campaigns/x/wide.jpg')$$, '42501', null, 'non-admin cannot upload artwork');
reset role;
select is((select enabled from public.slots where id = 'stall-ring-b'), false, 'non-admin cannot switch slots');

-- an admin
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@test.local","role":"authenticated"}';
select lives_ok($$insert into public.campaigns(brand, slot_id, link, starts_on, ends_on) values ('New','hoarding-entry','https://new.example','2026-11-01','2026-11-02')$$, 'admin adds a campaign');
update public.campaigns set share = 3 where brand = 'New';
update public.slots set enabled = true where id = 'stall-ring-b';
select is((select count(*)::int from public.stats_daily), 2, 'admin reads stats');
select is((select count(*)::int from public.enquiries), 1, 'admin reads enquiries');
select lives_ok($$insert into storage.objects(bucket_id, name) values ('brand-art', 'campaigns/x/wide.jpg')$$, 'admin uploads artwork');
reset role;
select is((select share::int from public.campaigns where brand = 'New'), 3, 'admin edits a campaign');
select is((select enabled from public.slots where id = 'stall-ring-b'), true, 'admin switches a slot');

select * from finish();
rollback;
