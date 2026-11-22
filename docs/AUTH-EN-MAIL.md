# Supabase Auth en Castiq-mail

Datum: 22 november 2026. Staging en productie zijn afzonderlijke Supabase-projecten, met elk een eigen platformbeheerder en private mailsleutels. De browser accepteert precies zes cijfers, inclusief een beginnende nul. Google staat onder de e-mailaanmelding met het Google-icoon.

## Supabase instellen

Projecten: staging `zovwrexlzmhyejnfnmid`, productie `jyqajjfyksasehdlzfuf`. Beide publieke Auth-settings zijn daadwerkelijk gecontroleerd: e-mail en Google ingeschakeld, aanmeldingen toegestaan, geen automatische e-mailbevestiging.

Per project:

1. Authentication → URL Configuration: Site URL `https://staging.castiq.nl` respectievelijk `https://castiq.nl`. Toegestane redirect: uitsluitend de bijbehorende `https://<domein>/**`. Google callback in Google Cloud blijft de door Supabase opgegeven `/auth/v1/callback` van dat project.
2. Authentication → Providers → Email: **Email OTP Length = 6**. Behoud verplichte e-mailbevestiging. De tekst van een template verandert de serverinstelling niet.
3. Authentication → Email Templates: plak de 13 HTML-bestanden uit [emails/supabase](../emails/supabase). `confirmation.html` is bevestiging van registratie, `magic_link.html` is de normale e-mail-OTP. Onderwerpen en HTML staan samen in `auth-template-config.json`.
4. Laat Resend SMTP en de bestaande Google-credentials staan. Controleer geverifieerde afzender, SPF/DKIM en eventuele linktracking; lever geen tokens in logs aan.
5. Meld daadwerkelijk aan met een ontvangen code van zes cijfers. Test ook Google en de redirect terug naar hetzelfde doel. De juridische aanvaarding en clubrechten worden daarna op de Castiq-server gecontroleerd.

De complete beperkte patches zijn [staging.json](../emails/configuration/staging.json) en [production.json](../emails/configuration/production.json). Ze bevatten geen SMTP-/Googlegeheimen. Zij zijn **klaargezet**, toepassing is alleen bevestigd als de configuratiescript-controle dat vastlegt.

Met een tijdelijk veilig beschikbaar gesteld Management API-token kan dezelfde controle/toepassing worden uitgevoerd zonder dashboardhandwerk:

```sh
node scripts/configure-supabase-auth.ts --environment staging
node scripts/configure-supabase-auth.ts --environment staging --apply
node scripts/configure-supabase-auth.ts --environment production --apply
```

Het script leest `SUPABASE_ACCESS_TOKEN` uit de private procesomgeving en toont geen token, SMTP-wachtwoord of API-responsbody. Het patcht uitsluitend de templates, OTP-lengte, URL’s en verplichte e-mailbevestiging, en leest daarna ieder veld terug. Dit token hoort niet in GitHub-variabelen of de applicatieruntime. Zonder token blijft het een controleerbare export.

## Beheren en synchroniseren

Platformbeheer → E-mail beheert onderwerpen, koppen, teksten en knoppen. Wijzigingen krijgen een nieuwe onveranderlijke versie. Alle dienstmails en Supabase-exports gebruiken dezelfde Castiq-renderer. HTML en templatevariabelen worden veilig begrensd. De beheerder kan voor Supabase exporteren; opslaan in Castiq wijzigt het externe Supabase-project niet vanzelf. Neem na iedere wijziging de export over in het juiste project.

Platformbeheer → E-mail → Resend: voer een eigen Resend API-sleutel, geverifieerd afzenderadres en optioneel antwoordadres in. Plaats het webhookgeheim van de endpoint `https://<domein>/api/mail/webhook` in hetzelfde scherm. Gebruik voor staging en productie afzonderlijke configuratie. Sleutels zijn alleen schrijfbaar, worden met een omgevingsgebonden AES-256-GCM-sleutel versleuteld en nooit teruggegeven. Recente heraanmelding is vereist voor wijzigingen.

Dienstmail gaat via de duurzame outbox en de worker. Een bericht houdt zijn oorspronkelijke templateversie, payload en idempotentiecode. Timeouts blijven onbevestigd en worden op dezelfde aanvraag gereconcilieerd; na het idempotentievenster stopt automatische herverzending. Alleen passend geverifieerd providerbewijs bevestigt aflevering aan de ontvangende mailserver. Aflevering bewijst geen lezing.

De controlemail richt zich uitsluitend op `info@dgwebservices.nl`. Bewaar provider-ID en afleveringsstatus als bewijs. Zonder API-sleutel/afzender blijft de verbinding zichtbaar ongeconfigureerd. Er is geen sleutel uit een andere omgeving hergebruikt.

## Accountbeheer

Castiq vertrouwt geen rolclaims uit wijzigbare gebruikersmetadata. De server verifieert de Supabase-identiteit en leest actuele club-/teamrechten uit zijn private schema. Persoonlijke registratie maakt geen club en verleent geen tekenbevoegdheid. Platformbeheer ziet tenant- en operationele metadata, zonder standaard clubinhoud.

De Edge Function `castiq-account-operations` heeft eigen sterke authenticatie en een service-role-only autorisatie-RPC. Zij kan uitsluitend het expliciet opgegeven eerste beheeradres aanmaken en reeds door de privacybackend geautoriseerde sessie-intrekking of identiteitswissing uitvoeren. De service-role key blijft in Supabase. De VPS gebruikt een afzonderlijke beperkte operatiesleutel. Het intrekken van Auth-sessies verhindert refresh; bestaande access-tokens worden bij ieder Castiq-verzoek aanvullend door de geblokkeerde accountstatus geweigerd.

[Bewaar- en herstelprocedures](PRIVACY-BEHEER.md) en [e-mailstatusdetails](../emails/README.md) horen bij deze configuratie.
