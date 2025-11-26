-- Estensioni utili
create extension if not exists "uuid-ossp";

-- Partecipanti
create table if not exists participants (
  id uuid primary key default uuid_generate_v4(),
  first_name text not null,
  last_name text not null,
  preferred_mode char(1) not null check (preferred_mode in ('A', 'B')),
  created_at timestamptz not null default now()
);

-- Evita doppie registrazioni (stesso nome+cognome, case-insensitive)
create unique index if not exists participants_name_unique
  on participants (lower(first_name), lower(last_name));

-- Estrazioni modalità B (giorno dello scambio)
create table if not exists draws_b (
  id serial primary key,
  participant_id uuid not null references participants(id) on delete cascade,
  draw_order int not null unique,
  created_at timestamptz not null default now()
);

-- Abbinamenti modalità A (estrazione in anticipo)
create table if not exists assignments_a (
  id serial primary key,
  giver_id uuid not null references participants(id) on delete cascade,
  receiver_id uuid not null references participants(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Ogni partecipante dona una volta sola
create unique index if not exists assignments_a_giver_unique
  on assignments_a (giver_id);

-- Ogni partecipante riceve una volta sola
create unique index if not exists assignments_a_receiver_unique
  on assignments_a (receiver_id);