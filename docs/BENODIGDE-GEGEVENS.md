# Benodigde gegevens voor Castiq staging

Bijgewerkt op 20 november 2026. De repo en nieuwe staginghost zijn vastgesteld en voorbereid. De gebruiker koppelt het bedoelde Supabase-project en vult de resterende gegevens in. Er is nog geen doelkandidaat, actieve app, externe login of publieke staging-URL. Zet geheimen uitsluitend in de afgesproken afgeschermde hostvoorziening, buiten chat, Git, artefacten en buildaccount.

## Al vastgesteld en nog nodig

| Onderdeel | Gereed | Nog aan te leveren of te verifiëren |
| --- | --- | --- |
| Broncode | Privérepo `castiqnl/platform`, integratie `main`, werkbranch `codex/dg-vps-08-staging-preparation` | Review/integratie van deze voorbereiding en daarna de volledige vrij te geven SHA met geslaagde CI |
| Doelhost | `dg-vps-08`, bereikt via Tailscale `100.65.51.108`; doel `castiq-staging` | Geen extra VPS nodig; Tailscale-IP niet als publiek DNS-record gebruiken |
| Rechten en runtime | Eigen `castiq-app`, `castiq-build`, `castiq-runner`; Node 24.18.0/npm 11.16.0 | Controleplane-isolatie is geverifieerd; echte database-, backup-, toegangs- en releasevoorwaarden nog aftekenen |
| Releasepaden | `/srv/castiq-staging`, privéversies onder `/etc/castiq-staging/runtime.d` en `releases.d` | Afzonderlijke runtimeconfiguratieversie met bedoelde databaseverbinding |
| GitHub Actions | Eigen online runner `dg-vps-08-castiq-staging`, ID `21`; handmatige kandidaat- en activatieworkflows voorbereid | Het activatie-environment `castiq-dg-vps-08-staging` met passende bescherming/goedkeuring volgens het releaserunbook; geen bestaande environments wijzigen |
| Stagingadres | Vrije eigen loopbackpoort `127.0.0.1:4184`, pending proxy buiten actieve importmap | Exacte afgeschermde HTTPS-origin, gecontroleerde DNS-bestemming, certificaat en toegangsbeleid vóór publieke routing |
| Herstel | App/configuratiepaar en rollbackroute voorbereid | Backupbestemming, encryptieontvanger, bewaartermijn, herstelverantwoordelijke en echte restoreproef voor de stagingdatabase/uploads |

De concrete bouw-, activatie-, verificatie- en rollbackstappen staan in [DG-RELEASE.md](DG-RELEASE.md). De eerste activatie en eventuele publieke routing vereisen een aparte opdracht. De oorspronkelijke Docker/Caddy-route blijft een browserdemo en is geen deployment van de nieuwe serveropslag.

## De enige vier GitHub repository variables

| Naam | Bron | Gebruik |
| --- | --- | --- |
| `CASTIQ_APP_ORIGIN` | De nog te bevestigen exacte HTTPS-origin van deze stagingomgeving, zonder pad of afsluitende slash | Publieke buildconfiguratie en dezelfde waarde in het runtimeprofiel; verzoekcontrole en authredirect |
| `CASTIQ_DATA_MODE` | Voor deze staging: `server` | Publieke buildconfiguratie; staging weigert `demo` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key van het bedoelde Supabase-stagingproject | Publieke browser- en serverconfiguratie; uitsluitend `sb_publishable_...`, nooit een secret/service-role key |
| `NEXT_PUBLIC_SUPABASE_URL` | Project-URL van hetzelfde Supabase-stagingproject | Publieke browser- en serverconfiguratie; exacte HTTPS-origin |

Deze namen worden expliciet in Vite opgenomen. Hun wijziging vereist een nieuwe build en een passend runtimeprofiel; een bestaande kandidaat met een afwijkend publiek profiel wordt geweigerd. De `NEXT_PUBLIC_`-namen veranderen het framework niet. Andere publieke prefixes worden niet automatisch naar de browser geëxporteerd.

Er zijn voor deze releaseworkflow geen zelf aan te maken GitHub repository secrets nodig. Het tijdelijke `GITHUB_TOKEN` is ingebouwd en krijgt alleen leesrechten voor broncode en Actions. Voeg geen extra GitHub-variabelen toe voor host, runner, poort, database of migraties: de geverifieerde niet-geheime doelgegevens staan in de projectconfiguratie; geheimen blijven op de host.

## Runtime en migraties buiten GitHub

