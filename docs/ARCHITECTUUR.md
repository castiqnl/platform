# Castiq lokale serverarchitectuur

De bestaande React/Vite-website gebruikt in servermodus uitsluitend semantische API-acties. De browser kan geen volledige werktoestand terugschrijven. De expliciete browserdemo behoudt zijn eigen lokale store en fictieve rolwissels.

## Centrale opslag en autoriteit

`server/application.ts` verifieert de sessie en bepaalt de actor uit de centrale membershiptabel. In lokale modus worden alleen vaste fictieve accounts via een willekeurig, gehasht opgeslagen sessietoken toegelaten. HttpOnly/SameSite-cookies, loopbackbinding, Host-, Origin- en Fetch-Metadata-controles begrenzen deze lokale testaanmelding. Buiten lokaal moet identiteit door Supabase worden geverifieerd; browsermetadata bepaalt geen rollen.

Iedere mutatie vergrendelt één clubwerktoestand met `SELECT FOR UPDATE`, vergelijkt de verwachte werkversie en controleert de exacte contentrevisie. Dezelfde transactie schrijft de nieuwe revisie, eventuele goedkeuring, jobs en audit. Het private PostgreSQL-schema `castiq` wordt niet aan de browser/Data API blootgesteld. RLS staat aan; de lokale schema-eigenaar heeft serverrechten en de API bewaakt de tenant- en teamgrenzen. De beperkte staging-runtimegebruiker en diens grants/policies moeten nog op de doelomgeving worden ingericht en getest.

Een werktoestand per club is een bewuste eerste servergrens voor het bestaande prototype. Verschillende clubs blokkeren elkaar niet. Binnen één club kunnen ook onafhankelijke wijzigingen een herstelbaar conflict geven. Verdere tabelnormalisatie, fijnere conceptversies, paginering en loadtests zijn vervolgstappen vóór brede inzet.

De implementatie gebruikt één databaseclient per transactie, conform de [node-postgres transactiedocumentatie](https://node-postgres.com/features/transactions). Supabase-identiteit wordt via de Auth-server gecontroleerd volgens het [getUser-contract](https://supabase.com/docs/reference/javascript/auth-getuser); echte Auth-configuratie en een externe sessie zijn nog niet geverifieerd.

## Revisies en bewijs

`src/v1Workflow.ts` deelt de overgangsregels tussen UI en server. De server accepteert alleen toegestane inhoudsvelden en berekent de autoritatieve revisie, actor en status. Iedere wijziging aan publieke inhoud trekt actuele goedkeuring en open jobs transactioneel in. Database-triggers beschermen revisies, beslissingen, pogingen, audit, receipts en de bevroren delen van een publicatieaanvraag tegen wijzigingen.

De revisiesnapshot bevat de publieke inhoud, template en atlas, clubkleuren, templateversie, assetmanifest-hash en hashes van gebruikte uploads. Goedkeuring en publicatietaak verwijzen naar dezelfde SHA-256. Historische receipts blijven bij de verzonden versie; scorecorrecties en bronwijzigingen geven nieuwe revisies. Overzichten worden transitief verouderd wanneer een onderliggende bijdrage of wedstrijd wijzigt.

## Uploads

De server accepteert alleen JPEG, PNG en WebP, maximaal 8 MB, met begrensde afmetingen/pixels en volledige decodeerbaarheid. [Sharp](https://sharp.pixelplumbing.com/api-constructor/) controleert de bytes, oriënteert de afbeelding, begrenst de distributiegrootte en schrijft een WebP zonder oorspronkelijke apparaat-/locatiemetadata. De output staat onder een onvoorspelbare sleutel buiten `public` en `dist`; metadata en SHA-256 staan centraal. Iedere mediarequest controleert opnieuw tenant en team. Clubbrede sponsorlogo's krijgen alleen via een passende sponsorafspraak toegang voor het team.

Voor staging zijn een blijvend privévolume of private objectadapter, bewaartermijnen, backups en het clubproces voor persoonsgebonden beeldrechten nodig. De huidige opslag is één lokale filesystemadapter; dit is geen reeds geconfigureerde Supabase Storage-bucket of malwaredetectiedienst.

## Duurzame sandboxwachtrij

`server/worker.ts` claimt een taak met een bewaarde lease. De laatste publicatiecontrole en sandboxdispatch gebeuren onder de clubvergrendeling. Een verlopen lease leidt naar reconciliatie van hetzelfde request-ID. Unieke sleutels per club, bijdrage, revisie en kanaal voorkomen dubbele jobs. Pauze, actuele revisie, exact goedkeuringsbewijs en privacy worden opnieuw gecontroleerd.

`server/sandboxAdapter.ts` heeft prepare, publish, readStatus en reconcile. De adapter doet geen netwerkverzoek naar een sociaal kanaal en produceert geen automatische succesreceipt. Alleen een expliciete, geautoriseerde sandboxactie levert een als demo gemarkeerde bevestiging. `PUBLICATION_MODE=live` wordt geweigerd. Er is geen echte OAuth-tokenopslag, providercallback, socialwebhook of externe readback geïmplementeerd.

## Grenzen voor staging

De lokale HTTP-, database-, worker- en browserproeven bewijzen de lokale uitvoering met fictieve gegevens. De OTP/Google-aanmeldcode gebruikt Supabase PKCE en sessieherstel; de API blijft de identiteit en rechten verifiëren. Private afbeeldingen worden in Supabase-modus met een geauthenticeerde fetch geladen en als tijdelijke object-URL weergegeven; tokens komen niet in media-URL's. Ontbrekende aanmeldconfiguratie blijft zichtbaar en geeft geen fictieve accounttoegang.

Nog nodig zijn de werkelijke stagingstack, Supabase OTP/Google-configuratie en externe sessietests, de bestaande mailgateway/outbox, private productiegeschikte opslag, officiële kanaaladapters, bronimport en externe acceptatie. Legacy Studio en beheerpanelen blijven in de afzonderlijke browserdemo beschikbaar. Platformtemplate- en tenantbeheer zijn nog niet naar servermutaties omgezet. De huidige lokale rol `club` combineert beheer en redactie; afzonderlijke clubbeheerder-/redacteurbevoegdheden moeten vóór de echte pilot verder worden gescheiden.
