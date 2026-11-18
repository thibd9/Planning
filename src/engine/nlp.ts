import { MOIS, addDays, fmtHeure, fmtJourMois, mondayOf } from '../domain/time';
import type { Besoin, BesoinForme, BesoinStatut, ISODate, Person } from '../domain/types';

export interface Lecture {
  /** Besoin structuré, à confirmer par un humain. Jamais enregistré tel quel. */
  besoin: Omit<Besoin, 'id' | 'createdAt' | 'decision' | 'horsPlafond'> | null;
  /** Ce qui a été compris, élément par élément. */
  compris: string[];
  /** Ce qui manque pour créer la demande. */
  manque: string[];
}

const sansAccent = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const JOURS_RE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MOIS_SA = MOIS.map(sansAccent);

function heure(h: string, m?: string): number {
  return Number(h) * 60 + Number(m ?? 0);
}

function finDeMois(moisIndex: number, today: ISODate): ISODate {
  let y = Number(today.slice(0, 4));
  if (moisIndex + 1 < Number(today.slice(5, 7))) y += 1;
  const dernier = new Date(Date.UTC(y, moisIndex + 1, 0)).getUTCDate();
  return `${y}-${String(moisIndex + 1).padStart(2, '0')}-${String(dernier).padStart(2, '0')}`;
}

function dateLibre(jour: string, moisTexte: string, annee: string | undefined, today: ISODate): ISODate | null {
  const mi = /^\d+$/.test(moisTexte) ? Number(moisTexte) - 1 : MOIS_SA.indexOf(moisTexte);
  if (mi < 0 || mi > 11) return null;
  let y = annee ? Number(annee) : Number(today.slice(0, 4));
  const iso = (): ISODate => `${y}-${String(mi + 1).padStart(2, '0')}-${String(Number(jour)).padStart(2, '0')}`;
  if (!annee && iso() < today) y += 1;
  return iso();
}

/**
 * Transforme une phrase courante en besoin structuré, par règles explicites (aucun modèle de langage).
 * Exemple : « Nicolas souhaite finir avant 17 h un mercredi sur deux jusqu'à fin juin ».
 * Le résultat est une proposition : rien n'est créé sans confirmation, et la phrase n'est pas conservée.
 */
