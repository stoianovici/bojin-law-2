# Notificări - Ghid de Implementare pentru Word Add-in AI

## Status: ✅ IMPLEMENTAT

Data implementării: 2026-01-24

## Modificări Efectuate

### 1. `word-ai-prompts.ts`

- Adăugat `NOTIFICARI_KNOWLEDGE` - cunoștințe juridice comprehensive despre notificări
- Exportat pentru utilizare în alte module
- Inclus în `SYSTEM_PROMPTS.draft` pentru fluxul standard de documente

### 2. `word-ai.service.ts`

- Adăugat detecție automată a tipului de document (notificare vs. cercetare)
- User prompt diferențiat: pentru notificări se pune accent pe "urmează instrucțiunile"
- System prompt diferențiat: notificările folosesc `NOTIFICARI_KNOWLEDGE`
- Importat `NOTIFICARI_KNOWLEDGE` din word-ai-prompts

### Model Selection

- **Sonnet 4.5** pentru notificări standard (quick/standard depth)
- **Opus 4.5** pentru deep research sau premium mode
- Suficient de puternic pentru generarea de notificări cu cunoștințele juridice din prompt

### Context Gathering

- **Pentru dosare**: complet (părți, termene, documente, email-uri, client)
- **Pentru clienți**: de bază (nume, tip, CUI, adresă, contact)
- **Design philosophy**: utilizatorul oferă detalii specifice în prompt (nr. contract, sume, etc.)

---

## Rezumat Cercetare (pentru referință)

Am efectuat cercetare comprehensivă despre notificările juridice din România. Documentul complet se află în `notificari-juridice-romania.md`.

## Recomandări pentru Actualizarea AI

### 1. Tipuri de Notificări Identificate

| Cod  | Tip Notificare                     | Frecvență       | Prioritate |
| ---- | ---------------------------------- | --------------- | ---------- |
| N-01 | Somație de plată (pre-ordonanță)   | Foarte frecvent | 🔴 Critică |
| N-02 | Punere în întârziere               | Frecvent        | 🔴 Critică |
| N-03 | Notificare de reziliere            | Frecvent        | 🔴 Critică |
| N-04 | Denunțare unilaterală contract     | Frecvent        | 🟡 Înaltă  |
| N-05 | Notificare de evacuare             | Mediu           | 🟡 Înaltă  |
| N-06 | Plângere prealabilă administrativă | Mediu           | 🟡 Înaltă  |
| N-07 | Notificare cesiune creanță         | Rar             | 🟢 Medie   |
| N-08 | Notificare compensare              | Rar             | 🟢 Medie   |

### 2. Modificări Necesare în `word-ai-prompts.ts`

#### A. Template Notificare Extins (înlocuiește actualul)

Actualul template `NOTIFICARE` este prea simplist:

```
# NOTIFICARE
I. SITUAȚIA DE FAPT
II. TEMEIUL JURIDIC
III. SOLICITAREA/SOMAȚIA
IV. CONSECINȚE
```

**Propun** înlocuirea cu template-uri specializate:

```typescript
const NOTIFICATION_TEMPLATES = `
### NOTIFICĂRI JURIDICE

Identifică subtipul din context și aplică structura corespunzătoare:

