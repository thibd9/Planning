/** Refuser une demande : des raisons d'organisation, jamais personnelles, et le message que la personne reçoit. */

export type NatureRefus = 'absence' | 'horaire' | 'remplacement';

const COMMUNES = ['Effectif insuffisant sur cette période', 'Plusieurs absences déjà prévues', 'Période de forte activité', 'Délai trop court pour s’organiser'];

export const RAISONS_REFUS: Record<NatureRefus, string[]> = {
  absence: [...COMMUNES, 'Congés déjà accordés à un collègue sur ces dates', 'D’autres dates seraient possibles'],
  horaire: ['Incompatible avec les horaires d’ouverture', 'Présence d’un pharmacien à assurer', ...COMMUNES.slice(0, 3), 'Plafond de demandes prioritaires atteint'],
  remplacement: ['Aucun remplaçant possible', 'Le remplaçant dépasserait ses heures', ...COMMUNES],
};

/** La raison choisie et le mot ajouté, en une phrase propre ; vide si rien n'est précisé. */
export function motifRefus(raison: string, mot: string): string {
  const m = mot.trim().replace(/\s+/g, ' ');
  const fin = m && !/[.!?…]$/.test(m) ? `${m}.` : m;
  return [raison ? `Raison : ${raison.charAt(0).toLowerCase()}${raison.slice(1)}.` : '', fin].filter(Boolean).join(' ');
}

/** Le message reçu par la personne. `objet` complète « Votre demande … » : « de congé du 3 au 7 mars ». */
export function texteRefus(objet: string, motif: string, suite = ''): string {
  return [`Votre demande ${objet} n’est pas acceptée.`, motif, suite].filter(Boolean).join(' ');
}

/** Répondre non à une demande de remplacement : des raisons d'organisation, toujours facultatives. */
export const RAISONS_DECLIN = ['Indisponible ce jour-là', 'Déjà beaucoup d’heures cette semaine', 'Délai trop court pour m’organiser', 'Je laisse mon tour cette fois'];

/** Le message envoyé par la personne qui ne peut pas reprendre le poste. */
export function texteDeclin(quand: string, motif: string): string {
  return [`Je ne peux pas reprendre le poste du ${quand}.`, motif].filter(Boolean).join(' ');
}
