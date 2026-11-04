# Castiq projectprofiel

Bijgewerkt op 4 november 2026. De huidige scope is lokaal bouwen en verifiëren. De uiteindelijke VPS en GitHub releaseomgeving worden aangesloten zodra de projectgegevens beschikbaar zijn.

| Onderdeel | Vastgesteld |
| --- | --- |
| Werkmap | `/home/codex/repos/castiq` |
| Aangeleverde basis | `CastIQ-V1-Staging` uit het overdrachtspakket van 3 november 2026 |
| Uitgangscommit | `f9afa122fc2c4c13b703daef19d68c7c5ddd820c` lokaal geïmporteerd; geen oorspronkelijke Gitgeschiedenis meegeleverd |
| Werkbranch | `codex/local-staging-foundation` |
| GitHub doelrepository | Nog niet vastgesteld; geen remote geconfigureerd |
| Frontend | Bestaande React 19, TypeScript, Vite; ontwerp en originele assets behouden |
| Toolchain | Node 24.18.0, npm 11.16.0; exacte dependencies en package-lock.json |
| Lokale website | `http://127.0.0.1:4173` |
| Lokale API | `http://127.0.0.1:4174/api` via dezelfde websiteproxy |
| Lokale database | Eigen PostgreSQL 17 Dockercontainer; alleen `127.0.0.1:55439` |
| Lokale gegevens | Docker-volume `castiq-local_castiq-local-data`; private uploads `.local/uploads` |
| Lokale identiteit | Fictieve serveraccounts; afzonderlijke club- en teamrechten |
| Externe identiteit | Supabase OTP/Google/sessiecode en serververificatie voorbereid; echte projectconfiguratie en acceptatie open |
| Publicatie | Uitsluitend expliciete sandbox; geen socialaccounts gekoppeld |
| Staging en productie | Host, URL, site-ID, runners, gebruikers en paden ontbreken |
| Deploywrapper | `dg-site-deploy` voorgeschreven; geïnstalleerde versie en Vite-contract nog te verifiëren |
| Supabase | Geen Castiq-project aangetroffen in beide beschikbare connectoraccounts; geen project aangemaakt |
| Sites-identiteit in pakket | Historische prototype-identiteit; geen bewijs van toegang tot of eigendom van VPS-staging |

Er is geen Next.js-migratie uitgevoerd. Het pakket vraagt expliciet de bestaande React/Vite-app te behouden. De releaseafspraken blijven van toepassing; de `dg-site-deploy`-wrapper moet later aantoonbaar een statische Vite-build plus afzonderlijke API ondersteunen voordat een stagingworkflow wordt geactiveerd.
