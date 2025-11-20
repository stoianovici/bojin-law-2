# Somație de Plată (Payment Notice)
## Romanian Legal Document Template

**Template ID:** 14
**Category:** Debt Collection
**Language:** Romanian (Primary), English (Secondary)
**Estimated Time Savings:** 1.5 hours
**Complexity:** Medium

---

## Metadata

- **Romanian Name:** Somație de Plată
- **English Name:** Payment Notice
- **Legal Category:** Civil Law - Debt Collection
- **Average Length:** 2 pages
- **Legal References:**
  - Art. 1516 Cod Civil - Obligația de plată
  - Art. 1535 Cod Civil - Dobânda legală
  - Art. 1457 Cod Civil - Punerea în întârziere

---

## Purpose

A Somație de Plată is a formal demand for payment of an outstanding debt, serving as:
- Official notice putting the debtor in default (punere în întârziere)
- Prerequisite for legal action in Romanian courts
- Documentation for interest and penalty calculations
- Evidence of good faith attempt to resolve the matter

---

## Required Variables

### Creditor Information
- `{{CREDITOR_NUME}}` - Creditor name / business name
- `{{CREDITOR_CUI}}` - Fiscal identification code (CUI)
- `{{CREDITOR_SEDIU}}` - Registered address
- `{{CREDITOR_REPREZENTANT}}` - Legal representative name

### Debtor Information
- `{{DEBTOR_NUME}}` - Debtor name / business name
- `{{DEBTOR_CNP_CUI}}` - Personal/fiscal identification
- `{{DEBTOR_DOMICILIU}}` - Address/domicile

### Debt Details
- `{{SUMA_DATORATA}}` - Amount owed
- `{{MONEDA}}` - Currency (RON, EUR, etc.)
- `{{TEMEIUL_JURIDIC}}` - Legal basis (contract number, invoice, etc.)
- `{{DATA_SCADENTA}}` - Due date
- `{{DESCRIERE_OBLIGATIE}}` - Description of the obligation

### Payment Terms
- `{{TERMEN_PLATA}}` - Payment deadline (e.g., "15 zile")
- `{{CONT_BANCAR}}` - Bank account IBAN
- `{{BANCA}}` - Bank name

### Optional Variables
- `{{DOBANDA_INTARZIERE}}` - Late interest percentage
- `{{PENALITATI}}` - Contractual penalties

### Footer
- `{{DATA_EMITERE}}` - Issue date
- `{{LOCALITATE}}` - City/location

---

## Document Structure

```markdown
# SOMAȚIE DE PLATĂ

**De la:** {{CREDITOR_NUME}}
**CUI:** {{CREDITOR_CUI}}
**Sediu:** {{CREDITOR_SEDIU}}
**Reprezentant:** {{CREDITOR_REPREZENTANT}}

---

**Către:**
**{{DEBTOR_NUME}}**
**CNP/CUI:** {{DEBTOR_CNP_CUI}}
**Domiciliu/Sediu:** {{DEBTOR_DOMICILIU}}

---

## Obiectul Somației

Prin prezenta, vă somăm în mod formal să achitați suma datorată conform datelor de mai jos:

### Detalii Datorie

- **Suma datorată:** {{SUMA_DATORATA}} {{MONEDA}}
- **Temeiul juridic:** {{TEMEIUL_JURIDIC}}
- **Data scadentă:** {{DATA_SCADENTA}}
- **Descriere obligație:** {{DESCRIERE_OBLIGATIE}}

## Temeiul Legal

Potrivit prevederilor **Art. 1516** și **Art. 1535** din **Codul Civil**, sunteți obligat să achitați suma menționată mai sus.

## Punere în Întârziere

Prin prezenta somație, vă punem oficial în întârziere conform **Art. 1457 Cod Civil**.

## Modalitate de Plată

Vă solicităm să achitați suma în termen de **{{TERMEN_PLATA}}** de la primirea prezentei:

- **Cont IBAN:** {{CONT_BANCAR}}
- **Banca:** {{BANCA}}
- **Beneficiar:** {{CREDITOR_NUME}}

## Dobândă și Penalități

- **Dobândă de întârziere:** {{DOBANDA_INTARZIERE}}
- **Penalități contractuale:** {{PENALITATI}}

## Consecințe în Caz de Nerespectare

În cazul în care nu veți achita suma, vom fi nevoiți să ne adresăm instanței judecătorești competente pentru:
1. Recuperarea debitului principal
2. Dobânzi de întârziere
3. Penalități contractuale
4. Cheltuieli de judecată
5. Onorariul avocatului

---

**Data:** {{DATA_EMITERE}}
**Localitate:** {{LOCALITATE}}

**Creditor,**
**{{CREDITOR_REPREZENTANT}}**
```

---

## Standard Romanian Legal Clauses

1. "vă somăm în mod formal să achitați"
2. "în termen de {{TERMEN_PLATA}} de la primirea prezentei"
3. "sub sancțiunea declanșării procedurilor legale de recuperare"
4. "prin prezenta somație, vă punem oficial în întârziere"
5. "ne rezervăm dreptul de a solicita daune-interese"
6. "vor fi adăugate dobânzi legale și penalități"
7. "toate cheltuielile de judecată vor fi suportate de către dumneavoastră"

---

## Usage Notes

### When to Use
- Unpaid invoices after due date
- Breach of payment obligations
- Before initiating legal proceedings
- To establish official default date

### Legal Requirements
- Must clearly identify both parties
- Must specify exact amount and legal basis
- Should reference Civil Code articles
- Must set reasonable payment deadline

### Best Practices
- Send via registered mail with return receipt
- Keep proof of delivery
- Allow reasonable time for payment (minimum 15 days)
- Be specific about consequences
- Include bank details for easy payment

---

## Common Variations

### For Business Debt
- Reference commercial contracts
- Include VAT details if applicable
- Mention commercial register numbers

### For Personal Debt
- Use more formal but accessible language
- Reference loan agreements or court decisions
- Include CNP (personal identification number)

---

## Workflow Integration

After generating this document:
1. Review and customize for specific case
2. Obtain creditor's signature
3. Send via registered mail ("scrisoare recomandată cu confirmare de primire")
4. Track delivery and wait for payment deadline
5. If unpaid, proceed with legal action (cerere de chemare în judecată)

---

**Generated by:** Document Drafting Skill v1.1.0
**Template Version:** 1.0
**Last Updated:** 2025-11-19
