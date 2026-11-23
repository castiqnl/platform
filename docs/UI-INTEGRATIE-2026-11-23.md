# Castiq UI integratie en stagingacceptatie

De interface uit het overdrachtspakket is via PR #2 op `main` geïntegreerd en op 23 november 2026 naar **[staging.castiq.nl](https://staging.castiq.nl)** uitgerold. Actieve applicatie-SHA na de kanaalwizardcorrectie: **`3cf040cf91e0e15c2fa2f7f52d82a48165f004d9`**. Zie [het herstelverslag](KANAALWIZARDS-2026-11-23.md) en [het aanvullende uitrolbewijs](deploy-evidence/staging-channel-wizards-2026-11-23.json). Cockpit, verenigingenbeheer, Template Studio, kanaalbeheer en pakketkeuze gebruiken centrale servergegevens. Echte socialpublicatie, financiële verwerking en definitieve automatische privacywissing blijven uitgeschakeld. Productie is ongewijzigd.

## Herkomst en behouden contracten

Het pakket `Castiq-Overdrachtspakket-2026-11-23.zip` is uitgepakt met controle op padtraversal en symlinks. Alle 322 vermeldingen in `SHA256SUMS` kloppen. De enkele integratiepatch `Castiq-platform-UI-d1513d7-naar-e847aac.patch` is op een schone werkboom gecontroleerd en eenmaal toegepast. De alternatieve Sites-patches zijn niet toegepast. `website/` is als visuele referentie gebruikt; de modulebeschrijvingen onder `handleiding/` zijn gelezen.

De oorspronkelijke checkout bevatte ander, nog niet vastgelegd werk. Dat is behouden. De integratie staat in een afzonderlijke worktree `.local/ui-integration`; alle onderstaande paden zijn relatief aan die worktree.

De bestaande Vite-configuratie, dependencylockfile, vier publieke buildvariabelen, identiteitstoetsing, releaseworkflows, migraties 001–008 en exacte-SHA-admission zijn behouden. `npm test` voert naast de bestaande domeintests ook de nieuwe templatemodel- en renderproeven uit. Providercredentials worden uitsluitend als private serverconfiguratie gelezen.

## Werking per module

| Onderdeel | Werking in servermodus | Open afhankelijkheid |
| --- | --- | --- |
| Compacte shell en cockpit | Eigen overzicht; brongewijze tellingen en aandachtspunten uit `/api/admin/operations`. Nul, onbekend en eerdere gegevens bij een verversfout blijven onderscheidbaar. | Migraties en beperkte runtimegrants zijn op staging toegepast/gecontroleerd; ingelogde gebruikersacceptatie blijft open. |
| Verenigingen en rechten | Bestaande aanmaak- en membership-API; aparte verenigingentabel, paginering, registratieoverzicht en behoud van invoer bij fouten. | Werkelijke accountregistratie en toestemming in staging blijven accountgebonden acceptatie. |
| Kanaalmonitor | Alleen operationele identifiers, clubnaam, kanaal, status, revisie, poging en tijdstippen. Geen clubtekst, foto's, concepten, spelers of providerpayload. Sandboxbewijs wordt als sandbox getoond. | Echte publicatieadapter ontbreekt en wordt niet automatisch geactiveerd. |
| Template Studio | Centrale concepten, activering, toewijzing, revisiecontrole, audit en onveranderlijke publicaties; 27 ingebouwde SVG-stijlen en vier canvasformaten. Serverfouten openen geen lokale vervangbibliotheek. | Staging is centraal geïnitialiseerd: 27 templates, 27 versies, 108 layouts; alle 108 partnerlagen zijn read-only gecontroleerd. Ingelogde Studio-acceptatie blijft open. |
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
| Bijdrage naar revisie en wachtrij | `tests/server.contentSnapshots.test.ts`. | Vervalste client-snapshots genegeerd; Gratis-branding verplicht; prijs en ontwerp blijven bij bewerken en queue gelijk; ingetrokken bestemming bereikt de workeradapter niet. Mogelijk al verzonden werk behoudt de status onbevestigd. Deze flow is ook met een databasepool van één verbinding getoetst; na commit wordt de transactieverbinding vrijgegeven vóór aanvullende catalogusreads. |
| Breed en mobiel | `tests/browser/platformOperations.spec.ts`, `tests/browser/channelsPlans.spec.ts`, bestaande `workflow.spec.ts` en account-/privacyproeven. | Geslaagd in de volledige browserronde. Platform, twee clubtenants en teamrol worden gebruikt. Een trage achtergrondrespons overschrijft geen nieuwere revisie; Gratis-branding blijft in vier echte server-PNG-exports staan. |
| Studio-interactie en exports | `tests/browser/templateStudio.spec.ts`. | Geslaagd in de volledige browserronde. Centrale opslag en herladen, groeperen, vergrendelen, laagvolgorde, effecten, resize en publicatie; bestaande PNG/SVG-export in alle vier formaten. |
| Assets en juridische archieven | `npm run verify:assets`, `npm run verify:legal`, `npm run build`. | 50 assethashes en drie exacte juridische teksten gecontroleerd; Vite-build geslaagd; ook een lokale staging-build met fictieve publieke authwaarden slaagt. Die laatste is geen inzetbaar stagingartifact. |

