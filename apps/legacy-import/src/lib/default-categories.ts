/**
 * Default contract categories for document classification
 * These are seeded when a new import session starts
 */

export const DEFAULT_CATEGORIES = [
  // Vânzare
  'Vânzare imobile',
  'Vânzare bunuri mobile identificate (utilaje, etc)',
  'Vânzare bunuri mobile marfă',

  // Furnizare
  'Furnizare',

  // Închiriere
  'Închiriere rezidențial (apartament)',
  'Închiriere industrial (hale)',
  'Închiriere birouri (sediu, punct de lucru)',

  // Comodat / Împrumut
  'Comodat',
  'Împrumut / finanțare (nebancar)',
  'Împrumut bancar',

  // Construcții / Management
  'Antrepriză construcții',
  'Management',

  // Cesiuni
  'Cesiune părți sociale',
  'Cesiune acțiuni',
  'Cesiune finanțare',
  'Cesiune creanță',
  'Cesiune contract',

  // Acte constitutive
  'Act constitutiv SRL',
  'Act constitutiv SA',

  // Garanții
  'Ipotecă mobiliară',
  'Ipotecă imobiliară',

  // Mandat / Intermediere
  'Mandat / comision / agenție / intermediere',

  // Prestări servicii
  'Producție / prestări servicii',
  'Prestări servicii muncă',

  // Agricol
  'Arendă',

  // Asociere
  'Asociere în participațiune (joint venture)',

  // Transport
  'Transport marfă / expediție',
  'Transport persoane',

  // Asigurare / Depozit
  'Asigurare',
  'Depozit',

  // Întreținere / Rentă
  'Întreținere',
  'Rentă viageră',

  // Tranzacție / Garanții personale
  'Tranzacție',
  'Fideiusiune',
] as const;

export type DefaultCategory = (typeof DEFAULT_CATEGORIES)[number];
