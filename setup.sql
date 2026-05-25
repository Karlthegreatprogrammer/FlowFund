-- FlowFund Supabase setup
-- Paste this file into the Supabase SQL Editor for the project:
-- https://wqwpzlxickdlthpyarze.supabase.co

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dashboards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  include_in_global_totals boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  currency_code text not null default 'PHP',
  currency_symbol text not null default chr(8369),
  number_format text not null default 'symbol' check (number_format in ('symbol', 'code')),
  date_format text not null default 'month_day_year' check (date_format in ('month_day_year', 'mm_dd_yyyy', 'yyyy_mm_dd')),
  week_starts_on text not null default 'monday' check (week_starts_on in ('monday', 'sunday')),
  default_calendar_view text not null default 'month' check (default_calendar_view in ('month', 'week', 'today')),
  default_dashboard_id uuid references public.dashboards(id) on delete set null,
  default_timeline_filter text not null default 'month' check (default_timeline_filter in ('today', 'week', 'month', 'all')),
  preferred_summary_period text not null default 'monthly' check (preferred_summary_period in ('daily', 'weekly', 'monthly', 'all')),
  hidden_timeline_types text[] not null default '{}',
  hide_balances boolean not null default false,
  confirm_before_delete_transactions boolean not null default true,
  confirm_before_delete_dashboards boolean not null default true,
  show_archived_dashboards boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transaction_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense', 'loss', 'investment', 'debt_payment')),
  name text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists transaction_categories_user_type_name_idx
on public.transaction_categories (user_id, type, (lower(name)));

create table if not exists public.allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dashboard_id uuid references public.dashboards(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  percentage numeric(7, 4) not null check (percentage >= 0 and percentage <= 100),
  sort_order integer not null default 0,
  is_default_template boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  type text not null check (type in ('income', 'expense', 'loss', 'investment', 'debt_payment')),
  amount numeric(14, 2) not null check (amount > 0),
  date date not null,
  notes text,
  category_id uuid references public.transaction_categories(id) on delete set null,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cashflow_health_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  healthy_threshold numeric(7, 4) not null default 30,
  stable_threshold numeric(7, 4) not null default 10,
  warning_threshold numeric(7, 4) not null default 0,
  critical_threshold numeric(7, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (healthy_threshold >= stable_threshold),
  check (stable_threshold >= warning_threshold)
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_dashboards_updated_at on public.dashboards;
create trigger set_dashboards_updated_at
before update on public.dashboards
for each row execute function public.set_updated_at();

drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

drop trigger if exists set_allocations_updated_at on public.allocations;
create trigger set_allocations_updated_at
before update on public.allocations
for each row execute function public.set_updated_at();

drop trigger if exists set_transaction_categories_updated_at on public.transaction_categories;
create trigger set_transaction_categories_updated_at
before update on public.transaction_categories
for each row execute function public.set_updated_at();

drop trigger if exists set_cashflow_health_settings_updated_at on public.cashflow_health_settings;
create trigger set_cashflow_health_settings_updated_at
before update on public.cashflow_health_settings
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.dashboards enable row level security;
alter table public.transactions enable row level security;
alter table public.allocations enable row level security;
alter table public.transaction_categories enable row level security;
alter table public.cashflow_health_settings enable row level security;

drop policy if exists "Profiles are user owned" on public.profiles;
create policy "Profiles are user owned"
on public.profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Settings are user owned" on public.user_settings;
create policy "Settings are user owned"
on public.user_settings
for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    default_dashboard_id is null
    or exists (
      select 1
      from public.dashboards d
      where d.id = default_dashboard_id
        and d.user_id = auth.uid()
    )
  )
);

drop policy if exists "Dashboards are user owned" on public.dashboards;
create policy "Dashboards are user owned"
on public.dashboards
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Transactions are user owned" on public.transactions;
create policy "Transactions are user owned"
on public.transactions
for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.dashboards d
    where d.id = dashboard_id
      and d.user_id = auth.uid()
  )
  and (
    category_id is null
    or exists (
      select 1
      from public.transaction_categories c
      where c.id = category_id
        and c.user_id = auth.uid()
    )
  )
);

drop policy if exists "Allocations are user owned" on public.allocations;
create policy "Allocations are user owned"
on public.allocations
for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    dashboard_id is null
    or exists (
      select 1
      from public.dashboards d
      where d.id = dashboard_id
        and d.user_id = auth.uid()
    )
  )
);

drop policy if exists "Categories are user owned" on public.transaction_categories;
create policy "Categories are user owned"
on public.transaction_categories
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Health settings are user owned" on public.cashflow_health_settings;
create policy "Health settings are user owned"
on public.cashflow_health_settings
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.seed_flowfund_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id, currency_symbol)
  values (new.id, chr(8369))
  on conflict (user_id) do nothing;

  insert into public.cashflow_health_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.transaction_categories (user_id, type, name, sort_order, is_default)
  values
    (new.id, 'income', 'Sales', 0, true),
    (new.id, 'income', 'Service', 1, true),
    (new.id, 'income', 'Salary', 2, true),
    (new.id, 'income', 'Commission', 3, true),
    (new.id, 'income', 'Other', 4, true),
    (new.id, 'expense', 'Supplies', 0, true),
    (new.id, 'expense', 'Payment', 1, true),
    (new.id, 'expense', 'Salary', 2, true),
    (new.id, 'expense', 'Utilities', 3, true),
    (new.id, 'expense', 'Rent', 4, true),
    (new.id, 'expense', 'Other', 5, true),
    (new.id, 'loss', 'Damaged Goods', 0, true),
    (new.id, 'loss', 'Refund', 1, true),
    (new.id, 'loss', 'Penalty', 2, true),
    (new.id, 'loss', 'Theft', 3, true),
    (new.id, 'loss', 'Other', 4, true),
    (new.id, 'investment', 'Capital Added', 0, true),
    (new.id, 'investment', 'Equipment', 1, true),
    (new.id, 'investment', 'Inventory', 2, true),
    (new.id, 'investment', 'Marketing', 3, true),
    (new.id, 'investment', 'Other', 4, true),
    (new.id, 'debt_payment', 'Loan Payment', 0, true),
    (new.id, 'debt_payment', 'Supplier Credit', 1, true),
    (new.id, 'debt_payment', 'Credit Card', 2, true),
    (new.id, 'debt_payment', 'Personal Debt', 3, true),
    (new.id, 'debt_payment', 'Other', 4, true)
  on conflict do nothing;

  insert into public.allocations (user_id, dashboard_id, name, percentage, sort_order, is_default_template)
  values
    (new.id, null, 'Operations', 40, 0, true),
    (new.id, null, 'Savings', 20, 1, true),
    (new.id, null, 'Emergency', 10, 2, true),
    (new.id, null, 'Investment', 30, 3, true)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists seed_flowfund_user_on_signup on auth.users;
create trigger seed_flowfund_user_on_signup
after insert on auth.users
for each row execute function public.seed_flowfund_user();
