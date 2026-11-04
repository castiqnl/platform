# CASTIQ V1 — Product- en stagingoverdracht voor Codex

Versie: 3 november 2026 · Tijdzone voor clubplanning: Europe/Amsterdam.

Dit document is het functionele en technische doelcontract voor de stap van het Sites-prototype naar staging. De broncode en de afbeeldingen uit het overdrachtspakket vormen de visuele referentie. De uiteindelijke runtime, database, identiteit, publicatiewerkers en externe kanaaltoegang moeten in de bestaande stagingomgeving worden aangesloten en geverifieerd. Een werkend browserprototype is geen bewijs van werkende externe publicatie of productieautorisatie.

## 1. Opdracht en beoogde uitkomst

Maak Castiq bruikbaar voor een vrijwilliger die een volledige vereniging actueel houdt met bijdragen vanuit teams. Lever de volgende complete keten:

1. Een teammanager maakt op de telefoon een bijdrage met foto, wedstrijdmoment, eventuele uitslag en korte tekst.
2. De clubredactie beoordeelt de exacte ingediende revisie en de toegestane publicatiegegevens.
3. Per kanaal wordt een goedgekeurde revisie ingepland, aangeboden en gevolgd tot een door het kanaal bevestigde uitkomst.
4. Een clubweek maakt conceptcontent uit beschikbare wedstrijden; ontbrekende of oude brongegevens blijven herkenbaar.
5. Sponsorafspraken worden op passende content toegepast en alleen met echte uitvoeringsbewijzen gerapporteerd.
6. Een weekendoverzicht wordt samengesteld uit actuele wedstrijdgegevens en vrijgegeven bijdragen, waarna het dezelfde goedkeuringsroute doorloopt.

V1 is geslaagd wanneer een clubmedewerker een complete wedstrijddag kan afhandelen zonder verborgen handmatige correcties in de database en zonder dat ontbrekende kanaalbevestigingen als succes verschijnen.

### Vaststaande ontwerpbesluiten

- Behoud de premium donkere CASTIQ-werkplek met lime accenten; de clubuitingen hebben de eigen clubkleuren.
- Behoud exact 27 standaardstijlen met de oorspronkelijke showcase-ID's: 1–12, 15, 23, 24, 25, 28, 29, 31, 33, 34, 39, 45–49. ID's niet hernummeren.
- Primaire en secundaire clubkleuren worden op ontwerpvlakken en effecten toegepast; de foto blijft fotografisch herkenbaar met eigen kleuren.
- De compositie blijft gelaagd: onderlaag → gebruikersfoto → effectoverlay → automatische inhoud.
- Maatwerk is exclusief per club en wordt op verzoek door platformbeheer toegewezen. Een club kan een eigen bijdrage bewerken zonder het door het platform beheerde brontemplate te overschrijven.
- Teammanagers krijgen teamgebonden toegang. De club beheert centraal kanaalverbindingen; vrijwilligers delen geen socialmediawachtwoorden.
- De kalender en automatische routines mogen moderatie nooit omzeilen. Een gewijzigde goedgekeurde versie moet opnieuw beoordeeld worden.
- Platformbeheer krijgt niet automatisch toegang tot alle clubbijdragen; supporttoegang is expliciet, tijdelijk en gelogd.

## 2. Werkelijke uitgangssituatie en grenzen

De herstelde repository gebruikt React 19, TypeScript, Vite, Motion en CSS. `package.json` bevat `check` en `build`; de build gaat naar `dist/`. Hashroutes scheiden website, demo, club, team en platform. De huidige store gebruikt browseropslag (`castiq-demo-v1`) en lokale Studio-documenten. Bestaande modules omvatten clubcockpit, content, moderatie, kalender, wedstrijden, liveconsole, ontwerpstudio, huisstijl, sponsors, teams en platformbeheer.

De vóór deze uitbreiding aanwezige routes en knoppen voor accounts, uitnodigingen, verbindingen, berichten, abonnementen en publicaties zijn demo-interacties. Zij sturen geen echte e-mail, sluiten geen contract af en publiceren niet naar socialmedia. De rolwisselaar is een demonstratie van schermen, geen authenticatie. Browseropslag mag niet als gedeelde of duurzame stagingdatabase worden gebruikt.

De nieuwe V1-demonstratie moet zichtbare toestanden voor deze processen bieden. Een gesimuleerde ontvangstbevestiging moet altijd als **demobevestiging** herkenbaar zijn. Codex moet de demonstratieadapter vervangen door een serveradapter voordat een pilot met echte accounts en persoonsgegevens wordt toegestaan. De oplevernotities van het pakket noemen welke tests daadwerkelijk zijn uitgevoerd; open testgevallen in dit document zijn geen geslaagde tests.

### Nieuwe implementatieonderdelen in het pakket

| Bestand | Verantwoordelijkheid |
|---|---|
| `src/v1Workflow.ts` | Pure browserdomeinfuncties voor normaliseren, indienen, revisie, exacte goedkeuring, kanaaltaken, demo-receipts, herhalen en scorecorrectie |
| `tests/v1Workflow.test.ts` | Gerichte invarianttests voor revisies, privacy, kanaaltoestanden, idempotentie, correcties, sponsorbewijs en migratie |
| `src/Editorial.tsx` | Eenvoudige mobiele maker, contentoverzicht en detail/beoordelingsroute via `V1Creator`, `V1Content` en `V1ContentDetail` |
| `src/ClubWeek.tsx` | `ClubWeek`, `SponsorAgreements` en `WeekendOverview` met conceptgeneratie, planningsoverzicht en bronselectie |
| `src/V1Workspace.tsx` | Dashboard, lokale bewaarstatus en kanaalsimulator/jobmonitor |
| `src/store.tsx` | Centrale `state.content` en genormaliseerde `state.v1` met `drafts`, `sponsorAgreements`, `weekPlans`, `weekendReports` en `audit` |
| `src/App.tsx` | Navigatie en koppeling van de nieuwe V1-componenten aan de bestaande rolroutes |

De nieuwe routes vervangen de oude maker/contentdetail-ingangen. Oude functies in `Core.tsx` kunnen nog in de bron aanwezig zijn; zij zijn geen tweede autorisatie- of publicatiemodel en moeten bij stagingmigratie niet onbedoeld opnieuw bereikbaar worden.