| Naam of configuratie | Bron / locatie | Gebruik |
| --- | --- | --- |
| `DATABASE_URL` | Afzonderlijke beperkte runtime-databaserol van het bedoelde Supabase-project; root-only `/etc/castiq-staging/runtime.d/<config-id>.json` | Uitsluitend runtime; verbinding en TLS volgens de daadwerkelijke Supabase-verbinding verifiëren; runtime heeft ook `SELECT` op `castiq.migration_history` nodig voor readiness |
| Dezelfde vier publieke waarden | GitHub-profiel overnemen in datzelfde versiegebonden JSON-bestand | Exacte koppeling met de kandidaat; JSON bevat alleen deze vier waarden plus `DATABASE_URL` |
| `APP_ENV`, `AUTH_MODE`, `HOST`, `PORT` | Root-owned releasehelper: `staging`, `supabase`, `127.0.0.1`, `4184` | Vaste runtime-inrichting; geen GitHub-variabelen |
| `UPLOAD_DIR`, `STATIC_DIR`, `PUBLICATION_MODE` | Root-owned releasehelper: eigen uploads, release-`dist`, uitsluitend `sandbox` | Runtime; uploaddata blijft buiten statische bestanden en releases |
| `RELEASE_SHA` | De gecontroleerde volledige SHA van de kandidaat | Runtimebewijs; automatisch aan dezelfde code/configuratieversie gebonden |
| Migratieverbinding / migratiecredential | Aparte migratierol in de afgesproken root-only secretvoorziening | Alleen expliciete migratiestap na compatibiliteits-, backup- en herstelcontrole; geen toegang voor buildaccount |
| Activatieverklaring | Root-only `/etc/castiq-staging/activation-readiness.json` | Bindt de werkelijke acceptatievoorwaarden aan SHA en runtimeconfiguratieversie; geen invulling op basis van aannames |

`.env.example` beschrijft de namen zonder waarden. `.env.local` is uitsluitend voor lokale ontwikkeling en wordt niet gecommit. Historische lokale `APP_ORIGIN`, `SUPABASE_*` en `VITE_*`-namen blijven compatibel; conflicterende waarden worden geweigerd. `VITE_AUTH_GOOGLE_ENABLED` is alleen een bestaande lokale compatibiliteitsoptie, geen vijfde GitHub-variabele. De stagingroute houdt de Google-knop standaard uitgeschakeld.

`/api/readiness` controleert migratiechecksums, uploadtoegang en de statische index. Een geslaagde readiness is geen externe Supabase-login- of providerproef. Een Supabase service-role key is niet nodig voor de huidige browser of API-runtime. Er worden bij deze voorbereiding geen bestaande databasecredentials vervangen en geen doelmigraties uitgevoerd.

## Accounts en diensten

| Account of voorziening | Nodig / stand van zaken |
| --- | --- |
| Supabase-organisatie en afzonderlijk Castiq-stagingproject | Gebruiker koppelt het project aan deze workspace; lever project-URL, publishable key, regio/eigenaarschap en de bedoelde PostgreSQL-verbinding aan |
| Supabase databasegebruikers | Aparte migratierol en beperkte API-runtimegebruiker; privé-schema `castiq` buiten de Data API, rechten en tenantgrenzen extern verifiëren. Geef runtime expliciet `SELECT` op `castiq.migration_history` voor checksumcontrole; er is nog geen doelgrant uitgevoerd |
| Supabase Auth en mailbezorging | Exacte app-redirects en site-URL; geverifieerd afzenderdomein, SMTP/gatewaycontract en echte OTP-proef met expliciete testgebruikers |
| Google Cloud OAuth-client | Alleen wanneer Google-login wordt vrijgegeven; client-ID/secret, exacte Supabase callback en provideracceptatie nodig; huidige stagingroute activeert dit niet |
| Mailprovider / bestaande mailgateway | Bestaand contract en account hergebruiken zodra geverifieerd; afzender, signing secrets en webhookbeleid blijven servergeheimen. De mailgateway en applicatie-outbox zijn nog geen werkende koppeling |
| Privé-opslag | Eigen persistent uploadpad is voorbereid. Een afzonderlijke Supabase Storage-koppeling is pas nodig als die adapter wordt gekozen; huidige adapter gebruikt private schijfopslag |
| Officiële socialprovideraccounts | Voor latere echte kanaaladapters: gekozen zakelijke accounts, officiële scopes/app-review en expliciete testaccounts. Geen socialwachtwoorden bij teammanagers |
| Sportlink of andere wedstrijdbron | Voor latere bronimport: contract/API-toegang, clubidentificatie, rechten, bronversies en correctiebeleid |
| Monitoring en herstel | Beheercontact, private logging zonder tokens, fout-/workerbewaking en de goedgekeurde backupvoorziening |
| Afzonderlijk productieproject | Alleen bij een latere productieopdracht; geen gedeelde testdata of stagingcredentials |

Een bestaand account hoeft niet opnieuw aangemaakt te worden. De ontbrekende aansluitingen zijn geen reden om fictieve project-ID's, hosts, accounts of credentials in te vullen. Voor aanvullende kanaal-, mail- of bronintegraties wordt eerst het werkelijke contract vastgesteld; hun eventuele geheimen komen in de afgeschermde runtimevoorziening, zonder uitbreiding van de vier GitHub-variabelen.

## Clubgegevens en pilotafspraken

Lever per club de bevoegde beheerder, teams en seizoenen, teammanagers/redacteuren, primaire en secundaire kleuren, logo en foto-/naambeleid aan. Leg O10 zonder publieke uitslagen, fotovrijgave/intrekking, bewaartermijnen en sponsorafspraken met juiste week-/maandperiode vast. Kies drie gescheiden testclubs en expliciete provider-testaccounts, met een bevoegde persoon voor eventuele externe testposts.

De echte pilot volgt pas na geverifieerde tenantisolatie, uploads, Supabase-login, herstel en acceptatie op afgeschermde staging. Een sandboxreceipt, export, enqueue of provideracceptatie is geen bewijs van een echte publicatie. Echte publicatie vereist kanaalbewijs met post-ID/versie; er is in deze voorbereiding niets extern gepubliceerd.
