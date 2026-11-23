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
