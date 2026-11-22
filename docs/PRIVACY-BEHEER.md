# Privacybeheer en bewaarkalender

Versie 22 november 2026. Deze instructie beschrijft uitvoerbare voorzieningen en de resterende verificatie. Een lokale test met een testadapter is geen bewijs van verwijdering bij Supabase, Resend, Stackmail of een back-upleverancier.

## Vastgelegde regels

`003_privacy.sql` scheidt de persoon (`privacy_accounts`), lidmaatschappen en de clubwerkruimte. Verwijdering van een persoon heeft geen cascade naar clubcontent, sponsorafspraken, gepubliceerde versies, clubmedia of de clubovereenkomst. De toepasselijke regels staan in `server/privacyTime.ts`, versie `2026-11-22.1`:

| Gegevens | Start | Deadline |
| --- | --- | --- |
| Onafgeronde registratie | Eerste opgeslagen registratiegegeven, inclusief geverifieerde Auth-aanmaak wanneer van toepassing | 7 verstreken dagen |
| Zelf aangevraagde verwijdering | Bevestigde servertransactie | 30 verstreken dagen; onmiddellijk normale toegang blokkeren |
| Persoonlijke inactiviteit | Laatste geverifieerde bewuste activiteit; aanvankelijk afronding registratie | 90 verstreken dagen, zonder extra hersteltermijn |
| Afgesloten privacyzaak | Afsluiting | 12 kalendermaanden |
| Minimaal wisbewijs | Voltooide actieve wissing | 210 verstreken dagen |
| Back-up | Aanmaak, nooit kopieer- of herstelmoment | Uiterlijk 180 verstreken dagen |
| Afgehandelde supportmail | Traceerbaar afsluiten supportvraag | 12 kalendermaanden |

Dagen zijn UTC-duur van 24 uur. Kalendermaanden behouden de UTC-tijd en begrenzen op de laatste dag van de doelmaand. De gebruikersweergave gebruikt `Europe/Amsterdam`.

## Persoonlijke accounts en toegang

- `ensureAccount` gebruikt een eerste registratiegebeurtenis die de server heeft geverifieerd. Herhaalde callbacks en waarschuwingen verlengen de termijn niet. `createdForRegistration` mag alleen waar zijn voor een identiteit die uitsluitend voor deze registratie is gemaakt; een bestaande identiteit of losse uitnodiging mag daardoor niet worden gewist.
- Een afgebroken of verlopen concept bij een al bestaande, uitgenodigde of beheerde identiteit verwijdert niet die Auth-identiteit of clubrollen. De conceptgegevens worden opgeruimd; alleen een minimale afgeschermde blokkadestatus voorkomt dat oude callbacks de registratie voortzetten. Een nieuwe poging vereist een recente echte sessiestart na het vervallen of afbreken, met een verse identiteitsbevestiging. Tokenverversing en passief openen herstellen de poging niet. De historische `first_registration_at` blijft onveranderd; de nieuwe poging krijgt een eigen vaste zeven-dagenstart.
- Een zelf aangevraagde verwijdering tijdens een uitsluitend voor registratie aangemaakte signup blokkeert direct en zet de uitvoeringsdeadline op het vroegste van nu en de oorspronkelijke zeven-dagengrens. Er ontstaat geen nieuwe dertig-dagentermijn. Bij een bestaande/beheerde identiteit breekt de route uitsluitend de registratie af; een nieuwe bewuste aanmelding is nodig voordat opnieuw voorwaarden kunnen worden aanvaard.
- Nieuwe persoonlijke registratie vereist servervalidatie van de actuele voorwaardenversie en hash. De privacyverklaring is informatie, geen verplichte toestemming. Clubacceptatie vereist daarnaast de verwerkersovereenkomst, actieve clubbevoegdheid en een expliciete bevestiging van vertegenwoordigingsbevoegdheid. Persoonlijke aanvaarding verleent geen clubbevoegdheid.
- De exacte documenttekst wordt onveranderbaar opgeslagen in `legal_documents`. Een gewijzigd document met dezelfde versie en afwijkende inhoud/hash wordt geweigerd.
- Een normale login, tokenverversing, GET, passieve synchronisatie of mailopening telt niet als activiteit. Alleen `session_start` met een door de server geverifieerde oorspronkelijke sessiestart, of een doelbewuste gebruikersactie, mag `activity` aanroepen. Dubbele en verouderde gebeurtenissen verlengen de deadline niet; een gebeurtenis na de geldige deadline heractiveert het account niet.
- Zelf verwijderen en expliciet herstellen vereisen een maximaal tien minuten oude identiteitsbevestiging. De applicatie controleert de accountstatus bij elke beschermde aanvraag, ook bij een nog geldig provider-token en bij media. Normaal aanmelden trekt een verwijderverzoek niet in.
- Herstel is uitsluitend mogelijk vóór de bestaande deadline en vóór definitieve wissing. Nog geldige rollen blijven beschikbaar; verlopen of door de club ingetrokken rechten herleven niet.
- `transferAdministration` wijst een bestaande actieve gebruiker van dezelfde club aan als medebeheerder. De voorganger verliest daardoor niet stilzwijgend zijn rol. De laatste beheerder krijgt vooraf een overdrachtswaarschuwing. Een nieuwe beheerder na definitieve wissing vereist aparte verificatie van clubbevoegdheid; herstel daarvoor nooit het gewiste persoonlijke account.

