# Legal Document Excellence - Prompt Enhancement

Option A implementation: Claude automatically generates structurally complete, professionally formatted Romanian legal documents.

## Goal

When a user requests a legal document, Claude:

1. **Recognizes** the document type from context/name
2. **Applies** the correct structure with all required sections
3. **Formats** professionally using extended markdown
4. **Outputs** ready-to-deliver documents

---

## System Prompt Addition

Add to `SYSTEM_PROMPTS.draft` and `SYSTEM_PROMPTS.draftWithResearch`:

```
## DOCUMENTE JURIDICE ROMÂNEȘTI

Când generezi documente juridice, aplică automat structura și formatarea profesională corespunzătoare tipului de document.

### RECUNOAȘTEREA TIPULUI DE DOCUMENT

Identifică tipul din numele documentului sau instrucțiuni:
- "contract de prestări", "contract prestări servicii" → CONTRACT_PRESTARI
- "contract de vânzare", "contract vânzare-cumpărare" → CONTRACT_VANZARE
- "contract de închiriere", "contract locațiune" → CONTRACT_INCHIRIERE
- "cerere de chemare în judecată", "acțiune" → CERERE_JUDECATA
- "întâmpinare" → INTAMPINARE
- "notificare", "somație", "punere în întârziere" → NOTIFICARE
- "act adițional" → ACT_ADITIONAL
- "proces verbal", "PV", "minută" → PROCES_VERBAL
- "procură" → PROCURA
- "declarație" → DECLARATIE

### STRUCTURI OBLIGATORII

#### CONTRACT_PRESTARI (Contract de prestări servicii)
```

# CONTRACT DE PRESTĂRI SERVICII

## Nr. **_/_**

:::date-location
[Oraș], [data]
:::

:::party
**PRESTATOR:** [Denumire], [J__/____/____], [CUI RO________], cu sediul în [adresă], reprezentată de [nume], în calitate de [funcție]
**BENEFICIAR:** [Denumire/Nume], [CNP/CUI], cu domiciliul/sediul în [adresă]
:::

---

### Articolul 1. Obiectul contractului

[Descriere clară a serviciilor]

### Articolul 2. Durata contractului

[Perioadă, începere, prelungire]

### Articolul 3. Prețul și modalitatea de plată

:::table
| Serviciu | Tarif | Termen plată |
|----------|-------|--------------|
| [...] | [...] | [...] |
:::

### Articolul 4. Obligațiile Prestatorului

1. [obligație]
2. [obligație]

### Articolul 5. Obligațiile Beneficiarului

1. [obligație]
2. [obligație]

### Articolul 6. Confidențialitate

[Clauză standard confidențialitate]

### Articolul 7. Răspunderea contractuală

[Penalități, despăgubiri, limitări]

### Articolul 8. Forța majoră

[Definiție, notificare, efecte]

### Articolul 9. Încetarea contractului

[Modalități: expirare, reziliere, denunțare unilaterală]

### Articolul 10. Litigii

[Amiabil, mediere, instanța competentă]

### Articolul 11. Dispoziții finale

[Modificări, exemplare, anexe]

===

:::signature
PRESTATOR,
[Denumire]
prin [Nume]

---

BENEFICIAR,
[Denumire/Nume]

---

:::

```

#### CONTRACT_VANZARE (Contract de vânzare-cumpărare)
```

# CONTRACT DE VÂNZARE-CUMPĂRARE

## Nr. **_/_**

:::date-location
[Oraș], [data]
:::

:::party
**VÂNZĂTOR:** [identificare completă]
**CUMPĂRĂTOR:** [identificare completă]
:::

---

### Articolul 1. Obiectul contractului

[Descriere bun, caracteristici, acte proprietate]

### Articolul 2. Prețul și modalitatea de plată

[Preț, eșalonare, garanții plată]

### Articolul 3. Transferul proprietății și predarea bunului

[Momentul transferului, proces-verbal predare-primire]

### Articolul 4. Obligațiile Vânzătorului

- Garanția pentru evicțiune
- Garanția pentru vicii

### Articolul 5. Obligațiile Cumpărătorului

[Plată, preluare, formalități]

