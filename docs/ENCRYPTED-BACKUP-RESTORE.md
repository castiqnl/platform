# Eigen application-backup en herstelproef

Op 22 november 2026 zijn afzonderlijke versleutelde Castiq-backups gemaakt en daadwerkelijk hersteld:

| Doel | Backup-ID | Hersteld |
|---|---|---|
| staging | `backup-dffb0f81-4f95-4b3e-af64-48c9330be040` | 31 tabellen, 13 rijen, alle counts en inhoudchecksums gelijk |
| production | `backup-e7119dbd-66e0-40ac-9f9f-d29851e2380e` | 31 tabellen, 13 rijen, alle counts en inhoudchecksums gelijk |

Beide doelen hadden nul uploads. AES-256-GCM-authenticatie slaagde en een gewijzigde authenticatietag werd geweigerd zonder plaintextuitvoer of wijziging van de backup. De herstelclusters waren afzonderlijke tijdelijke PostgreSQL17.12-containers zonder netwerk, met alleen tmpfs-opslag, zonder hostmounts en zonder extra Linux-capabilities. Beide zijn na verificatie verwijderd. Er zijn geen plaintext dumpbestanden gemaakt, runtimecredentials of encryptiesleutels naar de development-VPS gekopieerd, of actieve applicaties/current-verwijzingen aangepast.

## Afbakening en opslag

De backup bevat alleen schema `castiq` onder de beperkte eigen serverrole. Vooraf controleert het hulpmiddel dat alle opgenomen tabellen onbeperkte SELECT-dekking voor die role hebben. `pg_dump --enable-row-security` gebruikt dezelfde geëxporteerde repeatable-read-snapshot als de broncounts en inhoudchecksums. Ontbrekende privileges of beperkende RLS-policies stoppen de backup; zij worden niet omzeild met extra apprechten.

Uitsluitend `castiq.account_operation_keys` is binnen dat schema uitgesloten. Dit is control-plane-keyhashstate die bij echt herstel opnieuw wordt geprovisioneerd vanuit de externe root-only `SUPABASE_ACCOUNT_OPERATIONS_KEY` en de bevoegde accountoperations-inrichting. Schema's `auth` en `public`, runtimegeheimen en het onafhankelijke wisregister zijn eveneens uitgesloten. De proef is daarom een application-data restore en bewijst geen volledig herstel van een Supabase-project of Auth-identiteiten.

Per omgeving staan ciphertextbestanden en een root-only manifest onder `/srv/sites/castiq-vps08-<omgeving>/shared/backups/<backup-ID>/`. De eigen willekeurige AES-key staat root-owned met modus `0600` in `/etc/dg-webservices/castiq-vps08-<omgeving>/backup.key`, buiten database en artefacten. Het manifest en alle backupbestanden zijn eveneens root-only. Elke database/uploadfile krijgt een eigen IV, authenticatietag en binding aan site, backup-ID, tijd en logisch bestand. Voor plaintext via SSH wordt vrijgegeven controleert het hulpmiddel eerst de volledige authenticatie en checksum, zonder uitvoer.

De beperkte enige databasewrite door deze procedure is registratie van de eigen backup in `castiq.privacy_backups`. Het manifest legt een vervaldatum van 180 dagen vast; herstel op of na die grens wordt geweigerd. Automatische feitelijke verwijdering, externe kopieën en providerretentie vereisen de afzonderlijke privacy- en providercontroles. De sleutels zijn in deze stap niet buiten de VPS geëscrowd en er is geen offsite-opslag geprovisioneerd.

## Herhalen

Deze route is een beheerdershandeling. Er zijn geen backupprivileges aan runner- of appaccounts verleend. De helper staat op de doelhost in `/usr/local/libexec/castiq-vps08-<omgeving>/backup/staging-backup.mjs`; de historische bestandsnaam werkt voor beide vaste eigen omgevingen. Het hulpmiddel bepaalt de omgeving uitsluitend uit zijn vaste installatiepad.

