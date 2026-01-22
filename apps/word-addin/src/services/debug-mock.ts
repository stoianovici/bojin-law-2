/**
 * Debug Mock Data for Word Add-in
 *
 * Use this to test document formatting without calling the API.
 *
 * Usage:
 * 1. Set DEBUG_MODE = true below
 * 2. Paste raw API response content into MOCK_RESPONSES
 * 3. Run the add-in - it will use mock data instead of API
 *
 * To capture a new response:
 * - Set CAPTURE_MODE = true
 * - Generate a document normally
 * - Check console for "[DEBUG] Captured response:"
 * - Copy and paste into MOCK_RESPONSES below
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
// Mock Response Data
// ============================================================================

export interface MockResponse {
  content: string;
  title: string;
  tokensUsed: number;
  processingTimeMs: number;
}

/**
 * Saved API responses for debugging.
 * Key is a descriptive name, value is the response.
 */
export const MOCK_RESPONSES: Record<string, MockResponse> = {
  // Example: A simple legal document
  'cerere-chemare': {
    title: 'Cerere de chemare în judecată',
    tokensUsed: 1500,
    processingTimeMs: 8000,
    content: `
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

<p>Cu toate că reclamanta a emis factura fiscală nr. 123/15.01.2026 și a transmis-o pârâtei prin e-mail, aceasta nu a achitat suma datorată nici până în prezent.</p>

<h2>IV. MOTIVELE DE DREPT</h2>

<p>În drept, ne întemeiem cererea pe dispozițiile:</p>

<ul>
<li><strong>Art. 1270 Cod civil</strong> - privind forța obligatorie a contractului între părțile contractante;</li>
<li><strong>Art. 1350 Cod civil</strong> - privind răspunderea contractuală;</li>
<li><strong>Art. 1535 Cod civil</strong> - privind daunele-interese pentru întârzierea în executarea obligațiilor;</li>
<li><strong>OG 13/2011</strong> - privind dobânda legală remuneratorie și penalizatoare pentru obligații bănești;</li>
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
<li><strong>Expertiză contabilă</strong> - pentru stabilirea cuantumului dobânzilor datorate.</li>
</ol>

<h2>VI. DISPOZIȚII FINALE</h2>

<p>Față de cele expuse, solicităm admiterea cererii astfel cum a fost formulată.</p>

<p>Anexăm prezentei cereri: taxa judiciară de timbru în cuantum de 2.500 lei, precum și copii certificate ale înscrisurilor invocate.</p>

<p style="margin-top: 2em;">
<strong>Data:</strong> 22.01.2026<br/>
<strong>Semnătura reprezentantului legal,</strong>
</p>
`.trim(),
  },

  // Research document example
  'research-contract': {
    title: 'Notă de cercetare - Clauze penale',
    tokensUsed: 2800,
    processingTimeMs: 15000,
    content: `
<h1>NOTĂ DE CERCETARE JURIDICĂ</h1>
<h2>Tema: Validitatea clauzelor penale excesive în contractele comerciale</h2>

<h3>1. Cadrul legislativ</h3>

<p>Clauzele penale sunt reglementate în <strong>Codul civil</strong> la articolele 1538-1543. Conform <strong>art. 1541 alin. (1) Cod civil</strong>:</p>

<blockquote>
„Instanța nu poate reduce penalitatea decât atunci când:
a) obligația principală a fost executată în parte și această executare a profitat creditorului;
b) penalitatea este vădit excesivă față de prejudiciul ce putea fi prevăzut de părți la încheierea contractului."
</blockquote>

<h3>2. Jurisprudență relevantă</h3>

<p><strong>Decizia ÎCCJ nr. 1234/2024</strong> a statuat că o clauză penală de 0,5% pe zi (echivalent 182,5% anual) este „vădit excesivă" și poate fi redusă de instanță la nivelul dobânzii legale penalizatoare.</p>

<p><strong>Curtea de Apel București, dec. civ. nr. 567/2025</strong> a reținut că:</p>

<blockquote>
„Libertatea contractuală nu este absolută. Clauzele penale care depășesc de 3-4 ori nivelul dobânzii legale pot fi considerate abuzive și reduse corespunzător."
</blockquote>

<h3>3. Doctrină</h3>

<p>În literatura de specialitate (Boroi, Stănciulescu - <em>Instituții de drept civil</em>, 2024), se arată că instanțele române tind să reducă clauzele penale când:</p>

<ul>
<li>Depășesc de <strong>3-5 ori</strong> rata dobânzii legale;</li>
<li>Sunt disproporționate față de valoarea contractului;</li>
<li>Aplicarea lor ar conduce la <strong>îmbogățirea fără justă cauză</strong> a creditorului.</li>
</ul>

<h3>4. Concluzii și recomandări</h3>

<p>Pentru a evita riscul reducerii judiciare, recomandăm:</p>

<ol>
<li>Limitarea clauzelor penale la <strong>maximum 0,1% pe zi</strong> (36,5% anual);</li>
<li>Corelarea penalității cu <strong>prejudiciul real estimat</strong>;</li>
<li>Includerea unei clauze de <strong>plafonare</strong> a penalităților totale;</li>
<li>Documentarea <strong>rațiunii comerciale</strong> a nivelului penalităților în procesul-verbal de negociere.</li>
</ol>
`.trim(),
  },

  // Empty placeholder for quick paste
  custom: {
    title: 'Document personalizat',
    tokensUsed: 0,
    processingTimeMs: 0,
    content: `<!-- Paste your captured content here -->`,
  },
};

/** Default mock response to use */
export const DEFAULT_MOCK_KEY = 'cerere-chemare';

// ============================================================================
// Debug Utilities
// ============================================================================

/**
 * Capture and log a response for later use
 */
export function captureResponse(response: MockResponse, label?: string): void {
  if (!CAPTURE_MODE) return;

  console.log('\n========================================');
  console.log('[DEBUG] Captured response:', label || 'unnamed');
  console.log('========================================');
  console.log('Copy this into MOCK_RESPONSES:\n');
  console.log(JSON.stringify(response, null, 2));
  console.log('\n========================================\n');
}

/**
 * Get a mock response with simulated delay
 */
export async function getMockResponse(key?: string): Promise<MockResponse> {
  const mockKey = key || DEFAULT_MOCK_KEY;
  const response = MOCK_RESPONSES[mockKey];

  if (!response) {
    throw new Error(`Mock response not found: ${mockKey}`);
  }

  if (MOCK_DELAY_MS > 0) {
    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
  }

  console.log('[DEBUG] Using mock response:', mockKey);
  return response;
}

/**
 * Simulate streaming with mock data
 */
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
    await new Promise((r) => setTimeout(r, 10)); // Small delay between chunks
  }

  return response;
}
