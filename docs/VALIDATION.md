# Uitgevoerde verificatie — 3 november 2026

## Verificatie van het geleverde prototype

- TypeScript: `npm run check`.
- Domeinregressies: `npm test`. Zie `test-results.txt` voor de werkelijk uitgevoerde gevallen en het resultaat.
- Productiebundel: `npm run build` en het Sites-buildhulpmiddel bij publicatie. De gebouwde bestanden worden in de overdracht bijgeleverd.
- Assetintegriteit: `node scripts/verify-assets.mjs` controleert alle meegeleverde originele assets tegen SHA-256.
- Browser: clubcockpit, mobiele inzendwizard, foto-upload met expliciete fotovrijgave, tekst/uitslag, direct sluiten en heropenen van een concept, inzenden voor beoordeling, exacte goedkeuring, kanaalwachtrij, onbevestigd kanaalantwoord, expliciete demo-bevestiging en PNG-download zijn doorlopen.
- Browser: een gewijzigde goedgekeurde bijdrage werd v2 ter beoordeling; het publicatiebewijs van v1 bleef historisch beschikbaar en v2 kon niet zonder nieuwe goedkeuring worden verzonden.
- Browser: clubweek leverde zes concepten op; opnieuw genereren leverde nul extra concepten en behield de zes bestaande ontwerpen. Sponsorafspraken en aparte week-/maandperioden zijn gecontroleerd.
- Browser: het weekendoverzicht op de laatste afgeronde week toonde de juiste goedgekeurde bron, score en team; opslaan maakte een nieuw clubconcept in dezelfde redactieflow.
- Browser: ook een nog niet vastgelegde bewerking van een bestaande bijdrage bleef bij direct sluiten bewaard en werd bij dezelfde basisversie hersteld, zonder de huidige versie te wijzigen.
- De gedownloade PNG is visueel gecontroleerd op foto, template-effect, clubkleuren, uitslag en lettertypen.
- Een previewfout met niet-beschikbare `crypto.randomUUID()` in HTTP is hersteld met lokale UUID-generatie; de volledige inzending is daarna succesvol herhaald.

## Geautomatiseerde invarianten

De tests controleren exacte revisiegoedkeuring, ingetrokken jobs na wijziging, bescherming tegen geïnjecteerde goedkeuringsvelden, foto-/naamvoorkeuren, onvolledige uitslagen, uitsluitend bevestigde kanaalstatussen, afzonderlijke kanaalfouten, idempotente retries, late callbacks, planning, scorecorrecties, bevroren sponsorbewijs, samengestelde rapporten en de migratie van oude demogegevens.

De testset controleert het gedrag van de lokale domeinengine. Dit is geen bewijs voor nog niet aanwezige serverautoriteit, OAuth- of provideradapters.

## Nog door Codex op staging te verifiëren

De 52 acceptatiegevallen in STAGING-SPEC.md zijn de uit te voeren server-/pilotmatrix; ze zijn niet allemaal al als browsertest uitgevoerd. Echte authenticatie, server-side tenantisolatie, database-/uploadduurzaamheid, officiële kanaaltoegang en providerbevestiging zijn vervolgbouw. Ook daadwerkelijk gebruik op iOS/Android, netwerkuitval, browserquota, echte provider-timeouts, belasting en een volledig pilotweekend met drie clubs moeten in de doelomgeving worden afgetekend.

De Docker/Caddy-configuratie is meegeleverd, maar hier niet als container op een VPS uitgevoerd. Er wordt geen staging-URL of testaccount verzonnen. Er zijn geen echte socialmedia-berichten geplaatst.
