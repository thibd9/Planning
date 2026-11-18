/**
 * Modèle métier de Solvéa.
 *
 * Conventions de temps :
 *  - une date est une chaîne ISO « AAAA-MM-JJ » (heure locale de l'officine) ;
 *  - une heure est un nombre de minutes depuis minuit (510 = 8 h 30) ;
 *  - une semaine est identifiée par la date de son lundi.
 *
 * Confidentialité : aucun champ « motif » ni texte libre sur un besoin personnel.
 * Le modèle ne peut pas contenir de religion, de diagnostic ou de situation familiale.
 */

export type ISODate = string;
export type Minutes = number;

export type Qualification =
  | 'titulaire'
  | 'adjoint'
  | 'preparateur'
  | 'etudiant'
  | 'apprenti'
  | 'rayonniste'
  | 'animateur';

export type CompetenceId =
  | 'vaccination'
  | 'trod'
  | 'entretien'
  | 'orthopedie'
  | 'contention'
  | 'preparations'
  | 'secours'
  | 'phyto'
  | 'aroma'
  | 'homeo'
  | 'micronutrition'
  | 'dermo'
  | 'beaute'
  | 'para'
  | 'puericulture'
  | 'veterinaire'
  | 'mad'
  | 'diabete'
  | 'tabac'
  | 'commandes'
  | 'tierspayant'
  | 'merchandising';

export interface Person {
  id: string;
  prenom: string;
  nom: string;
  qualification: Qualification;
  /** false pour le titulaire : hors décompte salarié (durées, repos, paie). */
  salarie: boolean;
  /** Heures contractuelles par semaine (objectif indicatif pour un titulaire). */
  heuresHebdo: number;
  /** Taux horaire brut indicatif, utilisé uniquement pour simuler un coût. */
  tauxHoraire: number | null;
  competences: CompetenceId[];
  /** Volontariat déclaré ; ne supprime aucun contrôle de repos. */
  volontaireHeuresComp: boolean;
  volontaireGardes: boolean;
  /** Remplaçant habituel, extérieur à l'équipe. */
  externe?: boolean;
  /** Droit de modifier plannings, équipe et réglages. Seul le responsable de l'officine l'accorde. */
  gestion?: boolean;
  /** Empreinte du mot de passe (jamais le mot de passe lui-même). */
  code?: string;
  /** Identifiant de connexion : adresse électronique ou prenom.nom. */
  identifiant?: string;
  /** Mot de passe provisoire à transmettre, effacé dès que la personne choisit le sien. */
  provisoire?: string;
}

export type Activite = 'comptoir' | 'back' | 'admin' | 'formation' | 'inventaire';

export type Origine = 'manuel' | 'genere' | 'reparation' | 'trame';

export interface Shift {
  id: string;
  personId: string;
  date: ISODate;
  start: Minutes;
  end: Minutes;
  pauseStart?: Minutes;
  pauseEnd?: Minutes;
  activite: Activite;
  origine: Origine;
  /** Phrase d'explication produite par le moteur (jamais saisie à la main). */
  explication?: string;
}

/** Activité à compétence, éventuellement en salle de confidentialité. */
export type MissionType = 'vaccination' | 'trod' | 'entretien' | 'rdv_labo';

export interface Mission {
  id: string;
  date: ISODate;
  start: Minutes;
  end: Minutes;
  type: MissionType;
  personId: string | null;
  salle: boolean;
  /** Une activité reportable peut être décalée lors d'une réparation. */
  reportable: boolean;
}

export type AbsenceType = 'conge' | 'maladie' | 'formation' | 'autre';
export type AbsenceStatut = 'demandee' | 'approuvee' | 'refusee';

export interface Absence {
  id: string;
  personId: string;
  from: ISODate;
  to: ISODate;
  type: AbsenceType;
  statut: AbsenceStatut;
  createdAt: string;
  /** Intitulé d'une formation. Jamais utilisé pour un congé ou un arrêt : aucun motif n'est conservé. */
  libelle?: string;
}

