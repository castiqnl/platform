# Post for Me Quickstart — Castiq staging

Scope: Facebook en professionele Instagramaccounts op `https://staging.castiq.nl`.
Documentatie gecontroleerd op 24 november 2026. Productie, X, betalingen en
Android-/Play-distributie worden door deze wijziging niet geactiveerd.

## Vindplaatsen en eenmalige inrichting

Platformbeheer: **Providerapps → Post for Me**,
`https://staging.castiq.nl/#/platform/providers`.
Clubbeheer: **Koppelingen**, `https://staging.castiq.nl/#/club/channels`.
De server controleert de actuele platform-/clubrol en het actieve clublidmaatschap;
het verbergen van een knop verleent geen bevoegdheid.

1. Maak in Post for Me een afzonderlijk project **Castiq Staging** van het type
   **Quickstart**. Schakel Facebook en Instagram in met de providercredentials
   van Post for Me. Verenigingen zien **Post for Me** in het toestemmingsscherm.
   Een groene providerstatus in dat dashboard is nog geen clubkoppeling.
2. Neem het echte project-ID uit het dashboard over in Castiq. De lees-API
   retourneert geen project-ID bij de sleuteltest; Castiq vraagt daarom het ID
   afzonderlijk om de callback tegen het verwachte project te controleren.
3. Bewaar de stagingproject-API-sleutel in het afgeschermde Castiq-formulier.
   De sleutel wordt versleuteld met de bestaande afzonderlijke server-side
   kanaalsleutel. De browser ontvangt uitsluitend **Ingesteld / Niet ingesteld**.
   Een lege sleutelinvoer behoudt de opgeslagen waarde.
4. Stel in **Post for Me-dashboard → Castiq Staging-project → Project Redirect
   URL** het volgende vaste adres in en klik **Update**:

   ```text
   https://staging.castiq.nl/api/integrations/post-for-me/callback
   ```

5. Klik in Castiq op **Test API-verbinding**. Dit voert uitsluitend
   `GET https://api.postforme.dev/v1/social-accounts?limit=1&offset=0` uit.
   Accountgegevens worden weggegooid; alleen de geschoonde teststatus en het
   tijdstip worden bewaard. De test registreert geen webhook.
6. Klik afzonderlijk op **Webhook registreren**. Castiq zoekt eerst de exacte URL,
   hergebruikt een bestaande registratie en bewaart het webhookgeheim versleuteld.
   De bestaande registratie blijft behouden bij opnieuw controleren of bij
   sleutelrotatie binnen hetzelfde gecontroleerde project. De URL is:

   ```text
   https://staging.castiq.nl/api/integrations/post-for-me/webhook
   ```

7. Schakel na een geslaagde sleuteltest de functionaliteit in en bewaar. De
   integratie begint uitgeschakeld. Dit geeft nog geen toegang tot een clubaccount.

Sleutelvervanging schakelt de functionaliteit uit en vraagt een nieuwe API-test.
Bij bestaande clubkoppelingen controleert Castiq met de vervangende sleutel eerst
een bekend account in hetzelfde project. Een projectwissel blijft geblokkeerd
zolang actieve koppelingen of onzekere verzendingen bestaan. Een lopende
koppelpoging moet eerst worden afgerond of geannuleerd.

## Koppelen per vereniging

1. Een bevoegde clubbeheerder kiest in de eigen club **Koppelingen → Facebook
   koppelen** of **Instagram koppelen**. Clubbeheerders voeren geen API-sleutel in
   en hoeven het Post for Me-dashboard niet te openen.
2. Facebook: log bij Meta in met het eigen beheerdersaccount en kies het bedoelde
   bedrijf en de eigen clubpagina. Instagram: gebruik de rechtstreekse
   Instagram-route met een Business- of Creator-account. Castiq vraagt expliciet
   `platform_data.instagram.connection_type=instagram` en uitsluitend postrechten.
3. Na terugkeer verifieert Castiq de browsercookie, ingelogde sessie, gebruiker,
   clubrol, provider, project en geldigheid van de eenmalige context. Quickstart
   stuurt geen Castiq-state terug en gebruikt geen dynamische redirect-override.
