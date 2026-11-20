# Castiq: voorbereiding op dg-vps-08

Gecontroleerd op 20 november 2026. Dit beschrijft uitgevoerde hostvoorbereiding en afzonderlijk de nog niet uitgevoerde ingebruikname. De applicatie en publicatiewerker zijn niet gestart; er bestaat geen `current`-verwijzing, doelkandidaat of publieke Castiq-route.

## Identiteit en bestaande inrichting

De opgegeven VPS is via de beschikbare SSH-sleutel en bestaande hostkeycontrole bereikt. De ontvangen hostname is `dg-vps-08`; de Tailscale-bestemming komt overeen met die host. De hostbinding voor de voorbereidings- en releasehulpmiddelen is SHA256 van `/etc/machine-id`: `4c306aaa5338d05ce10f127bea80dafaf7e62b1500be34cdff3b5ddd617e7bd7`. Gebruik een gewijzigde of andere hostbinding nooit zonder nieuwe inventarisatie.

De host draait Ubuntu 24.04.5 LTS op x86_64, heeft acht CPU's en 15 GiB RAM. Voor de voorbereiding was ongeveer 286 GiB schijfruimte en waren 19,7 miljoen inodes vrij. `/srv` en `/opt` waren leeg; er waren geen appservices, runners, Node/npm of gedeelde DG-buildlock. Er is daarom geen bestaande deployment overgenomen. Het bestaande DG-contract uit andere projecten is uitsluitend als referentie gebruikt voor gescheiden accounts, een gedeelde buildlock, root-owned releasehulpmiddelen en systemd.

De aangetroffen Caddy draait een standaardantwoord op poort 80 en importeert `/etc/caddy/sites/*.caddy`. Die importmap was en blijft leeg. Het beheerendpoint luistert op `127.0.0.1:2019`. SSH, Tailscale, DNS-resolutie, firewall, pakketbeheer en bestaande beheerdersrechten zijn niet gewijzigd.

## Toegevoegd voor dit doel

| Onderdeel | Vastgelegd |
|---|---|
| Project / doel | `castiq-staging` op `dg-vps-08` |
| GitHub environment voor latere activatie | `castiq-dg-vps-08-staging` (niet door hostvoorbereiding aangemaakt) |
| Eigen app-, build- en runneraccount | `castiq-app`, `castiq-build`, `castiq-runner` |
| Releasepaden, root-owned | `/srv/castiq-staging/candidates`, `/srv/castiq-staging/releases` |
| Eigen activatielockmap, root-only | `/srv/castiq-staging/locks` |
| Privéconfiguratie en releasebindingen, root-only | `/etc/castiq-staging/runtime.d`, `/etc/castiq-staging/releases.d` |
| Uploads, alleen app schrijfbaar | `/srv/castiq-staging/shared/uploads` |
| Buildwerk en npm-cache, alleen buildaccount | `/var/lib/castiq-build/work`, `/var/lib/castiq-build/npm-cache` |
| Runnerpad, alleen eigen runneraccount | `/var/lib/castiq-runner/actions-runner` |
| Gereserveerde runnerlabels | `self-hosted`, `Linux`, `X64`, `castiq`, `dg-vps-08`, `staging`, `castiq-staging` |
| Web/API-poort | `127.0.0.1:4184`, tijdens inventarisatie en na voorbereiding vrij |
| Appservice | `castiq-staging.service`, geïnstalleerd, disabled/inactive |
| Sandboxwerker | `castiq-staging-worker.service`, geïnstalleerd, disabled/inactive |
| Runnerunit | `castiq-staging-runner.service`, eigen geregistreerde repositoryrunner ID `21`, active; unit disabled voor boot |
| Inactieve proxyvoorbereiding | `/etc/castiq-staging/pending/Caddyfile.pending`, buiten de importmap |

De drie accounts hebben afzonderlijke UID's en geen interactieve login. De buildaccount kan de runtimeconfiguratiemap niet lezen; runner en app kunnen respectievelijk serviceconfiguratie en releases niet schrijven. Er zijn bij de bootstrap geen sudo-rechten aan deze accounts verleend. Een later geïnstalleerde, vaste releasehelper vereist een eigen beperkte sudo-regel; een algemene shell of `sudo ALL` hoort daar niet bij.

Er was geen bestaande gedeelde buildlock. De voorbereiding heeft daarom de eerste DG-buildlock op deze nieuwe host toegevoegd: `/run/lock/dg-build.lock`, `root:dg-build`, modus `0660`. Alleen de eigen buildaccount is aan de nieuwe groep toegevoegd. `/etc/tmpfiles.d/castiq-staging-build-lock.conf` herstelt het lockbestand na reboot. De latere buildroute moet deze lock gedurende de volledige build inclusief het opruimen van eigen subprocessen vasthouden; verwijder nooit de lock om een conflict te omzeilen.

