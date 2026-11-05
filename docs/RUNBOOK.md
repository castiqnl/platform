# Castiq lokaal starten en herstellen

Deze werkwijze start de Castiq-serverflow op het eigen apparaat met fictieve pilotgegevens. De premium website en de afzonderlijke browserdemo blijven beschikbaar. Er is geen externe staginghost geconfigureerd.

## Eerste keer starten

Gebruik Node 24.18.0 en npm 11.16.0 zoals vastgelegd in `.nvmrc` en `package.json`. Docker moet beschikbaar zijn. Vanuit de projectmap:

```bash
npm ci
npm run local:setup
npm run dev
```

Open `http://127.0.0.1:4173/#/team/dashboard` en kies een fictief teamaccount, of `#/club/dashboard` voor de clubredactie. Accounts zijn server-side gebonden aan één club en eventueel één team. Afmelden en opnieuw kiezen is de lokale testaanmelding; de accountkeuze staat uitsluitend op de lokale server aan.

Start voor geplande sandboxtaken in een tweede terminal `npm run worker`. De worker claimt duurzame taken en wacht vervolgens op een expliciete sandboxbevestiging. Hij plaatst niets op externe kanalen en maakt geen automatische succesreceipts. Een herstart reconcilieert dezelfde aanvraag; onbekende uitkomsten worden niet blind opnieuw verzonden.

`local:setup` maakt uitsluitend ontbrekende lokale configuratie aan, start de eigen PostgreSQL-container en voert migraties en idempotente fixture-seeding uit. Bestaande gegevens en wachtwoorden worden behouden. De lokale database is bereikbaar op `127.0.0.1:55439`, de API op `127.0.0.1:4174`. De websiteproxy voert API-verzoeken op dezelfde origin af. Gebruik steeds `127.0.0.1`, overeenkomstig `APP_ORIGIN`.

Als een gedeelde developmenthost geen bestandwatchers meer beschikbaar heeft (`EMFILE`), start dan met `CHOKIDAR_USEPOLLING=1 npm run dev`. Deze lokale fallback is gecontroleerd en verandert geen systeemlimieten of andere projecten.

De historische browserdemo is apart te openen via `http://127.0.0.1:4173/?demo=1#/demo`. Die bewaart op het apparaat en heeft herkenbare demorolwissels. Serverfouten leiden nooit automatisch naar die demo.

## Controles

```bash
npm run check
npm run config:check
npm test
npm run test:server
npm run verify:assets
npm run build
npm run test:browser
```

