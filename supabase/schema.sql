-- Doctor Appointment app: Supabase schema (matches docs/ER_DIAGRAM.md and src/services/schema.js COLUMNS).
-- Run in Supabase Dashboard -> SQL Editor. Safe to run again.

create table if not exists users (
  id text primary key,
  role text not null check (role in ('patient','doctor','registrar')),
  registered boolean default false,
  "createdAt" timestamptz default now()
);

create table if not exists patients (
  id text primary key references users(id) on delete cascade,  -- PATIENT "is a" USER
  name text, phone text, password text, age text,
  "doctorId" text, appointments text[] default '{}',
  "createdAt" timestamptz default now()
);

create table if not exists "phoneNumbers" (
  id text primary key,
  phone text unique not null,
  "patientId" text references patients(id) on delete cascade
);

create table if not exists devices (
  id text primary key,
  "userId" text references users(id) on delete cascade,
  "deviceName" text, platform text, "deviceToken" text,
  "lastLogin" timestamptz
);

create table if not exists departments (
  id text primary key,
  "nameBn" text, "nameEn" text, icon text, color text,
  "descriptionBn" text, "descriptionEn" text, "doctorNo" int default 0
);

create table if not exists doctors (
  id text primary key,
  "departmentId" text references departments(id),
  "nameBn" text, "nameEn" text, "degreesBn" text, "degreesEn" text,
  "designationBn" text, "designationEn" text, "hospitalBn" text, "hospitalEn" text,
  "chamberBn" text, "chamberEn" text, experience text, "experienceBn" text, "experienceEn" text,
  fee text, "feeBn" text, "feeEn" text, "availableBn" text, "availableEn" text,
  rating text, reviews int, image text
);

create table if not exists schedules (
  id text primary key,
  date text, time text,
  "doctorId" text references doctors(id) on delete set null,
  "patientId" text references patients(id) on delete set null,
  place text
);

create table if not exists appointments (
  id text primary key,
  "serialNo" int, "patientPhone" text, "patientName" text, age text,
  "doctorNameBn" text, "doctorNameEn" text, date text, time text,
  "doctorId" text references doctors(id) on delete set null,
  "patientId" text references patients(id) on delete set null,
  "scheduleId" text references schedules(id) on delete set null,
  "deviceId" text references devices(id) on delete set null,
  fee text, reason text, status text default 'confirmed',
  "createdAt" timestamptz default now()
);

-- Exact start time of each booking, used for the 2-hour reminder (added after the first release)
alter table appointments add column if not exists "startsAt" timestamptz;

-- Access for the app's anon key.
-- DEVELOPMENT ONLY: the app checks passwords itself, so Supabase cannot tell users apart and
-- these policies let anyone holding the app's key read and change every row (including passwords).
-- Replace with per-user policies once login moves to Supabase Auth (phone OTP).
do $$
declare t text;
begin
  foreach t in array array['users','patients','phoneNumbers','devices','departments','doctors','schedules','appointments'] loop
    execute format('alter table %I enable row level security', t);
    execute format('grant select, insert, update, delete on %I to anon, authenticated', t);
    execute format('drop policy if exists "app full access (dev)" on %I', t);
    execute format('create policy "app full access (dev)" on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;