## Registratie vanaf Supabase Auth

`006_auth_registration_capture.sql` installeert alleen wanneer `auth.users` aanwezig is een beperkte trigger. Een nieuwe normale e-mail-/Google-aanmelding krijgt onmiddellijk een registratierecord met de oorspronkelijke Auth-aanmaakdatum, ook als de OTP nooit wordt bevestigd. Een losse uitnodiging begint pas bij bevestiging én de eerste sessiestart; die uitnodigingsidentiteit wordt niet uitsluitend wegens onafgeronde appregistratie gewist. Een expliciet beheerd account of bestaand platformbeheerderslidmaatschap wordt als `provisioned` onderscheiden. Alleen serverbeheerde appmetadata en bestaande databasebevoegdheden kunnen die classificatie bepalen; `user_metadata` verleent geen rechten.

Bestaande Auth-identiteiten krijgen alleen inventarismetadata, geen verzonnen registratie-/activiteitstijd. `auth_registration_sources` bewaart de bron `signup`, `pending_invitation`, `provisioned` of `unknown`. Bij de eerste bewuste appregistratie gebruikt de backend voor een normale signup het vastgelegde `first_registration_at`; bij bestaande/onbekende/beheerde identiteiten wordt een nieuwe bewuste registratiestart geverifieerd. Behoud het onderscheid met een al bestaand persoonlijk account. De trigger kent geen rollen toe, valideert geen voorwaarden en verandert geen bewuste activiteit bij tokenverversing.

## Bestaande accounts zonder betrouwbare tijdstempels

De migratie kent geen verzonnen activiteit en geen retroactieve acceptaties toe. Deze accounts hebben `reliable_activity=false` en aanvankelijk geen inactiviteitsdeadline.

Een privacybeheerder plant via `beginTransition` een toekomstige start en laat de mededeling via de gewone mail-outbox versturen. De termijn begint pas nadat `syncTransitionAnnouncements` een bijbehorend bevestigd afleveringsbewijs vindt dat uiterlijk op die start is afgegeven. Een enqueue, providerrequest, geblokkeerde mail of bounce bevestigt de aankondiging niet. Bij te late levering moet de beheerder een nieuwe toekomstige start aankondigen. De eerdere geplande datum wordt niet met terugwerkende kracht actief.

