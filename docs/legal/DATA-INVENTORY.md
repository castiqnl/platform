# Gegevensregister Castiq

Beoordelingsdatum: 22 november 2026. Staging en productie hebben eigen Supabase-projecten, databaseconfiguratie, opslagpaden, mailconfiguratie, logs en versieparen. Ze delen geen accounts, auth-tokens of inhoudelijke clubdata. De hieronder genoemde termijnen zijn beleidsregels; uitvoeringsstatus en providerbewijzen worden apart gecontroleerd. Een geslaagde taakaanvraag is geen bewijs van externe verwijdering of bezorging.

## Doel, grondslag en toegang

| Stroom / betrokkenen | Gegevens en bron | Doel en grondslag / instructie | Toegang en ontvangers |
| --- | --- | --- | --- |
| Account / gebruiker | E-mail, auth-ID, optionele Google-profielgegevens, registratie- en sessiestatus; gebruiker en gekozen inlogdienst | Persoonlijke toegang, veilige dienst en communicatie; overeenkomst waar gebruiker partij is, anders gerechtvaardigd belang bij veilig clubgebruik | Gebruiker, serverautorisatie, noodzakelijke platformmetadata; Supabase Auth; Google alleen na eigen keuze |
| Clubtoegang / bestuur, vrijwilligers en teammedewerkers | Club-ID, team, rol en geldigheidsduur; bevoegde clubbeheerder | Rechten uitvoeren volgens clubinstructie; geen rechten uit aanpasbare auth-user-metadata | Server controleert actieve lidmaatschappen en tenant; clubbeheer binnen eigen werkruimte |
| Uitnodiging / genodigde | E-mail, rol, werkruimte en status; uitnodigende club | Bevoegde uitnodiging bezorgen en registratie koppelen; dienstbelang en clubinstructie | Betrokken club en genodigde; alleen werkelijk aangesloten uitnodigingsroute telt als operationeel |
| Contractbewijs / vertegenwoordiger en gebruiker | Actor, scope, club-ID waar relevant, tekstversie, hash en UTC-acceptatie | Afspraken aantoonbaar vastleggen; overeenkomst en noodzakelijk bewijs | Afgeschermde serveradministratie; exacte openbare documenten bevatten geen persoonsdata |
| Clubcontent / spelers, jeugd, vrijwilligers en sponsors | Teksten, namen, wedstrijdgegevens, revisies, goedkeuringen, foto-/naamvoorkeuren; clubgebruiker | Clubcommunicatie op gedocumenteerde clubinstructie; club bepaalt grondslag en informatie | Alleen bevoegde tenant-/teamrollen; platformbeheer standaard noodzakelijke metadata |
| Media / afgebeelde personen | Geüploade foto, team, bestandstype, afmetingen, hash; club | Besloten bronmedia bewaren en toegestane uiting maken; clubinstructie en rechtencontrole | Server-API met actuele auth- en rolcontrole; geen publieke bronmedia-URL; lokale appmediaopslag op doelhost |
| Publicatie en sponsoroverzicht | Bevroren payload, contentrevision, opdracht, poging, kanaalbewijs; exacte goedgekeurde versie | Clubinstructie voor gekozen kanaal en sponsorverantwoording; privacyvoorkeuren blijven gelden | Clubredactie; huidige adapter is expliciete sandbox, geen echte kanaalkoppeling of bereikmeting |
| Browser / websitebezoeker en gebruiker | Noodzakelijke auth-opslag, PKCE, herstelkopie van invoer, openbare asset-cache | Gevraagde login, herstel en appwerking; noodzakelijke technische opslag | Persoonlijk apparaat; Supabase-login; geen analytics-, AI- of advertentietrackers aangesloten |
| Dienstmail / gebruiker | E-mail, beperkte templatevariabelen, bevroren bericht, provider-ID en bezorgstatus | Login, beveiliging, accountwaarschuwing en noodzakelijke dienstcommunicatie | Supabase SMTP via Resend voor Auth; Resend API voor appmail waar geconfigureerd; geen jeugdcontent of exports in waarschuwingen |
| Privacyzaak / aanvrager en vertegenwoordiger | Contact, verzoek en noodzakelijke verificatie; rechtstreeks verzoek | AVG-rechten uitvoeren, wettelijke verplichting en beperkt uitvoeringsbewijs | Afgeschermde privacywerkvoorraad; club krijgt alleen eigen verantwoordelijke scope |
| Support / correspondent | Door aanvrager verstrekte berichten en bijlagen | Vraag afhandelen; overeenkomst waar toepasselijk, anders gerechtvaardigd belang of wettelijke plicht | Opgegeven contactadres; feitelijke mailboxpartij en geïsoleerde purge nog te verifiëren |
| Technische logs / gebruiker | Correlatie-ID, foutcode, component en noodzakelijke tijdstippen; server | Storingsonderzoek, beveiliging en misbruikpreventie; gerechtvaardigd belang | Eigen app-/werkernamespace en bevoegde operators; geen tokens of berichtinhoud in joblogs |
| Back-up en wisregister | Afgeschermde datakopie; onafhankelijk gepseudonimiseerd wisreferentiebewijs | Gecontroleerd herstel en voorkomen terugkeer van gewiste data; beveiliging en aantoonbare wissing | Gescheiden herstelrechten, quarantaine en geverifieerde herapplicatie van wissingen vóór vrijgave |
| Facturatie / zakelijke clubcontacten | Alleen indien werkelijk ingevoerd: factuur- en betaalreferenties | Contract en fiscale bewaarplicht | Er is geen betaalprovider of consumentencheckout aangesloten; voorbeeldprijzen mogen geen betaald aanbod activeren |

