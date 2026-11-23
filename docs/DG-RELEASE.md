# Castiq releaseprocedure op dg-vps-08

Bijgewerkt op 23 november 2026. De eerdere voorbereiding van 20 november is vervangen door de hieronder geverifieerde, per omgeving afgescheiden inrichting. Bron: `castiqnl/platform`, repository-ID `1446413160`, integratiebranch `main`; bestaande Fabelpad-inrichting is uitsluitend als contractreferentie gebruikt.

## Contract

| Onderdeel | Staging | Productie |
| --- | --- | --- |
| GitHub environment | `staging` | `production` |
| Site-ID | `castiq-vps08-staging` | `castiq-vps08-production` |
| Origin | `https://staging.castiq.nl` | `https://castiq.nl` |
| Runner | `dg-vps-08-castiq-vps08-staging` | `dg-vps-08-castiq-vps08-production` |
| Exclusief runnerlabel | `castiq-vps08-staging` | `castiq-vps08-production` |
| Runner / build / app-account | `run-cas-v08-stg` / `build-cas-v08-stg` / `app-cas-v08-stg` | `run-cas-v08-prd` / `build-cas-v08-prd` / `app-cas-v08-prd` |
| Eigen loopbackpoort | 4184 | 4185 |
| Supabase-ref | `zovwrexlzmhyejnfnmid` | `jyqajjfyksasehdlzfuf` |

Algemene paden, met `<site>` uit bovenstaande tabel:

- `/srv/sites/<site>/{candidates,releases,shared}`; `current` wijst naar één beheerd releasepaar.
- `releases/<id>/{artifact,runtime.env,pair.json}`; vorige gezonde combinatie via `previous`.
- `/etc/dg-webservices/<site>/{host.json,runtime.d,releases.d,activation.lock}`; root-only runtimeprofielen.
- `/opt/actions-runner/<site>`, `/var/lib/dg-build/<site>`, `/usr/local/libexec/<site>` en eigen `/opt/dg-toolchains/<site>`.
- `shared/uploads` en het onafhankelijke `shared/privacy-ledger` overleven codeactivatie en rollback. `shared/backups` is root-only en bevat alleen versleutelde eigen appbackups.

Runtime Node **24.18.0**, npm **11.16.0**. Installatie `npm ci` uit de lockfile. `npm run build` controleert eerst de exacte juridische archieven en bouwt met Vite naar `dist/`, inclusief assets, fonts en 27 standaardstijlen. Start: `node server/index.ts` met `STATIC_DIR=dist`; worker: `node server/worker.ts`. Geen frameworkmigratie.

## Configuratie en grenzen