Afgeronde lokale acceptatie: beide TypeScript-controles, 34 domein-/model-/renderproeven, 95 servertests, 30 browserproeven, 24 Node-releasechecks en 40 Python-releasechecks geslaagd. De volledige browserronde duurde 1,4 minuut. Ook de asset-, juridische, generator- en buildcontroles slagen. De volledige push-CI op de uiteindelijke main-SHA `4c39c3a6cf099ff6655b29cee15c67712bb4c14a` is geslaagd en voor deze release toegelaten. Lokale screenshots en browsertraces onder `.local/evidence/` en `test-results/` blijven bewijs van lokale proeven; de afzonderlijke anonieme stagingcontroles staan hieronder.

## Providervereisten gecontroleerd op 23 november 2026

Instagram gebruikt de bestaande rechtstreekse **Instagram Login**-route voor professionele accounts, met `instagram_business_basic` en `instagram_business_content_publish`. Toegang voor andere clubs vereist de toepasselijke Meta-review/Advanced Access. De nieuwe Unified Login-route vraagt een afzonderlijke portfolio-/configuratie-inrichting en is hier niet geïmplementeerd. De keuze om Creators alleen feed aan te bieden is een beperking van deze aansluiting, geen bewering dat het huidige Meta-beleid Stories voor alle Creators verbiedt. [Instagram Business Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login), [Unified Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login).

