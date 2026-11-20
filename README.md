# Castiq platform

Castiq draait lokaal met behoud van het aangeleverde React/Vite-ontwerp, alle 50 assets en de 27 standaardstijlen. De mobiele inzending, redactie, clubweek, sponsors en weekendoverzichten gebruiken centrale PostgreSQL-opslag. Kanalen gebruiken uitsluitend een expliciete sandbox; er zijn geen externe berichten geplaatst.

## Starten

Benodigd: Node 24.18.0, npm 11.16.0 en Docker.

```bash
npm ci
npm run local:setup
npm run dev
```

Open [de lokale teamomgeving](http://127.0.0.1:4173/#/team/dashboard) of [de clubredactie](http://127.0.0.1:4173/#/club/dashboard) en kies een fictief testaccount. De server bepaalt club en teamrechten. Drie gescheiden fictieve clubs zijn beschikbaar: SC Getijde, FC Havenlicht en SV Noordhaven.

Start in een aparte terminal `npm run worker` om geplande sandboxtaken te verwerken. Een taak blijft onbevestigd totdat een bevoegde redacteur expliciet een sandboxuitkomst vastlegt. Enqueue, export en timeout zijn geen publicatiesucces.

De [afzonderlijke browserdemo](http://127.0.0.1:4173/?demo=1#/demo) bewaart tijdens lokale ontwikkeling alleen op het apparaat. Daar blijven de historische Studio en beheerpanelen beschikbaar. Serverfouten leiden nooit stil terug naar de demo.

## Verificatie

```bash
npm run config:check
npm run check
npm test
npm run test:release
npm run test:server
npm run verify:assets
npm run build
npm run test:browser
npm run local:backup
```

Server- en pilottests gebruiken eigen tijdelijke databases op localhost. De werkdatabase blijft behouden. Voor browsertests: `npx playwright install chromium`, of stel `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` in. Resultaten, de 52 acceptatiegevallen en beperkingen staan in [VERIFICATIE.md](docs/VERIFICATIE.md).

## Oplevering en vervolgaansluiting

- [DG-releaseprocedure: kandidaat, latere activatie en rollback](docs/DG-RELEASE.md)
- [Geverifieerde voorbereiding van dg-vps-08](docs/DG-VPS-08-HOST.md)
- [Benodigde projectgegevens, accounts, variabelen en secrets](docs/BENODIGDE-GEGEVENS.md)
- [Projectprofiel](docs/PROJECTPROFIEL.md) en [actuele status](docs/STATUS.md)
- [Runbook met starten, worker, backup en herstel](docs/RUNBOOK.md)
- [Architectuur en servergrenzen](docs/ARCHITECTUUR.md)
- [Oorspronkelijke README](docs/PROTOTYPE-README.md), [validatie](docs/VALIDATION.md) en [stagingdoelspecificatie](docs/STAGING-SPEC.md)

De broncode staat in [castiqnl/platform](https://github.com/castiqnl/platform), met `main` als integratiebranch. Op 20 november 2026 is het nieuwe stagingdoel op `dg-vps-08` voorbereid met eigen accounts, paden, Node/npm en een geregistreerde repo-eigen runner. De kandidaatbuild en activatie zijn afzonderlijke handmatige routes. App en sandboxwerker zijn inactive; er is geen doelkandidaat, `current`-verwijzing of publieke Castiq-route. Productie is ongewijzigd.

De enige GitHub-variabelen zijn `CASTIQ_APP_ORIGIN`, `CASTIQ_DATA_MODE`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `NEXT_PUBLIC_SUPABASE_URL`; Vite neemt deze expliciet over. Database- en migratiegeheimen blijven in private hostconfiguratie. Het bedoelde Supabase-project, de afgeschermde HTTPS-origin, echte login/mail en externe pilot moeten nog worden aangesloten en geverifieerd. De eerste activatie volgt alleen op een aparte opdracht.
