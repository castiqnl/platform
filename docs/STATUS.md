# Castiq bouw- en omgevingsstatus

Bijgewerkt: 23 november 2026. **De afgeronde clubinterface draait op [staging.castiq.nl](https://staging.castiq.nl)**, met actieve API en worker op applicatiecommit **`27bf3aa881281042e61cd8823771cfe0a373bb0a`**. PR #4 is op `main` geïntegreerd en de exacte hoofdversie heeft volledige CI, kandidaatbouw en stagingactivatie doorlopen. De eigenaar heeft de persoonlijke login bevestigd. Productie is niet geactiveerd en is tijdens deze uitrol ongewijzigd. Het [uitrolbewijs](deploy-evidence/staging-club-completion-2026-11-23.json) bevat de gecontroleerde versie, back-up/herstel, serverproef en publieke controles. Latere documentatiecommits wijzigen de actieve applicatie niet.

| Onderdeel | Feitelijke status |
| --- | --- |
| Bron en ontwerp | Bestaande React19/TypeScript/Vite-app behouden; 50 assets, fonts en 27 standaardstijlen gecontroleerd |
| GitHub | `castiqnl/platform`, `main`; omgevingen `staging` en `production`, elk exact de vier opgegeven variabelen |
| Data-modus | **`CASTIQ_DATA_MODE=supabase`**, op beide doelen; oude verkeerd benoemde variabelen vervangen |
| Supabase staging | Castiq-account, `zovwrexlzmhyejnfnmid`, Frankfurt |
| Supabase productie | Duindorpdoet-account, `jyqajjfyksasehdlzfuf`, Frankfurt; eigen lege appinrichting |
| Databases | Staging: migraties 001–014 met gecontroleerde checksums; productie: ongewijzigd 001–008. Private schema’s, beperkte serverrollen en TLS met certificaat-/hostnamecontrole |
| Databasebeveiliging | Staging: alle 47 tabellen hebben RLS; productie behoudt haar 32 tabellen. Nieuwe runtimegrants zijn op staging gecontroleerd zonder RLS-bypass. De Supabase-securityadviseurs zijn vóór/na de aanvullende migraties gecontroleerd: geen nieuwe fouten; bestaande INFO voor de bewust afgeschermde operatiesleuteltabel zonder policy en WARN voor uitgeschakelde wachtwoordlekbescherming blijven gelijk. Anon/authenticated kunnen de beheers-RPC niet uitvoeren |
| Eerste beheerder | Bestaande bevestigde Auth-identiteit en platformmembership op beide projecten behouden; geen voorwaarden namens de eigenaar aanvaard |
| Login | Code accepteert precies zes cijfers en ondersteunt Google. Beide providers werkelijk ingeschakeld; de eigenaar bevestigt werkende login; echte providerautorisatie en eerste externe publicatie blijven afzonderlijke controles |
| E-mail | Bestaande templates vooraf gecontroleerd: geen. Nu 13 Supabase HTML-templates, één Castiq-renderer, versieerbaar beheer, versleutelde Resendconfiguratie, outbox, retries en geverifieerde receipts |
| Resend API | Nog geen API-sleutel/geverifieerde afzender/webhookgeheim ingevoerd. Geen afleveringsbewijs geclaimd. Bestaande Supabase SMTP is geen Castiq API-credential |
| Juridisch | Voorwaarden, privacy, DPA, bedrijfsgegevens, subverwerkers en accountverwijdering; exacte downloadarchieven `2026-11-22.1`, ingangsdatum 22 november 2026 |
| Aanvaarding | Persoonlijke voorwaarden en bevoegde clubvoorwaarden+DPA afzonderlijk, servercontrole op exacte versie/hash; privacy is informatie, geen verplichte toestemming |
| Privacy | 7 dagen onafgeronde registratie, 30 dagen herstel, 90 dagen bewuste inactiviteit, 12 kalendermaanden zaakmetadata, onafhankelijke 210 dagen wisledger en herstelquarantaine geïmplementeerd en getest |
| Definitieve automatische wissing | **Uit** totdat werkelijke herstel-/overgangs-/providerbewaarbewijzen beschikbaar zijn; geen fictieve Stackmail-/backuppurge. Directe blokkering en privacyverzoeken zijn beschikbaar |
| Clubproces | Centrale beheerpagina’s voor wedstrijden, teams, spelers, huisstijl, media, rollen, regels, activiteit en statistieken. Bestaande concepten/revisies, exacte goedkeuring, clubweek, sponsors en weekend behouden. Sportlink wordt per vereniging gekoppeld en gecontroleerd geïmporteerd |
| Cockpit en templates | Aparte operationele cockpit en verenigingenbeheer; centrale Template Studio en pakketbeleid. Staging bevat 27 ingebouwde templates met 108 layouts; maatwerkaanvragen, exacte toewijzing en veilige centrale afbeeldinguploads zijn toegevoegd. De partnerlagen zijn afzonderlijk read-only gecontroleerd |
| Publicaties | Officiële beeldadapters voor Instagram, Facebook en X; tijdelijke geverifieerde JPEG-toegang, tokenvernieuwing en duurzaam verzendjournaal. Actieve runtime gebruikt provider-per-club. Centrale CastIQ-appregistraties/rechten zijn nog niet ingevoerd; er zijn geen echte posts aangemaakt. Historische sandboxopdrachten blijven sandbox |
| Host | `dg-vps-08`, eigen canonieke staging-/productiestructuur naar Fabelpad-contract; gescheiden runner/build/appaccounts en private configuraties |
| Runners | Twee nieuwe eigen online runners met exclusieve doellabels; digestgebonden beperkte sudo, geen algemene runner-sudo |
| Netwerk en logs | Eigen units blokkeren controlepoorten; Caddy/healthbron 127.0.0.2, echte probes geslaagd; eigen journals30 dagen |
| Bestaande Fabelpad | Voor/na deze Castiq-activatie dezelfde PIDs/current-paden en gezonde health-URLs; Caddy-PID en proxyhashes eveneens gelijk. De aangetroffen afzonderlijke Fabelpad-release is behouden |
| Release | Handmatige exacte-SHA-routes, main+exacte-CI-admissie en gescheiden kandidaatbouw/activatie. Schema-v14 blokkeert terugkeer naar de oude worker en vereist quarantaine bij een mislukte grensovergang |
| Stagingactivatie | Geslaagd op 23 november; HTTPS health/readiness200 op exacte nieuwe SHA, API en worker actief. Anonieme browsercontroles op desktop/mobiel en private API-weigering geslaagd; de eigenaar bevestigt persoonlijke login; echte kanaaltoestemming/publicatie staat afzonderlijk open |
| Productieactivatie | Niet uitgevoerd; geen productiedomein/proxy/service geactiveerd |

## Uitgevoerde controles tijdens integratie en afronding

- TypeScript, 35 domein-/model-/renderproeven, 26 Node-releasechecks en 44 Python-boundarychecks geslaagd.
- 135 server-/privacy-/mail-/pilotchecks en 55 browserproeven geslaagd, met synthetische platform-, club- en teamaccounts op een lokale wegwerpdatabase. Officiële provider-HTTP wordt gecontroleerd nagebootst; echte JPEG-rendering en herstel na een verloren antwoord zijn getest.
- Juridische tekst/hash/downloadconsistentie en alle oorspronkelijke assets geslaagd.
- Werkelijke Supabase-controles: projectscheiding/regio, Auth-providerflags, beperkte databaseverbinding, geen Auth-schema-/rolbeheer voor runtime, geweigerde vervalste Edge-operatiesleutel en alleen service-role RPC-uitvoering.

De volledige push-CI op de nieuwe main-SHA is geslaagd. Vóór de stagingmigraties is een verse versleutelde backup `backup-06e77173-a720-47c9-a63d-d8531f654209` gemaakt en daadwerkelijk geïsoleerd hersteld: 41 geback-upte tabellen, 131 rijen en gelijke inhoudchecksums. De controlplane-operatiesleuteltabel is volgens het bestaande backupcontract uitgesloten. Eerdere afzonderlijke productiebackups en herstelbewijzen blijven historisch bewijs van 22 november; productie is tijdens deze uitrol niet gewijzigd.

De stagingkandidaat is onder de beperkte runtime-identiteit met een tijdelijke API en worker getest. Alle 14 migratiechecksums zijn met het artifact vergeleken; health/readiness, anonieme weigering, fixture-login405, verkeerde JWT401, centrale initialisatie, lege wachtrijen, workerstabiliteit en privacy-dry-run zijn gecontroleerd. Werkelijke JPEG-rendering van feed en Story met de ingebouwde stijlen, fonts en assets is onder het appaccount geslaagd. Na activatie zijn 11 publieke artifactbestanden op hash vergeleken en de private API-routes op anonieme weigering gecontroleerd. De loginpagina werkt op desktop (1440 px) en mobiel (390 px), zonder horizontale overflow of browserfouten. Deze publieke controles bewijzen geen echte kanaaltoestemming, mailaflevering of externe socialpublicatie; persoonlijke login is afzonderlijk door de eigenaar bevestigd.

## Exacte release en bewijs

| Controle | Run / resultaat |
| --- | --- |
| Volledige push-CI op nieuwe applicatie-SHA | [45277748231](https://github.com/castiqnl/platform/actions/runs/45277748231), success |
| Nieuwe kandidaat staging op doel-VPS | [45278451848](https://github.com/castiqnl/platform/actions/runs/45278451848), success |
| Alleen staging geactiveerd | [45278771029](https://github.com/castiqnl/platform/actions/runs/45278771029), success |
| Bestaande productiekandidaat, ongewijzigd | `f38e8f77963761157315accfb6d96140f0cae9bb`, run [45074436060](https://github.com/castiqnl/platform/actions/runs/45074436060) van 22 november; niet geactiveerd |
| Runtimeprofiel staging | `provider-selfservice-20261123`, eigen root-only profiel; productieprofiel ongewijzigd |
| Huidige stagingrelease | `27bf3aa881281042e61cd8823771cfe0a373bb0a-45278451848-1-provider-selfservice-20261123` |
| Vorige gezonde stagingrelease | `3cf040cf91e0e15c2fa2f7f52d82a48165f004d9-45271236093-1-initial-20261122`; schema-v8, geen gewone rollback vanaf v14 |

Het [actuele uitrolbewijs](deploy-evidence/staging-club-completion-2026-11-23.json) bevat de exacte SHA, CI-/build-/activatieruns, database- en backupcontroles, kandidaatproef en grensvergelijking vóór/na. Alleen staging is gewijzigd. Het [eerdere uitrolbewijs van 23 november](deploy-evidence/staging-release-2026-11-23.json) en de [kandidaatproeven van 22 november](deploy-evidence/candidate-probes-final-2026-11-22.json) blijven historisch bewijs voor eerdere releases en de productiekandidaat. Er zijn tijdens deze uitrol geen e-mails of socialposts verzonden.

De bestaande HTTPS-route en proxyconfiguratie zijn tijdens deze uitrol behouden. De eerste route-inrichting staat in het [uitrolbewijs van 22 november](deploy-evidence/staging-release-2026-11-22.json). Productieservices blijven inactive/disabled zonder current-link; Fabelpad-services, hun current-links, Caddy en proxyhashes zijn voor/na gelijk.

De vorige gezonde combinatie `3cf040c…` is via `previous` bewaard. De nieuwe servercode en migraties wijzigen de databasecompatibiliteit van v8 naar v14. Een gewone rollback naar die oude release is geblokkeerd. Bij een mislukte grensovergang worden app én worker gestopt; de helper start geen oude worker op het nieuwe schema. Gecontroleerd herstel vereist de geïsoleerd geverifieerde back-up en herstelquarantaine. Er is geen live rollback als test uitgevoerd. Zie [DG-RELEASE.md](DG-RELEASE.md).

## Historisch: eerste kanaalwizardcorrectie op staging

De kanaalinterface is hersteld met een compacte directory en vier stappen voor Instagram, Facebook en X. Alle tien kanaal-/pakketbrowsertests en de volledige push-CI met 36 browserproeven slagen. De verse backup `backup-afb1beac-7641-4e72-9ece-af1be40fde09` omvat 41 applicatietabellen en 127 rijen; geïsoleerd herstel en alle inhoudchecksums zijn gecontroleerd. De beperkte operatiesleuteltabel blijft volgens het bestaande contract uitgesloten.

Het [uitrolbewijs voor de kanaalwizards](deploy-evidence/staging-channel-wizards-2026-11-23.json) bevestigt publieke JS/CSS-hashes gelijk aan het geïnstalleerde artifact, anonieme desktop-/mobiele controle, gezonde API en worker en ongewijzigde productie-/Fabelpad-/proxygrenzen. Ingelogde wizardbediening is lokaal met synthetische accounts getest; echte providertoestemming blijft afhankelijk van activatie van de provideraansluiting. Zie [de herstelbeschrijving](KANAALWIZARDS-2026-11-23.md).

## Handmatige vervolgstappen

1. Persoonlijke login werkt volgens de eigenaar. Voer de resterende ingelogde stagingacceptatie uit voor platform, twee afzonderlijke testclubs en een teamrol. Gebruik [AUTH-EN-MAIL.md](AUTH-EN-MAIL.md) voor afzonderlijke provider-/mailcontroles; deze stagingafronding wijzigt geen productie-Auth-instellingen.
2. Voer per omgeving de eigen Resend API-sleutel, geverifieerde afzender en webhookconfiguratie in Castiq-beheer in. Controleer een echte aflevering aan de hand van providerbewijs.
3. Registreer de centrale CastIQ-providerapps en aantoonbaar goedgekeurde rechten via **Providerapps**. Laat daarna iedere vereniging haar eigen account autoriseren via **Koppelingen** en controleer een eerste beheerde externe publicatie. De officiële adapters zijn geïmplementeerd en getest met nagebootste providerantwoorden; echte providergoedkeuring en clubtoestemming zijn nog niet bewezen.
4. Rond providerbewaarbewijzen, externe sleutelbewaring en de privacyvrijgave af vóór definitieve automatische wissing. Migratie 014 en de wisflow dekken nu ook actorvelden in de nieuwe audit-/eventtabellen; automatische destructieve retentie blijft uit.
5. Automatische facturering is niet geïmplementeerd. Pakketbeheer regelt toegang, gebruik en proefperioden; het start geen facturen of incasso’s.

## Open externe gegevens

Zie [BENODIGDE-GEGEVENS.md](BENODIGDE-GEGEVENS.md), [Auth/e-mail-instructies](AUTH-EN-MAIL.md), [privacybeheer](PRIVACY-BEHEER.md) en [release-/rollbackprocedure](DG-RELEASE.md). De HTML-templates en per-omgeving Auth-configuratiepatches zijn direct beschikbaar onder `emails/`.