De actuele browsercodes voor bijdragen zijn onder meer `draft`, `review`, `changes`, `approved`, `scheduled`, `queued`, `failed` en `published`; `changes` betekent aanpassing gevraagd. Jobs gebruiken onder meer `scheduled`, `queued`, `awaiting_confirmation`, `failed`, `published` en `cancelled`. `published` is in dit pakket uitsluitend een **demo**-resultaat met `providerMode: 'demo'` en `receipt.kind: 'demo'`. Een bestaande legacy-publicatie wordt bij normalisatie eveneens als demo gelabeld; dat is geen externe historische verificatie.

Ieder jobobject houdt een ID, revisie (`version`), poging (`attempt`), `requestId`, `dedupeKey` en bevroren publieke `payload` bij. Een inhoudswijziging verhoogt de revisie en verwijdert de actuele goedkeuring; open jobs vervallen, eerdere demo-receipts blijven behouden. De publieke payload volgt de gekozen naam- en fotoweergave. Dit maakt de regels testbaar binnen de browser, maar vervangt geen onveranderlijke serverrevisies, database-uniekheid of providerreconciliatie.

De gerichte domeintests worden via het meegeleverde npm-testscript uitgevoerd met de Node-test runner en TypeScript strip-types. Controleer de daarvoor vereiste Node-versie aan het meegeleverde runtime-/buildbestand. Deze tests valideren pure functies; zij bewijzen geen multi-user-, database-, browser-, upload- of externe API-werking.

De browserstore bewaart na een korte debounce en probeert de laatste centrale toestand ook bij `pagehide`/verborgen pagina weg te schrijven. Een opslagfout verschijnt zichtbaar; een wijziging uit een ander tabblad zet de lokale schrijfacties stil en vraagt herladen in plaats van de andere tab stil te overschrijven. Dat is een herstelvoorziening voor de demo, geen gedeelde multi-user-synchronisatie. De teamdemo gebruikt voorbeeldteam O14-1; staging moet het team uit de echte gebruikersrechten afleiden.

### Buiten de opdracht voor deze stap

Geen volledige ledenadministratie, boekhouding, wedstrijdorganisatie, nieuwe vrije layoutdesigner of gedwongen frameworkmigratie. Behoud de bestaande renderer en assets. Een migratie naar Next.js of een specifieke database vereist een gemotiveerde keuze na inspectie van de werkelijke stagingrepository; deze overdracht kiest geen nog onbekende server of database namens de gebruiker.

## 3. Rollen en gegevensgrenzen

| Rol | Toegestaan | Grens |
|---|---|---|
| Inzender/teammanager | Eigen teamwedstrijden kiezen, foto's aanleveren, eigen concepten bewerken, bijdragen indienen, feedback en kanaalstatus zien | Geen goedkeuring of clubkanaalcredentials; geen andere teams lezen via aangepaste URL |
| Clubredacteur | Clubbijdragen beoordelen, feedback geven, actuele revisies goedkeuren en plannen, publicatiefouten opvolgen | Geen andere clubs; geen wijzigen van platformtemplates |
| Clubbeheerder | Teamrechten, clubvoorkeuren, sponsorafspraken en kanaalverbindingen beheren | Geen toegang tot andere tenants; credentials nooit naar frontend |
| Platformbeheerder | Clubaanvragen, standaardtemplates, clubmaatwerk en technische status beheren | Geen standaard inhoudelijke inzage; gerichte supporttoegang apart regelen |
| Publicatiewerker | Alleen een toegestane, actuele en goedgekeurde revisie naar een bepaald kanaal uitvoeren | Geen onbeperkte gebruikersrechten; actuele voorwaarden opnieuw controleren |
| Extern kanaal | Kanaalspecifieke response/receipt/webhook voor eigen publicatie teruggeven | Geen autorisatiebron voor de Castiq-inhoud zelf |

Alle serverqueries, mutaties, objectuploads, exports, rapportages en achtergrondtaken hebben tenantcontext. De server bepaalt deze vanuit de geverifieerde gebruiker of werkertaak. Een meegestuurde `clubId` is een selectie, geen bevoegdheid. Test tenantgrenzen met twee onafhankelijke sessies, niet alleen met verborgen navigatie.

## 4. UX-contract per proces

### 4.1 Mobiel aanleveren

Start vanuit Vandaag of een teamwedstrijd. Veldvolgorde: wedstrijd → momenttype → foto → titel/uitslag/korte tekst → foto- en naamvoorkeuren → controle → indienen. Club, team, tegenstander, datum en huisstijl zijn vooraf bekend waar de bron dit toestaat. Laat bij een uitwedstrijd thuis- en uitnamen naast de bijbehorende scorevelden zien.

De eenvoudige route toont geen verplicht lagenpaneel. De geavanceerde studio blijft apart bereikbaar. Gebruik duidelijke camerakeuze/upload, aanraakvlakken van voldoende grootte, numeriek scoretoetsenbord en zichtbare acties binnen een smal scherm. De preview volgt dezelfde renderer en dezelfde gegevens als de uiteindelijke export.

Toon voortdurend een concrete bewaarstatus: `Bezig met bewaren`, `Bewaard op dit apparaat`, `Bewaard in clubomgeving`, `Nog niet gesynchroniseerd` of `Bewaren mislukt`. Een lokale bewaarmelding is geen serverbevestiging.

### 4.2 Beoordelen

De redactie ziet de te beoordelen revisie, auteur, wedstrijd, score, fotovrijgave, naamweergave, gekozen template, sponsor, caption, bestemmingen en eventuele waarschuwingen. Goedkeuren legt actor, tijd, revisie en inhoudshash vast. Afwijzen/terugsturen vraagt een begrijpelijke reden. Een teammanager ziet die feedback bij de eigen bijdrage.

Bij wijzigen na goedkeuring verschijnt een nieuwe revisie. De oude goedkeuring is historische informatie en geeft de nieuwe revisie geen publicatierecht. Toon dit expliciet: `Gewijzigd na goedkeuring — opnieuw beoordelen`. Een reeds uitgevoerde externe publicatie wordt niet stilzwijgend aangepast; die houdt zijn oorspronkelijke snapshot en een eventuele correctie wordt een apart gevolgde actie.

### 4.3 Publiceren en opvolgen