## Locaties en afspraken

| Systeem | Vastgesteld | Nog te bewaren of te verifiëren |
| --- | --- | --- |
| Supabase staging | Account Castiq; project `zovwrexlzmhyejnfnmid`; Frankfurt `eu-central-1` | Accountgebonden DPA/TIA, subprocessorwijzigingen, providerlogs, auth-/backupretentie en ondersteuning |
| Supabase productie | Account Duindorpdoet; project `jyqajjfyksasehdlzfuf`; Frankfurt `eu-central-1` | Zelfde bewijs afzonderlijk; geen stagingcredentials of testclubs gebruiken |
| Applicatie en media | Eigen Castiq-inrichting op geverifieerde `dg-vps-08`; beoogde staging.castiq.nl / castiq.nl | Hostingcontractpartij, fysieke locatie, snapshots en providerverwijdering; een IP of domein bewijst geen regio |
| Resend | Door gebruiker bevestigd SMTP in beide Supabase-projecten; API-configuratie per omgeving | Resend-DPA, afzenderdomein, eigen webhooksignatuur, retentie, bounce-opvolging en gescheiden bezorgbewijs |
| Google | Door gebruiker bevestigd OAuth-credentials in beide projecten | Eigen callback-/redirectlijst en minimale scopes, providerbeleid en daadwerkelijke browsertest |
| Supportmail | info@dgwebservices.nl opgegeven | Stackmail/provider/reseller, regio, autorisatie, isolated scope, backups, expunge en afhandelstatus |
| Niet aangesloten | Sportlink, AI, analytics, echte sociale kanalen, betaalprovider | Geen persoonsgegevens doorsturen of werking claimen zolang deze niet expliciet worden aangesloten |

## Bewaarkalender en wissing

