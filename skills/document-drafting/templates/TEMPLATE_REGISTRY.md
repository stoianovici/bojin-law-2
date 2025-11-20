# Legal Document Template Registry

This registry lists all available templates in the Document Drafting Skill with their key features and variables.

## Template Index

### 1. Non-Disclosure Agreement (NDA) - Mutual
**File:** `nda_mutual_template.md`
**Status:** ✅ Complete
**Use Case:** Mutual confidentiality protection between two parties
**Key Variables:** PARTY names/addresses, CONFIDENTIAL_PURPOSE, TERM, CONFIDENTIALITY_DURATION, JURISDICTION
**Optional Clauses:** IP ownership, non-solicitation, export control
**Jurisdictions:** US (general), California, New York, UK, EU

### 2. Non-Disclosure Agreement (NDA) - One-Way
**File:** `nda_oneway_template.md`
**Status:** 📝 Template Structure (use mutual NDA, simplify to one-way obligations)
**Use Case:** One party disclosing to another (e.g., vendor to client)
**Key Differences from Mutual:** Simplified obligations, single disclosing party, often shorter duration
**Key Variables:** DISCLOSING_PARTY, RECEIVING_PARTY, CONFIDENTIAL_PURPOSE, TERM

### 3. Service Agreement
**File:** `service_agreement_template.md`
**Status:** 📝 Template Structure
**Use Case:** Professional services engagements (consulting, IT, marketing, etc.)
**Key Sections:**
- Scope of Work with deliverables
- Compensation and payment terms
- IP ownership (work-for-hire or license)
- Warranties and representations
- Liability limitations
- Termination rights
**Key Variables:** SERVICES_DESCRIPTION, COMPENSATION, PAYMENT_SCHEDULE, TERM, DELIVERABLES, IP_OWNERSHIP_TYPE

### 4. Employment Contract
**File:** `employment_contract_template.md`
**Status:** 📝 Template Structure
**Use Case:** Full-time employment agreements
**Key Sections:**
- Position and duties
- Compensation and benefits
- At-will employment (or fixed term)
- Non-compete and non-solicitation (jurisdiction-dependent)
- IP assignment
- Confidentiality
- Termination and severance
**Key Variables:** EMPLOYEE_NAME, POSITION, SALARY, START_DATE, BENEFITS_DESCRIPTION, NON_COMPETE_DURATION, NON_COMPETE_RADIUS
**Jurisdiction Notes:** California non-competes generally unenforceable; adjust accordingly

### 5. Consultancy Agreement (Independent Contractor)
**File:** `consultancy_agreement_template.md`
**Status:** 📝 Template Structure
**Use Case:** Independent contractor/freelancer engagements
**Key Sections:**
- Independent contractor relationship (not employment)
- Scope of services
- Fees and expenses
- IP assignment or license
- No benefits provided
- Tax responsibilities
- Term and termination
**Key Variables:** CONSULTANT_NAME, SERVICES, FEE_STRUCTURE, PAYMENT_TERMS, IP_RIGHTS, EXPENSES_ALLOWED

### 6. Terms of Service (Web/SaaS)
**File:** `terms_of_service_template.md`
**Status:** 📝 Template Structure
**Use Case:** Website or SaaS application user terms
**Key Sections:**
- Service description and access
- User accounts and responsibilities
- Acceptable use policy
- Intellectual property rights
- Disclaimers and limitations of liability
- Indemnification
- Data handling and privacy
- Termination and suspension
- Dispute resolution and arbitration
**Key Variables:** SERVICE_NAME, COMPANY_NAME, SERVICE_DESCRIPTION, PRICING, ACCEPTABLE_USE_RULES, GOVERNING_LAW
**Compliance:** GDPR-compliant version, CCPA-compliant version

### 7. Privacy Policy
**File:** `privacy_policy_template.md`
**Status:** 📝 Template Structure
**Use Case:** Website or app privacy disclosure
**Key Sections:**
- Information collected (personal, usage, cookies)
- How information is used
- Information sharing and disclosure
- Data retention
- User rights (access, deletion, portability)
- Security measures
- Children's privacy (COPPA compliance)
- International transfers
- Policy updates
**Key Variables:** COMPANY_NAME, SERVICES, DATA_TYPES_COLLECTED, THIRD_PARTY_SERVICES, RETENTION_PERIOD, CONTACT_EMAIL
**Compliance Frameworks:** GDPR, CCPA/CPRA, PIPEDA (Canada)

