-- Libreria condivisa — seed del token di invito (Fase 1).
-- Si salva SOLO l'hash SHA-256 del token in chiaro (il token vive nel link #invite=<token>).
-- Token corrente (beta): "beta-test". Per rigenerarlo: aggiornare/sostituire questa riga
-- con l'hash del nuovo token, oppure `update public.invites set active=false` per revocarlo.
insert into public.invites (token_hash, active)
values ('1406098bbd1f972020df788f9881d87d61a207a0bf36653382e8fafc43b69895', true);
