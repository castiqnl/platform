# Castiq UI integratie en stagingacceptatie

De interface uit het overdrachtspakket is geïntegreerd op werkbranch `codex/platform-ui-integration`, vanaf `d1513d7eda83db2a0a7583ce31d300d2a5eda606`. Cockpit, verenigingenbeheer, Template Studio, kanaalbeheer en pakketkeuze gebruiken centrale servergegevens. Echte socialpublicatie en financiële verwerking blijven uitgeschakeld. Deze wijziging is nog geen geactiveerde stagingrelease.

## Herkomst en behouden contracten

Het pakket `Castiq-Overdrachtspakket-2026-11-23.zip` is uitgepakt met controle op padtraversal en symlinks. Alle 322 vermeldingen in `SHA256SUMS` kloppen. De enkele integratiepatch `Castiq-platform-UI-d1513d7-naar-e847aac.patch` is op een schone werkboom gecontroleerd en eenmaal toegepast. De alternatieve Sites-patches zijn niet toegepast. `website/` is als visuele referentie gebruikt; de modulebeschrijvingen onder `handleiding/` zijn gelezen.

De oorspronkelijke checkout bevatte ander, nog niet vastgelegd werk. Dat is behouden. De integratie staat in een afzonderlijke worktree `.local/ui-integration`; alle onderstaande paden zijn relatief aan die worktree.

De bestaande Vite-configuratie, dependencylockfile, vier publieke buildvariabelen, identiteitstoetsing, releaseworkflows, migraties 001–008 en exacte-SHA-admission zijn behouden. `npm test` voert naast de bestaande domeintests ook de nieuwe templatemodel- en renderproeven uit. Providercredentials worden uitsluitend als private serverconfiguratie gelezen.

## Werking per module

| Onderdeel | Werking in servermodus | Open afhankelijkheid |
| --- | --- | --- |
| Compacte shell en cockpit | Eigen overzicht; brongewijze tellingen en aandachtspunten uit `/api/admin/operations`. Nul, onbekend en eerdere gegevens bij een verversfout blijven onderscheidbaar. | Migraties en beperkte runtimegrants op de doelomgeving. |
| Verenigingen en rechten | Bestaande aanmaak- en membership-API; aparte verenigingentabel, paginering, registratieoverzicht en behoud van invoer bij fouten. | Werkelijke accountregistratie en toestemming in staging blijven accountgebonden acceptatie. |
| Kanaalmonitor | Alleen operationele identifiers, clubnaam, kanaal, status, revisie, poging en tijdstippen. Geen clubtekst, foto's, concepten, spelers of providerpayload. Sandboxbewijs wordt als sandbox getoond. | Echte publicatieadapter ontbreekt en wordt niet automatisch geactiveerd. |
| Template Studio | Centrale concepten, activering, toewijzing, revisiecontrole, audit en onveranderlijke publicaties; 27 ingebouwde SVG-stijlen en vier canvasformaten. Serverfouten openen geen lokale vervangbibliotheek. | Migratie 009 en eerste centrale initialisatie. Initialisatie is idempotent en gebeurt vóór gebruik. |
| Clubtemplates en bijdragen | Alleen actieve, toegewezen templates in nieuwe keuzes; server selecteert en valideert het ontwerp. Een bijdrage bewaart haar eigen templateversie en layouts. Oudere bijdragen blijven bruikbaar na uitschakelen, herpubliceren of intrekken van toewijzing. | Bestaande bijdragen zonder managed snapshot behouden hun bestaande renderpad; geen stilzwijgende historische migratie. |
| Partnerlaag | Bij openen, opslaan en publiceren opnieuw beschermd: vaste geometrie, vergrendeld, bovenaan, niet groepeerbaar of verwijderbaar. Clubuitvoer gebruikt de vastgelegde `partnerLogo`-keuze. | Nieuwe branding geldt vanaf nieuwe bijdragen, niet met terugwerkende kracht. |
| Kanalen | Clubgebonden, servergestuurde OAuth voor Instagram Login, Facebook Pages en X. Eenmalige state, browsernonce, X PKCE, versleutelde tijdelijke en actieve tokens, expliciete accountselectie, statuscontrole, intrekken en herverbinden. | Providerapps, goedgekeurde scopes, callbacks en geheime configuratie. Geen werkelijke providerverbinding is in deze opdracht bewezen. |
| Koppeling en sandbox | Verbinding, statuscontrole, wachtrij en bevestigde sandboxuitkomst blijven afzonderlijk. Intrekken blokkeert nieuwe opdrachten/retries en niet-verzonden werk; de worker controleert de bestemming opnieuw. Verlopen koppelingen vragen opnieuw koppelen. | Automatisch vernieuwen van tokens en echte providerpublicatie zijn niet geïmplementeerd. |
| Pakketten | Centrale prijsvoorstellen in gehele eurocenten; Gratis vereist branding, betaalde pakketten vragen expliciete deelname voor standaard 10% korting. Centrale beleidsversies en CAS; prijs, branding en template worden bij nieuwe bijdrage vastgelegd en in revisie/publicatiepayload bewaard. | Bevestigde commerciële voorwaarden, btw-/facturatiegegevens, contracten en betaalprovider. `billingStatus=not_activated`. |
| Privacy en platformmail | Bestaande privacy- en mailmodules blijven bereikbaar via de compacte navigatie. Platformdata blijft beperkt tot de bestaande bevoegdheden. | Externe mailaflevering en Supabase OTP/Google-configuratie zijn afzonderlijke acceptaties. |

