# Castiq e-mailtemplates

Er waren bij de controle van 22 november 2026 geen bestaande HTML-e-mailtemplates, e-mailproviderinstellingen of transactionele mailwachtrij in de applicatie. Alleen de Supabase-aanmeldclient bestond.

De 13 HTML-bestanden in `supabase/` horen bij de authenticatie- en beveiligingshandelingen van Supabase. Iedere mail gebruikt dezelfde donkere Castiq-opmaak, limoengroene actieknop, juridische links en veilige tekstweergave als dienstmail vanuit de applicatie. OTP-mails tonen `{{ .Token }}`: Supabase vult hier de ingestelde code in. Stel **Email OTP Length op 6** in het betreffende project in; de HTML-tekst alleen wijzigt die instelling niet. De applicatie accepteert precies zes cijfers, inclusief een beginnende nul. De templates gebruiken `{{ .SiteURL }}` en volgen daardoor het afzonderlijke Supabase-project van staging en productie.

## Toevoegen in Supabase

1. Open het **juiste project** en ga naar Authentication → Email Templates.
2. Neem de HTML uit het overeenkomstige bestand over. De bestandsnaam volgt de officiële Supabase-templatenaam. `magic_link.html` is **Magic link or OTP**; `confirmation.html` is **Confirm sign up**.
3. Neem de bijbehorende onderwerpregel over uit `supabase/auth-template-config.json`. Deze JSON is ook geschikt als beperkte PATCH-body voor de officiële Management API `/v1/projects/{ref}/config/auth`.
4. Stel **Email OTP Length = 6** in bij Authentication → Providers → Email. Controleer Site URL en toegestane redirect-URLs voor dat ene doel. Neem geen staging-URL over in productie.
5. Beveiligingsmeldingen worden alleen verzonden als ze in het betreffende Supabase-project zijn ingeschakeld. De export verandert deze aan/uit-instellingen niet.
6. Behoud de bestaande Resend SMTP-koppeling. Controleer de aflevering met een uitdrukkelijk bedoelde testaanmelding. Een geslaagde aanvraag is geen afleveringsbewijs.

De applicatie vraagt Google OAuth aan via de bestaande Supabase-provider. Google staat onder de e-mailaanmelding, met Google-icoon. De provider moet per project ingeschakeld zijn en de Google OAuth-configuratie moet de projectcallback toestaan. Auth levert een persoonlijke identiteit; clubrollen blijven servergestuurd.

## Beheren in Castiq

Platformbeheer heeft een e-mailbeheerscherm. Daar zijn onderwerp, kop, bericht en knoptekst te wijzigen. Elke wijziging legt een nieuwe, onveranderlijke versie vast; de Castiq-opmaak blijft gelijk. Teksten worden ge-escaped. Vrije uitvoerbare HTML is niet toegestaan. Dienstmails gebruiken de laatste templateversie bij het aanmaken van de opdracht; een bestaande opdracht houdt zijn eigen bevroren versie.

Een gewijzigde Supabase-template moet daarna met **Supabase-templates exporteren** worden geëxporteerd en in het bijbehorende project worden toegepast. De interface meldt uitdrukkelijk dat opslaan of exporteren geen bevestiging van toepassing in Supabase is. Er wordt geen Supabase Management API-token in de applicatie gevraagd of opgeslagen.

Het exportbestand uit de applicatie bevat de actuele databaseversies. De repositorybestanden bevatten de standaardversie. Standaardbestanden opnieuw genereren:

```sh
node scripts/export-mail-templates.ts
```

## Resend API en geheimen

De vier GitHub-variabelen blijven het volledige publieke buildcontract. Resend API- en webhookgeheimen zijn **geen extra GitHub-variabelen**. Platformbeheer kan ze via de applicatie invoeren of vervangen na een recente aanmelding. Lege sleutelvelden behouden bestaande waarden; sleutels worden nooit teruggestuurd.

De eigen runtime heeft een private `MAIL_ENCRYPTION_KEY` nodig, een willekeurige sleutel van 32 bytes als base64 of 64 hextekens. Deze staat alleen in de afgeschermde runtimeconfiguratie, buiten broncode, frontend, buildaccount en artefacten. De database bewaart API- en webhookgeheimen met AES-256-GCM, gebonden aan omgeving en doel. Een sleutel uit staging kan daardoor niet met de productiecontext worden geopend. Bewaar deze sleutel in de goedgekeurde geheime backupvoorziening: bij verlies zijn opgeslagen Resend-sleutels onbruikbaar. Een host-keyrotatie vraagt eerst gecontroleerde her-encryptie van opgeslagen configuratie; vervang de host-key niet zelfstandig.

Vul een daadwerkelijk door Resend geverifieerd afzenderadres in en eventueel een antwoordadres. Een afzender wordt niet verzonnen. De applicatie gebruikt uitsluitend `https://api.resend.com` voor providerverzoeken. Configureer de Resend-webhook op `/api/mail/webhook` en sla het bijbehorende `whsec_`-geheim op. De ruwe webhookbody wordt met de officiële Svix-library geverifieerd vóór JSON-verwerking; ongeldige handtekeningen worden geweigerd. Open-/kliktracking wordt niet door deze code ingesteld of verwerkt.

## Status en herstel

De duurzame mailwachtrij bewaart een minimale, bevroren payload, templateversie, idempotentiecode, pogingen en provider-ID. De worker gebruikt voor retries exact dezelfde payload en Resend-idempotentiecode. Resend bewaart die code 24 uur. Na 23 uur onzekerheid zonder provider-ID stopt de automatische verzending voor handmatige reconciliatie; een late controle mag geen nieuwe mail veroorzaken.

`accepted` betekent alleen aangenomen door Resend. Alleen een geverifieerde `email.delivered`-webhook of een officiële providercontrole met `last_event=delivered` bevestigt ontvangst door de ontvangende mailserver. Dit bewijst niet dat een mens de mail gelezen heeft. Bounce, spamklacht, mislukking en onbevestigde timeouts blijven afzonderlijke statussen. Late callbacks kunnen een bounce of spamklacht niet terugzetten naar afgeleverd. Herhaalde webhook-ID's leveren geen dubbele bewijsregels op. Ruwe providerfouten, e-mailinhoud en tokens worden niet gelogd.

Accountverwijdering gebruikt de beperkte `erasePersonalMail`-functie om de aan die actor gekoppelde payload en bewijsregels te verwijderen. Dit gebeurt binnen de geautoriseerde privacytransactie en raakt geen andere actor.

De beheerknop voor een controlemail richt zich uitsluitend op het expliciet geautoriseerde beheerdersadres. De knop meldt een aanvraag; controleer daarna de feitelijke providerstatus.

## Officiële bronnen

- [Supabase e-mailtemplates en Management API-velden](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase e-mail OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- [Resend idempotentie (24 uur)](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Resend afleveringsgebeurtenissen](https://resend.com/docs/webhooks/event-types)
- [Resend webhookverificatie](https://resend.com/docs/webhooks/verify-webhooks-requests)
