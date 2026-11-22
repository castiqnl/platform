# Castiq serverarchitectuur

De bestaande React/Vite-website gebruikt in servermodus uitsluitend semantische API-acties. De browser kan geen volledige werktoestand terugschrijven. De expliciete browserdemo behoudt zijn eigen lokale store en fictieve rolwissels.

## Centrale opslag en autoriteit

`server/application.ts` verifieert de sessie en bepaalt de actor uit de centrale membershiptabel. In lokale modus worden alleen vaste fictieve accounts via een willekeurig, gehasht opgeslagen sessietoken toegelaten. HttpOnly/SameSite-cookies, loopbackbinding, Host-, Origin- en Fetch-Metadata-controles begrenzen deze lokale testaanmelding. Buiten lokaal moet identiteit door Supabase worden geverifieerd; browsermetadata bepaalt geen rollen.

Iedere mutatie vergrendelt één clubwerktoestand met `SELECT FOR UPDATE`, vergelijkt de verwachte werkversie en controleert de exacte contentrevisie. Dezelfde transactie schrijft de nieuwe revisie, eventuele goedkeuring, jobs en audit. Het private PostgreSQL-schema `castiq` wordt niet aan de browser/Data API blootgesteld. RLS staat aan; de lokale schema-eigenaar heeft serverrechten en de API bewaakt de tenant- en teamgrenzen. Beide Supabase-projecten hebben een afzonderlijke beperkte `castiq_runtime`-serverrol met gecontroleerde TLS-verbinding, RLS en alleen private applicatierechten. De vertrouwde server kan de eigen appdata over tenants verwerken; alle gebruikers-/tenant-/teamgrenzen worden door de server-API afgedwongen. Anon/authenticated krijgen geen schematoegang, Auth- of rolbeheer is niet aan de runtime verleend.

Een werktoestand per club is een bewuste eerste servergrens voor het bestaande prototype. Verschillende clubs blokkeren elkaar niet. Binnen één club kunnen ook onafhankelijke wijzigingen een herstelbaar conflict geven. Verdere tabelnormalisatie, fijnere conceptversies, paginering en loadtests zijn vervolgstappen vóór brede inzet.

