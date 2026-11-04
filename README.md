# CASTIQ V1 — werkend prototype en stagingoverdracht

Dit pakket bevat het complete werkende React/TypeScript-prototype, alle afbeeldingen en lettertypen, de gebouwde website, domeintests en een concrete opdracht voor Codex om de serverkant op staging af te maken.

**Begin met `CODEX-STARTPROMPT.txt`, daarna `docs/STAGING-SPEC.md`.**

## Starten

Benodigd: Node.js 24 en npm. Vanuit de projectmap:

```bash
npm ci
npm run check
npm test
npm run build
npm run preview -- --port 4173
```

Open de URL die Vite toont. De basis-URL toont de marketingwebsite. Gebruik daarna `#/club/dashboard` voor clubbeheer of `#/team/dashboard` voor de mobiele teamomgeving. `#/platform/system` opent de kanaalsimulator. `npm run dev` start de ontwikkelserver.

## Wat nu functioneert

- Mobiele inzending met foto, wedstrijd, uitslag, tekst, naam- en fotovoorkeuren.
- Lokale concepten, automatische opslag, herstel na heropenen en zichtbare opslagfouten.
- Centrale redactie: inzenden, feedback, goedkeuring van een exacte versie en revisies.
- Kanaalwachtrij met planning, expliciete demo-bevestiging, fouten, onbevestigde uitkomsten en gerichte retry.
- Scorecorrectie met reden, behoud van eerdere bevestigingen en opnieuw beoordelen van gekoppelde versies.
- Clubweekgenerator met team-/momentselectie en bescherming tegen dubbele concepten.
- Sponsorafspraken, toegepaste vermeldingen en rapportage op basis van demo-bevestigingen.
- Samengesteld weekendbericht uit gecontroleerde bronbijdragen.
- 27 standaardtemplates in primaire/secundaire clubkleur, foto tussen basis en effectlaag, clubmaatwerk door platformbeheer.
- PNG/SVG-uitvoer vanuit de ontwerpstudio en PNG-uitvoer van de nieuwe bijdragepreview.

## Grenzen van dit prototype

Alle personen, clubs en beelden zijn demonstratiemateriaal. Data wordt op het huidige apparaat bewaard. Rolwissels zijn demonstratiebediening en geen authenticatie of tenantbeveiliging. Kanaalantwoorden zijn herkenbare simulaties: **geen externe socialmedia-account ontvangt een bericht**. Het pakket bevat geen wachtwoorden, API-sleutels, echte OAuth-koppelingen, serverdatabase of daadwerkelijk gedeelde serveropslag.

De frontend is direct uitvoerbaar. De serverauthenticatie, tenantisolatie, uploads, taakverwerking, officiële kanaalautorisaties en echte bevestigingen zijn de volgende stagingbouwfase, beschreven met acceptatiecriteria. Die voorzieningen mogen niet worden vervangen door client-side rolcontroles of optimistische succesmeldingen.

## Belangrijkste routes

| Route | Werking |
| --- | --- |
| `#/club/dashboard` | Clubcockpit en aandachtspunten |
| `#/team/dashboard` | Mobiel moment aanleveren |
| `#/club/moderation` | Versie beoordelen |
| `#/club/content` | Bijdragen en kanaalstatussen |
| `#/club/calendar` | Publicatieplanning |
| `#/club/week` | Clubweek voorbereiden |
| `#/club/sponsors` | Sponsorafspraken en bewijs |
| `#/club/weekend` | Weekendbericht samenstellen |
| `#/club/studio` | 27 stijlen en clubmaatwerk |
| `#/platform/system` | Kanaaluitkomsten simuleren |

## Bronindeling

`src/v1Workflow.ts` bevat de testbare overgangsregels. `store.tsx` verzorgt de browseropslag. `Editorial.tsx` is de inzend-/redactieflow. `ClubWeek.tsx` bevat clubweek, sponsorafspraken en weekendoverzicht. `V1Workspace.tsx` bevat cockpit, opslagindicatie en operationele kanaalstatussen. Alle bestaande ontwerpen blijven in `Poster.tsx`, `SelectedTemplatePoster.tsx`, `templateCatalog.ts`, `templateAtlas.ts`, `Studio.tsx` en `public/assets/`.

Oudere componenten staan deels nog in `Core.tsx` en `AdminPanels.tsx` als historische bron. De nieuwe hoofdroute gebruikt `Editorial.tsx` en `V1Workspace.tsx`. Bouw een toekomstige serverflow rond het geteste contract; heractiveer geen oudere knop die publicaties direct op `published` zet.

## Staging

`deploy/Dockerfile` en `deploy/Caddyfile` kunnen de statische frontend achter de bestaande afgeschermde staginginfrastructuur serveren. De meegeleverde compose-config bindt uitsluitend op localhost. Dit is geen reeds uitgevoerde VPS-installatie. Gebruik de bestaande stagingrepository, domeinen en deploymethode zodra Codex ze in de doelomgeving aantreft; verander geen productieomgeving en maak de website niet openbaar.

`docs/ASSET-MANIFEST.json` bevat per asset de bestandsgrootte en SHA-256. `docs/VALIDATION.md` legt de uitgevoerde controles en de nog uit te voeren stagingproeven vast. `docs/STAGING-SPEC.md` is het volledige overdrachtsdocument.
