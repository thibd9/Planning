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

/** Empreinte d'un code d'accès. Protection de confort sur un appareil partagé, pas une sécurité de serveur. */
export async function empreinte(code: string): Promise<string> {
  const octets = new TextEncoder().encode(`releve:${code}`);
  if (globalThis.crypto?.subtle) {
    const h = await globalThis.crypto.subtle.digest('SHA-256', octets);
    return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  let x = 5381;
  for (const o of octets) x = ((x << 5) + x + o) >>> 0;
  return `d${x.toString(16)}`;
}