#### SOMATIE_PLATA (pentru creanțe bănești, ordonanța de plată)
- Dacă menționează "ordonanță de plată" → include Art. 1015 CPC
- Termen obligatoriu: 15 zile
\`\`\`
# SOMAȚIE DE PLATĂ
Nr. ___/___.___.____

:::date-location
[Oraș], [data]
:::

:::party
**CREDITOR:** [identificare completă]
**CĂTRE DEBITOR:** [identificare completă]
:::

***

### I. CREANȚA
[Sursa: contract/factură nr. ___ din ___]
[Suma principală: ___ lei]
[Scadența: ___]

### II. TEMEIUL JURIDIC
- Art. 1015 CPC (dacă pentru ordonanță de plată)
- Art. 1522 Cod civil (punerea în întârziere)
- Art. 1535 Cod civil (daune moratorii)
- [Clauze contractuale relevante]

### III. SOMAȚIA
**Termen:** 15 zile de la primire
**Sumă totală:**
| Element | Valoare |
|---------|---------|
| Principal | ___ lei |
| Dobânzi | ___ lei |
| Penalități | ___ lei |
| **TOTAL** | **___ lei** |

**Cont pentru plată:** IBAN ___

### IV. CONSECINȚE
- Formularea cererii de ordonanță de plată
- Cheltuieli de judecată
- Executare silită

===

:::signature
[Semnătura]
:::
\`\`\`

#### PUNERE_INTARZIERE (pentru neexecutare obligații)
\`\`\`
# NOTIFICARE DE PUNERE ÎN ÎNTÂRZIERE
Nr. ___/___.___.____

:::date-location
[Oraș], [data]
:::

:::party
**CREDITOR:** [identificare completă]
**CĂTRE DEBITOR:** [identificare completă]
:::

***

### I. RAPORTUL JURIDIC
[Contractul/Acordul nr. ___ din ___]
[Obligația asumată: ___]
[Termen de executare: ___]

### II. NEEXECUTAREA
[Ce nu s-a executat]
[De când/câte zile de întârziere]

### III. TEMEIUL JURIDIC
- Art. 1522 Cod civil - punerea în întârziere
- Art. 1530-1536 Cod civil - efectele întârzierii
- [Clauze contractuale]

### IV. SOLICITAREA
**Termen acordat:** ___ zile
**Obligația de executat:** [specific]

### V. EFECTELE ÎNTÂRZIERII
- Daune moratorii de la data comunicării
- Dreptul la rezoluțiune/reziliere
- Riscul pieirii bunului trece la debitor

===

:::signature
[Semnătura]
:::
\`\`\`

#### REZILIERE (pentru neexecutare contracte cu executare succesivă)
\`\`\`
# NOTIFICARE DE REZILIERE
Nr. ___/___.___.____

:::date-location
[Oraș], [data]
:::

:::party
**EXPEDITOR:** [identificare completă]
**CĂTRE:** [identificare completă]
:::

***

### I. CONTRACTUL REZILIAT
[Tip contract] nr. ___ din data ___
Obiect: ___

### II. NEEXECUTAREA CULPABILĂ
[Obligația încălcată - art./clauza din contract]
[Descrierea neexecutării]
[Prejudiciul cauzat]

### III. TEMEIUL JURIDIC
- Art. 1549-1554 Cod civil
- Art. 1552 alin. (1) - rezilierea prin notificare
- [Pact comisoriu din contract, dacă există]

### IV. DECLARAȚIE DE REZILIERE
Prin prezenta, declar reziliat contractul menționat,
începând cu data comunicării prezentei notificări.

### V. EFECTELE REZILIERII
- Contractul încetează pentru viitor
- [Restituiri, predări]
- Ne rezervăm dreptul la despăgubiri

:::important
Conform Art. 1552 alin. (4) Cod civil, prezenta declarație
devine irevocabilă de la data comunicării.
:::

===

:::signature
[Semnătura]
:::
\`\`\`

#### DENUNTARE_UNILATERALA (încetare fără culpă)
\`\`\`
# NOTIFICARE DE DENUNȚARE UNILATERALĂ
Nr. ___/___.___.____

:::date-location
[Oraș], [data]
:::

:::party
**EXPEDITOR:** [identificare completă]
**CĂTRE:** [identificare completă]
:::

***

### I. CONTRACTUL DENUNȚAT
[Tip contract] nr. ___ din data ___

### II. TEMEIUL DENUNȚĂRII
- Art. 1276 Cod civil
- [Clauza contractuală care permite denunțarea]
- [Pentru locațiune: Art. 1825 Cod civil]

### III. PREAVIZUL
**Durată preaviz:** ___ zile/luni
**Data începerii:** data comunicării
**Data încetării contractului:** ___.___._____

### IV. EFECTELE DENUNȚĂRII
- Obligațiile încetează de la data încetării
- Prestațiile executate rămân valabile
- [Pentru locațiune: predarea imobilului la data ___]

===

:::signature
[Semnătura]
:::
\`\`\`
`;
```

#### B. Logică de Identificare Automată

Adaugă în `DOCUMENT_TYPE_TEMPLATES`:

```typescript
// IDENTIFICARE SUBTIP NOTIFICARE
Când documentul este o notificare, identifică subtipul:
- "somație", "plată", "factură restantă", "ordonanță de plată" → SOMATIE_PLATA
- "pune în întârziere", "execut(ați|e) obligația" → PUNERE_INTARZIERE
- "reziliez", "neexecutare contract", "încălcare obligații" → REZILIERE
- "denunț", "încetare contract", "fără motiv", "preaviz" → DENUNTARE_UNILATERALA
- "evacuez", "eliberare imobil", "chirias" → EVACUARE
- "contest", "act administrativ", "revocare" → PLANGERE_PREALABILA
```

#### C. Checklist de Calitate pentru Notificări

```typescript
const NOTIFICATION_QUALITY_CHECKLIST = `
### CHECKLIST NOTIFICĂRI

Înainte de finalizare, verifică:

☑ IDENTIFICARE PĂRȚI
  - Nume complet / Denumire societate
  - CNP / CUI
  - Adresă completă
  - Reprezentant legal (pentru PJ)

☑ TEMEI JURIDIC
  - Articole Cod Civil citate corect
  - Articole CPC (dacă e procedură specială)
  - Clauze contractuale (dacă există)

☑ TERMENE
  - Termen de conformare specificat în ZILE
  - Pentru ordonanța de plată: minimum 15 zile
  - Pentru locațiune: minimum 60 zile preaviz

☑ SUME (pentru creanțe bănești)
  - Principal specificat
  - Accesorii calculate (dobânzi, penalități)
  - Total clar evidențiat
  - IBAN pentru plată

☑ CONSECINȚE
  - Ce se întâmplă la neconformare
  - Referință la acțiunea judiciară posibilă

☑ COMUNICARE
  - Notificarea e pregătită pentru comunicare
  - Menționează executor/scrisoare recomandată
`;
```

### 3. Întrebări de Clarificare pentru AI

Când utilizatorul solicită o notificare, AI-ul ar trebui să întrebe:

```typescript
const NOTIFICATION_CLARIFYING_QUESTIONS = [
  {
    trigger: ['somație', 'plată', 'datorează'],
    questions: [
      'Care este suma datorată (principal)?',
      'Din ce dată curge întârzierea?',
      'Există contract? Ce prevede despre penalități/dobânzi?',
      'Doriți să pregătiți și cererea de ordonanță de plată?',
    ],
  },
  {
    trigger: ['reziliez', 'reziliere', 'neexecutare'],
    questions: [
      'Ce obligație nu a fost executată?',
      'A existat o punere în întârziere anterioară?',
      'Contractul conține un pact comisoriu?',
      'Care este prejudiciul suferit (pentru despăgubiri)?',
    ],
  },
  {
    trigger: ['denunț', 'încetare', 'preaviz'],
    questions: [
      'Contractul prevede un termen de preaviz?',
      'De când doriți să producă efecte denunțarea?',
      'Există prestații în curs care trebuie finalizate?',
    ],
  },
];
```

### 4. Integrare cu Template-urile Existente

În `StepTemplate.tsx`, se pot adăuga template-uri pentru notificări în categoria "Proceduri Speciale" sau o categorie nouă:

```typescript
// Propunere nouă categorie în COURT_FILING_TEMPLATES
{
  category: 'Notificări',
  templates: [
    {
      id: 'N-01',
      name: 'Somație de plată',
      description: 'Pentru recuperarea creanțelor, procedură prealabilă ordonanței de plată',
      cpcArticles: ['Art. 1015', 'Art. 1522 Cod Civil'],
      party1Label: 'Creditor',
      party2Label: 'Debitor',
      requiredSections: ['Creanța', 'Temeiul juridic', 'Somația', 'Consecințe']
    },
    {
      id: 'N-02',
      name: 'Punere în întârziere',
      description: 'Solicitarea executării unei obligații scadente',
      cpcArticles: ['Art. 1522-1525 Cod Civil'],
      party1Label: 'Creditor',
      party2Label: 'Debitor'
    },
    {
      id: 'N-03',
      name: 'Notificare de reziliere',
      description: 'Încetarea contractului pentru neexecutare',
      cpcArticles: ['Art. 1549-1554 Cod Civil'],
      party1Label: 'Partea care reziliază',
      party2Label: 'Partea în culpă'
    },
    {
      id: 'N-04',
      name: 'Denunțare unilaterală',
      description: 'Încetarea contractului prin voința unei părți',
      cpcArticles: ['Art. 1276-1277 Cod Civil'],
      party1Label: 'Parte denunțătoare',
      party2Label: 'Cealaltă parte'
    }
  ]
}
```

### 5. Priorități de Implementare

1. **Faza 1** (Critică):
   - Actualizează template-ul NOTIFICARE în `word-ai-prompts.ts`
   - Adaugă logica de identificare subtip
   - Adaugă checklist de calitate

2. **Faza 2** (Înaltă):
   - Adaugă template-uri în UI (StepTemplate.tsx)
   - Implementează întrebări de clarificare

3. **Faza 3** (Medie):
   - Adaugă exemple de notificări în training data
   - Testare și refinare

## Concluzie

Notificările juridice sunt documente critice cu efecte juridice importante. AI-ul trebuie să:

1. **Identifice corect tipul** de notificare solicitat
2. **Aplice structura corespunzătoare** cu toate elementele obligatorii
3. **Citeze corect temeiul legal** (articole Cod Civil/CPC)
4. **Specifice termene concrete** (nu vagi)
5. **Detalieze consecințele** neconformării

Documentul complet de cercetare (`notificari-juridice-romania.md`) conține toate template-urile detaliate și referințele legale necesare.