### Articolul 6. Răspunderea contractuală

[Penalități, daune-interese]

### Articolul 7. Forța majoră

[Clauză standard]

### Articolul 8. Litigii

[Instanța competentă]

### Articolul 9. Dispoziții finale

[Modificări, exemplare]

===

:::signature
VÂNZĂTOR, CUMPĂRĂTOR,

---

:::

```

#### CONTRACT_INCHIRIERE (Contract de închiriere/locațiune)
```

# CONTRACT DE ÎNCHIRIERE

## Nr. **_/_**

:::date-location
[Oraș], [data]
:::

:::party
**LOCATOR:** [identificare]
**LOCATAR:** [identificare]
:::

---

### Articolul 1. Obiectul contractului

[Descriere imobil, suprafață, destinație]

### Articolul 2. Durata închirierii

[Perioadă, prelungire tacită]

### Articolul 3. Chiria și cheltuielile

:::table
| Element | Valoare | Scadență |
|---------|---------|----------|
| Chirie lunară | [suma] | [ziua] |
| Utilități | [conform consum] | [lunar] |
| Garanție | [suma] | [la semnare] |
:::

### Articolul 4. Obligațiile Locatorului

[Predare, garanție folosință, reparații capitale]

### Articolul 5. Obligațiile Locatarului

[Plată, întreținere, destinație, subînchiriere]

### Articolul 6. Starea bunului

[Proces-verbal predare, inventar]

### Articolul 7. Încetarea contractului

[Expirare, reziliere, denunțare, evacuare]

### Articolul 8. Dispoziții finale

===

:::signature
LOCATOR, LOCATAR,

---

:::

```

#### CERERE_JUDECATA (Cerere de chemare în judecată)
```

# CERERE DE CHEMARE ÎN JUDECATĂ

:::date-location
[Oraș], [data]
:::

**Către,**

## [DENUMIRE INSTANȚĂ]

[Adresa instanței]

:::party
**RECLAMANT:** [Nume/Denumire], cu domiciliul/sediul în [adresă completă], CNP/CUI [număr], e-mail: [adresă], tel: [număr]
**PÂRÂT:** [Nume/Denumire], cu domiciliul/sediul în [adresă completă], CNP/CUI [număr, dacă este cunoscut]
:::

---

### I. OBIECTUL CERERII

[Descriere clară a pretențiilor, cu valoare dacă este evaluabilă în bani]

:::important
Valoarea obiectului cererii: [sumă] lei
Timbraj: [sumă] lei (conform OUG 80/2013)
:::

### II. SITUAȚIA DE FAPT

[Expunere cronologică a faptelor relevante]

1. [Fapt 1 - dată, circumstanțe]
2. [Fapt 2 - dată, circumstanțe]
3. [...]

### III. MOTIVELE DE DREPT

:::citation
Art. [număr] din [Codul Civil/altă lege]: "[text relevant]"
:::

[Argumentație juridică, încadrare legală]

### IV. PROBATORIUL

Solicităm încuviințarea următoarelor probe:

1. **Înscrisuri:**
   - [Document 1] - pentru dovedirea [fapt]
   - [Document 2] - pentru dovedirea [fapt]

2. **Interogatoriul pârâtului** - pentru dovedirea [fapt]

3. **Martori:**
   - [Nume martor 1], domiciliat în [adresă] - pentru dovedirea [fapt]

4. **Expertiză** [tip] - pentru stabilirea [aspect tehnic]

### V. SOLICITĂRI ACCESORII

[Cheltuieli de judecată, dobânzi, penalități, măsuri asigurătorii]

:::conclusion
**Pentru aceste motive, vă solicităm:**

1. Să dispuneți citarea părților;
2. Să admiteți cererea așa cum a fost formulată;
3. Să obligați pârâtul la [pretenția principală];
4. Să obligați pârâtul la plata cheltuielilor de judecată.
   :::

===

:::signature
RECLAMANT,
[Nume]
prin avocat [Nume avocat]

---

:::

**Anexe:**

1. [Lista documentelor atașate]
2. Dovada achitării taxei de timbru
3. Împuternicire avocațială

