-- Enable required extensions
create extension if not exists "pgcrypto";

-- Helper function to keep updated_at in sync
create or replace function public.set_current_timestamp_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Chat sessions table
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  url_id text not null unique,
  description text,
  messages jsonb not null default '[]'::jsonb,
  metadata jsonb,
  snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_sessions_user_id_idx on public.chat_sessions(user_id);
create index if not exists chat_sessions_updated_at_idx on public.chat_sessions(updated_at);

create trigger chat_sessions_set_updated_at
before update on public.chat_sessions
for each row
execute procedure public.set_current_timestamp_updated_at();

alter table public.chat_sessions enable row level security;

create policy if not exists "Users can manage their chats"
on public.chat_sessions
for all
using (auth.uid() is null or auth.uid()::text = user_id)
with check (auth.uid() is null or auth.uid()::text = user_id);

-- User token storage
create table if not exists public.user_tokens (
  user_id text not null,
  provider text not null,
  token_cipher text not null,
  token_iv text not null,
  token_tag text not null,
  token_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create trigger user_tokens_set_updated_at
before update on public.user_tokens
for each row
execute procedure public.set_current_timestamp_updated_at();

alter table public.user_tokens enable row level security;

create policy if not exists "Users can manage their tokens"
on public.user_tokens
for all
using (auth.uid() is null or auth.uid()::text = user_id)
with check (auth.uid() is null or auth.uid()::text = user_id);