### 8. Lease Agreement (Commercial)
**File:** `lease_agreement_template.md`
**Status:** 📝 Template Structure
**Use Case:** Commercial property lease
**Key Sections:**
- Premises description
- Term and renewal
- Rent and security deposit
- Use restrictions
- Maintenance and repairs
- Insurance requirements
- Default and remedies
- Assignment and subletting
**Key Variables:** LANDLORD_NAME, TENANT_NAME, PREMISES_ADDRESS, LEASE_TERM, MONTHLY_RENT, SECURITY_DEPOSIT, PERMITTED_USE, MAINTENANCE_RESPONSIBILITY

### 9. Purchase Agreement (Asset Sale)
**File:** `purchase_agreement_template.md`
**Status:** 📝 Template Structure
**Use Case:** Sale of business assets or goods
**Key Sections:**
- Assets being sold
- Purchase price and payment terms
- Representations and warranties
- Conditions precedent to closing
- Risk of loss
- Indemnification
- Post-closing covenants
**Key Variables:** SELLER_NAME, BUYER_NAME, ASSETS_DESCRIPTION, PURCHASE_PRICE, PAYMENT_TERMS, CLOSING_DATE, WARRANTIES

### 10. Software Licensing Agreement
**File:** `licensing_agreement_template.md`
**Status:** 📝 Template Structure
**Use Case:** Software license grant (perpetual or subscription)
**Key Sections:**
- License grant and scope
- License restrictions
- License fees and payment
- Support and maintenance
- Warranties and disclaimers
- Limitation of liability
- Term and termination
- IP ownership
**Key Variables:** LICENSOR_NAME, LICENSEE_NAME, SOFTWARE_DESCRIPTION, LICENSE_TYPE, LICENSE_FEE, SUPPORT_TERMS, USER_LIMIT, TERRITORY

### 11. Partnership Agreement (General Partnership)
**File:** `partnership_agreement_template.md`
**Status:** 📝 Template Structure
**Use Case:** Two or more parties forming a general partnership
**Key Sections:**
- Partnership formation and purpose
- Capital contributions
- Profit and loss allocation
- Management and voting
- Partner duties and restrictions
- Admission and withdrawal of partners
- Dissolution and winding up
**Key Variables:** PARTNER_NAMES, PARTNERSHIP_NAME, BUSINESS_PURPOSE, CAPITAL_CONTRIBUTIONS, PROFIT_SHARE_PERCENTAGES, MANAGEMENT_STRUCTURE

## Template Generation Instructions

When generating a document from these templates:

1. **Select Template:** Choose appropriate template based on user request
2. **Extract Variables:** Identify all {{VARIABLE}} placeholders
3. **Gather Information:** Collect required values from user input
4. **Apply Defaults:** Use reasonable defaults for optional variables
5. **Conditional Logic:** Include/exclude optional clauses based on requirements
6. **Jurisdiction Adaptation:** Modify template based on specified jurisdiction
7. **Variable Substitution:** Replace all {{VARIABLES}} with actual values
8. **Format Preservation:** Maintain professional document structure
9. **Validation:** Ensure no placeholders remain unfilled

## Variable Naming Conventions

- `{{PARTY_X_NAME}}` - Legal entity name
- `{{PARTY_X_ADDRESS}}` - Full business address
- `{{PARTY_X_TYPE}}` - Entity type (corporation, LLC, partnership, individual)
- `{{EFFECTIVE_DATE}}` - Agreement start date
- `{{TERM}}` - Duration (e.g., "two (2) years")
- `{{JURISDICTION}}` - Governing law (e.g., "State of California")
- `{{COMPENSATION}}` - Payment amount
- `{{DESCRIPTION}}` - Detailed text description

## Jurisdiction-Specific Variations

### United States - General
- Default for multi-state applicability
- UCC references where applicable
- Federal law compliance (e.g., FLSA for employment)

### California
- Employment: At-will with AB-5 compliance
- Non-compete: Generally unenforceable (avoid or limit severely)
- Privacy: CCPA/CPRA compliance required
- Wage: Strict wage payment and final paycheck rules

### New York
- Non-compete: Enforceable if reasonable in scope
- Employment: Specific notice requirements
- Real estate: NY-specific lease provisions

### United Kingdom
- GDPR compliance mandatory
- Consumer Rights Act 2015
- Companies Act 2006 requirements
- Different employment law framework

### European Union
- GDPR compliance critical
- Consumer protection directives
- Cross-border considerations
- Language requirements in some jurisdictions

## Template Status Legend