Toon per bestemming de juiste status. Het bericht kan op Facebook bevestigd zijn terwijl Instagram nog verwerkt en X mislukt is. Een globale groene successtatus mag gedeeltelijke uitval niet verbergen. Het detail toont pogingen, laatste fout, oorzaak voor de gebruiker, kanaalreceipt en eerstvolgende toegestane actie.

In demomodus zijn kanaalsuccessen expliciet simulaties. Een echte live-adapter mag geen succes geven op basis van een lokale timer, het opslaan van een taak, een HTTP-transportresponse zonder vereiste contentstatus of alleen een door Castiq aangemaakt ID.

## 5. Doeldatamodel en herleidbaarheid

Dit is een doelmodel voor staging, geen claim dat de browserdemo deze tabellen al heeft. Kies opslagvorm en transacties passend bij de bestaande serverstack.

| Object | Minimaal vast te leggen |
|---|---|
| Club | ID, naam, tijdzone, primaire/secundaire kleur, naam- en fotovoorkeuren, actieve functies |
| Team/recht | Club-ID, team-ID, seizoen, actor-ID, concrete bevoegdheden, begin/einde |
| Wedstrijd | Club/team, thuis/uit-identiteiten, planning, score/status, bron, bron-ID, bronversie, syncmoment, correctiehistorie |
| Bijdrage | Club/team, auteur, momenttype, actuele revisie, workflowstatus, wedstrijdreferentie |
| Revisie | Onveranderlijke inhoud, caption, score-snapshot, ontwerp/templateversie, mediareferenties, naam-/fotopolicy-snapshot, sponsorselectie, bestemmingen, hash |
| Goedkeuring | Club-ID, bijdrage-ID, revisie-ID/hash, beoordelaar, tijdstip, besluit, reden |
| Publicatietaak | Club-ID, revisie, bestemming/account, geplande tijd, idempotentiesleutel, actuele status, lock/lease |
| Publicatiepoging | Taak, pogingnummer, begin/einde, providerrequest-ID, veilige foutcode, retrydatum |
| Kanaalreceipt | Provider, account, revisie/taak, extern bericht-ID, geverifieerde status, ontvangstmoment, URL indien beschikbaar, bron van bevestiging |
| Media | Club/team, object-ID, auteur, MIME/type/afmetingen, uploadstatus, rechten/vrijgave, bewaarbeleid, afgeleiden |
| Sponsorafspraak | Sponsor, club, team/momenttype, geldigheidsperiode, bestemmingen, gewenste frequentie, logo-/tekstversie |
| Sponsorvermelding | Afspraak, bijdrage/revisie, plaatsing, bevestigd kanaalreceipt of apart exportbewijs |
| Clubweek | Club, weekstart/tijdzone, gekozen teams/momenten, bronversies, gegenereerde sleutels, status |
| Weekendoverzicht | Club, periode, geselecteerde bronbijdragen/revisies/wedstrijden, volgorde, onderschrift, eigen revisie en goedkeuring |
| Audit | Club, actor, actie, object/revisie, tijd, reden, correlatie-ID; geen tokens of volledige persoonsgevoelige payloads |

Sla contentrevisies en renderreferenties op zodat een oude receipt aantoonbaar hoort bij de destijds gepubliceerde inhoud. Een veranderlijk liveobject alleen is daarvoor onvoldoende.

## 6. Goedkeuringsmachine en onveranderlijke regels

Gebruik in de server en UI één gedeelde definitie van toegestane overgangen. De gebruikerslabels mogen Nederlands zijn; technische namen hoeven niet overeen te komen met onderstaande voorstelcodes.

| Van | Actie | Naar | Voorwaarde |
|---|---|---|---|
| concept | Indienen | ter beoordeling | Verplichte inhoud, mediastatus en teamrecht geldig |
| ter beoordeling | Terugsturen | aanpassing gevraagd | Redacteur bevoegd; reden opgeslagen |
| aanpassing gevraagd | Opnieuw indienen | ter beoordeling | Nieuwe actuele revisie beschikbaar |
| ter beoordeling | Goedkeuren | goedgekeurd | Verwachte revisie/hash is nog actueel |
| goedgekeurd | Inplannen | ingepland | Kanaalkeuze en planning geldig; goedkeuring exact gelijk |
| goedgekeurd/ingepland | Inhoud wijzigen | concept of opnieuw ter beoordeling | Nieuwe revisie; oude open taken annuleren/ongeldig verklaren |
| iedere bewerkbare toestand | Archiveren | gearchiveerd | Historie en receipts blijven bewaard |

Harde invarianten:

1. Goedkeuring is gekoppeld aan één onveranderlijke revisie/hash.
2. De server vergelijkt de verwachte revisie bij iedere beslissende mutatie; concurrerende wijzigingen geven een conflict met behoud van beide werksituaties.
3. Het wijzigen van foto, tekst, score, privacy, sponsor, template of publieke bestemming na goedkeuring mag geen goedkeuring erven.
4. De render wordt gebaseerd op de goedgekeurde snapshot, nooit op een later gewijzigd los club-/wedstrijdobject.
5. Vóór een worker externe content aanmaakt controleert hij opnieuw revisie, actuele toestemming, tenant, verbinding en annulering.
6. Bestaande publicaties zijn gebeurtenissen in de historie; een revisiewijziging wist geen receipts.
7. Een kalender-, bulk- of automatische actie doorloopt dezelfde serverregels als handmatig publiceren.
8. Het verplaatsen van alleen een geplande tijd mag volgens expliciete clubregels dezelfde inhoudsgoedkeuring behouden; de wijziging krijgt wel een audititem. Het toevoegen van een nieuwe bestemming vraagt expliciete controle.

## 7. Kanaalstatus, ontvangstbewijs en herhalen

Voorstel voor taakstatussen: `klaar`, `ingepland`, `in wachtrij`, `aangeboden`, `wacht op kanaalbevestiging`, `bevestigd`, `mislukt`, `uitkomst onbekend`, `geannuleerd`, `verouderde revisie`.

