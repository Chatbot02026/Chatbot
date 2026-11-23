-- Run once in Supabase SQL Editor for a new project.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(12),'hex'),1,12)),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id,user_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create table if not exists public.group_files (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  path text not null,
  name text not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_group_member(target uuid) returns boolean
language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.group_members where group_id=target and user_id=auth.uid()) $$;
create or replace function public.is_group_owner(target uuid) returns boolean
language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.group_members where group_id=target and user_id=auth.uid() and role='owner') $$;
revoke all on function public.is_group_member(uuid) from public;
revoke all on function public.is_group_owner(uuid) from public;
grant execute on function public.is_group_member(uuid),public.is_group_owner(uuid) to authenticated;

create or replace function public.create_chat_group(group_name text) returns uuid
language plpgsql security definer set search_path=public
as $$ declare new_id uuid; begin
  if auth.uid() is null then raise exception 'Giriş tələb olunur'; end if;
  if char_length(trim(group_name)) not between 1 and 60 then raise exception 'Qrup adı 1–60 simvol olmalıdır'; end if;
  insert into public.groups(name,created_by) values(trim(group_name),auth.uid()) returning id into new_id;
  insert into public.group_members(group_id,user_id,role) values(new_id,auth.uid(),'owner');
  return new_id;
end $$;
create or replace function public.join_chat_group(invite_code text) returns uuid
language plpgsql security definer set search_path=public
as $$ declare target uuid; begin
  if auth.uid() is null then raise exception 'Giriş tələb olunur'; end if;
  select id into target from public.groups where groups.invite_code=upper(trim(join_chat_group.invite_code));
  if target is null then raise exception 'Dəvət kodu tapılmadı'; end if;
  insert into public.group_members(group_id,user_id) values(target,auth.uid()) on conflict do nothing;
  return target;
end $$;
create or replace function public.rotate_group_code(target_group uuid) returns text
language plpgsql security definer set search_path=public,extensions
as $$ declare new_code text; begin
  if not public.is_group_owner(target_group) then raise exception 'Yalnız qrup sahibi kodu dəyişə bilər'; end if;
  new_code:=upper(substr(encode(gen_random_bytes(12),'hex'),1,12));
  update public.groups set invite_code=new_code where id=target_group;
  return new_code;
end $$;
revoke all on function public.create_chat_group(text),public.join_chat_group(text),public.rotate_group_code(uuid) from public;
grant execute on function public.create_chat_group(text),public.join_chat_group(text),public.rotate_group_code(uuid) to authenticated;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.messages enable row level security;
alter table public.group_files enable row level security;
grant select,delete on public.groups to authenticated;
grant select,delete on public.group_members to authenticated;
grant select,insert on public.messages to authenticated;
grant select,insert,delete on public.group_files to authenticated;

drop policy if exists "Members can read groups" on public.groups;
create policy "Members can read groups" on public.groups for select to authenticated using(public.is_group_member(id));
drop policy if exists "Owners can delete groups" on public.groups;
create policy "Owners can delete groups" on public.groups for delete to authenticated using(public.is_group_owner(id));
drop policy if exists "Members can read roster" on public.group_members;
create policy "Members can read roster" on public.group_members for select to authenticated using(public.is_group_member(group_id));
drop policy if exists "Members can read messages" on public.messages;
create policy "Members can read messages" on public.messages for select to authenticated using(public.is_group_member(group_id));
drop policy if exists "Members can send messages" on public.messages;
create policy "Members can send messages" on public.messages for insert to authenticated with check(public.is_group_member(group_id) and user_id=auth.uid());
drop policy if exists "Owners manage group files" on public.group_files;
create policy "Owners manage group files" on public.group_files for all to authenticated using(public.is_group_owner(group_id)) with check(public.is_group_owner(group_id));

insert into storage.buckets(id,name,public,allowed_mime_types,file_size_limit)
values('group-pdfs','group-pdfs',false,array['application/pdf'],10485760)
on conflict(id) do update set public=false,allowed_mime_types=array['application/pdf'],file_size_limit=10485760;
drop policy if exists "Group owners upload PDFs" on storage.objects;
create policy "Group owners upload PDFs" on storage.objects for insert to authenticated
with check(bucket_id='group-pdfs' and public.is_group_owner(((storage.foldername(name))[1])::uuid));
drop policy if exists "Group owners read PDFs" on storage.objects;
create policy "Group owners read PDFs" on storage.objects for select to authenticated
using(bucket_id='group-pdfs' and public.is_group_owner(((storage.foldername(name))[1])::uuid));
drop policy if exists "Group owners delete PDFs" on storage.objects;
create policy "Group owners delete PDFs" on storage.objects for delete to authenticated
using(bucket_id='group-pdfs' and public.is_group_owner(((storage.foldername(name))[1])::uuid));

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