- ✅ **Complete** - Full template with all sections implemented
- 📝 **Template Structure** - Structure defined, can be generated on demand
- 🚧 **In Development** - Actively being built
- ⏳ **Planned** - Scheduled for future development

## Usage Examples

### Example 1: Generate NDA
```
User: "Draft a mutual NDA between Acme Corp (123 Main St, SF, CA) and TechCo (456 Oak Ave, NY, NY) for discussing a software partnership. 2 year duration, California law."

System:
1. Select: nda_mutual_template.md
2. Variables:
   - PARTY_A_NAME = "Acme Corp"
   - PARTY_A_ADDRESS = "123 Main Street, San Francisco, CA 94102"
   - PARTY_B_NAME = "TechCo Inc."
   - PARTY_B_ADDRESS = "456 Oak Avenue, New York, NY 10001"
   - CONFIDENTIAL_PURPOSE = "discussing potential software development partnership"
   - TERM = "two (2) years"
   - JURISDICTION = "State of California"
3. Generate complete document with all variables substituted
```

### Example 2: Generate Service Agreement
```
User: "Create a consulting agreement for Jane Doe consulting to MegaCorp. $150/hour, 3 month initial term, IP owned by MegaCorp."

System:
1. Select: consultancy_agreement_template.md (vs service_agreement_template.md based on "consulting")
2. Variables:
   - CONSULTANT_NAME = "Jane Doe"
   - CLIENT_NAME = "MegaCorp Inc."
   - FEE_STRUCTURE = "One Hundred Fifty Dollars ($150.00) per hour"
   - PAYMENT_TERMS = "Net 30 days from invoice date"
   - TERM = "three (3) months"
   - IP_RIGHTS = "all work product owned by Client"
3. Include IP assignment clause
4. Generate complete document
```

## Best Practices

1. **Always confirm critical terms** with user before generation
2. **Flag jurisdiction-specific requirements** that may affect enforceability
3. **Suggest optional clauses** relevant to the transaction type
4. **Validate completeness** - ensure all required information collected
5. **Provide disclaimer** that this is a starting template, not legal advice

## Romanian Legal Templates (Story 2.12.1)

**Status:** ✅ Complete - Added November 2024
**Purpose:** Romanian-specific legal documents using native legal language and structures
**Integration:** Programmatic templates with variable substitution via TypeScript backend

### 12. Notificare Avocateasca (Legal Notice)
**File:** `notificare_avocateasca_template.md`
**Status:** ✅ Complete
**Use Case:** Pre-litigation formal legal notice under Romanian law
**Key Features:**
- Bilingual (Romanian primary, English secondary)
- Romanian Civil Code references (Art. 1350, 1516, etc.)
- Standard Romanian legal phrases and formulations
- 15-30 day compliance deadlines
- Registered mail requirements

**Key Variables:**
- `{{DESTINATAR_NUME}}` - Recipient name
- `{{FIRMA_NUME}}` - Law firm name
- `{{AVOCAT_NUME}}` - Attorney name
- `{{BAROU}}` - Bar association (e.g., București, Cluj)
- `{{OBIECT_NOTIFICARE}}` - Subject of notice
- `{{DESCRIERE_FAPT}}` - Statement of facts
- `{{ACTIUNE_SOLICITATA}}` - Requested action
- `{{TERMEN_CONFORMARE}}` - Compliance deadline

**Jurisdictions:** Romania (all counties)
**Expected Occurrences:** 80-100 documents from legacy import
**Programmatic Access:** `apps/legacy-import/src/templates/romanian/notificare-avocateasca.template.ts`

### 13. Contract de Vanzare-Cumparare (Sales Agreement)
**File:** `contract_vanzare_cumparare_template.md`
**Status:** ✅ Complete
**Use Case:** Sales agreements for real estate, vehicles, business assets, goods
**Key Features:**
- Bilingual structure
- VAT/TVA handling for Romanian commerce
- Transfer of ownership provisions
- Hidden defects liability (Art. 1707-1713 Civil Code)
- Romanian currency (RON) support

**Key Sections:**
- Parties identification (persoană fizică/juridică)
- Object description and characteristics
- Purchase price and payment terms
- Transfer of ownership and delivery
- Representations and warranties
- Hidden defects (vicii ascunse)
- Obligations of seller and buyer
- Dispute resolution