`retentionTick({dryRun:true})` geeft uitsluitend aantallen en voert niets uit. Bewaar dit proefrapport per omgeving zonder namen, e-mailadressen, tokens of clubcontent. Vergelijk categorieën en onderzoek onverwachte aantallen vóór vrijgave.

## Verzoeken en werkvoorraad

Openbare route: `POST /api/privacy/requests` met `kind`, `email` en `message`. De route bevestigt niet of iemand een account heeft. Dezelfde gelijktijdige aanvraag wordt transactioneel gededupliceerd; de oorspronkelijke ontvangst- en reactiedatum blijven staan. Ondersteunde soorten: `access`, `rectification`, `erasure`, `restriction`, `portability`, `objection`, `withdrawal`, `other`.

`GET /api/privacy/cases` toont alleen noodzakelijke zaakmetadata aan platformprivacybeheer. Wijs een zaak expliciet toe voordat de behandelaar via `GET /api/privacy/cases/:id` de contactgegevens en toelichting opent. Die inzage wordt gelogd. Clubcontent wordt via deze route niet toegankelijk.

1. Bevestig ontvangst en controleer de verantwoordelijke partij. Vraag alleen bij redelijke twijfel proportionele verificatie. Leg geen identiteitsbewijs in een openbaar tekstveld vast.
2. Wijs de zaak toe en behandel vóór de UTC-deadline van één kalendermaand. Bij clubgegevens stemt Castiq af met de verantwoordelijke club.
3. `PATCH .../:id` ondersteunt `assign`, `extend` en `close`. Verlenging vereist een concrete reden en wordt met de Castiq-template `privacy_extension` aangekondigd. Enqueue of provideracceptatie wijzigt de reactiedatum niet. De oorspronkelijke termijn blijft gelden totdat een bijbehorend afleveringsbewijs vóór de eerste deadline is vastgelegd. Pas dan stelt `syncCaseExtensions` maximaal twee extra kalendermaanden vast. Een bounce, ontbrekend bewijs of te late aflevering laat de oorspronkelijke deadline staan; de werkvoorraad toont de aangekondigde verlenging als onbevestigd. De behandelaar volgt dat op vóór afloop van de oorspronkelijke termijn.
4. Gecontroleerde persoonlijke export is beschikbaar via `POST /api/privacy/export`, met recente identiteitsbevestiging. Deze JSON bevat uitsluitend het eigen account, eigen rollen/acceptaties en eigen privéconcepten. Clubcontent vraagt een afzonderlijke geverifieerde instructie van de club.
5. Een geverifieerd eerder wisverzoek krijgt `blockDeletion(identity,{reason:'verified_rights_request',immediate:true,requireRecent:false})` via een bevoegde interne behandelaar. Roep deze functie nooit aan op basis van alleen een openbaar opgegeven e-mailadres. De producthersteltermijn mag een geldig eerder AVG-verzoek niet vertragen.
6. Bevestig voltooiing van wissing pas na een geslaagd `executeDeletion`; noem resterende back-ups, wettelijke uitzonderingen, clubcontent en zelfstandige externe kopieën afzonderlijk. Informeer ontvangers wanneer dat vereist is.
7. Sluiten verwijdert de contactgegevens, toelichting en verificatienotitie uit `privacy_case_details`. De minimale zaakmetadata vervalt na twaalf kalendermaanden. Beoordeel openstaande en te late zaken regelmatig.

De applicatie heeft geen betaalprovider, consumentencheckout of automatische opzeg-/factuurprocedure toegevoegd. Clubexport, overstappen en clubsluiting lopen via een geverifieerde clubinstructie en de gepubliceerde contactroute totdat daarvoor afzonderlijk afgesproken termijnen en een geteste uitvoeringsroute zijn vastgelegd. Een persoonlijke accountactie beëindigt de clubovereenkomst niet.

## Wissing, fouten en onafhankelijke wisreferenties