De exact vier GitHub-variabelen staan per environment: `CASTIQ_APP_ORIGIN`, **`CASTIQ_DATA_MODE=supabase`**, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`. Ze zijn publiek en worden ingebakken. De kandidaat is aan hun hash gebonden. Er zijn geen deploymentsecrets of vijfde providerflags als GitHub-variabele toegevoegd.

De private runtime bevat daarnaast `DATABASE_URL`, `MAIL_ENCRYPTION_KEY`, `PRIVACY_LEDGER_HMAC_KEY`, `SUPABASE_ACCOUNT_OPERATIONS_KEY` en eventueel `PRIVACY_RETENTION_EXECUTE` (aanvankelijk `false`). De roothelper stelt de overige vaste runtimepaden en de SHA in. [BENODIGDE-GEGEVENS.md](BENODIGDE-GEGEVENS.md) specificeert bronnen en open providergegevens.

Een beperkte Postgres-serverrol heeft toegang tot het private Castiq-schema, zonder schema-/rolbeheer, bypass-RLS of Auth-schema. De vertrouwde API/worker gebruikt dit serverrecht; tenant- en teamrechten worden bij ieder API-verzoek server-side uit actuele memberships gecontroleerd. Anon/authenticated hebben geen toegang tot dat schema. De browser verbindt uitsluitend met Supabase Auth en de geautoriseerde Castiq-API. De platformrol krijgt metadata en templatebeheer, geen standaard clubinhoud.

Eigen runner-, build- en appunits blokkeren loopbackcontrolepoorten. Caddy en de vertrouwde healthcheck gebruiken bronadres `127.0.0.2`; wijzig dit niet zonder nieuwe isolatieproeven. De runner heeft uitsluitend digestgebonden sudo voor de vaste `build`/`activate`-helper van zijn eigen doel. Privileged scripts en units zijn root-owned. Eigen journals hebben 30 dagen retentie; gedeelde diensten en instellingen blijven ongewijzigd.

## Een volledige SHA toelaten en bouwen

Een push of PR voert uitsluitend CI uit; deployment is handmatig. Gebruik geen onbeoordeelde PR op de doelrunner.

1. Integreer de geteste wijziging op `main` en neem de **volledige 40-tekens SHA**.
2. Controleer de nieuwste push-CI op precies die SHA: workflow `Castiq local acceptance`, job `verify`, iedere vastgelegde install/config/types/domain/release/server/assets/legal/build/migratie/browserstap moet `completed/success` zijn. Ontbrekend, skipped, lopend, geannuleerd of mislukt wordt geweigerd. De root-owned admission gate controleert repository-ID, main-afstamming, CI-bronhash en actuele workflowpoging opnieuw.
3. Bouw handmatig het gekozen doel:

```sh
gh workflow run castiq-dg-vps-08-staging-build.yml \
  --repo castiqnl/platform --ref main \
  -f environment=staging -f sha=VOLLEDIGE_SHA
# Voor een afzonderlijke productiekandidaat: environment=production.
```

De bestaande bestandsnamen blijven behouden; de workflows heten `Castiq dg-vps-08 candidate` en `Castiq dg-vps-08 activate` en verlangen expliciet het doel. Beide jobs gebruiken het betreffende GitHub environment. De build activeert niets.

De doel-VPS bouwt exact de vrijgegeven SHA in een eigen werkmap, met het eigen buildaccount en de publieke doelconfiguratie. Runtimegeheimen zijn niet beschikbaar voor dit account. De bestaande gedeelde lock `/run/lock/dg-build.lock` en de eigen projectlock voorkomen overlap. Alleen bij exit75 wegens een werkelijk bezette lock volgt één begrensde retry na tien seconden. Verwijder nooit lockbestanden.

Het resultaat staat in `/srv/sites/<site>/candidates/<candidate_id>` en bevat een root-owned artifact plus metadata met SHA, publieke configuratiehash, CI-/workflowrun, doel, runtimeversies en databasecompatibiliteit. Bewaar de uitgeprinte kandidaat-ID. Gezonde bestaande releases, `current`, proxy en services worden door bouwen niet gewijzigd.

## Activatievoorbereiding

Voor activatie moet een beheerder de werkelijke controles hebben uitgevoerd en `/etc/dg-webservices/<site>/activation-readiness.json` root0600 vastleggen met:

```json
{
  "sha": "VOLLEDIGE_SHA",
  "runtime_config_id": "initial-20261122",
  "database_migrated_and_compatible": true,
  "encrypted_backup_restore_verified": true,
  "private_access_verified": true,
  "control_plane_isolation_verified": true
}
```

Dit zijn bewijsvelden, geen vervanging voor tests. Verifieer migratiechecksums met het kandidaatartifact, de beperkte DB-verbinding met TLS/hostnamecontrole, werkelijk versleutelde backup en geïsoleerd herstel, ongeautoriseerde API-weigering, juiste account-/tenantgrenzen en de root-only unitgebonden isolatiemarkering. Een ontbrekend extern e-mailbewijs blijft afzonderlijk open; app-readiness bewijst geen mailaflevering of echte socialpublicatie.

[AUTH-EN-MAIL.md](AUTH-EN-MAIL.md) bevat de afzonderlijke noodzakelijke Auth-URL/OTP/templateconfiguratie. De gebruiker stelt deze zelf in via het Supabase-dashboard; de exports zijn nog niet toegepast of extern geverifieerd. De Castiq Resend API-sleutel ontbreekt nog en wordt later via platformbeheer ingevoerd. Gegevensafhankelijke migraties vereisen vooraf backup en compatibiliteitsbeoordeling. Runtime heeft geen migratierecht; pas de gereviewde SQL via de geautoriseerde Supabase-verbinding toe. Reeds toegepaste SQL-bestanden wijzigen is verboden. Ruwe productiedata worden niet in tests geladen.

De gebruiker heeft stagingactivatie in deze taak geautoriseerd. **Publieke productieactivatie is een afzonderlijke opdracht.** Een productiekandidaat en gecontroleerde inrichting zijn daarvan gescheiden resultaten.

## Handmatige activatie en HTTPS

```sh
gh workflow run castiq-dg-vps-08-staging-activate.yml \
  --repo castiqnl/platform --ref main \
  -f environment=staging -f sha=VOLLEDIGE_SHA \
  -f candidate_id=KANDIDAAT_ID -f runtime_config_id=initial-20261122