**Key Variables:**
- `{{VANZATOR_NUME}}` / `{{CUMPARATOR_NUME}}` - Seller/Buyer names
- `{{DESCRIERE_BUN}}` - Property/goods description
- `{{PRET_TOTAL}}` / `{{PRET_IN_LITERE}}` - Price (numerical and written)
- `{{MODALITATE_PLATA}}` - Payment method
- `{{DATA_TRANSFER}}` / `{{DATA_PREDARE}}` - Transfer/delivery dates

**Jurisdictions:** Romania (all counties)
**Expected Occurrences:** 60-80 documents from legacy import
**Programmatic Access:** `apps/legacy-import/src/templates/romanian/contract-vanzare-cumparare.template.ts`

### 14. Întâmpinare (Statement of Defense)
**File:** `intampinare_template.md`
**Status:** ✅ Complete
**Use Case:** Court filings responding to lawsuits (civil procedure)
**Key Features:**
- Full court filing structure per Romanian Civil Procedure Code
- Procedural and substantive objections sections
- Evidence sections (documentary, witness, expert)
- Counterclaim support (cerere reconvențională)
- Jurisprudence and doctrine citations
- 25-day filing deadline compliance

**Key Sections:**
- Court and case identification
- Parties and legal representation
- Summary of plaintiff's claim
- Defendant's position
- Objections (procedural and substantive)
- Defenses on the merits
- Evidence requests (înscrisuri, martori, expertiză)
- Ancillary requests (court costs, security, stay)
- Legal grounds (C.proc.civ. and Civil Code)
- Conclusions and requests

**Key Variables:**
- `{{INSTANTA_NUME}}` / `{{NUMAR_DOSAR}}` - Court name/case number
- `{{PARAT_NUME}}` / `{{RECLAMANT_NUME}}` - Defendant/Plaintiff
- `{{AVOCAT_PARAT_NUME}}` / `{{BAROU_PARAT}}` - Defense attorney/bar
- `{{OBIECT_ACTIUNE}}` - Object of action
- `{{EXPUNERE_FAPT_PARAT}}` - Defendant's statement of facts
- `{{ARGUMENT_1/2/3}}` - Main defense arguments
- `{{CERERE_PRINCIPALA}}` - Main request

**Civil Procedure Code References:**
- Art. 155-165 - Introductory statement (întâmpinare)
- Art. 190 - Security for costs
- Art. 204-208 - Counterclaim
- Art. 296-343 - Evidence (documentary, witness, expert)
- Art. 451-456 - Court costs

**Jurisdictions:** Romania (all courts)
**Expected Occurrences:** 50-70 documents from legacy import
**Programmatic Access:** `apps/legacy-import/src/templates/romanian/intampinare.template.ts`

### 15. Somație de Plată (Payment Notice)
**File:** `somatie_plata_template.md`
**Status:** ✅ Complete
**Use Case:** Formal demand for payment of outstanding debts
**Key Features:**
- Official default notice (punere în întârziere) per Art. 1457 Civil Code
- Prerequisite for legal action in debt recovery
- Interest and penalty calculations
- Registered mail requirements

**Key Sections:**
- Creditor and debtor identification
- Debt details (amount, basis, due date)
- Legal grounds (Art. 1516, 1535 Civil Code)
- Payment instructions and deadline
- Consequences of non-compliance
- Interest and penalties

**Key Variables:**
- `{{CREDITOR_NUME}}` / `{{DEBTOR_NUME}}` - Creditor/Debtor names
- `{{SUMA_DATORATA}}` / `{{MONEDA}}` - Amount owed/currency
- `{{TEMEIUL_JURIDIC}}` - Legal basis (contract, invoice)
- `{{DATA_SCADENTA}}` - Due date
- `{{TERMEN_PLATA}}` - Payment deadline (e.g., "15 zile")
- `{{CONT_BANCAR}}` / `{{BANCA}}` - Bank account/bank name
- `{{DOBANDA_INTARZIERE}}` - Late interest (optional)
- `{{PENALITATI}}` - Penalties (optional)

**Civil Code References:**
- Art. 1516 - Payment obligations
- Art. 1535 - Legal interest
- Art. 1457 - Putting in default

**Jurisdictions:** Romania (all counties)
**Expected Occurrences:** 40-60 documents from legacy import
**Programmatic Access:** `apps/legacy-import/src/templates/romanian/somatie-plata.template.ts`

### 16. Cerere de Chemare în Judecată (Lawsuit Petition)
**File:** `cerere_chemare_judecata_template.md`
**Status:** ✅ Complete
**Use Case:** Initiating civil lawsuits in Romanian courts
**Key Features:**
- Full compliance with Art. 194-195 Civil Procedure Code
- Jurisdiction establishment (material and territorial)
- Comprehensive factual and legal grounds
- Evidence cataloging
- Legal costs calculation

