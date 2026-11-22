# Accounttoegang en beheer

## Aanmelden en registreren

Castiq gebruikt in staging en productie `CASTIQ_DATA_MODE=supabase`. E-mailregistratie en aanmelden gebruiken dezelfde Supabase-route met een eenmalige code van precies zes cijfers. Onder de e-mailaanmelding staat **Doorgaan met Google**. Een externe aanmelding geeft op zichzelf geen clubrol.

Een geverifieerde gebruiker aanvaardt eerst expliciet de actuele voorwaarden voor persoonlijk gebruik. De privacyverklaring wordt als informatie aangeboden, zonder toestemmingsvakje. Deze handeling registreert de exacte documentversie en SHA-256. De frontend opent vóór dat akkoord geen werkruimte. De API controleert dit zelfstandig.

Zonder toegewezen clubrol ziet de gebruiker een wachtbericht en toegang tot de persoonlijke accountinstellingen. Met meerdere rollen kiest de gebruiker eerst een werkruimte. Het verzoek bevat de gekozen clubreferentie; de server controleert de actuele lidmaatschappen. Een clubwissel en afmelden sluiten geopende bijdragen en verwerpen antwoorden uit een eerdere sessie of werkruimte.

Een bevoegde clubbeheerder sluit de clubvoorwaarden en verwerkersovereenkomst met een afzonderlijk akkoord en een afzonderlijke bevoegdheidsverklaring. Teammedewerkers kunnen dit niet namens de club doen. De gedeelde clubacceptatie wordt als documentmetadata getoond; de identiteit van de ondertekenaar wordt daarvoor niet aan teammedewerkers verstrekt.

## Persoonlijke accountinstellingen

Iedere rol heeft **Instellingen → Account**. Ook een gebruiker zonder clubrol kan deze instellingen openen. Hier staan de eigen toegangsrollen en accounttermijn, een persoonlijke export en het verwijderverzoek. Exporteren, herstellen en verwijderen vereisen een recente beveiligde aanmelding volgens de servercontrole.

Voor verwijderen is een expliciete bevestiging nodig. De server blokkeert daarna onmiddellijk de gewone toegang. De gebruiker ziet een afzonderlijk herstelscherm; opnieuw inloggen herstelt niets automatisch. De herstelknop verschijnt alleen wanneer de server expliciet aangeeft dat zelfherstel voor dit eigen verzoek nog is toegestaan. Voor inactiviteit geldt geen aanvullende hersteltermijn.

De verwijderuitleg houdt het persoonlijke account en gezamenlijke clubgegevens uit elkaar. Een laatste clubbeheerder ziet een waarschuwing en kan een bestaande actieve clubgebruiker als opvolger kiezen. Een onbekende accountreferentie wordt niet als vrije invoer gevraagd. De overdracht vindt uitsluitend binnen de geselecteerde club plaats.

De frontend meldt bewuste interacties met muis, aanraking of toetsenbord maximaal eenmaal per vijf minuten bij de privacy-API. Alleen vertrouwde browserinteracties van een actief persoonlijk account met akkoord komen hiervoor in aanmerking. Dit gebruikt geen achtergrondtimer. Focus, automatisch verversen, tokens vernieuwen en e-mail openen leveren via deze route geen activiteit op. De server bepaalt het tijdstip en verlengt geen verlopen accounttermijn. Een mislukte ontvangstbevestiging telt niet als geregistreerde activiteit.

De definitieve wis- en herstelcontroles en leveranciersblokkades staan in [PRIVACY-BEHEER.md](PRIVACY-BEHEER.md).

## Platformbeheer

Platformbeheer bevat verenigingen, het toewijzen van clubrollen, e-mailinstellingen en minimale privacyzaakmetadata. Een nieuwe vereniging begint zonder fictieve teams, spelers, wedstrijden, sponsors, berichten of gekoppelde publicatiekanalen. Alleen een geregistreerde actieve gebruiker kan een clubrol krijgen; persoonlijke en clubbevoegdheid blijven gescheiden. Platformaccounts zijn uitgesloten van clubroltoewijzing en clubselectie, ook wanneer er een oude gemengde rolrelatie bestaat. De API handhaaft dit zelfstandig; voor clubwerk is een afzonderlijk clubaccount nodig.

Privacyzaken tonen aanvankelijk alleen zaakmetadata en reactietermijnen. De behandelaar moet een open zaak expliciet aan zichzelf toewijzen voordat contactgegevens en de noodzakelijke toelichting kunnen worden geopend. Een aangevraagde verlenging blijft zichtbaar als onbevestigd totdat een passend afleverbericht is geverifieerd; de oorspronkelijke reactietermijn blijft tot die verificatie staan. Een zaak afronden is een expliciete afzonderlijke handeling.

Bij **E-mail** kan beheer een Resend API-sleutel en webhookgeheim invoeren of vervangen. Bestaande geheimen komen niet terug in de response of invoervelden. De omgeving bewaart deze versleuteld. De API-sleutel voor dienstmail en de SMTP-koppeling van Supabase Auth zijn afzonderlijke verbindingen. De beheeromgeving biedt dezelfde versieerbare Castiq-templates en een Supabase-export. Het toepassen van een export in Supabase is een afzonderlijke stap; een export bevestigt geen synchronisatie. Zie [emails/README.md](../emails/README.md).

## Studio en clubinrichting

Clubbeheer heeft **Clubinrichting** voor de eigen huisstijl, teams, minimale spelersgegevens, publicatievoorkeuren en handmatig ingevoerde wedstrijden. Alle opgeslagen wijzigingen gebruiken de centrale versiecontroles.

De studio behoudt alle 27 oorspronkelijke standaardstijlen en vier formaten. De foto staat tussen de onderlaag en de effectoverlay. De studiocatalogus gebruikt neutrale ontwerpteksten. Voorbeeldkleuren en een lokale voorbeeldfoto op dit scherm worden expliciet als onopgeslagen preview beschreven. Een bijdrage met de gekozen stijl gaat naar de bestaande concept- en goedkeuringsroute. Besloten clublogo's worden met geauthenticeerde media-aanvragen geladen. Er is geen terugval naar een fictief clubembleem.

De live interface verwijst niet naar de browserdemo. Staging en productie tonen de werkelijke omgeving uit de API; publicatiekanalen blijven zichtbaar als niet gekoppeld. Een sandboxtest, wachtrijstatus of providerrequest wordt niet als een externe publicatie weergegeven.

## Verificatie

De browserproeven controleren persoonlijke versus clubacceptatie, de vereiste bevoegdheidsverklaring, clubselectie, expliciet zelfherstel, geen extra hersteltermijn na inactiviteit, verwijderbevestiging, bewuste versus passieve activiteit, platformmail, zes OTP-cijfers en de Google-knop. De authproef gebruikt een expliciete mock en bevestigt geen echte aflevering of Google-aanmelding.

De bestaande mobiele proef met twee apparaten, foto-upload, feedback, exacte revisies, sandbox, conflicten, late antwoorden, verlopen rechten, browserherstel en O10-exports blijft opgenomen. Mobiele screenshots van account, e-mailbeheer en studio staan na de browserrun in `test-results/evidence/`; deze testartefacten worden niet als echte club- of providerbewijzen gebruikt.
