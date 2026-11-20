# Castiq projectprofiel

Bijgewerkt op 20 november 2026. De bestaande React/Vite-app en repository zijn behouden. De nieuwe staginginrichting op `dg-vps-08` is voorbereid; de eerste activatie valt onder een aparte opdracht. De releaseprocedure staat in [DG-RELEASE.md](DG-RELEASE.md), de hostcontroles in [DG-VPS-08-HOST.md](DG-VPS-08-HOST.md).

| Onderdeel | Vastgesteld en bron |
| --- | --- |
| Werkmap | `/home/codex/repos/castiq` |
| Aangeleverde basis | `CastIQ-V1-Staging` uit het overdrachtspakket van 3 november 2026 |
| Uitgangscommit prototype | `f9afa122fc2c4c13b703daef19d68c7c5ddd820c`; ongewijzigde lokale import, zonder meegeleverde Gitgeschiedenis |
| Historische integratie | Lokale implementatie `70387e392d2cfc739bfbd60e30025c1d68eab52f` samengevoegd met GitHub-initialisatie `08b8be909c2979cf8d12b1319989536d9833dd4c`; beide geschiedenissen behouden |
| Uitgangscommit deployvoorbereiding | `9061381596cb2c647504461726fceb2148b192fb` op `main` bij aanvang van deze voorbereiding |
| Integratiebranch / werkbranch | `main` / `codex/dg-vps-08-staging-preparation`; release vereist een volledige SHA die tot `main` behoort |
| GitHub doelrepository | [castiqnl/platform](https://github.com/castiqnl/platform), privé; geverifieerde `origin`: `https://github.com/castiqnl/platform.git` |
| Frontend | Bestaande React 19, TypeScript, Vite; 50 originele assets en 27 standaardstijlen behouden |
| Toolchain | Node `24.18.0`, npm `11.16.0`; `.nvmrc`, `packageManager` en gecommitteerd `package-lock.json` |
| Lokale website / API | `http://127.0.0.1:4173` / `http://127.0.0.1:4174/api`; developmentproxy houdt dezelfde origin |
| Lokale database / gegevens | Eigen PostgreSQL 17-container op `127.0.0.1:55439`; volume `castiq-local_castiq-local-data`, private uploads `.local/uploads` |
| Lokale identiteit | Fictieve serveraccounts voor drie gescheiden clubs; club- en teamrechten op de server |
| Doel / omgeving | `dg-vps-08`, nieuw doel `castiq-staging`; staging volgens de opdracht |
| SSH-bestemming | Geverifieerde VPS via Tailscale `100.65.51.108`; dit is geen publieke DNS-bestemming of app-URL |
| Doelpaden | `/srv/castiq-staging/{candidates,releases,shared/uploads}`; versiegebonden privéconfiguratie in `/etc/castiq-staging/runtime.d` en `releases.d` |
| Rechten | Afzonderlijke accounts `castiq-app`, `castiq-build`, `castiq-runner`; releasehulpmiddelen en serviceconfiguratie onder rootbeheer |
| Doelruntime / webpoort | Eigen Node `24.18.0` / npm `11.16.0`; gereserveerd `127.0.0.1:4184` |
| Runner | Repo-eigen `dg-vps-08-castiq-staging`, GitHub runner-ID `21`, geregistreerd en online; labels `self-hosted`, `Linux`, `X64`, `castiq`, `dg-vps-08`, `staging`, `castiq-staging` |
| Releasecontract | Afzonderlijke handmatige kandidaatbuild en activatie; eigen root-owned helper voor deze Vite/API-app, gedeelde DG-buildlock en activatielock |
| Vereiste CI | `Castiq local acceptance`, job `verify`, alle vastgelegde stappen geslaagd op de gevraagde SHA; identiteit en bronhash in `scripts/release-gate.mjs` |
| Huidige doeltoestand | App en sandboxwerker inactive; geen kandidaat, `current`-verwijzing of publieke Castiq-route |
| Externe identiteit / database | Supabase OTP/sessiecode en serververificatie voorbereid; gebruiker koppelt het bedoelde project, nog geen echte verbinding geverifieerd |
| Publicatie | Uitsluitend expliciete sandbox; geen socialaccounts gekoppeld of externe posts bevestigd |
| Productie | Ongewijzigd en buiten deze voorbereiding |
| Sites-identiteit in pakket | Historische prototype-identiteit; geen bewijs van een VPS-release of publieke staging |

De vier publieke GitHub-variabelen zijn `CASTIQ_APP_ORIGIN`, `CASTIQ_DATA_MODE`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `NEXT_PUBLIC_SUPABASE_URL`. Vite neemt deze namen expliciet over; er is geen Next.js-migratie uitgevoerd. GitHub levert het tijdelijke ingebouwde `GITHUB_TOKEN`. Database- en migratiegeheimen blijven in afgeschermde hostconfiguratie buiten de runner en buildaccount.

De eerdere algemene verwijzing naar een nog te vinden `dg-site-deploy`-wrapper is vervangen door het geverifieerde contract voor deze nieuwe host. Een eerste release vereist nog het juiste publieke profiel, database en toegangsbeveiliging, CI op de vrijgegeven SHA en de expliciete activeringsvoorwaarden. De exacte oplevercommit en meest recente testresultaten worden bij de oplevering vastgelegd; de uitgangscommit hierboven is geen kandidaatbuild.