Voor een consistente eerste backup verlangt `create` dat de eigen app- en workerunits inactief zijn. Het houdt de eigen activatielock vast en voert geen servicehandelingen uit. Een draaiende omgeving vereist eerst een afzonderlijk goedgekeurde onderhoudsprocedure; stop geen diensten vanuit een onbeoordeeld backupcommando.

```bash
# Op dg-vps-08, als beheerder; voorbeeld staging.
sudo /opt/dg-toolchains/castiq-vps08-staging/node-v24.18.0-linux-x64/bin/node \
  /usr/local/libexec/castiq-vps08-staging/backup/staging-backup.mjs \
  create initial-20261122

# Noteer uitsluitend de gerapporteerde backup-ID, geen inhoud of credentials.
sudo /opt/dg-toolchains/castiq-vps08-staging/node-v24.18.0-linux-x64/bin/node \
  /usr/local/libexec/castiq-vps08-staging/backup/staging-backup.mjs \
  verify BACKUP_ID

# Op de development-VPS: alleen een eigen tijdelijke restorecontainer.
python3 -B scripts/verify-staging-backup.py BACKUP_ID --environment staging
```

Gebruik voor production de overeenkomstige eigen paden en `--environment production`. De verificatie leest de private metadata via SSH, maakt alleen niet-inlogbare beleidsrollen in haar verse tijdelijke cluster, herstelt de geauthenticeerde stream en vergelijkt iedere tabel met de snapshotcounts en inhoudchecksums. Daarna schrijft zij root-only `restore-verified.json` bij die backup. Geen herstelstap richt zich op de actieve staging- of productiondatabase.

De export gebruikt de eigen hostbinary `backup/bin/pg_dump`, geverifieerd als `17.11 (Debian 17.11-1.pgdg12+2)`, uit de al aanwezige gepinde Castiq-PostgreSQL-image. De overige eigen tooling gebruikt Node `24.18.0`, de vastgelegde `pg`-dependency `8.23.1` en de officiële Supabase-CA. De geslaagde herstelproef gebruikt afzonderlijk `pg_restore` in de hieronder gepinde PostgreSQL 17.12-container. Alleen eigen root-owned bestanden zijn onder het backupinstallatiepad toegevoegd; geen gedeelde pakketten of configuratie zijn vervangen. TLS gebruikt `verify-full`, met het meegeleverde CA-bestand op een absoluut eigen pad. De restore-image is de officiële Linuxamd64 PostgreSQL17.12-image, digest `sha256:8d174ddfb292f26b6ec8d97f55d944ccab547fa8bfe9e4fd3c24afdc819ee423`.

De oudere lokale PG17.11-server weigerde de nieuwe bronmetadataoptie `pg_attver`. Die versiegrens is beschreven in de [officiële PostgreSQL-backpatch van 9 november 2026](https://www.postgresql.org/message-id/E1xQQG1-000000003jI-2cdw@gemulon.postgresql.org). De uiteindelijke herstelproef gebruikte daarom de expliciet gepinde PG17.12-container; bestaande lokale containers, images en hun verwijzingen bleven ongemoeid.

## Voorwaarden voor werkelijk herstel

Een echte restore blijft in quarantaine totdat het onafhankelijke wisregister is gecontroleerd en relevante blokkades/wisreferenties opnieuw zijn toegepast en onafhankelijk geverifieerd. Het register staat in `shared/privacy-ledger`, buiten database, releases en databasebackups. Bewaar de bijbehorende HMAC-key buiten de database en behoud de bestaande sleutel over code- en configuratierollbacks. Herstel geen oud wisregister over het actuele register heen.

Deze twee geslaagde proeven verifiëren de eigen versleutelde application-backup. De retentie en verwijdering van Supabase-providerbackups zijn nog niet bevestigd. Daardoor mag deze proef de providerretentiecontrole of destructieve privacypurge niet automatisch vrijgeven. Ook de accountoperations-inrichting, Auth, externe mailconfiguratie, zelfstandige ledgercontinuïteit en publieke toegang moeten bij echt herstel afzonderlijk worden gecontroleerd.