De eigen root-owned toolchain staat op `/opt/castiq/node-v24.18.0-linux-x64`: Node `24.18.0`, npm `11.16.0`. De officiële archive `node-v24.18.0-linux-x64.tar.xz` is vóór extractie gecontroleerd tegen SHA256 `55aa7153f9d88f28d765fcdad5ae6945b5c0f98a36881703817e4c450fa76742` uit `https://nodejs.org/dist/v24.18.0/SHASUMS256.txt`. Er zijn geen systeemwijde Node-installatie, symlinks of pakketten vervangen.

De officiële GitHub Actions-runner `2.338.2` is in uitsluitend het eigen runnerpad uitgepakt na SHA256-controle (`baebf204307bac6193480852732f0aba2ae97b6c5597c244f4d5558390147c40`). `Runner.Listener --version` slaagde onder de eigen runner-UID; er zijn geen gedeelde dependency-installaties uitgevoerd. Vervolgens is uitsluitend deze nieuwe repositoryrunner geregistreerd (ID `21`) en via de eigen unit gestart. Dat is geen appactivatie of geslaagde kandidaatbuild. De lege oorspronkelijke map `/etc/castiq-staging/runtime` is behouden; `runtime.d` is het configuratiepad van de releasehelper.

## Uitgevoerde verificatie

`deploy/dg-vps-08/bootstrap-host.sh --install` is na controle als root uitgevoerd vanuit een root-only provisionmap. Herhaalde uitvoering slaagde zonder bestaande inhoud te vervangen. `bash -n` en `shellcheck` slaagden lokaal. `systemd-analyze verify` op alle drie units slaagde op de doelhost. De pending Caddy-template kon zonder activatie met `caddy adapt` worden geparseerd; er is geen reload uitgevoerd.

De toestand van het bestaande doel vóór en na de voorbereiding:

| Controle | Voor | Na |
|---|---|---|
| Caddy | active/running, PID `4564` | active/running, dezelfde PID |
| Caddy actief sinds | `2026-11-20 18:03:07 CET` | ongewijzigd |
| SHA256 `/etc/caddy/Caddyfile` | `3acfe7107fb2f3ec21e3c0292daf2725be21b79c707a41394c848b1ee3aeefab` | identiek |
| SHA256 `/etc/caddy/Caddyfile.initial` | `66177d46fa761acb07208065db9b0274cb1b12c02ac43b9bfc9857b698b1ccfe` | identiek |
| Default HTTP `http://127.0.0.1/` | `200` | `200` |
| Geïmporteerde sitefragmenten | `0` | `0` |
| Poort `4184` | vrij | vrij |
| Castiq `current` | afwezig | afwezig |

De bestaande listeners op 22, 53, 80, 2019 en de Tailscale-adressen zijn behouden. Er waren geen bestaande apps, releases, databases of runners om over te zetten. De negatieve rechtencontroles bevestigen dat build de runtimeconfiguratie niet leest, de runner de appunit niet schrijft en app geen releases schrijft. Alle drie eigen accounts konden geen algemene sudo-opdracht uitvoeren.

## Grenzen voor de latere ingebruikname

De appunit leest `.runtime.env` via systemd uit dezelfde `current`-release als de code; de rootbeheerder leest dit bestand vóór de UID-wissel. Het runtimebestand zelf blijft root-only. App en worker gebruiken dezelfde release/configuratiecombinatie. De beperkte schrijfmap is de eigen uploadmap. Runtimeconfiguratie, kandidaatintegriteit, CI, branchbereikbaarheid, databasecompatibiliteit en de verplichte locks worden door de releaseprocedure gecontroleerd; de bootstrap activeert niets.

Er is nog geen hostname of DNS-bestemming voor Castiq bevestigd. De pending Caddy-template bevat bewust geen bruikbaar domein en staat buiten de actieve importmap. De latere eerste release vereist ook afscherming van staging, controle van HTTPS/DNS/certificaat, loopback- en publieke health/readiness en een echte Supabase-login. Appstart of een lokale HTTP200 is geen bewijs van deze stappen.

Het bestaande Caddy-beheerendpoint is standaard via loopback bereikbaar voor lokale accounts. Alleen bestandsrechten voorkomen toegang tot dit TCP-endpoint niet. De eigen runnerunit en de tijdelijke buildunit gebruiken daarom systemd-cgroup-netwerkbeleid dat `127.0.0.1/32`, `::1/128` en `::ffff:127.0.0.1/128` weigert. Dit wijzigt geen gedeelde firewall- of Caddy-instelling. Eigen roothelpers erven die beperking; een latere loopbackhealthcheck moet via een afzonderlijke vertrouwde controle worden uitgevoerd.

