# Herstel kanaalwizards in servermodus

De serverroute `/#/club/channels` gebruikte een losse dialoog en nauwelijks opgemaakte blokken. De vierstappenwizard uit de overdracht was alleen in demomodus behouden. De kanaalbrowsertest verwachtte bovendien een uitgeschakelde koppelknop; daardoor bleef de ontbrekende bediening buiten de testdekking.

De serverroute gebruikt nu de compacte kanaaldirectory en de stappen **Voorbereiden → Toestemming → Account/pagina kiezen → Controleren**. Iedere koppelknop opent de voorbereiding. Zonder geactiveerde provideraansluiting blijft alleen de daadwerkelijke toestemmingsactie geblokkeerd, met uitleg voor de club. Servercredentials en technische implementatiedetails staan niet meer in de clubflow.

Officiële toestemming, accountkeuze en bevestiging blijven servergestuurd. Alleen door de server teruggegeven accounts kunnen worden gekozen; de definitieve mutatie volgt pas na de samenvatting. De wizard bewaart de browsergebonden sessie bij herladen, volgt toestemming automatisch, ondersteunt weigeren/opnieuw proberen en laat een bestaande verbinding intact tot bevestiging. Een verbindingstest of bevestigde koppeling geldt niet als een gepubliceerd bericht. Er zijn geen providerinstellingen of databasecontracten gewijzigd.

## Uitgevoerde controle

- Beide TypeScript-controles en productiebuild geslaagd.
- Alle tien kanaal-/pakketbrowsertests geslaagd, inclusief tenantgrenzen, exports en vertraagde workspaceverversing.
- Nieuwe tests controleren alle drie de ongeconfigureerde wizards zonder OAuth-mutatie, de daadwerkelijke CSS-grid, mobiel en Escape, plus een expliciet gemockte providerflow met popup, herstel na herladen, accountkeuze, samenvatting en afzonderlijke bevestiging.
- Een gemockte weigering biedt opnieuw proberen zonder een account te koppelen. Ook een verlopen sessie of gelijktijdig gewijzigde koppeling keert terug naar de toestemmingsstap, behoudt het bestaande account en gebruikt bij opnieuw proberen de actuele serverversie. Dit is geen bewijs van live providertoestemming.
- Desktop 1440 px en mobiel 390 px visueel geïnspecteerd: compacte directory, vier stappen, passende dialoog, minimaal 44 px actieknoppen en geen horizontale overflow. Lokale screenshots bevatten uitsluitend synthetische testgegevens.

De Instagram-route gebruikt Instagram Login voor professionele accounts; geen fictieve Facebook-loginoptie. Gebruikte officiële bronnen gecontroleerd op 23 november 2026: [Meta Instagram](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api), [Meta changelog](https://developers.facebook.com/docs/instagram/platform/instagram-api/changelog/), [Facebook Page Feed](https://developers.facebook.com/docs/graph-api/reference/page/feed/) en [X OAuth 2.0](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code).

De stagingactivatie volgt de exacte-SHA-procedure. Live providerautorisatie vraagt nog de eerder vastgelegde private providerconfiguratie; echte publicatie en betalingen blijven uitgeschakeld.

## Uitgerold naar staging

Actief: `3cf040cf91e0e15c2fa2f7f52d82a48165f004d9`, releasepaar `3cf040cf91e0e15c2fa2f7f52d82a48165f004d9-45271236093-1-initial-20261122`. Exacte main-push-CI [45270483470](https://github.com/castiqnl/platform/actions/runs/45270483470), kandidaatbuild [45271236093](https://github.com/castiqnl/platform/actions/runs/45271236093) en activatie [45271547140](https://github.com/castiqnl/platform/actions/runs/45271547140) zijn geslaagd.

De nieuwe wizard-JS en CSS zijn via publiek HTTPS opgehaald en bytegelijk aan het geïnstalleerde artifact. Health/readiness geven 200 op de nieuwe SHA; API en worker draaien zonder herstarts of waargenomen achtergrondfouten. Anonieme desktop-/mobiele controles zijn geslaagd. Productie, Fabelpad en proxyconfiguratie zijn voor/na gelijk. De vorige release `4c39c3a…` is bewaard; 148 overige runtimebronbestanden en dependencybestanden zijn ongewijzigd. Verse backup en geïsoleerd herstel omvatten 41 tabellen en 127 rijen. Details staan in [het uitrolbewijs](deploy-evidence/staging-channel-wizards-2026-11-23.json).

Vindplaats: **Jouw vereniging → Koppelingen → Koppelen** bij Instagram, Facebook of X. Ververs een al geopende stagingpagina om de nieuwe interface te laden. Zonder provideractivatie zijn de voorbereiding en uitleg beschikbaar; echte toestemming kan nog niet worden gestart.
