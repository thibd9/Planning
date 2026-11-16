import { create } from 'zustand';
import { addDays, mondayOf, todayISO } from '../domain/time';
import type { ISODate } from '../domain/types';

export type Vue = 'construire' | 'resoudre' | 'gardes' | 'equipe' | 'equite' | 'regles' | 'journal' | 'officine';

interface Ui {
  vue: Vue;
  /** Lundi de la semaine affichée dans « Construire ». */
  semaine: ISODate;
  /** 'responsable' ou l'identifiant du salarié dont on regarde l'espace. */
  spectateur: string;
  /** Message bref en bas d'écran, avec annulation possible. */
  toast: { message: string; annulable: boolean } | null;
  focus: { personId?: string; date?: ISODate } | null;
  gardeId: string | null;
  personneId: string | null;
  aller: (vue: Vue) => void;
  setSemaine: (s: ISODate) => void;
  setSpectateur: (s: string) => void;
  dire: (message: string, annulable?: boolean) => void;
  taire: () => void;
  setFocus: (f: Ui['focus']) => void;
  ouvrirGarde: (id: string | null) => void;
  ouvrirPersonne: (id: string | null) => void;
}

export const useUi = create<Ui>((set) => ({
  vue: 'resoudre',
  semaine: addDays(mondayOf(todayISO()), 7),
  spectateur: 'responsable',
  toast: null,
  focus: null,
  gardeId: null,
  personneId: null,
  aller: (vue) => set({ vue, focus: null }),
  setSemaine: (semaine) => set({ semaine, focus: null }),
  setSpectateur: (spectateur) => set({ spectateur }),
  dire: (message, annulable = false) => set({ toast: { message, annulable } }),
  taire: () => set({ toast: null }),
  setFocus: (focus) => set({ focus }),
  ouvrirGarde: (gardeId) => set({ gardeId, vue: 'gardes' }),
  ouvrirPersonne: (personneId) => set({ personneId, vue: 'equipe' }),
}));
