/**
 * Document Formatting Guidelines
 * Standardized formatting instructions for AI-generated legal documents
 *
 * These guidelines are injected into AI prompts to ensure consistent
 * Romanian legal document formatting across all generated content.
 */

// ============================================================================
// Base Document Formatting Guidelines
// ============================================================================

export const DOCUMENT_FORMATTING_GUIDELINES = `
## STANDARDE DE FORMATARE

### Convenții Românești
- Ghilimele: „text" (jos-sus), „citat «interior»"
- Data: DD.MM.YYYY (ex: 16.01.2026)
- Numere: 1.234,56 (punct pentru mii, virgulă pentru zecimale)
- Monedă: 1.000 lei, 15.000,00 EUR

### Structură Paragrafe
- Primul paragraf după titlu: fără indent
- Paragrafele următoare: indent 0.5"
- SAU: spațiu 12pt între paragrafe (fără indent)

### Citate Bloc (pentru 40+ cuvinte)
- Folosește > pentru indent
- NU folosi ghilimele
- Include sursa pe linie separată cu —

Exemplu:
> Textul citat care depășește 40 de cuvinte trebuie
> formatat ca bloc indent fără ghilimele.
> — Autor, Titlu Lucrare, pagina

### Numerotare Contracte (Stil European)
Nivel 1: 1., 2., 3. (Articole)
Nivel 2: 1.1., 1.2., 2.1. (Secțiuni)
Nivel 3: (a), (b), (c) (Paragrafe)
Nivel 4: (i), (ii), (iii) (Subparagrafe)

Exemplu:
1. Obiectul Contractului
   1.1. Prestatorul se obligă să:
        (a) furnizeze serviciile conform anexei;
        (b) respecte termenele, inclusiv:
            (i) termenul inițial;
            (ii) termenele intermediare.

### Definiții Contract
- Termenii definiți: **bold** între „ghilimele"
- Ordine alfabetică în secțiunea Definiții
- Prima utilizare în text: referință la definiție

Exemplu:
**„Beneficiar"** înseamnă SC EXAMPLE SRL...
**„Contract"** înseamnă prezentul contract...
**„Servicii"** înseamnă serviciile descrise în Anexa A...

### Semnături
Folosește blocul :::signature pentru semnături:

:::signature
SC ALPHA CONSULTING SRL

_______________________
Ion Popescu
Administrator
Data: _______________
:::

### Note de Subsol
Folosește [^1] pentru referințe și [^1]: pentru definiții.
Plasează notele la sfârșitul documentului.

### Titluri și Subtitluri
- # pentru Titlu principal (centrat)
- ## pentru Capitole
- ### pentru Articole/Secțiuni
- #### pentru Subsecțiuni
`;

// ============================================================================
// Contract-Specific Guidelines
// ============================================================================

export const CONTRACT_SPECIFIC_GUIDELINES = `
### Structură Contract Standard

1. **TITLU** - centrat, majuscule
2. **PĂRȚI** - identificare completă cu:
   - Denumire societate
   - Sediu social
   - Nr. înregistrare, CUI
   - Reprezentant legal
   - Denumire prescurtată („Prestatorul")

3. **PREAMBUL** - clauzele "AVÂND ÎN VEDERE CĂ"

4. **DEFINIȚII** - ordine alfabetică, termeni bold

5. **OBIECT** - descriere clară

6. **OBLIGAȚII** - structurate pe părți

7. **PREȚ ȘI PLATĂ** - sumă în cifre și litere
   Exemplu: 15.000,00 EUR (cincisprezece mii euro)

8. **DURATA** - termen, prelungire, încetare

9. **CLAUZE FINALE** - forță majoră, litigii, modificări

10. **SEMNĂTURI** - bloc semnătură pentru fiecare parte
    Format "Pagina X din Y" în subsol
`;
