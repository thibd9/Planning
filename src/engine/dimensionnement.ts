import type { Officine, Person } from '../domain/types';
import { estPharmacien } from '../domain/types';

/**
 * L'équipe est-elle bien dimensionnée ? Une aide pour les titulaires.
 *
 * Le calcul part de l'activité, pas du mobilier : ce sont les clients à servir qui disent combien de personnes
 * il faut au comptoir. Les caisses et les postes de comptoir ne sont qu'un plafond (au-delà, une personne de plus
 * n'a pas où servir) ; la surface ne sert qu'à défaut de mieux. Six caisses ne demandent donc pas six personnes.
 *
 * Tout ceci est un repère d'organisation, avec des hypothèses écrites en clair, jamais une norme. La seule règle
 * officielle rappelée est le nombre minimal de pharmaciens adjoints selon l'activité annuelle.
 */

/** Les hypothèses du calcul. Elles sont affichées à l'écran : rien n'est caché. */
export const HYPOTHESES = {
  /** Temps moyen passé avec un client, en minutes, sans et avec robot. */
  minutesParClient: 5,
  minutesParClientRobot: 4,
  /** Part du temps au comptoir réellement passée à servir : au-delà, la file s'allonge. */
  occupation: 0.8,
  /** À l'heure de pointe, on sert cette fois plus de clients que la moyenne de la journée. */
  pointe: 1.6,
  /** Part des heures d'ouverture qui sont des heures de pointe. */
  partPointe: 0.35,
  /** Travail hors comptoir (commandes, réception, rangement, préparatoire), en plus du service, sans et avec robot. */
  horsComptoir: 0.2,
  horsComptoirRobot: 0.12,
  /** Congés, formation, absences : il faut ce surplus d'heures au contrat pour tenir le planning toute l'année. */
  absences: 0.12,
  /** Sans nombre de clients : une personne pour tant de mètres carrés de surface de vente, à l'heure ordinaire. */
  m2ParPersonne: 45,
  /** Un pharmacien encadre au plus tant de personnes au comptoir en même temps. */
  encadrement: 5,
  /** Part du temps d'un pharmacien présent qui sert au comptoir (le reste : contrôle, conseil, gestion). */
  pharmacienAuComptoir: 0.7,
  /** Semaine de référence d'un temps plein, en heures. */
  tempsPlein: 35,
  /** Arrêté du 21 février 2022 : un pharmacien adjoint, en équivalent temps plein, par tranche révolue d'activité. */
  trancheAdjoint: 1_300_000,
} as const;

/** Ce que chaque métier apporte au comptoir, pour une heure de contrat. */
export const APPORT_COMPTOIR: Partial<Record<Person['qualification'], number>> = { preparateur: 1, etudiant: 0.8, apprenti: 0.5, animateur: 0.5 };

export type VerdictEffectif = 'manque' | 'juste' | 'bon' | 'large';

export interface BilanMetier {
  /** Équivalents temps plein qu'il faut, et ceux que les contrats apportent. */
  besoin: number;
  dispo: number;
  verdict: VerdictEffectif;
}

export interface Dimensionnement {
  /** Sur quoi repose l'estimation : les clients servis (fiable), la surface de vente (grossier), ou rien du tout. */
  source: 'passages' | 'surface' | 'aucune';
  /** Heures d'ouverture par semaine. */
  heuresOuverture: number;
  /** Personnes au comptoir en même temps : à l'heure ordinaire, à l'heure de pointe, au minimum, et le plafond utile. */
  comptoir: { ordinaire: number; pointe: number; plancher: number; plafond: number | null };
  minutesParClient: number;
  pharmaciens: BilanMetier & { ensemble: number; adjointsRequis: number | null; adjointsCouverts: number };
  equipe: BilanMetier;
  /** Les réglages « effectif attendu » qui s'écartent du repère : trop bas, ou plus haut que le plafond utile. */
  ecarts: { jours: number[]; start: number; end: number; minEquipe: number; repere: number; sens: 'bas' | 'haut' }[];
  /** Ce qu'il faut savoir en une phrase chacune. */
  remarques: string[];
}