/**
 * Besoin personnel, toujours sans motif.
 *  - reconnue    : indisponibilité reconnue, traitée comme une contrainte impérative ;
 *  - prioritaire : préférence prioritaire, plafonnée de la même façon pour tous ;
 *  - preference  : simple préférence.
 */
export type BesoinStatut = 'reconnue' | 'prioritaire' | 'preference';
export type BesoinForme = 'indisponible' | 'finir_avant' | 'commencer_apres';
export type BesoinDecision = 'en_attente' | 'acceptee' | 'refusee';

export interface Besoin {
  id: string;
  personId: string;
  forme: BesoinForme;
  /** Jours concernés : 0 = lundi … 6 = dimanche. */
  jours: number[];
  /** 1 = chaque semaine, 2 = une semaine sur deux. */
  frequence: 1 | 2;
  /** Lundi de référence pour la parité quand frequence = 2. */
  semaineRef?: ISODate;
  /** Heure limite pour « finir avant » / « commencer après ». */
  heure?: Minutes;
  /** Plage horaire d'indisponibilité ; journée entière si absente. */
  plageStart?: Minutes;
  plageEnd?: Minutes;
  from?: ISODate;
  to?: ISODate;
  statut: BesoinStatut;
  /**
   * Droit légal ou restriction d'aptitude validée : saisi par une personne habilitée,
   * n'entre jamais dans le plafond des préférences prioritaires.
   */
  horsPlafond: boolean;
  decision: BesoinDecision;
  decidedAt?: string;
  createdAt: string;
}

export type GardeType = 'volets_ouverts' | 'volets_fermes' | 'astreinte';

export interface Intervention {
  id: string;
  /** Minutes écoulées depuis le début de la garde. */
  offset: Minutes;
  duree: Minutes;
}

export interface Garde {
  id: string;
  date: ISODate;
  start: Minutes;
  /** Si end <= start, la garde se termine le lendemain. */
  end: Minutes;
  type: GardeType;
  personId: string | null;
  /** Horodatage de la communication de la programmation au salarié. */
  communiqueLe?: string;
  /** Circonstances exceptionnelles : délai ramené à 2 jours ouvrables. */
  exceptionnel?: boolean;
  interventions: Intervention[];
  /** Variables relues et validées pour le comptable. */
  valideLe?: string;
}

export interface Interval {
  start: Minutes;
  end: Minutes;
}

export interface PosteType {
  id: string;
  label: string;
  start: Minutes;
  end: Minutes;
  pauseStart?: Minutes;
  pauseEnd?: Minutes;
  /** Jours où ce poste est proposé : 0 = lundi … 6 = dimanche. */
  jours: number[];
  /** Couleur choisie pour ce poste dans les plannings ; absente : la couleur suit l'horaire (matin, journée, soir). */
  couleur?: CouleurPoste;
}

export type CouleurPoste = 'jaune' | 'orange' | 'bleu' | 'violet' | 'anis' | 'rose' | 'sable' | 'gris';
export const COULEUR_POSTE_LABEL: Record<CouleurPoste, string> = { jaune: 'Jaune', orange: 'Orange', bleu: 'Bleu', violet: 'Violet', anis: 'Vert anis', rose: 'Rose', sable: 'Sable', gris: 'Gris' };
/** La couleur choisie pour un poste qui reprend exactement les horaires d'un poste type ; sinon rien. */
export const couleurDuPoste = (postes: PosteType[], s: { start: number; end: number }): CouleurPoste | undefined => postes.find((p) => p.couleur && p.start === s.start && p.end === s.end)?.couleur;

export interface BesoinEffectif {
  jours: number[];
  start: Minutes;
  end: Minutes;
  /** Nombre minimal de personnes disponibles au comptoir. */
  minEquipe: number;
}

