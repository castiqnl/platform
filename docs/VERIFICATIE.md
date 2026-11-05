# Castiq lokale verificatie op 4 november 2026

De lokale serverflow is getest met fictieve gegevens en expliciete sandboxkanalen. Dit verslag onderscheidt uitgevoerde lokale proeven van open externe stagingacceptatie. De uitgangscommit is `f9afa122fc2c4c13b703daef19d68c7c5ddd820c`. De lokaal geteste implementatiecommit is `70387e392d2cfc739bfbd60e30025c1d68eab52f`. Op 5 november is deze geïntegreerd op `main` van [castiqnl/platform](https://github.com/castiqnl/platform), met behoud van de bestaande GitHub-initialisatie; de integratiewijzigingen betreffen repositorydocumentatie.

## Omgeving en resultaten

| Controle | Werkelijk resultaat |
| --- | --- |
| Oorspronkelijke basis in aparte worktree | Typecheck, 12 domeintests en Vite-build geslaagd |
| Huidige typecontrole | Frontend en Node-server gecontroleerd met `npm run check` |
| Domein en clubtijd | 25 tests geslaagd: 19 domeinregressies en 6 tijdzonetests |
| Server en pilot | 18 tests inclusief pilot-parent geslaagd; eigen tijdelijke PostgreSQL-databases; geen skips |
| Browser | Vier Chromium-proeven geslaagd: mobiele keten, offline herstel, O10 met vier PNG-formaten en afgeschermde aanmeldconfiguratie |
| Assets | Alle 50 SHA-256-hashes kloppen; exact 27 oorspronkelijke template-ID's bevestigd |
| Productiebundel | Vite-build geslaagd; lokaal buildbewijs |
| Backup en restore | Dump hersteld in aparte tijdelijke database; aantallen clubs/bijdragen gelijk; actieve database behouden |
| Configuratie | Namen/aanwezigheid gevalideerd zonder secretwaarden te tonen |
| GitHub CI | Workflow aanwezig; actuele uitvoeringen en commit-SHA staan bij [GitHub Actions](https://github.com/castiqnl/platform/actions) |
| Externe staging | Niet uitgevoerd: host, URL, runners en accounts ontbreken |
| Productie en externe posts | Niet gewijzigd respectievelijk niet uitgevoerd |

Toolchain: Node 24.18.0, npm 11.16.0 en PostgreSQL 17 Docker met vastgelegde image-digest. Website: `127.0.0.1:4173`; API: `127.0.0.1:4174`; database: `127.0.0.1:55439`. Migraties `001_workspace.sql` en `002_media_integrity.sql` zijn lokaal toegepast met geregistreerde checksums.

Screenshots staan in `docs/evidence`. Het browserbewijs gebruikt een geëmuleerde 390×844 viewport en een aparte 1440×1000 browsersessie. Dit is geen fysieke iPhone-/Androidtest. Playwright-rapporten en traces zijn genegeerde lokale uitvoer. De echte Supabase OTP/Google-login is zonder projectconfiguratie niet extern geverifieerd.

## Acceptatiematrix kernketen

`Geslaagd lokaal` betekent uitgevoerd tegen lokale code/API/PostgreSQL. `Deels` noemt het werkelijk uitgevoerde deel; het resterende deel telt niet als geslaagd. `Open` is niet uitgevoerd. Geen van deze gevallen is op een externe staginghost afgetekend.

| ID | Uitslag | Bewijs en grens |
| --- | --- | --- |
| A01 | Geslaagd lokaal | Mobiele browser 390 px; formulier en primaire acties zonder horizontale overflow |
| A02 | Geslaagd lokaal | Foto naar private servermedia geüpload en met juiste inhoud in preview getoond |
| A03 | Geslaagd lokaal | Concept herladen en in tweede onafhankelijke browsersessie hervat |
| A04 | Geslaagd lokaal | Offline typen; fout/niet gesynchroniseerd zichtbaar; tekst na reconnect/reload hersteld |
| A05 | Deels | Ongeldige/grote upload geweigerd; onderbroken upload met hervatting nog open |
| A06 | Geslaagd lokaal | Manager alleen eigen team; redactie ontvangt ingediende revisie |
| A07 | Geslaagd lokaal | Stabiel content-ID, dubbele indiening/CAS en één reviewbijdrage |
| A08 | Geslaagd lokaal | Feedback in redactiesessie verschijnt in afzonderlijke managersessie |
| A09 | Geslaagd lokaal | Exacte revisie en SHA-256 in onveranderlijke goedkeuringsrij |
| A10 | Geslaagd lokaal | Bewerking verhoogt revisie en trekt goedkeuring/open jobs transactioneel in |
| A11 | Geslaagd lokaal | Foto, tekst, score, privacy en sponsor via dezelfde revisieroute; oude payload bevroren |
| A12 | Geslaagd lokaal | Server weigert queue voor ongekeurde revisie; UI toont reden |
| A13 | Geslaagd lokaal | Werkversie/contentconflict; browser bewaart eigen tekst naast actuele versie |
| A14 | Deels | Sandboxworker wacht op bevestiging; echte asynchrone provider nog open |
| A15 | Open | Echte receipt met extern post-ID en readback vereist testaccount |
| A16 | Deels | Drie verschillende sandboxkanaaluitkomsten; echte Facebook/Instagram/X niet getest |
| A17 | Deels | Dubbele queue/retry/sandboxreceipt idempotent; echte gesigneerde webhooks nog open |
| A18 | Deels | Sandbox-timeout behoudt request en reconcilieert; echte providertimeout nog open |
| A19 | Deels | Verlopen clubrecht blokkeert toegang; verlopen socialautorisatie nog open |
| A20 | Geslaagd lokaal | Duurzame lease, concurrente claim en crash/herstart met hetzelfde request |
| A21 | Geslaagd lokaal | Revisie/pauze na claim voorkomt dispatch; late uitkomst heractiveert oude job niet |
| A22 | Geslaagd lokaal | UI/receipts labelen sandbox als demo; geen externe publicatieclaim |

## Acceptatiematrix gegevens en automatisering

| ID | Uitslag | Bewijs en grens |
| --- | --- | --- |
| B01 | Geslaagd lokaal | Scorecorrectie met reden, bronversie, betrokken revisies en audit |
| B02 | Deels | Server behoudt thuis-/uitvolgorde bij uitwinst 1–3 en correctie 2–3; volledige uitwedstrijd-browsertest nog open |
| B03 | Geslaagd lokaal | Negatief, decimaal, ontbrekend en >99 geweigerd; geen stille 0–0 |
| B04 | Geslaagd lokaal | Eerdere sandboxreceipt blijft bij oude snapshot na correctie |
| B05 | Open | Geen bronimport aangesloten; import versus handmatige correctie nog niet getest |
| B06 | Geslaagd lokaal | Onbekende/geweigerde foto blokkeert goedkeuring; neutrale variant beschikbaar |
| B07 | Geslaagd lokaal | Strengste naamvoorkeur in payload/tekst/overzicht; anonimiteit in render |
| B08 | Geslaagd lokaal | Ingetrokken vrijgave annuleert bronjobs/overzicht; worker controleert opnieuw |
| B09 | Geslaagd lokaal | Verkeerde MIME/bytes, SVG en >8 MB geweigerd; metadata verwijderd uit WebP |
| B10 | Geslaagd lokaal | Andere clubs krijgen geen content/media/jobs via geraden ID of aangepaste body |
| B11 | Geslaagd lokaal | Ander team lezen/wijzigen geweigerd met afzonderlijke sessies |
| B12 | Geslaagd lokaal | Platform ziet technische metadata en nul inhoud, spelers of foto's |
| B13 | Geslaagd lokaal | Clubweek tweemaal zonder dubbele generatiekeys |
| B14 | Geslaagd lokaal | Voorbereide wedstrijden hebben geen bevestigde eindstand; scorecontrole vereist |
| B15 | Deels | Domein markeert gewijzigde verslagbronnen; volledige aftrap/afgelastingsimport nog open |
| B16 | Geslaagd lokaal | O10 geen score in payload, overzicht en vier PNG-renderformaten |
| B17 | Deels | Sponsorperiode, team/type en prioriteit server-side; externe uitvoeringsperiode nog open |
| B18 | Geslaagd lokaal | Concept/export zonder receipt telt niet als sandboxpublicatiebewijs |
| B19 | Geslaagd lokaal | Kanaalplaatsingen en unieke bijdrage apart vastgesteld in pilotbewijs |
| B20 | Geslaagd lokaal | Onvrijgegeven bronfoto komt niet via een samengesteld bericht naar buiten |
| B21 | Geslaagd lokaal | Bronwijziging trekt overzicht in; herbouw gebruikt hetzelfde ID en nieuwe versie |
| B22 | Open | Nieuwe tenant/proefclub via platformbeheer nog niet naar servermutatie omgezet |
| B23 | Deels | Originele kleuren/renderer en drie clubkleursets behouden; wijzigingsflow nog demo |
| B24 | Geslaagd lokaal | Exact 27 oorspronkelijke IDs en 27 beschikbare mobiele keuzes |
| B25 | Deels | Server beperkt tot standaardcatalogus; clubmaatwerk/platformbronbeheer nog demo |
| B26 | Deels | PNG 1080×1350, 1080×1080, 1080×1920 en 1600×900 gedownload; SVG/alle overloopgevallen open |
| B27 | Deels | Netwerkfout/conflict zichtbaar en invoer hersteld; fysieke quota-uitputting nog open |
| B28 | Geslaagd lokaal | Pauze voorkomt dispatch, ook na claim; hervatten controleert actuele revisie |
| B29 | Geslaagd lokaal | Clubtijdzone, zomer/wintertijd, DST-gat en dubbel uur onafhankelijk van apparaat-TZ |
| B30 | Deels | Labels/bediening en reduced motion gebruikt; volledige toetsenbord-/screenreaderaudit open |

## Pilotweekend met drie clubs

`tests/pilotWeekend.test.ts` doorloopt vrijdag tot maandag via lokale HTTP-requests en een eigen tijdelijke PostgreSQL-database. Dit is een geautomatiseerde fictieve weekendsimulatie, geen al gehouden pilot met echte verenigingen.

Vrijdag: SC Getijde, FC Havenlicht en SV Noordhaven afzonderlijk ingericht; sponsors vastgelegd; clubweken tweemaal zonder dubbele bijdragen. Zaterdag: concepten via tweede sessie hersteld; exacte revisies ingediend/goedgekeurd; drie sandboxuitkomsten naast elkaar. Timeout en retry behielden dezelfde aanvraag. Noordhaven testte strengere naamvoorkeuren en geweigerde foto's.

Zondag: overzichten uit exacte bronversies; geen O10-scores. Scorecorrectie annuleerde een open overzichtjob en behield historische receipts. Herbouw behield hetzelfde overzicht-ID. Maandag: bevroren sponsorbewijs blijft bij de oorspronkelijke versie; kanaalplaatsingen en unieke bijdragen zijn apart geteld; week-/maandperioden zijn gescheiden. Een export telt nooit als extern bevestigde publicatie.

Echte posts, officiële providerautorisaties, fysieke toestellen, belasting, gemeten tijdwinst en bereik zijn niet getest of verzonnen.

## Resterende beperkingen en terugrol

Nog nodig: staginghost/URL en release-infrastructuur; echte Supabase OTP/Google en mailgateway/outbox; beperkte runtime-databaserechten; blijvende private stagingopslag; bronimport; officiële kanaaladapters/webhooks/receipts; platform-/tenant-/maatwerkbeheer; aparte clubbeheerder-/redacteurbevoegdheden; de open/deels genoemde acceptatiegevallen.

De database gebruikt één transactionele werktoestand per club. Onafhankelijke acties binnen dezelfde club kunnen een herstelbaar werkversieconflict geven. De uploadadapter gebruikt lokale schijfopslag. Een compleet persoonsgebonden toestemmingsregister en de workflow voor intrekking na externe publicatie zijn nog niet aangesloten. Deze grenzen moeten vóór een echte pilot worden herbeoordeeld en getest.

Een extra hersteltest beëindigt uitsluitend een eigen idle databaseverbinding en bewijst dat de API opnieuw verbindt. De server en worker loggen daarbij uitsluitend een veilige foutcode; de afsluitroute wacht de echte verbindingssluiting af vóór een tijdelijke testdatabase wordt verwijderd.

Voor terugrol: pauzeer nieuwe publicaties, maak een backup, behoud receipts/audit en activeer de vorige geteste apprelease. Een approllback herstelt migraties, objecten, providerconfiguratie of externe berichten niet automatisch. Zie `RUNBOOK.md` voor de lokale herstelproef en stagingvoorwaarden.