const arrondi = (n: number, pas = 0.1): number => Math.round(n / pas) * pas;
const verdictDe = (dispo: number, besoin: number): VerdictEffectif => {
  if (besoin <= 0) return 'bon';
  const r = dispo / besoin;
  return r < 0.9 ? 'manque' : r < 1 ? 'juste' : r <= 1.3 ? 'bon' : 'large';
};

/** Le dimensionnement de l'équipe d'une officine, d'après ses chiffres, ses horaires et les contrats de l'équipe. */
export function dimensionnement(officine: Pick<Officine, 'horaires' | 'effectifs' | 'surface' | 'infos'>, personnes: Person[]): Dimensionnement {
  const H = HYPOTHESES;
  const i = officine.infos ?? {};
  const equipe = personnes.filter((p) => !p.externe);
  const heuresJour = officine.horaires.map((plages) => plages.reduce((t, x) => t + (x.end - x.start), 0) / 60);
  const heuresOuverture = heuresJour.reduce((t, h) => t + h, 0);
  const pleine = Math.max(0, ...heuresJour);
  // Un samedi matin ne compte pas pour une journée entière.
  const joursEquivalents = pleine ? heuresJour.reduce((t, h) => t + h / pleine, 0) : 0;
  const minutesParClient = i.minutesParClient && i.minutesParClient > 0 ? i.minutesParClient : i.robot ? H.minutesParClientRobot : H.minutesParClient;
  const horsComptoir = i.robot ? H.horsComptoirRobot : H.horsComptoir;

  // Le plafond utile : au-delà des postes où l'on sert, plus une personne hors comptoir, on n'ajoute rien.
  const postes = i.comptoirs || i.caisses || 0;
  const plafond = postes ? postes + 1 : null;
  // Le plancher : un pharmacien, et quelqu'un avec lui dès que l'officine dépasse un seul poste ou une petite surface.
  const plancher = postes >= 2 || (i.surfaceVente ?? 0) > 60 || (officine.surface ?? 0) > 100 ? 2 : 1;

  // Personnes au comptoir en même temps, à l'heure ordinaire.
  let source: Dimensionnement['source'] = 'aucune';
  let charge = 0;
  if (i.passagesJour && i.passagesJour > 0 && pleine) {
    source = 'passages';
    charge = ((i.passagesJour / pleine) * minutesParClient) / 60 / H.occupation;
  } else if (i.surfaceVente && i.surfaceVente > 0) {
    source = 'surface';
    charge = i.surfaceVente / H.m2ParPersonne;
  }
  const borne = (n: number): number => Math.max(plancher, plafond ? Math.min(n, plafond) : n);
  const ordinaire = borne(Math.ceil(charge - 0.15));
  const pointe = borne(Math.ceil(charge * H.pointe - 0.15));

  // Les heures de travail qu'il faut par semaine, tous métiers confondus.
  const heuresService = source === 'passages' ? ((i.passagesJour as number) * joursEquivalents * minutesParClient) / 60 / H.occupation : charge * heuresOuverture * (1 - H.partPointe + H.partPointe * H.pointe);
  const heuresTotales = Math.max(heuresService * (1 + horsComptoir), plancher * heuresOuverture);

  // Pharmaciens : un présent à toute heure d'ouverture, un de plus en pointe si l'équipe au comptoir dépasse ce qu'un seul encadre.
  const pharmaciens = equipe.filter(estPharmacien);
  const simultanes = Math.max(1, Math.ceil(pointe / H.encadrement));
  const heuresPharmaciens = heuresOuverture + heuresOuverture * H.partPointe * (simultanes - 1);
  const besoinPharmaciens = (heuresPharmaciens * (1 + H.absences)) / H.tempsPlein;
  const dispoPharmaciens = pharmaciens.reduce((t, p) => t + p.heuresHebdo, 0) / H.tempsPlein;

  // Le reste de l'équipe au comptoir : ce que les pharmaciens ne servent pas eux-mêmes.
  const heuresEquipe = Math.max(0, heuresTotales - heuresPharmaciens * H.pharmacienAuComptoir);
  const besoinEquipe = (heuresEquipe * (1 + H.absences)) / H.tempsPlein;
  const dispoEquipe = equipe.reduce((t, p) => t + p.heuresHebdo * (APPORT_COMPTOIR[p.qualification] ?? 0), 0) / H.tempsPlein;

  // La règle officielle : un adjoint en équivalent temps plein par tranche révolue d'activité.
  // Les titulaires associés à temps plein, au-delà du premier, peuvent en tenir lieu.
  const adjointsRequis = i.activiteAnnuelle && i.activiteAnnuelle > 0 ? Math.floor(i.activiteAnnuelle / H.trancheAdjoint) : null;
  const titulaires = equipe.filter((p) => p.qualification === 'titulaire');
  const associesPleins = Math.max(0, titulaires.filter((p) => p.heuresHebdo >= H.tempsPlein).length - 1);
  const adjointsCouverts = equipe.filter((p) => p.qualification === 'adjoint').reduce((t, p) => t + Math.min(1, p.heuresHebdo / H.tempsPlein), 0) + associesPleins;

  const ecarts: Dimensionnement['ecarts'] = [];
  if (source !== 'aucune') {
    for (const e of officine.effectifs ?? []) {
      if (e.minEquipe < ordinaire) ecarts.push({ ...e, repere: ordinaire, sens: 'bas' });
      else if (plafond !== null && e.minEquipe > plafond) ecarts.push({ ...e, repere: plafond, sens: 'haut' });
    }
  }

  const remarques: string[] = [];
  if (source === 'aucune') remarques.push('Indiquez le nombre de clients servis par jour, ou au moins la surface de vente : sans mesure de l’activité, aucun repère n’est possible.');
  if (source === 'surface') remarques.push('Estimation d’après la seule surface de vente : elle est grossière. Indiquez le nombre de clients servis par jour pour un repère fiable.');
  if (source !== 'aucune' && i.caisses && pointe < i.caisses) remarques.push(`Vous avez ${i.caisses} caisses, mais ${pointe} personne${pointe > 1 ? 's' : ''} au comptoir suffi${pointe > 1 ? 'sent' : 't'} à l’heure de pointe : le nombre de caisses ne fixe pas l’effectif.`);
  if (source === 'passages' && plafond !== null && Math.ceil(charge * H.pointe - 0.15) > plafond) remarques.push(`À l’heure de pointe, l’activité demanderait plus de monde que vos ${postes} postes ne peuvent en accueillir : la file s’allonge faute de place, pas faute de personnel.`);
  if (adjointsRequis !== null && adjointsCouverts + 1e-9 < adjointsRequis) remarques.push(`Règle officielle : votre activité demande au moins ${adjointsRequis} pharmacien${adjointsRequis > 1 ? 's' : ''} adjoint${adjointsRequis > 1 ? 's' : ''} en équivalent temps plein ; vous en comptez ${String(arrondi(adjointsCouverts)).replace('.', ',')}.`);

  return {
    source,
    heuresOuverture: arrondi(heuresOuverture, 0.5),
    comptoir: { ordinaire, pointe, plancher, plafond },
    minutesParClient,
    pharmaciens: { besoin: arrondi(besoinPharmaciens), dispo: arrondi(dispoPharmaciens), verdict: verdictDe(dispoPharmaciens, besoinPharmaciens), ensemble: simultanes, adjointsRequis, adjointsCouverts: arrondi(adjointsCouverts) },
    equipe: source === 'aucune' ? { besoin: 0, dispo: arrondi(dispoEquipe), verdict: 'bon' } : { besoin: arrondi(besoinEquipe), dispo: arrondi(dispoEquipe), verdict: verdictDe(dispoEquipe, besoinEquipe) },
    ecarts,
    remarques,
  };
}