/** collaboratif : chacun pose ses préférences du mois avant la date limite ; classique : le responsable construit seul. */
export type ModelePlanning = 'collaboratif' | 'classique';

export interface Officine {
  nom: string;
  modele?: ModelePlanning;
  /** Jour du mois précédent où la collecte des préférences se ferme (20 par défaut). */
  souhaitsLimite?: number;
  /** Titulaire principal : il a créé l'officine, détient tous les droits et les délègue. */
  responsableId?: string;
  /** Clé de secours du titulaire principal, pour redéfinir son mot de passe. */
  secours?: string;
  /** Plages d'ouverture par jour : index 0 = lundi … 6 = dimanche. */
  horaires: Interval[][];
  fermeJoursFeries: boolean;
  postes: PosteType[];
  effectifs: BesoinEffectif[];
  /** Valeur du point conventionnel en euros ; null tant qu'elle n'est pas saisie. */
  valeurPoint: number | null;
  /** Plafond de souhaits prioritaires actifs, identique pour tous. */
  plafondPrioritaires: number;
  /** Chiffre d'affaires annuel HT, pour le suivi du nombre d'adjoints. */
  caAnnuelHT: number | null;
}

export type SemaineStatut = 'brouillon' | 'publie';

export interface Semaine {
  statut: SemaineStatut;
  publishedAt?: string;
  /** Version officielle : celle que voient les salariés. */
  snapshot?: Shift[];
}

export interface Changement {
  personId: string;
  date: ISODate;
  avant: string;
  apres: string;
}

export type JournalType =
  | 'publication'
  | 'modification'
  | 'absence'
  | 'besoin'
  | 'garde'
  | 'reparation'
  | 'generation'
  | 'regle';

export interface JournalEntry {
  id: string;
  at: string;
  type: JournalType;
  titre: string;
  detail?: string;
  semaine?: ISODate;
  changements?: Changement[];
  /** Versions des règles en vigueur au moment de l'événement. */
  regles?: string[];
  /** Accords recueillis (délais de prévenance non tenus). */
  accords?: string[];
}

export interface Notification {
  id: string;
  personId: string;
  at: string;
  date: ISODate;
  avant: string;
  apres: string;
  /** Changement publié à moins de 7 jours de la date concernée. */
  tardif: boolean;
  luLe?: string;
}

/** Trou ouvert dans un planning par une absence approuvée. */
export interface Trou {
  id: string;
  absenceId: string;
  shift: Shift;
  statut: 'ouvert' | 'resolu';
  resolution?: string;
}

export type RegleFamille = 'duree' | 'repos' | 'pharmacie' | 'garde' | 'delai' | 'equipe';
export type RegleNature = 'imperative' | 'alerte';
/** verifie = lu sur le texte officiel ; a_valider = source secondaire, expert requis. */
export type RegleVerification = 'verifie' | 'a_valider';

export interface Regle {
  id: string;
  famille: RegleFamille;
  titre: string;
  description: string;
  nature: RegleNature;
  source: string;
  dateEffet: ISODate;
  version: string;
  verification: RegleVerification;
  /** Paramètre chiffré de la règle (minutes, heures, jours…). */
  valeur?: number;
  unite?: string;
  /** Une règle impérative ne peut pas être désactivée. */
  active: boolean;
}

/** Message interne. `a` vaut 'equipe' pour toute l'équipe, sinon l'identifiant d'une personne. */
export interface Message {
  id: string;
  de: string;
  a: string;
  texte: string;
  at: string;
  luPar: string[];
}

/**
 * Écart constaté par le responsable : retard, départ anticipé ou absence non prévue.
 * Un fait daté et une durée, jamais de commentaire ni de raison.
 */
export type EcartType = 'retard' | 'depart' | 'absence';
export interface Ecart {
  id: string;
  personId: string;
  date: ISODate;
  type: EcartType;
  /** Durée de l'écart ; absente pour une absence d'une journée. */
  minutes?: number;
  at: string;
}
export const ECART_LABEL: Record<EcartType, string> = { retard: 'Retard', depart: 'Départ anticipé', absence: 'Absence non prévue' };

