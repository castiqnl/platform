# Castiq: kandidaat, latere activatie en herstel

Dit runbook bereidt de afzonderlijk te autoriseren release naar staging op `dg-vps-08` voor. Er staat nog geen Castiq-kandidaat op die VPS. De app en worker zijn niet gestart, `current` ontbreekt en er is geen publieke Castiq-route. Een geslaagde lokale build bewijst geen doelbuild, Supabase-koppeling of stagingacceptatie.

De geverifieerde hostinrichting, controles vóór/na voorbereiding en actuele runnerstatus staan in [DG-VPS-08-HOST.md](DG-VPS-08-HOST.md). De exacte uiteindelijke broncommit en testresultaten staan in [PROJECTPROFIEL.md](PROJECTPROFIEL.md) en [VERIFICATIE.md](VERIFICATIE.md). Uitgangspunt voor deze voorbereiding was `9061381596cb2c647504461726fceb2148b192fb`. Vul een release-SHA steeds met de later goedgekeurde volledige commit op `main`.

## Vast contract

| Onderdeel | Afspraak en bron |
|---|---|
| Repository | `castiqnl/platform`, privé, repository-ID `1446413160`; geverifieerd via GitHub |
| Integratiebranch | `main`; voorbereiding op `codex/dg-vps-08-staging-preparation` |
| Doel | Nieuwe stagingidentiteit `castiq-staging` op geverifieerde host `dg-vps-08` |
| SSH | `codex@100.65.51.108`, bestaande sleutel en hostkeycontrole; dit is een privé-Tailscale-adres en geen vastgestelde publieke DNS-bestemming |
| Runtime | Eigen root-owned Node `24.18.0` / npm `11.16.0` onder `/opt/castiq/node-v24.18.0-linux-x64` |
| Build/start | `npm ci` met gecommitteerd lockbestand, `npm run build` → `dist/`; productie start Node `server/index.ts` met `STATIC_DIR=dist` |
| Web/API | Eén bestaande Node-server voor statische website en `/api`; uitsluitend `127.0.0.1:4184` |
| Runner | Eigen naam `dg-vps-08-castiq-staging`; labels `self-hosted`, `Linux`, `X64`, `castiq`, `dg-vps-08`, `staging`, `castiq-staging` |
| Rechten | `castiq-runner` vraagt alleen de vaste roothelper aan; `castiq-build` bouwt zonder runtimegeheimen; `castiq-app` leest releases en schrijft uitsluitend eigen uploads |
| Artefacten | `/srv/castiq-staging/candidates/<candidate-id>`; releases `/srv/castiq-staging/releases/<release-id>` |
| Privéconfiguratie | `/etc/castiq-staging/runtime.d/<runtime-id>.json`; afgeleide versiegebonden omgeving onder `/etc/castiq-staging/releases.d/` |
| Services | `castiq-staging.service`, `castiq-staging-worker.service`, eigen runnerunit `castiq-staging-runner.service` |
| Later GitHub environment | `castiq-dg-vps-08-staging`; nog afzonderlijk aanmaken en beschermen vóór gebruik van activatie |

React/Vite blijft behouden. De historische Docker/Caddy-route blijft de expliciete browserdemo. Deze native route voegt de bestaande API, private opslag en worker toe; zij migreert geen bestaande omgeving. Er is op deze nieuwe host geen bestaande `dg-site-deploy`-installatie aangetroffen. De projectspecifieke roothelper volgt de gecontroleerde DG-rechten-, lock- en releaseafspraken.

## Configuratie aanleveren

Gebruik uitsluitend deze vier GitHub **repository variables**, zonder aanvullende repositorysecrets of deployvariabelen:

| Naam | Bron | Gebruik |
|---|---|---|
| `CASTIQ_APP_ORIGIN` | Later geverifieerde afgeschermde stagingorigin, exact `https://hostnaam`, zonder pad of afsluitende slash | Build én runtime |
| `CASTIQ_DATA_MODE` | Vaste waarde `server` voor staging | Build én runtime |
| `NEXT_PUBLIC_SUPABASE_URL` | URL van het bedoelde afzonderlijke Supabase-stagingproject | Build én runtime |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key van datzelfde project, formaat `sb_publishable_…` | Build én runtime; openbaar, nooit service-role/secret key |

