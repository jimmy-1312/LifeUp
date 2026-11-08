-- Run this whole file in Supabase Dashboard > SQL Editor, including on upgrades.
-- Auth owns email/passwords; this table stores only the public profile and achievement state.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  username_slug text,
  intro text not null default '',
  tags text[] not null default '{}',
  categories jsonb not null default '[]'::jsonb,
  profile_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists username_slug text;

alter table public.profiles
  add column if not exists profile_settings jsonb not null default '{}'::jsonb;

alter table public.profiles
  add column if not exists reward_level integer not null default 1;

alter table public.profiles
  add column if not exists reward_badges jsonb;

update public.profiles
set username_slug =
  coalesce(nullif(trim(both '-' from regexp_replace(lower(display_name), '[^a-z0-9]+', '-', 'g')), ''), 'player')
  || '-' || left(id::text, 6)
where username_slug is null or btrim(username_slug) = '';

alter table public.profiles
  alter column username_slug set not null;

create unique index if not exists profiles_username_slug_key
  on public.profiles (username_slug);

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Keeps updated_at accurate for each upsert/update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Public profile reads exclude email and are exposed only through this RPC.
drop function if exists public.get_public_profile(text);
create function public.get_public_profile(profile_slug text)
returns table (
  id uuid,
  username_slug text,
  display_name text,
  intro text,
  tags text[],
  categories jsonb,
  profile_settings jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username_slug, p.display_name, p.intro, p.tags, p.categories, p.profile_settings
  from public.profiles p
  where p.username_slug = profile_slug
  limit 1;
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;

-- One row represents either a pending request or an accepted friendship.
create table if not exists public.friendships (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> recipient_id)
);

-- The unordered pair is unique even when requests are sent in opposite directions.
create unique index if not exists friendships_pair_key
  on public.friendships (least(requester_id, recipient_id), greatest(requester_id, recipient_id));

create index if not exists friendships_requester_id_idx on public.friendships (requester_id);
create index if not exists friendships_recipient_id_idx on public.friendships (recipient_id);

alter table public.friendships enable row level security;
revoke all on table public.friendships from public, anon, authenticated;

-- Notification history and rate limits are private and accessible only through RPCs.
create table if not exists public.social_notifications (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('friend_request', 'friend_accepted', 'encouragement')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (recipient_id <> actor_id)
);

create index if not exists social_notifications_recipient_created_idx
  on public.social_notifications (recipient_id, created_at desc, id desc);
create index if not exists social_notifications_recipient_unread_idx
  on public.social_notifications (recipient_id) where read_at is null;
create index if not exists social_notifications_actor_idx
  on public.social_notifications (actor_id);

alter table public.social_notifications add column if not exists detail text;
alter table public.social_notifications drop constraint if exists social_notifications_kind_check;
alter table public.social_notifications drop constraint if exists social_notifications_check;
alter table public.social_notifications drop constraint if exists social_notifications_actor_check;
alter table public.social_notifications add constraint social_notifications_kind_check
  check (kind in ('friend_request', 'friend_accepted', 'encouragement', 'badge', 'background'));
alter table public.social_notifications add constraint social_notifications_actor_check
  check ((kind in ('badge', 'background') and recipient_id = actor_id)
    or (kind in ('friend_request', 'friend_accepted', 'encouragement') and recipient_id <> actor_id));

create table if not exists public.friend_encouragement_limits (
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  last_sent_at timestamptz not null,
  primary key (sender_id, recipient_id),
  check (sender_id <> recipient_id)
);
create index if not exists friend_encouragement_limits_recipient_idx
  on public.friend_encouragement_limits (recipient_id);

alter table public.social_notifications enable row level security;
alter table public.friend_encouragement_limits enable row level security;
revoke all on table public.social_notifications from public, anon, authenticated;
revoke all on table public.friend_encouragement_limits from public, anon, authenticated;

create table if not exists public.reward_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  highest_level integer not null default 1 check (highest_level >= 1),
  claimed_images integer not null default 0 check (claimed_images >= 0),
  claimed_gifs integer not null default 0 check (claimed_gifs >= 0),
  active_badges text[] not null default '{}'
);
alter table public.reward_progress enable row level security;
revoke all on table public.reward_progress from public, anon, authenticated;