De implementatie gebruikt één databaseclient per transactie, conform de [node-postgres transactiedocumentatie](https://node-postgres.com/features/transactions). Supabase-identiteit wordt via de Auth-server gecontroleerd volgens het [getUser-contract](https://supabase.com/docs/reference/javascript/auth-getuser); de publieke Auth-instellingen bevestigen e-mail en Google op beide projecten. Externe OTP-/Google-gebruikersacceptatie en e-mailaflevering staan afzonderlijk in STATUS.md.

## Revisies en bewijs

`src/v1Workflow.ts` deelt de overgangsregels tussen UI en server. De server accepteert alleen toegestane inhoudsvelden en berekent de autoritatieve revisie, actor en status. Iedere wijziging aan publieke inhoud trekt actuele goedkeuring en open jobs transactioneel in. Database-triggers beschermen revisies, beslissingen, pogingen, audit, receipts en de bevroren delen van een publicatieaanvraag tegen wijzigingen.

De revisiesnapshot bevat de publieke inhoud, template en atlas, clubkleuren, templateversie, assetmanifest-hash en hashes van gebruikte uploads. Goedkeuring en publicatietaak verwijzen naar dezelfde SHA-256. Historische receipts blijven bij de verzonden versie; scorecorrecties en bronwijzigingen geven nieuwe revisies. Overzichten worden transitief verouderd wanneer een onderliggende bijdrage of wedstrijd wijzigt.

## Uploads

De server accepteert alleen JPEG, PNG en WebP, maximaal 8 MB, met begrensde afmetingen/pixels en volledige decodeerbaarheid. [Sharp](https://sharp.pixelplumbing.com/api-constructor/) controleert de bytes, oriënteert de afbeelding, begrenst de distributiegrootte en schrijft een WebP zonder oorspronkelijke apparaat-/locatiemetadata. De output staat onder een onvoorspelbare sleutel buiten `public` en `dist`; metadata en SHA-256 staan centraal. Iedere mediarequest controleert opnieuw tenant en team. Clubbrede sponsorlogo's krijgen alleen via een passende sponsorafspraak toegang voor het team.

De doelhost heeft een blijvend privé-uploadpad per omgeving, onafhankelijk van codeactivatie. Bewaar- en herstelprocedures staan in PRIVACY-BEHEER.md en DG-RELEASE.md. De huidige opslag is één lokale filesystemadapter; dit is geen reeds geconfigureerde Supabase Storage-bucket of malwaredetectiedienst.

## Duurzame sandboxwachtrij

`server/worker.ts` claimt een taak met een bewaarde lease. De laatste publicatiecontrole en sandboxdispatch gebeuren onder de clubvergrendeling. Een verlopen lease leidt naar reconciliatie van hetzelfde request-ID. Unieke sleutels per club, bijdrage, revisie en kanaal voorkomen dubbele jobs. Pauze, actuele revisie, exact goedkeuringsbewijs en privacy worden opnieuw gecontroleerd.

`server/sandboxAdapter.ts` heeft prepare, publish, readStatus en reconcile. De adapter doet geen netwerkverzoek naar een sociaal kanaal en produceert geen automatische succesreceipt. Alleen een expliciete, geautoriseerde sandboxactie levert een als demo gemarkeerde bevestiging. `PUBLICATION_MODE=live` wordt geweigerd. Er is geen echte OAuth-tokenopslag, providercallback, socialwebhook of externe readback geïmplementeerd.

## Grenzen voor staging

De lokale HTTP-, database-, worker- en browserproeven bewijzen de lokale uitvoering met fictieve gegevens. De OTP/Google-aanmeldcode gebruikt Supabase PKCE en sessieherstel; de API blijft de identiteit en rechten verifiëren. Private afbeeldingen worden in Supabase-modus met een geauthenticeerde fetch geladen en als tijdelijke object-URL weergegeven; tokens komen niet in media-URL's. Ontbrekende aanmeldconfiguratie blijft zichtbaar en geeft geen fictieve accounttoegang.

Nog nodig zijn de werkelijke stagingstack, Supabase OTP/Google-configuratie en externe sessietests, de bestaande mailgateway/outbox, private productiegeschikte opslag, officiële kanaaladapters, bronimport en externe acceptatie. Legacy Studio en beheerpanelen blijven in de afzonderlijke browserdemo beschikbaar. Platformtemplate- en tenantbeheer zijn nog niet naar servermutaties omgezet. De huidige lokale rol `club` combineert beheer en redactie; afzonderlijke clubbeheerder-/redacteurbevoegdheden moeten vóór de echte pilot verder worden gescheiden.


## Juridische en e-maillevenscyclus

De API verifieert identiteit vóór rolselectie, zodat een nieuwe persoonlijke gebruiker zonder clubrecht voorwaarden kan lezen/aanvaarden en een geblokkeerde gebruiker uitsluitend expliciet kan herstellen of privacyrechten kan uitoefenen. Gewone data-API’s vereisen een actief account en de actuele persoonlijke voorwaarden. Clubmutaties vereisen daarnaast actuele clubvoorwaarden en verwerkersovereenkomst, aanvaard door een bevoegde clubbeheerder. OAuth vervangt deze stap niet.

Dezelfde private database bewaart onveranderlijke juridische archieven en aanvaardingsbewijzen, privacyzaken en de mailoutbox. Een onafhankelijke bestandsledger met HMAC-referenties overleeft databaseherstel; quarantainestatus blokkeert de app tot gecontroleerde vrijgave. Definitieve geautomatiseerde wissing staat uit totdat onafhankelijke herstel-, overgangs- en providerbewaarcontroles zijn bewezen.

De account-Edge Function houdt Supabase service-role credentials binnen Supabase. De VPS kan alleen reeds geautoriseerde accountoperaties aanvragen met een aparte sleutel. Resendgeheimen worden per omgeving met AES-256-GCM versleuteld. E-mailbewerking, queueing, provideracceptatie en bewezen aflevering blijven verschillende gebeurtenissen. Alle standaard- en beheerde templates delen dezelfde Castiq-renderer.
