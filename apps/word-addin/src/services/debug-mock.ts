/**
 * Debug Mock Data for Word Add-in
 *
 * Comprehensive test samples for document formatting without API calls.
 *
 * Usage:
 * 1. Enable debug mode via toggle or ?debug=true URL param
 * 2. Use FormatTestPanel to browse and insert samples
 * 3. Or use ?mock=sample-key to auto-insert on load
 *
 * To capture a new response:
 * - Set CAPTURE_MODE = true
 * - Generate a document normally
 * - Check console for "[DEBUG] Captured response:"
 * - Copy and paste into MOCK_SAMPLES below
 */

// ============================================================================
// Configuration
// ============================================================================

/**
 * Check URL params for runtime overrides
 * Usage: Add ?debug=true or ?capture=true to the URL
 */
function getUrlParam(name: string): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get(name) === 'true';
}

/** Enable to skip API calls and use mock data (mutable for runtime toggle) */
let _debugMode = getUrlParam('debug') || false;

/** Enable to log raw API responses for capture */
export const CAPTURE_MODE = getUrlParam('capture') || true;

/** Get current debug mode state */
export function isDebugMode(): boolean {
  return _debugMode;
}

/** Set debug mode at runtime */
export function setDebugMode(enabled: boolean): void {
  _debugMode = enabled;
  console.log('[Debug] Debug mode', enabled ? 'ENABLED' : 'DISABLED');
}

/** @deprecated Use isDebugMode() instead */
export const DEBUG_MODE = _debugMode;

/** Simulated delay in ms (0 for instant) */
export const MOCK_DELAY_MS = 500;

/** Which mock response to use (URL param: ?mock=cerere-chemare) */
export const MOCK_KEY = (() => {
  if (typeof window === 'undefined') return undefined;
  return new URLSearchParams(window.location.search).get('mock') || undefined;
})();

// Log debug state on load
if (typeof window !== 'undefined') {
  console.log('[Debug] DEBUG_MODE:', DEBUG_MODE, '| CAPTURE_MODE:', CAPTURE_MODE);
  if (DEBUG_MODE) {
    console.log('[Debug] Using mock data - API calls will be skipped');
    console.log('[Debug] Mock key:', MOCK_KEY || 'default (cerere-chemare)');
  }
}

// ============================================================================
// Types
// ============================================================================

export interface MockSample {
  /** Display name in test panel */
  name: string;
  /** Category for grouping */
  category: SampleCategory;
  /** What formatting features this tests */
  tests: string[];
  /** HTML content */
  html: string;
  /** Markdown content (if applicable) */
  markdown?: string;
  /** OOXML content (if applicable) */
  ooxml?: string;
}

export type SampleCategory =
  | 'headings'
  | 'lists'
  | 'tables'
  | 'blockquotes'
  | 'footnotes'
  | 'callouts'
  | 'typography'
  | 'full-documents'
  | 'edge-cases';

export const CATEGORY_LABELS: Record<SampleCategory, string> = {
  headings: 'Titluri',
  lists: 'Liste',
  tables: 'Tabele',
  blockquotes: 'Citate',
  footnotes: 'Note de subsol',
  callouts: 'Callout-uri',
  typography: 'Tipografie',
  'full-documents': 'Documente complete',
  'edge-cases': 'Cazuri speciale',
};

// ============================================================================
// Mock Samples Library
// ============================================================================