Vite neemt dit publieke profiel via een expliciete allowlist over. `NEXT_PUBLIC_*` is hier de afgesproken configuratienaam; het project blijft Vite. Een wijziging van een van de vier waarden vereist een nieuwe kandidaatbuild. De build en runtime moeten exact hetzelfde profiel hebben; de helper bindt dit aan een SHA256-`configId`. Gebruik identieke, ongewijzigde waarden zonder toegevoegde spaties in GitHub en op de host.

De ingebouwde kortlevende `GITHUB_TOKEN` heeft alleen `contents: read` en `actions: read`. De workflows geven die in geheugen/stdin aan de helper door; zij slaat geen token op. Er is geen extra PAT of SSH-secret nodig voor deze releaseworkflows. Runnerregistratie gebruikt een afzonderlijk kortlevend GitHub-registratietoken, buiten broncode en logs.

De beheerder maakt later als root een **nieuw** versiegebonden bestand `/etc/castiq-staging/runtime.d/<runtime-id>.json`, eigenaar `root:root`, modus `0600`, zonder symlinks of hardlinks. Het bevat precies de vier publieke namen en `DATABASE_URL`:

```json
{
  "CASTIQ_APP_ORIGIN": "<exact dezelfde stagingorigin als GitHub>",
  "CASTIQ_DATA_MODE": "server",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "<publishable key van het stagingproject>",
  "NEXT_PUBLIC_SUPABASE_URL": "<URL van hetzelfde stagingproject>",
  "DATABASE_URL": "<private stagingverbinding met beperkte runtime-databaserol>"
}
```

Dit is een schema met placeholders, geen geldige doelconfiguratie. Bewerk een nieuwe versie via een beveiligde editor; zet databasewachtwoorden niet in opdrachten, shellgeschiedenis, workflowoutputs of chat. Bestaande versies blijven behouden. Kies korte herkenbare IDs, bijvoorbeeld `cfg-20261120-01`; alleen letters, cijfers, `_` en `-` zijn toegestaan en de volledige release-ID mag maximaal 96 tekens zijn.

De helper legt `APP_ENV=staging`, `AUTH_MODE=supabase`, loopbackbinding, poort, uploadpad, `STATIC_DIR`, volledige `RELEASE_SHA` en `PUBLICATION_MODE=sandbox` vast. Deze namen worden geen extra GitHub-variabelen. Publicatie blijft uitsluitend sandbox: een request of enqueue is nooit extern kanaalbewijs.

## Nog te voltooien voorwaarden

1. Koppel de workspace en het bedoelde Supabase-stagingproject. Richt Auth met expliciete testgebruikers, de exacte origin/redirects en de benodigde mailvoorziening in. Wijs club-/teamrechten in de serverdatabase toe; vertrouw geen door gebruikers wijzigbare metadata. Google-login vraagt afzonderlijke providerconfiguratie en acceptatie en wordt niet als werkend verondersteld.
2. Lever de vier publieke waarden aan en een private `DATABASE_URL` met een beperkte runtimegebruiker. Geef migraties een afzonderlijke bevoegde verbinding. Controleer database-TLS, netwerktoegang en de benodigde rechten. Het private schema `castiq` wordt niet als openbare Supabase Data API aangeboden.
3. De negatieve netwerkprobes voor runner en build zijn uitgevoerd en root-only vastgelegd in `/etc/castiq-staging/control-plane-isolation.verified`. App- en workerisolatie zijn eveneens met tijdelijke vertrouwde probes bewezen. Het root-only bewijs bindt de geïnstalleerde unit-hashes. De eigen proxy en healthcheck gebruiken bronadres `127.0.0.2`; adminverkeer naar `127.0.0.1`, IPv6 en gemapte varianten blijft geblokkeerd. Bij wijzigingen moet dit bewijs opnieuw worden gecontroleerd.
4. Maak later het eigen GitHub environment `castiq-dg-vps-08-staging` aan met de passende vereiste reviewers en uitsluitend `main` als deploymentbranch. Laat bestaande environments ongemoeid. De kandidaatworkflow gebruikt dit environment niet; activatie wacht er wel op. Start de activatieworkflow pas nadat de bescherming daadwerkelijk bestaat.
5. Bevestig de domeinnaam, feitelijke DNS-bestemming, stagingafscherming en de beheerde backup-/restorevoorziening. Er is nog geen publieke URL of DNS-record vastgesteld.

