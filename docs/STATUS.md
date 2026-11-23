# Castiq bouw- en omgevingsstatus

Bijgewerkt: 23 november 2026. **De nieuwe interface draait op [staging.castiq.nl](https://staging.castiq.nl)**, met afzonderlijke actieve API en worker op applicatiecommit **`3cf040cf91e0e15c2fa2f7f52d82a48165f004d9`**. PR #2 en de kanaalwizardcorrectie uit PR #3 zijn op `main` geïntegreerd, exact die SHA heeft de volledige push-CI doorlopen en is uitsluitend naar staging uitgerold. Productie is niet geactiveerd; haar bestaande kandidaat `f38e8f77963761157315accfb6d96140f0cae9bb` en migraties 001–008 zijn behouden. Latere documentatiecommits veranderen de actieve applicatie niet. De gebruiker voert de opgeleverde Supabase Auth-instellingen en accountgebonden acceptatie zelf uit.

| Onderdeel | Feitelijke status |
| --- | --- |
| Bron en ontwerp | Bestaande React19/TypeScript/Vite-app behouden; 50 assets, fonts en 27 standaardstijlen gecontroleerd |
| GitHub | `castiqnl/platform`, `main`; omgevingen `staging` en `production`, elk exact de vier opgegeven variabelen |
| Data-modus | **`CASTIQ_DATA_MODE=supabase`**, op beide doelen; oude verkeerd benoemde variabelen vervangen |
| Supabase staging | Castiq-account, `zovwrexlzmhyejnfnmid`, Frankfurt |
| Supabase productie | Duindorpdoet-account, `jyqajjfyksasehdlzfuf`, Frankfurt; eigen lege appinrichting |
| Databases | Staging: migraties 001–010 met gecontroleerde checksums; productie: ongewijzigd 001–008. Private schema’s, beperkte serverrollen en TLS met certificaat-/hostnamecontrole |
| Databasebeveiliging | Staging: alle 42 tabellen hebben RLS; productie behoudt haar 32 tabellen. Nieuwe runtimegrants zijn op staging gecontroleerd zonder RLS-bypass. De Supabase-securityadviseurs zijn vóór/na migraties 009–010 gecontroleerd: geen nieuwe fouten; bestaande INFO voor de bewust afgeschermde operatiesleuteltabel zonder policy en WARN voor uitgeschakelde wachtwoordlekbescherming blijven gelijk. Anon/authenticated kunnen de beheers-RPC niet uitvoeren |
| Eerste beheerder | Bestaande bevestigde Auth-identiteit en platformmembership op beide projecten behouden; geen voorwaarden namens de eigenaar aanvaard |
| Login | Code accepteert precies zes cijfers en ondersteunt Google. Beide providers werkelijk ingeschakeld; externe Auth-URL/OTP/templateconfiguratie en menselijke eindsessietest blijven afzonderlijke controles |
| E-mail | Bestaande templates vooraf gecontroleerd: geen. Nu 13 Supabase HTML-templates, één Castiq-renderer, versieerbaar beheer, versleutelde Resendconfiguratie, outbox, retries en geverifieerde receipts |
| Resend API | Nog geen API-sleutel/geverifieerde afzender/webhookgeheim ingevoerd. Geen afleveringsbewijs geclaimd. Bestaande Supabase SMTP is geen Castiq API-credential |
| Juridisch | Voorwaarden, privacy, DPA, bedrijfsgegevens, subverwerkers en accountverwijdering; exacte downloadarchieven `2026-11-22.1`, ingangsdatum 22 november 2026 |
| Aanvaarding | Persoonlijke voorwaarden en bevoegde clubvoorwaarden+DPA afzonderlijk, servercontrole op exacte versie/hash; privacy is informatie, geen verplichte toestemming |
| Privacy | 7 dagen onafgeronde registratie, 30 dagen herstel, 90 dagen bewuste inactiviteit, 12 kalendermaanden zaakmetadata, onafhankelijke 210 dagen wisledger en herstelquarantaine geïmplementeerd en getest |
| Definitieve automatische wissing | **Uit** totdat werkelijke herstel-/overgangs-/providerbewaarbewijzen beschikbaar zijn; geen fictieve Stackmail-/backuppurge. Directe blokkering en privacyverzoeken zijn beschikbaar |
| Clubproces | Bestaande duurzame concepten, revisies, exacte goedkeuring, feedback, clubweek, sponsors en weekendoverzichten behouden; server bewaakt tenant/team en conflicten |
| Cockpit en templates | Aparte operationele cockpit en verenigingenbeheer; centrale Template Studio en pakketbeleid. Staging bevat 27 ingebouwde templates, 27 onveranderlijke versies en 108 layouts; alle 108 partnerlagen zijn afzonderlijk read-only gecontroleerd |
| Publicaties | Uitsluitend expliciete sandbox. Geen echte kanalen, bereik, sponsorbetalingen of externe succesbewijzen verzonnen |
| Host | `dg-vps-08`, eigen canonieke staging-/productiestructuur naar Fabelpad-contract; gescheiden runner/build/appaccounts en private configuraties |
| Runners | Twee nieuwe eigen online runners met exclusieve doellabels; digestgebonden beperkte sudo, geen algemene runner-sudo |
| Netwerk en logs | Eigen units blokkeren controlepoorten; Caddy/healthbron 127.0.0.2, echte probes geslaagd; eigen journals30 dagen |
| Bestaande Fabelpad | Voor/na deze Castiq-activatie dezelfde PIDs/current-paden en gezonde health-URLs; Caddy-PID en proxyhashes eveneens gelijk. De aangetroffen afzonderlijke Fabelpad-release is behouden |
| Release | Handmatige exacte-SHA-routes voor beide doelen, main+exacte-CI-admissie, gescheiden kandidaatbuild/activatie en app/runtimepaarrollback getest |
| Stagingactivatie | Geslaagd op 23 november; HTTPS health/readiness200 op exacte nieuwe SHA, API en worker actief. Anonieme browsercontroles op desktop/mobiel en private API-weigering geslaagd; ingelogde gebruikersacceptatie staat afzonderlijk open |
| Productieactivatie | Niet uitgevoerd; geen productiedomein/proxy/service geactiveerd |

## Uitgevoerde controles tijdens integratie

- TypeScript, 34 domein-/model-/renderproeven, 24 Node-releasechecks en 40 Python-boundarychecks geslaagd.
- 95 server-/privacy-/mail-/pilotchecks en 36 browserproeven geslaagd, met synthetische platform-, club- en teamaccounts op een lokale wegwerpdatabase. De providerproeven gebruiken een expliciete testadapter.
- Juridische tekst/hash/downloadconsistentie en alle oorspronkelijke assets geslaagd.
- Werkelijke Supabase-controles: projectscheiding/regio, Auth-providerflags, beperkte databaseverbinding, geen Auth-schema-/rolbeheer voor runtime, geweigerde vervalste Edge-operatiesleutel en alleen service-role RPC-uitvoering.

De volledige push-CI op de nieuwe main-SHA is geslaagd. Vóór de stagingmigraties is een verse versleutelde backup `backup-1a2fe4bd-5e7f-4741-9bae-8deb74f3dfc5` gemaakt en daadwerkelijk geïsoleerd hersteld: 31 geback-upte tabellen, 32 rijen en gelijke inhoudchecksums. De controlplane-operatiesleuteltabel is volgens het bestaande backupcontract uitgesloten. Eerdere afzonderlijke productiebackups en herstelbewijzen blijven historisch bewijs van 22 november; productie is tijdens deze uitrol niet gewijzigd.

De stagingkandidaat is onder de beperkte runtime-identiteit met een tijdelijke API en worker getest. Migratiechecksums zijn met het artifact vergeleken; health/readiness, anonieme weigering, fixture-login405, verkeerde JWT401, centrale initialisatie, lege wachtrijen, workerstabiliteit en privacy-dry-run zijn gecontroleerd. Na activatie zijn op desktop en mobiel de publieke website, zeven juridische routes, drie onveranderlijke downloadhashes en de afgeschermde platformroute gecontroleerd. Er waren geen horizontale overflow, browserfouten of mislukte verzoeken. Dit waren anonieme read-only controles; werkelijke ingelogde platform-/club-/teamflows, OTP-ontvangst, Google-toestemming en externe e-mail-/socialpublicatie zijn hiermee niet bewezen.

## Exacte release en bewijs

| Controle | Run / resultaat |
| --- | --- |
| Volledige push-CI op nieuwe applicatie-SHA | [45270483470](https://github.com/castiqnl/platform/actions/runs/45270483470), success |
| Nieuwe kandidaat staging op doel-VPS | [45271236093](https://github.com/castiqnl/platform/actions/runs/45271236093), success |
| Alleen staging geactiveerd | [45271547140](https://github.com/castiqnl/platform/actions/runs/45271547140), success |
| Bestaande productiekandidaat, ongewijzigd | `f38e8f77963761157315accfb6d96140f0cae9bb`, run [45074436060](https://github.com/castiqnl/platform/actions/runs/45074436060) van 22 november; niet geactiveerd |
| Runtimeprofiel | `initial-20261122`, eigen root-only profiel per omgeving |
| Huidige stagingrelease | `3cf040cf91e0e15c2fa2f7f52d82a48165f004d9-45271236093-1-initial-20261122` |
| Vorige gezonde stagingrelease | `4c39c3a6cf099ff6655b29cee15c67712bb4c14a-45263874016-1-initial-20261122` |

Het [uitrolbewijs van 23 november](deploy-evidence/staging-release-2026-11-23.json) bevat de exacte SHA, CI-/build-/activatieruns, database- en backupcontroles, kandidaatproef en grensvergelijking vóór/na. Alleen staging is gewijzigd. De kandidaten staan onder `/srv/sites/castiq-vps08-<omgeving>/candidates/`; de [kandidaatproeven van 22 november](deploy-evidence/candidate-probes-final-2026-11-22.json) blijven historisch bewijs voor de eerdere release en productiekandidaat. Er zijn geen e-mails of socialposts verzonden.

De bestaande HTTPS-route en proxyconfiguratie zijn tijdens deze uitrol behouden. De eerste route-inrichting staat in het [uitrolbewijs van 22 november](deploy-evidence/staging-release-2026-11-22.json). Productieservices blijven inactive/disabled zonder current-link; Fabelpad-services, hun current-links, Caddy en proxyhashes zijn voor/na gelijk.

De vorige volledig gezonde combinatie `4c39c3a…` is nu via `previous` bewaard. Alle 148 gecontroleerde runtimebronbestanden en dependencybestanden zijn identiek; alleen de twee expliciete browserinterfacebestanden verschillen. De hierna beschreven beperking geldt voor een verdere historische terugkeer naar `f38e8f7…`, waarvoor 13 geïsoleerde compatibiliteitscontroles bestaan. Die compatibiliteit is structureel: oude code bewaart niet alle nieuwe managed snapshots in nieuw aangemaakte revisies of wachtrijtaken en kent de nieuwe intrekkingscontrole niet. Bij noodterugkeer na nieuwe managed activiteit moeten de worker en clubschrijfacties worden gepauzeerd/beperkt totdat de juiste code hersteld is. Er is geen live rollback als test uitgevoerd. De historische API-only release `7cdb874…` blijft geen gezond rollbackdoel. Zie [DG-RELEASE.md](DG-RELEASE.md).

## Kanaalwizardcorrectie op staging

De kanaalinterface is hersteld met een compacte directory en vier stappen voor Instagram, Facebook en X. Alle tien kanaal-/pakketbrowsertests en de volledige push-CI met 36 browserproeven slagen. De verse backup `backup-afb1beac-7641-4e72-9ece-af1be40fde09` omvat 41 applicatietabellen en 127 rijen; geïsoleerd herstel en alle inhoudchecksums zijn gecontroleerd. De beperkte operatiesleuteltabel blijft volgens het bestaande contract uitgesloten.

Het [uitrolbewijs voor de kanaalwizards](deploy-evidence/staging-channel-wizards-2026-11-23.json) bevestigt publieke JS/CSS-hashes gelijk aan het geïnstalleerde artifact, anonieme desktop-/mobiele controle, gezonde API en worker en ongewijzigde productie-/Fabelpad-/proxygrenzen. Ingelogde wizardbediening is lokaal met synthetische accounts getest; echte providertoestemming blijft afhankelijk van activatie van de provideraansluiting. Zie [de herstelbeschrijving](KANAALWIZARDS-2026-11-23.md).

## Handmatige vervolgstappen

1. Stel in beide Supabase-projecten de eigen URL/redirects, OTP-lengte6 en HTML-templates in volgens [AUTH-EN-MAIL.md](AUTH-EN-MAIL.md). Test daarna werkelijk OTP-ontvangst, Google-terugkeer en persoonlijke aanvaarding met de bevoegde eigenaar. Voer de ingelogde stagingacceptatie uit voor platform, twee afzonderlijke testclubs en een teamrol.
2. Voer per omgeving de eigen Resend API-sleutel, geverifieerde afzender en webhookconfiguratie in Castiq-beheer in. Controleer een echte aflevering aan de hand van providerbewijs.
3. Rond providerbewaarbewijzen, externe sleutelbewaring en de privacyvrijgave af vóór definitieve automatische wissing. Breid eerst de pseudonimisering uit naar de actorvelden in de nieuwe audit-/eventtabellen van migraties 009–010; de bestaande wisflow dekt die velden nog niet. Automatische wissing blijft uit. Echte sociale kanalen vragen nog officiële adapters/testaccounts.

## Open externe gegevens

Zie [BENODIGDE-GEGEVENS.md](BENODIGDE-GEGEVENS.md), [Auth/e-mail-instructies](AUTH-EN-MAIL.md), [privacybeheer](PRIVACY-BEHEER.md) en [release-/rollbackprocedure](DG-RELEASE.md). De HTML-templates en per-omgeving Auth-configuratiepatches zijn direct beschikbaar onder `emails/`.