- **In wachtrij** betekent uitsluitend dat Castiq de taak duurzaam heeft vastgelegd.
- **Aangeboden** betekent dat een externe poging is gestart; de verbinding kan daarna nog falen.
- **Wacht op kanaalbevestiging** betekent dat het kanaal de verwerking nog niet als definitief heeft bevestigd.
- **Bevestigd** vereist een volgens de providerdocumentatie voldoende ontvangstbewijs van een daadwerkelijk aangemaakt/gepubliceerd object. Voor asynchrone providers is een aanmaak-ID onvoldoende; volg de vereiste statuscheck/webhook.
- **Uitkomst onbekend** is nodig bij een timeout ná mogelijk extern succes. Zoek eerst het bestaande object op; maak niet blind een duplicaat.
- **Mislukt** bevat een veilige, concrete oorzaak en een toegestane vervolgstap. Een verlopen verbinding vraagt herverbinden; ongeldige inhoud vraagt aanpassen en herbeoordelen.

De adapter ondersteunt `prepare`, `publish`, `readStatus`, `handleReceipt`, `reconcile` en waar de provider dit ondersteunt `update/remove`. Dit zijn implementatieverantwoordelijkheden, geen verzonnen providerendpoints. Valideer de actuele API, accountsoort, scopes, mediabeperkingen en review-eisen aan officiële providerdocumentatie vóór koppeling.

### Idempotentie en concurrentie

De server genereert een deterministische sleutel per club + bijdrage + revisie + bestemming + beoogde actie. Een dubbele klik, retry, herstart of dubbele webhook mag niet tot een tweede extern bericht leiden. Leg provider-ID's vast voordat de lease wordt vrijgegeven. Unieke sleutels en atomaire claim/release beschermen workers tegen dubbele uitvoering.

Gebruik begrensde retries met backoff voor tijdelijke fouten. Permanente fouten en ontbrekende autorisatie blijven zichtbaar en worden niet eindeloos herhaald. Verouderde taken worden vóór verzending gestopt. Ontvangen webhooks worden geverifieerd, op event-ID gededupliceerd en alleen op de bijbehorende tenant/account/taak toegepast. Verlies van webhooks kan via statusopvraging worden hersteld.

Een exportdownload of handmatige deelactie is een **export**, geen bewezen externe publicatie. Handmatig gedeeld kan als zelfgerapporteerd worden gelabeld en hoort niet in de telling van geverifieerde kanaalpublicaties.

## 8. Scorecorrectie en wedstrijdwaarheid

Thuis-/uitlogica moet kloppen voor een thuiswedstrijd én een uitwedstrijd. Controleer scores als niet-negatieve gehele getallen met een redelijke invoergrens; geen willekeurige tekst of negatieve getallen. Een strafschoppenserie wordt apart van de reguliere score opgeslagen.

Correctie gebeurt via een duidelijke actie bij wedstrijd en bijdrage: oude score → nieuwe score → reden → betrokken concepten en publicaties bekijken → bevestigen. Sla actor, tijd en bron op. Wijzig alleen scoregegevens die werkelijk bij de betreffende wedstrijd horen.

- Open concepten kunnen worden bijgewerkt met herkenbare bronversie.
- Goedgekeurde of ingeplande content krijgt een nieuwe revisie en verliest de oude publicatierechtiging voor de nieuwe inhoud.
- Bevestigde externe berichten blijven gekoppeld aan hun oude snapshot. Toon welke een correctie nodig hebben. Alleen ondersteunde kanaalbewerkingen mogen bestaande posts aanpassen; anders is een afzonderlijk correctiebericht nodig.
- Een reeds samengesteld weekendoverzicht wordt als verouderd gemarkeerd wanneer een opgenomen bron wijzigt. Opnieuw samenstellen toont het verschil en vraagt nieuwe goedkeuring.
- Import mag een handmatige correctie niet ongemerkt overschrijven. Toon bronconflicten met bronmoment en laat een bevoegde gebruiker oplossen.
- Teams waarvoor geen uitslagen gepubliceerd mogen worden, krijgen een verhaals-/fotomoment zonder score in de render, caption, export of het weekendoverzicht. Neem in de pilot O10-1 als expliciet testgeval op.

## 9. Autosave en herstel

Bewaar concepten lokaal tijdens invoer en synchroniseer ze met revisiecontrole naar de server. Een herlaadactie, tabsluiting, slechte verbinding of lege telefoonbatterij mag een reeds bevestigde serverversie niet verliezen. Gebruik stabiele concept-ID's; opnieuw openen maakt geen tweede bijdrage.

Een stagingoplossing kan IndexedDB voor tijdelijke lokale documenten/uploads gebruiken. Gebruik geen onbeperkte base64-foto's in localStorage. Bewaarstatus, laatste serverbevestiging en conflictsituatie zijn zichtbaar. Bij onvoldoende lokale opslag blijft de fout zichtbaar en kan de gebruiker de inhoud veilig afronden of exporteren.

Bij offline indienen blijft de bijdrage als nog niet gesynchroniseerd staan. De UI mag niet doen alsof de clubredactie deze al heeft ontvangen. Na herstel krijgt de server het concept maximaal één keer. Een upload telt pas als bruikbaar wanneer objectopslag en metadata beiden bevestigd zijn.

Gelijktijdig bewerken: stuur `expectedRevision`/equivalent mee. Bij conflict geen stil `last write wins` op goedgekeurde inhoud. Toon de opgeslagen versie en eigen wijzigingen; laat opnieuw toepassen of een apart concept maken. Logoff of wisselen van club voorkomt dat een lokaal concept naar de verkeerde tenant wordt verstuurd.

## 10. Foto's, namen en publicatievoorkeuren

Foto- en naamvoorkeuren zijn productinstellingen die bij publiceren daadwerkelijk worden afgedwongen. Deze specificatie geeft geen juridische vrijwaring; de club bepaalt welke regels en toestemmingsgrond zij hanteert.