/**
 * Décision proposée par un titulaire secondaire. Elle n'est appliquée que lorsque le titulaire
 * principal donne son accord : l'action et ses paramètres sont rejoués à ce moment-là.
 */
export interface Accord {
  id: string;
  auteur: string;
  at: string;
  action: string;
  args: unknown[];
  titre: string;
}

/** Niveau d'urgence d'une demande de remplacement : une catégorie, jamais une raison détaillée. */
export type Urgence = 'prevu' | 'urgent' | 'medical';
export const URGENCE_LABEL: Record<Urgence, string> = { prevu: 'Prévu', urgent: 'Urgent', medical: 'Urgence médicale' };
/** Ordre de traitement : l'urgence médicale d'abord. */
export const URGENCE_RANG: Record<Urgence, number> = { medical: 0, urgent: 1, prevu: 2 };

/** Justificatif joint à une demande urgente : vu des seuls titulaires, effacé dès que la demande est tranchée. */
export interface Justificatif {
  nom: string;
  type: string;
  taille: number;
  /** Contenu (URL de données) ; vide une fois la demande tranchée. */
  data: string;
}

export type CategorieDoc = 'arret' | 'formation' | 'contrat' | 'autre';
export const CATEGORIE_DOC_LABEL: Record<CategorieDoc, string> = { arret: 'Arrêt de travail', formation: 'Attestation de formation', contrat: 'Contrat ou avenant', autre: 'Autre document' };
/** Un document rangé dans l'espace d'une personne. */
export interface DocumentGed {
  id: string;
  personId: string;
  nom: string;
  type: string;
  taille: number;
  /** Contenu (URL de données). */
  data: string;
  categorie: CategorieDoc;
  /** Date du dépôt. */
  at: string;
  /** Visible aussi par les titulaires. */
  partage: boolean;
}

/** Régularisation du compteur d'heures d'une personne. minutes < 0 réduit un solde positif, > 0 comble un solde négatif. */
export type RegulType = 'paiement' | 'recuperation' | 'rattrapage' | 'solde';
export const REGUL_LABEL: Record<RegulType, string> = { paiement: 'Heures payées', recuperation: 'Récupération', rattrapage: 'Rattrapage', solde: 'Compteur soldé' };
export interface Regularisation {
  id: string;
  personId: string;
  minutes: number;
  type: RegulType;
  /** Semaine où la récupération ou le rattrapage est planifié. */
  semaine?: ISODate;
  at: string;
  /** Proposée par le calcul automatique. */
  auto?: boolean;
}

/** Demande de remplacement sur un poste publié : le titulaire l'accepte, un collègue se propose, le titulaire confie le poste. */
export interface Remplacement {
  id: string;
  shiftId: string;
  demandeur: string;
  date: ISODate;
  start: Minutes;
  end: Minutes;
  creeLe: string;
  volontaires: string[];
  statut: 'ouverte' | 'acceptee' | 'refusee' | 'annulee';
  remplacantId?: string;
  urgence?: Urgence;
  /** Réponse du titulaire à la demande elle-même ; absente pour un appel lancé par le titulaire. */
  accord?: 'attente' | 'accepte';
  justificatif?: Justificatif;
  /** Collègue à qui la demande est adressée en particulier ; absent : toute l'équipe disponible. */
  destinataire?: string;
  /** Appel à l'équipe pour une absence à couvrir : le poste n'est plus au planning, il est dans le trou. */
  trouId?: string;
  /** Personnes prévenues par l'appel : toutes celles qui peuvent légalement tenir le poste. */
  sollicites?: string[];
  /** Personnes qui ont répondu qu'elles ne pouvaient pas ; sans effet sur leur rang. */
  indisponibles?: string[];
}

