-- ============================================================================
-- יומן מסחר יומי — טבלת עסקאות (trades)
-- הרץ קובץ זה ב-Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  entry_datetime timestamptz not null,
  exit_datetime timestamptz,

  instrument text not null default 'NQ',
  direction text not null check (direction in ('Long', 'Short')),

  entry_price numeric not null,
  exit_price numeric,
  position_size numeric not null,

  stop_loss numeric,
  take_profit numeric,

  r_multiple numeric,
  pnl_dollars numeric,

  setup_type text not null,
  session text not null check (session in ('Asia', 'London', 'NY AM', 'NY PM')),
  entry_timeframe text not null,

  result text not null check (result in ('Win', 'Loss', 'Breakeven')),
  discipline_score smallint not null check (discipline_score between 1 and 5),

  notes text,
  screenshot_url text
);

comment on table public.trades is 'עסקאות מסחר יומי לפי משתמש';

-- אינדקסים לסינון/מיון מהיר במסך הרשימה
create index if not exists trades_user_id_idx on public.trades (user_id);
create index if not exists trades_entry_datetime_idx on public.trades (entry_datetime desc);
create index if not exists trades_setup_type_idx on public.trades (setup_type);
create index if not exists trades_session_idx on public.trades (session);
create index if not exists trades_result_idx on public.trades (result);

-- ============================================================================
-- Row Level Security — כל משתמש רואה ומעדכן רק את העסקאות שלו
-- ============================================================================

alter table public.trades enable row level security;

drop policy if exists "trades_select_own" on public.trades;
create policy "trades_select_own"
  on public.trades for select
  using (auth.uid() = user_id);

drop policy if exists "trades_insert_own" on public.trades;
create policy "trades_insert_own"
  on public.trades for insert
  with check (auth.uid() = user_id);

drop policy if exists "trades_update_own" on public.trades;
create policy "trades_update_own"
  on public.trades for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "trades_delete_own" on public.trades;
create policy "trades_delete_own"
  on public.trades for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- Storage — bucket פרטי לצילומי מסך של עסקאות
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('trade-screenshots', 'trade-screenshots', true)
on conflict (id) do nothing;

drop policy if exists "trade_screenshots_select_own" on storage.objects;
create policy "trade_screenshots_select_own"
  on storage.objects for select
  using (
    bucket_id = 'trade-screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "trade_screenshots_insert_own" on storage.objects;
create policy "trade_screenshots_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'trade-screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "trade_screenshots_update_own" on storage.objects;
create policy "trade_screenshots_update_own"
  on storage.objects for update
  using (
    bucket_id = 'trade-screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "trade_screenshots_delete_own" on storage.objects;
create policy "trade_screenshots_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'trade-screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- הערה: ה-bucket מוגדר "public" כדי שאפשר יהיה להציג את התמונות ישירות דרך
-- URL ציבורי (getPublicUrl) בממשק. מדיניות ה-storage.objects עדיין מגבילה
-- העלאה/מחיקה/עדכון כך שכל משתמש יכול לגעת רק בתיקייה שלו (לפי user_id
-- כתיקייה ראשונה בנתיב הקובץ, למשל: <user_id>/2026-07-26-abc123.png).