export function lireBesoin(phrase: string, personnes: Person[], today: ISODate): Lecture {
  const t = sansAccent(phrase).replace(/\s+/g, ' ');
  const compris: string[] = [];
  const manque: string[] = [];

  const person = personnes.find((p) => !p.externe && new RegExp(`\\b${sansAccent(p.prenom)}\\b`).test(t));
  if (person) compris.push(`Personne : ${person.prenom} ${person.nom}`);
  else manque.push('la personne concernée (prénom)');

  // Forme
  let forme: BesoinForme | null = null;
  let h: number | undefined;
  let plageStart: number | undefined;
  let plageEnd: number | undefined;
  const H = '(\\d{1,2}) ?h ?(\\d{2})?';
  const fin = new RegExp(`(?:finir|terminer|partir|sortir|fini[rt]?)[^.]*?(?:avant|a|au plus tard a|pour) ${H}`).exec(t);
  const debut = new RegExp(`(?:commencer|arriver|debuter|demarrer|embaucher)[^.]*?(?:apres|a partir de|pas avant|a) ${H}`).exec(t);
  const plage = new RegExp(`de ${H} a ${H}`).exec(t);
  const indispo = /(ne (?:peut|veut|souhaite) pas travailler|ne travaille pas|indisponible|pas disponible|ne pas travailler|etre libre|avoir (?:son|sa|ses|le|les)|absent|libre)/.test(t);
  if (fin) {
    forme = 'finir_avant';
    h = heure(fin[1], fin[2]);
    compris.push(`Finir avant ${fmtHeure(h)}`);
  } else if (debut) {
    forme = 'commencer_apres';
    h = heure(debut[1], debut[2]);
    compris.push(`Commencer après ${fmtHeure(h)}`);
  } else if (indispo) {
    forme = 'indisponible';
    if (plage) {
      plageStart = heure(plage[1], plage[2]);
      plageEnd = heure(plage[3], plage[4]);
      compris.push(`Indisponible de ${fmtHeure(plageStart)} à ${fmtHeure(plageEnd)}`);
    } else if (/\bmatin/.test(t)) {
      plageStart = 0;
      plageEnd = 13 * 60;
      compris.push('Indisponible le matin (jusqu’à 13 h)');
    } else if (/apres-midi|apres midi|aprem/.test(t)) {
      plageStart = 13 * 60;
      plageEnd = 1440;
      compris.push('Indisponible l’après-midi (à partir de 13 h)');
    } else compris.push('Indisponible la journée entière');
  } else manque.push('ce qui est demandé (finir avant…, commencer après…, ne pas travailler…)');

  // Jours
  let jours: number[] = [];
  JOURS_RE.forEach((j, i) => {
    if (new RegExp(`\\b${j}s?\\b`).test(t)) jours.push(i);
  });
  if (/week-end|weekend|week end/.test(t)) jours.push(5, 6);
  if (/tous les jours|chaque jour/.test(t)) jours = [0, 1, 2, 3, 4, 5, 6];
  jours = [...new Set(jours)].sort((a, b) => a - b);
  if (jours.length) compris.push(`Jours : ${jours.map((j) => JOURS_RE[j]).join(', ')}`);
  else manque.push('le ou les jours concernés');

  // Rythme
  const frequence: 1 | 2 = /sur deux|sur 2|toutes les deux semaines|tous les quinze jours/.test(t) ? 2 : 1;
  if (frequence === 2) compris.push('Rythme : une semaine sur deux');

  // Période
  let from: ISODate | undefined;
  let to: ISODate | undefined;
  const M = `(${MOIS_SA.join('|')})`;
  const finMois = new RegExp(`jusqu'?a (?:la )?fin (?:de |d')?${M}`).exec(t.replace(/’/g, "'"));
  const jusquau = new RegExp(`jusqu'?au (\\d{1,2})(?:er)? (?:${M}|/(\\d{1,2}))(?:[ /](\\d{4}))?`).exec(t.replace(/’/g, "'"));
  const aPartir = new RegExp(`(?:a partir du|a compter du|des le|du) (\\d{1,2})(?:er)? (?:${M}|/(\\d{1,2}))(?:[ /](\\d{4}))?`).exec(t);
  const au = new RegExp(`\\bau (\\d{1,2})(?:er)? (?:${M}|/(\\d{1,2}))(?:[ /](\\d{4}))?`).exec(t);
  if (aPartir) from = dateLibre(aPartir[1], aPartir[2] ?? aPartir[3], aPartir[4], today) ?? undefined;
  if (finMois) to = finDeMois(MOIS_SA.indexOf(finMois[1]), today);
  else if (jusquau) to = dateLibre(jusquau[1], jusquau[2] ?? jusquau[3], jusquau[4], today) ?? undefined;
  else if (au && aPartir) to = dateLibre(au[1], au[2] ?? au[3], au[4], from ?? today) ?? undefined;
  if (from) compris.push(`À partir du ${fmtJourMois(from)} ${from.slice(0, 4)}`);
  if (to) compris.push(`Jusqu’au ${fmtJourMois(to)} ${to.slice(0, 4)}`);

  // Niveau proposé : c'est le responsable qui décide du statut final.
  const statut: BesoinStatut = /ne peut pas|impossible|indisponible|impossibilite/.test(t) ? 'prioritaire' : 'preference';
  compris.push(statut === 'prioritaire' ? 'Niveau proposé : préférence prioritaire' : 'Niveau proposé : simple préférence');

  if (!person || !forme || !jours.length) return { besoin: null, compris, manque };
  return {
    besoin: {
      personId: person.id,
      forme,
      jours,
      frequence,
      semaineRef: frequence === 2 ? mondayOf(from ?? today) : undefined,
      heure: h,
      plageStart,
      plageEnd,
      from: from ?? addDays(today, 0),
      to,
      statut,
    },
    compris,
    manque,
  };
}
