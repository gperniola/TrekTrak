# Libreria condivisa — Fase 6 (Branding email) — Recap & Setup

**Obiettivo:** email di invito/login **brandizzate in italiano** (TrekTrak), al posto dei template inglesi di default di Supabase.

**Vincolo:** Supabase consente di personalizzare oggetto/HTML delle email **solo con SMTP custom**. Col mittente integrato restano i template standard. Quindi Fase 6 = **configurare un SMTP** (lato utente) + **applicare i template** (già pronti nel repo).

## Stato

- ✅ **Codice pronto** (commit fase 6): la route `request-access`, per i membri **già registrati**, ora **invia davvero** il magic-link di login (`signInWithOtp`) invece di solo generarlo (`admin.generateLink`).
- ✅ **Template pronti** in `supabase/templates/`: `invite.html`, `magic-link.html`, `confirm-signup.html`.
- ⏳ **Da fare (utente):** configurare SMTP + incollare i template + verificare.

---

## A. Configurare l'SMTP

### Opzione consigliata: **Gmail SMTP** (gratis, nessun servizio terzo)
Per `@gmail.com` l'invio *tramite* Gmail è autenticato da Google (SPF/DKIM allineati) → buona consegna, niente notazione "via", meno spam. Mittente bloccato sull'indirizzo Gmail autenticato; limite ~500 email/giorno (abbondante per uso familiare).

> Consiglio: usa una **Gmail dedicata** (es. `trektrak.famiglia@gmail.com`) per non esporre la personale.

1. **Attiva la verifica in 2 passaggi** sull'account Google.
2. **Genera una "Password per le app"**: Account Google → Sicurezza → Verifica in due passaggi → *Password per le app* → crea ("TrekTrak Supabase") → copia i 16 caratteri. (La password normale non funziona.)
3. Supabase → Authentication → Emails → **Custom SMTP**:
   - Host: `smtp.gmail.com` · Porta: `587`
   - Username: l'indirizzo Gmail completo
   - Password: la **password per le app**
   - **Sender email**: lo **stesso** indirizzo Gmail (Gmail forza il From all'account autenticato)
   - **Sender name**: `TrekTrak`
   - Salva.

### Alternativa: **Brevo** (se non vuoi usare Gmail)
300 email/giorno, verifica di un singolo mittente (no dominio richiesto). Caveat: inviando "come" un indirizzo gmail/outlook *via Brevo* la consegna è meno autenticata (possibile "via brevo.com"/spam). Host `smtp-relay.brevo.com`, porta `587`, login = email Brevo, password = SMTP key, Sender email = indirizzo verificato in Brevo.

### Alternativa: **dominio proprio** (massima pulizia)
Acquisto dominio (~1-15 €/anno) → mittente `noreply@tuodominio.it` con DKIM/SPF; utile se vuoi anche un URL personalizzato per l'app. Sovradimensionato per uso solo familiare.

---

## B. Applicare i template
Una volta abilitato l'SMTP custom, l'editor template si sblocca (Authentication → Emails):

| Template Supabase | File | Oggetto consigliato |
|---|---|---|
| **Invite user** | `supabase/templates/invite.html` | Sei stato invitato alla libreria percorsi di TrekTrak 🏔️ |
| **Magic Link** | `supabase/templates/magic-link.html` | Il tuo link di accesso a TrekTrak |
| **Confirm signup** | `supabase/templates/confirm-signup.html` | Conferma il tuo accesso a TrekTrak *(opzionale: signup pubblici disabilitati)* |

I template usano la variabile del link d'azione `{{ .ConfirmationURL }}`.

---

## C. Verifica
- Invito con **email nuova** → arriva l'email **brandizzata in italiano** (template Invite).
- Login di un **membro esistente** (riapri il link invito → inserisci email) → arriva il **magic-link di login** brandizzato (ora inviato davvero grazie al fix).
- Controlla che il mittente mostri **TrekTrak** e l'indirizzo scelto.

---

## Note
- Le credenziali SMTP si inseriscono **in dashboard Supabase**, non nel repo/codice.
- Cambiando idea sul provider, basta riconfigurare l'SMTP: i template restano gli stessi.
- Completata questa fase, la feature "libreria condivisa" è **completa** → decidere merge `feature/shared-library` → `develop`/`master` e rilascio (bump versione, CHANGELOG, tag).
