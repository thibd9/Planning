import { create } from 'zustand';
import { addDays, mondayOf, todayISO } from '../domain/time';
import type { ISODate } from '../domain/types';

export type Vue =
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

export type Theme = 'ciel' | 'solvea' | 'sarcelle' | 'bleu' | 'ardoise';
export interface Preferences {
  theme: Theme;
  texte: 'normal' | 'grand';
}
const PREFS_DEFAUT: Preferences = { theme: 'ciel', texte: 'normal' };
const CLE_SESSION = 'releve.session';
const CLE_PREFS = 'releve.preferences';

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
  /** Action demandée depuis la barre du haut, consommée par l'écran d'arrivée (ouvrir une fenêtre). */
  intention: 'garde' | 'personne' | 'demande' | 'formation' | null;
  /** Onglet de « Résoudre » à ouvrir en arrivant (par exemple depuis le parcours de test). */
  sujet: string | null;
  /** Journée ouverte en détail (toute l'équipe, pauses, retards) ; null quand la fenêtre est fermée. */
  jour: ISODate | null;
  voirJour: (d: ISODate | null) => void;
  setSujet: (s: string | null) => void;
  agir: (vue: Vue, intention: Ui['intention']) => void;
  setIntention: (i: Ui['intention']) => void;
  setParcours: (etape: number | null) => void;
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

export const prefsDe = (prefs: Record<string, Preferences>, personId: string | null): Preferences => (personId && prefs[personId]) || PREFS_DEFAUT;

export const useUi = create<Ui>((set) => ({
  vue: 'tableau',
  semaine: addDays(mondayOf(todayISO()), 7),
  session: lire<string | null>(CLE_SESSION, null),
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
  setSujet: (sujet) => set({ sujet }),
  agir: (vue, intention) => set({ vue, intention, focus: null }),
  setIntention: (intention) => set({ intention }),
  setParcours: (parcours) => set({ parcours, tour: null }),
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
