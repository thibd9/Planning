import type { AppData, Person } from './types';
import { estPharmacien } from './types';

/**
 * Trois espaces selon le rôle :
 *  - responsable : le titulaire qui a créé l'officine, et les personnes à qui il a donné l'accès ;
 *  - pharmacien  : un pharmacien (cotitulaire ou adjoint) sans droit de gestion ;
 *  - equipe      : préparateurs, apprentis, étudiants, rayonnistes.
 */
export type Espace = 'responsable' | 'pharmacien' | 'equipe';

/** Le responsable de l'officine : celui qui l'a créée, à défaut le premier titulaire. */
export function responsable(data: Pick<AppData, 'officine' | 'personnes'>): Person | undefined {
  return data.personnes.find((p) => p.id === data.officine.responsableId) ?? data.personnes.find((p) => p.qualification === 'titulaire' && !p.externe);
}

export function estResponsable(data: Pick<AppData, 'officine' | 'personnes'>, p: Person | undefined): boolean {
  return !!p && responsable(data)?.id === p.id;
}

/** Peut modifier plannings, équipe, gardes et réglages : le responsable, ou une personne à qui il a donné l'accès. */
export function peutGerer(data: Pick<AppData, 'officine' | 'personnes'>, p: Person | undefined): boolean {
  if (!p || p.externe) return false;
  return estResponsable(data, p) || !!p.gestion;
}

export function espaceDe(data: Pick<AppData, 'officine' | 'personnes'>, p: Person | undefined): Espace {
  if (peutGerer(data, p)) return 'responsable';
  return p && estPharmacien(p) ? 'pharmacien' : 'equipe';
}

export const ESPACE_LABEL: Record<Espace, string> = {
  responsable: 'Espace responsable',
  pharmacien: 'Espace pharmacien',
  equipe: 'Espace équipe',
};

/**
 * Empreinte d'un mot de passe. Protection de confort sur un appareil partagé :
 * sans serveur, ce n'est pas une sécurité, et l'empreinte n'est pas cryptographique.
 */
export function empreinte(code: string): string {
  let a = 5381;
  let b = 52711;
  for (const c of `releve:${code}`) {
    const o = c.codePointAt(0) ?? 0;
    a = ((a << 5) + a + o) >>> 0;
    b = ((b << 5) + b) ^ o;
    b >>>= 0;
  }
  return `e${a.toString(36)}${b.toString(36)}`;
}

/** Identifiant de connexion proposé : prenom.nom, sans accent ni espace, unique dans la liste donnée. */
export function identifiantPropose(prenom: string, nom: string, pris: string[]): string {
  const net = (t: string): string => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const base = `${net(prenom)}.${net(nom)}`.replace(/^\.|\.$/g, '') || 'profil';
  let id = base;
  for (let n = 2; pris.includes(id); n++) id = `${base}${n}`;
  return id;
}

export const memeIdentifiant = (a: string | undefined, b: string | undefined): boolean => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Libellé du rôle, en distinguant le titulaire principal du titulaire secondaire. */
export function libelleRole(data: Pick<AppData, 'officine' | 'personnes'>, p: Person): string {
  if (p.externe) return 'Remplaçant';
  if (p.qualification === 'titulaire') return estResponsable(data, p) ? 'Titulaire principal' : 'Titulaire secondaire';
  return { adjoint: 'Pharmacien adjoint', preparateur: 'Préparateur', etudiant: 'Étudiant', apprenti: 'Apprenti', rayonniste: 'Rayonniste' }[p.qualification];
}
