import { create } from 'zustand';
import { addDays, mondayOf, todayISO } from '../domain/time';
import type { ISODate } from '../domain/types';

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
  | 'planning'
  | 'mesgardes'
  | 'compte';

export type Theme = 'ciel' | 'solvea' | 'indigo' | 'bleu' | 'sarcelle' | 'emeraude' | 'ambre' | 'corail' | 'rose' | 'ardoise';
export type Mode = 'clair' | 'sombre' | 'auto';
export interface Preferences {
  theme: Theme;
  texte: 'normal' | 'grand';
  /** Clair, sombre, ou comme l'appareil. */
  mode: Mode;
}
const PREFS_DEFAUT: Preferences = { theme: 'ciel', texte: 'normal', mode: 'clair' };
const CLE_SESSION = 'releve.session';
const CLE_PREFS = 'releve.preferences';

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
  preferences: Record<string, Preferences>;
  /** Message bref en bas d'écran, avec annulation possible. */
  toast: { message: string; annulable: boolean } | null;
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
  /** Onglet ouvert dans « Mes demandes » ; null = celui qui convient le mieux. */
  demandesOnglet: 'souhaits' | 'absences' | 'remplacements' | null;
  setDemandesOnglet: (o: 'souhaits' | 'absences' | 'remplacements' | null) => void;
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
  dire: (message: string, annulable?: boolean) => void;
  taire: () => void;
  setFocus: (f: Ui['focus']) => void;
  ouvrirGarde: (id: string | null) => void;
  ouvrirPersonne: (id: string | null) => void;
  setTour: (etape: number | null) => void;
}

// Les préférences enregistrées avant l'arrivée d'un réglage reçoivent sa valeur par défaut.
export const prefsDe = (prefs: Record<string, Preferences>, personId: string | null): Preferences => ({ ...PREFS_DEFAUT, ...(personId ? prefs[personId] : undefined) });

export const useUi = create<Ui>((set) => ({
  vue: 'tableau',
  semaine: addDays(mondayOf(todayISO()), 7),
  session: sessionAJour(lire<string | null>(CLE_SESSION, null)),
  preferences: lire<Record<string, Preferences>>(CLE_PREFS, {}),
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
  demandesOnglet: null,
  setDemandesOnglet: (demandesOnglet) => set({ demandesOnglet }),
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
      const preferences = { ...s.preferences, [personId]: { ...prefsDe(s.preferences, personId), ...p } };
      ecrire(CLE_PREFS, preferences);
      return { preferences };
    }),
  dire: (message, annulable = false) => set({ toast: { message, annulable } }),
  taire: () => set({ toast: null }),
  setFocus: (focus) => set({ focus }),
  ouvrirGarde: (gardeId) => set({ gardeId, vue: 'gardes' }),
  ouvrirPersonne: (personneId) => set({ personneId, vue: 'equipe' }),
  setTour: (tour) => set({ tour }),
}));