`blockDeletion` blokkeert toegang in een transactie, verwijdert lokale sessies, bewaart de exacte deadline, plant bevestigingsmail en schrijft de onafhankelijke blokkade. Globale Auth-intrekking wordt via een serveradapter uitgevoerd. Mislukte mail maakt de blokkade niet ongedaan; `privacy_mail_failures` en outboxstatussen maken fouten zichtbaar. `ledgerPending` en `revocationPending` zijn open acties, geen succesbewijs.

De HMAC-sleutel `PRIVACY_LEDGER_HMAC_KEY` is een apart hostgeheim van minimaal 32 bytes, uniek per omgeving. Het register bevat alleen een stabiele technische referentie, bereik, tijden, status en resultaat; geen inhoud, naam of e-mailadres. Bewaar het buiten de productdatabase en de herstelde productback-up, bijvoorbeeld in het eigen `shared/privacy-ledger`-pad. Neem dat pad niet op in gewone productback-ups. Verifieer voor eventuele aparte kopieën ook de uiterste bewijsduur of een passend sleutelvernietigingsbeleid; een tweede kopie zonder begrensde lifecycle is geen geverifieerde oplossing.

Een beheerder initialiseert alleen een aantoonbaar nieuwe lege omgeving met `initializeFileDeletionLedger(directory,{environmentId:'castiq-vps08-staging',confirmedEmptyScope:true})` (voor productie de eigen site-ID). Dit maakt een versie-2-register met een willekeurige register-ID en een apart continuïteitsbewijs op `directory + '.continuity.json'`. De marker staat buiten de app-schrijfbare registermap en gewone productback-ups: root-eigendom, alleen leesbaar voor de eigen appgroep. De app en worker verwachten expliciet hun eigen omgevings-ID. Een ontbrekende map, ontbrekend bestand, beschadigde inhoud, afwijkende register-ID of andere omgeving geeft een fout; lezen en schrijven initialiseren nooit stilzwijgend een lege geschiedenis. Initialiseren weigert een bestaande marker of een niet-lege registermap. Herinitialiseer een verdwenen register nooit als nieuwe lege omgeving: herstel het geverifieerde onafhankelijke register, met behoud van identiteit en geschiedenis, in quarantaine.

`createFileDeletionLedger` schrijft atomair met exclusieve lock, bestandssynchronisatie en hernoemen. Een achtergebleven lock na procesuitval geeft een zichtbare fout. Verwijder zo'n lock alleen nadat vastgesteld is dat geen schrijver meer actief is; wis daarbij nooit het register. `reconcileLedger` herstelt ontbrekende blokkade-/herstelbewijzen vanuit de duurzame taakstatus. Een herstelbewijs wordt na 180 dagen verwijderd; een voltooid wisbewijs uiterlijk 210 dagen na de oorspronkelijke voltooiing, ook bij retries.

`executeDeletion` heeft een taaklease, herhaalbare deelstappen en een zichtbare foutstatus. Het verwijdert persoonlijke toegang, lidmaatschappen, accountgegevens, lokale sessies, eigen privéconcepten en eigen dienstmails. Persoonsreferenties in gedeelde technische historie worden gepseudonimiseerd. Clubcontent en de bevroren inhoud van clubpublicatieversies blijven onder beheer van de club. Alleen persoonlijke uploads die niet in overblijvende clubgegevens of revisies worden gebruikt, worden via de verplichte mediaadapter verwijderd. Een ontbrekende Auth-, media-, mail- of ledgeradapter laat de taak openstaan; dat wordt nooit als voltooide wissing gemeld.

## Destructieve uitvoering blijft standaard uit

`privacy_retention_control.destructive_enabled` is standaard `false`. Uitvoering vereist daarnaast vastgelegde verificatie van:

- het niet-destructieve proefrapport;
- een werkelijke geïsoleerde back-uphersteltest met herhaalde wissingen;
- de overgang en communicatie voor bestaande accounts;
- lifecycle en herstelkopieën van werkelijk gebruikte providers.