## Broncode en vereiste CI vrijgeven

Review en merge deze voorbereiding later naar `main`. Pushes en PR's draaien uitsluitend de bestaande CI; beide nieuwe routes zijn alleen handmatig te starten. Onbeoordeelde PR's draaien niet op de doelrunner. Leg voor iedere release de volledige SHA, CI-run, publieke `configId`, buildrun en kandidaat-ID vast.

De admissioncontrole draait eerst op een GitHub-hosted runner en opnieuw in de root-owned hosthelper. Zij vereist:

- `workflow_dispatch` vanaf `refs/heads/main`, de juiste repository-ID en de huidige handmatige run/poging;
- een volledige SHA van 40 kleine hextekens die aantoonbaar op `main` ligt;
- exact CI-workflow-ID `407607093`, naam `Castiq local acceptance`, pad `.github/workflows/ci.yml` en de beoordeelde bronhash uit `scripts/release-gate.mjs`;
- de nieuwste `push`-CI-run op `main` voor die exacte SHA, huidige poging, job `verify` en alle vereiste install/config/type/domain/release/server/assets/build/migratie/browserstappen daadwerkelijk `completed/success`;
- een opgeslagen GitHub-runnaam `Castiq staging build <SHA>` of `Castiq staging activate <SHA>`, zodat een runner geen andere input-SHA kan indienen.

Ontbrekende, geskipte, lopende, geannuleerde of mislukte vereiste controles blokkeren. Een oudere groene run of een gelijknamige PR-/andere workflow voldoet niet. Een wijziging van CI vereist expliciete review, bijwerken van de vastgelegde bronhash en gecontroleerd bijwerken van de root-owned policy op de host. Kopieer nooit automatisch uitvoerbare releasepolicy uit een te bouwen kandidaat.

Vanuit een geverifieerde checkout, na bewuste keuze van de releasecommit:

```bash
SHA='VOLLEDIGE_GOEDGEKEURDE_SHA_40_KLEINE_HEXTEKENS'
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || exit 1
gh run list --repo castiqnl/platform --workflow ci.yml --branch main --commit "$SHA"
```

De placeholders in dit runbook moeten vooraf worden ingevuld. Gebruik geen verkorte SHA, tag of branchnaam als release-input.

## Alleen een kandidaat bouwen

Deze opdracht activeert niets:

```bash
gh workflow run castiq-dg-vps-08-staging-build.yml \
  --repo castiqnl/platform --ref main --field sha="$SHA"
gh run list --repo castiqnl/platform \
  --workflow castiq-dg-vps-08-staging-build.yml --branch main --limit 5
gh run watch BUILD_RUN_ID --repo castiqnl/platform --exit-status
```

Controleer de runnaam en noteer de werkelijk door de helper afgedrukte `candidateId`. Het formaat is `<eerste-12-SHA>-<buildrun-ID>-<poging>`. De roothelper downloadt de bron rechtstreeks van GitHub voor de exacte SHA; runner-owned checkouts of Gitconfiguratie zijn geen bron voor de build.

