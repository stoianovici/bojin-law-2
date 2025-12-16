# Cerere de Chemare în Judecată (Lawsuit Petition)

## Romanian Legal Document Template

**Template ID:** 15
**Category:** Court Filing
**Language:** Romanian (Primary), English (Secondary)
**Estimated Time Savings:** 3.0 hours
**Complexity:** High

---

## Metadata

- **Romanian Name:** Cerere de Chemare în Judecată
- **English Name:** Lawsuit Petition / Complaint
- **Legal Category:** Civil Procedure
- **Average Length:** 5+ pages
- **Legal References:**
  - Art. 194 CPC - Conținutul cererii de chemare în judecată
  - Art. 195 CPC - Anexele cererii
  - Art. 1350 Cod Civil - Răspunderea civilă delictuală
  - Art. 1516 Cod Civil - Executarea obligațiilor

---

## Purpose

A Cerere de Chemare în Judecată is the formal petition to initiate a civil lawsuit in Romanian courts. It serves to:

- Establish the court's jurisdiction
- Formally state the plaintiff's claims
- Present the factual and legal grounds
- Request specific remedies from the court
- Initiate formal legal proceedings

---

## Required Variables

### Court Information

- `{{INSTANTA_NUME}}` - Court name (e.g., "Judecătoria Sectorului 1 București")
- `{{INSTANTA_SEDIU}}` - Court address

### Plaintiff Information

- `{{RECLAMANT_NUME}}` - Plaintiff name/business name
- `{{RECLAMANT_CNP_CUI}}` - Personal/fiscal identification
- `{{RECLAMANT_DOMICILIU}}` - Address/domicile
- `{{RECLAMANT_AVOCAT}}` - Attorney name
- `{{RECLAMANT_AVOCAT_BAROUL}}` - Bar association

### Defendant Information

- `{{PARAT_NUME}}` - Defendant name/business name
- `{{PARAT_CNP_CUI}}` - Personal/fiscal identification
- `{{PARAT_DOMICILIU}}` - Address/domicile

### Case Details

- `{{OBIECTUL_CERERII}}` - Object of the claim
- `{{VALOAREA_CERERII}}` - Claim value (for court fees)
- `{{MONEDA}}` - Currency
- `{{COMPETENTA_MATERIALA}}` - Subject matter jurisdiction
- `{{COMPETENTA_TERRITORIALA}}` - Territorial jurisdiction

### Facts and Legal Grounds

- `{{EXPUNEREA_FAPTELOR}}` - Statement of facts
- `{{TEMEIUL_DREPT}}` - Legal grounds (Code articles)
- `{{TEMEIUL_FAPT}}` - Factual grounds

### Claims and Evidence

- `{{PRETENTII}}` - Array of specific claims/demands
- `{{DOVEZI}}` - Array of evidence descriptions
- `{{CHELTUIELI_JUDECATA}}` - Legal costs amount

### Optional

- `{{DATA_INCIDENT}}` - Date of incident (if applicable)
- `{{CERERI_ACCESORII}}` - Additional requests

### Footer

- `{{DATA_DEPUNERE}}` - Filing date
- `{{LOCALITATE}}` - City/location

---

## Document Structure