export const MOCK_SAMPLES: Record<string, MockSample> = {
  // ---------------------------------------------------------------------------
  // Headings
  // ---------------------------------------------------------------------------
  'heading-all-levels': {
    name: 'Toate nivelurile H1-H6',
    category: 'headings',
    tests: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'heading-hierarchy'],
    html: `
<h1>Titlu nivel 1 (H1)</h1>
<p>Paragraf introductiv sub titlul principal.</p>

<h2>Subtitlu nivel 2 (H2)</h2>
<p>Conținut sub secțiunea H2.</p>

<h3>Secțiune nivel 3 (H3)</h3>
<p>Conținut sub secțiunea H3.</p>

<h4>Subsecțiune nivel 4 (H4)</h4>
<p>Conținut sub H4.</p>

<h5>Detaliu nivel 5 (H5)</h5>
<p>Conținut sub H5.</p>

<h6>Notă nivel 6 (H6)</h6>
<p>Conținut sub H6, cel mai mic titlu.</p>
`.trim(),
    markdown: `
# Titlu nivel 1 (H1)

Paragraf introductiv sub titlul principal.

## Subtitlu nivel 2 (H2)

Conținut sub secțiunea H2.

### Secțiune nivel 3 (H3)

Conținut sub secțiunea H3.

#### Subsecțiune nivel 4 (H4)

Conținut sub H4.

##### Detaliu nivel 5 (H5)

Conținut sub H5.
`.trim(),
  },

  'heading-numbered': {
    name: 'Titluri numerotate',
    category: 'headings',
    tests: ['numbered-headings', 'legal-numbering', 'outline'],
    html: `
<h1>1. DISPOZIȚII GENERALE</h1>
<p>Prezentul regulament stabilește cadrul general.</p>

<h2>1.1. Obiect și domeniu de aplicare</h2>
<p>Regulamentul se aplică tuturor activităților.</p>

<h3>1.1.1. Definiții</h3>
<p>În sensul prezentului regulament:</p>

<h3>1.1.2. Principii aplicabile</h3>
<p>Principiile care guvernează activitatea sunt:</p>

<h2>1.2. Cadrul legal</h2>
<p>Prezentul regulament este emis în temeiul:</p>

<h1>2. DREPTURILE ȘI OBLIGAȚIILE PĂRȚILOR</h1>
<p>Părțile au următoarele drepturi și obligații:</p>

<h2>2.1. Drepturile părții A</h2>
<p>Partea A are dreptul de a:</p>
`.trim(),
  },

  // ---------------------------------------------------------------------------
  // Lists
  // ---------------------------------------------------------------------------
  'list-simple': {
    name: 'Liste simple (ul/ol)',
    category: 'lists',
    tests: ['unordered-list', 'ordered-list', 'list-items'],
    html: `
<h2>Listă neordonată</h2>
<ul>
<li>Element primul</li>
<li>Element al doilea</li>
<li>Element al treilea</li>
</ul>

<h2>Listă ordonată</h2>
<ol>
<li>Primul pas</li>
<li>Al doilea pas</li>
<li>Al treilea pas</li>
</ol>
`.trim(),
    markdown: `
## Listă neordonată

- Element primul
- Element al doilea
- Element al treilea

## Listă ordonată

1. Primul pas
2. Al doilea pas
3. Al treilea pas
`.trim(),
  },

  'list-nested': {
    name: 'Liste imbricate',
    category: 'lists',
    tests: ['nested-list', 'multi-level', 'mixed-list-types'],
    html: `
<h2>Listă cu mai multe niveluri</h2>
<ol>
<li>Cerințe procedurale:
  <ul>
  <li>Taxa de timbru achitată</li>
  <li>Procură specială</li>
  <li>Dovada calității procesuale</li>
  </ul>
</li>
<li>Documente justificative:
  <ol>
  <li>Contractul original</li>
  <li>Facturi fiscale</li>
  <li>Corespondența părților:
    <ul>
    <li>E-mail-uri</li>
    <li>Notificări scrise</li>
    </ul>
  </li>
  </ol>
</li>
<li>Probe testimoniale</li>
</ol>
`.trim(),
  },

  'list-legal': {
    name: 'Liste juridice (litere/cifre)',
    category: 'lists',
    tests: ['legal-list', 'alpha-list', 'roman-numerals'],
    html: `
<h2>Obligațiile părților</h2>
<p>Conform art. 1270 Cod civil, debitorul este obligat să:</p>
<ol type="a">
<li>execute obligația asumată la termenul stipulat;</li>
<li>informeze creditorul asupra oricăror împrejurări ce ar putea afecta executarea;</li>
<li>conserve bunul până la predare;</li>
<li>răspundă pentru neexecutare, executare defectuoasă sau întârziată:
  <ol type="i">
  <li>chiar dacă neexecutarea nu îi este imputabilă, în cazurile prevăzute de lege;</li>
  <li>în măsura în care nu poate invoca o cauză justificată de exonerare.</li>
  </ol>
</li>
</ol>
`.trim(),
  },

  // ---------------------------------------------------------------------------
  // Tables
  // ---------------------------------------------------------------------------
  'table-simple': {
    name: 'Tabel simplu',
    category: 'tables',
    tests: ['table', 'thead', 'tbody', 'table-headers'],
    html: `
<h2>Situația părților</h2>
<table>
<thead>
<tr>
<th>Parte</th>
<th>Calitate</th>
<th>Reprezentant</th>
</tr>
</thead>
<tbody>
<tr>
<td>SC ALPHA SRL</td>
<td>Reclamant</td>
<td>Ion Popescu, administrator</td>
</tr>
<tr>
<td>SC BETA SA</td>
<td>Pârât</td>
<td>Maria Ionescu, director general</td>
</tr>
</tbody>
</table>
`.trim(),
  },

  'table-styled': {
    name: 'Tabel cu stiluri',
    category: 'tables',
    tests: ['table-styling', 'borders', 'cell-alignment'],
    html: `
<h2>Termene procedurale</h2>
<table style="width: 100%; border-collapse: collapse;">
<thead>
<tr style="background-color: #f0f0f0;">
<th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Termen</th>
<th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Descriere</th>
<th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Zile</th>
</tr>
</thead>
<tbody>
<tr>
<td style="border: 1px solid #ccc; padding: 8px;"><strong>Întâmpinare</strong></td>
<td style="border: 1px solid #ccc; padding: 8px;">Depunere întâmpinare la cererea de chemare în judecată</td>
<td style="border: 1px solid #ccc; padding: 8px; text-align: center;">25</td>
</tr>
<tr style="background-color: #fafafa;">
<td style="border: 1px solid #ccc; padding: 8px;"><strong>Răspuns</strong></td>
<td style="border: 1px solid #ccc; padding: 8px;">Răspuns la întâmpinare</td>
<td style="border: 1px solid #ccc; padding: 8px; text-align: center;">10</td>
</tr>
<tr>
<td style="border: 1px solid #ccc; padding: 8px;"><strong>Apel</strong></td>
<td style="border: 1px solid #ccc; padding: 8px;">Termen pentru declararea apelului</td>
<td style="border: 1px solid #ccc; padding: 8px; text-align: center;">30</td>
</tr>
</tbody>
</table>
`.trim(),
  },

  // ---------------------------------------------------------------------------
  // Blockquotes
  // ---------------------------------------------------------------------------
  'blockquote-simple': {
    name: 'Citat simplu',
    category: 'blockquotes',
    tests: ['blockquote', 'citation'],
    html: `
<h2>Jurisprudență relevantă</h2>
<p>Instanța supremă a statuat în mod constant că:</p>
<blockquote>
Răspunderea civilă delictuală presupune întrunirea cumulativă a următoarelor condiții: existența unui prejudiciu, existența unei fapte ilicite, raportul de cauzalitate între fapta ilicită și prejudiciu, precum și vinovăția autorului faptei ilicite.
</blockquote>
<p>Decizia ÎCCJ nr. 1234/2024</p>
`.trim(),
    markdown: `
## Jurisprudență relevantă

Instanța supremă a statuat în mod constant că:

> Răspunderea civilă delictuală presupune întrunirea cumulativă a următoarelor condiții: existența unui prejudiciu, existența unei fapte ilicite, raportul de cauzalitate între fapta ilicită și prejudiciu, precum și vinovăția autorului faptei ilicite.

Decizia ÎCCJ nr. 1234/2024
`.trim(),
  },

  'blockquote-nested': {
    name: 'Citate imbricate',
    category: 'blockquotes',
    tests: ['nested-blockquote', 'multi-level-citation'],
    html: `
<h2>Evoluția jurisprudenței</h2>
<blockquote>
<p>Practica judiciară anterioară a susținut că:</p>
<blockquote>
<p>„Culpa prezumată a debitorului în neexecutarea obligațiilor contractuale poate fi răsturnată doar prin dovada forței majore sau a cazului fortuit."</p>
</blockquote>
<p>Această interpretare a fost nuanțată prin decizia din 2024.</p>
</blockquote>
`.trim(),
    markdown: `
## Evoluția jurisprudenței

> Practica judiciară anterioară a susținut că:
>
>> „Culpa prezumată a debitorului în neexecutarea obligațiilor contractuale poate fi răsturnată doar prin dovada forței majore sau a cazului fortuit."
>
> Această interpretare a fost nuanțată prin decizia din 2024.
`.trim(),
  },

  'blockquote-legal': {
    name: 'Citat legislativ',
    category: 'blockquotes',
    tests: ['legal-citation', 'law-quote', 'article-citation'],
    html: `
<h2>Temei legal</h2>
<p>Conform <strong>art. 1270 Cod civil</strong>:</p>
<blockquote style="border-left: 4px solid #2196F3; background-color: #E3F2FD; padding: 12px 16px; margin: 16px 0;">
<p><strong>(1)</strong> Contractul valabil încheiat are putere de lege între părțile contractante.</p>
<p><strong>(2)</strong> Contractul se modifică sau încetează numai prin acordul părților ori din cauze autorizate de lege.</p>
</blockquote>
`.trim(),
  },

  // ---------------------------------------------------------------------------
  // Footnotes
  // ---------------------------------------------------------------------------
  'footnotes-basic': {
    name: 'Note de subsol simple',
    category: 'footnotes',
    tests: ['footnotes', 'ref-tags', 'source-citations'],
    html: `
<article>
<h1>Răspunderea pentru fapta proprie</h1>
<p>Doctrina<ref id="src1"/> definește răspunderea civilă delictuală ca obligația de reparare a prejudiciului cauzat prin faptă ilicită proprie sau prin fapta altuia.</p>
<p>Jurisprudența recentă<ref id="src2"/> a clarificat că prejudiciul moral trebuie dovedit prin orice mijloc de probă.</p>
<p>Legislația europeană<ref id="src3"/> impune standarde minime de protecție.</p>

<sources>
<source id="src1" type="doctrine" author="Boroi, Stănciulescu">
Instituții de drept civil, ed. a 5-a, Editura Hamangiu, 2024, p. 458
</source>
<source id="src2" type="jurisprudence" court="ÎCCJ">
Decizia civilă nr. 1234/2024, publicată în M.Of. nr. 567/2024
</source>
<source id="src3" type="legislation" authority="UE">
Directiva 2024/123/UE privind protecția consumatorilor
</source>
</sources>
</article>
`.trim(),
  },

  'footnotes-multiple': {
    name: 'Note de subsol multiple',
    category: 'footnotes',
    tests: ['multiple-footnotes', 'footnote-ordering', 'repeated-citations'],
    html: `
<article>
<h1>Analiza obligațiilor contractuale</h1>
<h2>1. Obligația de a da</h2>
<p>Conform doctrinei<ref id="src1"/>, obligația de a da presupune transferul unui drept real.</p>

<h2>2. Obligația de a face</h2>
<p>Această obligație<ref id="src2"/> implică prestarea unui serviciu sau executarea unei lucrări.</p>
<p>Jurisprudența<ref id="src3"/> a stabilit criterii clare de evaluare.</p>

<h2>3. Obligația de a nu face</h2>
<p>Reprezintă<ref id="src1"/> o obligație negativă, de abstențiune.</p>
<p>Interpretarea modernă<ref id="src4"/> extinde această noțiune.</p>

<sources>
<source id="src1" type="doctrine">Pop, Popa, Vidu - Drept civil. Obligațiile, 2020</source>
<source id="src2" type="doctrine">Boroi - Drept civil, 2024</source>
<source id="src3" type="jurisprudence">ÎCCJ, dec. 456/2023</source>
<source id="src4" type="comparative">CJUE, C-123/24</source>
</sources>
</article>
`.trim(),
  },

  // ---------------------------------------------------------------------------
  // Callouts
  // ---------------------------------------------------------------------------
  'callout-note': {
    name: 'Notă informativă',
    category: 'callouts',
    tests: ['callout', 'note', 'info-box'],
    html: `
<h2>Procedura de contestare</h2>
<p>Contestația se depune în termen de 15 zile.</p>
<aside style="background-color: #E3F2FD; border-left: 4px solid #2196F3; padding: 12px 16px; margin: 16px 0;">
<strong>📝 Notă</strong><br>
Termenul de 15 zile este un termen de decădere, nu de prescripție. Odată depășit, dreptul de a contesta se pierde definitiv.
</aside>
<p>Contestația trebuie să cuprindă...</p>
`.trim(),
  },

  'callout-warning': {
    name: 'Avertisment',
    category: 'callouts',
    tests: ['warning', 'alert', 'caution-box'],
    html: `
<h2>Termene imperative</h2>
<aside style="background-color: #FFF3E0; border-left: 4px solid #FF9800; padding: 12px 16px; margin: 16px 0;">
<strong>⚠️ Atenție</strong><br>
Nerespectarea termenului de 30 de zile pentru declararea apelului atrage decăderea din dreptul de a exercita această cale de atac. Excepțiile sunt strict limitate de lege.
</aside>
`.trim(),
  },

  'callout-danger': {
    name: 'Pericol/Risc major',
    category: 'callouts',
    tests: ['danger', 'critical', 'risk-box'],
    html: `
<h2>Sancțiuni pentru neconformare</h2>
<aside style="background-color: #FFEBEE; border-left: 4px solid #F44336; padding: 12px 16px; margin: 16px 0;">
<strong>🚨 Important</strong><br>
Încălcarea prevederilor GDPR poate atrage amenzi de până la 20.000.000 EUR sau 4% din cifra de afaceri globală, oricare valoare este mai mare.
</aside>
`.trim(),
  },

  'callout-signature': {
    name: 'Bloc semnătură',
    category: 'callouts',
    tests: ['signature', 'date-location', 'closing-block'],
    html: `
<div style="margin-top: 40px;">
<p><strong>Data și locul:</strong> București, 24 ianuarie 2026</p>
<div style="margin-top: 30px; display: flex; justify-content: space-between;">
<div style="text-align: center; width: 45%;">
<p style="border-top: 1px solid #000; padding-top: 8px; margin-top: 60px;">
<strong>RECLAMANT</strong><br>
SC ALPHA SRL<br>
prin administrator<br>
Ion Popescu
</p>
</div>
<div style="text-align: center; width: 45%;">
<p style="border-top: 1px solid #000; padding-top: 8px; margin-top: 60px;">
<strong>AVOCAT</strong><br>
Cabinet Av. Maria Ionescu<br>
Baroul București
</p>
</div>
</div>
</div>
`.trim(),
  },

  // ---------------------------------------------------------------------------
  // Typography
  // ---------------------------------------------------------------------------
  'typography-inline': {
    name: 'Formatare inline',
    category: 'typography',
    tests: ['bold', 'italic', 'underline', 'combined-formatting'],
    html: `
<h2>Exemple de formatare</h2>
<p>Text <strong>bold/îngroșat</strong> pentru evidențiere.</p>
<p>Text <em>italic/cursiv</em> pentru termeni tehnici.</p>
<p>Text <u>subliniat</u> pentru referințe importante.</p>
<p>Text <s>tăiat</s> pentru modificări.</p>
<p>Combinații: <strong><em>bold și italic</em></strong>, <strong><u>bold și subliniat</u></strong>.</p>
<p>Text cu <sup>superscript</sup> și <sub>subscript</sub>.</p>
`.trim(),
    markdown: `
## Exemple de formatare

Text **bold/îngroșat** pentru evidențiere.

Text *italic/cursiv* pentru termeni tehnici.

Text _subliniat_ pentru referințe importante.

Combinații: ***bold și italic***, **_bold și subliniat_**.
`.trim(),
  },

  'typography-legal': {
    name: 'Formatare juridică',
    category: 'typography',
    tests: ['legal-typography', 'article-refs', 'caps'],
    html: `
<h2>Referințe normative</h2>
<p>Conform <strong>art. 1270 alin. (1) Cod civil</strong>, contractul valabil încheiat are putere de lege între părțile contractante.</p>
<p>În temeiul <strong>Legii nr. 134/2010</strong> privind Codul de procedură civilă, republicată, cu modificările și completările ulterioare:</p>
<p><em>„Judecătorul are îndatorirea să stăruie, prin toate mijloacele legale, pentru a preveni orice greșeală privind aflarea adevărului în cauză, pe baza stabilirii faptelor și prin aplicarea corectă a legii."</em></p>
<p>A se vedea și <strong>O.U.G. nr. 80/2013</strong> privind taxele judiciare de timbru.</p>
`.trim(),
  },

  // ---------------------------------------------------------------------------
  // Full Documents
  // ---------------------------------------------------------------------------
  'doc-court-filing': {
    name: 'Cerere de chemare în judecată',
    category: 'full-documents',
    tests: ['full-document', 'court-filing', 'legal-structure'],
    html: `
<h1>CERERE DE CHEMARE ÎN JUDECATĂ</h1>

<h2>I. PĂRȚILE</h2>

<p><strong>Reclamant:</strong> SC EXEMPLU SRL, cu sediul în București, str. Victoriei nr. 100, sector 1, CUI RO12345678, reprezentată legal de administrator Ion Popescu.</p>

<p><strong>Pârât:</strong> SC PÂRÂT SRL, cu sediul în Cluj-Napoca, str. Libertății nr. 50, jud. Cluj, CUI RO87654321.</p>

<h2>II. OBIECTUL CERERII</h2>

<p>Prin prezenta cerere, solicităm instanței:</p>

<ol>
<li>Obligarea pârâtei la plata sumei de <strong>50.000 EUR</strong> reprezentând contravaloarea mărfurilor livrate conform facturii fiscale nr. 123/15.01.2026;</li>
<li>Obligarea pârâtei la plata dobânzii legale penalizatoare, calculată de la data scadenței (15.02.2026) până la plata efectivă;</li>
<li>Obligarea pârâtei la plata cheltuielilor de judecată.</li>
</ol>

<h2>III. SITUAȚIA DE FAPT</h2>

<p>În fapt, între reclamantă și pârâtă s-au derulat raporturi comerciale constând în livrarea de echipamente industriale. Conform contractului cadru nr. 456/2025, reclamanta a livrat pârâtei echipamente în valoare totală de 50.000 EUR.</p>

<p>Livrarea a fost efectuată la data de 15.01.2026, iar termenul de plată agreat de părți a fost de 30 de zile de la recepție. Astfel, scadența plății a intervenit la data de 15.02.2026.</p>

<aside style="background-color: #FFF3E0; border-left: 4px solid #FF9800; padding: 12px 16px; margin: 16px 0;">
<strong>Notă:</strong> Cu toate că reclamanta a emis factura fiscală nr. 123/15.01.2026 și a transmis-o pârâtei prin e-mail, aceasta nu a achitat suma datorată nici până în prezent.
</aside>

<h2>IV. MOTIVELE DE DREPT</h2>

<p>În drept, ne întemeiem cererea pe dispozițiile:</p>

<ul>
<li><strong>Art. 1270 Cod civil</strong> - privind forța obligatorie a contractului;</li>
<li><strong>Art. 1350 Cod civil</strong> - privind răspunderea contractuală;</li>
<li><strong>Art. 1535 Cod civil</strong> - privind daunele-interese pentru întârzierea în executarea obligațiilor bănești;</li>
<li><strong>OG 13/2011</strong> - privind dobânda legală;</li>
<li><strong>Art. 194 și urm. Cod procedură civilă</strong> - privind condițiile de formă ale cererii de chemare în judecată.</li>
</ul>

<h2>V. PROBE</h2>

<p>Solicităm încuviințarea următoarelor mijloace de probă:</p>

<ol>
<li><strong>Înscrisuri:</strong>
  <ul>
  <li>Contractul cadru nr. 456/2025;</li>
  <li>Factura fiscală nr. 123/15.01.2026;</li>
  <li>Avizul de însoțire a mărfii;</li>
  <li>Corespondența e-mail dintre părți.</li>
  </ul>
</li>
<li><strong>Interogatoriul pârâtei</strong> - pe aspectele livrării și scadenței;</li>
<li><strong>Expertiză contabilă</strong> - pentru stabilirea cuantumului dobânzilor.</li>
</ol>

<h2>VI. DISPOZIȚII FINALE</h2>

<p>Față de cele expuse, solicităm admiterea cererii astfel cum a fost formulată.</p>

<p>Anexăm prezentei cereri: taxa judiciară de timbru în cuantum de 2.500 lei, precum și copii certificate ale înscrisurilor invocate.</p>

<div style="margin-top: 40px;">
<p><strong>Data:</strong> 24.01.2026</p>
<p><strong>Semnătura reprezentantului legal,</strong></p>
</div>
`.trim(),
  },

  'doc-research-note': {
    name: 'Notă de cercetare juridică',
    category: 'full-documents',
    tests: ['research-note', 'legal-analysis', 'footnotes', 'citations'],
    html: `
<article>
<h1>NOTĂ DE CERCETARE JURIDICĂ</h1>
<h2>Tema: Validitatea clauzelor penale excesive în contractele comerciale</h2>

<h3>1. Cadrul legislativ</h3>

<p>Clauzele penale sunt reglementate în <strong>Codul civil</strong> la articolele 1538-1543. Conform <strong>art. 1541 alin. (1) Cod civil</strong>:<ref id="src1"/></p>

<blockquote style="border-left: 4px solid #2196F3; background-color: #E3F2FD; padding: 12px 16px; margin: 16px 0;">
„Instanța nu poate reduce penalitatea decât atunci când:<br>
a) obligația principală a fost executată în parte și această executare a profitat creditorului;<br>
b) penalitatea este vădit excesivă față de prejudiciul ce putea fi prevăzut de părți la încheierea contractului."
</blockquote>

<h3>2. Jurisprudență relevantă</h3>

<p><strong>Decizia ÎCCJ nr. 1234/2024</strong><ref id="src2"/> a statuat că o clauză penală de 0,5% pe zi (echivalent 182,5% anual) este „vădit excesivă" și poate fi redusă de instanță la nivelul dobânzii legale penalizatoare.</p>

<p><strong>Curtea de Apel București, dec. civ. nr. 567/2025</strong><ref id="src3"/> a reținut că:</p>

<blockquote>
„Libertatea contractuală nu este absolută. Clauzele penale care depășesc de 3-4 ori nivelul dobânzii legale pot fi considerate abuzive și reduse corespunzător."
</blockquote>

<h3>3. Doctrină</h3>

<p>În literatura de specialitate<ref id="src4"/>, se arată că instanțele române tind să reducă clauzele penale când:</p>

<ul>
<li>Depășesc de <strong>3-5 ori</strong> rata dobânzii legale;</li>
<li>Sunt disproporționate față de valoarea contractului;</li>
<li>Aplicarea lor ar conduce la <strong>îmbogățirea fără justă cauză</strong> a creditorului.</li>
</ul>

<h3>4. Concluzii și recomandări</h3>

<aside style="background-color: #E8F5E9; border-left: 4px solid #4CAF50; padding: 12px 16px; margin: 16px 0;">
<strong>Recomandări practice:</strong><br>
<ol>
<li>Limitarea clauzelor penale la <strong>maximum 0,1% pe zi</strong> (36,5% anual);</li>
<li>Corelarea penalității cu <strong>prejudiciul real estimat</strong>;</li>
<li>Includerea unei clauze de <strong>plafonare</strong> a penalităților totale;</li>
<li>Documentarea <strong>rațiunii comerciale</strong> a nivelului penalităților.</li>
</ol>
</aside>

<sources>
<source id="src1" type="legislation">Codul civil, art. 1541</source>
<source id="src2" type="jurisprudence">ÎCCJ, dec. civ. nr. 1234/2024</source>
<source id="src3" type="jurisprudence">CAB, dec. civ. nr. 567/2025</source>
<source id="src4" type="doctrine">Boroi, Stănciulescu - Instituții de drept civil, 2024, p. 892</source>
</sources>
</article>
`.trim(),
  },

  'doc-notification': {
    name: 'Notificare (Markdown)',
    category: 'full-documents',
    tests: ['notification', 'markdown-doc', 'formal-letter'],
    markdown: `
# NOTIFICARE

**Către:** SC BETA SRL
**Adresa:** Cluj-Napoca, str. Libertății nr. 50

**De la:** SC ALPHA SRL
**Adresa:** București, str. Victoriei nr. 100, sector 1

**Data:** 24.01.2026
**Referință:** Contractul de prestări servicii nr. 123/2025

---

## I. Obiectul notificării

Prin prezenta, vă notificăm formal cu privire la **neîndeplinirea obligațiilor contractuale** asumate prin contractul menționat mai sus.

## II. Situația de fapt

Conform contractului, aveați obligația de a:

1. Livra echipamentele comandate până la data de **15.01.2026**
2. Asigura instalarea și punerea în funcțiune
3. Furniza documentația tehnică completă

> **Constatăm că, la data prezentei notificări, niciuna dintre aceste obligații nu a fost îndeplinită.**

## III. Solicitări

În temeiul art. 1516 și urm. Cod civil, vă solicităm:

- Executarea integrală a obligațiilor în termen de **15 zile** de la primirea prezentei
- Plata penalităților de întârziere conform art. 8.2 din contract
- Confirmarea în scris a datei de livrare

## IV. Consecințe

În cazul neconformării în termenul indicat, ne rezervăm dreptul de a:

1. Rezilia contractul de plin drept
2. Solicita daune-interese
3. Acționa în instanță pentru recuperarea prejudiciului

---

**Cu stimă,**

_________________
**SC ALPHA SRL**
prin Ion Popescu, Administrator
`.trim(),
    html: `
<h1>NOTIFICARE</h1>

<p><strong>Către:</strong> SC BETA SRL<br>
<strong>Adresa:</strong> Cluj-Napoca, str. Libertății nr. 50</p>

<p><strong>De la:</strong> SC ALPHA SRL<br>
<strong>Adresa:</strong> București, str. Victoriei nr. 100, sector 1</p>

<p><strong>Data:</strong> 24.01.2026<br>
<strong>Referință:</strong> Contractul de prestări servicii nr. 123/2025</p>

<hr>

<h2>I. Obiectul notificării</h2>

<p>Prin prezenta, vă notificăm formal cu privire la <strong>neîndeplinirea obligațiilor contractuale</strong> asumate prin contractul menționat mai sus.</p>

<h2>II. Situația de fapt</h2>

<p>Conform contractului, aveați obligația de a:</p>

<ol>
<li>Livra echipamentele comandate până la data de <strong>15.01.2026</strong></li>
<li>Asigura instalarea și punerea în funcțiune</li>
<li>Furniza documentația tehnică completă</li>
</ol>

<blockquote>
<strong>Constatăm că, la data prezentei notificări, niciuna dintre aceste obligații nu a fost îndeplinită.</strong>
</blockquote>
`.trim(),
  },

  // ---------------------------------------------------------------------------
  // Edge Cases
  // ---------------------------------------------------------------------------
  'edge-empty-elements': {
    name: 'Elemente goale',
    category: 'edge-cases',
    tests: ['empty-paragraph', 'empty-list', 'whitespace'],
    html: `
<h2>Test elemente goale</h2>
<p></p>
<p>Paragraf cu conținut.</p>
<p>   </p>
<ul>
<li>Element cu conținut</li>
<li></li>
<li>Alt element</li>
</ul>
<p>Text final.</p>
`.trim(),
  },

  'edge-special-chars': {
    name: 'Caractere speciale',
    category: 'edge-cases',
    tests: ['special-characters', 'unicode', 'entities'],
    html: `
<h2>Caractere speciale</h2>
<p>Diacritice românești: ă, â, î, ș, ț, Ă, Â, Î, Ș, Ț</p>
<p>Simboluri juridice: § (secțiune), ¶ (paragraf), © (copyright), ® (registered), ™ (trademark)</p>
<p>Ghilimele: „text românesc" vs "text englezesc" vs «text francez»</p>
<p>Liniuțe: cratimă (-), en-dash (–), em-dash (—)</p>
<p>Matematice: ≤, ≥, ≠, ±, ×, ÷, ∞</p>
<p>Valute: €, $, £, ¥, ₿</p>
<p>Entități HTML: &lt;tag&gt;, &amp;, &quot;text&quot;</p>
`.trim(),
  },

  'edge-long-text': {
    name: 'Text foarte lung',
    category: 'edge-cases',
    tests: ['long-paragraph', 'word-wrap', 'overflow'],
    html: `
<h2>Paragraf extins</h2>
<p>Acestaestuntextfoartelungfărăspapiipentruatestawordwrappinginword.Acestaestuntextfoartelungfărăspapiipentruatestawordwrappinginword.Acestaestuntextfoartelungfărăspapiipentruatestawordwrappinginword.</p>
<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
`.trim(),
  },

  'edge-deep-nesting': {
    name: 'Imbricare profundă',
    category: 'edge-cases',
    tests: ['deep-nesting', 'nested-lists', 'complex-structure'],
    html: `
<h2>Structură complexă imbricată</h2>
<ol>
<li>Nivel 1
  <ol>
  <li>Nivel 2
    <ol>
    <li>Nivel 3
      <ul>
      <li>Nivel 4 (ul)
        <ul>
        <li>Nivel 5
          <ol>
          <li>Nivel 6 - cel mai adânc</li>
          </ol>
        </li>
        </ul>
      </li>
      </ul>
    </li>
    </ol>
  </li>
  </ol>
</li>
</ol>
`.trim(),
  },

  // ---------------------------------------------------------------------------
  // Legacy compatibility (keep old keys working)
  // ---------------------------------------------------------------------------
  'cerere-chemare': {
    name: '[Legacy] Cerere de chemare',
    category: 'full-documents',
    tests: ['legacy', 'backward-compatibility'],
    html: `
<h1>CERERE DE CHEMARE ÎN JUDECATĂ</h1>
<h2>I. PĂRȚILE</h2>
<p><strong>Reclamant:</strong> SC EXEMPLU SRL</p>
<p><strong>Pârât:</strong> SC PÂRÂT SRL</p>
<h2>II. OBIECTUL CERERII</h2>
<p>Solicităm obligarea pârâtei la plata sumei de <strong>50.000 EUR</strong>.</p>
`.trim(),
  },

  'research-contract': {
    name: '[Legacy] Notă cercetare',
    category: 'full-documents',
    tests: ['legacy', 'backward-compatibility'],
    html: `
<h1>NOTĂ DE CERCETARE JURIDICĂ</h1>
<h2>Tema: Clauze penale</h2>
<p>Clauzele penale sunt reglementate la art. 1538-1543 Cod civil.</p>
<blockquote>Instanța nu poate reduce penalitatea decât în cazuri limitate.</blockquote>
`.trim(),
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/** Get samples grouped by category */
export function getSamplesByCategory(): Record<SampleCategory, MockSample[]> {
  const grouped: Record<SampleCategory, MockSample[]> = {
    headings: [],
    lists: [],
    tables: [],
    blockquotes: [],
    footnotes: [],
    callouts: [],
    typography: [],
    'full-documents': [],
    'edge-cases': [],
  };

  for (const [key, sample] of Object.entries(MOCK_SAMPLES)) {
    // Skip legacy samples from main listing
    if (key === 'cerere-chemare' || key === 'research-contract') continue;
    grouped[sample.category].push(sample);
  }

  return grouped;
}

/** Get a specific sample by key */
export function getSample(key: string): MockSample | undefined {
  return MOCK_SAMPLES[key];
}

/** Get sample key by sample object */
export function getSampleKey(sample: MockSample): string | undefined {
  for (const [key, s] of Object.entries(MOCK_SAMPLES)) {
    if (s === sample) return key;
  }
  return undefined;
}

// ============================================================================
// Debug Utilities
// ============================================================================

/** Response shape for legacy compatibility */
export interface MockResponse {
  content: string;
  title: string;
  tokensUsed: number;
  processingTimeMs: number;
}

/** Capture and log a response for later use */
export function captureResponse(response: MockResponse, label?: string): void {
  if (!CAPTURE_MODE) return;

  console.log('\n========================================');
  console.log('[DEBUG] Captured response:', label || 'unnamed');
  console.log('========================================');
  console.log('Copy this into MOCK_SAMPLES:\n');
  console.log(JSON.stringify(response, null, 2));
  console.log('\n========================================\n');
}

/** Get a mock response with simulated delay (legacy compatibility) */
export async function getMockResponse(key?: string): Promise<MockResponse> {
  const mockKey = key || 'cerere-chemare';
  const sample = MOCK_SAMPLES[mockKey];

  if (!sample) {
    throw new Error(`Mock response not found: ${mockKey}`);
  }

  if (MOCK_DELAY_MS > 0) {
    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
  }

  console.log('[DEBUG] Using mock response:', mockKey);

  return {
    content: sample.html,
    title: sample.name,
    tokensUsed: 1500,
    processingTimeMs: 5000,
  };
}

/** Simulate streaming with mock data */
export async function streamMockResponse(
  key: string | undefined,
  onChunk: (chunk: string) => void,
  onProgress: (event: { type: string; text?: string }) => void
): Promise<MockResponse> {
  const response = await getMockResponse(key);

  // Simulate progress events
  onProgress({ type: 'thinking', text: '[DEBUG] Simulare gândire AI...' });
  await new Promise((r) => setTimeout(r, 200));

  onProgress({ type: 'search', text: '[DEBUG] Simulare căutare...' });
  await new Promise((r) => setTimeout(r, 200));

  // Stream content in chunks
  const chunkSize = 100;
  for (let i = 0; i < response.content.length; i += chunkSize) {
    const chunk = response.content.slice(i, i + chunkSize);
    onChunk(chunk);
    await new Promise((r) => setTimeout(r, 10));
  }

  return response;
}