De doelbuild houdt `/run/lock/dg-build.lock` exclusief vast en gebruikt een eigen tijdelijke map onder `/var/lib/castiq-build/work`. De buildaccount krijgt alleen de vier publieke waarden en een eigen tijdelijk HOME. De route voert de bouwconfiguratiecontrole uit, `npm ci --ignore-scripts`, `npm run check`, `npm test`, `npm run verify:assets`, `npm run build` en `npm prune --omit=dev --ignore-scripts`. De uitgebreide database-/browser-/releasetests zijn al verplicht op exact dezelfde SHA in CI; de doelbuild raakt geen database aan en voert geen migraties of seeding uit.

De helper vereist ten minste 6 GiB vrije ruimte en 100.000 vrije inodes. Bij een bewezen bezette gedeelde buildlock volgt maximaal één nieuwe poging na tien seconden; verwijder geen lockbestand. Een ander probleem vraagt onderzoek. De kandidaat bevat `dist`, de server- en domeinbron, migraties, productieafhankelijkheden, toolchainmetadata en `release.json`. Na controle zijn bestanden root-owned en uitsluitend leesbaar/uitvoerbaar voor de appgroep. `current`, services, proxy en bestaande releases blijven onaangeroerd.

Controleer later via SSH uitsluitend niet-geheime metadata:

```bash
ssh -i ~/.ssh/dg_vps_08_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes codex@100.65.51.108
sudo cat /srv/castiq-staging/candidates/CANDIDATE_ID/release.json
sudo test ! -e /srv/castiq-staging/current
systemctl is-active castiq-staging.service castiq-staging-worker.service
```

De laatste twee controles horen bij deze eerste voorbereiding nog afwezig respectievelijk `inactive` te tonen. Bij een bestaande latere stagingomgeving vergelijk je de aangetroffen huidige release en health vóór/na de kandidaatbuild; die blijven gelijk.

## Migraties, backups en root-readiness

Migraties zijn een afzonderlijke beheerdersstap, nooit een build- of activatiebijwerking. Inspecteer de SQL van de kandidaat, vergelijk de geregistreerde migratiechecksums, leg de voorwaartse en terugwaartse appcompatibiliteit vast en maak vooraf een goedgekeurde versleutelde backup van database **én** uploads. Bewijs herstel in een eigen geïsoleerde restoreomgeving. Bestaande data wordt niet gereset; reeds toegepaste SQL-bestanden worden niet gewijzigd.

Na aparte vrijgave van de databasehandeling kan een beheerder op de host de gecommitteerde migratieroute draaien met een root-only bestand dat alleen de afzonderlijke migratieverbinding bevat. Het pad hieronder moet eerst werkelijk en veilig zijn ingericht:

```bash
sudo /opt/castiq/node-v24.18.0-linux-x64/bin/node \
  --env-file=/ROOT_ONLY_PAD/NAAR/MIGRATIE.env \
  /srv/castiq-staging/candidates/CANDIDATE_ID/database/migrate.ts
```

Gebruik hiervoor geen runtimecredential met ruimere rechten en geen credentials van een andere omgeving. Voer `db:seed` niet op staging uit: die route is bewust beperkt tot lokale fictieve accounts. Het veilig aanmaken/toewijzen van echte stagingclubs en memberships vereist nog een beoordeelde provisioningstap.

Pas na aantoonbare controles maakt/beheert root `/etc/castiq-staging/activation-readiness.json`, `root:root`, `0600`:

```json
{
  "sha": "<volledige goedgekeurde kandidaat-SHA>",
  "runtime_config_id": "<het nieuwe runtime-id>",
  "database_migrated_and_compatible": false,
  "encrypted_backup_restore_verified": false,
  "private_access_verified": false,
  "control_plane_isolation_verified": false
}
```

De vier booleans mogen pas `true` worden met bijbehorend werkelijk bewijs voor deze SHA en runtimeversie. Dit bestand is een expliciete rootgoedkeuring, geen vervanging van de controles. Supabasegegevens, backup-/restoreacceptatie en stagingafscherming ontbreken nog. De hostisolatie is afzonderlijk bewezen; hiermee is de applicatie nog niet geaccepteerd.