create or replace function public.record_profile_reward_level()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reward_level < 1 or new.reward_level > 10000 then
    raise exception 'Invalid reward level' using errcode = '22023';
  end if;
  insert into public.reward_progress (user_id, highest_level)
  values (new.id, new.reward_level)
  on conflict (user_id) do update
    set highest_level = greatest(public.reward_progress.highest_level, excluded.highest_level);
  if auth.uid() = new.id and new.reward_badges is not null then
    if tg_op = 'INSERT' or new.reward_badges is distinct from old.reward_badges then
      perform public.sync_reward_progress(new.reward_level, new.reward_badges);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_record_reward_level on public.profiles;
create trigger profiles_record_reward_level after insert or update on public.profiles
for each row execute function public.record_profile_reward_level();

create table if not exists public.background_catalog (
  id text primary key,
  reward_type text not null check (reward_type in ('image', 'gif'))
);
alter table public.background_catalog enable row level security;
revoke all on table public.background_catalog from public, anon, authenticated;
insert into public.background_catalog (id, reward_type)
values ('cyberpunk', 'image'), ('snow-mountain', 'image'), ('wukong', 'gif')
on conflict (id) do update set reward_type = excluded.reward_type;

create or replace function public.preserve_background_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned jsonb;
begin
  select coalesce(jsonb_agg(distinct value), '[]'::jsonb) into owned
  from jsonb_array_elements(
    case when jsonb_typeof(old.profile_settings->'unlockedBackgrounds') = 'array'
      then old.profile_settings->'unlockedBackgrounds' else '[]'::jsonb end
    || case when jsonb_typeof(new.profile_settings->'unlockedBackgrounds') = 'array'
      then new.profile_settings->'unlockedBackgrounds' else '[]'::jsonb end
  );
  new.profile_settings := jsonb_set(new.profile_settings, '{unlockedBackgrounds}', owned, true);
  return new;
end;
$$;

drop trigger if exists profiles_preserve_background_inventory on public.profiles;
create trigger profiles_preserve_background_inventory before update on public.profiles
for each row execute function public.preserve_background_inventory();

create or replace function public.notify_background_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous jsonb := '[]'::jsonb;
begin
  if tg_op = 'UPDATE' and jsonb_typeof(old.profile_settings->'unlockedBackgrounds') = 'array' then
    previous := old.profile_settings->'unlockedBackgrounds';
  end if;
  if jsonb_typeof(new.profile_settings->'unlockedBackgrounds') = 'array' then
    insert into public.social_notifications (recipient_id, actor_id, kind, detail)
    select new.id, new.id, 'background', item.id
    from (select distinct jsonb_array_elements_text(new.profile_settings->'unlockedBackgrounds') as id) item
    where not previous ? item.id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_notify_background_inventory on public.profiles;
create trigger profiles_notify_background_inventory after insert or update on public.profiles
for each row execute function public.notify_background_inventory();

