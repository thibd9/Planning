import { create } from 'zustand';
import { addDays, mondayOf, todayISO } from '../domain/time';
import { estResponsable } from '../domain/acces';
import type { AppData, ISODate, Person, Qualification } from '../domain/types';

export type Vue =
  | 'aide'
  | 'documents'
  | 'heures'
  | 'demandes'
  | 'suivi'
  | 'construire'
  | 'resoudre'
  | 'gardes'
  | 'equipe'
  | 'equite'
  | 'regles'
  | 'journal'
  | 'officine'
  | 'tableau'
  | 'messages'
  | 'nouvelle'
  | 'moi'
  | 'espace'
  | 'planning'
  | 'mesgardes'
  | 'compte';

export type Theme = 'ciel' | 'solvea' | 'indigo' | 'bleu' | 'sarcelle' | 'emeraude' | 'ambre' | 'corail' | 'rose' | 'ardoise';
/** Clair ; mixte : le menu foncé, le contenu clair ; sombre ; auto : comme l'appareil. */
export type Mode = 'clair' | 'mixte' | 'sombre' | 'auto';
export interface Preferences {
  theme: Theme;
  texte: 'normal' | 'grand';
  /** Clair, sombre, ou comme l'appareil. */
  mode: Mode;
}
const PREFS_DEFAUT: Preferences = { theme: 'ciel', texte: 'normal', mode: 'clair' };
/** Ce qu'une personne a réglé elle-même ; le reste suit les valeurs par défaut, dont la couleur de son profil. */
export type PrefsChoisies = Partial<Preferences>;

/** Chaque profil a sa couleur de base : on sait d'un coup d'œil dans quel espace on se trouve. */
const THEME_PROFIL: Record<Qualification, Theme> = { titulaire: 'bleu', adjoint: 'sarcelle', preparateur: 'indigo', animateur: 'rose', apprenti: 'emeraude', etudiant: 'ambre', rayonniste: 'corail' };
/**
 * La couleur de base d'une personne : bleu ciel pour le titulaire principal, bleu marine pour un autre titulaire,
 * bleu-vert pour un pharmacien adjoint, indigo pour un préparateur, framboise pour un animateur, vert pour un
 * apprenti, ambre pour un étudiant, terracotta pour un rayonniste. Chacun peut en choisir une autre dans son compte.
 */
export function themeDuProfil(data: Pick<AppData, 'officine' | 'personnes'>, p: Person | undefined): Theme {
  if (!p || estResponsable(data, p)) return 'ciel';
  return THEME_PROFIL[p.qualification] ?? 'ciel';
}
const CLE_SESSION = 'releve.session';
const CLE_PREFS = 'releve.preferences';
const CLE_PREFS_VERSION = 'releve.preferences.version';
/**
 * Avant les couleurs par profil, chaque réglage enregistrait aussi le bleu ciel par défaut :
 * ce bleu-là n'était pas un choix, il est retiré une fois pour que la couleur du profil s'applique.
 */
function prefsLues(): Record<string, PrefsChoisies> {
  const prefs = lire<Record<string, PrefsChoisies>>(CLE_PREFS, {});
  if (lire<number>(CLE_PREFS_VERSION, 1) >= 2) return prefs;
  const propres = Object.fromEntries(Object.entries(prefs).map(([cle, p]) => [cle, p.theme === 'ciel' ? { texte: p.texte, mode: p.mode } : p]));
  ecrire(CLE_PREFS, propres);
  ecrire(CLE_PREFS_VERSION, 2);
  return propres;
}

/** Les comptes de l'exemple ont changé de nom : une session ouverte avec un ancien identifiant suit. */
const ANCIENS_COMPTES: Record<string, string> = { 'helene.marchetti': 'caroline.tellier', 'antoine.mercier': 'pierre.fiandino', 'karim.benali': 'igor.lerusse', 'camille.roussel': 'nicolas.lesyndicaliste' };
const sessionAJour = (s: string | null): string | null => (s && ANCIENS_COMPTES[s] ? ANCIENS_COMPTES[s] : s);

function lire<T>(cle: string, defaut: T): T {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : defaut;
  } catch {
    return defaut;
  }
}
function ecrire(cle: string, valeur: unknown): void {
  try {
    if (valeur === null) localStorage.removeItem(cle);
    else localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    // Sans stockage, la session et les préférences ne durent que le temps de la visite.
  }
}