Server- en pilottests maken ieder een eigen tijdelijke database op de lokale PostgreSQL-server. Ze verwijderen uitsluitend hun zelf aangemaakte testdatabase. De werkdatabase wordt niet gereset. Voor browsertests is een Playwright Chromium-installatie nodig (`npx playwright install chromium`); de configuratie kan een aanwezige executable via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` gebruiken.

`npm run build` bouwt de frontend in servermodus. Voor controle van deze bundel: start `npm run server` en in een tweede terminal `npm run preview`. Een frontend-build alleen start geen API, database of worker.

## Opslag en conflicten

De database bevat de werktoestand per club, onveranderlijke revisies en goedkeuringen, publicatietaken, pogingen, sandboxreceipts en audit. Beslissende mutaties gebruiken een transactionele werkversie plus exacte contentrevisie. Een conflict wordt teruggegeven als HTTP 409; de invoer blijft herstelbaar en mag pas na controle opnieuw worden toegepast.

Uploads worden server-side gedecodeerd en naar WebP omgezet, met limieten op bytes en afmetingen. De verwerkte bestanden staan buiten de openbare website in `.local/uploads`. Alleen een geverifieerde club-/teamsessie kan een mediaobject opvragen. Foto's en herstelconcepten worden nooit naar een andere testclub doorgestuurd bij afmelden of accountwissel.

`database/migrate.ts` registreert de bestandsnaam en SHA-256 van iedere migratie. Een gewijzigde reeds toegepaste migratie wordt geweigerd. Voeg nieuwe wijzigingen toe als een nieuw migratiebestand; reset geen database om een verschil te verbergen.

## Stoppen en herstarten

Stop de website/API met Ctrl+C. Stop de database met `npm run local:stop`. Het Docker-volume blijft behouden. `npm run local:setup` en `npm run dev` hervatten dezelfde lokale gegevens. Verwijder het volume en `.local` niet als herstelactie.

## Lokale backup en herstelproef

Stop tijdelijk schrijfactiviteiten tijdens een backup en voer `npm run local:backup` uit. Het script schrijft een PostgreSQL-dump, uploadkopie en manifest naar `.local/backups`, herstelt de dump naar een eigen tijdelijke database en vergelijkt de aantallen clubs en bijdragen. Het verwijdert daarna uitsluitend die tijdelijke hersteldatabase. Deze proef gebruikt fictieve lokale gegevens; de stagingbackup moet via de bestaande versleutelde backuproute lopen en ook objectherstel bewijzen.

Een approllback activeert een eerdere geteste broncommit en bouwt met dezelfde gepinde toolchain en de bijbehorende configuratie. Maak vooraf een backup en pauzeer nieuwe publicaties. Database en uploads worden niet automatisch teruggedraaid met de app. Gebruik voor de ongewijzigde prototypeweergave de aparte uitgangscommit in een andere checkout; die leest de nieuwe serverdatabase niet.

Bewaar oude receipts, audit en onbekende kanaaluitkomsten. Controleer compatibiliteit voordat een oudere serverrelease tegen een nieuw schema wordt gestart. Verwijder bestaande externe berichten nooit op basis van een code-rollback.

## Afgeschermde staging aansluiten

Zie `BENODIGDE-GEGEVENS.md` voor accounts, variabelen en projectgegevens. De repository is `https://github.com/castiqnl/platform.git`, met `main` als integratiebranch en `origin/main` als upstream. Stel de VPS, runners, site-ID, Caddy en het daadwerkelijke `dg-site-deploy`-contract nog vast. Gebruik dezelfde volledige broncommit voor staging en latere productie; de runtime- en buildconfiguratie blijven omgevingsspecifiek.

Gebruik buiten lokaal `AUTH_MODE=supabase`; fixture-auth weigert een andere omgeving of publieke bindinterface. De Supabase-verificatieadapter controleert de identiteit op de Auth-server en haalt rechten uit de eigen membershiptabel. De OTP/Google-aanmeldschermen, PKCE-callback en sessieherstel zijn voorbereid. Stel de publieke buildvariabelen en servervariabelen voor hetzelfde project in en configureer de bestaande mailgateway. Verifieer echte aanmelding, verversing en afmelden op de doelomgeving. Zet Google pas aan na juiste providerconfiguratie. De code vraagt voor OTP geen automatische nieuwe gebruikers aan; beheerders wijzen eerst accounts en clubrechten toe.

Het schema `castiq` is privé en krijgt geen `anon`/`authenticated`-toegang. Gebruik voor migraties afzonderlijke credentials en voor de API een beperkte runtimegebruiker; maak dit schema niet bereikbaar via de Supabase Data API. De lokale filesystemadapter vraagt een blijvend privévolume op staging of vervanging door een geteste private objectadapter.

De meegeleverde `compose.yaml`/Caddy-container is uitsluitend de expliciete statische browserdemo (`VITE_DATA_MODE=demo`). `compose.local.yaml` beheert de lokale database voor de volledige serverflow. Geen van beide is bewijs van een VPS-installatie.

GitHub CI is voorbereid in `.github/workflows/ci.yml`. Er is geen deployworkflow met verzonnen runnerlabels, hostnamen of site-ID's toegevoegd. De actuele CI-uitvoeringen zijn te volgen via [GitHub Actions](https://github.com/castiqnl/platform/actions). Controleer groene CI op de exacte releasecommit vóór een deployment; de daadwerkelijke stagingacceptatie moet nog op diezelfde SHA plaatsvinden.