```markdown
# CERERE DE CHEMARE ÎN JUDECATĂ

**Către:**
**{{INSTANTA_NUME}}**
**{{INSTANTA_SEDIU}}**

---

## Date de Identificare

### Reclamant

**{{RECLAMANT_NUME}}**

- CNP/CUI: {{RECLAMANT_CNP_CUI}}
- Domiciliu/Sediu: {{RECLAMANT_DOMICILIU}}
- Reprezentant: {{RECLAMANT_AVOCAT}}, Baroul {{RECLAMANT_AVOCAT_BAROUL}}

### Pârât

**{{PARAT_NUME}}**

- CNP/CUI: {{PARAT_CNP_CUI}}
- Domiciliu/Sediu: {{PARAT_DOMICILIU}}

---

## Obiectul Cererii

**{{OBIECTUL_CERERII}}**

**Valoarea cererii:** {{VALOAREA_CERERII}} {{MONEDA}}

---

## Competența Instanței

Prezenta cerere este de competența **{{INSTANTA_NUME}}** având în vedere:

1. **Competența materială:** {{COMPETENTA_MATERIALA}}
2. **Competența teritorială:** {{COMPETENTA_TERRITORIALA}}

---

## Expunerea Situației de Fapt

{{EXPUNEREA_FAPTELOR}}

---

## Temeiul de Drept și de Fapt

### Temeiul de Drept

{{TEMEIUL_DREPT}}

### Temeiul de Fapt

{{TEMEIUL_FAPT}}

---

## Pretenții

Față de cele arătate mai sus, solicit instanței să dispună:

{{PRETENTII}}

Cheltuieli de judecată: {{CHELTUIELI_JUDECATA}}

---

## Dovezi

Dovedim cele arătate cu următoarele mijloace de probă:

{{DOVEZI}}

---

## Concluzie

Pentru considerentele expuse, vă rugăm să admiteți prezenta cerere.

---

**Data:** {{DATA_DEPUNERE}}
**Localitate:** {{LOCALITATE}}

**Reclamant / Avocat,**
**{{RECLAMANT_AVOCAT}}**
**Baroul {{RECLAMANT_AVOCAT_BAROUL}}**
```

---

## Standard Romanian Legal Clauses

1. "față de cele arătate mai sus, vă rugăm să admiteți prezenta cerere"
2. "să obligați pârâtul la plata sumei de"
3. "cu cheltuieli de judecată"
4. "dovedim cele arătate cu"
5. "competența instanței este dată de"
6. "solicit citarea pârâtului la adresa menționată"
7. "anexăm prezentei dovezile necesare"

---

## Mandatory Elements (Art. 194 CPC)

A Romanian lawsuit petition MUST contain:

1. **Court name and address**
2. **Complete party identification:**
   - Full name
   - Address/domicile
   - Personal/fiscal identification
3. **Object and value of the claim**
4. **Statement of facts**
5. **Legal and factual grounds**
6. **Evidence**
7. **Signature and date**

---

## Required Annexes (Art. 195 CPC)

Must attach copies of:

1. Plaintiff's ID document
2. Supporting evidence documents
3. Proof of court fee payment
4. Power of attorney (if represented)
5. Defendant's ID (if available)

---

## Usage Notes

### When to Use

- After failed negotiations or mediation
- After sending somație de plată (for debt claims)
- When seeking court remedies
- To enforce contractual rights

### Court Selection

- **Judecătorie** (First Instance Court): Claims up to 200,000 RON
- **Tribunal** (County Court): Claims over 200,000 RON
- Territorial jurisdiction: Usually defendant's domicile

### Legal Costs to Include

- Court filing fee (taxă de timbru)
- Judicial stamp (timbru judiciar)
- Attorney's fee (onorariu avocat)
- Expert fees (if applicable)
- Translation costs (if applicable)

---

## Common Types of Claims

### Breach of Contract

- Payment of contractual obligations
- Specific performance
- Termination and damages

### Tort Claims

- Personal injury damages
- Property damage
- Professional negligence

### Property Disputes

- Ownership recognition
- Eviction
- Boundary disputes

---

## Best Practices

1. **Be Specific:** Clearly state exact amounts and remedies sought
2. **Cite Laws:** Reference specific articles from Civil Code or other laws
3. **Organize Evidence:** Number and describe each piece of evidence
4. **Calculate Costs:** Include detailed breakdown of legal costs
5. **Proofread:** Ensure all names, dates, and amounts are correct
6. **Check Jurisdiction:** Verify you're filing in the correct court

---

## Workflow Integration

After generating this document:

1. Review with client for accuracy
2. Gather all required annexes
3. Calculate and pay court fees
4. Make copies (original + 2 copies for 2 parties)
5. File with court registry
6. Obtain proof of filing
7. Wait for court summons date
8. Prepare for first hearing

---

## Time Estimates

- **Template generation:** 30 minutes (vs 3.5 hours manual)
- **Client review:** 1 hour
- **Final preparation:** 30 minutes
- **Total time saved:** ~2 hours per petition

---

**Generated by:** Document Drafting Skill v1.1.0
**Template Version:** 1.0
**Last Updated:** 2025-11-19