## Uitgevoerde controles

De browserproeven gebruiken een wegwerpdatabase op localhost met uitsluitend synthetische accounts en clubs. De echte localhost-PostgreSQL wordt gebruikt voor transacties, migraties, row locks en immutable triggers; providerverkeer wordt in de providerproeven afgevangen door een expliciete testadapter. Geen providerbericht of betaling is verstuurd.

| Kernflow | Uitgevoerde controle en bewijs | Resultaat |
| --- | --- | --- |
| Types en bestaande workflow | `npm run check`; bestaande tijdzone-/publicatiedomeintests. | Geslaagd. |
| Templatemodel en SVG | `tests/template.model.test.mjs`, `tests/template.rendering.test.mjs`; generatorcontrole `node src/template-studio/generate-seeds.mjs --check`. | Geslaagd: vier formaten, partnerlaag, effecten, stapelvolgorde, versiebehoud en vrije/proportionele/exacte resize. |
| Releasegrens | `npm run test:release`. | 24 Node- en 40 Python-proeven geslaagd; admission en rollbacktests behouden. |
| Centrale templateopslag | `tests/server.templates.test.ts`. | HTTP-/Postgres-proeven voor platformautorisatie, 27 seeds, twee tenants, schema, CAS, audit, immutable historie en beperkte rol zonder RLS-bypass geslaagd. |
| Cockpit en tenantgrens | `tests/server.platformOperations.test.ts`, bestaande autorisatie- en clubinstellingentests. | Veilige whitelist, volledige tellingen bij afgekapt detail, bronfouten, verlopen rechten en geweigerde directe requests geslaagd. |
| Providerauthorisatie en pakketten | `tests/server.channelPlans.test.ts`. | Geweigerde/verlopen toestemming, dubbele en gelijktijdige callbacks, andere tenant, reconnect, statusfout, intrekking en retry, versleuteling en prijs-/brandingshistorie geslaagd. Dit zijn provideradapterproeven. |
| Bijdrage naar revisie en wachtrij | `tests/server.contentSnapshots.test.ts`. | Vervalste client-snapshots genegeerd; Gratis-branding verplicht; prijs en ontwerp blijven bij bewerken en queue gelijk; ingetrokken bestemming bereikt de workeradapter niet. Mogelijk al verzonden werk behoudt de status onbevestigd. |
| Breed en mobiel | `tests/browser/platformOperations.spec.ts`, `tests/browser/channelsPlans.spec.ts`, bestaande `workflow.spec.ts` en account-/privacyproeven. | Geslaagd in de volledige browserronde. Platform, twee clubtenants en teamrol worden gebruikt. Een trage achtergrondrespons overschrijft geen nieuwere revisie; Gratis-branding blijft in vier echte server-PNG-exports staan. |
| Studio-interactie en exports | `tests/browser/templateStudio.spec.ts`. | Geslaagd in de volledige browserronde. Centrale opslag en herladen, groeperen, vergrendelen, laagvolgorde, effecten, resize en publicatie; bestaande PNG/SVG-export in alle vier formaten. |
| Assets en juridische archieven | `npm run verify:assets`, `npm run verify:legal`, `npm run build`. | 50 assethashes en drie exacte juridische teksten gecontroleerd; Vite-build geslaagd; ook een lokale staging-build met fictieve publieke authwaarden slaagt. Die laatste is geen inzetbaar stagingartifact. |