4. Castiq haalt kandidaataccounts via de geauthenticeerde API op en vergelijkt
   hun `external_id`, provider, fysieke account-ID en historische clubclaims.
   Gegevens van andere clubs verschijnen niet. Onbetrouwbare kandidaten krijgen
   geen publicatierecht; de bestaande clubkoppeling blijft behouden.
5. De beheerder kiest en **bevestigt** het bedoelde account. Alleen deze bevestigde
   koppeling geeft publicatierecht. Annuleren, een callback of een webhook kan
   nooit zelfstandig een kanaal activeren.

De vaste clubreferentie is `castiq:staging:<club-ID>`. Eén beheerder kan meerdere
clubs bedienen, maar iedere club doorloopt een eigen koppelcontext. Een actieve
poging kan niet stilzwijgend door een nieuwe worden vervangen. Pogingen vervallen
na tien minuten. Accountclaims blijven bestaan bij herverbinden; een provider-ID
kan niet ongemerkt naar een andere Castiq-club verhuizen.

De leveranciersdocumentatie verschilt op dit punt: de oudere multi-useruitleg
spreekt over het bijwerken van een bestaand account, terwijl de actuele
auth-url-specificatie een andere bestaande `external_id` weigert. Castiq vertrouwt
op geen van beide als tenantbeveiliging en controleert eigen claims plus de
daadwerkelijke API-respons. De regressietest met één beheerder in twee clubs en
meerdere pagina's gebruikt een gecontroleerde provider. De overeenkomstige live
proef staat open totdat toegestane testaccounts beschikbaar zijn.

## Goedkeuring, planning en afzonderlijke kanaalresultaten

- De bestaande ontwerp-, revisie- en goedkeuringsflow blijft de bron. Een wijziging
  aan inhoud, brongegevens of privacykeuzes maakt de eerdere goedkeuring ongeldig.
- Planning blijft in Castiq en wordt in UTC verwerkt. Castiq geeft een toekomstige
  post pas bij het publicatiemoment aan Post for Me. Een ingetrokken, afgekeurde
  of ontkoppelde toekomstige opdracht wordt daardoor niet later alsnog extern
  aangeboden.
- Vlak vóór elke nieuwe verzending worden de globale publicatieflag, ingeschakelde
  integratie, club, goedgekeurde revisie, publicatieregels en huidige koppeling
  opnieuw gecontroleerd. Een API-read controleert ook het externe account en de
  clubreferentie, zodat een gemiste accountwebhook geen publicatierecht behoudt.
- Elke kanaalopdracht heeft een duurzaam verzendjournaal en een unieke externe
  referentie per poging. Bij een time-out wordt eerst op die referentie gezocht;
  Castiq verstuurt niet blind opnieuw. Een gemelde aanvraag-ID of `processing`
  geldt niet als een gepubliceerd bericht.
- De definitieve afbeelding wordt vanuit de bestaande private opslag gerenderd
  als JPEG. Feed: 1080×1350; Story: 1080×1920; maximaal 8 MB. Alleen de bevroren,
  goedgekeurde publicatie krijgt een ondertekende URL met maximaal één uur
  geldigheid. Een gewijzigde goedkeuring, pauze of ontkoppeling blokkeert die URL.
- Alleen een werkelijk positief resultaat voor het bedoelde doelaccount met
  platformpost-ID bevestigt **Gepubliceerd**. **Bekijk bericht** verschijnt als
  een geldige providerlink beschikbaar is. Facebook en Instagram hebben ieder
  hun eigen resultaat; bij gedeeltelijk succes wordt uitsluitend het mislukte
  kanaal opnieuw geprobeerd.
- Een reeds direct verzonden opdracht die de provider verwerkt, kan niet
  gegarandeerd worden tegengehouden. Een exact herkende externe concept- of
  geplande opdracht wordt waar mogelijk ingetrokken; andere onzekere opdrachten
  blijven uitsluitend voor resultaatcontrole in beeld. Een latere echte
  bevestiging blijft zichtbaar, ook na ontkoppeling of een nieuwe inhoudsversie.

## Webhooks en herstel

