-- Run this whole file once in Supabase Dashboard > SQL Editor.
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
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, text) to authenticated;
grant execute on function public.get_friendships() to authenticated;