Afgeronde lokale acceptatie: beide TypeScript-controles, 34 domein-/model-/renderproeven, 95 servertests, 30 browserproeven, 24 Node-releasechecks en 40 Python-releasechecks geslaagd. De volledige browserronde duurde 1,4 minuut. Ook de asset-, juridische, generator- en buildcontroles slagen. De precieze branch-SHA is via `git rev-parse codex/platform-ui-integration` vast te leggen; pas de uiteindelijke main-SHA kan voor release worden toegelaten. Lokale screenshots en browsertraces staan onder `.local/evidence/` en `test-results/`; zij zijn geen opname van de stagingomgeving.

## Providervereisten gecontroleerd op 23 november 2026

Instagram gebruikt de bestaande rechtstreekse **Instagram Login**-route voor professionele accounts, met `instagram_business_basic` en `instagram_business_content_publish`. Toegang voor andere clubs vereist de toepasselijke Meta-review/Advanced Access. De nieuwe Unified Login-route vraagt een afzonderlijke portfolio-/configuratie-inrichting en is hier niet geïmplementeerd. De keuze om Creators alleen feed aan te bieden is een beperking van deze aansluiting, geen bewering dat het huidige Meta-beleid Stories voor alle Creators verbiedt. [Instagram Business Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login), [Unified Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login).

