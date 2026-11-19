/**
 * Le support de Solvéa : c'est Solvéa qui le fournit, pas le titulaire.
 *
 * COORDONNÉES PROVISOIRES, FICTIVES. Le numéro appartient à une tranche réservée aux œuvres de fiction et l'adresse
 * à un domaine réservé aux exemples : personne ne répond. À remplacer par les vraies coordonnées avant toute mise
 * en service.
 */
export const SUPPORT = {
  nom: 'Support Solvéa',
  telephone: '01 99 00 12 34',
  email: 'support@solvea.example',
  provisoire: true,
} as const;

/** Le numéro tel qu'il se compose. */
export const SUPPORT_TEL = `tel:${SUPPORT.telephone.replace(/[^+\d]/g, '')}`;
export const SUPPORT_MAIL = `mailto:${SUPPORT.email}`;