interface Ui {
  vue: Vue;
  /** Lundi de la semaine affichée dans « Construire ». */
  semaine: ISODate;
  /** Identifiant de connexion de la personne connectée ; null quand personne n'est connecté. */
  session: string | null;
  /** Préférences d'affichage, propres à chaque personne. */
  preferences: Record<string, PrefsChoisies>;
  /** Message bref en bas d'écran, avec annulation possible. */
  /** `suite` : un bouton qui mène à l'endroit que le message concerne. */
  toast: { message: string; annulable: boolean; suite?: { label: string; faire: () => void } } | null;
  focus: { personId?: string; date?: ISODate } | null;
  gardeId: string | null;
  personneId: string | null;
  /** Étape du tutoriel en cours ; null quand il est fermé. */
  tour: number | null;
  /** Étape du parcours de test en cours ; null quand il est fermé. */
  parcours: number | null;
  /** Parcours guidé en cours : la visite complète, ou la journée d'une pharmacie déjà en place. */
  scenario: 'complet' | 'etabli' | 'pharmacien' | 'equipe';
  /** Tutoriel d'une seule tâche : la visite ne joue que ces étapes, de la première à la dernière incluse. */
  tache: { de: number; a: number } | null;
  /** Fenêtre de choix des tutoriels. */
  tutoriels: boolean;
  ouvrirTutoriels: (o: boolean) => void;
  /** Action demandée depuis la barre du haut, consommée par l'écran d'arrivée (ouvrir une fenêtre). */
  intention: 'garde' | 'personne' | 'demande' | 'formation' | 'inventaire' | 'calendrier' | 'semaine' | null;
  /** Onglet de « Résoudre » à ouvrir en arrivant (par exemple depuis le parcours de test). */
  sujet: string | null;
  /** Journée ouverte en détail (toute l'équipe, pauses, retards) ; null quand la fenêtre est fermée. */
  jour: ISODate | null;
  voirJour: (d: ISODate | null) => void;
  /** Planning global : à la semaine ou au mois ; toute l'équipe ou seulement mes postes. */
  /** Demande de remplacement à mettre en avant en arrivant dans « Résoudre ». */
  demandeVisee: string | null;
  viserDemande: (id: string | null) => void;
  /** Conversation à ouvrir en arrivant dans les messages. */
  filVise: string | null;
  viserFil: (id: string | null) => void;
  /** Onglet ouvert dans « Mes demandes » ; null = celui qui convient le mieux. */
  demandesOnglet: 'souhaits' | 'absences' | 'remplacements' | null;
  setDemandesOnglet: (o: 'souhaits' | 'absences' | 'remplacements' | null) => void;
  /** Fenêtre « Signaler un retard ou une absence » demandée depuis ailleurs (Solvi, par exemple). */
  signalement: 'retard' | 'absence' | 'choix' | null;
  signaler: (quoi: Ui['signalement']) => void;
  /** Aperçu avant impression : la période et le jour de départ ; null quand il est fermé. */
  impression: { periode: 'semaine' | 'mois'; repere: ISODate; moi?: boolean } | null;
  ouvrirImpression: (i: Ui['impression']) => void;
  /** Assistant d'aide ouvert. */
  assistant: boolean;
  ouvrirAssistant: (o: boolean) => void;
  /** Pendant une visite guidée, le bouton d'aide ne s'affiche que quand l'étape le présente. */
  assistantEnVisite: boolean;
  montrerAssistant: (b: boolean) => void;
  planVue: 'semaine' | 'mois';
  setPlanVue: (v: 'semaine' | 'mois') => void;
  seulementMoi: boolean;
  setSeulementMoi: (b: boolean) => void;
  setSujet: (s: string | null) => void;
  agir: (vue: Vue, intention: Ui['intention']) => void;
  setIntention: (i: Ui['intention']) => void;
  /** `tache` absente : on reste dans le tutoriel en cours ; null : la visite entière. */
  setParcours: (etape: number | null, scenario?: Ui['scenario'], tache?: Ui['tache']) => void;
  aller: (vue: Vue) => void;
  setSemaine: (s: ISODate) => void;
  connecter: (personId: string, vue: Vue) => void;
  deconnecter: () => void;
  /** Remise à zéro : rien ne doit rester sur l'appareil, pas même un identifiant dans les préférences. */
  toutOublier: () => void;
  setPreferences: (personId: string, p: Partial<Preferences>) => void;
  /** Ces personnes retrouvent la couleur de leur profil : la visite guidée repart ainsi des couleurs par défaut. */
  oublierCouleurs: (identifiants: string[]) => void;
  dire: (message: string, annulable?: boolean, suite?: { label: string; faire: () => void }) => void;
  taire: () => void;
  setFocus: (f: Ui['focus']) => void;
  ouvrirGarde: (id: string | null) => void;
  ouvrirPersonne: (id: string | null) => void;
  setTour: (etape: number | null) => void;
}