Facebook gebruikt Facebook Login, expliciete selectie uit toegestane Pages en de Page-tokenroute met `pages_show_list`, `pages_read_engagement` en `pages_manage_posts`. Accountselectie wordt opnieuw aan de actuele clubrol gekoppeld. [Pages API](https://developers.facebook.com/documentation/pages-api/getting-started), [handmatige OAuth-flow en state](https://developers.facebook.com/documentation/facebook-login/guides/advanced/manual-flow/).

X gebruikt OAuth 2.0 Authorization Code met S256 PKCE, serverauthenticatie en expliciete scopes, waaronder `offline.access` voor refresh/revoke. Opnieuw koppelen is het geïmplementeerde herstel bij verlopen toegang. [X Authorization Code](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code), [X user access tokens](https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token).

Een providergrant of geslaagde statuscontrole bewijst geen publicatie. Echte publicatie vereist daarnaast mediaoverdracht, publicatiestatus en controle van een providerreceipt. Die adapters ontbreken. [Instagram content publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing.md).

Benodigde private servernamen zijn `CHANNEL_TOKEN_ENCRYPTION_KEY` en per provider `INSTAGRAM_`, `FACEBOOK_` of `X_` met suffix `CLIENT_ID`, `CLIENT_SECRET`, `APPROVED_SCOPES` en eventueel `API_VERSION`. De encryptiesleutel moet afzonderlijk van mail-/privacy-sleutels worden beheerd. Geen waarde hoort in Git, browserconfiguratie of logs.

De bestaande root-owned releasehelper accepteert momenteel uitsluitend de bestaande runtimevariabelen en `PRIVACY_RETENTION_EXECUTE`. Deze bronintegratie verandert dat toelatingscontract niet. Werkelijke providerconfiguratie op de VPS vereist eerst een afzonderlijk gereviewde uitbreiding van die private runtime-toelating en de bijbehorende hosthelper; extra GitHub-buildvariabelen zijn daarvoor niet bedoeld. Zonder die uitbreiding blijven koppelingen zichtbaar ongeconfigureerd en geblokkeerd.

## Huidige staging en eerstvolgende release

Readonly gecontroleerd op 23 november 2026: `https://staging.castiq.nl/api/health` en `/api/readiness` zijn gezond voor bestaande SHA `f38e8f77963761157315accfb6d96140f0cae9bb`. Niet-aangemeld verenigingenbeheer geeft 401. Staging heeft migraties 001–008, één club, twee accounts, één clubrol en één platformrol; een teamrol en expliciet aangemerkte synthetische kanaaltestaccounts ontbreken. De mail-API is ongeconfigureerd. Deze controle wijzigt geen accounts of database.

Volg [DG-RELEASE.md](DG-RELEASE.md) voor iedere stap:

1. Review en integreer deze werkbranch op `main`. Leg de volledige 40-tekens SHA van het resultaat vast. De branch-SHA is niet automatisch de uiteindelijke main-SHA.
2. Wacht op de nieuwste **push**-CI `Castiq local acceptance`, job `verify`, op exact die main-SHA. Iedere voorgeschreven stap moet `completed/success` zijn. Een groene branch-/PR-run is geen release-toelating.
3. Bouw uitsluitend een stagingkandidaat:

   ```sh
   gh workflow run castiq-dg-vps-08-staging-build.yml \
     --repo castiqnl/platform --ref main \
     -f environment=staging -f sha=VOLLEDIGE_MAIN_SHA
   ```

4. Beoordeel migraties `009_template_library.sql` en `010_channel_plans.sql`. Gebruik de geautoriseerde stagingbeheerverbinding voor DDL; de runtime heeft geen migratierecht. Verifieer checksumtracking, bestaande data, conditional runtimegrants en RLS zonder bypass. Initialiseer de templates via de centrale API en controleer dat er 27 ingebouwde ontwerpen zijn. Bewaar een versleutelde backup en bewijs geïsoleerd herstel.
5. Beoordeel expliciet rollbackcompatibiliteit. De bestaande releasehelper labelt kandidaten als `castiq-schema-v8`. De nieuwe migraties voegen tabellen toe; het label alleen bewijst geen compatibiliteit. Test de huidige gezonde oude app op een geïsoleerd uitgebreid schema voordat `database_migrated_and_compatible` waar wordt gezet. Verander het label of de root-owned helper niet stilzwijgend om de gate te passeren. Code-rollback draait migraties niet terug.
6. Controleer actuele `current`/`previous` en het gezonde runtimepaar op de staginghost. Laat de rootbeheerder de bestaande `activation-readiness.json` voor de uiteindelijke SHA en het juiste runtimeprofiel invullen met werkelijk uitgevoerde backup-/restore-, private-access- en isolatiebewijzen. Een rootflag is geen vervanging voor die proeven.
7. Activeer pas daarna uitsluitend staging:

   ```sh
   gh workflow run castiq-dg-vps-08-staging-activate.yml \
     --repo castiqnl/platform --ref main \
     -f environment=staging -f sha=VOLLEDIGE_MAIN_SHA \
     -f candidate_id=GEVERIFIEERDE_KANDIDAAT_ID \
     -f runtime_config_id=GEVERIFIEERD_RUNTIMEPROFIEL
   ```

8. Controleer HTTPS health/readiness op exact die SHA, anonieme 401, platformgrenzen en centrale template-/pakketmutaties. Gebruik een expliciete testclub, een tweede gescheiden testclub en een bevoegde teamrol. Nodig accounts alleen via de afgesproken stagingaccountprocedure uit. Test echte OTP/Google-login, mobiel en desktop. Pas na geconfigureerde providerapps volgen echte toestemming, weigeren, verlopen/reconnect, dubbele callback en intrekking met eigen testaccounts. Gebruik de sandbox voor queue, failure, timeout en retry; verwacht geen externe publicatie.

Er is geen nieuwe kandidaat gebouwd of geactiveerd en productie is ongewijzigd. Main-integratie, groene push-CI, database-/rollbackbewijs, host-readiness en werkelijke stagingacceptatie staan nog open. De bestaande gezonde release kan niet als testresultaat van deze werkbranch worden opgevoerd.
