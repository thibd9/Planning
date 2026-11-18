import type { AppData, Person, Qualification } from './types';

/**
 * Ce qui distingue l'espace de chaque profil : les familles de produits (marques d'un animateur,
 * rayons d'un rayonniste), les sujets de rendez-vous, et la phrase qui dit à quoi sert l'espace.
 */

export type TypeProduit = 'dermocosmetique' | 'solaire' | 'capillaire' | 'hygiene' | 'bebe' | 'bucco' | 'complements' | 'phyto' | 'nutrition' | 'orthopedie' | 'materiel' | 'veterinaire';

export const TYPE_PRODUIT_LABEL: Record<TypeProduit, string> = {
  dermocosmetique: 'Dermocosmétique',
  solaire: 'Solaire',
  capillaire: 'Capillaire',
  hygiene: 'Hygiène et soin du corps',
  bebe: 'Bébé et maternité',
  bucco: 'Bucco-dentaire',
  complements: 'Compléments alimentaires',
  phyto: 'Phytothérapie et aromathérapie',
  nutrition: 'Nutrition et diététique',
  orthopedie: 'Orthopédie et contention',
  materiel: 'Matériel médical',
  veterinaire: 'Vétérinaire',
};
export const TYPES_PRODUIT = Object.keys(TYPE_PRODUIT_LABEL) as TypeProduit[];

/** Une marque confiée à un animateur, pour les familles de produits que le titulaire choisit. */
export interface MarqueAnimee {
  id: string;
  marque: string;
  types: TypeProduit[];
}

export interface Profil {
  /** Nom de l'espace, tel qu'il s'affiche en haut de l'écran. */
  espace: string;
  /** Ce que la personne trouve dans son espace, en une phrase. */
  phrase: string;
  /** Sujets proposés pour une demande de rendez-vous. */
  sujets: string[];
}

const COMMUNS = ['Mon planning', 'Mon contrat ou mes heures', 'Entretien annuel', 'Autre sujet'];

export const PROFILS: Record<Qualification, Profil> = {
  titulaire: { espace: 'Espace titulaire', phrase: 'Les décisions du jour, le planning et l’équipe.', sujets: ['Point d’équipe', 'Entretien annuel', 'Organisation du planning', 'Autre sujet'] },
  adjoint: { espace: 'Espace pharmacien adjoint', phrase: 'Vos horaires, vos gardes et les plages où vous êtes le pharmacien présent.', sujets: ['Gardes et astreintes', 'Missions (vaccination, entretiens)', ...COMMUNS] },
  preparateur: { espace: 'Espace préparateur', phrase: 'Vos horaires, vos compétences et vos demandes.', sujets: ['Formation ou compétence', ...COMMUNS] },
  etudiant: { espace: 'Espace étudiant', phrase: 'Vos horaires autour de vos cours, et vos examens à signaler.', sujets: ['Cours et examens', 'Stage ou thèse', ...COMMUNS] },
  apprenti: { espace: 'Espace apprenti', phrase: 'Vos horaires en officine, vos jours d’école et le suivi avec votre tuteur.', sujets: ['Point avec mon tuteur', 'Jours d’école', ...COMMUNS] },
  rayonniste: { espace: 'Espace rayonniste', phrase: 'Vos horaires et les rayons qui vous sont confiés.', sujets: ['Mes rayons et les commandes', ...COMMUNS] },
  animateur: { espace: 'Espace animateur', phrase: 'Vos jours d’animation et les marques que vous présentez.', sujets: ['Bilan d’animation', 'Marques et produits à présenter', ...COMMUNS] },
};

/** Les marques d'un animateur, rangées par famille de produits : une marque apparaît sous chacune de ses familles. */
export function marquesParType(p: Pick<Person, 'marques'>): { type: TypeProduit; marques: string[] }[] {
  const liste = (p.marques ?? []).filter((m) => m.marque.trim());
  return TYPES_PRODUIT.map((type) => ({ type, marques: liste.filter((m) => m.types.includes(type)).map((m) => m.marque.trim()) })).filter((x) => x.marques.length);
}

/** Deux écritures de la même marque (majuscules, accents, espaces) désignent la même marque. */
export const cleMarque = (nom: string): string => nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Le répertoire des marques de la pharmacie : celles que le titulaire y a inscrites, et toutes celles déjà
 * confiées à un animateur. Sans doublon, dans l'ordre alphabétique.
 */
export function repertoireMarques(data: Pick<AppData, 'officine' | 'personnes'>): string[] {
  const vues = new Map<string, string>();
  for (const nom of [...(data.officine.marques ?? []), ...data.personnes.flatMap((p) => (p.marques ?? []).map((m) => m.marque))]) {
    const propre = nom.replace(/\s+/g, ' ').trim();
    if (propre && !vues.has(cleMarque(propre))) vues.set(cleMarque(propre), propre);
  }
  return [...vues.values()].sort((a, b) => a.localeCompare(b, 'fr'));
}