- Mogelijke naamweergave: volledige naam, voornaam + initiaal, alleen voornaam, anoniem. Club- en teaminstellingen leveren een standaard; persoonsvoorkeuren kunnen restrictiever zijn. De strengste toepasselijke beperking wint.
- Foto: onbekend, toegestaan voor geselecteerde doelen of niet toegestaan. Onbekend is geen automatische vrijgave. Een groepsfoto vraagt een expliciete bevestiging door de club/inzender volgens het eigen proces; een generieke checkbox mag persoonsbeperkingen niet omzeilen.
- Laat de preview de werkelijk publieke naam tonen. Houd interne namen los van caption/render; anonimiseer ook automatisch gegenereerde tekst en weekendoverzichten.
- Een geweigerde foto leidt naar kiezen van een toegestane foto, een neutrale clubvisual of een tekstvariant; niet alleen naar een waarschuwing die publicatie toelaat.
- Controleer de actuele beperking opnieuw bij uitvoeren van een publicatietaak. Intrekking na goedkeuring moet open taken tegenhouden en betrokken content aanwijzen.
- Bij intrekking na publicatie: toon de externe bestemmingen en start een aparte verwijder-/correctieworkflow waar technisch mogelijk. Beloof geen verwijdering zonder providerbevestiging.
- Scan/valideer uploads server-side op bestandstype, bestandsgrootte, afmetingen en veilige decodeerbaarheid. Geef objecten onvoorspelbare sleutels, private toegang en kortlevende weergavelinks. Vertrouw niet op de extensie of het `accept`-attribuut.
- Strip onnodige locatie-/apparaatmetadata in distributievarianten en voorkom onbeperkte openbare toegang tot originelen.

## 11. Automatische clubweek

De club kiest periode, teams, gewenste momenttypen, kanaalvoorkeuren en een templatefamilie. Maak eerst een overzicht van de bronwedstrijden en uitzonderingen. Na bevestigen ontstaan **concepten**, geen stil gepubliceerde berichten.

Voor ieder gegenereerd item: wedstrijd/bron-ID, brondatum/versie, generatieactie, template-ID/versie en deterministische sleutel. Herhaald genereren voor dezelfde club + periode + team + wedstrijd + momenttype levert geen dubbel bericht op. Een bewust gekozen tweede variant krijgt een eigen expliciete relatie.

V1-minimum: programmaoverzicht, wedstrijdaankondiging en einduitslagconcept. Opstelling en livegebeurtenissen blijven afhankelijk van daadwerkelijk ingevoerde gegevens. Ontbrekende scores krijgen nooit een verzonnen resultaat; 0–0 van een nog niet gespeelde wedstrijd is geen eindstand. Een afgelasting of gewijzigde aftrap markeert reeds gemaakte content voor controle.

Filters voor gekozen teams en periode blijven bewaard. De werkvoorraad toont wat klaar is, wat foto/broncontrole vraagt en wat al bestaat. Voor een nieuwe proefclub worden geen voorbeeldclubwedstrijden als echte eigen gegevens overgenomen.

## 12. Sponsorafspraken

Een afspraak bevat sponsor, periode, teams, contenttypen, plaatsing, logo/tekst, kanalen en gewenste frequentie. Houd de definitie klein: bijvoorbeeld wedstrijdsponsor bij thuiswedstrijd, jeugdsponsor bij jeugdoverzicht en partner bij het weekendoverzicht.

Toepassen gebeurt bij het samenstellen van de revisie, zodat de beoordelaar ziet welke sponsor publiek verschijnt. Sponsorwijzigingen na goedkeuring zijn inhoudswijzigingen. Verlopen afspraken krijgen geen nieuwe automatische plaatsingen. Bij overlappende afspraken toont de UI de gekozen prioriteit of vraagt een keuze; een logo wordt niet onleesbaar klein gemaakt om alles te passen.

Rapportage maakt onderscheid tussen gepland, opgenomen in concept, geëxporteerd, zelfgerapporteerd gedeeld en door kanaal bevestigd. Alleen de laatste categorie telt als geverifieerde uitvoering van een kanaalafspraak. Bereik, impressies en clicks mogen alleen als gemeten worden getoond als een echte bron beschikbaar is, met meetmoment en betekenis. Geen berekende fictieve sponsorwaarde als feit presenteren.

Exporteer een controleerbaar maandoverzicht met datum, kanaal, contenttitel, afspraak, revisie en externe link/receipt. Een gemiste afspraak verschijnt als aandachtspunt en wordt niet automatisch als nagekomen afgevinkt.

## 13. Weekendoverzicht

Selecteer periode en teams; toon beschikbare uitslagen en goedgekeurde verhalen/foto's. De redactie kiest opnames en volgorde. Geef alle teams de mogelijkheid om zichtbaar te worden zonder openbare prestatieranglijst. Het systeem mag deelname of prestaties die niet uit een bron blijken niet verzinnen.

V1 maakt een uitslagenoverzicht en een bewerkbaar tekst-/fotobericht met korte terugblik. Gebruik alleen inhoud die voor de gekozen publieke doelen beschikbaar is. Een ongekeurde foto komt niet via een overzicht alsnog publiek. Bewaar de gebruikte bronrevisies; corrigeer of markeer veroudering na een score-, foto- of naamwijziging.

Het overzicht is zelf een bijdrage met eigen revisie, review en kanaaljobs. Herhaald samenstellen is een nieuwe versie van hetzelfde overzicht, tenzij de gebruiker expliciet een tweede overzicht kiest. Een preview, PNG/SVG-export en caption moeten dezelfde selectie en naamweergave tonen.

## 14. Server- en adapterarchitectuur voor staging

Behoud de bestaande frontend en renderer. Voeg een duidelijke repository/servicegrens toe tussen schermen en opslag. De demoadapter gebruikt lokale fictieve data; de stagingadapter gebruikt geauthenticeerde serverrequests, objectopslag en een duurzame publicatiewachtrij. Een buildflag alleen mag echte credentials niet veilig lijken te maken: secrets staan uitsluitend server-side.

Benodigde serververantwoordelijkheden:

1. Identiteit en uitnodigingen; sessies en team-/tenantrechten.
2. Atomaire mutaties met revisievergelijking en append-only historie.
3. Uploadvoorbereiding, validatie, private opslag en exportafgeleiden.
4. Rendering of vastlegging van exact de goedgekeurde weergave, met lokale fonts/assets reproduceerbaar beschikbaar.
5. Duurzame jobs met idempotentie, leases, retries en herstel.
6. Kanaalautorisatie en veilige credentialrotatie, providerresponse en receipts.
7. Databronimport met syncmoment, bronconflicten en handmatig alternatief.
8. Waarschuwingen, audit, betrouwbare rapportages en supportreadback.

Een achtergrondtaak mag niet alleen in het geheugen van een webproces bestaan. Een herstart moet geplande taken kunnen hervatten zonder dubbele publicatie. Voorzie migraties, versiebeheer, indexen op tenant + status/tijd en een herstelpad. De specifieke database- en queueproducten worden gekozen na inspectie van de bestaande staginginfrastructuur.