De deployment mag deze velden niet automatisch invullen. Het backend ondersteunt de uitvoeringsroute, maar deze vlaggen zijn geen bewijs op zichzelf. Laat een bevoegde beheerder de concrete bewijsreferenties vastleggen vóór de beperkte vrijgave. De huidige unit- en integratietests zijn geen vervanging voor providerverificatie. Herhaalde taken of waarschuwingen wijzigen geen oorspronkelijke deadlines.

## Back-ups, Stackmail en herstel

`createPrivacyOperations` registreert back-ups met vaste aanmaakdatum en supportvragen met expliciete geïsoleerde mailbox-/berichtreferenties. `purge({dryRun:true})` inventariseert alleen. Echte purge vereist een ingestelde provideradapter, expliciete bevestiging, receipt-ID en geen resterende beheerde kopieën. Zonder adapter of bevestiging blijft de status `failed`, nooit `purged`. De code zoekt of verwijdert niet generiek in gedeelde mailboxen.

Voor Stackmail ontbreken nog verificatie van contractpartij/reseller, accountregio, subverwerkers, mailboxscheiding, expunge, bijlagen, verzonden/archief/prullenbak, doorsturing en providerback-ups. Test de adapter eerst met een afgescheiden testmailbox en bewaar alleen technische receipts. Voor providerback-ups moeten ook snapshots, incrementele ketens, exportbestanden en herstelkopieën zijn geïnventariseerd. Het registreren van een deadline in Castiq bewijst niet dat een provider die uitvoert.

Herstelprocedure:

1. Herstel uitsluitend in een geïsoleerde database/opslagomgeving met publieke toegang, uitgaande mails en publicaties geblokkeerd. Gebruik geen productiepool om een herstelproef te registreren.
2. `prepareRestore` weigert een back-up die 180 dagen oud is. Het maakt een quarantainerecord en leest het onafhankelijke register. Pas iedere nog geldige blokkade/wissing opnieuw toe via de meegegeven adapter, in alle teruggezette datastores, sessies, media, indexen en wachtrijen. De applicatie weigert normale toegang zolang een quarantainerecord openstaat.
3. `reapplied` betekent alleen dat de adapteraanroepen zijn afgerond. Controleer afzonderlijk dat geen gewiste identiteit, privéconcept, media, mail-outboxitem of andere persoonlijke kopie terugkomt. Controleer ook dat clubcontent en andere leden intact blijven.
4. Controleer opnieuw de actuele onafhankelijke ledger en eventuele nog niet gesynchroniseerde taken. Leg de verificatie vast en laat een bevoegde operator pas daarna de herstelde omgeving vrijgeven. Er is geen openbare API die herstel automatisch vrijgeeft.
5. Laat geen verlopen of onvolledig gecontroleerde kopie als nieuwe back-up verschijnen met een vernieuwde aanmaakdatum. Houd de oudste relevante aanmaakdatum en verwijderdatum aan.

## Getest en nog extern te verifiëren

`node --env-file-if-exists=.env.local --test tests/server.privacy.test.ts` gebruikt uitsluitend een eigen tijdelijke localhostdatabase en een tijdelijk filesystemregister. Het test 7/30/90/180/210-daggrenzen, twee twaalfmaandstermijnen, zomertijd, dubbele callbacks/aanvragen, oude documentversies, clubbevoegdheid, herstel, multi-clubrollen, overdracht, mailfouten, een mislukte wisdeelstap, herhaling zonder termijnverlenging en herstelquarantaine. De provideradapters in deze tests zijn expliciete testadapters, geen externe diensten.

Werkelijke Supabase-Auth-intrekking/wissing, Resend-aflevering, beperkte serverrollen, objectopslag, Stackmail-expunge en providerback-upretentie vragen afzonderlijke omgevingsbewijzen. Publicatiekanalen blijven de bestaande expliciete sandbox zolang officiële adapters en kanaalbewijzen ontbreken.
