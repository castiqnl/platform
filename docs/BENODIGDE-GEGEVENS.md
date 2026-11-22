# Omgevingen en nog benodigde gegevens

Bijgewerkt: 22 november 2026. Dit vervangt de inventarisatie van 20 november. De gebruiker heeft beide Supabase-projecten en de eigen hostvoorbereiding geautoriseerd, en uitrol naar staging. Publieke productieactivatie volgt afzonderlijk.

## Vastgesteld en ingericht

| Gegeven | Staging | Productie |
| --- | --- | --- |
| GitHub repository / integratie | `castiqnl/platform`, `main` | dezelfde bron, afzonderlijke configuratie |
| GitHub environment | `staging` | `production` |
| Castiq-origin | `https://staging.castiq.nl` | `https://castiq.nl` |
| Supabase-account | Castiq | Duindorpdoet |
| Supabase-project | `zovwrexlzmhyejnfnmid` | `jyqajjfyksasehdlzfuf` |
| Regio | Frankfurt, `eu-central-1` | Frankfurt, `eu-central-1` |
| Eerste platformbeheerder | `info@dgwebservices.nl` | `info@dgwebservices.nl` |
| Site-identiteit | `castiq-vps08-staging` | `castiq-vps08-production` |
| Loopbackpoort | 4184 | 4185 |

DNS A-records voor beide namen zijn gecontroleerd: `204.168.128.28`, de geverifieerde publieke interface van `dg-vps-08`. Er zijn geen DNS-records aangepast door deze taak.

## Exact vier GitHub-variabelen

Elke GitHub environment bevat uitsluitend:

| Naam | Bron / werking |
| --- | --- |
| `CASTIQ_APP_ORIGIN` | Bovenstaande exacte origin van het doel |
| `CASTIQ_DATA_MODE` | **`supabase`** op beide doelen |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key van uitsluitend het betreffende project |
| `NEXT_PUBLIC_SUPABASE_URL` | HTTPS-project-URL van uitsluitend het betreffende project |

Alle vier environmentvariabelen zijn voor beide doelen gecontroleerd; `CASTIQ_DATA_MODE` staat op `supabase`. Deze vier waarden worden tijdens de Vite-build ingebakken en tijdens activatie opnieuw vergeleken met de runtime. Een wijziging vereist een nieuwe kandidaatbuild. De namen met `NEXT_PUBLIC_` zijn bewust ondersteund; dit blijft React/Vite, zonder Next.js-migratie. De aangetroffen verkeerde namen `NEXT_PUBLIC_APP_URL` in staging en `FABELPAD_DATA_MODE` in productie zijn vervangen. Er is geen vijfde Google-variabele.

## Private runtime: al afzonderlijk aangemaakt

Per doel staan root-only configuraties onder `/etc/dg-webservices/<site>/runtime.d/`. De runner en het buildaccount kunnen ze niet lezen. Een release koppelt de app aan precies één runtimeconfiguratie.

| Naam | Bron / tijdstip |
| --- | --- |
| `DATABASE_URL` | Beperkte, projectspecifieke `castiq_runtime`-rol; runtime, geen migratierecht |
| `MAIL_ENCRYPTION_KEY` | Eigen willekeurige encryptiesleutel per omgeving; runtime, buiten databasebackups |
| `PRIVACY_LEDGER_HMAC_KEY` | Eigen sleutel voor niet-herleidbare wisreferenties; runtime, onafhankelijk van databaseherstel |
| `SUPABASE_ACCOUNT_OPERATIONS_KEY` | Eigen beperkte sleutel voor de account-Edge Function; runtime, geen Supabase service-role key |
| `PRIVACY_RETENTION_EXECUTE` | Aanvankelijk `false`; daarnaast vereisen definitieve wistaken afzonderlijke bewezen controles in de database |

De service stelt host/poort, `APP_ENV`, `AUTH_MODE=supabase`, uploadpad, ledgerpad, `STATIC_DIR=dist`, exacte `RELEASE_SHA` en de uitsluitend beschikbare sandbox-publicatieadapter vast. Databasecertificaat en hostname worden gecontroleerd met de meegeleverde openbare Supabase-CA. Bewaar private sleutels via de afgescheiden geheime backupvoorziening; wijzig ze niet zonder her-encryptie/herstelplan.

## Nog extern aan te vullen of te bewijzen

1. **Supabase Auth-instellingen — gebruiker voert deze zelf uit:** de gebruiker heeft gekozen voor handmatige instelling via de opgeleverde dashboardinstructies. De geëxporteerde Site URL, redirectlijst, `mailer_otp_length=6` en 13 HTML-templates zijn nog niet toegepast of extern geverifieerd. Er wordt hiervoor geen Management API-token gevraagd. [emails/README.md](../emails/README.md) en [AUTH-EN-MAIL.md](AUTH-EN-MAIL.md) bevatten de exacte stappen en beperkte JSON-patches. Bestaande Google-provider is op beide projecten daadwerkelijk ingeschakeld. Een volledige Google-login vereist nog een gebruikershandeling bij Google.
2. **Resend API — sleutel nog niet ingevoerd:** voer later per omgeving in Castiq platformbeheer → E-mail het daadwerkelijke afzenderadres, de eigen API-sleutel en het webhookgeheim in. De eigen sleutel moet verzenden én statusopvragen voor reconciliatie toestaan; exacte webhook-URLs en events staan in [AUTH-EN-MAIL.md](AUTH-EN-MAIL.md). De bestaande Supabase SMTP-koppeling is geen API-sleutelbron voor Castiq. Gebruik geen credentials van Fabelpad of andere projecten. Geef een geverifieerd Resend-afzenderdomein/adres op; dat wordt niet verzonnen.
3. **Afleveringsbewijs:** voer de controlemail naar het eerste beheerdersadres uit en controleer het bijbehorende provider-ID en `delivered`-bewijs. `accepted`, een geslaagde OTP-aanvraag en een wachtrijrecord zijn geen afleveringsbewijs.
4. **Providerbewaring:** lever verifieerbare gegevens over Supabase-backups/snapshots en supportmail (Stackmail indien werkelijk gebruikt), inclusief uiterste verwijdering en purge-/expungebewijs. Tot die tijd blijft destructieve automatisering geblokkeerd. De bewaarkalender en het onafhankelijke wisregister zijn geïmplementeerd; providerwissing wordt niet gesimuleerd.
5. **Echte clubinrichting en kanalen:** maak echte lege clubs en wijs geverifieerde accounts/teams toe. Laat bevoegde clubbeheerders zelf voorwaarden en verwerkersovereenkomst aanvaarden. Officieel geautoriseerde socialmedia-testaccounts en echte publicatieadapters ontbreken nog; alleen de afzonderlijke sandboxadapter bestaat. Er zijn geen sponsorbetalingen geactiveerd.

Er zijn geen persoonlijke of clubvoorwaarden namens de beheerder aanvaard. De eerste daadwerkelijke aanmelding vraagt expliciete persoonlijke aanvaarding; clubaanvaarding blijft apart.
