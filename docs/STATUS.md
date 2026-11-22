# Castiq bouw- en omgevingsstatus

Bijgewerkt: 22 november 2026. Uitgangscommit van deze uitbreiding: `92bbc5ed8c146efc6957e6ad30a9a5e9cf5fa09e`. De gebruiker heeft beide Supabase-omgevingen en de eigen hostinrichting geautoriseerd, inclusief uitrol naar staging. Publieke productieactivatie volgt afzonderlijk. Deze status wordt bij de feitelijke uitrol aangevuld met SHA, runs en URL-controles.

| Onderdeel | Feitelijke status |
| --- | --- |
| Bron en ontwerp | Bestaande React19/TypeScript/Vite-app behouden; 50 assets, fonts en 27 standaardstijlen gecontroleerd |
| GitHub | `castiqnl/platform`, `main`; omgevingen `staging` en `production`, elk exact de vier opgegeven variabelen |
| Data-modus | **`CASTIQ_DATA_MODE=supabase`**, op beide doelen; oude verkeerd benoemde variabelen vervangen |
| Supabase staging | Castiq-account, `zovwrexlzmhyejnfnmid`, Frankfurt |
| Supabase productie | Duindorpdoet-account, `jyqajjfyksasehdlzfuf`, Frankfurt; eigen lege appinrichting |
| Databases | Acht onveranderlijke migraties toegepast; private schema’s, beperkte serverrollen en TLS1.3 met certificaat-/hostnamecontrole |
| Databasebeveiliging | Alle 32 tabellen hebben RLS; de operatiesleutel heeft bewust geen runtime/anonpolicy. Anon/authenticated kunnen de beheers-RPC niet uitvoeren. Supabase securityadviseur: geen errors; wachtwoordlekbescherming staat als externe Auth-waarschuwing open (app gebruikt OTP/Google) |
| Eerste beheerder | `info@dgwebservices.nl` heeft op beide projecten een echte bevestigde Auth-identiteit en platformmembership; geen voorwaarden namens deze persoon aanvaard |
| Login | Code accepteert precies zes cijfers en ondersteunt Google. Beide providers werkelijk ingeschakeld; externe Auth-URL/OTP/templateconfiguratie en menselijke eindsessietest blijven afzonderlijke controles |
| E-mail | Bestaande templates vooraf gecontroleerd: geen. Nu 13 Supabase HTML-templates, één Castiq-renderer, versieerbaar beheer, versleutelde Resendconfiguratie, outbox, retries en geverifieerde receipts |
| Resend API | Nog geen API-sleutel/geverifieerde afzender/webhookgeheim ingevoerd. Geen afleveringsbewijs geclaimd. Bestaande Supabase SMTP is geen Castiq API-credential |
| Juridisch | Voorwaarden, privacy, DPA, bedrijfsgegevens, subverwerkers en accountverwijdering; exacte downloadarchieven `2026-11-22.1`, ingangsdatum 22 november 2026 |
| Aanvaarding | Persoonlijke voorwaarden en bevoegde clubvoorwaarden+DPA afzonderlijk, servercontrole op exacte versie/hash; privacy is informatie, geen verplichte toestemming |
| Privacy | 7 dagen onafgeronde registratie, 30 dagen herstel, 90 dagen bewuste inactiviteit, 12 kalendermaanden zaakmetadata, onafhankelijke 210 dagen wisledger en herstelquarantaine geïmplementeerd en getest |
| Definitieve automatische wissing | **Uit** totdat werkelijke herstel-/overgangs-/providerbewaarbewijzen beschikbaar zijn; geen fictieve Stackmail-/backuppurge. Directe blokkering en privacyverzoeken zijn beschikbaar |
| Clubproces | Bestaande duurzame concepten, revisies, exacte goedkeuring, feedback, clubweek, sponsors en weekendoverzichten behouden; server bewaakt tenant/team en conflicten |
| Publicaties | Uitsluitend expliciete sandbox. Geen echte kanalen, bereik, sponsorbetalingen of externe succesbewijzen verzonnen |
| Host | `dg-vps-08`, eigen canonieke staging-/productiestructuur naar Fabelpad-contract; gescheiden runner/build/appaccounts en private configuraties |
| Runners | Twee nieuwe eigen online runners met exclusieve doellabels; digestgebonden beperkte sudo, geen algemene runner-sudo |
| Netwerk en logs | Eigen units blokkeren controlepoorten; Caddy/healthbron 127.0.0.2, echte probes geslaagd; eigen journals30 dagen |
| Bestaande Fabelpad | Voor/na hostvoorbereiding dezelfde PIDs/current-paden en gezonde health-URLs; geen bestaande data/configuratie gewijzigd |
| Release | Handmatige exacte-SHA-routes voor beide doelen, main+exacte-CI-admissie, gescheiden kandidaatbuild/activatie en app/runtimepaarrollback getest |
| Productieactivatie | Niet uitgevoerd; geen productiedomein/proxy/service geactiveerd |

## Uitgevoerde lokale controles tijdens integratie

- TypeScript, 25 domeintests, 24 Node-releasechecks en 33 Python-boundarychecks geslaagd.
- 69 server-/privacy-/mail-/pilotchecks geslaagd, inclusief clubinrichting, platform/clubscheiding en ontbrekende wisregisters.
- Juridische tekst/hash/downloadconsistentie en alle oorspronkelijke assets geslaagd.
- Werkelijke Supabase-controles: projectscheiding/regio, Auth-providerflags, beperkte databaseverbinding, geen Auth-schema-/rolbeheer voor runtime, geweigerde vervalste Edge-operatiesleutel en alleen service-role RPC-uitvoering.

16 volledige browserproeven en een aanvullende platformproef zijn geslaagd. Beide eigen applicatiebackups zijn daadwerkelijk geïsoleerd hersteld (31 tabellen per doel, inhoudchecksums gelijk). De onafhankelijke lege wisregisters zijn na bevestiging van nul wistaken eenmalig geïnitialiseerd, met root-owned continuïteitsbewijs. De definitieve clean-checkoutbuild, doelkandidaten en activatie worden als afzonderlijke resultaten vastgelegd. Een groene build/readiness is geen bewijs van OTP-ontvangst, Google-toestemming of externe e-mail-/socialpublicatie.

## Open externe gegevens

Zie [BENODIGDE-GEGEVENS.md](BENODIGDE-GEGEVENS.md), [Auth/e-mail-instructies](AUTH-EN-MAIL.md), [privacybeheer](PRIVACY-BEHEER.md) en [release-/rollbackprocedure](DG-RELEASE.md). De HTML-templates en per-omgeving Auth-configuratiepatches zijn direct beschikbaar onder `emails/`.