```

De roothelper controleert opnieuw SHA/CI, kandidaat-/runtimehash en omgeving. Onder één activatielock maakt hij een onveranderlijk app-/runtimepaar, stopt alleen de eigen worker indien nodig, wisselt alleen de eigen `current`, start de eigen service en controleert health+readiness op precies die SHA. Pas daarna start de eigen worker en wordt het paar gezond gemarkeerd. Een geslaagde activatieprocedure is nog geen externe gebruikersacceptatie.

HTTPS, uitsluitend na gezonde loopbackcontrole:

1. Verifieer A/AAAA en bestemming `204.168.128.28`. Maak geen productieroute actief tijdens staginguitrol.
2. Controleer de eigen voorbereide Caddy-site onder `/etc/dg-webservices/<site>/pending/`. De upstream gebruikt `local_address 127.0.0.2`. Staging krijgt `noindex`.
3. Plaats uitsluitend het eigen sitefragment in `/etc/caddy/sites/`, valideer de gehele bestaande Caddyconfiguratie met `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile` en reload Caddy zonder restart. Behoud bestaande fragmenten en routes.
4. Controleer werkelijk certificaat, redirect HTTP→HTTPS, `/api/health`, `/api/readiness`, SHA, publieke juridische downloads en accountblokkering bij unauthenticated verzoeken.
5. Test OTP, Google-terugkeer, expliciete persoonlijke registratie en de hoofdflow met daarvoor bedoelde accounts. Test beheer afzonderlijk van clubinhoud. Leg ontbrekende menselijke/providerbevestigingen vast; verzin geen ontvangstbewijs.
6. Controleer Fabelpad current, PIDs en bekende health-URLs opnieuw en vergelijk met [het uitgangsbewijs](deploy-evidence/native-host-2026-11-22.json).

Na de eerste geautoriseerde gezonde activatie wordt alleen de eigen omgeving voor een reboot ingeschakeld. Dit is voor staging uitgevoerd; productie blijft disabled:

```sh
sudo -n systemctl enable castiq-vps08-staging.service castiq-vps08-staging-worker.service
systemctl is-active castiq-vps08-staging.service castiq-vps08-staging-worker.service
```

De huidige stagingrelease is `3cf040cf91e0e15c2fa2f7f52d82a48165f004d9-45271236093-1-initial-20261122`. Het [kanaalwizard-uitrolbewijs](deploy-evidence/staging-channel-wizards-2026-11-23.json) toont de nieuwe activatie en dezelfde runtimebronnen als de vorige gezonde combinatie `4c39c3a6cf099ff6655b29cee15c67712bb4c14a-45263874016-1-initial-20261122`. De werkelijke vrijgave, verse backup met geïsoleerd herstel, migraties 001–010 en ongewijzigde Fabelpad-/productiegrenzen staan in [het uitrolbewijs van 23 november](deploy-evidence/staging-release-2026-11-23.json). De bestaande proxyconfiguratie is behouden. Behoud bij een volgende release altijd de dan aangetroffen gezonde stand.

De marketing-/juridische pagina’s zijn publiek; alle persoonlijke en clubgegevens en beheerschermen vereisen server-gecontroleerde identiteit/rechten. De huidige kanaaladapter blijft uitsluitend sandbox. Een enqueue, export, timeout of demo-receipt is nooit een echte openbare post.

## Rollback en mislukte eerste installatie

Bekijk eerst root-only `pair.json` van huidige en vorige gezonde release. Rollback wisselt app én runtime samen, alleen binnen dezelfde vastgelegde databasecompatibiliteit. Een schemawijziging wordt niet teruggedraaid door een symlinkwissel. Beoordeel afwijkende schema’s apart; restore is een gequarantaineerde procedure met replay van de onafhankelijke wisledger vóór vrijgave.

```sh
# Alleen als geautoriseerde hostbeheerder op dg-vps-08.
# Rootcontext zonder de oorspronkelijke SUDO_USER; de runner heeft dit recht niet.
sudo -n env -u SUDO_USER \
  /usr/local/libexec/castiq-vps08-staging/release.py rollback VORIGE_GEZONDE_RELEASE_ID
