-- KollabKit's ring stall, entry-lane hoarding and jhoola billboard are fixed parts of the game (index.html),
-- so they are not brand slots. Brands get the two reserve spots. A slot that already has campaigns can't be
-- removed: the campaigns foreign key stops this migration rather than losing them.
delete from public.slots where id in ('stall-ring', 'hoarding-entry', 'hoarding-jhoola');
update public.slots set label = 'Ring stall across the north path, opposite KollabKit' where id = 'stall-ring-b';
update public.slots set label = 'Entry lane hoarding, facing KollabKit''s' where id = 'hoarding-entry-b';
