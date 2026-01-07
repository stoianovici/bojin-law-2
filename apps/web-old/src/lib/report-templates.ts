/**
 * Predefined Report Templates (OPS-151)
 * Templates with Romanian names and AI prompt templates
 */

import type { PredefinedReportTemplate, ReportCategory } from '@legal-platform/types';

// ============================================================
// Dosare (Cases) Reports
// ============================================================

const caseReports: PredefinedReportTemplate[] = [
  {
    id: 'cases-status-overview',
    categoryId: 'cases',
    name: 'Case Status Overview',
    nameRo: 'Situația Dosarelor',
    description: 'Vizualizare generală a statutului tuturor dosarelor active',
    allowedRoles: ['Partner', 'Associate', 'Paralegal', 'BusinessOwner'],
    chartType: 'pie',
    requiresDateRange: false,
    dataQuery: { type: 'cases', filters: {} },
    aiPromptTemplate: `Analizează distribuția dosarelor pe statusuri și generează un rezumat în limba română.
Evidențiază:
- Câte dosare sunt în fiecare status
- Dacă există dezechilibre (prea multe dosare într-un anumit status)
- Recomandări pentru îmbunătățirea fluxului de lucru`,
  },
  {
    id: 'cases-by-type',
    categoryId: 'cases',
    name: 'Cases by Type',
    nameRo: 'Dosare pe Tipuri',
    description: 'Distribuția dosarelor pe domenii juridice',
    allowedRoles: ['Partner', 'Associate', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: false,
    dataQuery: { type: 'cases', filters: {} },
    aiPromptTemplate: `Analizează distribuția dosarelor pe tipuri/domenii juridice și generează un rezumat în limba română.
Evidențiază:
- Care sunt domeniile predominante ale firmei
- Tendințe în tipurile de cazuri gestionate
- Oportunități de specializare sau diversificare`,
  },
  {
    id: 'cases-deadline-tracker',
    categoryId: 'cases',
    name: 'Deadline Tracker',
    nameRo: 'Monitor Termene',
    description: 'Termenele apropiate și depășite pentru toate dosarele',
    allowedRoles: ['Partner', 'Associate', 'Paralegal', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: true,
    dataQuery: { type: 'cases', filters: {} },
    aiPromptTemplate: `Analizează termenele dosarelor și generează un rezumat în limba română.
Evidențiază:
- Termene critice în următoarele 7 zile
- Termene depășite care necesită atenție urgentă
- Volumul de lucru estimat pentru săptămâna curentă
- Recomandări de prioritizare`,
  },
];

// ============================================================
// Pontaj (Time Tracking) Reports
// ============================================================

const timeReports: PredefinedReportTemplate[] = [
  {
    id: 'time-billable-hours',
    categoryId: 'time',
    name: 'Billable Hours',
    nameRo: 'Ore Facturabile',
    description: 'Totalul orelor facturabile pe perioadă',
    allowedRoles: ['Partner', 'Associate', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: true,
    dataQuery: { type: 'timeEntries', filters: { billable: true } },
    aiPromptTemplate: `Analizează orele facturabile și generează un rezumat în limba română.
Evidențiază:
- Total ore facturabile în perioada selectată
- Comparație cu perioadele anterioare
- Tendințe (creștere/scădere)
- Recomandări pentru îmbunătățirea productivității`,
  },
  {
    id: 'time-team-utilization',
    categoryId: 'time',
    name: 'Team Utilization',
    nameRo: 'Utilizare Echipă',
    description: 'Gradul de utilizare pe membru al echipei',
    allowedRoles: ['Partner', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: true,
    dataQuery: { type: 'timeEntries', filters: {} },
    aiPromptTemplate: `Analizează utilizarea echipei și generează un rezumat în limba română.
Evidențiază:
- Gradul de utilizare al fiecărui membru (ore lucrate vs. capacitate)
- Cine are capacitate disponibilă pentru noi proiecte
- Cine ar putea fi supraîncărcat
- Recomandări pentru echilibrarea sarcinilor`,
  },
  {
    id: 'time-monthly-trend',
    categoryId: 'time',
    name: 'Monthly Trend',
    nameRo: 'Tendință Lunară',
    description: 'Evoluția orelor lucrate pe luni',
    allowedRoles: ['Partner', 'Associate', 'BusinessOwner'],
    chartType: 'line',
    requiresDateRange: true,
    dataQuery: { type: 'timeEntries', filters: {} },
    aiPromptTemplate: `Analizează tendința lunară a orelor lucrate și generează un rezumat în limba română.
Evidențiază:
- Evoluția în ultimele 6-12 luni
- Lunile de vârf și cele mai slabe
- Sezonalitate în volumul de lucru
- Predicții pentru luna următoare`,
  },
];

// ============================================================
// Financiar (Financial) Reports
// ============================================================

const financialReports: PredefinedReportTemplate[] = [
  {
    id: 'financial-revenue-breakdown',
    categoryId: 'financial',
    name: 'Revenue Breakdown',
    nameRo: 'Defalcare Venituri',
    description: 'Veniturile defalcate pe client și tip de serviciu',
    allowedRoles: ['Partner', 'BusinessOwner'],
    chartType: 'pie',
    requiresDateRange: true,
    dataQuery: { type: 'invoices', filters: {} },
    aiPromptTemplate: `Analizează veniturile și generează un rezumat în limba română.
Evidențiază:
- Top 5 clienți ca venituri generate
- Distribuția pe tipuri de servicii
- Concentrarea veniturilor (risc de dependență)
- Recomandări pentru diversificarea portofoliului`,
  },
  {
    id: 'financial-realization-rate',
    categoryId: 'financial',
    name: 'Realization Rate',
    nameRo: 'Rata de Realizare',
    description: 'Procentul orelor facturate vs. lucrate',
    allowedRoles: ['Partner', 'BusinessOwner'],
    chartType: 'gauge',
    requiresDateRange: true,
    dataQuery: { type: 'invoices', filters: {} },
    aiPromptTemplate: `Analizează rata de realizare și generează un rezumat în limba română.
Evidențiază:
- Rata curentă de realizare (ore facturate / ore lucrate)
- Comparație cu ținta firmei
- Cauze posibile pentru orele nefacturate
- Recomandări pentru îmbunătățire`,
  },
  {
    id: 'financial-profitability',
    categoryId: 'financial',
    name: 'Profitability Analysis',
    nameRo: 'Analiză Profitabilitate',
    description: 'Profitabilitatea pe client și tip de dosar',
    allowedRoles: ['Partner', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: true,
    dataQuery: { type: 'invoices', filters: {} },
    aiPromptTemplate: `Analizează profitabilitatea și generează un rezumat în limba română.
Evidențiază:
- Clienți cei mai profitabili
- Tipuri de dosare cu cea mai bună marjă
- Clienți sau dosare subperformante
- Recomandări strategice pentru maximizarea profitului`,
  },
];

// ============================================================
// Echipă (Team) Reports
// ============================================================

const teamReports: PredefinedReportTemplate[] = [
  {
    id: 'team-workload-distribution',
    categoryId: 'team',
    name: 'Workload Distribution',
    nameRo: 'Distribuție Sarcini',
    description: 'Cum sunt distribuite dosarele în echipă',
    allowedRoles: ['Partner', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: false,
    dataQuery: { type: 'cases', filters: {} },
    aiPromptTemplate: `Analizează distribuția sarcinilor și generează un rezumat în limba română.
Evidențiază:
- Numărul de dosare per avocat
- Dezechilibre în distribuție
- Complexitatea medie a dosarelor per avocat
- Recomandări pentru echilibrarea volumului de lucru`,
  },
  {
    id: 'team-task-completion',
    categoryId: 'team',
    name: 'Task Completion',
    nameRo: 'Finalizare Sarcini',
    description: 'Rata de finalizare a sarcinilor pe membru',
    allowedRoles: ['Partner', 'Associate', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: true,
    dataQuery: { type: 'cases', filters: {} },
    aiPromptTemplate: `Analizează finalizarea sarcinilor și generează un rezumat în limba română.
Evidențiază:
- Rata de finalizare per membru al echipei
- Sarcini întârziate sau depășite
- Tendințe în productivitate
- Recomandări pentru îmbunătățire`,
  },
];

// ============================================================
// Clienți (Clients) Reports
// ============================================================

const clientReports: PredefinedReportTemplate[] = [
  {
    id: 'clients-top-clients',
    categoryId: 'clients',
    name: 'Top Clients',
    nameRo: 'Clienți Principali',
    description: 'Cei mai importanți clienți după venituri și activitate',
    allowedRoles: ['Partner', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: true,
    dataQuery: { type: 'clients', filters: { activeOnly: true } },
    aiPromptTemplate: `Analizează clienții principali și generează un rezumat în limba română.
Evidențiază:
- Top 10 clienți după venituri generate
- Longevitatea relației cu clienții
- Potențialul de creștere cu fiecare client
- Recomandări pentru consolidarea relațiilor`,
  },
  {
    id: 'clients-activity-metrics',
    categoryId: 'clients',
    name: 'Activity Metrics',
    nameRo: 'Metrici Activitate',
    description: 'Nivelul de activitate și angajament per client',
    allowedRoles: ['Partner', 'Associate', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: true,
    dataQuery: { type: 'clients', filters: { hasOpenCases: true } },
    aiPromptTemplate: `Analizează activitatea clienților și generează un rezumat în limba română.
Evidențiază:
- Frecvența interacțiunilor cu fiecare client
- Clienți cu activitate redusă (risc de pierdere)
- Clienți noi vs. clienți vechi
- Recomandări pentru reactivarea clienților inactivi`,
  },
];

// ============================================================
// Documente (Documents) Reports
// ============================================================

const documentReports: PredefinedReportTemplate[] = [
  {
    id: 'documents-processing-stats',
    categoryId: 'documents',
    name: 'Processing Stats',
    nameRo: 'Statistici Procesare',
    description: 'Volumul de documente procesate și starea lor',
    allowedRoles: ['Partner', 'Associate', 'Paralegal', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: true,
    dataQuery: { type: 'documents', filters: {} },
    aiPromptTemplate: `Analizează procesarea documentelor și generează un rezumat în limba română.
Evidențiază:
- Total documente procesate în perioada selectată
- Distribuția pe tipuri de documente
- Timp mediu de procesare
- Recomandări pentru eficientizare`,
  },
  {
    id: 'documents-template-usage',
    categoryId: 'documents',
    name: 'Template Usage',
    nameRo: 'Utilizare Șabloane',
    description: 'Frecvența utilizării șabloanelor de comunicări, sarcini și mape',
    allowedRoles: ['Partner', 'Associate', 'Paralegal', 'BusinessOwner'],
    chartType: 'bar',
    requiresDateRange: false,
    dataQuery: { type: 'documents', filters: {} },
    aiPromptTemplate: `Analizează utilizarea șabloanelor și generează un rezumat în limba română.
Evidențiază:
- Cele mai utilizate șabloane
- Șabloane neutilizate (candidați pentru eliminare)
- Nevoi potențiale de șabloane noi
- Recomandări pentru biblioteca de șabloane`,
  },
];

// ============================================================
// Exports
// ============================================================

export const PREDEFINED_REPORT_TEMPLATES: PredefinedReportTemplate[] = [
  ...caseReports,
  ...timeReports,
  ...financialReports,
  ...teamReports,
  ...clientReports,
  ...documentReports,
];

export function getTemplatesByCategory(categoryId: ReportCategory): PredefinedReportTemplate[] {
  return PREDEFINED_REPORT_TEMPLATES.filter((t) => t.categoryId === categoryId);
}

export function getTemplateById(id: string): PredefinedReportTemplate | undefined {
  return PREDEFINED_REPORT_TEMPLATES.find((t) => t.id === id);
}