/** Souhait d'une personne pour un jour précis : une forme d'horaire, jamais une raison. */
export type SouhaitChoix = 'matin' | 'journee' | 'soir' | 'repos';
export interface Souhait {
  personId: string;
  date: ISODate;
  choix: SouhaitChoix;
}
export const SOUHAIT_LABEL: Record<SouhaitChoix, string> = { matin: 'Matin', journee: 'Journée', soir: 'Après-midi', repos: 'Repos' };

export interface AppData {
  officine: Officine;
  /** Préférences du mois, posés jour par jour dans le modèle collaboratif. */
  souhaits?: Souhait[];
  regularisations?: Regularisation[];
  /** Documents déposés par chacun dans son espace ; ils restent sur l'appareil. */
  documents?: DocumentGed[];
  messages: Message[];
  remplacements: Remplacement[];
  ecarts: Ecart[];
  /** Décisions d'un titulaire secondaire en attente de l'accord du titulaire principal. */
  accords: Accord[];
  /** Jeu d'exemple : les identifiants de démonstration sont affichés à la connexion. */
  demo?: boolean;
  /** Version du jeu d'exemple : un exemple d'une version précédente est régénéré. */
  demoVersion?: number;
  personnes: Person[];
  shifts: Shift[];
  missions: Mission[];
  absences: Absence[];
  besoins: Besoin[];
  gardes: Garde[];
  semaines: Record<ISODate, Semaine>;
  regles: Regle[];
  journal: JournalEntry[];
  notifications: Notification[];
  trous: Trou[];
}

export const estPharmacien = (p: Pick<Person, 'qualification'>): boolean =>
  p.qualification === 'titulaire' || p.qualification === 'adjoint';

export const QUALIFICATION_LABEL: Record<Qualification, string> = {
  titulaire: 'Pharmacien titulaire',
  adjoint: 'Pharmacien adjoint',
  preparateur: 'Préparateur',
  etudiant: 'Étudiant en pharmacie',
  apprenti: 'Apprenti',
  rayonniste: 'Rayonniste',
  animateur: 'Animateur',
};

export const QUALIFICATION_COURT: Record<Qualification, string> = {
  titulaire: 'Titulaire',
  adjoint: 'Adjoint',
  preparateur: 'Préparateur',
  etudiant: 'Étudiant',
  apprenti: 'Apprenti',
  rayonniste: 'Rayonniste',
  animateur: 'Animateur',
};

export const ACTIVITE_LABEL: Record<Activite, string> = {
  comptoir: 'Comptoir',
  back: 'Réception et préparation',
  admin: 'Administratif',
  formation: 'Formation (hors officine)',
  inventaire: 'Inventaire',
};

export const COMPETENCE_LABEL: Record<CompetenceId, string> = {
  vaccination: 'Vaccination',
  trod: 'Tests angine et cystite',
  entretien: 'Entretiens pharmaceutiques',
  orthopedie: 'Orthopédie (DU)',
  contention: 'Contention et compression',
  preparations: 'Préparations magistrales',
  secours: 'Gestes d’urgence (AFGSU)',
  phyto: 'Phytothérapie',
  aroma: 'Aromathérapie',
  homeo: 'Homéopathie',
  micronutrition: 'Micronutrition',
  dermo: 'Dermatologie et dermocosmétique',
  beaute: 'Beauté et maquillage',
  para: 'Parapharmacie',
  puericulture: 'Puériculture',
  veterinaire: 'Conseil vétérinaire',
  mad: 'Maintien à domicile',
  diabete: 'Diabète et autosurveillance',
  tabac: 'Sevrage tabagique',
  commandes: 'Commandes et réception',
  tierspayant: 'Tiers payant et rejets',
  merchandising: 'Merchandising',
};

