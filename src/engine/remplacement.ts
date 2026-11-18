import { regleActive, valeurRegle } from '../domain/rules';
import { dayIndex, fmtDuree, mondayOf } from '../domain/time';
import type { AppData, ISODate, Person, Remplacement, Shift } from '../domain/types';
import { estPharmacien, nomCourt } from '../domain/types';
import { equipeInterne, estAbsent, minutesSemaine } from './core';
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

export interface AvisCollegue {
  personId: string;
  /** Ce collègue peut reprendre le poste : aucune règle enfreinte, et ses heures de la semaine restent sous le plafond. */
  ok: boolean;
  raisons: string[];
  /** Minutes planifiées cette semaine-là, avant et après avoir repris le poste. */
  avant: number;
  apres: number;
  /** Son contrat hebdomadaire, en minutes ; 0 pour un titulaire, hors décompte. */
  contrat: number;
}

/**
 * À qui peut-on demander de reprendre un poste ? Pour chaque collègue qui a la qualification voulue,
 * le calcul relit les règles et compte ses heures de la semaine : au-delà du plafond de l'officine
 * (fiche « equipe.heuresMax », sinon la durée hebdomadaire maximale), la demande n'est pas possible.
 */
export function avisCollegues(data: AppData, poste: Shift): AvisCollegue[] {
  const essai: Remplacement = { id: 'essai', shiftId: poste.id, demandeur: poste.personId, date: poste.date, start: poste.start, end: poste.end, creeLe: '', volontaires: [], statut: 'ouverte' };
  const monday = mondayOf(poste.date);
  const duree = poste.end - poste.start - ((poste.pauseEnd ?? 0) - (poste.pauseStart ?? 0));
  const plafond = (regleActive(data.regles, 'equipe.heuresMax') ? valeurRegle(data.regles, 'equipe.heuresMax', 42) : valeurRegle(data.regles, 'duree.hebdo', 46)) * 60;
  return equipeInterne(data)
    .filter((p) => p.id !== poste.personId && peutRemplacer(data, essai, p))
    .map((p) => {
      const a = evaluerRemplacement(data, essai, p.id);
      const avant = minutesSemaine(data, p.id, monday);
      const apres = avant + duree;
      const raisons = [...a.raisons];
      if (p.salarie && apres > plafond && !raisons.length) raisons.push(`Dépasserait ${fmtDuree(plafond)} sur la semaine (${fmtDuree(apres)}).`);
      return { personId: p.id, ok: raisons.length === 0, raisons, avant, apres, contrat: p.salarie ? p.heuresHebdo * 60 : 0, nom: nomCourt(p) };
    })
    .sort((x, y) => Number(y.ok) - Number(x.ok) || x.apres - x.contrat - (y.apres - y.contrat) || x.nom.localeCompare(y.nom))
    .map(({ nom: _nom, ...c }) => c);
}
