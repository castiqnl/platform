# Castiq bouw- en omgevingsstatus

Bijgewerkt: 22 november 2026. **Staging draait op https://staging.castiq.nl**, met afzonderlijke actieve API en worker. Productie is buildklaar en met een echte tijdelijke API én worker getest, maar niet geactiveerd. Uitgangscommit van deze uitbreiding: `92bbc5ed8c146efc6957e6ad30a9a5e9cf5fa09e`; vrijgegeven applicatiecommit: **`f38e8f77963761157315accfb6d96140f0cae9bb`**. Latere documentatiecommits veranderen die release niet. De gebruiker voert de opgeleverde Supabase Auth-instellingen zelf uit.

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
| Bestaande Fabelpad | Voor/na Castiq-activatie dezelfde PIDs/current-paden en gezonde health-URLs. Vóór die activatie was een afzonderlijke nieuwe Fabelpad-release waargenomen; die is behouden. Geen Fabelpad-data/configuratie gewijzigd |
| Release | Handmatige exacte-SHA-routes voor beide doelen, main+exacte-CI-admissie, gescheiden kandidaatbuild/activatie en app/runtimepaarrollback getest |
| Stagingactivatie | Geslaagd; HTTPS, health/readiness200, API en worker active/enabled, mobiele login en publieke juridische routes gecontroleerd |
| Productieactivatie | Niet uitgevoerd; geen productiedomein/proxy/service geactiveerd |

## Uitgevoerde lokale controles tijdens integratie

- TypeScript, 25 domeintests, 24 Node-releasechecks en 40 Python-boundarychecks geslaagd.
- 70 server-/privacy-/mail-/pilotchecks geslaagd, inclusief echte workerstart via releasesymlink, clubinrichting, platform/clubscheiding en ontbrekende wisregisters.
- Juridische tekst/hash/downloadconsistentie en alle oorspronkelijke assets geslaagd.
- Werkelijke Supabase-controles: projectscheiding/regio, Auth-providerflags, beperkte databaseverbinding, geen Auth-schema-/rolbeheer voor runtime, geweigerde vervalste Edge-operatiesleutel en alleen service-role RPC-uitvoering.

17 volledige browserproeven zijn geslaagd in de exacte-SHA-CI, inclusief staging/productie op smalle login- en appschermen. De schone afzonderlijke lokale checkout is met beide echte publieke doelprofielen gebouwd. Beide eigen applicatiebackups zijn daadwerkelijk geïsoleerd hersteld (31 tabellen per doel, inhoudchecksums gelijk). De onafhankelijke lege wisregisters zijn na bevestiging van nul wistaken eenmalig geïnitialiseerd, met root-owned continuïteitsbewijs. Een groene build/readiness is geen bewijs van OTP-ontvangst, Google-toestemming of externe e-mail-/socialpublicatie.

## Exacte release en bewijs

| Controle | Run / resultaat |
| --- | --- |
| Volledige push-CI op applicatie-SHA | [45074145732](https://github.com/castiqnl/platform/actions/runs/45074145732), success |
| Kandidaat staging op doel-VPS | [45074332095](https://github.com/castiqnl/platform/actions/runs/45074332095), success |
| Kandidaat productie op doel-VPS | [45074436060](https://github.com/castiqnl/platform/actions/runs/45074436060), success |
| Alleen staging geactiveerd | [45074504198](https://github.com/castiqnl/platform/actions/runs/45074504198), success |
| Runtimeprofiel | `initial-20261122`, eigen root-only profiel per omgeving |
| Huidige stagingrelease | `f38e8f77963761157315accfb6d96140f0cae9bb-45074332095-1-initial-20261122` |

De kandidaten staan daadwerkelijk onder `/srv/sites/castiq-vps08-<omgeving>/candidates/`. De [definitieve kandidaatproeven](deploy-evidence/candidate-probes-final-2026-11-22.json) tonen per omgeving health/readiness200, privé-API401, demo-login405 en verkeerde JWT401. Ook de echte worker bleef via een tijdelijke releasesymlink met dezelfde PID draaien; lege wachtrijen, privacy-dry-run en opruimen zijn gecontroleerd. Er zijn geen e-mails of socialposts verzonden.

Het [uitrolbewijs](deploy-evidence/staging-release-2026-11-22.json) bevat de toestand vóór/na, publieke controles, certificaat en behoud van Fabelpad. Caddy is gevalideerd en herladen; alleen de eigen stagingroute is toegevoegd. HTTP verwijst met308 naar HTTPS. De zeven juridische routes en drie onveranderlijke downloadhashes zijn publiek gecontroleerd; ook mobiel login, Googleknop, weigering van `?demo=1` en afwezigheid van browserfouten zijn gecontroleerd.

Dit is de eerste volledig gezonde API-/workerrelease. De eerdere eigen API-release met commit `7cdb874…` had een workerstartprobleem; haar bestanden zijn behouden, het bewijs is als `api-only-verified.json` gearchiveerd en zij is geen rollbackdoel. Er is nu nog geen vorige volledig gezonde combinatie. De rollbackprocedure is offline getest; na een volgende gezonde release bewaart zij deze huidige combinatie. Zie [DG-RELEASE.md](DG-RELEASE.md).

## Handmatige vervolgstappen

1. Stel in beide Supabase-projecten de eigen URL/redirects, OTP-lengte6 en HTML-templates in volgens [AUTH-EN-MAIL.md](AUTH-EN-MAIL.md). Test daarna werkelijk OTP-ontvangst, Google-terugkeer en persoonlijke aanvaarding met `info@dgwebservices.nl`.
2. Voer per omgeving de eigen Resend API-sleutel, geverifieerde afzender en webhookconfiguratie in Castiq-beheer in. Controleer een echte aflevering aan de hand van providerbewijs.
3. Rond providerbewaarbewijzen, externe sleutelbewaring en de privacyvrijgave af vóór definitieve automatische wissing. Die wissing blijft uit. Echte sociale kanalen vragen nog officiële adapters/testaccounts.

## Open externe gegevens

Zie [BENODIGDE-GEGEVENS.md](BENODIGDE-GEGEVENS.md), [Auth/e-mail-instructies](AUTH-EN-MAIL.md), [privacybeheer](PRIVACY-BEHEER.md) en [release-/rollbackprocedure](DG-RELEASE.md). De HTML-templates en per-omgeving Auth-configuratiepatches zijn direct beschikbaar onder `emails/`.