### Logische API-acties

| Actie | Essentiële servercontrole |
|---|---|
| Concept bewaren | Actor/team, tenant, verwacht revisienummer, geldig mediaschema |
| Indienen | Compleetheid, media klaar, voorkeuren, actuele revisie |
| Goedkeuren/terugsturen | Redactierecht, exacte revisie/hash, reden/audit |
| Inplannen | Actuele goedkeuring, bestemming/account, tijdzone, unieke jobsleutel |
| Correctie doorvoeren | Wedstrijdrecht, oude/nieuwe score, reden, bronconflict, afhankelijke content |
| Clubweek genereren | Gekozen teams binnen club, bronversies, deduplicatie |
| Sponsor koppelen | Clubbevoegdheid, geldige periode, audit, revisie-impact |
| Overzicht samenstellen | Bronselectie binnen club, vrijgave, snapshot |
| Taak herhalen | Status/retrybeleid, actuele revisie, idempotentiesleutel, mogelijke externe uitkomst |
| Receipt verwerken | Providerhandtekening, accountbinding, deduplicatie en geldige statusovergang |

Voeg rate limits en uploadquota toe die passen bij vrijwilligersgebruik. Toon bij een limiet een herstelbare fout; verlies het concept niet.

## 15. Observability en veilige bediening

Iedere keten krijgt een correlatie-ID. Log minimaal indienen, revisiewijziging, goedkeuring, inplannen, annulering, poging, ontvangstbevestiging, fout en correctie. Gebruik geen access tokens, privéfoto's, volledige persoonsnamen of volledige webhookpayloads in algemene logs.

Meet technische uitkomsten: tijd tot serverbewaarbevestiging, leeftijd van oudste open taak, aantal wachtende/onbekende/mislukte taken, retries, kanaalbevestiging per bestemming en bronnen die niet meer syncen. Bereken de berichtstatus uit de kanaaltoestanden, niet uit een optimistisch clientlabel.

Platformsupport ziet standaard technische metadata. Voor inzage in clubinhoud is een geautoriseerde supportactie nodig met doel, duur en audit. Voor een gebruiker moet duidelijk zijn of gegevens lokaal, in staging of in een echte externe omgeving worden gewijzigd.

Een publicatiepauze stopt nieuwe verzendingen maar bewaart bestaande jobs en historie. Hervatten mag verouderde revisies niet vrijgeven. Een noodstop hoort bereikbaar te zijn voor de bevoegde beheerder.

## 16. Afbeeldingen, templates en export

De bronrepository bevat `public/assets/` met clublogo's, foto-voorbeelden, fonts en template-atlassen. Houd de bestanden offline in het pakket, niet alleen als tijdelijke links. De standaardcatalogus staat in `src/templateCatalog.ts`; de rendering in `src/SelectedTemplatePoster.tsx`, `src/Poster.tsx` en `src/templateAtlas.ts`; de Studio in `src/Studio.tsx`.

De 27 namen zijn: Penseelkracht, Scheurlijn, Betonstof, Lino inkt, Zeefdruk, Houtskool, Spuitbus, Kopieerkunst, Papiervouw, Verfmes, Zijdegolf, Vloeibaar metaal, Waterkracht, Snelheid, Titanium, Stadionlicht, Pixelsprong, Sluitertijd, Sportkrant, Filmarchief, Zwitsers sport, Tactiekatlas, Spotlak, Goudpers, Clubhuis, Sportgrip en Carbon.

De template-atlassen bevatten grafische effecten met transparante fotoruimte. Lever ze ongewijzigd mee, inclusief de gebruikte fonts en aanwezige licentieteksten. Bewaar een assetmanifest met relatieve bestandsnaam, type, grootte en SHA-256. Documenteer demoafbeeldingen als demonstratiemateriaal; voeg bij echte clubfoto's het eigen rechtenproces toe.

Controleer per ondersteund formaat dat tekst niet overloopt, gezichten niet onnodig worden afgesneden en de foto geen onverwachte kleurfilter krijgt. Export moet wachten tot atlas, afbeeldingen en fonts gereed zijn; een lege of halfgeladen render is een fout, geen downloadsucces.

## 17. Staging-inrichting en uitrolvolgorde

### Stap 1 — Inspectie zonder wijzigingen aan productie

Lees bestaande repo-instructies, deploymentworkflow, domeinen, databases, auth en opslag. Identificeer staging expliciet. De Sites-projectidentiteit hoort bij het prototype en is niet automatisch de identiteit of hostconfiguratie van de VPS-staging. Kopieer geen privécredentials uit browsers, gitremote of overdrachtspakket.

### Stap 2 — Reproduceerbare frontend

Installeer met het meegeleverde lockbestand, voer `npm run check` en `npm run build` uit en serveer `dist/` met correcte base-/assetpaden. Voeg alleen een dev/preview-script toe als de bestaande stagingworkflow dat nodig heeft. Behoud het ontwerp; een complete redesign is geen acceptatievoorwaarde.

### Stap 3 — Backend en tenantgrenzen

Koppel het gekozen servermodel, opslag, identiteit en migraties. Gebruik uitsluitend fictieve pilotdata tot tenantisolatie en uploadbeveiliging aantoonbaar werken. Maak een export/snapshot vóór migraties en leg rollback vast.

### Stap 4 — Volledige interne keten

Maak mobiel concept → upload → indienen → exacte revisie goedkeuren → plannen → wachtrij → demonstratieadapter betrouwbaar. De adapter mag niet als echt kanaal worden gelabeld. Laat fouten, gewijzigde revisies en herstel bewust doorlopen.

### Stap 5 — Externe kanalen afzonderlijk aansluiten

Verifieer per provider de geldige accountsoort en scopes via de officiële documentatie. Sluit een eigen testaccount aan. Voer één gecontroleerde externe publicatie uit, lees het resultaat extern terug en controleer idempotentie en fouten. Alleen geteste bestemmingen krijgen een live-label. Geen fictieve verbindingen als aangesloten tonen.

### Stap 6 — Clubweek, sponsor en overzicht

Sluit actuele bronnen aan waar toegang beschikbaar is. Bewaar een handmatige invoerroute. Controleer deduplicatie, scorecorrectie en alle vrijgaven over de volledige keten.

