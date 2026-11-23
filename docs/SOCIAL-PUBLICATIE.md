# Sociale kanalen en publicatie

Gecontroleerd op 23 november 2026. Deze implementatie gebruikt de officiële provider-API's voor stilstaande clubvisuals: Instagram-feed en Instagram Stories (waar het accounttype dit toestaat), Facebook Page-feed en foto-Stories, en X-posts met een afbeelding. Video's, Reels, carrousels en advertentiecampagnes vallen buiten deze beeldpublicatieflow.

Een vereniging verleent zelf toestemming en kiest het eigen account of de eigen pagina. De gebruikelijke route gebruikt de centraal geregistreerde Castiq-providerapp. De provider bepaalt de zichtbare appnaam en eventuele bronvermelding; die naam moet in het providerdashboard daadwerkelijk **CastIQ** zijn. Bronvermelding wordt niet als tekst aan berichten toegevoegd. Een afzonderlijke clubregistratie blijft als expliciete override mogelijk.

## Inrichting

1. Platformbeheer richt de centrale providerregistratie in onder **Platform → Providerapps**. App-ID, appgeheim, goedgekeurde rechten en callback moeten overeenkomen met de echte providerregistratie. Appgeheimen worden uitsluitend via het afgeschermde formulier ingevuld en versleuteld opgeslagen. Ze worden niet teruggestuurd naar de browser.
2. De clubbeheerder opent **Koppelingen → Koppelen** en doorloopt voorbereiden, providertoestemming, account/pagina selecteren en controle. Een geopende toestemmingspagina geldt niet als een afgeronde koppeling.
3. Voor externe publicatie moet de server expliciet `PUBLICATION_MODE=provider` gebruiken, de effectieve centrale of clubregistratie zijn geactiveerd en de geselecteerde verbinding geldig zijn. Standaard blijft `PUBLICATION_MODE=sandbox`. Bestaande sandboxopdrachten veranderen nooit in echte publicaties.
4. Publicatie start uitsluitend vanuit een goedgekeurde bijdrage met geldige beeld- en naamvoorkeuren. De opdracht bevriest de revisie, templateversie, prijs-/brandingkeuze, mediahashes en autorisatie-identiteit. Opnieuw koppelen geeft een nieuwe autorisatie-identiteit; automatische tokenvernieuwing behoudt die identiteit.

De private hostconfiguratie bevat afzonderlijke `CHANNEL_TOKEN_ENCRYPTION_KEY` en `PUBLICATION_MEDIA_SIGNING_KEY`. Centrale providerregistraties kunnen via het afgeschermde platformformulier worden opgeslagen; optionele bestaande private provideromgevingsvariabelen blijven ondersteund. Deze waarden horen niet in publieke buildvariabelen, Git, screenshots, chat of logregels.

## Beeld en bevestiging

De build maakt `server/generated/posterRenderer.mjs` uit dezelfde SVG-componenten als de editor. De server gebruikt de bevroren template en clubgegevens, dezelfde gebundelde lettertypen en dezelfde atlas-kleurmaskers. Sharp levert een JPEG van 1080×1350 voor feed en 1080×1920 voor Story. Lokale assets, private clubuploads en centrale templateuploads worden aan hun vastgelegde hashes getoetst. Centrale ontwerpbeelden worden uitsluitend uit de platformopslag gelezen; willekeurige externe afbeeldingen worden niet door de server opgehaald.

Meta haalt uitsluitend het goedgekeurde renderbeeld op via een ondertekende URL die maximaal één uur geldig is. Originele uploads blijven afgeschermd. De route controleert de club, opdracht, goedkeuring, publicatiemodus, actieve appconfiguratie en dezelfde accountautorisatie. Pauzeren, gewijzigde goedkeuring, intrekken of opnieuw koppelen maakt die toegang ongeldig. Queryparameters van deze route mogen niet in toeganglogs terechtkomen: de handtekening verleent tijdelijke toegang tot het publicatiebeeld.

De worker legt elke publicatie-intentie en ontvangen container-/media-ID apart en duurzaam vast in `publication_dispatches`, voordat een openbare schrijfaanvraag begint. Dit journaal blijft bruikbaar wanneer de workspacetransactie of het workerproces daarna uitvalt. Een timeout of 5xx wordt niet als publicatiebevestiging opgeslagen en leidt niet tot een tweede blinde publicatieaanvraag.

