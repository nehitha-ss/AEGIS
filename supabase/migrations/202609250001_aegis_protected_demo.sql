-- AEGIS fictional Northstar Logistics demo data.
-- Run this in a new Supabase project's SQL editor. It intentionally grants the
-- gateway role EXECUTE only on two safe functions; it grants no table access.

begin;

create schema if not exists aegis_protected;
create schema if not exists aegis_api;

revoke all on schema aegis_protected from public, anon, authenticated;
revoke all on schema aegis_api from public, anon, authenticated;

create table if not exists aegis_protected.payroll_records (
  id bigint generated always as identity primary key,
  accounting_period text not null check (accounting_period ~ '^\\d{4}-\\d{2}$'),
  employee_token text not null unique,
  gross_pay numeric(12, 2) not null check (gross_pay >= 0),
  legal_name text not null,
  tax_id text not null,
  bank_account text not null
);

create table if not exists aegis_protected.employee_directory (
  employee_token text primary key,
  lookup_alias text not null unique,
  legal_name text not null
);

alter table aegis_protected.payroll_records enable row level security;
alter table aegis_protected.employee_directory enable row level security;

revoke all on all tables in schema aegis_protected from public, anon, authenticated;

insert into aegis_protected.employee_directory (employee_token, lookup_alias, legal_name)
values
  ('emp_nsl_01', 'northstar-finance-1', 'Aarav Mehta'),
  ('emp_nsl_02', 'northstar-finance-2', 'Meera Iyer')
on conflict (employee_token) do nothing;

insert into aegis_protected.payroll_records (accounting_period, employee_token, gross_pay, legal_name, tax_id, bank_account)
select
  '2026-09',
  'emp_nsl_' || lpad(seed.employee_number::text, 2, '0'),
  101904.76,
  'Northstar demo employee ' || seed.employee_number,
  'NSL-TAX-' || lpad(seed.employee_number::text, 4, '0'),
  'NSL-BANK-' || lpad(seed.employee_number::text, 4, '0')
from generate_series(1, 42) as seed(employee_number)
on conflict (employee_token) do nothing;

create or replace function aegis_api.payroll_reconciliation_summary(requested_period text)
returns table (
  period text,
  employees_in_scope integer,
  gross_pay_total text,
  identity_treatment text,
  compensation_treatment text
)
language sql
security definer
set search_path = pg_catalog, aegis_protected
as $$
  select
    payroll_records.accounting_period,
    count(*)::integer,
    ('₹' || to_char(sum(payroll_records.gross_pay) / 100000, 'FM999990.0') || 'L')::text,
    'tokenized'::text,
    'aggregate-only'::text
  from payroll_records
  where payroll_records.accounting_period = requested_period
  group by payroll_records.accounting_period
$$;

create or replace function aegis_api.tokenized_employee_lookup(requested_hint text)
returns table (
  employee_token text,
  treatment text
)
language sql
security definer
set search_path = pg_catalog, aegis_protected
as $$
  select employee_directory.employee_token, 'identity masked'::text
  from employee_directory
  where employee_directory.lookup_alias = requested_hint
  limit 1
$$;

revoke all on function aegis_api.payroll_reconciliation_summary(text) from public, anon, authenticated;
revoke all on function aegis_api.tokenized_employee_lookup(text) from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'aegis_gateway') then
    create role aegis_gateway login noinherit nosuperuser nocreatedb nocreaterole noreplication;
  end if;
end
$$;

grant usage on schema aegis_api to aegis_gateway;
grant execute on function aegis_api.payroll_reconciliation_summary(text) to aegis_gateway;
grant execute on function aegis_api.tokenized_employee_lookup(text) to aegis_gateway;

comment on role aegis_gateway is 'AEGIS demo gateway: execute only on narrowed Data DNA functions; no protected-table privileges.';

commit;

-- After running this migration, set a unique password privately in Supabase SQL editor:
-- alter role aegis_gateway password 'use-a-new-random-password-here';
-- Then place the resulting connection string only in .env.local as AEGIS_DATABASE_URL.
