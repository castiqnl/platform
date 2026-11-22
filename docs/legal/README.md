# Juridische documenten en publicatiecontrole

Datum: 22 november 2026. De laatste expliciete gebruikersopdracht gaat vóór instructies in de aangeleverde documenten. Voor de bedrijfsgegevens worden uitsluitend de opgegeven gegevens gebruikt: DG Webservices, eenmanszaak, Den Haag, KvK 88135713, www.dgwebservices.nl en info@dgwebservices.nl. Er is geen straatadres, btw-nummer of andere contactpersoon verzonnen of uit een externe bron toegevoegd.

## Bronnen en aangeboden versies

`sources/` bewaart de drie aangeleverde bestanden ongewijzigd, inclusief de aantoonbaar omkeerbare tekenvervorming. `sources/manifest.json` legt de SHA-256 van die originele bytes vast. De openbare versie herstelt uitsluitend de bewezen CP1252/UTF-8-dubbelcodering, vult de toegestane bedrijfsgegevens en datum in, verwijdert interne HTML-commentaren en vervangt de invulvelden door concrete informatie over de gebruikte dienst.

| Document | Openbare route | Exacte download |
| --- | --- | --- |
| Algemene voorwaarden | `/algemene-voorwaarden` | `/legal/2026-11-22.1/terms.md` |
| Privacyverklaring | `/privacyverklaring` | `/legal/2026-11-22.1/privacy.md` |
| Verwerkersovereenkomst met overstapbijlage | `/verwerkersovereenkomst` | `/legal/2026-11-22.1/processor.md` |

Versie `2026-11-22.1`, ingangsdatum 22 november 2026. `shared/legalDocuments.ts` bevat de exacte teksten, versies en hashes die de UI aanbiedt en de server voor acceptatie gebruikt. `public/legal/2026-11-22.1/manifest.json` verbindt die versie met de download. De server archiveert de aangeboden tekst en weigert een gewijzigde inhoud onder dezelfde versie. Na de eerste aanbieding mag deze map niet worden herschreven: maak een volgende versiemap en laat bestaande downloads beschikbaar.

Aanvullende openbare routes zijn `/bedrijfsgegevens`, `/account-verwijderen`, `/subverwerkers` en `/cookiebeleid`. Alle pagina's zijn toegankelijk zonder account en hebben een print-/PDF-knop. De drie contractdocumenten kunnen afzonderlijk worden opgeslagen. De pagina's laden geen externe afbeeldingen, lettertypen, trackers of Markdown-HTML.

Controle:

```sh
node scripts/verify-legal.mjs
node --test tests/serverLegalDocuments.test.ts
npm run check
```

## Acceptatie en reikwijdte

`LegalAcceptance` legt nooit een privacytoestemming op. De privacyverklaring wordt vooraf als informatie aangeboden. Een persoonlijk gebruiker aanvaardt uitsluitend de toepasselijke voorwaarden voor het eigen gebruik; dat maakt hem niet bevoegd de club te binden. Een clubvertegenwoordiger aanvaardt voorwaarden én verwerkersovereenkomst en bevestigt afzonderlijk zijn vertegenwoordigingsbevoegdheid. De server controleert de actuele documentversies en de actuele clubrol en legt actor, UTC-tijd, scope, versie, hash en bij clubacceptatie de werkruimte vast. Een browsercheckbox alleen geldt niet als serverbewijs.

OTP en Google-login leiden naar dezelfde servergestuurde persoonlijke afronding. Een auth-identiteit krijgt daardoor geen clubrol. Bestaande accounts krijgen geen verzonnen oude acceptatie of activiteit. Materiële wijzigingen vragen een bewaarbare aankondiging en waar nodig nieuwe aanvaarding; verander geen geaccepteerde versies achteraf.

De overstapbijlage is onderdeel van de aangeboden verwerkersovereenkomst. Export en sluiting zijn afzonderlijke clubhandelingen via een geverifieerd verzoek; persoonlijke verwijdering sluit de club niet. De beheerder moet een beveiligde export en overdracht werkelijk uitvoeren en bewijzen. De openbare teksten geven geen betaalopdracht, pakketprijs of consumentenabonnement vrij.

## Feitelijke grondslag en resterende verificatie

Beide Supabase-projecten zijn in deze sessie via de gekoppelde accounts als `eu-central-1` (Frankfurt) vastgesteld. Een Europese database-regio sluit internationale support- of operationele verwerking niet uit. De openbare teksten zeggen daarom niet dat alle verwerking binnen de EER blijft. De klantgebonden Supabase-DPA, de concrete hostingketen, de Resend-DPA en verdere leveranciersretentie moeten als contractbewijs worden bewaard; de aanwezigheid van een publieke leveranciers-DPA is geen bewijs dat de accountovereenkomst is gesloten.

Voor het supportadres is geen afzonderlijke Stackmail-contractpartij, regio, mailboxkoppeling of providerback-upretentie aangetoond. De openbare tekst noemt daarom supportmail via het opgegeven contactadres en claimt geen werkende Stackmail-purge. Maak geen algemene IMAP-selectie op een gedeelde zakelijke mailbox. De afgesproken termijn van twaalf kalendermaanden vereist afhandelstatus plus gecontroleerde verwijdering van de Castiq-berichten, bijlagen, verzonden kopieën, archief en prullenbak. Leg de providerbevestiging en eventuele beperkte uitzonderingen vast voordat automatische productieopschoning wordt vrijgegeven.

De applicatielogtermijn is dertig dagen. Dit vraagt de eigen journald-namespace met de projectspecifieke retentie-instelling; wijzig geen gedeelde hostretentie. Supabase-/Resend-providerlogs en backups moeten apart worden gecontroleerd. De 180-dagenlimiet voor backups geldt voor snapshots, incrementele ketens, oude exports en providerkopieën; een databasekolom met een einddatum is nog geen verwijderbewijs van die kopieën.

Destructieve productieopschoning blijft geblokkeerd totdat de niet-destructieve proef, hersteltest met onafhankelijk wisregister, overgang voor bestaande accounts en leveranciersretentie zijn gecontroleerd. Interne open punten worden in het gegevensregister bijgehouden en niet als invulvelden of conceptlabels gepubliceerd.

## Primaire bronnen voor beoordeling

- [AVG, met name artikel 28](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=celex%3A32016R0679): contract tussen verantwoordelijke en verwerker met concrete instructies, beveiliging, bijstand en controle.
- [EU Data Act](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX%3A32023R2854): het overstapproces vraagt vooraf kenbare contractafspraken. De bijlage legt eigen afspraken vast voor export, overgang en ophalen; toepasselijkheid moet bij het concrete commerciële aanbod worden beoordeeld.
- [Supabase DPA](https://supabase.com/legal/customer-resources/data-processing-addendum) en [regio-/doorgifte-informatie](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq): database-regio en internationale support zijn verschillende onderdelen van de beoordeling.
- [Resend DPA](https://resend.com/legal/dpa) en [privacybeleid](https://resend.com/legal/privacy-policy): afzonderlijk vastleggen naast de feitelijke SMTP/API-configuratie.

De teksten zijn product- en contractimplementatie op basis van de aangeleverde opdracht. Zij zijn geen certificering van naleving en vervangen de feitelijke leveranciers- en uitvoeringsbewijzen niet.
