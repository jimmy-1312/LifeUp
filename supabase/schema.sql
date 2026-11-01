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