| Provider | Publiceren | Controle na onduidelijk antwoord |
| --- | --- | --- |
| Instagram | Media-container met beeld-URL maken, gereedstatus controleren, dezelfde container publiceren. | De opgeslagen container uitlezen. `PUBLISHED` is een echte bevestiging van die container; als de media-ID verloren ging, wordt het bewijs expliciet als containerbevestiging opgeslagen zonder verzonnen berichtlink. |
| Facebook-feed | Foto ongepubliceerd uploaden en dezelfde foto aan een Page-feedpost koppelen. | De `page_story_id` van precies die foto uitlezen. |
| Facebook Story | Foto ongepubliceerd uploaden en via `photo_stories` publiceren. | Page-Stories op dezelfde `media_id` controleren. |
| X | JPEG via de OAuth 2-media-upload-API uploaden en de media-ID aan een nieuwe post koppelen. | Alleen een unieke combinatie van dezelfde mediakey en tekst in de accounttijdlijn bevestigen. Een ontbrekende of dubbelzinnige match blijft onbevestigd. |

Onbevestigde opdrachten worden met oplopende wachttijd opnieuw gecontroleerd (één tot vijftien minuten). Na een gewijzigde revisie of toestemming kan alleen een leescontrole van een al begonnen aanvraag plaatsvinden. Een eerder duurzaam bevestigde publicatie blijft als feit bewaard, ook wanneer daarna wordt gepauzeerd of ontkoppeld.

## Tokenvernieuwing

Instagram-tokens worden tijdens hun geldigheid tijdig vernieuwd via `refresh_access_token`. Verlopen tokens vereisen opnieuw toestemming. X gebruikt `offline.access` en slaat zowel het nieuwe toegangstoken als het geroteerde refreshtoken samen versleuteld op. Een verloren rotatieantwoord leidt tot opnieuw autoriseren; hetzelfde mogelijk verbruikte refreshtoken wordt niet blind herhaald. Facebook wisselt bij koppeling eerst om naar een langlevend gebruikerstoken en vraagt daarmee langlevende Page-tokens op. Page-tokens hebben geen vaste vervaldatum, maar kunnen worden ingetrokken; de worker controleert ze daarom periodiek. Bestaande kortlevende Page-koppelingen worden waar mogelijk omgewisseld.

Wanneer meerdere clubs hetzelfde provideraccount en dezelfde appautorisatie gebruiken, wist ontkoppelen eerst alleen de credentials en toegang van de betreffende club. De gedeelde providertoestemming blijft beschikbaar voor de andere club. Alleen bij de laatste bekende verbinding wordt de externe toestemming ingetrokken. Een niet leesbare andere autorisatie leidt uit voorzorg tot alleen lokaal ontkoppelen; het systeem claimt dan geen externe intrekking. De audit vermeldt deze keuze zonder gegevens van de andere club te tonen.

Alle verversingen gebruiken dezelfde volgorde van club- en verbindingslocks als ontkoppelen. De nieuwe tokeninhoud wordt met versiecontrole opgeslagen. OAuth-flows zijn aan club, actor, browsernonce, eenmalige state en effectieve appconfiguratie gebonden. Configuratiewijzigingen wachten op lopende autorisaties; een wijziging tussen configuratielezen en flowstart veroorzaakt een conflict.

## Uitgevoerde verificatie

`tests/server.socialPublish.test.ts` controleert de concrete providerpaden met synthetische fetchantwoorden, bevroren payloads na een JSONB-rondgang, echte server-JPEG's met fonts/assets, getekende beeldtoegang, tokenrotatie, verloren antwoorden en de keten **API-aanmaken → indienen → goedkeuren → in wachtrij → worker → echte receiptsoort**. De workerproef controleert dat de intentie al gecommit is tijdens de provideraanvraag en dat herstel na een verloren workspace-write geen tweede post maakt. Bestaande OAuth-, sandbox-, revisie- en tenanttests blijven afzonderlijk van deze providerproeven.

Er zijn tijdens deze implementatie geen echte posts aangemaakt of providercredentials verzonnen. Een echte toestemming en eerste publicatie met de geconfigureerde Castiq-app vereisen de actuele providerregistratie, goedgekeurde rechten en een beheerd testaccount.

## Officiële bronnen

- [Instagram Content Publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing)
- [Instagram Business Login en tokenvernieuwing](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login)
- [Instagram Container-status](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-container)
- [Facebook Page-posts](https://developers.facebook.com/docs/pages-api/posts/)
- [Facebook foto-Stories en status](https://developers.facebook.com/documentation/video-api/page-stories-api)
- [Facebook langlevende User- en Page-tokens](https://developers.facebook.com/documentation/facebook-login/guides/access-tokens/get-long-lived)
- [X OAuth 2 en refreshtokens](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)
- [X media-upload](https://docs.x.com/x-api/media/upload-media)
- [X post maken](https://docs.x.com/x-api/posts/create-post)
- [Sharp: expliciet fontbestand voor serverrendering](https://sharp.pixelplumbing.com/api-constructor/)