## Latere activering: aparte opdracht vereist

Start deze stappen nu niet. Ze vormen samen de later vrij te geven eerste installatie, inclusief de toegang via HTTPS.

1. Leg de huidige services, `current`/`previous`, bestaande proxyconfiguratie en health vast. Controleer runtimeprofiel, readiness, diskruimte, kandidaatmetadata en versiegebonden databasecompatibiliteit. Valideer de eigen geïnstalleerde units:

   ```bash
   sudo systemd-analyze verify /etc/systemd/system/castiq-staging.service \
     /etc/systemd/system/castiq-staging-worker.service
   ```

2. Geef uitsluitend de bedoelde kandidaat en runtimeversie vrij via het beschermde environment:

   ```bash
   gh workflow run castiq-dg-vps-08-staging-activate.yml \
     --repo castiqnl/platform --ref main \
     --field sha="$SHA" --field candidate_id=CANDIDATE_ID \
     --field runtime_config_id=RUNTIME_CONFIG_ID
   gh run list --repo castiqnl/platform \
     --workflow castiq-dg-vps-08-staging-activate.yml --branch main --limit 5
   gh run watch ACTIVATION_RUN_ID --repo castiqnl/platform --exit-status
   ```

   De helper maakt een nieuwe release met zijn eigen root-only runtimebestand. Onder een exclusieve activatielock wisselt zij `current`, herstart de app en bevestigt de geselecteerde SHA via een root-controlled loopbackhealthcheck. Een reeds actieve worker wordt samen met die combinatie gestopt/herstart; een nog inactieve worker wordt niet voor het eerst gestart. De vorige gezonde app/config-pair blijft als `previous` beschikbaar.

3. Controleer vanuit de beheeromgeving `systemctl is-active castiq-staging.service`, de gekozen `current` en `http://127.0.0.1:4184/api/health`. Verwacht `status=ok`, juiste `commit`, `authMode=supabase` en `publicationMode=sandbox-only`. Dit bewijst databasebereikbaarheid en de gekozen servermodus; het bewijst nog geen daadwerkelijke Supabase-login, DNS, TLS of publieke gereedheid.

4. Maak uit `/etc/castiq-staging/pending/Caddyfile.pending` een **nieuw eigen** fragment met de geverifieerde hostname en de gekozen afscherming. De placeholder is alleen parsebaar voorbereidingsmateriaal; zij is geen toegestane domeinnaam of toegangsbescherming. Controleer A én AAAA tegen de werkelijk geverifieerde bestemming, certificaatvoorwaarden en toegang voor uitsluitend de bedoelde gebruikers. Gebruik het Tailscale-adres niet als verondersteld publiek DNS-record.

5. Valideer eerst het eigen fragment en daarna een root-only reviewkopie van de volledige actuele Caddyconfiguratie met dat nieuwe fragment inbegrepen:

   ```bash
   sudo caddy validate --config /etc/castiq-staging/pending/castiq-staging.caddy --adapter caddyfile
   sudo caddy validate --config /etc/castiq-staging/pending/Caddyfile.review --adapter caddyfile
   ```

   Controleer dat `/etc/caddy/sites/castiq-staging.caddy` nog niet bestaat. Installeer daarna alleen het nieuwe eigen fragment, valideer de volledige actieve configuratie opnieuw en reload uitsluitend na succesvolle validatie:

   ```bash
   sudo test ! -e /etc/caddy/sites/castiq-staging.caddy || exit 1
   sudo test ! -L /etc/caddy/sites/castiq-staging.caddy || exit 1
   sudo install -o root -g root -m 0644 \
     /etc/castiq-staging/pending/castiq-staging.caddy /etc/caddy/sites/castiq-staging.caddy
   sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
   sudo systemctl reload caddy
   ```

   Vervang geen bestaand fragment. Bij mislukte validatie vóór reload verwijder je uitsluitend het zojuist zelf toegevoegde fragment en controleer je de oorspronkelijke configuratie opnieuw. Bestaande routes en verkeer blijven behouden.