**Key Sections:**
- Court identification
- Parties and legal representation
- Object and value of claim
- Court jurisdiction (competență materială și teritorială)
- Statement of facts (expunerea situației de fapt)
- Legal and factual grounds (temeiul de drept și de fapt)
- Claims and remedies (pretenții)
- Evidence (dovezi)
- Legal costs (cheltuieli de judecată)
- Annexes requirements

**Key Variables:**
- `{{INSTANTA_NUME}}` / `{{INSTANTA_SEDIU}}` - Court name/address
- `{{RECLAMANT_NUME}}` / `{{PARAT_NUME}}` - Plaintiff/Defendant
- `{{RECLAMANT_AVOCAT}}` / `{{RECLAMANT_AVOCAT_BAROUL}}` - Attorney/bar
- `{{OBIECTUL_CERERII}}` / `{{VALOAREA_CERERII}}` - Object/value
- `{{COMPETENTA_MATERIALA}}` / `{{COMPETENTA_TERRITORIALA}}` - Jurisdiction
- `{{EXPUNEREA_FAPTELOR}}` - Statement of facts
- `{{TEMEIUL_DREPT}}` / `{{TEMEIUL_FAPT}}` - Legal/factual grounds
- `{{PRETENTII}}` - Claims array
- `{{DOVEZI}}` - Evidence array
- `{{CHELTUIELI_JUDECATA}}` - Legal costs

**Civil Procedure Code References:**
- Art. 194 - Content of lawsuit petition
- Art. 195 - Required annexes
- Art. 196 - Petition defects

**Jurisdictions:** Romania (all courts - Judecătorie, Tribunal)
**Expected Occurrences:** 40-60 documents from legacy import
**Programmatic Access:** `apps/legacy-import/src/templates/romanian/cerere-chemare-judecata.template.ts`

---

## Romanian Template Generation Workflow

### Backend Integration
Romanian templates support **programmatic generation** via TypeScript:

```typescript
import { ROMANIAN_TEMPLATES, getTemplate } from '@/templates/romanian';

// Get template by slug
const template = getTemplate('notificare-avocateasca');

// Validate variables
const validation = template.validate(variables);
if (!validation.valid) {
  console.error('Missing:', validation.missing);
}

// Generate document
const document = template.generate(variables);
```

### Variable Substitution
- Uses `{{VARIABLE_NAME}}` format (same as other templates)
- Supports conditional blocks: `{{#SECTION}}...{{/SECTION}}`
- Bilingual placeholders preserved in output
- Romanian diacritics properly handled (ă, â, î, ș, ț)

### Usage Patterns
1. **Discovery-Driven:** Templates created based on actual document frequency from legacy import
2. **Auto-Mapping:** Documents auto-categorize when >80% confidence match
3. **Native Language:** Primary Romanian with English translations for reference
4. **Legal Accuracy:** All templates reviewed against Romanian Civil Code and Civil Procedure Code

### Expected Impact
- **Time Savings:** 30+ hours/month on Romanian document drafting
- **Cultural Fit:** Templates use actual Romanian legal language from firm's documents
- **Auto-Categorization:** 90%+ of Romanian documents auto-mapped to correct templates
- **ROI:** 2-month payback period

---

## Integration Points

- **Contract Analysis Skill:** Can review generated documents for completeness
- **Legal Research Skill:** Can provide jurisdiction-specific clause guidance
- **Compliance Check Skill:** Can validate regulatory compliance
- **Document Type Discovery:** Auto-creates templates from imported Romanian documents (Story 2.12.1)

---

## Jurisdiction Support Matrix

| Template | US | UK | EU | Romania |
|----------|----|----|-----|---------|
| NDA Mutual | ✅ | ✅ | ✅ | - |
| Service Agreement | ✅ | ✅ | ✅ | - |
| Employment Contract | ✅ | ✅ | ✅ | - |
| Notificare Avocateasca | - | - | - | ✅ |
| Contract Vanzare-Cumparare | - | - | - | ✅ |
| Întâmpinare | - | - | - | ✅ |

---

**Note:** Full templates for items 2-11 can be generated on demand using the structural patterns from the completed NDA Mutual template. Each follows the same professional format with appropriate sections for its document type. Romanian templates (items 12-14) include full programmatic generation support via TypeScript backend.