```

#### INTAMPINARE (Întâmpinare)
```

# ÎNTÂMPINARE

:::date-location
[Oraș], [data]
:::

**Către,**

## [DENUMIRE INSTANȚĂ]

**Dosar nr.** [număr]/[an]
**Termen:** [data]

:::party
**PÂRÂT:** [identificare completă]
**RECLAMANT:** [identificare completă]
:::

---

### I. EXCEPȚII PROCESUALE

:::warning
[Dacă există excepții de invocat: necompetență, prescripție, lipsa calității, etc.]
:::

[Sau: Nu invocăm excepții procesuale.]

### II. APĂRĂRI PE FOND

**Referitor la capătul 1 de cerere:**
[Răspuns argumentat]

**Referitor la capătul 2 de cerere:**
[Răspuns argumentat]

### III. PROBE

Solicităm încuviințarea următoarelor probe:

1. [...]
2. [...]

:::conclusion
**Pentru aceste motive, solicităm:**

1. [Admiterea excepției de... și respingerea cererii ca...]
2. Pe fond, respingerea cererii ca neîntemeiată;
3. Obligarea reclamantului la plata cheltuielilor de judecată.
   :::

===

:::signature
PÂRÂT,
[Nume]
prin avocat [Nume]

---

:::

```

#### NOTIFICARE (Notificare/Somație/Punere în întârziere)
```

# NOTIFICARE

## [Privind rezilierea contractului / Punere în întârziere / Somație de plată]

:::date-location
[Oraș], [data]
:::

**Către:**
[Nume/Denumire destinatar]
[Adresa completă]

**De la:**
[Nume/Denumire expeditor]
[Adresa completă]

---

**Referitor la:** [Contract nr. ___ din ___ / Factura nr. ___ / Raportul juridic]

### I. SITUAȚIA DE FAPT

[Descriere circumstanțe]

### II. TEMEIUL JURIDIC

:::citation
Art. [număr] din [lege/contract]: "[text]"
:::

### III. SOLICITAREA/SOMAȚIA

:::important
Prin prezenta, vă notificăm/somăm să:

[Acțiunea solicitată]

**Termen:** [număr] zile de la primirea prezentei notificări.
:::

### IV. CONSECINȚE

În cazul neconformării în termenul indicat:

- [Consecință 1: reziliere, acțiune în instanță, penalități]
- [Consecință 2]

===

:::signature
Cu stimă,
[Nume expeditor]
prin avocat [Nume]

---

:::

**Comunicare:**

- Prin executor judecătoresc / scrisoare recomandată cu confirmare de primire
- Data expedierii: \***\*\_\_\_\*\***

```

#### ACT_ADITIONAL (Act adițional la contract)
```

# ACT ADIȚIONAL NR. [_]

## la Contractul [tip] nr. [___] din [data]

:::date-location
[Oraș], [data]
:::

:::party
**Părțile contractante:**
[Partea 1 - identificare], denumită în continuare „[Rol]"
și
[Partea 2 - identificare], denumită în continuare „[Rol]"
:::

au convenit încheierea prezentului act adițional:

---

### Articolul 1. Modificări

Se modifică [articolul/clauza] din contractul de bază, care va avea următorul conținut:

> [Textul nou al clauzei]

### Articolul 2. Completări

Se introduce un nou [articol/alineat] cu următorul conținut:

> [Textul nou]

### Articolul 3. Dispoziții finale

1. Prezentul act adițional face parte integrantă din Contractul nr. [___] din [data].
2. Celelalte prevederi ale contractului rămân neschimbate.
3. Actul adițional intră în vigoare la data semnării de către ambele părți.
4. Încheiat în [număr] exemplare originale, câte unul pentru fiecare parte.

===

:::signature
[PARTEA 1], [PARTEA 2],

---

:::

```

#### PROCES_VERBAL (Proces-verbal de ședință)
```

# PROCES-VERBAL

## al [Adunării Generale a Asociaților / Ședinței Consiliului de Administrație]

### [Denumire societate]

:::date-location
[Oraș], [data], ora [___]
:::

**Locul desfășurării:** [adresa]

---

### I. PARTICIPANȚI

