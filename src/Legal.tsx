import React, {useEffect, useState} from 'react';
import {ArrowLeft, ArrowUpRight, Check, Download, FileCheck2, Printer, ShieldCheck} from 'lucide-react';
import {LEGAL_DOCUMENTS, legalDocumentReferences, type LegalDocumentKind, type LegalDocumentReference} from '../shared/legalDocuments';
import {api} from './serverClient';
import './legal.css';

const extraPages = ['/account-verwijderen', '/bedrijfsgegevens', '/cookiebeleid', '/subverwerkers'];
export function getLegalPath(pathname = location.pathname, hash = location.hash): string | null {
  const path = pathname.replace(/\/$/, '') || '/';
  const candidate = hash.startsWith('#/') ? hash.slice(1).split('?')[0].replace(/\/$/, '') : path;
  const routes = [...Object.values(LEGAL_DOCUMENTS).map(document => document.path), ...extraPages];
  return routes.includes(path) ? path : routes.includes(candidate) ? candidate : null;
}
export function LegalLinks({compact = false}: {compact?: boolean}) {
  return <nav className={'legal-links' + (compact ? ' legal-links-compact' : '')} aria-label="Voorwaarden en privacy">
    <a href="/algemene-voorwaarden">Voorwaarden</a><a href="/privacyverklaring">Privacy</a><a href="/account-verwijderen">Account en privacyverzoeken</a><a href="/bedrijfsgegevens">Bedrijfsgegevens</a>
  </nav>;
}