/** Les compétences par famille : actes et diplômes, conseil au comptoir, organisation. */
export const COMPETENCE_FAMILLES: { titre: string; cles: CompetenceId[] }[] = [
  { titre: 'Actes, diplômes et habilitations', cles: ['vaccination', 'trod', 'entretien', 'orthopedie', 'contention', 'preparations', 'secours'] },
  { titre: 'Conseil', cles: ['phyto', 'aroma', 'homeo', 'micronutrition', 'dermo', 'beaute', 'para', 'puericulture', 'veterinaire', 'mad', 'diabete', 'tabac'] },
  { titre: 'Organisation', cles: ['commandes', 'tierspayant', 'merchandising'] },
];


export const MISSION_LABEL: Record<MissionType, string> = {
  vaccination: 'Vaccination',
  trod: 'Test angine / cystite',
  entretien: 'Entretien pharmaceutique',
  rdv_labo: 'Rendez-vous laboratoire',
};

/** Compétence exigée pour réaliser une activité (null : aucune). */
export const MISSION_COMPETENCE: Record<MissionType, CompetenceId | null> = {
  vaccination: 'vaccination',
  trod: 'trod',
  entretien: 'entretien',
  rdv_labo: null,
};

export const GARDE_LABEL: Record<GardeType, string> = {
  volets_ouverts: 'Garde à volets ouverts',
  volets_fermes: 'Garde à volets fermés',
  astreinte: 'Astreinte à domicile',
};

export type MomentGarde = 'nuit' | 'jour' | 'complet';
/**
 * Une garde est « de nuit » quand au moins la moitié se passe entre 20 h et 8 h,
 * « de 24 h » à partir de vingt heures d'affilée, « de jour » sinon (dimanche, jour férié).
 */
export function momentGarde(g: Pick<Garde, 'start' | 'end'>): MomentGarde {
  const duree = g.end > g.start ? g.end - g.start : g.end + 1440 - g.start;
  if (duree >= 20 * 60) return 'complet';
  let nuit = 0;
  for (let t = g.start; t < g.start + duree; t += 15) {
    const h = (t % 1440) / 60;
    if (h >= 20 || h < 8) nuit += 15;
  }
  return nuit * 2 >= duree ? 'nuit' : 'jour';
}
export const MOMENT_GARDE_LABEL: Record<MomentGarde, string> = { nuit: 'de nuit', jour: 'de jour', complet: 'de 24 h' };
export const GARDE_COURT: Record<GardeType, string> = { volets_ouverts: 'volets ouverts', volets_fermes: 'volets fermés', astreinte: 'à domicile' };
/** « Garde de nuit », « Garde de jour », « Astreinte de nuit ». */
export const nomGarde = (g: Pick<Garde, 'start' | 'end' | 'type'>): string => `${g.type === 'astreinte' ? 'Astreinte' : 'Garde'} ${MOMENT_GARDE_LABEL[momentGarde(g)]}`;
/** « Garde de nuit · volets fermés ». */
export const libelleGarde = (g: Pick<Garde, 'start' | 'end' | 'type'>): string => `${nomGarde(g)} · ${GARDE_COURT[g.type]}`;

/** Libellé d'une absence, avec l'intitulé quand c'est une formation. */
export const libelleAbsence = (a: Pick<Absence, 'type' | 'libelle'>): string => (a.type === 'formation' && a.libelle ? `Formation · ${a.libelle}` : ABSENCE_LABEL[a.type]);
/** Classe de couleur d'une absence dans les plannings. */
export const classeAbsence = (type: AbsenceType): string => ({ conge: 'conge', maladie: 'arret', formation: 'formation', autre: 'absence' })[type];

export const ABSENCE_LABEL: Record<AbsenceType, string> = {
  conge: 'Congé',
  maladie: 'Arrêt',
  formation: 'Formation',
  autre: 'Absence',
};

export const nomComplet = (p: Person): string => `${p.prenom} ${p.nom}`;
export const nomCourt = (p: Person): string => `${p.prenom} ${p.nom.charAt(0)}.`;