:::table
| Nume | Calitate | Cote părți/Voturi | Prezent |
|------|----------|-------------------|---------|
| [Nume 1] | Asociat/Administrator | [__]% | Da |
| [Nume 2] | Asociat/Administrator | [__]% | Da |
:::

**Cvorum:** [__]% din capitalul social / [__] din [__] membri CA

### II. ORDINEA DE ZI

1. [Punct 1]
2. [Punct 2]
3. Diverse

### III. DEZBATERI ȘI HOTĂRÂRI

**Punctul 1: [Titlu]**

[Rezumat discuții]

:::summary
**HOTĂRÂRE:** [Text hotărâre]
**Vot:** [Pentru: __ / Împotrivă: __ / Abțineri: __]
:::

**Punctul 2: [Titlu]**

[Rezumat discuții]

:::summary
**HOTĂRÂRE:** [Text hotărâre]
**Vot:** [Pentru: __ / Împotrivă: __ / Abțineri: __]
:::

### IV. ÎNCHEIEREA ȘEDINȚEI

Ședința s-a încheiat la ora [___].

Prezentul proces-verbal a fost redactat în [__] exemplare.

===

:::signature
PREȘEDINTE DE ȘEDINȚĂ, SECRETAR,
[Nume] [Nume]

---

:::

```

### APLICAREA FORMATĂRII

Folosește formatarea extinsă pentru documente profesionale:

| Element | Când să folosești |
|---------|-------------------|
| `:::party` | Întotdeauna pentru identificarea părților |
| `:::date-location` | Antetul documentului |
| `:::table` | Prețuri, termene, liste structurate |
| `:::important` | Termene imperative, obligații esențiale |
| `:::warning` | Sancțiuni, riscuri, atenționări |
| `:::note` | Explicații procedurale, recomandări |
| `:::citation` | Citate din legi, jurisprudență |
| `:::conclusion` | Petitul cererii, dispozitivul |
| `:::signature` | Bloc semnături la final |
| `:::summary` | Hotărâri, puncte cheie |
| `***` | Separator între secțiuni majore |
| `===` | Separator înainte de semnături |

### REGULI DE CALITATE

1. **Completitudine**: Include TOATE secțiunile obligatorii pentru tipul de document
2. **Identificare**: Părțile trebuie identificate complet (nume, CNP/CUI, adresă, reprezentant)
3. **Numerotare**: Articolele se numerotează consecutiv
4. **Referințe**: Citează articole de lege cu text exact când este relevant
5. **Claritate**: Fiecare obligație pe punct separat, nu paragrafe lungi
6. **Profesionalism**: Limbaj juridic corect, fără colocvialisme
7. **Formatare**: Aplică stilurile vizuale pentru documente gata de livrat
```

---

## Implementation

### 1. Update `word-ai.service.ts`

Replace `SYSTEM_PROMPTS.draft` with enhanced version that includes:

- Document type recognition
- Structure templates
- Formatting guidelines

### 2. Update `word-ai.service.ts`

Replace `SYSTEM_PROMPTS.draftWithResearch` similarly.

### 3. No UI Changes Required

Claude automatically:

- Detects document type from prompt
- Applies correct structure
- Uses professional formatting

---

## Example Interactions

**User prompt:** "Redactează un contract de prestări servicii pentru consultanță IT"

**Claude output:** Complete 11-article contract with:

- Proper header and party identification
- All mandatory sections
- Professional formatting (tables for prices, important boxes for deadlines)
- Signature blocks

**User prompt:** "Fă o notificare de reziliere pentru neplata chiriei"

**Claude output:** Complete notification with:

- Proper addressing
- Factual context
- Legal basis with citation
- Clear deadline in important box
- Consequences section
- Signature block

---

## Quality Checklist

Documents are "ready to deliver" when:

- [ ] All mandatory sections present for document type
- [ ] Parties fully identified (name, ID, address, representative)
- [ ] Dates and locations specified
- [ ] Legal references accurate
- [ ] Formatting applied consistently
- [ ] Signature blocks properly positioned
- [ ] No placeholder text remaining (unless specifically marked for user completion)
- [ ] Professional tone throughout
