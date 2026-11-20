# Castiq bouwstatus

Bijgewerkt op 20 november 2026. Scope: de bestaande app lokaal behouden en de deployment naar het nieuwe stagingdoel voorbereiden. Er is geen eerste activatie of publieke ingebruikname uitgevoerd. [DG-RELEASE.md](DG-RELEASE.md) bevat de uitvoerbare vervolgstappen; [DG-VPS-08-HOST.md](DG-VPS-08-HOST.md) bevat de afzonderlijke hostbewijzen.

| Onderdeel | Status | Bewijs of concrete vervolgstap |
| --- | --- | --- |
| Overdracht / bronbasis | Behouden | README, VALIDATION, STAGING-SPEC; ongewijzigde import `f9afa122fc2c4c13b703daef19d68c7c5ddd820c` |
| Repository en branches | Geverifieerd | `castiqnl/platform`, integratie `main`; voorbereiding op `codex/dg-vps-08-staging-preparation`, begonnen vanaf `9061381596cb2c647504461726fceb2148b192fb` |
| Ontwerp en assets | Behouden | 50 oorspronkelijke bestanden en 27 standaardtemplates; bestaande mobiele flow |
| Lokale database en rollen | Beschikbaar | Eigen PostgreSQL 17, drie fictieve clubs, serverautorisatie en privé-uploads |
| Revisies en mobiele flow | Lokaal geïmplementeerd | Duurzame inzending, tweede apparaat, feedback, exacte goedkeuring en versieconflicten |
| Publicatiewachtrij | Uitsluitend sandbox | Enqueue, export en timeout gelden niet als externe publicatie |
| Acceptatiematrix / pilot | Historisch lokaal vastgelegd | 52 gevallen met lokaal/deels/open; echte stagingpilot volgt na externe aansluiting |
| Vier publieke configuratienamen | Geïmplementeerd en lokaal getest | Expliciete Vite-allowlist; aparte build- en runtimevalidatie; geen databasegeheim in de build |
| Releasebeveiliging | Lokaal getest | `npm run test:release`: 23 Node-tests en 28 Python-tests geslaagd, inclusief CI-admissie, bronherkomst, locks, activatiefouten en rollback van app/configuratieparen |
| Overige lokale verificatie | Geslaagd | 25 domeintests, 18 server-/pilottests en 4 browsertests; exacte build en schone checkout in het releaseverslag |
| Readiness | Geïmplementeerd en lokaal getest | `/api/readiness` controleert migratiechecksums, uploadrechten en statische index; HTTP 503 bij ontbreken, geen bewijs van externe Auth/providerwerking |
| Nieuwe doelhost | Voorbereid | `dg-vps-08`, eigen accounts/paden, Node 24.18.0/npm 11.16.0 en gereserveerde loopbackpoort 4184 |
| Repo-eigen runner | Geregistreerd en online | `dg-vps-08-castiq-staging`, ID `21`; afgescheiden van app- en buildrechten |
| Build- en activatieroute | Handmatig voorbereid | Volledige SHA op `main`, exacte geslaagde CI, vier publieke variabelen; bouwen activeert niets |
| Bestaande doelomgeving | Behouden | Alleen-lezen voor/na-controles in het hostrapport; geen publieke Castiq-proxy of DNS toegevoegd |
| Controleplane-isolatie | Op de doelhost geverifieerd | Runner, build en app/worker gecontroleerd; eigen proxybron `127.0.0.2`, root-only bewijs gebonden aan unithashes. Gewijzigde inrichting weigert activatie |
| Doelkandidaat | Niet gebouwd | Juiste vier publieke waarden en CI op de vrijgegeven SHA moeten beschikbaar zijn; de kandidaatbuild leest geen databasegeheimen |
| App / sandboxwerker op doelhost | Inactive | Geen `current`-verwijzing, geen appactivatie en geen externe staging-URL |
| Supabase / echte login | Externe aansluiting open | Gebruiker koppelt project en vult publieke waarden; beperkte runtime-databaserol, migraties, mail en redirects nog verifiëren |
| Echte kanaalpublicaties | Open | Expliciete testaccounts, officiële providerautorisatie, echte adapters en receipts ontbreken |
| Productie | Buiten scope | Ongewijzigd |

Een geslaagde lokale build en een kandidaatbuild op de doel-VPS zijn afzonderlijke resultaten. De huidige voorbereiding claimt geen doelbuild, werkende externe login of echte post. Het releaseverslag bevat de exacte oplevercommit, actuele volledige testresultaten en resterende blokkades. Benodigde gegevens en accounts staan in [BENODIGDE-GEGEVENS.md](BENODIGDE-GEGEVENS.md).