function safeHref(href: string) {
  return /^\/(?!\/)|^https:\/\/|^mailto:/.test(href) ? href : '#';
}
function Inline({text}: {text: string}) {
  const tokens = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return <>{tokens.map((token, index) => {
    if (token.startsWith('**')) return <strong key={index}>{token.slice(2, -2)}</strong>;
    const match = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    return match ? <a key={index} href={safeHref(match[2])}>{match[1]}</a> : <React.Fragment key={index}>{token}</React.Fragment>;
  })}</>;
}
/** A deliberately small Markdown renderer: document text never becomes raw HTML. */
export function LegalText({content}: {content: string}) {
  const lines = content.split('\n'), blocks: React.ReactNode[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim()) continue;
    if (line.startsWith('# ')) continue;
    if (line.startsWith('### ')) { blocks.push(<h3 key={index}>{line.slice(4)}</h3>); continue; }
    if (line.startsWith('## ')) { blocks.push(<h2 key={index} id={'artikel-' + index}>{line.slice(3)}</h2>); continue; }
    if (line.startsWith('|')) {
      const table: string[][] = [];
      while (index < lines.length && lines[index].startsWith('|')) {
        const cells = lines[index].slice(1, -1).split('|').map(cell => cell.trim());
        if (!cells.every(cell => /^[-:\s]+$/.test(cell))) table.push(cells);
        index++;
      }
      index--;
      blocks.push(<div className="legal-table-wrap" key={index} tabIndex={0} role="region" aria-label="Gegevensoverzicht"><table><thead><tr>{table[0].map((cell, column) => <th scope="col" key={column}><Inline text={cell}/></th>)}</tr></thead><tbody>{table.slice(1).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, column) => <td key={column}><Inline text={cell}/></td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (line.startsWith('- ')) {
      const entries: string[] = [];
      while (index < lines.length && lines[index].startsWith('- ')) entries.push(lines[index++].slice(2));
      index--;
      blocks.push(<ul key={index}>{entries.map((entry, item) => <li key={item}><Inline text={entry}/></li>)}</ul>);
      continue;
    }
    const paragraph: string[] = [line];
    while (index + 1 < lines.length && lines[index + 1].trim() && !/^(#|\||- )/.test(lines[index + 1])) paragraph.push(lines[++index]);
    blocks.push(<p key={index}>{paragraph.map((text, lineIndex) => <React.Fragment key={lineIndex}><Inline text={text.trimEnd()}/>{lineIndex < paragraph.length - 1 && (text.endsWith('  ') ? <br/> : ' ')}</React.Fragment>)}</p>);
  }
  return <div className="legal-document">{blocks}</div>;
}

const privacyKinds = [
  ['erasure', 'Gegevens eerder laten wissen'], ['access', 'Mijn gegevens inzien'], ['rectification', 'Gegevens corrigeren'], ['restriction', 'Verwerking beperken'], ['portability', 'Gegevens overdragen'], ['objection', 'Bezwaar maken'], ['withdrawal', 'Toestemming intrekken'],
];
function PrivacyRequest() {
  const [kind, setKind] = useState('erasure'), [email, setEmail] = useState(''), [message, setMessage] = useState('');
  const [status, setStatus] = useState<'ready'|'sending'|'sent'>('ready'), [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setStatus('sending');
    try { await api('/api/privacy/requests', {method: 'POST', body: JSON.stringify({kind, email, message})}); setStatus('sent'); setEmail(''); setMessage(''); }
    catch (failure) { setError((failure as Error).message); setStatus('ready'); }
  }
  return <section className="legal-request" aria-labelledby="privacy-request-title"><div className="legal-section-icon"><ShieldCheck size={23}/></div><h2 id="privacy-request-title">Gegevens eerder laten wissen</h2><p>Je kunt hier ook een ander privacyrecht uitoefenen, zonder Castiq-account. Een vertegenwoordiger kan namens een betrokkene een verzoek doen. Deel alleen wat nodig is; stuur geen identiteitsbewijs, wachtwoord of medische gegevens mee.</p>
    {status === 'sent' ? <div className="legal-success" role="status"><Check size={20}/><div><strong>Je verzoek is ontvangen.</strong><p>We beoordelen je bericht en nemen zo nodig contact op om je identiteit of bevoegdheid zorgvuldig te verifiëren. We geven via dit formulier geen informatie over het bestaan van een account.</p><button type="button" onClick={() => setStatus('ready')}>Nog een verzoek indienen</button></div></div> : <form onSubmit={submit}>
      <label>Wat wil je aanvragen?<select value={kind} onChange={event => setKind(event.target.value)}>{privacyKinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Je e-mailadres<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)}/></label>
      <label>Toelichting<textarea required minLength={5} maxLength={4000} rows={5} placeholder="Geef kort aan om welke gegevens of club het gaat en of je namens iemand anders handelt." value={message} onChange={event => setMessage(event.target.value)}/></label>
      <p className="legal-form-note">We gebruiken deze gegevens om je verzoek te behandelen. Meer hierover staat in de <a href="/privacyverklaring">privacyverklaring</a>. Je kunt ook mailen naar <a href="mailto:info@dgwebservices.nl">info@dgwebservices.nl</a>.</p>
      {error && <p role="alert" className="legal-error">{error}</p>}<button type="submit" className="legal-primary" disabled={status === 'sending'}>{status === 'sending' ? 'Verzoek versturen…' : 'Verzoek versturen'}<ArrowUpRight size={17}/></button>
    </form>}
  </section>;
}
const companyText = `# Bedrijfsgegevens

## Aanbieder van Castiq

**DG Webservices** is een eenmanszaak gevestigd in **Den Haag**.

**KvK-nummer** 88135713  
**Website** [www.dgwebservices.nl](https://www.dgwebservices.nl)  
**E-mail** [info@dgwebservices.nl](mailto:info@dgwebservices.nl)

## Afspraken en contact

Castiq is bedoeld voor verenigingen en andere organisaties. Een bevoegd vertegenwoordiger sluit afspraken namens de club. Een persoonlijk gebruikersaccount geeft toegang binnen de toegewezen rol.

Lees de [algemene voorwaarden](/algemene-voorwaarden), [privacyverklaring](/privacyverklaring) en [verwerkersovereenkomst](/verwerkersovereenkomst). Voor vragen, klachten, het exporteren of sluiten van een clubomgeving kun je het e-mailadres hierboven gebruiken. Je kunt ook zonder account een [privacyverzoek](/account-verwijderen) indienen.
`;
const deletionText = `# Account en privacyverzoeken

## Je persoonlijke account verwijderen

Ga na het inloggen naar **Instellingen → Account → Account verwijderen**. Je ziet de gevolgen voor je toegang en clubrollen en de exacte hersteltermijn. Na bevestiging wordt je gewone toegang direct geblokkeerd. Je kunt vóór de meegedeelde deadline van 30 dagen via de beveiligde herstelroute expliciet herstellen. Gewoon opnieuw inloggen maakt een verwijderverzoek niet ongedaan.

Na de hersteltermijn worden de voor verwijdering in aanmerking komende persoonlijke gegevens gewist. Het gezamenlijke clubwerk, publicaties en eventuele clubovereenkomst vallen onder de zeggenschap van de club. Een persoonlijk account sluiten verwijdert de clubomgeving niet. Een laatste beheerder kan vooraf een bevoegde opvolger aanwijzen; lukt dat niet, dan kan de club via het contactadres een gecontroleerde overdracht aanvragen.

## Zonder toegang of met een eerder wisverzoek

Wil je gegevens eerder laten wissen, kun je niet inloggen of heb je zelf geen account? Dien hieronder een privacyverzoek in of schrijf naar [info@dgwebservices.nl](mailto:info@dgwebservices.nl). Dit kan ook voor gegevens van een kind of iemand die je bevoegd vertegenwoordigt. Een geldig privacyverzoek wordt onafhankelijk van een producthersteltermijn behandeld.

## Wat gebeurt er na je verzoek?

We bevestigen de ontvangst, bepalen welke partij de gegevens beheert en controleren zo nodig op passende wijze je identiteit of bevoegdheid. Voor Castiqs eigen verwerking reageren we zonder onnodige vertraging en uiterlijk binnen één kalendermaand. Alleen waar de AVG dat toestaat kan die termijn met maximaal twee kalendermaanden worden verlengd; we informeren je daarover binnen de eerste maand met de reden. Voor clubcontent ondersteunen we de verantwoordelijke club.

Inzage, correctie, wissing, beperking, overdraagbaarheid, bezwaar en intrekking kunnen afhankelijk van de verwerking van toepassing zijn. De [privacyverklaring](/privacyverklaring) legt de rechten en bewaartermijnen uit. Deel in je eerste bericht alleen noodzakelijke gegevens.
`;
const cookieText = `# Cookies en browseropslag

**Versie en ingangsdatum** 2026-11-22.1 · 22 november 2026

## Noodzakelijk voor het gebruik

Castiq gebruikt browseropslag voor aanmelding, herstel van invoer en het laden van de webapp. Deze functies zijn nodig om de dienst op jouw verzoek te leveren. De huidige applicatie gebruikt geen advertentiecookies en laadt geen analytische tracking. Er worden geen externe lettertypen geladen; de lettertypen staan bij de applicatiebestanden.

| Opslag | Partij en doel | Duur en beheer |
| --- | --- | --- |
| castiq-auth-v1 en bijbehorende PKCE-verificatie | Castiq en Supabase: je sessie en veilige voltooiing van het inloggen | De sessie wordt door Supabase vernieuwd zolang dat is toegestaan. Afmelden beëindigt de lokale sessie. De tijdelijke PKCE-verificatie is nodig tijdens het inloggen. Je kunt de sitegegevens in je browser wissen. |
| castiq-recovery: met je account- en werkruimtereferentie | Castiq: lokale herstelkopie van nog niet opgeslagen invoer | Beschikbaar op dit apparaat totdat de betreffende kopie wordt opgeruimd of je de sitegegevens wist. Gebruik voor vertrouwelijke clubgegevens een persoonlijk beveiligd apparaat. |
| Castiq-cache en openbare assets | Castiq: appicoon, lettertypen en andere openbare vormgevingsbestanden sneller laden | De webapp vervangt verouderde caches bij een nieuwe cacheversie. Je kunt ze verwijderen via de sitegegevens of de opslaginstellingen van je browser. Besloten clubmedia worden niet door deze cache opgeslagen. |

## Google-inloggen en e-mail

Als je Google-inloggen kiest, ga je naar Google. Daar kunnen de eigen noodzakelijke cookies en instellingen van Google gelden. Castiq plaatst geen Google-advertentietrackers. Dienstmails dienen voor toegang, beveiliging en de werking van je account. Het openen van een e-mail telt niet als bewust accountgebruik.

## Je gegevens beheren

Je kunt lokaal opgeslagen Castiq-gegevens verwijderen via de site-instellingen van je browser. Daardoor kun je worden afgemeld en kunnen nog niet centraal opgeslagen wijzigingen verdwijnen. Een browserkopie wissen sluit je persoonlijke account of clubomgeving niet. Lees daarvoor [Account en privacyverzoeken](/account-verwijderen).

Als we later een optionele techniek toevoegen waarvoor toestemming nodig is, laden we die pas na je keuze en bieden we een even eenvoudige intrekroute.
`;
const supplierText = `# Leveranciers en verwerking

**Versie en ingangsdatum** 2026-11-22.1 · 22 november 2026

## Gebruikte diensten

Dit overzicht beschrijft de leverancierscategorieën en technische diensten die voor Castiq worden gebruikt. Voor clubgegevens sluit de club een [verwerkersovereenkomst](/verwerkersovereenkomst). Welke verwerking een partij uitvoert, hangt af van de ingeschakelde functies.

| Dienst | Functie en gegevens | Regio en verdere informatie |
| --- | --- | --- |
| Supabase | Authenticatie en centrale database: accountgegevens, toegangsrelaties en de gegevens van de clubwerkruimte | Beide Castiq-projecten zijn ingericht in Frankfurt, Duitsland (eu-central-1). Supabase beschrijft ook internationale operationele en supportverwerking in zijn [informatie over regio's en doorgifte](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq), [verwerkersafspraken](https://supabase.com/legal/customer-resources/data-processing-addendum) en [subverwerkerslijst](https://supabase.com/legal/customer-resources/subprocessor-list). |
| Resend | Bezorging van inlog- en dienstmails: ontvanger, berichtinhoud en noodzakelijke bezorgmetadata | Internationale verwerking kan plaatsvinden. Zie de [verwerkersafspraken van Resend](https://resend.com/legal/dpa) en het [privacybeleid](https://resend.com/legal/privacy-policy). Mails bevatten geen jeugdcontent of clubexports. |
| Applicatiehosting en besloten mediaopslag onder beheer van DG Webservices | Uitvoering van de webapp en API, opslag van geautoriseerde uploads en noodzakelijke operationele gegevens | Toegang is per omgeving en club afgeschermd. De club ontvangt vóór verwerking informatie over de concrete hostingketen, relevante locaties en bijbehorende afspraken. |
| Maildienst van het contactadres | Berichten en bijlagen die je voor support of een privacyverzoek verstrekt | Alleen voor behandeling en opvolging. We stellen de toepasselijke leveranciersinformatie op verzoek beschikbaar. Stuur in het eerste bericht alleen noodzakelijke gegevens. |

## Een keuze van de gebruiker of de club

Google-inloggen is optioneel. Google ontvangt de gegevens die voor die inlogactie nodig zijn en kan voor eigen dienstverlening zelfstandig verwerkingsverantwoordelijke zijn. Lees het [privacybeleid van Google](https://policies.google.com/privacy). De club kiest zelf of zij een beschikbaar extern publicatiekanaal verbindt. Voor openbare content gelden ook de privacyregels van het gekozen kanaal. Castiq toont een kanaalpublicatie pas als bevestigd wanneer het kanaal daar bewijs voor teruggeeft.

Er zijn geen Sportlink-, AI- of analytische trackingdiensten voor clubgegevens aangesloten. Een eventuele test van publicatie gebruikt een herkenbare sandbox. Een simulatie is geen externe publicatie.

## Internationale verwerking en wijzigingen

Een Europese database-regio sluit toegang of verwerking vanuit andere landen niet volledig uit. Castiq beoordeelt de concrete verwerking en legt waar vereist de toepasselijke doorgiftegrond en aanvullende maatregelen vast. Je kunt informatie over ontvangers, landen en de voor jouw verwerking geldende waarborgen opvragen via [info@dgwebservices.nl](mailto:info@dgwebservices.nl).

De club krijgt vóór verwerking in haar opdracht de toepasselijke informatie en afspraken. Voor nieuwe of vervangende subverwerkers geldt het informatie- en bezwaarproces uit de verwerkersovereenkomst. Deze pagina beweert geen uitsluitend Europese verwerking.
`;

export function LegalPage({path}: {path: string}) {
  const document = Object.values(LEGAL_DOCUMENTS).find(item => item.path === path);
  const extra: Record<string, {title: string; content: string}> = {
    '/bedrijfsgegevens': {title: 'Bedrijfsgegevens', content: companyText}, '/account-verwijderen': {title: 'Account en privacyverzoeken', content: deletionText}, '/cookiebeleid': {title: 'Cookies en browseropslag', content: cookieText}, '/subverwerkers': {title: 'Leveranciers en verwerking', content: supplierText},
  };
  const page = document || extra[path];
  useEffect(() => { window.document.title = `${page?.title || 'Informatie'} · CASTIQ`; }, [page?.title]);
  if (!page) return null;
  return <div className="legal-shell"><a className="legal-skip" href="#legal-main">Naar de inhoud</a><header className="legal-header"><a href="/" aria-label="Castiq home"><img src="/assets/logo-dark.svg" alt="CASTIQ"/></a><a className="legal-login" href="/#/club/dashboard">Naar Castiq<ArrowUpRight size={16}/></a></header>
    <main id="legal-main" className="legal-main"><a className="legal-back" href="/"><ArrowLeft size={15}/>Terug naar Castiq</a><div className="legal-heading"><div><span>DE AFSPRAKEN ACHTER DE CLUBVERHALEN</span><h1>{page.title}</h1><p>Versie 2026-11-22.1 · Ingangsdatum 22 november 2026</p></div><div className="legal-tools"><button type="button" onClick={() => window.print()}><Printer size={16}/>Afdrukken / PDF</button>{document && <a href={document.downloadPath} download><Download size={16}/>Deze versie opslaan</a>}</div></div>
      {import.meta.env.CASTIQ_APP_ORIGIN?.includes('staging.') && ['/privacyverklaring', '/account-verwijderen'].includes(path) && <aside className="legal-environment-note" aria-label="Status van deze stagingomgeving"><strong>Bewaartermijnen op staging</strong><p>Automatische definitieve verwijdering is in deze testomgeving nog geblokkeerd totdat de herstel-, overgangs- en leverancierscontroles zijn afgerond. Accountverwijdering blokkeert de gewone toegang. Je kunt via de privacyroute ook om eerder wissen vragen; een geldige privacyaanvraag wordt afzonderlijk behandeld.</p></aside>}
      <LegalText content={page.content}/>{path === '/account-verwijderen' && <PrivacyRequest/>}
      {document && <details className="legal-proof"><summary>Documentversie en controle</summary><p>Versie {document.version} · SHA-256 <code>{document.sha256}</code></p><p>Het downloadbestand bevat de exacte tekst van deze versie. Aanvaarding wordt met de documentversie en deze controlewaarde vastgelegd.</p></details>}
    </main><footer className="legal-footer"><LegalLinks/><div><a href="/verwerkersovereenkomst">Verwerkersovereenkomst</a><a href="/subverwerkers">Leveranciers</a><a href="/cookiebeleid">Cookies en browseropslag</a></div><p>© 2026 Castiq · DG Webservices</p></footer>
  </div>;
}

export type LegalAcceptancePayload = {scope: 'personal'|'club'; clubId?: string; documents: LegalDocumentReference[]; authorizedRepresentative?: true};
export function LegalAcceptance({scope, clubId, onAccept, onDone}: {scope: 'personal'|'club'; clubId?: string; onAccept: (payload: LegalAcceptancePayload) => Promise<void>; onDone?: () => void}) {
  const [accepted, setAccepted] = useState(false), [representative, setRepresentative] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const kinds: LegalDocumentKind[] = scope === 'club' ? ['terms', 'processor'] : ['terms'];
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!accepted || scope === 'club' && !representative || busy) return;
    setBusy(true); setError('');
    try { await onAccept({scope, ...(scope === 'club' ? {clubId, authorizedRepresentative: true as const} : {}), documents: legalDocumentReferences(kinds)}); onDone?.(); }
    catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  }
  return <section className="legal-acceptance" aria-labelledby="legal-acceptance-title"><FileCheck2 size={27}/><h2 id="legal-acceptance-title">{scope === 'club' ? 'De afspraken voor jouw club' : 'Je persoonlijke toegang'}</h2><p>{scope === 'club' ? 'Lees en bewaar de afspraken voordat je de clubwerkruimte in gebruik neemt. Alleen een bevoegd vertegenwoordiger kan deze namens de club sluiten.' : 'Lees de afspraken voor je Castiq-account. Je gebruikt Castiq namens een club binnen de rechten die je krijgt toegewezen.'}</p>
    <div className="legal-acceptance-documents">{kinds.map(kind => <div key={kind}><a href={LEGAL_DOCUMENTS[kind].path} target="_blank" rel="noopener noreferrer">{LEGAL_DOCUMENTS[kind].title}<ArrowUpRight size={15}/></a><a href={LEGAL_DOCUMENTS[kind].downloadPath} download aria-label={`${LEGAL_DOCUMENTS[kind].title} opslaan`}><Download size={16}/></a></div>)}</div>
    <p className="legal-form-note">In de <a href="/privacyverklaring" target="_blank" rel="noopener noreferrer">privacyverklaring</a> lees je hoe persoonsgegevens worden gebruikt. De privacyverklaring is informatie en vraagt geen akkoord. Versie {LEGAL_DOCUMENTS.terms.version}, ingangsdatum 22 november 2026.</p>
    <form onSubmit={submit}><label className="legal-check"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)}/><span>{scope === 'club' ? 'Ik aanvaard de algemene voorwaarden en verwerkersovereenkomst namens deze club.' : 'Ik aanvaard de algemene voorwaarden voor mijn persoonlijke gebruik van Castiq. Hiermee leg ik geen overeenkomst namens de club vast.'}</span></label>
      {scope === 'club' && <label className="legal-check"><input type="checkbox" checked={representative} onChange={event => setRepresentative(event.target.checked)}/><span>Ik ben bevoegd om deze club bij deze afspraken te vertegenwoordigen.</span></label>}
      {error && <p className="legal-error" role="alert">{error}</p>}<button type="submit" className="legal-primary" disabled={!accepted || scope === 'club' && (!representative || !clubId) || busy}>{busy ? 'Afspraken vastleggen…' : scope === 'club' ? 'Afspraken namens de club vastleggen' : 'Aanvaarden en verder'}<Check size={17}/></button>
    </form>
  </section>;
}