Facebook gebruikt Facebook Login, expliciete selectie uit toegestane Pages en de Page-tokenroute met `pages_show_list`, `pages_read_engagement` en `pages_manage_posts`. Accountselectie wordt opnieuw aan de actuele clubrol gekoppeld. [Pages API](https://developers.facebook.com/documentation/pages-api/getting-started), [handmatige OAuth-flow en state](https://developers.facebook.com/documentation/facebook-login/guides/advanced/manual-flow/).

X gebruikt OAuth 2.0 Authorization Code met S256 PKCE, serverauthenticatie en expliciete scopes, waaronder `offline.access` voor refresh/revoke. Opnieuw koppelen is het geïmplementeerde herstel bij verlopen toegang. [X Authorization Code](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code), [X user access tokens](https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token).

Een providergrant of geslaagde statuscontrole bewijst geen publicatie. Echte publicatie vereist daarnaast mediaoverdracht, publicatiestatus en controle van een providerreceipt. Die adapters ontbreken. [Instagram content publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing.md).

Benodigde private servernamen zijn `CHANNEL_TOKEN_ENCRYPTION_KEY` en per provider `INSTAGRAM_`, `FACEBOOK_` of `X_` met suffix `CLIENT_ID`, `CLIENT_SECRET`, `APPROVED_SCOPES` en eventueel `API_VERSION`. De encryptiesleutel moet afzonderlijk van mail-/privacy-sleutels worden beheerd. Geen waarde hoort in Git, browserconfiguratie of logs.

De bestaande root-owned releasehelper accepteert momenteel uitsluitend de bestaande runtimevariabelen en `PRIVACY_RETENTION_EXECUTE`. Deze bronintegratie verandert dat toelatingscontract niet. Werkelijke providerconfiguratie op de VPS vereist eerst een afzonderlijk gereviewde uitbreiding van die private runtime-toelating en de bijbehorende hosthelper; extra GitHub-buildvariabelen zijn daarvoor niet bedoeld. Zonder die uitbreiding blijven koppelingen zichtbaar ongeconfigureerd en geblokkeerd.

## Oorspronkelijke integratie-uitrol op 23 november 2026

De eigenaar heeft de staginguitrol afzonderlijk opgedragen. De exacte-SHA-procedure uit [DG-RELEASE.md](DG-RELEASE.md) is gevolgd; het [uitrolbewijs](deploy-evidence/staging-release-2026-11-23.json) bevat de resultaten. Productie behoudt de bestaande niet-geactiveerde kandidaat `f38e8f77963761157315accfb6d96140f0cae9bb` en migraties 001–008.

| Stap | Werkelijk resultaat |
| --- | --- |
| Main-integratie en CI | PR #2 geïntegreerd op `4c39c3a6cf099ff6655b29cee15c67712bb4c14a`; push-CI [45262829146](https://github.com/castiqnl/platform/actions/runs/45262829146) geslaagd. |
| Verse backup vóór migratie | Versleutelde stagingbackup `backup-1a2fe4bd-5e7f-4741-9bae-8deb74f3dfc5` daadwerkelijk geïsoleerd hersteld: 31 geback-upte tabellen, 32 rijen, alle inhoudchecksums gelijk. De controlplane-operatiesleuteltabel blijft volgens het bestaande contract uitgesloten. |
| Database | Migraties 009 en 010 op uitsluitend staging toegepast; alle tien migratiechecksums met het artifact vergeleken. Staging heeft 42 tabellen, alle met RLS; beperkte runtimegrants gecontroleerd. |
| Kandidaatbuild | [45263874016](https://github.com/castiqnl/platform/actions/runs/45263874016) geslaagd; kandidaat `4c39c3a6cf099ff6655b29cee15c67712bb4c14a-45263874016-1`. |
| Kandidaatproef | Tijdelijke API en worker onder de beperkte runtime-identiteit: health/readiness200 op exacte SHA, privé-API401, fixture-login405, verkeerde JWT401, lege wachtrijen, stabiele worker, privacy-dry-run en opruimen geslaagd. Centrale initialisatie onder de runtime-rol geslaagd. |
| Templates en pakketten | 27 templates en 27 onveranderlijke versies, samen 108 layouts; alle 108 partnerlagen afzonderlijk read-only gecontroleerd. Vier centrale pakketten; facturatie niet geactiveerd. |
| Activatie | [45264399989](https://github.com/castiqnl/platform/actions/runs/45264399989) geslaagd met runtimeprofiel `initial-20261122`. Actief paar: `4c39c3a6cf099ff6655b29cee15c67712bb4c14a-45263874016-1-initial-20261122`. |
| Vorige combinatie | `previous` bewaart `f38e8f77963761157315accfb6d96140f0cae9bb-45074332095-1-initial-20261122`. Geen live rollback uitgevoerd. |
| Publieke controle na activatie | HTTPS health/readiness200 op de nieuwe SHA. Anonieme API-verzoeken naar workspace, clubs, templates, cockpit, pakketten en kanalen geven 401. |
| Desktop en mobiel | Anonieme read-only browserronde geslaagd: publieke website, afgeschermde platformroute met echte login, zeven juridische routes en drie exacte downloadhashes. Geen horizontale overflow, console-/paginafouten of mislukte verzoeken. Geen identiteit aangemaakt of formulier ingediend. |
| Omgevingsgrenzen | Fabelpad-PIDs/current-links en health, Caddy-PID en proxyhashes zijn voor/na gelijk. Castiq-productie blijft inactive/disabled zonder current-link. |

Het bestaande compatibiliteitslabel `castiq-schema-v8` is behouden; migraties 009–010 zijn een additieve uitbreiding. De vorige gezonde app is op een geïsoleerd uitgebreid schema met 13 compatibiliteitscontroles beproefd. Dat bewijst structurele compatibiliteit, geen volledige gedragsgelijkheid: oude code neemt nieuwe managed snapshots niet op in alle nieuw aangemaakte revisies/wachtrijtaken en kent de nieuwe intrekkingscontrole niet. Bij noodterugkeer na nieuwe managed activiteit moeten de worker en clubschrijfacties worden gepauzeerd/beperkt totdat de juiste code hersteld is. Een code-rollback draait deze migraties niet terug; er is geen live rollback als test uitgevoerd.

## Resterende gebruikers- en provideracceptatie

De geslaagde staginguitrol en anonieme browserronde bewijzen geen ingelogde gebruikersflow. De eigenaar configureert de Auth-URL/OTP/Google-instellingen en gebruikt daarvoor bestemde accounts voor platform, twee gescheiden testclubs en een teamrol. Controleer vervolgens accountregistratie, persoonlijke en clubaanvaarding, centrale templatebewerking/publicatie/toewijzing, clubkeuze en pakketmutaties op desktop en mobiel. Er zijn tijdens deze uitrol geen accounts uitgenodigd of voorwaarden namens gebruikers aanvaard.

Werkelijke providerapps, goedgekeurde scopes, callbacks en private runtime-toelating blijven nodig voor live kanaaltoestemming, weigeren, verlopen/reconnect, dubbele callback en intrekking. Queue/failure/timeout/retry blijven sandboxcontroles. Resend-aflevering, echte socialpublicatie, financiële verwerking en definitieve automatische privacywissing zijn niet geactiveerd of als geslaagd opgevoerd.

Vóór vrijgave van definitieve automatische privacywissing moet de pseudonimisering ook de actorvelden in de nieuwe audit-/eventtabellen van migraties 009–010 dekken. De bestaande wisflow dekt die velden nog niet. Werkelijke providerbewaarbewijzen blijven eveneens open; automatische wissing blijft uit.
