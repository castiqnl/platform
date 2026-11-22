# Supabase Auth en Castiq-mail

Datum: 22 november 2026. **De gebruiker stelt Supabase Auth zelf in met onderstaande dashboardinstructies.** De URL-, OTP- en templatepatches zijn opgeleverd, maar nog niet toegepast of extern geverifieerd. Er wordt geen Management API-token gevraagd. De Resend API-sleutel wordt later via Castiq platformbeheer ingevoerd en ontbreekt nog.

Staging en productie zijn afzonderlijke Supabase-projecten, met elk een eigen platformbeheerder en private mailsleutels. De browser accepteert precies zes cijfers, inclusief een beginnende nul. Google staat onder de e-mailaanmelding met het Google-icoon.

## Supabase instellen

Projecten: staging `zovwrexlzmhyejnfnmid`, productie `jyqajjfyksasehdlzfuf`. Beide publieke Auth-settings zijn daadwerkelijk gecontroleerd: e-mail en Google ingeschakeld, aanmeldingen toegestaan, geen automatische e-mailbevestiging.

Gebruik steeds het project uit deze tabel; Site URL en redirects volgen exact dezelfde omgeving:

| Instelling | Staging | Productie |
| --- | --- | --- |
| Project-ref | `zovwrexlzmhyejnfnmid` | `jyqajjfyksasehdlzfuf` |
| Site URL | `https://staging.castiq.nl` | `https://castiq.nl` |
| Redirect URLs | `https://staging.castiq.nl/**` | `https://castiq.nl/**` |
| Email OTP Length | `6` | `6` |
| Confirm email | Ingeschakeld (`mailer_autoconfirm=false`) | Ingeschakeld (`mailer_autoconfirm=false`) |
| Configuratie-export | [staging.json](../emails/configuration/staging.json) | [production.json](../emails/configuration/production.json) |

Per project:

1. Authentication → URL Configuration: Site URL `https://staging.castiq.nl` respectievelijk `https://castiq.nl`. Toegestane redirect: uitsluitend de bijbehorende `https://<domein>/**`. Google callback in Google Cloud blijft de door Supabase opgegeven `/auth/v1/callback` van dat project.
2. Authentication → Sign In / Providers → Email: **Email OTP Length = 6**. Behoud verplichte e-mailbevestiging. De tekst van een template verandert de serverinstelling niet.
3. Authentication → Email Templates: plak de 13 HTML-bestanden uit [emails/supabase](../emails/supabase) in de bijbehorende template uit de tabel hieronder. Neem ook de onderwerpregel over uit [auth-template-config.json](../emails/supabase/auth-template-config.json); het veld `mailer_subjects_<bestandsnaam zonder .html>` hoort bij die HTML. Laat `{{ .Token }}`, `{{ .SiteURL }}` en andere Supabase-variabelen letterlijk staan.
4. Laat Resend SMTP en de bestaande Google-credentials staan. Controleer geverifieerde afzender, SPF/DKIM en eventuele linktracking; lever geen tokens in logs aan.
5. Meld daadwerkelijk aan met een ontvangen code van zes cijfers. Test ook Google en de redirect terug naar hetzelfde doel. De juridische aanvaarding en clubrechten worden daarna op de Castiq-server gecontroleerd.

Dezelfde 13 bestanden gelden voor beide projecten; `{{ .SiteURL }}` volgt de hierboven ingestelde Site URL. Bewaar iedere template afzonderlijk. Voor beveiligingsmeldingen controleer je ook de bestaande aan/uit-instelling; HTML plakken schakelt de melding niet automatisch in.

| Supabase-template | HTML-bestand |
| --- | --- |
| Confirm sign up | `confirmation.html` |
| Invite user | `invite.html` |
| Magic link or OTP | `magic_link.html` |
| Change email address | `email_change.html` |
| Reset password | `recovery.html` |
| Reauthentication | `reauthentication.html` |
| Password changed | `password_changed_notification.html` |
| Email address changed | `email_changed_notification.html` |
| Phone number changed | `phone_changed_notification.html` |
| Sign-in method linked | `identity_linked_notification.html` |
| Sign-in method removed | `identity_unlinked_notification.html` |
| Verification method added | `mfa_factor_enrolled_notification.html` |
| Verification method removed | `mfa_factor_unenrolled_notification.html` |

De beperkte JSON-exports bevatten ook de gewenste URL- en OTP-instellingen, zonder SMTP-/Googlegeheimen. Ze zijn een controlelijst voor dashboardwerk en geen bewijs van toepassing. Desgewenst kun je de standaardexports lokaal opnieuw genereren, zonder API-token of externe wijziging:

```sh
node scripts/configure-supabase-auth.ts --environment staging --export-only
node scripts/configure-supabase-auth.ts --environment production --export-only
```

