# Castiq lokale serverversie

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

De [afzonderlijke browserdemo](http://127.0.0.1:4173/?demo=1#/demo) bewaart alleen op het apparaat. Daar blijven de historische Studio en beheerpanelen beschikbaar. Serverfouten leiden nooit stil terug naar de demo.

## Verificatie

```bash
npm run config:check
npm run check
npm test
npm run test:server
npm run verify:assets
npm run build
npm run test:browser
npm run local:backup
```

Server- en pilottests gebruiken eigen tijdelijke databases op localhost. De werkdatabase blijft behouden. Voor browsertests: `npx playwright install chromium`, of stel `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` in. Resultaten, de 52 acceptatiegevallen en beperkingen staan in [VERIFICATIE.md](docs/VERIFICATIE.md).

## Oplevering en vervolgaansluiting

- [Benodigde projectgegevens, accounts, variabelen en secrets](docs/BENODIGDE-GEGEVENS.md)
- [Projectprofiel](docs/PROJECTPROFIEL.md) en [actuele status](docs/STATUS.md)
- [Runbook met starten, worker, backup en herstel](docs/RUNBOOK.md)
- [Architectuur en servergrenzen](docs/ARCHITECTUUR.md)
- [Oorspronkelijke README](docs/PROTOTYPE-README.md), [validatie](docs/VALIDATION.md) en [stagingdoelspecificatie](docs/STAGING-SPEC.md)

Een externe staging-URL, GitHub-doelrepository, VPS, runners, Supabase-project en officiële kanaalaccounts zijn nog niet geconfigureerd. Productie is ongewijzigd. De OTP/Google-code is voorbereid; echte aanmelding, mailgateway, providerpublicaties, bronimport en externe pilot vragen projectgegevens en aparte verificatie.
