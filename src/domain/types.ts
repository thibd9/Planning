import type { MarqueAnimee, TypeProduit } from './profils';
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
  /** Animateur : les marques qu'il présente, chacune pour les familles de produits choisies par le titulaire. */
  marques?: MarqueAnimee[];
  /** Rayonniste : les familles de produits dont il tient les rayons. */
  rayons?: TypeProduit[];
}

export type Activite = 'comptoir' | 'back' | 'admin' | 'formation' | 'inventaire';

export type Origine = 'manuel' | 'genere' | 'reparation' | 'trame';

/** Une pause courte dans un poste : dix à vingt minutes, lue sur le planning, sans effet sur le décompte des heures. */
export interface PauseCourte {
  start: Minutes;
  end: Minutes;
}

export interface Shift {
  id: string;
  personId: string;
  date: ISODate;
  start: Minutes;
  end: Minutes;
  /** La pause déjeuner : elle coupe le poste et n'est pas comptée dans le temps de travail. */
  pauseStart?: Minutes;
  pauseEnd?: Minutes;
  /** Les pauses courtes du poste. */
  pauses?: PauseCourte[];
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

export type AbsenceType = 'conge' | 'maladie' | 'accident' | 'formation' | 'autre';
export type AbsenceStatut = 'demandee' | 'approuvee' | 'refusee';

/** La raison d'une demande d'absence ou d'horaires : une catégorie, visible des seuls titulaires. */
export type MotifDemande = 'repos' | 'famille' | 'sante' | 'etudes' | 'administratif' | 'personnel';
export const MOTIF_DEMANDE_LABEL: Record<MotifDemande, string> = {
  repos: 'Congés, repos',
  famille: 'Famille, garde d’enfant',
  sante: 'Santé, rendez-vous médical',
  etudes: 'Études, formation',
  administratif: 'Démarche administrative',
  personnel: 'Raison personnelle',
};

export type CadreFormation = 'interne' | 'externe';
export const CADRE_FORMATION_LABEL: Record<CadreFormation, string> = { interne: 'Formation interne', externe: 'Formation externe' };

export interface Absence {
  id: string;
  personId: string;
  from: ISODate;
  to: ISODate;
  type: AbsenceType;
  statut: AbsenceStatut;
  createdAt: string;
  /** Absence imprévue, signalée par la personne elle-même le jour même ou la veille : à traiter en premier. */
  imprevue?: boolean;
  /** Intitulé d'une formation. */
  libelle?: string;
  /** Formation interne (à la pharmacie) ou externe (dans un organisme, à l'extérieur). */
  cadre?: CadreFormation;
  /** Où la formation a lieu. */
  lieu?: string;
  /** La raison donnée par la personne : une catégorie, et une précision si elle le souhaite. Visible des seuls titulaires. */
  motif?: MotifDemande;
  precision?: string;
  /** Accident du travail ou de trajet : les faits utiles à la déclaration, et la date où elle a été faite. */
  accident?: DetailAccident;
}

/** Où l'accident s'est produit : à la pharmacie, pendant une mission à l'extérieur, ou sur le trajet. */
export type LieuAccident = 'travail' | 'mission' | 'trajet';
export const LIEU_ACCIDENT_LABEL: Record<LieuAccident, string> = { travail: 'À la pharmacie', mission: 'En mission à l’extérieur', trajet: 'Sur le trajet' };
export interface DetailAccident {
  /** Le jour de l'accident. */
  jour: ISODate;
  /** L'heure, en minutes depuis minuit, quand elle est connue. */
  heure?: number;
  ou: LieuAccident;
  /** Ce qui s'est passé, en quelques mots : repris tel quel dans la déclaration. */
  circonstances?: string;
  /** Un témoin, ou la première personne prévenue. */
  temoin?: string;
  /** Le jour où l'employeur en a eu connaissance : le délai de déclaration part de là. */
  connuLe: ISODate;
  /** Le jour où le titulaire a noté la déclaration comme faite. */
  declareLe?: ISODate;
}

/**
 * Besoin personnel : une contrainte d'horaires, avec la raison donnée par la personne (une catégorie).
 *  - reconnue    : indisponibilité reconnue, traitée comme une contrainte impérative ;
 *  - prioritaire : préférence prioritaire, plafonnée de la même façon pour tous ;
 *  - preference  : simple préférence.
 */
export type BesoinStatut = 'reconnue' | 'prioritaire' | 'preference';
export type BesoinForme = 'indisponible' | 'finir_avant' | 'commencer_apres';
export type BesoinDecision = 'en_attente' | 'acceptee' | 'refusee';

export interface Besoin {
  id: string;
  /** La raison donnée par la personne ; visible des seuls titulaires. */
  motif?: MotifDemande;
  precision?: string;
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
  /** Les pauses courtes posées avec ce poste. */
  pauses?: PauseCourte[];
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

/** Qui joindre quand Solvi ne sait pas répondre : renseigné par le titulaire. */
/** L'officine en chiffres : des repères sur les locaux, que le titulaire complète s'il les connaît. */
export interface InfosOfficine {
  /** Surface de vente, en mètres carrés. */
  surfaceVente?: number;
  /** Réserve et préparatoire, en mètres carrés. */
  reserve?: number;
  caisses?: number;
  /** Postes de comptoir, où l'on délivre. */
  comptoirs?: number;
  /** Espaces de confidentialité (entretiens, vaccination). */
  confidentialite?: number;
  /** Robot ou automate de dispensation. */
  robot?: boolean;
  /** Clients servis par jour d'ouverture, en moyenne : la mesure d'activité qui sert au dimensionnement de l'équipe. */
  passagesJour?: number;
  /** Temps moyen passé avec un client, en minutes. Sans valeur : 5 minutes, 4 avec un robot. */
  minutesParClient?: number;
  /** Activité annuelle hors taxes, en euros : sert au nombre minimal de pharmaciens adjoints. Reste sur cet appareil. */
  activiteAnnuelle?: number;
}

/** Quand le planning d'un mois doit être transmis à l'équipe, et ce qui se passe si l'échéance est dépassée. */
export interface ReglagePublication {
  /** Le planning du mois est publié au plus tard ce nombre de jours avant le 1er. */
  delai: number;
  /** Le rappel commence ce nombre de jours avant l'échéance. */
  rappel: number;
  /** Échéance dépassée sans rien de fait : Solvéa prépare les semaines vides d'après les habitudes. */
  relais: boolean;
}

export interface Officine {
  nom: string;
  /** Surface totale de l'officine, en mètres carrés. Facultative. */
  surface?: number;
  /** Les autres repères sur les locaux, tous facultatifs. */
  infos?: InfosOfficine;
  /**
   * Afficher les coûts estimés. Désactivé par défaut : Solvéa ne connaît pas les salaires. Activé, il montre des
   * coûts calculés sur les seuls taux horaires que le titulaire a saisis dans les fiches.
   */
  couts?: boolean;
  /** Publication au mois : l'échéance, son rappel, et le relais par Solvéa si rien n'est fait. */
  publication?: Partial<ReglagePublication>;
  /** Le répertoire des marques de la pharmacie : celles qu'on peut confier à un animateur. Il s'enrichit à l'usage. */
  marques?: string[];
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
  /** Brouillon préparé par Solvéa d'après les habitudes, à l'échéance : la date de cette préparation. */
  auto?: string;
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

/**
 * Décision annoncée aux personnes concernées et aux titulaires : ce qui a été décidé,
 * et ce que cela change dans les plannings.
 */
export interface Annonce {
  id: string;
  at: string;
  titre: string;
  /** Ce que la décision change dans les plannings, une phrase par ligne. */
  effets: string[];
  /** Personnes concernées ; les titulaires en font toujours partie. */
  pour: string[];
  /** Qui a décidé. */
  auteur?: string;
  luPar: string[];
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
  /** Le message porte une demande de rendez-vous : la conversation affiche sa carte, avec les réponses possibles. */
  rdvId?: string;
}

/** Rendez-vous entre deux personnes de l'équipe, demandé dans la messagerie puis fixé dans l'agenda des deux. */
export type RdvStatut = 'propose' | 'fixe' | 'decline' | 'annule';
export const RDV_STATUT_LABEL: Record<RdvStatut, string> = { propose: 'En attente de réponse', fixe: 'Fixé dans l’agenda', decline: 'Décliné', annule: 'Annulé' };
export interface RendezVous {
  id: string;
  /** Qui a demandé le rendez-vous. */
  de: string;
  avec: string;
  sujet: string;
  date: ISODate;
  start: Minutes;
  end: Minutes;
  note?: string;
  statut: RdvStatut;
  /** Qui doit répondre : l'autre personne, ou le demandeur après une contre-proposition d'horaire. */
  attend: string;
  at: string;
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
 * Avis de retard donné par la personne elle-même, avant ou pendant sa prise de poste : ses titulaires sont
 * prévenus aussitôt. Ce n'est pas un retard constaté (voir `Ecart`) : c'est ce que la personne annonce.
 */
export type MotifRetard = 'transport' | 'sante' | 'famille' | 'autre';
export const MOTIF_RETARD_LABEL: Record<MotifRetard, string> = { transport: 'Transport', sante: 'Santé', famille: 'Famille', autre: 'Autre raison' };
export interface AvisRetard {
  id: string;
  personId: string;
  date: ISODate;
  /** L'heure de prise de poste prévue : avec la date, elle désigne le poste concerné. */
  start: Minutes;
  /** Le retard annoncé. */
  minutes: number;
  /** Facultatif, vu des seuls titulaires. */
  motif?: MotifRetard;
  note?: string;
  /** Le retard a été noté par un titulaire, pour la personne (elle a prévenu par téléphone, par exemple). */
  par?: string;
  at: string;
}

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

/** Justificatif joint à une demande urgente : vu des seuls titulaires. Une fois la demande tranchée, il est rangé dans les documents du demandeur. */
export interface Justificatif {
  nom: string;
  type: string;
  taille: number;
  /** Contenu (URL de données) ; vide une fois la demande tranchée : le fichier vit alors dans les documents. */
  data: string;
}

export type CategorieDoc = 'arret' | 'justificatif' | 'formation' | 'contrat' | 'autre';
export const CATEGORIE_DOC_LABEL: Record<CategorieDoc, string> = { arret: 'Arrêt de travail', justificatif: 'Justificatif d’absence', formation: 'Attestation de formation', contrat: 'Contrat ou avenant', autre: 'Autre document' };
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
  /** Pièce conservée par les titulaires : d'où elle vient, en clair (« Remplacement du 12 nov. · accepté »). La personne la voit sans pouvoir la retirer. */
  origine?: string;
  /** Absence ou demande de remplacement à laquelle la pièce est rattachée. */
  source?: string;
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
  /** Créneau précis choisi par le titulaire : la tranche ajoutée (rattrapage) ou retirée (récupération). */
  date?: ISODate;
  start?: Minutes;
  end?: Minutes;
  at: string;
  /** Proposée par le calcul automatique. */
  auto?: boolean;
}

/** Demande de remplacement sur un poste publié : le titulaire l'accepte, un collègue se propose, le titulaire confie le poste. */
export type MotifRemplacement = 'sante' | 'famille' | 'administratif' | 'formation' | 'transport' | 'autre';
export const MOTIF_REMPLACEMENT_LABEL: Record<MotifRemplacement, string> = { sante: 'Raison de santé', famille: 'Obligation familiale', administratif: 'Rendez-vous administratif', formation: 'Formation ou examen', transport: 'Problème de transport', autre: 'Autre raison' };

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
  /** Pourquoi la personne demande à être remplacée : une catégorie, et une précision si elle le souhaite. Visible des titulaires. */
  motif?: MotifRemplacement;
  precision?: string;
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
  /** Rendez-vous demandés ou fixés entre membres de l'équipe. */
  rendezVous?: RendezVous[];
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
  /** Décisions annoncées, la plus récente en tête. */
  annonces?: Annonce[];
  /** Les retards que les personnes ont annoncés elles-mêmes. */
  retards?: AvisRetard[];
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
export const libelleAbsence = (a: Pick<Absence, 'type' | 'libelle' | 'cadre' | 'lieu' | 'accident'>): string =>
  a.type === 'formation' && a.libelle ? `${a.cadre ? CADRE_FORMATION_LABEL[a.cadre] : 'Formation'} · ${a.libelle}${a.lieu ? ` (${a.lieu})` : ''}` : a.type === 'accident' && a.accident?.ou === 'trajet' ? 'Accident de trajet' : ABSENCE_LABEL[a.type];
/** Classe de couleur d'une absence dans les plannings. */
export const classeAbsence = (type: AbsenceType): string => ({ conge: 'conge', maladie: 'arret', accident: 'arret', formation: 'formation', autre: 'absence' })[type];

export const ABSENCE_LABEL: Record<AbsenceType, string> = {
  conge: 'Congé',
  maladie: 'Arrêt',
  accident: 'Accident du travail',
  formation: 'Formation',
  autre: 'Absence',
};

export const nomComplet = (p: Person): string => `${p.prenom} ${p.nom}`;
export const nomCourt = (p: Person): string => `${p.prenom} ${p.nom.charAt(0)}.`;