Noteer na het handmatig opslaan per omgeving datum, project-ref en welke velden/templates zijn gecontroleerd. Bevestig werking pas na ontvangst van een echte code van zes cijfers en een geslaagde aanmelding/Google-terugkeer in diezelfde omgeving. Bewaar geen codes of tokens als bewijs. De dashboardvelden en templatekoppelingen volgen de officiële [Supabase-templatehandleiding](https://supabase.com/docs/guides/auth/auth-email-templates) en [OTP-handleiding](https://supabase.com/docs/guides/auth/auth-email-passwordless).

## Beheren en synchroniseren

Platformbeheer → E-mail beheert onderwerpen, koppen, teksten en knoppen. Wijzigingen krijgen een nieuwe onveranderlijke versie. Alle dienstmails en Supabase-exports gebruiken dezelfde Castiq-renderer. HTML en templatevariabelen worden veilig begrensd. De beheerder kan voor Supabase exporteren; opslaan in Castiq wijzigt het externe Supabase-project niet vanzelf. Neem na iedere wijziging de export over in het juiste project.

Platformbeheer → E-mail → Resend: voer een eigen Resend API-sleutel, geverifieerd afzenderadres en optioneel antwoordadres in. Plaats het webhookgeheim van de endpoint `https://<domein>/api/mail/webhook` in hetzelfde scherm. Gebruik voor staging en productie afzonderlijke configuratie. Sleutels zijn alleen schrijfbaar, worden met een omgevingsgebonden AES-256-GCM-sleutel versleuteld en nooit teruggegeven. Recente heraanmelding is vereist voor wijzigingen.

Gebruik per omgeving een eigen Castiq API-sleutel die zowel verzenden (`POST /emails`) als providerstatus opvragen (`GET /emails/{id}`) toestaat. De huidige adapter gebruikt dezelfde sleutel voor beide. Resends huidige `sending_access` staat alleen verzenden toe; voor deze combinatie is `full_access` nodig. Controleer dit bij de eigen omgevingssleutel en voer haar uitsluitend in het bijbehorende Castiq-beheerscherm in. Zie de officiële [Resend-rechten](https://resend.com/docs/api-reference/api-keys/create-api-key) en [statusopvraag](https://resend.com/docs/api-reference/emails/retrieve-email).

| Omgeving | Exacte webhook-URL |
| --- | --- |
| Staging | `https://staging.castiq.nl/api/mail/webhook` |
| Productie | `https://castiq.nl/api/mail/webhook` |

Kies voor de eigen endpoint de gebeurtenissen `email.delivered`, `email.bounced`, `email.complained`, `email.failed`, `email.suppressed`, `email.sent` en `email.delivery_delayed`; deze worden door de huidige webhookcode verwerkt. Sla het bijbehorende `whsec_`-geheim in dezelfde Castiq-omgeving op. Open- en kliktracking worden niet gebruikt voor deze afleveringscontrole. De gebeurtenisbetekenissen staan in de officiële [Resend-webhookdocumentatie](https://resend.com/docs/webhooks/event-types). Deze providerconfiguratie is nog niet toegepast.

Dienstmail gaat via de duurzame outbox en de worker. Een bericht houdt zijn oorspronkelijke templateversie, payload en idempotentiecode. Timeouts blijven onbevestigd en worden op dezelfde aanvraag gereconcilieerd; na het idempotentievenster stopt automatische herverzending. Alleen passend geverifieerd providerbewijs bevestigt aflevering aan de ontvangende mailserver. Aflevering bewijst geen lezing.

De controlemail richt zich uitsluitend op `info@dgwebservices.nl`. Bewaar provider-ID en afleveringsstatus als bewijs. Zonder API-sleutel/afzender blijft de verbinding zichtbaar ongeconfigureerd. Er is geen sleutel uit een andere omgeving hergebruikt.

## Accountbeheer

Castiq vertrouwt geen rolclaims uit wijzigbare gebruikersmetadata. De server verifieert de Supabase-identiteit en leest actuele club-/teamrechten uit zijn private schema. Persoonlijke registratie maakt geen club en verleent geen tekenbevoegdheid. Platformbeheer ziet tenant- en operationele metadata, zonder standaard clubinhoud.

De Edge Function `castiq-account-operations` heeft eigen sterke authenticatie en een service-role-only autorisatie-RPC. Zij kan uitsluitend het expliciet opgegeven eerste beheeradres aanmaken en reeds door de privacybackend geautoriseerde sessie-intrekking of identiteitswissing uitvoeren. De service-role key blijft in Supabase. De VPS gebruikt een afzonderlijke beperkte operatiesleutel. Het intrekken van Auth-sessies verhindert refresh; bestaande access-tokens worden bij ieder Castiq-verzoek aanvullend door de geblokkeerde accountstatus geweigerd.

[Bewaar- en herstelprocedures](PRIVACY-BEHEER.md) en [e-mailstatusdetails](../emails/README.md) horen bij deze configuratie.