### Stap 7 — Pilot en terugrol

Gebruik de drie fictieve clubscenario's uit paragraaf 20 voor acceptatie. Daarna maximaal enkele uitgenodigde echte verenigingen, elk met een bevoegde clubbeheerder en duidelijke stagingaanduiding. Start met een beperkte set bevestigde kanalen. Publicatienoodstop en contact voor fouten zijn bekend.

### Configuratiecategorieën

Leg namen en doel van variabelen vast in een voorbeeldbestand zonder waarden: app-origin, omgeving, databaseverbinding, private objectopslag, auth/redirects, queue/worker, providercredentials en webhooksecret, bronadapter, logging/monitoring. Publieke frontendconfiguratie bevat geen secrets. In dit document staan bewust geen verzonnen variabelen die een bestaand deployscript zouden overschrijven.

## 18. Acceptatietests: kernketen

Deze matrix is het te behalen testplan. De definitieve `VERIFICATIE.md` vermeldt per geval uitgevoerd/geslaagd/mislukt/niet uitgevoerd met bewijs en omgeving. Geen vinkje op basis van alleen code-inspectie.

| ID | Scenario | Verwachte uitkomst |
|---|---|---|
| A01 | Mobiel 390 px: wedstrijd en moment openen | Hoofdvelden en primaire actie bruikbaar zonder horizontale scroll |
| A02 | Foto kiezen en score/titel invullen | Preview gebruikt gekozen foto en juiste gegevens |
| A03 | Concept herladen | Laatste bevestigde versie komt terug zonder duplicaat |
| A04 | Verbinding valt weg tijdens typen | Inhoud behouden; lokaal/niet gesynchroniseerd zichtbaar |
| A05 | Upload breekt af | Geen fictief bruikbaar beeld; hervatten/vervangen mogelijk |
| A06 | Teammanager dient in | Alleen eigen team; redactie ziet actuele revisie |
| A07 | Twee keer op indienen drukken | Eén bijdrage/indiening, geen dubbel reviewitem |
| A08 | Redacteur stuurt terug met feedback | Auteur ziet reden en kan nieuwe revisie indienen |
| A09 | Redacteur keurt revisie 2 goed | Goedkeuring noemt exact revisie 2/hash |
| A10 | Auteur verandert titel na goedkeuring | Nieuwe revisie; opnieuw beoordelen; oude open jobs onbruikbaar |
| A11 | Wijzig foto, sponsor, score of naamvoorkeur na goedkeuring | Iedere publieke inhoudswijziging heeft dezelfde invalidatie |
| A12 | Kalender probeert ongekeurde versie te plannen | Server weigert, duidelijke reden in UI |
| A13 | Goedkeuring en wijziging tegelijk | Eén consistente uitkomst; stale actor krijgt revisieconflict |
| A14 | Kanaal accepteert asynchrone verwerking | Status wacht op bevestiging; nog geen publicatiesucces |
| A15 | Kanaal bevestigt echte publicatie | Extern ID en receipt vastgelegd; juiste bestemming bevestigd |
| A16 | Instagram wacht, Facebook bevestigd, X mislukt | Alle drie toestanden zichtbaar, geen volledig groen succes |
| A17 | Herhaalde klik/retry/dubbele webhook | Maximaal één extern bericht per actie/revisie/bestemming |
| A18 | Timeout na mogelijk provider-succes | Uitkomst onbekend; eerst reconciliatie, geen blinde kopie |
| A19 | Token verlopen of account losgekoppeld | Job stopt met concrete herverbindingsactie |
| A20 | Worker herstart tijdens uitvoering | Duurzame taak hervat/reconcilieert zonder duplicaat |
| A21 | Wijzig revisie terwijl job wacht | Worker controleert opnieuw en stopt verouderde verzending |
| A22 | Demo-adapter geeft receipt | UI vermeldt demobevestiging; geen claim echte socialpublicatie |

## 19. Acceptatietests: gegevens, privacy en automatisering

| ID | Scenario | Verwachte uitkomst |
|---|---|---|
| B01 | Thuiswedstrijd score 3–2 corrigeren naar 2–2 | Correct thuis/uit, audit met reden, afhankelijke content gemarkeerd |
| B02 | Uitwedstrijd eigen team wint | Eigen/opponent-score niet omgedraaid in formulier, render of caption |
| B03 | Negatieve/decimale/leeg ongeldige score | Validatie; geen onbedoelde omzetting naar 0–0 |
| B04 | Correctie na al bevestigde publicatie | Oude receipt behouden; apart gevolgde correctie mogelijk |
| B05 | Bronimport wijkt af van handmatige correctie | Conflict zichtbaar; geen stille overschrijving |
| B06 | Foto niet toegestaan of onbekend | Geen publicatie met betreffende foto; alternatief beschikbaar |
| B07 | Anonieme/voornaamvoorkeur | Juiste publieke naam in afbeelding, caption, export en overzicht |
| B08 | Fotorecht ingetrokken vóór workeruitvoering | Open publicatie tegengehouden met reden |
| B09 | Bestand heeft verkeerde MIME/overschrijdt limiet | Server weigert veilig; conceptinhoud behouden |
| B10 | Club A vraagt object/content/job van club B op | Server weigert, ook met geraden ID of aangepaste body |
| B11 | Team A probeert team B te wijzigen | Server weigert; UI-verborgen zijn is niet de test |
| B12 | Platformbeheer zoekt clubbijdragen zonder supportgrant | Geen inhoudelijke inzage |
| B13 | Clubweek twee keer genereren | Geen dubbele concepten voor dezelfde sleutel |
| B14 | Wedstrijd heeft geen eindstand | Geen verzonnen uitslag; ontbrekende data zichtbaar |
| B15 | Aftrap wijzigt of wedstrijd wordt afgelast | Bestaande concepten krijgen controle-/verouderingssignaal |
| B16 | O10-1 heeft scorepublicatie uit | Geen score in alle publieke varianten en overzicht |
| B17 | Sponsorafspraak is verlopen | Niet automatisch toegevoegd aan nieuw moment |
| B18 | Sponsorconcept zonder receipt | Niet opgenomen als geverifieerde publicatie |
| B19 | Eén bijdrage bevestigd op twee kanalen | Rapport toont kanaalplaatsingen en unieke bijdrage apart |
| B20 | Weekendoverzicht gebruikt onvrijgegeven foto | Foto uitgesloten of blokkade; geen moderatieomweg |
| B21 | Bronrevisie wijzigt na samenstellen overzicht | Overzicht gemarkeerd; nieuwe controle vóór verzending |
| B22 | Nieuwe lege proefclub | Geen voorbeeldspelers, wedstrijden of sponsors als eigen data |
| B23 | Clubkleuren wisselen | Beide kleuren toegepast; foto behoudt eigen kleuren |
| B24 | Standaardcollectie openen | Exact de gekozen 27 IDs, geen planblokkade op defaults |
| B25 | Clubmaatwerk voor club A openen als club B | Niet beschikbaar; platformbron blijft beschermd |
| B26 | PNG/SVG-export in vier formaten | Correct formaat, fonts/beelden geladen, geen tekstoverloop |
| B27 | Browseropslag vol of serverbewaren mislukt | Eerlijke foutmelding; geen vals bewaard-succes |
| B28 | Publicatiepauze aan en daarna uit | Geen verzending tijdens pauze; daarna actuele controles |
| B29 | Zomer-/wintertijd en andere browserzone | Planning volgt clubtijdzone; opgeslagen tijdstip eenduidig |
| B30 | Toetsenbord en reduced motion | Formulieren/modals navigeerbaar, labels/focus zichtbaar, beweging beperkt |

