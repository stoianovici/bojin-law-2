/**
 * Sample Data Integration Tests
 * Story 2.12.1 - Task 6: Template Integration
 *
 * Tests template integration with realistic Romanian legal document data
 */

import { describe, it, expect } from '@jest/globals';
import { romanianDocumentGenerator } from './romanian-document-generator.service';

describe('Romanian Template Integration - Sample Data Tests', () => {
  describe('Notificare Avocateasca - Real-world scenarios', () => {
    it('should generate legal notice for payment demand', async () => {
      const result = await romanianDocumentGenerator.generateDocument({
        templateSlug: 'notificare-avocateasca',
        variables: {
          DESTINATAR_NUME: 'SC ALPHA CONSTRUCT SRL',
          DESTINATAR_ADRESA: 'Str. Constructorilor nr. 45, Sector 2, București, 023456',
          FIRMA_NUME: 'Cabinet Individual de Avocat Popescu & Asociații',
          FIRMA_CUI: 'RO23456789',
          FIRMA_ADRESA: 'Bd. Unirii nr. 12, etaj 5, Sector 3, București, 030825',
          AVOCAT_NUME: 'Av. Dr. Ion Popescu',
          BAROUL: 'Baroul București',
          AVOCAT_ADRESA: 'Bd. Unirii nr. 12, etaj 5, Sector 3, București, 030825',
          OBIECT_NOTIFICARE:
            'Recuperare creanță contractuală - Contract de prestări servicii nr. 234/2024',
          DATA_NOTIFICARE: '19 noiembrie 2025',
          DATA_FAPT: '15 martie 2024',
          DESCRIERE_FAPT:
            'La data de 15 martie 2024, între clientul nostru SC BETA SERVICES SRL și dumneavoastră s-a încheiat Contractul de prestări servicii nr. 234/2024, având ca obiect executarea lucrărilor de consultanță în IT. Conform clauzelor contractuale, plata avea termen la 30 de zile de la data facturării. Facturile nr. 145/2024 și nr. 167/2024, în valoare totală de 45.000 RON (inclusiv TVA), au rămas neachitate până în prezent, deși termenul de plată a expirat cu peste 180 de zile în urmă.',
          ACTIUNE_SOLICITATA:
            'Achitarea sumei totale de 45.000 RON reprezentând contravaloarea facturilor nr. 145/2024 și nr. 167/2024, împreună cu dobânda legală aferentă întârzierii calculate conform art. 1535 Cod Civil',
          TERMEN_CONFORMARE: '15',
          DATA_EMITERII: '19 noiembrie 2025',
        },
        format: 'markdown',
      });

      expect(result.success).toBe(true);
      expect(result.document).toContain('NOTIFICARE AVOCATEASCA');
      expect(result.document).toContain('SC ALPHA CONSTRUCT SRL');
      expect(result.document).toContain('45.000 RON');
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes('registered mail'))).toBe(true);
    });

    it('should generate cease and desist notice', async () => {
      const result = await romanianDocumentGenerator.generateDocument({
        templateSlug: 'notificare-avocateasca',
        variables: {
          DESTINATAR_NUME: 'GAMMA ADVERTISING SRL',
          DESTINATAR_ADRESA: 'Str. Reclamei nr. 78, Cluj-Napoca, 400123',
          FIRMA_NUME: 'Societatea de Avocatură Ionescu și Partenerii',
          FIRMA_CUI: 'RO34567890',
          FIRMA_ADRESA: 'Str. Eroilor nr. 23, Cluj-Napoca, 400129',
          AVOCAT_NUME: 'Av. Maria Ionescu',
          BAROUL: 'Baroul Cluj',
          AVOCAT_ADRESA: 'Str. Eroilor nr. 23, Cluj-Napoca, 400129',
          OBIECT_NOTIFICARE: 'Încetare utilizare abuzivă a mărcii comerciale înregistrate',
          DATA_NOTIFICARE: '19 noiembrie 2025',
          DATA_FAPT: '2025-10-01',
          DESCRIERE_FAPT:
            'Clientul nostru, SC DELTA TECH SRL, este titularul mărcii comerciale "TECHNO+" înregistrată la OSIM sub nr. M202400123. Am constatat că societatea dumneavoastră utilizează în mod neautorizat marca "TECHNO+" pe site-ul web www.gamma-ad.ro și în materialele publicitare distribuite în județul Cluj, creând confuzie în rândul consumatorilor și prejudiciind reputația clientului nostru.',
          ACTIUNE_SOLICITATA:
            'Încetarea imediată a utilizării mărcii "TECHNO+" în orice formă (online, print, TV, radio) și retragerea tuturor materialelor publicitare ce conțin această marcă',
          TERMEN_CONFORMARE: '7',
          DATA_EMITERII: '19 noiembrie 2025',
        },
      });

      expect(result.success).toBe(true);
      expect(result.document).toContain('TECHNO+');
      expect(result.document).toContain('7 zile');
    });
  });

  describe('Contract Vanzare-Cumparare - Real-world scenarios', () => {
    it('should generate real estate sales agreement', async () => {
      const result = await romanianDocumentGenerator.generateDocument({
        templateSlug: 'contract-vanzare-cumparare',
        variables: {
          VANZATOR_NUME: 'POPESCU ION',
          VANZATOR_TIP_PERSOANA: 'persoană fizică',
          VANZATOR_ADRESA: 'Str. Mihai Viteazu nr. 15, București, Sector 1',
          VANZATOR_IDENTIFICARE: 'CNP: 1750123456789, CI seria RX nr. 123456',
          CUMPARATOR_NUME: 'IONESCU MARIA',
          CUMPARATOR_TIP_PERSOANA: 'persoană fizică',
          CUMPARATOR_ADRESA: 'Bd. Magheru nr. 28, București, Sector 1',
          CUMPARATOR_IDENTIFICARE: 'CNP: 2850223456789, CI seria RX nr. 654321',
          NUMAR_CONTRACT: 'VC-2025-0042',
          DATA_CONTRACT: '19 noiembrie 2025',
          DESCRIERE_BUN:
            'Apartament cu 3 camere, situat în București, Sector 3, Str. Stefan cel Mare nr. 145, bl. A12, sc. 2, et. 4, ap. 23, având suprafața construită de 78 mp și suprafața utilă de 72 mp, compus din: living, 2 dormitoare, bucătărie, baie, hol, balcon.',
          CARACTERISTICI_BUN:
            '- An construcție: 2018\n- Compartimentare: 3 camere + bucătărie + baie\n- Etaj: 4 din 8\n- Suprafață construită: 78 mp\n- Suprafață utilă: 72 mp\n- Orientare: Est-Vest\n- Utilități: apă, gaz, electricitate, canalizare, internet\n- Dotări: centrală termică, aer condiționat, geamuri termopan',
          SITUATIE_JURIDICA:
            'Apartamentul este liber de sarcini, fără ipoteci, garanții reale sau datorii, conform Certificatului de Sarcini nr. 12345/2025 emis de Oficiul de Cadastru și Publicitate Imobiliară București.',
          PRET_TOTAL: '150.000',
          PRET_IN_LITERE: 'o sută cincizeci mii',
          MONEDA: 'EUR (echivalent RON la cursul BNR din ziua plății)',
          CLAUZA_TVA:
            'Vânzarea este scutită de TVA conform art. 292 alin. (1) lit. d) din Codul Fiscal.',
          INCLUZIUNI_PRET:
            'toate dotările fixe existente (bucătărie mobilată, aer condiționat, corpuri de iluminat)',
          MODALITATE_PLATA:
            '- Avans: 30.000 EUR la semnarea antecontractului\n- Tranșa 2: 50.000 EUR la autentificarea contractului\n- Sold: 70.000 EUR prin credit bancar, la maximum 30 zile de la autentificare',
          CLAUZA_AVANS:
            'Avansul de 30.000 EUR a fost achitat la data de 1 noiembrie 2025, conform chitanței nr. 001/2025.',
          CLAUZA_SOLD:
            'Soldul de 70.000 EUR se va achita prin virament bancar în contul IBAN: RO49AAAA1B31007593840000.',
          PENALITATE_PROCENT: '0.5',
          DATA_TRANSFER: '30 noiembrie 2025, sub condiția plății integrale',
          DATA_PREDARE: '5 decembrie 2025',
          LOC_PREDARE: 'la adresa imobilului',
          STARE_BUN: 'foarte bună, conform vizitei efectuate de cumpărător',
          DECLARATII_SUPLIMENTARE_VANZATOR:
            'e) Apartamentul nu face obiectul unui proces de retrocedare;\nf) Nu există debite restante la asociația de proprietari.',
          DECLARATII_SUPLIMENTARE_CUMPARATOR:
            'c) A obținut aprobarea preliminară pentru creditul ipotecar de la Banca XYZ.',
          TERMEN_VICII: '30',
          PREAVIZ_REZILIERE: '15',
          INSTANTA_COMPETENTA: 'București, Sector 3',
          NUMAR_EXEMPLARE: '4',
          CLAUZE_SPECIALE:
            '**Clauza anticronică:** Vânzătorul garantează că va preda apartamentul liber de orice ocupanți.\n\n**Clauza de acces:** Cumpărătorul are dreptul de a efectua o inspecție finală cu 48 ore înainte de data predării.',
          VANZATOR_REPREZENTANT: 'în nume propriu',
          CUMPARATOR_REPREZENTANT: 'în nume propriu',
          DATA_SEMNARE: '19 noiembrie 2025',
        },
      });

      expect(result.success).toBe(true);
      expect(result.document).toContain('CONTRACT DE VANZARE-CUMPARARE');
      expect(result.document).toContain('Apartament cu 3 camere');
      expect(result.document).toContain('150.000');
      expect(result.document).toContain('Stefan cel Mare');
    });

    it('should generate vehicle sales agreement', async () => {
      const result = await romanianDocumentGenerator.generateDocument({
        templateSlug: 'contract-vanzare-cumparare',
        variables: {
          VANZATOR_NUME: 'AUTO TRADE SRL',
          VANZATOR_TIP_PERSOANA: 'persoană juridică',
          VANZATOR_ADRESA: 'Str. Industriei nr. 67, Timișoara, 300001',
          VANZATOR_IDENTIFICARE: 'CUI: RO12345678, J35/123/2015',
          VANZATOR_REPREZENTANT: 'Director General Gheorghe Popa',
          CUMPARATOR_NUME: 'VASILE MIHAI',
          CUMPARATOR_TIP_PERSOANA: 'persoană fizică',
          CUMPARATOR_ADRESA: 'Str. Libertății nr. 34, Timișoara, 300002',
          CUMPARATOR_IDENTIFICARE: 'CNP: 1800123456789, CI seria TM nr. 456789',
          CUMPARATOR_REPREZENTANT: 'în nume propriu',
          NUMAR_CONTRACT: 'AUTO-2025-156',
          DATA_CONTRACT: '19 noiembrie 2025',
          DESCRIERE_BUN:
            'Autoturism VOLKSWAGEN GOLF, model 2020, culoare gri metalizat, număr de înmatriculare TM-12-ABC, seria șasiu WVWZZZ1KZCW123456, seria motor CBA654321, capacitate cilindrică 1.6 TDI, 115 CP.',
          CARACTERISTICI_BUN:
            '- Kilometraj: 65.000 km\n- Combustibil: Motorină\n- Transmisie: Manuală, 6 trepte\n- Număr de uși: 5\n- Culoare: Gri metalizat\n- Dotări: climatizare automată, sistem navigație, senzori parcare, Bluetooth',
          SITUATIE_JURIDICA:
            'Autoturismul este liber de sarcini, conform Certificatului de Înmatriculare seria TM nr. 123456 și nu face obiectul vreunui litigiu.',
          PRET_TOTAL: '95.000',
          PRET_IN_LITERE: 'nouăzeci și cinci mii',
          MONEDA: 'RON',
          CLAUZA_TVA: 'Prețul include TVA 19%.',
          INCLUZIUNI_PRET: 'anvelopele de iarnă, kit-ul de urgență și scaunul copil',
          MODALITATE_PLATA: 'Plata integrală în numerar la predarea autovehiculului',
          PENALITATE_PROCENT: '0.1',
          DATA_TRANSFER: '19 noiembrie 2025',
          DATA_PREDARE: '19 noiembrie 2025',
          LOC_PREDARE: 'sediul AUTO TRADE SRL din Timișoara, Str. Industriei nr. 67',
          STARE_BUN: 'foarte bună, verificată mecanic',
          TERMEN_VICII: '14',
          PREAVIZ_REZILIERE: '7',
          INSTANTA_COMPETENTA: 'Timișoara',
          NUMAR_EXEMPLARE: '3',
          DATA_SEMNARE: '19 noiembrie 2025',
        },
      });

      expect(result.success).toBe(true);
      expect(result.document).toContain('VOLKSWAGEN GOLF');
      expect(result.document).toContain('TM-12-ABC');
      expect(result.document).toContain('95.000');
    });
  });

  describe('Intampinare - Real-world scenarios', () => {
    it('should generate statement of defense for contract dispute', async () => {
      const result = await romanianDocumentGenerator.generateDocument({
        templateSlug: 'intampinare',
        variables: {
          INSTANTA_NUME: 'Tribunalul București, Secția a IV-a Civilă',
          INSTANTA_ADRESA: 'Bd. Unirii nr. 37, Sector 3, București',
          NUMAR_DOSAR: '12345/3/2025',
          DATA_DEPUNERE: '19 noiembrie 2025',
          PARAT_NUME: 'SC CONSTRUCT PLUS SRL',
          PARAT_TIP_PERSOANA: 'persoană juridică',
          PARAT_ADRESA: 'Str. Constructorilor nr. 12, Sector 2, București',
          PARAT_IDENTIFICARE: 'CUI: RO23456789, J40/1234/2018',
          RECLAMANT_NUME: 'SC MEGA INVEST SA',
          RECLAMANT_TIP_PERSOANA: 'persoană juridică',
          RECLAMANT_ADRESA: 'Bd. Victoriei nr. 45, Sector 1, București',
          RECLAMANT_IDENTIFICARE: 'CUI: RO34567890, J40/5678/2015',
          AVOCAT_PARAT_NUME: 'Av. Dr. Elena Munteanu',
          BAROU_PARAT: 'București',
          AVOCAT_PARAT_ADRESA: 'Str. Avocaților nr. 8, Sector 1, București',
          OBIECT_ACTIUNE:
            'Rezilierea Contractului de execuție lucrări nr. 234/2024 și obligarea la plata daunelor-interese',
          DATA_CERERE: '15 octombrie 2025',
          REZUMAT_CERERE_RECLAMANT:
            'Reclamantul solicită: (i) rezilierea Contractului de execuție lucrări nr. 234/2024; (ii) obligarea pârâtului la plata sumei de 500.000 RON cu titlu de daune-interese; (iii) obligarea pârâtului la restituirea avansului de 200.000 RON; (iv) cheltuieli de judecată.',
          VALOARE_CERERE: '700.000 RON',
          TIP_RESPINGERE: 'nefondată și neîntemeiată',
          EXPUNERE_FAPT_PARAT:
            'Contractul de execuție lucrări nr. 234/2024 a fost încheiat la data de 1 martie 2024 pentru executarea lucrărilor de construire a unui complex rezidențial. Pârâtul și-a îndeplinit în totalitate obligațiile contractuale, executând lucrările conform proiectului tehnic și predând toate etapele intermediate la termenele stabilite. Întârzierea pretinsă de reclamant de 45 de zile se datorează exclusiv modificărilor solicitate de beneficiar prin 12 acte adiționale succesive, care au extins semnificativ volumul de lucrări și au modificat planificarea inițială. Toate aceste modificări au fost solicitate în scris de către reclamant și acceptate de pârât prin încheierea de acte adiționale la contract.',
          ARGUMENT_1:
            'Pârâtul și-a executat integral obligațiile contractuale, lucrările fiind recepționate parțial în proporție de 85% fără rezerve. Procesele-verbale de recepție parțială nr. 1-8/2024 confirmă calitatea execuției și respectarea termenelor ajustate prin actele adiționale.',
          TEMEI_LEGAL_1:
            'Art. 1270 și art. 1530 Cod Civil - buna-credință în executarea contractelor',
          ARGUMENT_2:
            'Întârzierea invocată de reclamant este consecința directă și exclusivă a modificărilor solicitate de acesta prin cele 12 acte adiționale, care au majorat valoarea contractului cu 35% și au extins termenul de execuție conform art. 8 din contractul-cadru.',
          TEMEI_LEGAL_2:
            'Art. 1351 Cod Civil - forța majoră și cazul fortuit; Art. 1555 Cod Civil - fapta creditorului',
          ARGUMENT_3:
            'Sumele solicitate cu titlu de daune-interese nu au nicio justificare, reclamantul nereușind să probeze existența unui prejudiciu real și cert. Mai mult, pârâtul a investit resurse suplimentare de 150.000 RON pentru adaptarea la modificările solicitate de beneficiar.',
          TEMEI_LEGAL_3:
            'Art. 1531 și 1532 Cod Civil - dovada prejudiciului; Art. 1385-1395 Cod Civil - răspunderea contractuală',
          INSCRIS_1:
            'Contract de execuție lucrări nr. 234/2024 și toate cele 12 acte adiționale (A1-234/2024 până la A12-234/2024)',
          INSCRIS_2: 'Procese-verbale de recepție parțială nr. 1-8/2024',
          INSCRIS_3:
            'Corespondență email cu solicitările de modificări ale beneficiarului (martie-septembrie 2024)',
          INSCRISURI_SUPLIMENTARE:
            '4. Rapoarte tehnice de avansare a lucrărilor (lunare)\n5. Facturile emise și achitate integral de beneficiar\n6. Autorizație de construire nr. 123/2024\n7. Poliță de asigurare pentru răspundere civilă profesională',
          CERERE_PRINCIPALA:
            'Respingerea în totalitate a cererii de chemare în judecată ca nefondată și neîntemeiată',
          ONORARIU_AVOCAT: '15.000 RON',
          ART_PROC_CIV_1: '155',
          DESCRIERE_ART_1: 'Întâmpinarea - formă și conținut',
          ART_PROC_CIV_2: '204',
          DESCRIERE_ART_2: 'Cererea reconvențională',
          ART_COD_CIVIL_1: '1270',
          DESCRIERE_CIVIL_1: 'Buna-credință în executarea contractelor',
          ART_COD_CIVIL_2: '1530',
          DESCRIERE_CIVIL_2: 'Executarea obligațiilor contractuale',
          ANEXA_1: 'Contract nr. 234/2024 + 12 acte adiționale (85 pagini)',
          ANEXA_2: 'Procese-verbale recepție parțială nr. 1-8/2024 (32 pagini)',
          ANEXA_3: 'Dosar corespondență email (147 pagini)',
          ANEXE_SUPLIMENTARE:
            '4. Rapoarte tehnice lunare martie-septembrie 2024 (78 pagini)\n5. Factură și chitanțe plată (23 pagini)\n6. Autorizație construire + documentație tehnică (156 pagini)',
          NUMAR_ANEXE: '6 dosare, total 521 pagini',
          DATA_SEMNARE: '19 noiembrie 2025',
        },
      });

      expect(result.success).toBe(true);
      expect(result.document).toContain('ÎNTÂMPINARE');
      expect(result.document).toContain('Tribunalul București');
      expect(result.document).toContain('SC CONSTRUCT PLUS SRL');
      expect(result.document).toContain('700.000 RON');
      expect(result.document).toContain('Art. 1270');
    });
  });

  describe('Template list and search', () => {
    it('should list all available templates with metadata', () => {
      const templates = romanianDocumentGenerator.getAvailableTemplates();

      expect(templates).toHaveLength(5);
      expect(templates[0].metadata.nameRo).toBeDefined();
      expect(templates[0].metadata.nameEn).toBeDefined();
      expect(templates[0].metadata.legalCategory).toBeDefined();
    });

    it('should search templates by legal category', () => {
      const correspondenceTemplates = romanianDocumentGenerator.searchTemplates({
        category: 'correspondence',
      });

      expect(correspondenceTemplates.length).toBeGreaterThan(0);
      correspondenceTemplates.forEach((t) => {
        expect(t.metadata.legalCategory).toBe('correspondence');
      });
    });
  });

  describe('Time savings estimation', () => {
    it('should estimate realistic time savings for each template', () => {
      const templates = [
        'notificare-avocateasca',
        'contract-vanzare-cumparare',
        'intampinare',
      ] as const;

      templates.forEach((slug) => {
        const estimate = romanianDocumentGenerator.estimateTimeSavings(slug);

        expect(estimate.manualDraftingTime).toBeDefined();
        expect(estimate.templateTime).toBe('10 minutes');
        expect(estimate.savings).toContain('%');

        // Verify that savings are positive
        expect(estimate.savings).toMatch(/\d+%/);
      });
    });
  });
});