create or replace function public.sync_reward_progress(current_level integer, current_badges jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  progress public.reward_progress%rowtype;
  badge jsonb;
  badges text[] := '{}';
begin
  if caller is null or not exists (select 1 from public.profiles where id = caller) then
    raise exception 'Sign in and complete your profile' using errcode = '42501';
  end if;
  if current_level is null or current_level < 1 or current_level > 10000
    or (current_badges is not null and (jsonb_typeof(current_badges) <> 'array' or jsonb_array_length(current_badges) > 200)) then
    raise exception 'Invalid reward progress' using errcode = '22023';
  end if;
  insert into public.reward_progress (user_id) values (caller) on conflict do nothing;
  select * into progress from public.reward_progress where user_id = caller for update;
  if current_badges is null then badges := progress.active_badges; end if;
  for badge in select value from jsonb_array_elements(coalesce(current_badges, '[]'::jsonb)) loop
    if jsonb_typeof(badge->'id') is distinct from 'string' or jsonb_typeof(badge->'title') is distinct from 'string'
      or length(badge->>'id') not between 1 and 100 or length(badge->>'title') not between 1 and 100 then
      raise exception 'Invalid badge data' using errcode = '22023';
    end if;
    if not (badge->>'id' = any(badges)) then
      badges := array_append(badges, badge->>'id');
      if not (badge->>'id' = any(progress.active_badges)) then
        insert into public.social_notifications (recipient_id, actor_id, kind, detail)
        values (caller, caller, 'badge', badge->>'title');
      end if;
    end if;
  end loop;
  update public.reward_progress
  set highest_level = greatest(highest_level, current_level), active_badges = badges
  where user_id = caller returning * into progress;
  return jsonb_build_object('highestLevel', progress.highest_level,
    'imageCredits', greatest(0, progress.highest_level - 1 - progress.claimed_images),
    'gifCredits', greatest(0, progress.highest_level / 10 - progress.claimed_gifs));
end;
$$;

create or replace function public.claim_background_reward(background_id text, reward_type text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  progress public.reward_progress%rowtype;
  settings jsonb;
  owned jsonb;
begin
  if caller is null then raise exception 'Sign in to claim rewards' using errcode = '42501'; end if;
  if background_id is null or length(background_id) not between 1 and 200
    or reward_type is null or reward_type not in ('image', 'gif') then
    raise exception 'Invalid background reward' using errcode = '22023';
  end if;
  if not exists (select 1 from public.background_catalog b where b.id = background_id and b.reward_type = claim_background_reward.reward_type) then
    raise exception 'Background is not available for this reward' using errcode = '22023';
  end if;
  select profile_settings into settings from public.profiles where id = caller for update;
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;
  select * into progress from public.reward_progress where user_id = caller for update;
  if not found then raise exception 'Reward progress has not been synchronized' using errcode = 'P0002'; end if;
  if (reward_type = 'image' and progress.claimed_images >= progress.highest_level - 1)
    or (reward_type = 'gif' and progress.claimed_gifs >= progress.highest_level / 10) then
    raise exception 'No reward is available' using errcode = '22023';
  end if;
  owned := case when jsonb_typeof(settings->'unlockedBackgrounds') = 'array'
    then settings->'unlockedBackgrounds' else '[]'::jsonb end;
  if owned ? background_id then raise exception 'Background already owned' using errcode = '23505'; end if;
  settings := jsonb_set(settings, '{unlockedBackgrounds}', owned || jsonb_build_array(background_id), true);
  update public.profiles set profile_settings = settings where id = caller returning profile_settings into settings;
  update public.reward_progress set
    claimed_images = claimed_images + case when reward_type = 'image' then 1 else 0 end,
    claimed_gifs = claimed_gifs + case when reward_type = 'gif' then 1 else 0 end
  where user_id = caller returning * into progress;
  return jsonb_build_object('settings', settings, 'highestLevel', progress.highest_level,
    'imageCredits', greatest(0, progress.highest_level - 1 - progress.claimed_images),
    'gifCredits', greatest(0, progress.highest_level / 10 - progress.claimed_gifs));
end;
$$;

revoke all on function public.sync_reward_progress(integer, jsonb) from public, anon, authenticated;
revoke all on function public.claim_background_reward(text, text) from public, anon, authenticated;
grant execute on function public.sync_reward_progress(integer, jsonb) to authenticated;
grant execute on function public.claim_background_reward(text, text) to authenticated;

-- Only accepted relationships are public; an unknown slug has no preview.
create or replace function public.get_public_friends(profile_slug text)
returns table (peer_id uuid, username_slug text, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select peer.id, peer.username_slug, peer.display_name
  from public.profiles owner_profile
  join public.friendships f
    on f.status = 'accepted'
    and (f.requester_id = owner_profile.id or f.recipient_id = owner_profile.id)
  join public.profiles peer
    on peer.id = case when f.requester_id = owner_profile.id then f.recipient_id else f.requester_id end
  where owner_profile.username_slug = profile_slug
  order by f.created_at desc, peer.id
  limit 5;
$$;

-- An unknown slug and a profile with no accepted friends both return zero.
create or replace function public.get_public_friend_count(profile_slug text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.profiles owner_profile
  join public.friendships f
    on f.status = 'accepted'
    and (f.requester_id = owner_profile.id or f.recipient_id = owner_profile.id)
  where owner_profile.username_slug = profile_slug;
$$;

create or replace function public.send_friend_request(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  inserted_count integer;
begin
  if caller_id is null then
    raise exception 'Sign in to send a friend request' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = caller_id) then
    raise exception 'Complete your profile before sending a friend request' using errcode = '42501';
  end if;
  if target_user_id is null then
    raise exception 'A target user is required' using errcode = '22023';
  end if;
  if target_user_id = caller_id then
    raise exception 'You cannot send a friend request to yourself' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target_user_id) then
    raise exception 'Target profile does not exist' using errcode = '22023';
  end if;

  insert into public.friendships (requester_id, recipient_id)
  values (caller_id, target_user_id)
  on conflict do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    raise exception 'A friendship or pending request already exists; respond to an incoming request instead'
      using errcode = '23505';
  end if;
  insert into public.social_notifications (recipient_id, actor_id, kind)
  values (target_user_id, caller_id, 'friend_request');
exception
  when foreign_key_violation then
    raise exception 'A profile no longer exists; refresh and try again' using errcode = '23503';
end;
$$;

create or replace function public.respond_friend_request(target_user_id uuid, decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  relationship public.friendships%rowtype;
begin
  if caller_id is null then
    raise exception 'Sign in to manage friendships' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = caller_id) then
    raise exception 'Complete your profile before managing friendships' using errcode = '42501';
  end if;
  if target_user_id is null or target_user_id = caller_id then
    raise exception 'A different target user is required' using errcode = '22023';
  end if;
  if decision is null or decision not in ('accept', 'decline', 'cancel', 'remove') then
    raise exception 'Decision must be accept, decline, cancel, or remove' using errcode = '22023';
  end if;

  select f.* into relationship
  from public.friendships f
  where (f.requester_id = caller_id and f.recipient_id = target_user_id)
     or (f.recipient_id = caller_id and f.requester_id = target_user_id)
  for update;

  if not found then
    raise exception 'No friendship or pending request exists for this user' using errcode = 'P0002';
  end if;

  if decision in ('accept', 'decline') then
    if relationship.status <> 'pending' or relationship.recipient_id <> caller_id then
      raise exception 'Only the recipient can accept or decline a pending request' using errcode = '42501';
    end if;
    if decision = 'accept' then
      update public.friendships
      set status = 'accepted'
      where requester_id = relationship.requester_id and recipient_id = relationship.recipient_id;
      insert into public.social_notifications (recipient_id, actor_id, kind)
      values (relationship.requester_id, caller_id, 'friend_accepted');
    else
      delete from public.friendships
      where requester_id = relationship.requester_id and recipient_id = relationship.recipient_id;
    end if;
  elsif decision = 'cancel' then
    if relationship.status <> 'pending' or relationship.requester_id <> caller_id then
      raise exception 'Only the sender can cancel a pending request' using errcode = '42501';
    end if;
    delete from public.friendships
    where requester_id = relationship.requester_id and recipient_id = relationship.recipient_id;
  else
    if relationship.status <> 'accepted' then
      raise exception 'Only an accepted friendship can be removed' using errcode = '42501';
    end if;
    delete from public.friendships
    where requester_id = relationship.requester_id and recipient_id = relationship.recipient_id;
  end if;
end;
$$;

create or replace function public.send_friend_encouragement(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  recorded_at timestamptz;
begin
  if caller_id is null then
    raise exception 'Sign in to encourage a friend' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = caller_id) then
    raise exception 'Complete your profile before encouraging a friend' using errcode = '42501';
  end if;
  if target_user_id is null or target_user_id = caller_id then
    raise exception 'A different target user is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target_user_id) then
    raise exception 'Target profile does not exist' using errcode = '22023';
  end if;

  -- Serialize with removal as well as other encouragements for this friendship.
  perform 1 from public.friendships f
  where f.status = 'accepted'
    and ((f.requester_id = caller_id and f.recipient_id = target_user_id)
      or (f.recipient_id = caller_id and f.requester_id = target_user_id))
  for update;
  if not found then
    raise exception 'You can only encourage an accepted friend' using errcode = '42501';
  end if;

  insert into public.friend_encouragement_limits as limits (sender_id, recipient_id, last_sent_at)
  values (caller_id, target_user_id, pg_catalog.clock_timestamp())
  on conflict (sender_id, recipient_id) do update
    set last_sent_at = pg_catalog.clock_timestamp()
    where limits.last_sent_at <= pg_catalog.clock_timestamp() - interval '24 hours'
  returning last_sent_at into recorded_at;
  if not found then
    raise exception 'You can encourage this friend only once per 24 hours' using errcode = 'P0001';
  end if;

  insert into public.social_notifications (recipient_id, actor_id, kind)
  values (target_user_id, caller_id, 'encouragement');
exception
  when foreign_key_violation then
    raise exception 'A profile no longer exists; refresh and try again' using errcode = '23503';
end;
$$;

drop function if exists public.get_social_notifications();
create function public.get_social_notifications()
returns table (
  id uuid,
  kind text,
  actor_id uuid,
  username_slug text,
  display_name text,
  created_at timestamptz,
  read_at timestamptz,
  detail text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Sign in to view notifications' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = caller_id) then
    raise exception 'Complete your profile before viewing notifications' using errcode = '42501';
  end if;
  return query
  select n.id, n.kind, n.actor_id, p.username_slug, p.display_name, n.created_at, n.read_at, n.detail
  from public.social_notifications n
  join public.profiles p on p.id = n.actor_id
  where n.recipient_id = caller_id
  order by n.created_at desc, n.id desc
  limit 50;
end;
$$;

create or replace function public.get_social_notifications_unread_count()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  unread_count integer;
begin
  if caller_id is null then
    raise exception 'Sign in to view notifications' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = caller_id) then
    raise exception 'Complete your profile before viewing notifications' using errcode = '42501';
  end if;
  select count(*)::integer into unread_count
  from public.social_notifications n
  where n.recipient_id = caller_id and n.read_at is null;
  return unread_count;
end;
$$;

create or replace function public.mark_social_notifications_read()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Sign in to mark notifications read' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = caller_id) then
    raise exception 'Complete your profile before marking notifications read' using errcode = '42501';
  end if;
  update public.social_notifications n
  set read_at = pg_catalog.clock_timestamp()
  where n.recipient_id = caller_id and n.read_at is null;
end;
$$;

create or replace function public.get_friendships()
returns table (
  peer_id uuid,
  username_slug text,
  display_name text,
  tags text[],
  categories jsonb,
  status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Sign in to view friendships' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = caller_id) then
    raise exception 'Complete your profile before viewing friendships' using errcode = '42501';
  end if;

  return query
  select p.id, p.username_slug, p.display_name, p.tags, p.categories,
    case
      when f.status = 'accepted' then 'friends'
      when f.requester_id = caller_id then 'outgoing'
      else 'incoming'
    end,
    f.created_at
  from public.friendships f
  join public.profiles p on p.id =
    case when f.requester_id = caller_id then f.recipient_id else f.requester_id end
  where f.requester_id = caller_id or f.recipient_id = caller_id
  order by f.created_at desc, p.id;
end;
$$;

revoke all on function public.send_friend_request(uuid) from public, anon, authenticated;
revoke all on function public.respond_friend_request(uuid, text) from public, anon, authenticated;
revoke all on function public.get_friendships() from public, anon, authenticated;
revoke all on function public.get_public_friends(text) from public, anon, authenticated;
revoke all on function public.get_public_friend_count(text) from public, anon, authenticated;
revoke all on function public.send_friend_encouragement(uuid) from public, anon, authenticated;
revoke all on function public.get_social_notifications() from public, anon, authenticated;
revoke all on function public.get_social_notifications_unread_count() from public, anon, authenticated;
revoke all on function public.mark_social_notifications_read() from public, anon, authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, text) to authenticated;
grant execute on function public.get_friendships() to authenticated;
grant execute on function public.get_public_friends(text) to anon, authenticated;
grant execute on function public.get_public_friend_count(text) to anon, authenticated;
grant execute on function public.send_friend_encouragement(uuid) to authenticated;
grant execute on function public.get_social_notifications() to authenticated;
grant execute on function public.get_social_notifications_unread_count() to authenticated;
grant execute on function public.mark_social_notifications_read() to authenticated;
