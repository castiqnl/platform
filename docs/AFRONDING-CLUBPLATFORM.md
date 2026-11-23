# Afronding clubplatform — 23 november 2026

Deze wijziging vult de bestaande Castiq-webapp aan. De release richt zich op staging; de afzonderlijke Android-/Play-voorbereiding in de bovenliggende werkmap valt buiten deze wijziging.

## Wat nu op centrale gegevens werkt

- Clubstart en afzonderlijke pagina’s voor wedstrijden, teams, spelers/privacy, huisstijl, media, gebruikersrechten, publicatieregels, activiteit en statistieken. De teamomgeving toont uitsluitend het eigen team. Knoppen naar wedstrijdbronnen en activiteit hebben een werkelijke bestemming.
- Maatwerkaanvragen met centrale opslag, geschiedenis, beoordeling, conflictcontrole en toewijzing van een exact gepubliceerd template. Verschillende ontwerpen uit dezelfde basisstijl blijven afzonderlijk kiesbaar, ook in de bijdragewizard.
- Centrale templatebeelden via beveiligde uploads. Beelden worden geschoond, gehasht en met de gepubliceerde templateversie vastgelegd. Willekeurige externe afbeeldings-URL’s worden geweigerd. Bronbestanden blijven privé.
- Pakketfilters, gebruiksaantallen, echte toegangsstatus, afzonderlijke proefperiodestatus, sortering/paginering en behoud van eigen invoer bij een wijzigingsconflict. Bundelkeuzes starten geen factuur of incasso; automatische facturering is niet geïmplementeerd.
- Sportlink-inrichting per vereniging, verbindingscontrole en programma-import voor een gekozen bronteam en bestaand Castiq-team. Handmatige wedstrijden blijven behouden. Wijzigingen aan een bron trekken betrokken goedkeuringen in.
- Officiële beeldpublicatie naar Instagram, Facebook en X, versleutelde tokenvernieuwing, afzonderlijk duurzaam verzendjournaal en herstel zonder blind opnieuw te publiceren. Een sandboxbevestiging blijft herkenbaar als sandboxbewijs.
- Verwijdering van persoonlijke accounts bestrijkt ook actorverwijzingen in template-, pakket-, kanaal- en integratiegeschiedenis. Gedeelde clubgegevens en gebruikte centrale templatebeelden blijven behouden. De bestaande blokkade op destructieve retentie blijft actief.

## Instellen en gebruiken

1. Platformbeheer opent **Providerapps**. Registreer de echte providerapps op naam van **CastIQ** en neem de getoonde callback-URL’s over. Vul app-ID, appgeheim en aantoonbaar goedgekeurde rechten in het afgeschermde formulier in. Deel geen geheimen via chat, documentatie of Git.
2. De clubbeheerder opent **Koppelingen** en doorloopt de wizard voor het eigen Instagram-account, de eigen Facebook-pagina of het eigen X-account. Iedere vereniging geeft zelf toestemming en kiest de bestemming. Een eigen ontwikkelaarsapp is voor deze gewone route niet nodig.
3. Onder **Wedstrijdbronnen** kan de clubbeheerder het eigen Sportlink Club.Dataservice Client-ID bewaren, de teams controleren en het programma voor een gekozen team inlezen. Hiervoor is een werkelijk Sportlink-abonnement nodig.
4. Richt huisstijl, teams en privacykeuzes in. Gebruikers registreren hun eigen account; een bevoegde clubbeheerder kan bestaande accounts via hun account-ID rechten geven. Dit verstuurt geen uitnodiging.
5. Maak een bijdrage, controleer beeld- en naamgebruik, dien de versie in en keur precies die versie goed. Kies daarna kanaal en eventueel tijdstip. Pas een ontvangen providerbewijs bevestigt externe publicatie.
6. Controleer foutmeldingen en onbevestigde aanvragen in de bijdrage en kanaalmonitor. Pauzeren voorkomt nieuwe verzendingen; het wist een eerder gepubliceerd bericht niet. Ontkoppelen verwijdert de clubtoegang. Gedeelde providerautorisatie voor andere verenigingen blijft behouden.

Facebook kan de naam van de publicerende app tonen. Die naam komt uit de daadwerkelijke Meta-appregistratie; Castiq kan niet afdwingen waar Facebook de bronvermelding aan bezoekers of beheerders toont. Er wordt geen nagebootste bronvermelding aan de berichttekst toegevoegd.

## Grenzen van het bewijs

Server- en browsertests gebruiken synthetische accounts en gegevens. Providerverzoeken worden in de tests met gecontroleerde antwoorden nagebootst; er zijn geen echte posts of betalingen aangemaakt. Een werkende persoonlijke login is door de eigenaar bevestigd. De actuele CastIQ-providerregistraties, goedgekeurde rechten, een echte clubtoestemming en de eerste beheerde externe publicatie blijven afzonderlijke controles. Bewijs over online bereik, likes of mailaflevering wordt niet verzonnen.

Zie [SOCIAL-PUBLICATIE.md](SOCIAL-PUBLICATIE.md) voor de providercontracten en officiële bronnen. De staginguitrol volgt [DG-RELEASE.md](DG-RELEASE.md): exacte SHA, succesvolle CI, versleutelde back-up/herstel, migraties 011–014, geïsoleerde kandidaatcontrole en expliciete activatie. De nieuwe compatibiliteitsgrens is `castiq-schema-v14`; een automatische terugkeer naar de oude worker is verboden. Bij een mislukte grensovergang blijven app en worker in quarantaine totdat een beheerder herstelt.

Uitgerold naar staging op commit `27bf3aa881281042e61cd8823771cfe0a373bb0a`; zie [het uitrolbewijs](deploy-evidence/staging-club-completion-2026-11-23.json).
