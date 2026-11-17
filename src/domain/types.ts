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
  | 'rayonniste';

export type CompetenceId = 'vaccination' | 'trod' | 'entretien' | 'orthopedie' | 'commandes';

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

export type Activite = 'comptoir' | 'back' | 'admin' | 'formation';

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
   * n'entre jamais dans le plafond des souhaits prioritaires.
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
}

export interface BesoinEffectif {
  jours: number[];
  start: Minutes;
  end: Minutes;
  /** Nombre minimal de personnes disponibles au comptoir. */
  minEquipe: number;
}

export interface Officine {
  nom: string;
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

/** Demande de remplacement sur un poste publié : un collègue se propose, le responsable valide. */
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
}

export interface AppData {
  officine: Officine;
  messages: Message[];
  remplacements: Remplacement[];
  /** Jeu d'exemple : les identifiants de démonstration sont affichés à la connexion. */
  demo?: boolean;
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
};

export const QUALIFICATION_COURT: Record<Qualification, string> = {
  titulaire: 'Titulaire',
  adjoint: 'Adjoint',
  preparateur: 'Préparateur',
  etudiant: 'Étudiant',
  apprenti: 'Apprenti',
  rayonniste: 'Rayonniste',
};

export const ACTIVITE_LABEL: Record<Activite, string> = {
  comptoir: 'Comptoir',
  back: 'Réception et préparation',
  admin: 'Administratif',
  formation: 'Formation (hors officine)',
};

export const COMPETENCE_LABEL: Record<CompetenceId, string> = {
  vaccination: 'Vaccination',
  trod: 'Tests angine et cystite',
  entretien: 'Entretiens pharmaceutiques',
  orthopedie: 'Orthopédie',
  commandes: 'Commandes',
};

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

export const ABSENCE_LABEL: Record<AbsenceType, string> = {
  conge: 'Congé',
  maladie: 'Arrêt',
  formation: 'Formation',
  autre: 'Absence',
};

export const nomComplet = (p: Person): string => `${p.prenom} ${p.nom}`;
export const nomCourt = (p: Person): string => `${p.prenom} ${p.nom.charAt(0)}.`;