De ontvanger controleert de gedocumenteerde header
`Post-For-Me-Webhook-Secret` en de envelope `{event_type,data}`. Vereiste events:
`social.post.result.created`, `social.account.created` en `social.account.updated`.
Er wordt geen unieke provider-event-ID verondersteld. Een digest van geschoonde
identiteitsvelden dedupliceert de duurzame inbox. Volledige providerpayloads,
tokens, autorisatielinks en diagnostische gegevens worden niet opgeslagen of
gelogd. Bekende extra postevents worden veilig bevestigd en genegeerd.

Een 2xx-antwoord volgt pas nadat de kleine inboxmelding duurzaam is opgeslagen.
Bij een mislukte ontvangst volgt een foutstatus zodat Post for Me kan herleveren.
De worker gebruikt de lees-API als bron voor actuele accountstatus en resultaten;
oude of herhaalde events kunnen een succesvolle bevestiging niet terugdraaien
of een lokaal ontkoppeld account opnieuw activeren. Zonder webhook volgt een
begrensde controleslag met wachttijd. Na de limiet vraagt Castiq expliciete
controle in plaats van een nieuwe, mogelijk dubbele verzending.

Ontkoppelen blokkeert nieuwe verzendingen en annuleert toekomstige Castiq-taken.
Alleen het gecontroleerde eigen provideraccount wordt op afstand ontkoppeld.
Eerdere externe berichten en de publicatiehistorie worden niet gewist. Bij een
onzekere intrekking blijft het kanaal geblokkeerd met een leesbare melding.

## Stagingrelease en verificatie

De normale workflow blijft: branch/PR-CI, integratie op `main`, volledige CI op
de exacte main-SHA, stagingkandidaat bouwen, versleutelde pre-migratieback-up met
geïsoleerd herstel, migratie 015, kandidaatproef, kandidaatgebonden readiness en
de bestaande stagingactivatieworkflow. Compatibiliteit wordt schema-v15; een
gewone rollback naar de oude v14-worker is geblokkeerd. Alleen staging ontvangt
de migratie en de bijgewerkte releasehelper. De bestaande private runtimesleutel
wordt hergebruikt, zonder nieuwe publieke buildvariabelen.

Gerichte regressies gebruiken synthetische accounts en nagebootste provider-HTTP
met een tijdelijke PostgreSQL-database. De volledige testopzet omvat typechecks,
domein-/renderproeven, server- en privacytests, browserproeven, releasegrenzen,
asset-/juridische consistentie en de productiebuild. De exacte uitgevoerde
release en aantallen staan na activatie in [STATUS.md](STATUS.md) en het
bijbehorende uitrolbewijs.

Er is nog geen Post for Me-projectsleutel of expliciet toegestaan live testkanaal
aangeleverd. De code, gesimuleerde integratie en staginggrenzen zijn testbaar;
een echte OAuth-toestemming, webhookaflevering en Facebook-/Instagrampost zijn
pas bewezen na de handmatige inrichting en een afzonderlijk toegestane testpost.

## Officiële bronnen

- [Actuele API-specificatie](https://api.postforme.dev/docs)
- [Quickstart versus White Label](https://www.postforme.dev/resources/quickstart-vs-white-label-project)
- [Quickstart-platformtoegang](https://www.postforme.dev/resources/quickstart-api-access-level)
- [Callbacks en accountwebhooks](https://www.postforme.dev/resources/handling-account-connection-redirects-and-webhooks)
- [External IDs](https://www.postforme.dev/resources/linking-data-with-external-ids)
- [Meerdere gebruikers](https://www.postforme.dev/resources/multi-user-applications)
- [Planning en levenscyclus](https://www.postforme.dev/resources/scheduling-and-managing-the-post-lifecycle)
- [Resultaten per account](https://www.postforme.dev/resources/getting-post-results)
- [Webhooks](https://www.postforme.dev/resources/real-time-updates-with-webhooks)
- [Ontkoppelen met behoud van historie](https://www.postforme.dev/resources/handling-account-disconnections)
- [Gescheiden omgevingen](https://www.postforme.dev/resources/setting-up-multiple-environments)
- [Officiële bron voor webhook-envelope](https://github.com/DayMoonDevelopment/post-for-me/blob/main/trigger/process-webhook-event.ts)