6. Bevestig vanaf de bedoelde toegang de HTTPS-certificaatketen/hostname, afscherming, website/assets en `/api/health` met de juiste SHA. Controleer dat onbevoegde toegang werkelijk wordt geweigerd. Voer een echte Supabase-aanmelding, sessieverversing en afmelding uit. Controleer daarna veilige upload, opslag/herstel op twee apparaten, drie gescheiden testclubs, de juiste club-/teamrollen en de volledige concept → revisie → feedback → goedkeuring → **sandbox**-publicatieroute uit de acceptatiematrix. O10, privacyvoorkeuren, scorecorrecties en ingetrokken samengestelde versies blijven onderdeel van acceptatie. Er is geen afzonderlijk `/ready`-endpoint; deze gebruikers- en infrastructuurcontroles leveren de aanvullende readinessbewijzen.

Bewaar de feitelijke uitkomsten en niet-geheime bewijsidentificaties bij de release. `healthy.json` vermeldt bewust alleen `loopback-health` en `publicAcceptance: false`; claim geen publieke acceptatie of kanaalpublicatie op basis daarvan. De worker voor het eerst starten/inschakelen en services voor boot enablen vallen onder die latere expliciete operationele opdracht.

## Mislukte installatie en rollback

Buildfouten wijzigen geen releaseverwijzing. Bij een activatiefout herstelt de helper de vorige gezonde app/config-pair en de voorafgaande workerstatus, met een nieuwe healthcheck. Bij een mislukte eerste installatie stopt zij de eigen app en verwijdert uitsluitend de zelf geplaatste `current`-verwijzing; er is dan nog geen vorige release. Zij laat kandidaatgegevens, runtimeversies, uploads, database en auditbewijs behouden. Inspecteer een gedeeltelijke eigen release en de gesanitiseerde service-/workflowuitvoer voordat een nieuwe poging met een nieuw beoordeeld runtime-ID wordt gedaan; verwijder geen bestaande data om een fout te verbergen.

Een rollback is een afzonderlijke rootbeheerdershandeling en ontbreekt bewust in runner-sudo. Bevestig eerst databasecompatibiliteit, backup-/herstelstatus en dat de aangewezen combinatie werkelijk de geregistreerde vorige gezonde pair is:

```bash
sudo readlink -f /srv/castiq-staging/current
sudo readlink -f /srv/castiq-staging/previous
sudo /usr/local/libexec/castiq-staging-release rollback VORIGE_RELEASE_ID
systemctl is-active castiq-staging.service
```

De helper serialiseert rollback met dezelfde activatielock, wisselt code én runtimeconfiguratie samen, controleert loopbackhealth en bewaart de verlaten gezonde combinatie als `previous`. Zij herstelt de voorafgaande combinatie bij een mislukte herstelpoging. Controleer daarna ook afgeschermde HTTPS-health, login en de belangrijkste gebruikersflow; leg de werkelijk actieve SHA vast.

Rollback wijzigt geen database, uploads, DNS, proxy, extern bericht of onzekere provideruitkomst. Een onverenigbare databasemigratie vereist een apart goedgekeurd herstelplan en getest backupherstel; activeer niet blind oudere code. Bewaar alle receipts, versies en audit. Alleen een eigen nieuw proxyfragment wordt bij een daarvoor vrijgegeven eerste-installatieherstel verwijderd; draai daarvoor geen gedeelde Caddyconfiguratie of bestaande site terug.

`/api/readiness` controleert toegepaste migratiechecksums, lees-/schrijftoegang tot de uploadmap en aanwezigheid van de frontend. De runtimegebruiker moet `castiq.migration_history` kunnen lezen. Deze controle bewijst geen echte Supabase-aanmelding, gebruikersflow, backupherstel of externe kanaalpublicatie. Controleer health én readiness met bronadres `127.0.0.2` en dezelfde volledige SHA; dit is ook vereist door de vertrouwde activatiehelper.