De controle is werkelijk uitgevoerd met het root-owned hulpmiddel `/usr/local/libexec/castiq-network-isolation-probe.py`. De onbeperkte baseline kon het Caddy-beheerendpoint via IPv4, het overeenkomstige IPv6-mapped adres en `0.0.0.0` bereiken. Voor `::1` bestond geen listener en volgde direct connection-refused. Onder zowel de eigen runner-UID als de build-UID met het voorbereide systemd-netwerkbeleid werden alle vier verbindingen uitgefilterd tot de begrensde timeout. In beide beperkte units bleef externe HTTPS naar `api.github.com` beschikbaar. Daarmee zijn DNS, noodzakelijke externe verbindingen en de negatieve TCP-probes apart gecontroleerd; alleen een ontbrekende listener is niet als isolatiebewijs gebruikt.

De eigen app- en workerunit gebruiken hetzelfde netwerkbeleid. Een tijdelijke vertrouwde miniserver heeft dit onder de app-UID op de eigen poort `4184` getest, zonder applicatiecode, runtimeconfiguratie of database. Inkomend verkeer vanaf `127.0.0.2` kreeg HTTP200; verkeer vanaf `127.0.0.1` werd uitgefilterd. Uitgaand verkeer naar alle vier beheeradressen werd eveneens uitgefilterd, terwijl externe HTTPS beschikbaar bleef. De tijdelijke unit is daarna gestopt en de poort is weer vrij. De werkelijke app- en workerunits zijn niet gestart.

De pending eigen Caddy-route bindt upstreamverbindingen daarom expliciet aan `127.0.0.2`. De optie `transport http { local_address 127.0.0.2 }` is gecontroleerd in de [officiële Caddy2.11.9-bron](https://github.com/caddyserver/caddy/blob/v2.11.9/modules/caddyhttp/reverseproxy/caddyfile.go#L1367) en door de aanwezige Caddy-binary succesvol geparseerd. Het gaat om een nieuwe eigen siteconfiguratie buiten de importmap; er is geen gedeelde proxyconfiguratie veranderd of herladen. Latere loopbackhealthchecks moeten dezelfde bron gebruiken, bijvoorbeeld `curl --fail --interface 127.0.0.2 http://127.0.0.1:4184/api/health`. Een healthcheck vanuit de beperkte runner vereist een aparte vertrouwde controle buiten diens cgroup; de releasehelper verzorgt die grens.

Na deze probes is `/etc/castiq-staging/control-plane-isolation.verified` root-owned met modus `0600` aangemaakt en aangevuld. Het bevat `build_and_runner_isolated: true`, `app_isolated: true`, datum, unit-/probehashes, de bronbinding voor de pending proxy en de niet-geheime testresultaten. Deze verklaring betreft de geteste cgroup-inrichting en beveiligt geen willekeurige interactieve sessies onder die accounts. De runner blijft binnen de eigen systemd-unit; builds draaien uitsluitend onder de overeenkomstig beperkte tijdelijke buildunit. Een gewijzigde unit/policy vereist nieuwe verificatie en bijgewerkte bewijsbinding.

De huidige voorbereiding draait geen Castiq-projectcode op de doelhost. De bewezen netwerkisolatie is geen toestemming voor een eerste appstart: de juiste runtimeconfiguratie, database/migraties, herstelproef, private stagingtoegang en publieke HTTPS-verificatie ontbreken nog. Er is geen activation-readinessverklaring aangemaakt. Kandidaten bouwen kan pas wanneer naast het netwerkbeleid ook SHA/CI en het correcte publieke profiel beschikbaar zijn.

Er zijn nog geen doelruntimegeheimen, databaseverbinding of Supabase-projectgegevens geplaatst. De vier toegestane GitHub-variabelen leveren uitsluitend het publieke bouwprofiel. Servergeheimen horen in versiegebonden root-only hostconfiguratie, buiten broncode, artefacten, procesargumenten en buildaccount. Migraties en een restoreproef worden later afzonderlijk voorbereid tegen de bedoelde stagingdatabase; er is op deze host geen database aangemaakt of gemigreerd.

## Herhaalbare voorbereiding

Inspecteer de scripts en bindende hostidentiteit eerst. Kopieer uitsluitend `deploy/dg-vps-08/` naar een eigen root-owned provisionmap; voer daar als beheerder uit:

```bash
bash -n bootstrap-host.sh
sudo bash bootstrap-host.sh --install
sudo systemd-analyze verify /etc/systemd/system/castiq-staging.service /etc/systemd/system/castiq-staging-worker.service
systemctl is-active castiq-staging.service castiq-staging-worker.service
systemctl is-enabled castiq-staging.service castiq-staging-worker.service
```

De laatste twee controles horen voor app en worker tijdens voorbereiding `inactive` en `disabled` te tonen. De geregistreerde eigen runner draait inmiddels afzonderlijk. Voer de bootstrap niet opnieuw uit op deze actieve runner of op een bestaande actieve Castiq-omgeving: de voorbereiding weigert een `current`-verwijzing of actieve eigen units voordat zij iets wijzigt. De exacte handmatige build-, activatie-, verificatie- en rollbackroute staat in het bijbehorende releaserunbook. Deze hostvoorbereiding geeft geen toestemming om die activatie uit te voeren.
