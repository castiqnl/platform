# Benodigde gegevens voor Castiq staging

De lokale bouw gebruikt fictieve accounts en een eigen database. Voor afgeschermde staging zijn de onderstaande gegevens en voorzieningen nodig. Deel geheime waarden via de afgesproken secretmanager of GitHub environments; zet ze niet in chat, Git of browserconfiguratie.

## Project en hosting

| Gegeven | Wat aan te leveren of vast te stellen |
| --- | --- |
| GitHub | Exacte `owner/repository`, toegang voor review/CI, branchbescherming en integratiebranch `main` |
| Development | VPS-host, SSH-toegang of bestaande beheerroute, Linux-gebruiker en checkoutpad |
| Staging | Afgeschermde URL, site-ID, host, releasepaden, API-procesbeheer, uploadvolume en proxyconfiguratie |
| Productie | URL en site-ID ter identificatie; productie valt buiten deze lokale opdracht |
| Deploy | Versie en ondersteund contract van `dg-site-deploy`, start- en rollbackcommando's, Caddy-configuratie |
| GitHub Actions | Runnernamen en exacte labels, Linux-gebruikers, workspacepaden, environments `staging` en `production` |
| Toegang | Uitgenodigde gebruikers, toegangsbeveiliging vóór de app, TLS en toegestane origins |
| Herstel | Backupbestemming, encryptieontvanger, bewaartermijn, herstelprocedure en verantwoordelijke |

De deploymentworkflow wordt pas ingevuld wanneer deze waarden zijn geverifieerd. De aangeleverde statische Docker/Caddy-configuratie dekt de nieuwe API en opslag niet zelfstandig.

## Accounts en diensten

| Account of voorziening | Nodig voor |
| --- | --- |
| Supabase-organisatie met Castiq stagingproject | PostgreSQL en Auth; regio, kosten en eigenaarschap eerst bepalen |
| Afzonderlijk Supabase productieproject | Latere productie; geen gedeelde sleutels of testdata met staging |
| Supabase databasegebruikers | Migratiegebruiker en beperkte API-runtimegebruiker; privé-schema `castiq` buiten de Data API |
| Google Cloud OAuth-client per omgeving | Google-login met exacte Supabase callback en app-redirect |
| Resend-account en geverifieerd afzenderdomein | Auth-mail via jullie gesigneerde Supabase-mailgateway; applicatiemail via duurzame outbox |
| Bestaande mailgateway | Gateway-URL, contractversie, aparte signing secrets, worker en webhookbeleid; niet opnieuw verzinnen |
| Privé-opslag | Persistent staging-uploadvolume of gekozen private objectopslag; de huidige lokale adapter gebruikt schijfopslag |
| Officiële socialprovideraccounts | Alleen gekozen eerste kanalen, juiste zakelijke accounttypen, app-review/scopes en expliciete testaccounts |
| Sportlink of andere wedstrijdbron | Contract/API-toegang, clubidentificatie, rechten, syncbeleid en handmatige correcties |
| Monitoring | Logs zonder tokens, foutmeldingen, workerbewaking en contactpersoon |

Een account dat al bestaat hoeft niet opnieuw aangemaakt te worden. Koppel bestaande voorzieningen pas nadat eigenaarschap, omgeving en bevoegdheden zijn vastgesteld.

## Huidige configuratienamen

Alle servervariabelen staan in `.env.example`. `.env.local` wordt uitsluitend lokaal gegenereerd en is genegeerd door Git.

| Naam | Plaats | Type en doel |
| --- | --- | --- |
| `APP_ENV` | Server / GitHub environment | `local` of `staging`; geen lokale testlogin op staging |
| `AUTH_MODE` | Server / GitHub environment | `local` voor fictieve lokale accounts; `supabase` voor geverifieerde gebruikers |
| `HOST`, `PORT` | Server / GitHub environment | Interne bindinterface en API-poort |
| `APP_ORIGIN` | Server / GitHub environment | Exacte origin, inclusief schema, voor verzoekcontrole |
| `DATABASE_URL` | Serversecret | PostgreSQL-verbinding; gebruik beperkte runtimecredentials en geverifieerde TLS voor extern verkeer |
| `UPLOAD_DIR` | Server / GitHub environment | Persistent privépad buiten `dist` en buiten openbare statische bestanden |
| `SUPABASE_URL` | Server / GitHub environment | URL van het juiste Supabase-project |
| `SUPABASE_PUBLISHABLE_KEY` | Serverconfiguratie | Publishable key voor Auth-verificatie; geen service-role key |
| `VITE_SUPABASE_URL` | Publieke buildconfiguratie | Hetzelfde Supabase-project als de server, ingebakken tijdens Vite build |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publieke buildconfiguratie | Publishable key voor OTP, Google en sessieherstel; nooit een secret/service-role key |
| `VITE_AUTH_GOOGLE_ENABLED` | Publieke buildconfiguratie | Pas `true` na echte providerconfiguratie en callbackverificatie; standaard `false` |
| `PUBLICATION_MODE` | Server / GitHub environment | Momenteel alleen `sandbox`; echte adapters zijn nog niet vrijgegeven |
| `RELEASE_SHA` | Gecontroleerde deployinvoer | Volledige broncommit voor runtimebewijs |
| `VITE_DATA_MODE` | Publieke buildconfiguratie | Alleen `demo` voor de afzonderlijke browserdemo; standaard servermodus |

Secrets voor Supabase beheer, migraties en deploys worden afzonderlijk in het releasepad gehouden. Een Supabase service-role key is niet nodig in de huidige browser of API-runtime. Er staan geen `NEXT_PUBLIC_*`-variabelen in deze Vite-app. Elke `VITE_*`-waarde komt in de browser terecht en moet openbaar mogen zijn.

## Configuratie die nog een contract nodig heeft

Voor OTP/Google-sessies, private objectopslag, mailgateway/outbox, echte kanaaladapters en bronimport moeten de bestaande infrastructuurcontracten eerst worden vastgesteld. Pas daarna worden hun concrete variabelen aan de allowlist toegevoegd. Benodigd zijn onder meer Google client-ID en secret, exacte redirects, mailafzender, gateway- en webhooksigning secrets, provider app-ID/secret, scopes, account-ID's en veilige tokenopslag. Deze waarden worden nog nergens als geconfigureerd beschouwd.

## Clubgegevens en pilotafspraken

Lever per club de bevoegde beheerder, teams en seizoenen, teammanagers en redacteuren, primaire/secundaire kleuren, logo en foto-/naambeleid aan. Leg apart vast: O10 zonder publieke uitslagen, fotovrijgave en intrekking, bewaartermijnen, sponsorafspraken met week/maandperiode en de gekozen testkanalen. Bepaal de drie pilotaccounts en wie externe testposts mag laten plaatsen.

De echte pilot start pas nadat tenantisolatie, uploads, Supabase-login, herstel en de volledige acceptatiematrix op afgeschermde staging zijn afgetekend. Een sandboxreceipt, export, enqueue of provideracceptatie geldt niet als bewijs van een echte publicatie.
