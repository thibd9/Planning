import { valeurRegle } from '../domain/rules';
import { dayIndex, mondayOf } from '../domain/time';
import type { AppData, ISODate, Person, Remplacement } from '../domain/types';
import { estPharmacien } from '../domain/types';
import { estAbsent } from './core';
import { bloquants, validateWeek } from './validate';

export interface AvisRemplacement {
  /** Le remplacement peut être validé sans créer d'infraction ni découvrir l'officine. */
  ok: boolean;
  raisons: string[];
}

/** Un collègue peut se proposer s'il a la qualification voulue : un pharmacien ne se remplace que par un pharmacien. */
export function peutRemplacer(data: Pick<AppData, 'personnes'>, r: Remplacement, candidat: Person): boolean {
  if (candidat.id === r.demandeur || candidat.externe) return false;
  const demandeur = data.personnes.find((p) => p.id === r.demandeur);
  return !demandeur || !estPharmacien(demandeur) || estPharmacien(candidat);
}

/**
 * Simule le remplacement et relit la semaine : ne sont retenues que les infractions
 * qui n'existaient pas avant. Rien n'est modifié.
 */
export function evaluerRemplacement(data: AppData, r: Remplacement, candidatId: string): AvisRemplacement {
  const candidat = data.personnes.find((p) => p.id === candidatId);
  const poste = data.shifts.find((s) => s.id === r.shiftId);
  if (!candidat || !poste) return { ok: false, raisons: ['Le poste n’existe plus.'] };
  const raisons: string[] = [];
  if (!peutRemplacer(data, r, candidat)) raisons.push('Ce poste demande un pharmacien.');
  if (estAbsent(data, candidatId, poste.date)) raisons.push('Absence déjà prévue ce jour-là.');
  // Deux postes qui se chevauchent : le contrôle hebdomadaire ne le voit pas pour un titulaire, hors décompte.
  if (data.shifts.some((s) => s.id !== poste.id && s.personId === candidatId && s.date === poste.date && s.start < poste.end && poste.start < s.end)) {
    raisons.push('Déjà en poste sur cet horaire.');
  }
  const monday = mondayOf(poste.date);
  const avant = new Set(bloquants(validateWeek(data, monday)).map((i) => `${i.regle}|${i.personId ?? ''}|${i.date ?? ''}`));
  const apres = bloquants(validateWeek({ ...data, shifts: data.shifts.map((s) => (s.id === poste.id ? { ...s, personId: candidatId } : s)) }, monday));
  for (const i of apres) {
    if (!avant.has(`${i.regle}|${i.personId ?? ''}|${i.date ?? ''}`) && !raisons.includes(i.message)) raisons.push(i.message);
  }
  return { ok: raisons.length === 0, raisons };
}

/** Nombre de jours entre la demande de remplacement et le poste (fiche « delai.remplacement ») ; jamais moins de trois. */
export const delaiRemplacement = (data: Pick<AppData, 'regles'>): number => Math.max(3, valeurRegle(data.regles, 'delai.remplacement', 7));

/** Un salarié ne demande un remplacement que si le poste est assez loin pour prévenir un collègue dans les règles. */
export function peutDemanderRemplacement(data: Pick<AppData, 'regles'>, date: ISODate, today: ISODate): boolean {
  return dayIndex(date) - dayIndex(today) >= delaiRemplacement(data);
}
