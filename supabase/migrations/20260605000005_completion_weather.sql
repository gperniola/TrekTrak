-- Condizioni meteo (facoltative) per completamento. Stringa-codice (es. 'sereno','pioggia').
alter table public.completions add column if not exists weather text;