| Dataset | Start en uiterste termijn | Uitvoering en afhankelijkheid |
| --- | --- | --- |
| Onvoltooide nieuwe registratie | Eerste opgeslagen registratiegegeven + 7 verstreken dagen | Verwijder uitsluitend registratiegegevens en uitsluitend daarvoor gemaakte auth-identiteit; herhaalde poging verlengt niet; bestaande gebruikers/losse uitnodiging onderscheiden |
| Zelf aangevraagde accountwissing | Bevestiging + 30 verstreken dagen | Gewone toegang direct blokkeren, sessies intrekken; expliciet herstel vóór deadline; actieve wissing op deadline, met zichtbare deelstapfouten |
| Persoonlijke inactiviteit | Laatste betrouwbare bewuste activiteit + 90 verstreken dagen | Waarschuwingen 14 en 3 dagen vooraf; geen tweede herstelperiode; tokenrefresh/passieve sync/mailopen tellen niet; bestaande accounts vereisen aangekondigde overgang |
| AVG-zaakmetadata | Afsluiting + 12 kalendermaanden | Alleen referentie, soort, noodzakelijke status/tijden en uitkomst; detailstukken en contact eerder wissen zodra overbodig |
| Minimaal wisbewijs | Voltooide actieve wissing + 210 verstreken dagen | Gepseudonimiseerde technische referentie zonder naam/e-mail/inhoud; onafhankelijk van herstelbare productiedatabase en backups; herhaling verlengt niet |
| Backups | Aanmaak + maximaal 180 verstreken dagen | Alle beheerde kopieën en ketens; verwijderbewijs vereist; herstel in quarantaine met wisregister vóór vrijgave |
| Supportmail | Afhandeling + 12 kalendermaanden | Afhandelstatus, expliciete selectie, berichten/bijlagen en alle beheerde kopieën, echte provider-expunge en backupcontrole; niet op gedeelde mailbox blind wissen |
| Applicatielogs | Logtijd + maximaal 30 verstreken dagen | Eigen journald-namespace; concrete incidentele uitzondering apart motiveren en herbeoordelen; providerlogs apart vastleggen |
| Gedeelde clubcontent | Instructie club en afwikkeling clubsluiting | Geen cascade vanuit auth-user; persoonlijke attributie waar mogelijk pseudonimiseren; bevroren publicatiebewijs niet herschrijven als berichtcorrectie |
| Voorwaarden-/contractbewijs | Contract en daarna noodzakelijk, beperkt bewijsdoel | Afgescheiden en beperkt toegankelijk; uitzonderingsreden, verantwoordelijke en herbeoordelingsdatum vastleggen |
| Fiscale basisadministratie | Wettelijke termijn, in de regel 7 jaar | Uitsluitend echte administratie, afzonderlijk van clubcontent; geen demo-betaling tot factuur verheffen |
| Browserherstel en cache | Tot opruimen betreffende kopie / sitegegevens door gebruiker / vervanging cache | Geen centrale wisbevestiging voor een offline apparaat; afmelden en siteopslag uitleggen; geen besloten media in publieke asset-cache |

Tijdstempels worden server-side in UTC bepaald. Dagen zijn verstreken dagen; maanden kalendermaanden met een deterministische grens. Termijnen worden niet vernieuwd door retries, late callbacks, herstel uit backups of dubbele activiteit. Wettelijke uitzonderingen vereisen dataset, verantwoordelijke, reden en herbeoordelingsdatum, met beperkte toegang.

## DPIA en ingebruikname

Beoordeel vóór het verwerken van echte jeugdcontent de schaal, herkenbaarheid, koppeling van datasets, kwetsbare betrokkenen, openbare verspreiding en mogelijkheden van clubs om rechten te behandelen. Jeugdgegevens en openbaarmaking verhogen het risico; de aanwezigheid van een jeugdtemplate alleen bewijst geen verplichte of afgeronde DPIA. Leg de screening vast per werkelijk aangeboden verwerking en voer een DPIA uit wanneer die waarschijnlijk een hoog risico oplevert. Deze sessie certificeert geen DPIA als afgerond.

Voor eerste clubgebruik moeten ten minste de bevoegde contractacceptatie, processorafspraken, privacyvoorkeuren en begrenzing van publicaties werken. Voor destructieve productiejobs gelden daarnaast de serverbeveiliging en bewijzen van dry-run, restore, overgang en leveranciersretentie. Bevestig alleen de systemen en externe acties die daadwerkelijk zijn getest.
