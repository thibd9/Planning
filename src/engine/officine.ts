import type { Officine } from '../domain/types';

/** L'officine en chiffres, en phrases : pour la page de réglages et pour Solvi. */
export function chiffresOfficine(o: Pick<Officine, 'surface' | 'infos'>): string[] {
  const i = o.infos ?? {};
  const n = (v: number | undefined, un: string, plusieurs: string): string | null => (v ? `${v} ${v > 1 ? plusieurs : un}` : null);
  return [
    o.surface ? `${o.surface} m² au total` : null,
    i.surfaceVente ? `${i.surfaceVente} m² de surface de vente` : null,
    i.reserve ? `${i.reserve} m² de réserve et de préparatoire` : null,
    n(i.caisses, 'caisse', 'caisses'),
    n(i.comptoirs, 'poste de comptoir', 'postes de comptoir'),
    n(i.confidentialite, 'espace de confidentialité', 'espaces de confidentialité'),
    i.robot ? 'un robot de dispensation' : null,
  ].filter((x): x is string => !!x);
}

/** Ce qui ne colle pas entre les chiffres saisis. Des remarques, jamais des blocages. */
export function remarquesOfficine(o: Pick<Officine, 'surface' | 'infos' | 'effectifs'>): string[] {
  const i = o.infos ?? {};
  const r: string[] = [];
  if (o.surface && i.surfaceVente && i.surfaceVente > o.surface) r.push('La surface de vente dépasse la surface totale.');
  else if (o.surface && i.surfaceVente && i.reserve && i.surfaceVente + i.reserve > o.surface) r.push('Surface de vente et réserve dépassent ensemble la surface totale.');
  if (i.caisses && i.comptoirs && i.caisses > i.comptoirs) r.push('Il y a plus de caisses que de postes de comptoir : vérifiez l’un des deux.');
  // L'effectif attendu au plus fort de la semaine, comparé aux postes de comptoir.
  const pointe = Math.max(0, ...(o.effectifs ?? []).map((b) => b.minEquipe));
  if (i.comptoirs && pointe > i.comptoirs) r.push(`Vous attendez jusqu’à ${pointe} personnes en même temps pour ${i.comptoirs} poste${i.comptoirs > 1 ? 's' : ''} de comptoir.`);
  return r;
}
