import { addDays, mondayOf } from '../domain/time';
import type { AppData, ISODate, Person, Remplacement, Shift } from '../domain/types';
import { estPharmacien } from '../domain/types';
import { equipeInterne, estAbsent, sousEffectifs, trousPharmacien } from './core';
import { evaluerRemplacement } from './remplacement';
import { bloquants, validateWeek } from './validate';

/**
 * Tour de rôle pour les absences à couvrir vite.
 *
 * Trois principes, pour que personne ne soit mis à l'écart ni toujours sollicité :
 *  1. tous ceux qui peuvent légalement tenir le poste sont prévenus en même temps, avec le même message ;
 *  2. parmi les volontaires, la priorité va à celui qui a le moins dépanné sur trois mois, au prorata de son contrat ;
 *  3. répondre « je ne peux pas » ne coûte rien : seuls les dépannages réellement assurés comptent.
 * Ceux qui ne sont pas sollicités le sont pour une raison de règle (repos, absence, qualification), affichée à tous les responsables.
 */

const FENETRE = 90;

export interface Candidat {
  personId: string;
  /** Peut tenir le poste sans créer d'infraction. */
  ok: boolean;
  raisons: string[];
  /** Dépannages assurés sur les trois derniers mois, et date du dernier. */
  depannages: number;
  dernier: ISODate | null;
  volontaire: boolean;
  indisponible: boolean;
  /** Rang dans le tour de rôle parmi ceux qui peuvent (1 = c'est son tour). */
  rang: number | null;
}

/** Postes repris au pied levé (absence couverte, remplacement validé) sur la fenêtre. */
export function depannagesDe(data: Pick<AppData, 'shifts'>, personId: string, today: ISODate): { nombre: number; dernier: ISODate | null } {
  const debut = addDays(today, -FENETRE);
  const dates = data.shifts.filter((s) => s.personId === personId && s.origine === 'reparation' && s.date >= debut).map((s) => s.date).sort();
  return { nombre: dates.length, dernier: dates.length ? dates[dates.length - 1] : null };
}

/** L'absence découvre-t-elle quelque chose ce jour-là (pharmacien manquant, comptoir sous le seuil) ? Le poste n'est plus au planning. */
export function absenceDecouvre(data: AppData, poste: Shift): boolean {
  const compte = (d: Pick<AppData, 'shifts' | 'missions' | 'officine' | 'personnes'>): number => sousEffectifs(d, poste.date).length + trousPharmacien(d, poste.date).reduce((t, i) => t + (i.end - i.start), 0);
  return compte(data) > compte({ ...data, shifts: data.shifts.concat(poste) });
}

/** Le poste visé par une demande : au planning pour un remplacement, dans le trou pour une absence à couvrir. */
export function posteDe(data: Pick<AppData, 'shifts' | 'trous'>, r: Pick<Remplacement, 'shiftId' | 'trouId'>): Shift | undefined {
  if (r.trouId) return data.trous.find((t) => t.id === r.trouId)?.shift;
  return data.shifts.find((s) => s.id === r.shiftId);
}

function avis(data: AppData, poste: Shift, absent: Person | undefined, candidat: Person): string[] {
  const raisons: string[] = [];
  if (absent && estPharmacien(absent) && !estPharmacien(candidat)) raisons.push('Ce poste demande un pharmacien.');
  if (estAbsent(data, candidat.id, poste.date)) raisons.push('Absence déjà prévue ce jour-là.');
  if (data.shifts.some((s) => s.personId === candidat.id && s.date === poste.date && s.start < poste.end && poste.start < s.end)) raisons.push('Déjà en poste sur cet horaire.');
  if (raisons.length) return raisons;
  const monday = mondayOf(poste.date);
  const cle = (i: { regle: string; personId?: string; date?: string }): string => `${i.regle}|${i.personId ?? ''}|${i.date ?? ''}`;
  const avant = new Set(bloquants(validateWeek(data, monday)).map(cle));
  const essai: AppData = { ...data, shifts: data.shifts.concat({ ...poste, id: `${poste.id}_essai`, personId: candidat.id }) };
  for (const i of bloquants(validateWeek(essai, monday))) {
    if (i.personId === candidat.id && !avant.has(cle(i)) && !raisons.includes(i.message)) raisons.push(i.message);
  }
  return raisons;
}

/** Le tour de rôle pour un poste à couvrir : qui peut, dans quel ordre, et pourquoi les autres ne sont pas sollicités. */
export function tourDeRole(data: AppData, poste: Shift, today: ISODate, appel?: Pick<Remplacement, 'volontaires' | 'indisponibles'>): Candidat[] {
  const absent = data.personnes.find((p) => p.id === poste.personId);
  const liste: (Candidat & { poids: number; nom: string })[] = equipeInterne(data)
    .filter((p) => p.id !== poste.personId)
    .map((p) => {
      const raisons = avis(data, poste, absent, p);
      const d = depannagesDe(data, p.id, today);
      return {
        personId: p.id,
        ok: raisons.length === 0,
        raisons,
        depannages: d.nombre,
        dernier: d.dernier,
        volontaire: appel?.volontaires.includes(p.id) ?? false,
        indisponible: appel?.indisponibles?.includes(p.id) ?? false,
        rang: null,
        // Au prorata du contrat : on n'attend pas autant de dépannages d'un mi-temps que d'un temps plein.
        poids: d.nombre / Math.max(0.2, p.heuresHebdo / 35),
        nom: `${p.nom} ${p.prenom}`,
      };
    });
  liste.sort((a, b) => Number(b.ok) - Number(a.ok) || a.poids - b.poids || (a.dernier ?? '').localeCompare(b.dernier ?? '') || a.nom.localeCompare(b.nom));
  let rang = 0;
  return liste.map(({ poids: _p, nom: _n, ...c }) => (c.ok ? { ...c, rang: ++rang } : c));
}

/** Le même tour de rôle pour une demande de remplacement : le poste est encore au planning, il change seulement de main. */
export function tourRemplacement(data: AppData, r: Remplacement, today: ISODate): Candidat[] {
  const liste = equipeInterne(data)
    .filter((p) => p.id !== r.demandeur)
    .map((p) => {
      const a = evaluerRemplacement(data, r, p.id);
      const d = depannagesDe(data, p.id, today);
      return { personId: p.id, ok: a.ok, raisons: a.raisons, depannages: d.nombre, dernier: d.dernier, volontaire: r.volontaires.includes(p.id), indisponible: r.indisponibles?.includes(p.id) ?? false, rang: null as number | null, poids: d.nombre / Math.max(0.2, p.heuresHebdo / 35), nom: `${p.nom} ${p.prenom}` };
    });
  liste.sort((a, b) => Number(b.ok) - Number(a.ok) || a.poids - b.poids || (a.dernier ?? '').localeCompare(b.dernier ?? '') || a.nom.localeCompare(b.nom));
  let rang = 0;
  return liste.map(({ poids: _p, nom: _n, ...c }) => (c.ok ? { ...c, rang: ++rang } : c));
}

/** Celui dont c'est le tour parmi les volontaires ; null tant que personne ne s'est proposé. */
export const aSonTour = (candidats: Candidat[]): Candidat | null => candidats.find((c) => c.ok && c.volontaire) ?? null;