// Ce qui n'a pas été réglé reçoit sa valeur par défaut ; pour la couleur, c'est celle du profil.
// `couleurLibre` : seul le titulaire principal choisit sa couleur ; pour les autres, la couleur est celle du profil,
// quoi qu'ils aient pu enregistrer auparavant.
export const prefsDe = (prefs: Record<string, PrefsChoisies>, personId: string | null, themeProfil: Theme = PREFS_DEFAUT.theme, couleurLibre = true): Preferences => {
  const choisies = personId ? prefs[personId] : undefined;
  return { theme: (couleurLibre ? choisies?.theme : undefined) ?? themeProfil, texte: choisies?.texte ?? PREFS_DEFAUT.texte, mode: choisies?.mode ?? PREFS_DEFAUT.mode };
};

export const useUi = create<Ui>((set) => ({
  vue: 'tableau',
  semaine: addDays(mondayOf(todayISO()), 7),
  session: sessionAJour(lire<string | null>(CLE_SESSION, null)),
  preferences: prefsLues(),
  toast: null,
  focus: null,
  gardeId: null,
  personneId: null,
  tour: null,
  parcours: null,
  intention: null,
  sujet: null,
  jour: null,
  voirJour: (jour) => set({ jour }),
  demandeVisee: null,
  viserDemande: (demandeVisee) => set({ demandeVisee }),
  filVise: null,
  viserFil: (filVise) => set({ filVise }),
  demandesOnglet: null,
  setDemandesOnglet: (demandesOnglet) => set({ demandesOnglet }),
  signalement: null,
  signaler: (signalement) => set({ signalement }),
  impression: null,
  ouvrirImpression: (impression) => set({ impression }),
  assistant: false,
  ouvrirAssistant: (assistant) => set({ assistant }),
  assistantEnVisite: false,
  montrerAssistant: (assistantEnVisite) => set({ assistantEnVisite }),
  planVue: 'semaine',
  setPlanVue: (planVue) => set({ planVue }),
  seulementMoi: false,
  setSeulementMoi: (seulementMoi) => set({ seulementMoi }),
  setSujet: (sujet) => set({ sujet }),
  agir: (vue, intention) => set({ vue, intention, focus: null }),
  setIntention: (intention) => set({ intention }),
  scenario: 'etabli',
  tache: null,
  tutoriels: false,
  ouvrirTutoriels: (tutoriels) => set({ tutoriels }),
  setParcours: (parcours, scenario, tache) => set((s) => ({ parcours, tour: null, tutoriels: false, scenario: scenario ?? s.scenario, tache: parcours === null ? null : tache === undefined ? s.tache : tache })),
  aller: (vue) => set({ vue, focus: null }),
  setSemaine: (semaine) => set({ semaine, focus: null }),
  connecter: (session, vue) => {
    ecrire(CLE_SESSION, session);
    set({ session, vue, focus: null, toast: null });
  },
  deconnecter: () => {
    ecrire(CLE_SESSION, null);
    set({ session: null, tour: null, parcours: null, toast: null });
  },
  toutOublier: () => {
    ecrire(CLE_SESSION, null);
    ecrire(CLE_PREFS, {});
    set({ session: null, preferences: {}, tour: null, parcours: null, toast: null });
  },
  setPreferences: (personId, p) =>
    set((s) => {
      const preferences = { ...s.preferences, [personId]: { ...s.preferences[personId], ...p } };
      ecrire(CLE_PREFS, preferences);
      return { preferences };
    }),
  oublierCouleurs: (identifiants) =>
    set((s) => {
      const preferences = Object.fromEntries(Object.entries(s.preferences).map(([cle, p]) => (identifiants.includes(cle) ? [cle, { texte: p.texte, mode: p.mode }] : [cle, p])));
      ecrire(CLE_PREFS, preferences);
      return { preferences };
    }),
  dire: (message, annulable = false, suite) => set({ toast: { message, annulable, ...(suite ? { suite } : {}) } }),
  taire: () => set({ toast: null }),
  setFocus: (focus) => set({ focus }),
  ouvrirGarde: (gardeId) => set({ gardeId, vue: 'gardes' }),
  ouvrirPersonne: (personneId) => set({ personneId, vue: 'equipe' }),
  setTour: (tour) => set({ tour }),
}));