```

Een gewone `sudo ... release.py rollback` vanuit het `codex`-account houdt `SUDO_USER=codex` en wordt bewust geweigerd. Bovenstaande opdracht vereist afzonderlijk bevoegde beheerdersrechten; zij verleent de runner geen extra rechten. Gebruik voor een later afzonderlijk geautoriseerde productierollback het productiepad.

De helper serialiseert rollback met activatie, controleert beheerde paden, gezondmarkering en compatibiliteit, stopt alleen de eigen worker, wisselt het paar en voert opnieuw health/readiness uit. Bewaar het huidige paar voor onderzoek. Uploads en wisledger worden niet teruggezet of verwijderd.

Bij een mislukte **eerste** activatie zonder vorige gezonde release stopt de helper de nieuwe eigen service/worker en verwijdert uitsluitend de nieuwe `current`-verwijzing. Er is dan geen gezonde applicatie om op terug te vallen. Verwijder geen database of uploads. Als een nieuwe eigen proxyroute al geplaatst was, haal uitsluitend dat fragment uit de import en valideer/reload opnieuw; laat bestaande sites ongemoeid.

Voer geen live rollback uit als test. Offline release-boundarytests dekken beide omgevingen, lockconflicten, fouten tijdens eerste activatie/herstel, schemagrenzen en blijvend behoud van de onafhankelijke ledger. Werkelijke deploymentresultaten en exacte SHA staan in [STATUS.md](STATUS.md).

Sinds de kanaalwizardactivatie wijst `previous` naar de volledig gezonde combinatie `4c39c3a6cf099ff6655b29cee15c67712bb4c14a-45263874016-1-initial-20261122`. Server, database, gedeelde domeinbronnen en dependencybestanden zijn bytegelijk; alleen de kanaalinterface is gewijzigd. De volgende beperking betreft uitsluitend een verdere historische terugkeer naar `f38e8f77963761157315accfb6d96140f0cae9bb-45074332095-1-initial-20261122`. Dertien geïsoleerde controles tonen dat deze oudere code met het uitgebreide schema kan werken. Het behouden compatibiliteitslabel `castiq-schema-v8` dekt die structurele compatibiliteit; oude code maakt geen nieuwe managed template-/pakketsnapshots en kent de nieuwe kanaalintrekkingscontrole niet. Na nieuwe managed activiteit: pauzeer bij een noodterugkeer de worker en beperk clubschrijfacties tot de juiste code is hersteld. Een gewone helperrollback herstart de worker, dus gebruik die dan niet zonder deze aanvullende operationele beperking. Er is geen live rollback als test uitgevoerd. De oorspronkelijke API-only release `7cdb874…` blijft uitgesloten als gezond rollbackdoel.
