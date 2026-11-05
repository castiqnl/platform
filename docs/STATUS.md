# Castiq bouwstatus

Bijgewerkt op 5 november 2026. Scope: lokale bouw en broncode op GitHub integreren. Externe staging en productie zijn niet gewijzigd.

| Onderdeel | Status | Bewijs of vervolgstap |
| --- | --- | --- |
| Overdracht volledig gelezen | Gereed | README, VALIDATION, STAGING-SPEC en aangeleverde werkwijze |
| Bronbasis vastgelegd | Gereed | Lokale importcommit `f9afa122fc2c4c13b703daef19d68c7c5ddd820c` |
| Geïsoleerde ontwikkeling | Gereed | Implementatie op `codex/local-staging-foundation`, daarna geïntegreerd op `main` met behoud van de GitHub-initialisatie |
| Repositorykoppeling | Gereed | `origin` verwijst naar `https://github.com/castiqnl/platform.git`; `main` is de integratiebranch |
| Originele typecheck/tests/build | Geslaagd | 12 domeintests; ongewijzigde basis afzonderlijk uitgevoerd |
| Originele assets | Geslaagd | 50 SHA-256 controles; 27 standaardtemplates behouden |
| Lokale database | Gereed | Eigen PostgreSQL 17 container, alleen loopback, drie fictieve clubs |
| Serveropslag en rechten | Lokaal getest | API, transacties, exacte revisies, tenant-/teamgrenzen, privé-uploads |
| Mobiele serverflow | Lokaal getest | Upload, herstel in tweede browsersessie, feedback en versieconflict |
| Publicatiewachtrij | Sandbox getest | Duurzame leases, herstart/reconciliatie, expliciete demo-uitkomsten |
| Acceptatiematrix en pilot | Vastgelegd | 52 gevallen met lokaal/deels/open; weekendsimulatie met drie testclubs |
| Supabase projecten en login | Code voorbereid, externe configuratie open | OTP/Google/sessies; project en mailgateway ontbreken |
| Echte kanaalpublicaties | Open | Testaccounts, officiële providerautorisatie en receipts ontbreken |
| Stagingdeployment | Geblokkeerd door ontbrekende projectgegevens | Host, DNS/URL, site-ID, runners en wrappercontract ontbreken |
| Productie | Buiten scope | Ongewijzigd |

De actuele resultaten worden vastgelegd in `VERIFICATIE.md`. Benodigde accounts en configuratie staan in `BENODIGDE-GEGEVENS.md`.