## 20. Pilotweekend met drie fictieve verenigingen

### SC Getijde — brede clubredactie

Blauw/wit, zes teams, één redacteur en twee teammanagers. Laat O14-1 een foto en uitslag indienen; Eerste elftal krijgt een wedstrijdaankondiging. Maak een clubweek, beoordeel bijdragen, plan twee kanalen en laat één kanaal bewust mislukken. Corrigeer daarna de O14-score en controleer revisies, taken en weekendoverzicht.

### FC Havenlicht — kleine vrijwilligersbezetting

Rood/zwart, weinig beheertijd en handmatige wedstrijdinvoer. Maak mobiel een concept met slechte verbinding, sluit de pagina en herstel later. Dien opnieuw in zonder duplicaat. Gebruik een geldige sponsorafspraak en exporteer een verslag. Controleer dat een export niet als bevestigde kanaalpublicatie wordt geteld.

### SV Noordhaven — jeugd en meerdere belangen

Groen/goud, restrictieve jeugdnaamweergave, O10 zonder publieke scores en één persoon zonder fotovrijgave. Stel een overzicht samen met meerdere teams. Test uitsluiting van de foto, naamweergave, sponsorperiode, scoreonderdrukking en toegang vanuit een andere clubsessie.

### Vast pilotdraaiboek

Vrijdag: clubinrichting, gebruikers/rechten, broncontrole, clubweek genereren, sponsorafspraken en twee concepten laten beoordelen. Zaterdag: mobiel aanleveren, foutcorrectie, één offlineherstel, meerdere kanaaluitkomsten en een herhaalde taak. Zondag: resultaten controleren, weekendoverzicht samenstellen, goedkeuren en publiceren/exporteren. Maandag: sponsorrapport en foutenlog beoordelen, tijd per handeling en onbeantwoorde aandachtspunten noteren.

Voor ieder pilotgeval: noteer club, accountrol, start/eind, actie, verwachte uitkomst, werkelijke uitkomst, bewijs en eventuele herstelactie. Meet tijd tot eerste bruikbare bijdrage, aandeel teams dat aanlevert, aantal revisieproblemen, onterecht succes, duplicaten en verloren concepten. Tijdswinst en bereik zijn pas feiten na een echte meting.

## 21. Releasecriteria, rollback en resterende besluiten

### Blokkerend voor een echte pilot

- Alle kerninvarianten rond revisie, tenantrechten en kanaalbevestiging aantoonbaar getest.
- Geen secrets of echte accountcredentials in frontend, zip, logs of screenshots.
- Eén externe testpublicatie per vrijgegeven bestemming met externe readback en bewaard receipt; niet aangesloten kanalen duidelijk uitgeschakeld.
- Hersteltest voor workerherstart, dubbele ontvangst, onbekende provideruitkomst en conceptverlies geslaagd.
- Foto-/naamregels en O10-scorebeperking werken in render én alle tekst-/overzichtsroutes.
- Back-up/snapshot en terugrol naar vorige appversie beschikbaar; databasemigratie heeft een afzonderlijk herstelplan.
- Publieke demo en staging tonen de juiste omgeving; fictieve gegevens blijven herkenbaar.

### Terugrollen

Pauzeer eerst nieuwe externe taken. Bewaar receipts en auditgegevens. Draai de app terug naar de vorige geteste release; herstel database/objecten alleen via het vooraf geteste herstelpad. Oude externe posts verdwijnen niet door een code-rollback. Reconcilieer nog onbekende provideruitkomsten voordat verzending opnieuw wordt vrijgegeven. Documenteer welke jobs moeten blijven geannuleerd om dubbele verzending te voorkomen.

### Te beslissen op basis van de werkelijke stagingomgeving

Codex moet tijdens inspectie vaststellen: stagingrepository/branch en domein, bestaande identiteit en database, opslag/queue/worker, gekozen eerste providers, beschikbare testaccounts/API-toegang, beschikbare Sportlinkbron en beheerders, bewaartermijnen en clubbeleid voor jeugdmedia. Dit zijn configuratie- en implementatievoorwaarden; het prototype mag ze niet als gereed voorstellen.

### Oplevervolgorde voor Codex

1. Reproduceer de meegeleverde website en leg actuele commit/omgeving vast.
2. Sluit identiteit, tenantrechten, conceptopslag en media aan.
3. Maak exacte revisiegoedkeuring en de publicatiewachtrij transactioneel.
4. Implementeer provideradapter + receipt/reconciliatie en bewijs één echte bestemming.
5. Rond clubweek, sponsorafspraken, scorecorrectie en weekendoverzicht af.
6. Voer de acceptatiematrix uit en los blokkerende fouten op.
7. Laat de drie pilotclubs het volledige weekendscenario doorlopen.
8. Lever een feitelijk verificatieverslag, resterende beperkingen en een werkende staging-URL op. Gebruik het woord werkend alleen voor daadwerkelijk geteste functies.

