import { create } from 'zustand';
import { seed, vierge } from '../data/seed';
import { estSecondaire } from '../domain/acces';
import { REGLES_INITIALES } from '../domain/rules';
import { addDays, dayIndex, fmtDateCourt, fmtDuree, fmtHHMM, fmtSemaine, fromDayIndex, todayISO, uid, weekDates } from '../domain/time';
import type {
  Absence,
  AppData,
  Besoin,
  BesoinStatut,
  EcartType,
  Garde,
  ISODate,
  JournalEntry,
  Justificatif,
  Mission,
  Officine,
  Person,
  Regle,
  RegulType,
  Regularisation,
  Shift,
  Souhait,
  SouhaitChoix,
  Urgence,
} from '../domain/types';
import { ABSENCE_LABEL, ECART_LABEL, GARDE_LABEL, REGUL_LABEL, URGENCE_LABEL, nomCourt } from '../domain/types';
import { decrireBesoin, minutesSemaine, shiftsSemaine } from '../engine/core';
import { reposApresGarde } from '../engine/gardes';
import type { GenResult } from '../engine/generate';
import { VARIANTE_LABEL } from '../engine/generate';
import { changementsSemaine, controlePublication } from '../engine/publish';
import type { RepairOption } from '../engine/repair';
import { appliquerPatch, optionsReparation } from '../engine/repair';
import { depannagesDe, tourDeRole, tourRemplacement } from '../engine/appel';
import { generer } from '../engine/generate';
import { cibleSemaine, proposerRegularisations, semaineLibre } from '../engine/heures';
import type { Correction } from '../engine/souhaits';

const KEY = 'releve.v3';

/** Ce qui est enregistré : toutes les pharmacies de l'appareil, et celle qui est ouverte. */
interface Enregistrement {
  courante: string;
  officines: Record<string, AppData>;
}

function normaliser(d: AppData): AppData {
  // Les données enregistrées avant une mise à jour reçoivent les nouveautés : listes vides, fiches de règles ajoutées.
  const manquantes = REGLES_INITIALES.filter((r) => !d.regles.some((x) => x.id === r.id)).map((r) => ({ ...r }));
  return { ...d, souhaits: d.souhaits ?? [], regularisations: d.regularisations ?? [], messages: d.messages ?? [], remplacements: d.remplacements ?? [], ecarts: d.ecarts ?? [], accords: d.accords ?? [], regles: manquantes.length ? d.regles.concat(manquantes) : d.regles };
}

function charger(): { officineId: string; data: AppData; autres: Record<string, AppData> } {
  try {
    const brut = localStorage.getItem(KEY);
    if (brut) {
      const e = JSON.parse(brut) as Enregistrement;
      const d = e?.officines?.[e.courante];
      if (d && d.officine && Array.isArray(d.shifts) && Array.isArray(d.regles)) {
        const autres: Record<string, AppData> = {};
        for (const [id, x] of Object.entries(e.officines)) if (id !== e.courante) autres[id] = normaliser(x);
        return { officineId: e.courante, data: normaliser(d), autres };
      }
    }
  } catch {
    // Stockage indisponible ou illisible : on repart d'une application vierge.
  }
  return { officineId: uid('off'), data: vierge(), autres: {} };
}

const now = (): string => new Date().toISOString();

function journal(d: AppData, e: Omit<JournalEntry, 'id' | 'at' | 'regles'> & { regles?: boolean }): AppData {
  const { regles, ...rest } = e;
  const entry: JournalEntry = {
    id: uid('j'),
    at: now(),
    ...rest,
    ...(regles ? { regles: d.regles.map((r) => `${r.id}@${r.version}`) } : {}),
  };
  return { ...d, journal: [entry, ...d.journal] };
}

const nom = (d: AppData, id: string | null | undefined): string => {
  const p = d.personnes.find((x) => x.id === id);
  return p ? nomCourt(p) : 'Personne';
};

/** « · +4 h sur le contrat cette semaine » : ce que le poste repris ajoute au compteur du remplaçant. */
function ecartContrat(d: AppData, personId: string, monday: ISODate): string {
  const p = d.personnes.find((x) => x.id === personId);
  if (!p || !p.salarie) return '';
  const ecart = minutesSemaine(d, personId, monday) - cibleSemaine(d, p, monday);
  return ecart > 0 ? ` · +${fmtDuree(ecart)} sur le contrat cette semaine` : '';
}

/** Retire les postes d'une personne absente et ouvre un trou à résoudre pour chaque poste à venir. */
function appliquerAbsence(d: AppData, a: Absence, today: ISODate): AppData {
  const retires = d.shifts.filter((s) => s.personId === a.personId && s.date >= a.from && s.date <= a.to);
  if (!retires.length) return d;
  return {
    ...d,
    shifts: d.shifts.filter((s) => !retires.includes(s)),
    trous: d.trous.concat(
      retires
        .filter((s) => dayIndex(s.date) >= dayIndex(today))
        .map((shift) => ({ id: uid('t'), absenceId: a.id, shift, statut: 'ouvert' as const })),
    ),
  };
}

export interface Store {
  /** Pharmacie ouverte. Les autres pharmacies de l'appareil sont dans `autres`. */
  officineId: string;
  data: AppData;
  autres: Record<string, AppData>;
  today: ISODate;
  past: AppData[];
  future: AppData[];
  derniereSauvegarde: string;

  undo: () => void;
  redo: () => void;
  reinitialiser: () => void;
  /** Remplace les données par l'équipe d'exemple (annulable). */
  /** Ouvre l'environnement de test à côté des vraies pharmacies ; `neuf` repart de données d'exemple fraîches. */
  chargerExemple: (neuf?: boolean, depart?: 'etabli' | 'vide' | 'zero') => void;
  /** Personne connectée : sert à savoir si une décision doit attendre l'accord du titulaire principal. */
  /** Vrai pendant qu'une décision acceptée est rejouée : elle ne repart pas en attente. */
  direct: boolean;
  acteur: string | null;
  setActeur: (id: string | null) => void;
  /** Dépose une décision en attente d'accord (titulaire secondaire). */
  proposer: (auteur: string, action: string, args: unknown[]) => void;
  /** Le titulaire principal donne son accord : la décision est appliquée maintenant. */
  donnerAccord: (id: string) => void;
  /** Refus par le titulaire principal, ou retrait par l'auteur : rien n'est appliqué. */
  ecarterAccord: (id: string, refus: boolean) => void;
  /** Crée l'officine depuis l'écran d'accueil : nom, horaires et première équipe. */
  /** `ajout` garde les pharmacies existantes ; `nouvelleCle` vaut pour un autre titulaire, qui reçoit sa propre clé de secours. */
  creerOfficine: (nom: string, horaires: Officine['horaires'], personnes: Person[], ajout?: boolean, nouvelleCle?: boolean) => void;
  /** Un même identifiant peut avoir un compte dans plusieurs pharmacies : le mot de passe change partout. */
  definirMotDePasse: (identifiant: string, code: string) => void;
  changerOfficine: (id: string) => void;
  envoyerMessage: (de: string, a: string, texte: string) => void;
  lireFil: (moi: string, fil: string) => void;
  demanderRemplacement: (shift: Shift, urgence?: Urgence, justificatif?: Justificatif) => void;
  /** Le titulaire répond à la demande elle-même : oui (l'équipe est alors prévenue) ou non. */
  deciderDemande: (id: string, accepter: boolean) => void;
  regulariser: (r: Pick<Regularisation, 'personId' | 'minutes' | 'type' | 'semaine'>) => void;
  retirerRegularisation: (id: string) => void;
  /** Résorbe tous les compteurs sur la première semaine non publiée et recalcule son brouillon. */
  regulariserAuto: () => void;
  seProposer: (id: string, personId: string, oui: boolean) => void;
  cloreRemplacement: (id: string, statut: 'refusee' | 'annulee') => void;
  validerRemplacement: (id: string, remplacantId: string) => void;
  /** Absence à couvrir : prévient en même temps tous ceux qui peuvent tenir le poste. */
  appelerEquipe: (trouId: string) => void;
  /** Répondre « je ne peux pas » à un appel : sans effet sur le rang dans le tour de rôle. */
  declinerAppel: (id: string, personId: string) => void;
  /** Souhait du mois pour un jour ; null l'efface. */
  poserSouhait: (personId: string, date: ISODate, choix: SouhaitChoix | null) => void;
  poserSouhaits: (liste: Souhait[]) => void;
  /** Applique au brouillon le recalcul des semaines non publiées d'un mois. */
  appliquerCorrection: (mois: string, c: Correction) => void;

  saveShift: (s: Shift) => void;
  deleteShift: (id: string) => void;
  moveShift: (id: string, personId: string, date: ISODate) => void;
  appliquerGeneration: (monday: ISODate, res: GenResult) => void;
  viderSemaine: (monday: ISODate) => void;
  copierSemaine: (source: ISODate, cible: ISODate) => void;
  publier: (monday: ISODate, accords: string[], bloquantsAssumes: number) => void;

  declarerAbsence: (a: Omit<Absence, 'id' | 'createdAt'>) => void;
  /** Formation planifiée par le responsable : une absence approuvée par participant, chacun prévenu. */
  /** Écart de présence constaté par le responsable (retard, départ anticipé, absence non prévue). */
  signalerEcart: (e: { personId: string; date: ISODate; type: EcartType; minutes?: number }) => void;
  retirerEcart: (id: string) => void;
  planifierFormation: (f: { intitule: string; personnes: string[]; from: ISODate; to: ISODate }) => void;
  /** Inventaire : un poste « inventaire » par participant, visible aussitôt et notifié. */
  planifierInventaire: (i: { date: ISODate; start: number; end: number; personnes: string[] }) => void;
  deciderAbsence: (id: string, approuver: boolean) => void;
  resoudreTrou: (id: string, option: RepairOption) => void;
  /** Applique, jour après jour, l'option conseillée à chaque poste découvert par une absence. */
  resoudreAbsence: (absenceId: string) => void;

  ajouterBesoin: (b: Omit<Besoin, 'id' | 'createdAt'>) => void;
  deciderBesoin: (id: string, accepter: boolean, statut?: BesoinStatut) => void;
  supprimerBesoin: (id: string) => void;

  /** Les gardes déjà confiées sont notifiées à la personne quand `prevenir` est vrai. */
  ajouterGardes: (g: Omit<Garde, 'id'>[], prevenir?: boolean) => void;
  affecterGarde: (id: string, personId: string | null, exceptionnel: boolean) => void;
  /** Applique d'un coup une répartition proposée, tracée au journal avec ses raisons. */
  affecterGardes: (liste: { gardeId: string; personId: string; raison: string }[]) => void;
  majGarde: (id: string, patch: Partial<Garde>) => void;
  supprimerGarde: (id: string) => void;
  ajouterIntervention: (id: string, offset: number, duree: number) => void;
  retirerIntervention: (id: string, interventionId: string) => void;
  corrigerRepos: (gardeId: string, shiftId: string) => void;
  validerGarde: (id: string) => void;

  majPersonne: (p: Person) => void;
  supprimerPersonne: (id: string) => void;
  majOfficine: (patch: Partial<Officine>) => void;
  majRegle: (id: string, patch: Partial<Pick<Regle, 'valeur' | 'active'>>) => void;
  majMission: (id: string, patch: Partial<Mission>) => void;
  lireNotification: (id: string) => void;
}

/** Avis déposé dans l'espace d'une personne quand une garde lui est confiée ou retirée. */
function avisGarde(g: Pick<Garde, 'date' | 'start' | 'end' | 'type'>, personId: string, confiee: boolean, at: string, today: ISODate): AppData['notifications'][number] {
  const libelle = `${GARDE_LABEL[g.type]}, ${fmtHHMM(g.start)} → ${fmtHHMM(g.end)}`;
  return { id: uid('n'), personId, at, date: g.date, avant: confiee ? 'Pas de garde' : libelle, apres: confiee ? libelle : 'Garde retirée', tardif: dayIndex(g.date) - dayIndex(today) < 15 };
}

/**
 * Décisions qui engagent l'équipe : venant d'un titulaire secondaire, elles attendent l'accord du principal.
 * Les brouillons de planning et la saisie des fiches restent libres.
 */
const SOUMISES = ['deciderDemande', 'regulariser', 'regulariserAuto', 'publier', 'resoudreTrou', 'resoudreAbsence', 'deciderAbsence', 'deciderBesoin', 'validerRemplacement', 'affecterGarde', 'affecterGardes', 'ajouterGardes', 'planifierFormation', 'planifierInventaire', 'declarerAbsence', 'supprimerPersonne', 'signalerEcart', 'majPersonne'] as const;

function titreAccord(d: AppData, action: string, args: unknown[]): string {
  const a = args as never[];
  const qui = (id: unknown): string => nom(d, typeof id === 'string' ? id : null);
  switch (action) {
    case 'publier':
      return `Publier la semaine du ${fmtSemaine(a[0])}`;
    case 'deciderDemande': {
      const r = d.remplacements.find((y) => y.id === a[0]);
      return `${a[1] ? 'Accepter' : 'Refuser'} la demande de remplacement de ${qui(r?.demandeur)}${r ? ` du ${fmtDateCourt(r.date)}` : ''}`;
    }
    case 'regulariser':
      return `Compteur d’heures de ${qui((a[0] as { personId: string }).personId)} : ${REGUL_LABEL[(a[0] as { type: RegulType }).type].toLowerCase()}`;
    case 'regulariserAuto':
      return 'Régulariser automatiquement les compteurs d’heures';
    case 'resoudreTrou': {
      const t = d.trous.find((x) => x.id === a[0]);
      return `Absence de ${qui(t?.shift.personId)}${t ? ` le ${fmtDateCourt(t.shift.date)}` : ''} : ${String((a[1] as { titre?: string })?.titre ?? 'option choisie').toLowerCase()}`;
    }
    case 'resoudreAbsence':
      return `Régler l’absence de ${qui(d.absences.find((x) => x.id === a[0])?.personId)} avec les options conseillées`;
    case 'deciderAbsence': {
      const x = d.absences.find((y) => y.id === a[0]);
      return `${a[1] ? 'Approuver' : 'Refuser'} : ${x ? ABSENCE_LABEL[x.type].toLowerCase() : 'absence'} de ${qui(x?.personId)}`;
    }
    case 'deciderBesoin':
      return `${a[1] ? 'Accepter' : 'Refuser'} la demande d’horaires de ${qui(d.besoins.find((y) => y.id === a[0])?.personId)}`;
    case 'validerRemplacement': {
      const r = d.remplacements.find((y) => y.id === a[0]);
      return `Remplacement${r ? ` du ${fmtDateCourt(r.date)}` : ''} : ${qui(a[1])} remplace ${qui(r?.demandeur)}`;
    }
    case 'affecterGarde': {
      const g = d.gardes.find((y) => y.id === a[0]);
      return a[1] ? `Confier la garde${g ? ` du ${fmtDateCourt(g.date)}` : ''} à ${qui(a[1])}` : `Retirer l’affectation de la garde${g ? ` du ${fmtDateCourt(g.date)}` : ''}`;
    }
    case 'affecterGardes':
      return `Répartir ${(a[0] as unknown[]).length} garde${(a[0] as unknown[]).length > 1 ? 's' : ''}`;
    case 'ajouterGardes':
      return `Ajouter ${(a[0] as unknown[]).length} garde${(a[0] as unknown[]).length > 1 ? 's' : ''} au calendrier`;
    case 'planifierFormation':
      return `Formation « ${String((a[0] as { intitule?: string })?.intitule ?? '')} »`;
    case 'planifierInventaire':
      return `Inventaire le ${fmtDateCourt((a[0] as { date: ISODate }).date)}`;
    case 'declarerAbsence':
      return `Enregistrer : ${ABSENCE_LABEL[(a[0] as Absence).type].toLowerCase()} de ${qui((a[0] as Absence).personId)}`;
    case 'supprimerPersonne':
      return `Retirer ${qui(a[0])} de l’équipe`;
    case 'signalerEcart':
      return `Noter : ${ECART_LABEL[(a[0] as { type: EcartType }).type].toLowerCase()} de ${qui((a[0] as { personId: string }).personId)}`;
    case 'majPersonne': {
      const p = a[0] as Person;
      return d.personnes.some((x) => x.id === p.id) ? `Changer l’accès de ${p.prenom} ${p.nom} à la gestion` : `Ajouter ${p.prenom} ${p.nom} à l’équipe`;
    }
    default:
      return 'Décision';
  }
}

/** Enveloppe les décisions : proposées par un titulaire secondaire, elles sont mises en attente d'accord. */
function soumettre(m: Store, get: () => Store): Store {
  const out = { ...m } as unknown as Record<string, unknown>;
  for (const action of SOUMISES) {
    const original = m[action] as unknown as (...x: unknown[]) => void;
    out[action] = (...args: unknown[]): void => {
      const s = get();
      const auteur = s.data.personnes.find((p) => p.id === s.acteur);
      // Une fiche se corrige librement ; seuls l'ajout d'une personne et le droit de gestion sont des décisions.
      const fiche = action === 'majPersonne' ? (args[0] as Person) : null;
      const anodin = fiche ? (s.data.personnes.find((p) => p.id === fiche.id)?.gestion ?? false) === (fiche.gestion ?? false) && s.data.personnes.some((p) => p.id === fiche.id) : false;
      if (!s.direct && !anodin && estSecondaire(s.data, auteur)) return s.proposer((auteur as Person).id, action, args);
      original(...args);
    };
  }
  return out as unknown as Store;
}

export const useStore = create<Store>((set, get) => {
  /** Applique un changement ; `annulable` l'ajoute à l'historique des manipulations. */
  const commit = (fn: (d: AppData, today: ISODate) => AppData, annulable = true): void => {
    set((s) => {
      const data = fn(s.data, s.today);
      if (data === s.data) return s;
      return {
        data,
        past: annulable ? [...s.past.slice(-40), s.data] : s.past,
        future: annulable ? [] : s.future,
      };
    });
  };

  const magasin: Store = {
    ...charger(),
    today: todayISO(),
    past: [],
    future: [],
    derniereSauvegarde: now(),

    undo: () =>
      set((s) => (s.past.length ? { data: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.data, ...s.future] } : s)),
    redo: () => set((s) => (s.future.length ? { data: s.future[0], future: s.future.slice(1), past: [...s.past, s.data] } : s)),
    reinitialiser: () => set({ officineId: uid('off'), data: vierge(), autres: {}, past: [], future: [] }),
    creerOfficine: (nom, horaires, personnes, ajout, nouvelleCle) =>
      set((etat) => {
        const base = vierge();
        const postes = base.officine.postes
          .map((x) => ({ ...x, jours: x.jours.filter((j) => horaires[j].length > 0) }))
          .filter((x) => x.jours.length > 0);
        const data: AppData = {
          ...base,
          officine: {
            ...base.officine,
            nom,
            responsableId: personnes.find((x) => x.qualification === 'titulaire')?.id,
            secours: (!nouvelleCle && etat.data.officine.secours) || `${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
            horaires,
            postes,
            effectifs: base.officine.effectifs.filter((e) => e.jours.some((j) => horaires[j].length > 0)),
          },
          personnes,
        };
        return {
          data: journal(data, {
            type: 'regle',
            titre: `Officine « ${nom} » créée`,
            detail: `${personnes.length} personne${personnes.length > 1 ? 's' : ''} dans l'équipe. Horaires, postes types et seuils sont modifiables dans « Officine ».`,
          }),
          // Une pharmacie ajoutée s'ouvre aussitôt ; celle qu'on quitte reste enregistrée à côté.
          ...(ajout ? { officineId: uid('off'), autres: { ...etat.autres, [etat.officineId]: etat.data } } : {}),
          past: [],
          future: [],
        };
      }),
    definirMotDePasse: (identifiant, code) =>
      set((s) => {
        const cible = identifiant.trim().toLowerCase();
        const maj = (d: AppData): AppData =>
          d.personnes.some((x) => x.identifiant?.trim().toLowerCase() === cible)
            ? { ...d, personnes: d.personnes.map((x) => (x.identifiant?.trim().toLowerCase() === cible ? { ...x, code, provisoire: undefined } : x)) }
            : d;
        return { data: maj(s.data), autres: Object.fromEntries(Object.entries(s.autres).map(([id, d]) => [id, maj(d)])) };
      }),
    changerOfficine: (id) =>
      set((s) => {
        const cible = s.autres[id];
        if (!cible) return s;
        const autres = { ...s.autres, [s.officineId]: s.data };
        delete autres[id];
        return { officineId: id, data: cible, autres, past: [], future: [] };
      }),
    envoyerMessage: (de, a, texte) =>
      commit((d) => ({ ...d, messages: d.messages.concat({ id: uid('msg'), de, a, texte: texte.trim(), at: now(), luPar: [de] }) }), false),
    lireFil: (moi, fil) =>
      commit((d) => {
        const concerne = (m: AppData['messages'][number]): boolean => (fil === 'equipe' ? m.a === 'equipe' : (m.de === fil && m.a === moi) || (m.de === moi && m.a === fil));
        if (!d.messages.some((m) => concerne(m) && !m.luPar.includes(moi))) return d;
        return { ...d, messages: d.messages.map((m) => (concerne(m) && !m.luPar.includes(moi) ? { ...m, luPar: [...m.luPar, moi] } : m)) };
      }, false),
    demanderRemplacement: (shift, urgence = 'prevu', justificatif) =>
      commit((d) =>
        journal(
          { ...d, remplacements: d.remplacements.concat({ id: uid('r'), shiftId: shift.id, demandeur: shift.personId, date: shift.date, start: shift.start, end: shift.end, creeLe: now(), volontaires: [], statut: 'ouverte', urgence, accord: 'attente', justificatif }) },
          { type: 'modification', titre: `${nom(d, shift.personId)} demande un remplacement le ${fmtDateCourt(shift.date)} (${URGENCE_LABEL[urgence].toLowerCase()})` },
        ),
      ),
    deciderDemande: (id, accepter) =>
      commit((d, today) => {
        const r = d.remplacements.find((x) => x.id === id && x.statut === 'ouverte');
        if (!r) return d;
        const at = now();
        const de = get().acteur ?? d.officine.responsableId ?? r.demandeur;
        const msg = (a: string, texte: string): AppData['messages'][number] => ({ id: uid('msg'), de, a, texte, at, luPar: [de] });
        const quand = `${fmtDateCourt(r.date)}, ${fmtHHMM(r.start)} – ${fmtHHMM(r.end)}`;
        if (!accepter) {
          return journal(
            {
              ...d,
              // Une demande tranchée ne garde pas son justificatif.
              remplacements: d.remplacements.map((x) => (x.id === id ? { ...x, statut: 'refusee' as const, justificatif: x.justificatif ? { ...x.justificatif, data: '' } : undefined } : x)),
              messages: d.messages.concat(r.demandeur !== de ? [msg(r.demandeur, `Votre demande de remplacement du ${quand} n’a pas été acceptée. Vous restez en poste : parlons-en si besoin.`)] : []),
            },
            { type: 'modification', titre: `Demande de remplacement de ${nom(d, r.demandeur)} du ${fmtDateCourt(r.date)} refusée` },
          );
        }
        // Acceptée : tous ceux qui peuvent tenir le poste sont prévenus en même temps.
        const sollicites = tourRemplacement(d, r, today).filter((c) => c.ok).map((c) => c.personId);
        return journal(
          {
            ...d,
            remplacements: d.remplacements.map((x) => (x.id === id ? { ...x, accord: 'accepte' as const, sollicites } : x)),
            messages: d.messages.concat(
              r.demandeur !== de ? [msg(r.demandeur, `Votre demande de remplacement du ${quand} est acceptée. ${sollicites.length} collègue${sollicites.length > 1 ? 's sont prévenus' : ' est prévenu'} ; vous restez en poste tant que personne n’a repris.`)] : [],
              sollicites.filter((a) => a !== de).map((a) => msg(a, `Un collègue cherche un remplaçant ${quand}. Tous ceux qui peuvent tenir ce poste reçoivent ce message. Répondez depuis « Mon planning ».`)),
            ),
          },
          { type: 'modification', titre: `Demande de remplacement de ${nom(d, r.demandeur)} du ${fmtDateCourt(r.date)} acceptée : ${sollicites.length} personne${sollicites.length > 1 ? 's' : ''} prévenue${sollicites.length > 1 ? 's' : ''}` },
        );
      }),
    regulariser: (r) =>
      commit((d) =>
        journal(
          { ...d, regularisations: (d.regularisations ?? []).concat({ ...r, id: uid('reg'), at: now() }) },
          { type: 'modification', titre: `Compteur d’heures de ${nom(d, r.personId)} : ${REGUL_LABEL[r.type].toLowerCase()}, ${fmtDuree(Math.abs(r.minutes))}${r.semaine ? ` (semaine du ${fmtSemaine(r.semaine)})` : ''}` },
        ),
      ),
    retirerRegularisation: (id) => commit((d) => ({ ...d, regularisations: (d.regularisations ?? []).filter((r) => r.id !== id) })),
    regulariserAuto: () =>
      commit((d, today) => {
        const propositions = proposerRegularisations(d, today);
        if (!propositions.length) return d;
        const semaine = semaineLibre(d, today);
        const at = now();
        const avec: AppData = { ...d, regularisations: (d.regularisations ?? []).concat(propositions.map((r) => ({ ...r, id: uid('reg'), at }))) };
        // Le brouillon de la semaine visée est recalculé : les objectifs d'heures de chacun y sont corrigés.
        const res = generer(avec, semaine, { variante: 'equite', graine: 7 });
        const fin = addDays(semaine, 6);
        return journal(
          { ...avec, shifts: avec.shifts.filter((x) => x.date < semaine || x.date > fin).concat(res.shifts) },
          {
            type: 'generation',
            titre: `Compteurs d’heures régularisés automatiquement sur la semaine du ${fmtSemaine(semaine)}`,
            detail: `${propositions.map((r) => `${nom(d, r.personId)} : ${r.minutes < 0 ? '−' : '+'}${fmtDuree(Math.abs(r.minutes))}`).join(' ; ')}. Brouillon recalculé, rien n'est publié.`,
            semaine,
            regles: true,
          },
        );
      }),
    seProposer: (id, personId, oui) =>
      commit((d) => ({
        ...d,
        remplacements: d.remplacements.map((r) => (r.id === id ? { ...r, volontaires: oui ? [...new Set([...r.volontaires, personId])] : r.volontaires.filter((x) => x !== personId), indisponibles: (r.indisponibles ?? []).filter((x) => x !== personId) } : r)),
      })),
    cloreRemplacement: (id, statut) => commit((d) => ({ ...d, remplacements: d.remplacements.map((r) => (r.id === id ? { ...r, statut, justificatif: r.justificatif ? { ...r.justificatif, data: '' } : undefined } : r)) })),
    declinerAppel: (id, personId) =>
      commit((d) => ({
        ...d,
        remplacements: d.remplacements.map((r) => (r.id === id ? { ...r, volontaires: r.volontaires.filter((x) => x !== personId), indisponibles: [...new Set([...(r.indisponibles ?? []), personId])] } : r)),
      }), false),
    appelerEquipe: (trouId) =>
      commit((d, today) => {
        const trou = d.trous.find((t) => t.id === trouId && t.statut === 'ouvert');
        if (!trou || d.remplacements.some((r) => r.trouId === trouId && r.statut === 'ouverte')) return d;
        const s = trou.shift;
        const sollicites = tourDeRole(d, s, today).filter((c) => c.ok).map((c) => c.personId);
        const at = now();
        const de = get().acteur ?? d.officine.responsableId ?? s.personId;
        const texte = `Absence à couvrir ${fmtDateCourt(s.date)}, ${fmtHHMM(s.start)} – ${fmtHHMM(s.end)}. Toutes les personnes qui peuvent tenir ce poste reçoivent ce message en même temps. Répondez depuis « Mon planning » : dire non ne change rien à votre rang.`;
        return journal(
          {
            ...d,
            remplacements: d.remplacements.concat({ id: uid('r'), shiftId: s.id, trouId, demandeur: s.personId, date: s.date, start: s.start, end: s.end, creeLe: at, volontaires: [], indisponibles: [], sollicites, statut: 'ouverte' }),
            messages: d.messages.concat(sollicites.filter((id) => id !== de).map((a) => ({ id: uid('msg'), de, a, texte, at, luPar: [de] }))),
          },
          { type: 'modification', titre: `Appel à l’équipe pour le ${fmtDateCourt(s.date)} : ${sollicites.length} personne${sollicites.length > 1 ? 's' : ''} prévenue${sollicites.length > 1 ? 's' : ''} en même temps` },
        );
      }),
    poserSouhait: (personId, date, choix) =>
      commit((d) => {
        const reste = (d.souhaits ?? []).filter((s) => !(s.personId === personId && s.date === date));
        return { ...d, souhaits: choix ? reste.concat({ personId, date, choix }) : reste };
      }, false),
    poserSouhaits: (liste) =>
      commit((d) => {
        if (!liste.length) return d;
        const cles = new Set(liste.map((s) => `${s.personId}|${s.date}`));
        return { ...d, souhaits: (d.souhaits ?? []).filter((s) => !cles.has(`${s.personId}|${s.date}`)).concat(liste) };
      }, false),
    appliquerCorrection: (mois, c) =>
      commit((d) =>
        journal(
          { ...d, shifts: c.data.shifts },
          {
            type: 'generation',
            titre: `Mois ${mois} recalculé d’après les préférences (${c.corrigees.length} semaine${c.corrigees.length > 1 ? 's' : ''} en brouillon)`,
            detail: `${c.souhaitsSuivis} préférence${c.souhaitsSuivis > 1 ? 's' : ''} suivie${c.souhaitsSuivis > 1 ? 's' : ''} sur ${c.souhaitsTotal}. ${c.publiees.length ? `${c.publiees.length} semaine${c.publiees.length > 1 ? 's' : ''} déjà publiée${c.publiees.length > 1 ? 's' : ''}, non modifiée${c.publiees.length > 1 ? 's' : ''}. ` : ''}Rien n'est publié sans validation.`,
            regles: true,
          },
        ),
      ),
    validerRemplacement: (id, remplacantId) =>
      commit((d, today) => {
        const r = d.remplacements.find((x) => x.id === id);
        if (r?.trouId) {
          // Absence couverte par un volontaire : son poste est ajouté, les autres volontaires sont remerciés et savent pourquoi.
          const trou = d.trous.find((t) => t.id === r.trouId);
          if (!trou) return d;
          const s = trou.shift;
          const at = now();
          const tour = tourDeRole(d, s, today, r);
          const premier = tour.find((c) => c.ok && c.volontaire);
          const horsTour = premier && premier.personId !== remplacantId;
          const de = get().acteur ?? d.officine.responsableId ?? remplacantId;
          const n = depannagesDe(d, remplacantId, today).nombre;
          const autres = r.volontaires.filter((v) => v !== remplacantId);
          const monday = fromDayIndex(dayIndex(s.date) - ((dayIndex(s.date) + 3) % 7));
          const nouveau: Shift = { ...s, id: uid('s'), personId: remplacantId, origine: 'reparation', explication: `Couvre l’absence de ${nom(d, s.personId)}, sur appel à l’équipe.` };
          const semaine = d.semaines[monday];
          const merci = (a: string, texte: string): AppData['messages'][number] => ({ id: uid('msg'), de, a, texte, at, luPar: [de] });
          return journal(
            {
              ...d,
              shifts: d.shifts.concat(nouveau),
              semaines: semaine?.snapshot ? { ...d.semaines, [monday]: { ...semaine, snapshot: semaine.snapshot.concat(nouveau) } } : d.semaines,
              trous: d.trous.map((t) => (t.id === trou.id ? { ...t, statut: 'resolu' as const, resolution: `Couvert par ${nom(d, remplacantId)} sur appel à l’équipe` } : t)),
              remplacements: d.remplacements.map((x) => (x.id === id ? { ...x, statut: 'acceptee' as const, remplacantId } : x)),
              notifications: [{ id: uid('n'), personId: remplacantId, at, date: s.date, avant: 'Repos', apres: `En poste, ${fmtHHMM(s.start)} – ${fmtHHMM(s.end)} (absence couverte)${ecartContrat({ ...d, shifts: d.shifts.concat(nouveau) }, remplacantId, monday)}`, tardif: dayIndex(s.date) - dayIndex(today) < 7 }, ...d.notifications],
              messages: d.messages.concat(
                [remplacantId, ...autres]
                  .filter((a) => a !== de)
                  .map((a) =>
                    a === remplacantId
                      ? merci(a, `Merci : le poste du ${fmtDateCourt(s.date)} est pour vous. Ce dépannage est compté dans le tour de rôle.`)
                      : merci(a, `Le poste du ${fmtDateCourt(s.date)} est couvert par ${nom(d, remplacantId)}, qui avait ${n ? `${n} dépannage${n > 1 ? 's' : ''}` : 'aucun dépannage'} sur trois mois. Merci de vous être proposé : votre rang dans le tour de rôle est conservé.`),
                  ),
              ),
            },
            { type: 'reparation', titre: `Absence de ${nom(d, s.personId)} du ${fmtDateCourt(s.date)} couverte par ${nom(d, remplacantId)} (appel à l’équipe${horsTour ? ', hors tour de rôle' : ', selon le tour de rôle'})`, regles: true },
          );
        }
        const poste = d.shifts.find((x) => x.id === r?.shiftId);
        if (!r || !poste) return d;
        const at = now();
        const monday = fromDayIndex(dayIndex(poste.date) - ((dayIndex(poste.date) + 3) % 7));
        const passer = (liste: Shift[]): Shift[] => liste.map((x) => (x.id === poste.id ? { ...x, personId: remplacantId, origine: 'reparation' as const, explication: `Remplace ${nom(d, r.demandeur)} à sa demande.` } : x));
        const semaine = d.semaines[monday];
        const horaire = `${fmtDateCourt(poste.date)}`;
        const plus = ecartContrat({ ...d, shifts: passer(d.shifts) }, remplacantId, monday);
        return journal(
          {
            ...d,
            shifts: passer(d.shifts),
            // Le remplacement validé vaut publication : les deux personnes voient aussitôt leur changement.
            semaines: semaine?.snapshot ? { ...d.semaines, [monday]: { ...semaine, snapshot: passer(semaine.snapshot) } } : d.semaines,
            remplacements: d.remplacements.map((x) => (x.id === id ? { ...x, statut: 'acceptee' as const, remplacantId, justificatif: x.justificatif ? { ...x.justificatif, data: '' } : undefined } : x)),
            notifications: [
              { id: uid('n'), personId: r.demandeur, at, date: poste.date, avant: 'En poste', apres: `Remplacé par ${nom(d, remplacantId)}`, tardif: dayIndex(poste.date) - dayIndex(today) < 7 },
              { id: uid('n'), personId: remplacantId, at, date: poste.date, avant: 'Repos', apres: `En poste à la place de ${nom(d, r.demandeur)}${plus}`, tardif: dayIndex(poste.date) - dayIndex(today) < 7 },
              ...d.notifications,
            ],
          },
          { type: 'reparation', titre: `Remplacement validé le ${horaire} : ${nom(d, remplacantId)} remplace ${nom(d, r.demandeur)}${plus}`, regles: true },
        );
      }),
    direct: false,
    acteur: null,
    setActeur: (acteur) => set({ acteur }),
    proposer: (auteur, action, args) =>
      set((s) => ({
        data: { ...s.data, accords: [...(s.data.accords ?? []), { id: uid('ok'), auteur, at: now(), action, args: JSON.parse(JSON.stringify(args)) as unknown[], titre: titreAccord(s.data, action, args) }] },
      })),
    donnerAccord: (id) => {
      const a = (get().data.accords ?? []).find((x) => x.id === id);
      if (!a) return;
      const chef = get().data.officine.responsableId ?? '';
      set((s) => ({ data: { ...s.data, accords: (s.data.accords ?? []).filter((x) => x.id !== id) }, direct: true }));
      // La décision est rejouée telle qu'elle a été proposée, sur le planning d'aujourd'hui.
      const action = (get() as unknown as Record<string, (...x: unknown[]) => void>)[a.action];
      if (typeof action === 'function') action(...a.args);
      set({ direct: false });
      commit((d) => journal({ ...d, messages: d.messages.concat({ id: uid('msg'), de: chef, a: a.auteur, texte: `Accord donné : ${a.titre}.`, at: now(), luPar: [chef] }) }, { type: 'regle', titre: `Accord donné à ${nom(d, a.auteur)} : ${a.titre}` }), false);
    },
    ecarterAccord: (id, refus) =>
      commit((d) => {
        const a = (d.accords ?? []).find((x) => x.id === id);
        if (!a) return d;
        const chef = d.officine.responsableId ?? '';
        const reste = { ...d, accords: (d.accords ?? []).filter((x) => x.id !== id) };
        return refus ? journal({ ...reste, messages: d.messages.concat({ id: uid('msg'), de: chef, a: a.auteur, texte: `Accord refusé : ${a.titre}.`, at: now(), luPar: [chef] }) }, { type: 'regle', titre: `Accord refusé à ${nom(d, a.auteur)} : ${a.titre}` }) : reste;
      }, false),
    chargerExemple: (neuf = true, depart = 'etabli') =>
      set((s) => {
        const existant = Object.entries(s.autres).find(([, d]) => d.demo);
        if (!neuf && s.data.demo) return s;
        const autres = Object.fromEntries(Object.entries(s.autres).filter(([, d]) => !d.demo));
        // Une vraie pharmacie ouverte est mise de côté, jamais effacée.
        if (!s.data.demo && (s.data.officine.nom.trim() || s.data.personnes.length)) autres[s.officineId] = s.data;
        if (!neuf && existant) return { officineId: existant[0], data: existant[1], autres, past: [], future: [] };
        const base = seed(todayISO(), depart === 'etabli' ? 2 : -99);
        // « zéro » : la pharmacie vient d'être créée, seule sa titulaire existe.
        const data = depart === 'zero' ? { ...base, personnes: base.personnes.filter((p) => p.id === base.officine.responsableId), besoins: [], souhaits: [] } : base;
        return { officineId: uid('off'), data, autres, past: [], future: [] };
      }),

    saveShift: (shift) =>
      commit((d) => ({
        ...d,
        shifts: d.shifts.some((s) => s.id === shift.id) ? d.shifts.map((s) => (s.id === shift.id ? shift : s)) : d.shifts.concat(shift),
      })),
    deleteShift: (id) => commit((d) => ({ ...d, shifts: d.shifts.filter((s) => s.id !== id) })),
    moveShift: (id, personId, date) =>
      commit((d) => {
        const s = d.shifts.find((x) => x.id === id);
        if (!s || (s.personId === personId && s.date === date)) return d;
        return {
          ...d,
          shifts: d.shifts.map((x) => (x.id === id ? { ...x, personId, date, origine: 'manuel' as const, explication: undefined } : x)),
        };
      }),
    appliquerGeneration: (monday, res) =>
      commit((d) => {
        const anciens = shiftsSemaine(d, monday);
        const next = { ...d, shifts: d.shifts.filter((s) => !anciens.includes(s)).concat(res.shifts) };
        return journal(next, {
          type: 'generation',
          titre: `Proposition « ${VARIANTE_LABEL[res.variante].titre} » appliquée au brouillon`,
          detail: `Semaine du ${fmtSemaine(monday)} : ${res.shifts.length} postes, ${res.indicateurs.bloquants} point bloquant. Rien n'est publié sans validation.`,
          semaine: monday,
          regles: true,
        });
      }),
    viderSemaine: (monday) =>
      commit((d) => {
        const anciens = shiftsSemaine(d, monday);
        return { ...d, shifts: d.shifts.filter((s) => !anciens.includes(s)) };
      }),
    copierSemaine: (source, cible) =>
      commit((d) => {
        const anciens = shiftsSemaine(d, cible);
        const decalage = dayIndex(cible) - dayIndex(source);
        const copies = shiftsSemaine(d, source)
          .filter((s) => !d.personnes.find((p) => p.id === s.personId)?.externe)
          .map((s) => ({ ...s, id: uid('s'), date: addDays(s.date, decalage), origine: 'trame' as const, explication: undefined }));
        return { ...d, shifts: d.shifts.filter((s) => !anciens.includes(s)).concat(copies) };
      }),
    publier: (monday, accords, bloquantsAssumes) =>
      commit((d, today) => {
        const ctrl = controlePublication(d, monday, today);
        const at = now();
        const snapshot = shiftsSemaine(d, monday).map((s) => ({ ...s }));
        const notifications = ctrl.premiere
          ? []
          : ctrl.changements.map((c) => ({
              id: uid('n'),
              personId: c.personId,
              at,
              date: c.date,
              avant: c.avant,
              apres: c.apres,
              tardif: dayIndex(c.date) - dayIndex(today) < 7,
            }));
        const gardes = d.gardes.map((g) =>
          g.personId && !g.communiqueLe && weekDates(monday).includes(g.date) ? { ...g, communiqueLe: at } : g,
        );
        const next: AppData = {
          ...d,
          gardes,
          semaines: { ...d.semaines, [monday]: { statut: 'publie', publishedAt: at, snapshot } },
          notifications: [...notifications, ...d.notifications],
        };
        const jours = dayIndex(monday) - dayIndex(today);
        return journal(next, {
          type: ctrl.premiere ? 'publication' : 'modification',
          titre: ctrl.premiere
            ? `Planning de la semaine du ${fmtSemaine(monday)} publié`
            : `Modification publiée — semaine du ${fmtSemaine(monday)}`,
          detail: [
            ctrl.premiere
              ? `${snapshot.length} postes communiqués ${jours > 0 ? `${jours} jours avant le début de la semaine` : 'en cours de semaine'}.`
              : `${ctrl.changements.length} changement${ctrl.changements.length > 1 ? 's' : ''} notifié${ctrl.changements.length > 1 ? 's' : ''}.`,
            bloquantsAssumes ? `Publié avec ${bloquantsAssumes} point${bloquantsAssumes > 1 ? 's' : ''} bloquant${bloquantsAssumes > 1 ? 's' : ''} assumé${bloquantsAssumes > 1 ? 's' : ''} par le responsable.` : '',
          ]
            .filter(Boolean)
            .join(' '),
          semaine: monday,
          changements: ctrl.changements,
          accords,
          regles: true,
        });
      }, false),

    declarerAbsence: (a) =>
      commit((d, today) => {
        const absence: Absence = { ...a, id: uid('a'), createdAt: now() };
        let next: AppData = { ...d, absences: d.absences.concat(absence) };
        if (absence.statut === 'approuvee') next = appliquerAbsence(next, absence, today);
        return journal(next, {
          type: 'absence',
          titre: `${ABSENCE_LABEL[a.type]} de ${nom(d, a.personId)} ${a.statut === 'approuvee' ? 'enregistré' : 'demandé'}`,
          detail: `Du ${fmtDateCourt(a.from)} au ${fmtDateCourt(a.to)}.`,
        });
      }),
    signalerEcart: (e) =>
      commit((d) =>
        journal(
          { ...d, ecarts: (d.ecarts ?? []).concat({ ...e, id: uid('e'), at: now() }) },
          { type: 'absence', titre: `${ECART_LABEL[e.type]} de ${nom(d, e.personId)} le ${fmtDateCourt(e.date)}${e.minutes ? ` (${e.minutes} min)` : ''}` },
        ),
      ),
    retirerEcart: (id) => commit((d) => ({ ...d, ecarts: (d.ecarts ?? []).filter((e) => e.id !== id) })),
    planifierFormation: ({ intitule, personnes, from, to }) =>
      commit((d, today) => {
        const at = now();
        let next = d;
        for (const personId of personnes) {
          const absence: Absence = { id: uid('a'), personId, from, to, type: 'formation', statut: 'approuvee', createdAt: at, libelle: intitule };
          next = appliquerAbsence({ ...next, absences: next.absences.concat(absence) }, absence, today);
        }
        const quand = from === to ? `le ${fmtDateCourt(from)}` : `du ${fmtDateCourt(from)} au ${fmtDateCourt(to)}`;
        return journal(
          { ...next, notifications: [...personnes.map((personId) => ({ id: uid('n'), personId, at, date: from, avant: 'Planning habituel', apres: `Formation « ${intitule} » ${quand}`, tardif: dayIndex(from) - dayIndex(today) < 7 })), ...next.notifications] },
          { type: 'absence', titre: `Formation « ${intitule} » planifiée ${quand}`, detail: `Participants : ${personnes.map((id) => nom(d, id)).join(', ')}. Chacun a été prévenu dans son espace.` },
        );
      }),
    planifierInventaire: ({ date, start, end, personnes }) =>
      commit((d, today) => {
        const at = now();
        // Au-delà de six heures, une pause de trente minutes est posée au milieu.
        const pause = end - start > 360 ? { pauseStart: Math.round((start + end) / 2 / 15) * 15 - 15, pauseEnd: Math.round((start + end) / 2 / 15) * 15 + 15 } : {};
        const postes: Shift[] = personnes.map((personId) => ({ id: uid('s'), personId, date, start, end, ...pause, activite: 'inventaire' as const, origine: 'manuel' as const, explication: 'Inventaire de la pharmacie.' }));
        const monday = fromDayIndex(dayIndex(date) - ((dayIndex(date) + 3) % 7));
        const semaine = d.semaines[monday];
        const horaire = `${fmtHHMM(start)} → ${fmtHHMM(end)}`;
        return journal(
          {
            ...d,
            shifts: d.shifts.concat(postes),
            // Sur une semaine déjà publiée, l'inventaire rejoint aussitôt la version vue par l'équipe.
            semaines: semaine?.snapshot ? { ...d.semaines, [monday]: { ...semaine, snapshot: semaine.snapshot.concat(postes.map((x) => ({ ...x }))) } } : d.semaines,
            notifications: [...personnes.map((personId) => ({ id: uid('n'), personId, at, date, avant: 'Planning habituel', apres: `Inventaire, ${horaire}`, tardif: dayIndex(date) - dayIndex(today) < 7 })), ...d.notifications],
          },
          { type: 'modification', titre: `Inventaire planifié le ${fmtDateCourt(date)}, ${horaire}`, detail: `Participants : ${personnes.map((id) => nom(d, id)).join(', ')}. Chacun a été prévenu dans son espace.`, regles: true },
        );
      }),
    deciderAbsence: (id, approuver) =>
      commit((d, today) => {
        const a = d.absences.find((x) => x.id === id);
        if (!a) return d;
        const maj: Absence = { ...a, statut: approuver ? 'approuvee' : 'refusee' };
        let next: AppData = { ...d, absences: d.absences.map((x) => (x.id === id ? maj : x)) };
        if (approuver) next = appliquerAbsence(next, maj, today);
        return journal(next, {
          type: 'absence',
          titre: `${ABSENCE_LABEL[a.type]} de ${nom(d, a.personId)} ${approuver ? 'approuvé' : 'refusé'}`,
          detail: `Du ${fmtDateCourt(a.from)} au ${fmtDateCourt(a.to)}.`,
        });
      }),
    resoudreAbsence: (absenceId) =>
      commit((d, today) => {
        let next = d;
        const titres: string[] = [];
        for (const t of d.trous.filter((x) => x.absenceId === absenceId && x.statut === 'ouvert')) {
          // Chaque jour est recalculé sur le planning déjà corrigé : une option ne défait pas la précédente.
          const rep = optionsReparation(next, t.shift, today);
          const o = rep.options.find((x) => x.recommande) ?? rep.options[0];
          if (!o) continue;
          next = appliquerPatch(next, o.patch);
          next = { ...next, trous: next.trous.map((x) => (x.id === t.id ? { ...x, statut: 'resolu' as const, resolution: o.titre } : x)), remplacements: next.remplacements.map((r) => (r.trouId === t.id && r.statut === 'ouverte' ? { ...r, statut: 'annulee' as const } : r)) };
          titres.push(`${fmtDateCourt(t.shift.date)} : ${o.titre.toLowerCase()}`);
        }
        if (!titres.length) return d;
        return journal(next, { type: 'reparation', titre: `Absence réglée avec les options conseillées (${titres.length} jour${titres.length > 1 ? 's' : ''})`, detail: titres.join(' ; '), regles: true });
      }),
    resoudreTrou: (id, option) =>
      commit((d) => {
        const trou = d.trous.find((t) => t.id === id);
        if (!trou) return d;
        const next = appliquerPatch(d, option.patch);
        return journal(
          { ...next, trous: d.trous.map((t) => (t.id === id ? { ...t, statut: 'resolu' as const, resolution: option.titre } : t)), remplacements: next.remplacements.map((r) => (r.trouId === id && r.statut === 'ouverte' ? { ...r, statut: 'annulee' as const } : r)) },
          {
            type: 'reparation',
            titre: `Absence de ${nom(d, trou.shift.personId)} du ${fmtDateCourt(trou.shift.date)} : ${option.titre.toLowerCase()}`,
            detail: [option.resume, option.validations.length ? `À valider : ${option.validations.join(' ; ')}.` : '', option.restant.length ? `Reste à régler : ${option.restant.join(' ')}` : '']
              .filter(Boolean)
              .join(' '),
            changements: option.changements,
            regles: true,
          },
        );
      }),

    ajouterBesoin: (b) =>
      commit((d) =>
        journal(
          { ...d, besoins: d.besoins.concat({ ...b, id: uid('b'), createdAt: now() }) },
          { type: 'besoin', titre: `Demande de ${nom(d, b.personId)} ${b.decision === 'en_attente' ? 'reçue' : 'enregistrée'}`, detail: decrireBesoin({ ...b, id: '', createdAt: '' }) },
        ),
      ),
    deciderBesoin: (id, accepter, statut) =>
      commit((d) => {
        const b = d.besoins.find((x) => x.id === id);
        if (!b) return d;
        const maj: Besoin = { ...b, decision: accepter ? 'acceptee' : 'refusee', statut: statut ?? b.statut, decidedAt: now() };
        const libelle = { reconnue: 'indisponibilité reconnue', prioritaire: 'préférence prioritaire', preference: 'simple préférence' }[maj.statut];
        return journal(
          { ...d, besoins: d.besoins.map((x) => (x.id === id ? maj : x)) },
          {
            type: 'besoin',
            titre: `Demande de ${nom(d, b.personId)} ${accepter ? `acceptée (${libelle})` : 'refusée'}`,
            detail: decrireBesoin(maj),
          },
        );
      }),
    supprimerBesoin: (id) => commit((d) => ({ ...d, besoins: d.besoins.filter((b) => b.id !== id) })),

    ajouterGardes: (list, prevenir) =>
      commit((d, today) => {
        const at = now();
        const nouvelles: Garde[] = list.map((g) => ({ ...g, id: uid('g'), communiqueLe: g.personId && prevenir ? at : g.communiqueLe }));
        const confiees = nouvelles.filter((g) => g.personId);
        return journal(
          {
            ...d,
            gardes: d.gardes.concat(nouvelles).sort((a, b) => a.date.localeCompare(b.date)),
            notifications: prevenir ? [...confiees.map((g) => avisGarde(g, g.personId as string, true, at, today)), ...d.notifications] : d.notifications,
          },
          {
            type: 'garde',
            titre: `${list.length} garde${list.length > 1 ? 's' : ''} ajoutée${list.length > 1 ? 's' : ''} au calendrier${confiees.length ? `, confiée${confiees.length > 1 ? 's' : ''} à ${nom(d, confiees[0].personId)}` : ''}`,
            detail: confiees.length && prevenir ? `${nom(d, confiees[0].personId)} a été prévenu dans son espace.` : undefined,
          },
        );
      }),
    affecterGarde: (id, personId, exceptionnel) =>
      commit((d, today) => {
        const g = d.gardes.find((x) => x.id === id);
        if (!g) return d;
        const at = now();
        const maj: Garde = { ...g, personId, exceptionnel, communiqueLe: personId ? at : undefined };
        // La personne qui reçoit la garde, et celle qui la perd, sont prévenues dans leur espace.
        const avis = [...(personId && personId !== g.personId ? [avisGarde(maj, personId, true, at, today)] : []), ...(g.personId && g.personId !== personId ? [avisGarde(g, g.personId, false, at, today)] : [])];
        return journal(
          { ...d, gardes: d.gardes.map((x) => (x.id === id ? maj : x)), notifications: [...avis, ...d.notifications] },
          {
            type: 'garde',
            titre: personId
              ? `${GARDE_LABEL[g.type]} du ${fmtDateCourt(g.date)} confiée à ${nom(d, personId)}`
              : `${GARDE_LABEL[g.type]} du ${fmtDateCourt(g.date)} : affectation retirée`,
            detail: personId ? `Programmation communiquée ${dayIndex(g.date) - dayIndex(get().today)} jours avant la garde. ${nom(d, personId)} a été prévenu dans son espace.` : undefined,
            regles: true,
          },
        );
      }),
    affecterGardes: (liste) =>
      commit((d) => {
        if (!liste.length) return d;
        const at = now();
        return journal(
          {
            ...d,
            gardes: d.gardes.map((g) => { const a = liste.find((x) => x.gardeId === g.id); return a ? { ...g, personId: a.personId, communiqueLe: at } : g; }),
            notifications: [...liste.flatMap((a) => { const g = d.gardes.find((x) => x.id === a.gardeId); return g ? [avisGarde(g, a.personId, true, at, get().today)] : []; }), ...d.notifications],
          },
          {
            type: 'garde',
            titre: `${liste.length} garde${liste.length > 1 ? 's' : ''} répartie${liste.length > 1 ? 's' : ''} équitablement`,
            detail: liste.map((a) => { const g = d.gardes.find((x) => x.id === a.gardeId); return `${g ? fmtDateCourt(g.date) : ''} : ${nom(d, a.personId)} (${a.raison})`; }).join(' · '),
            regles: true,
          },
        );
      }),
    majGarde: (id, patch) => commit((d) => ({ ...d, gardes: d.gardes.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
    supprimerGarde: (id) => commit((d) => ({ ...d, gardes: d.gardes.filter((g) => g.id !== id) })),
    ajouterIntervention: (id, offset, duree) =>
      commit((d) => ({
        ...d,
        gardes: d.gardes.map((g) =>
          g.id === id ? { ...g, interventions: g.interventions.concat({ id: uid('i'), offset, duree }).sort((a, b) => a.offset - b.offset) } : g,
        ),
      })),
    retirerIntervention: (id, interventionId) =>
      commit((d) => ({
        ...d,
        gardes: d.gardes.map((g) => (g.id === id ? { ...g, interventions: g.interventions.filter((i) => i.id !== interventionId) } : g)),
      })),
    corrigerRepos: (gardeId, shiftId) =>
      commit((d) => {
        const g = d.gardes.find((x) => x.id === gardeId);
        const s = d.shifts.find((x) => x.id === shiftId);
        if (!g || !s) return d;
        const repos = reposApresGarde(d, g);
        const conflit = repos?.conflits.find((c) => c.shift.id === shiftId);
        if (!repos || !conflit) return d;
        // Décaler la prise de poste si le poste garde au moins deux heures, sinon le retirer.
        const peutDecaler = conflit.position === 'apres' && repos.reprise.date === s.date && s.end - repos.reprise.minute >= 120;
        const debut = repos.reprise.minute;
        const shifts = peutDecaler
          ? d.shifts.map((x) =>
              x.id === shiftId
                ? {
                    ...x,
                    start: debut,
                    pauseStart: x.pauseStart !== undefined && x.pauseStart > debut ? x.pauseStart : undefined,
                    pauseEnd: x.pauseStart !== undefined && x.pauseStart > debut ? x.pauseEnd : undefined,
                    origine: 'reparation' as const,
                    explication: `Prise de poste décalée pour respecter le repos après la garde du ${fmtDateCourt(g.date)}.`,
                  }
                : x,
            )
          : d.shifts.filter((x) => x.id !== shiftId);
        return journal(
          { ...d, shifts },
          {
            type: 'garde',
            titre: `Repos après la garde du ${fmtDateCourt(g.date)} : poste de ${nom(d, s.personId)} ${peutDecaler ? 'décalé' : 'retiré'}`,
            detail: repos.texte,
            regles: true,
          },
        );
      }),
    validerGarde: (id) =>
      commit((d) => {
        const g = d.gardes.find((x) => x.id === id);
        if (!g) return d;
        return journal(
          { ...d, gardes: d.gardes.map((x) => (x.id === id ? { ...x, valideLe: now() } : x)) },
          { type: 'garde', titre: `Variables de la garde du ${fmtDateCourt(g.date)} validées pour le comptable`, regles: true },
        );
      }),

    majPersonne: (p) =>
      commit((d) => ({
        ...d,
        personnes: d.personnes.some((x) => x.id === p.id) ? d.personnes.map((x) => (x.id === p.id ? p : x)) : d.personnes.concat(p),
      })),
    supprimerPersonne: (id) =>
      commit((d) => ({
        ...d,
        personnes: d.personnes.filter((p) => p.id !== id),
        shifts: d.shifts.filter((s) => s.personId !== id),
        besoins: d.besoins.filter((b) => b.personId !== id),
        absences: d.absences.filter((a) => a.personId !== id),
        notifications: d.notifications.filter((n) => n.personId !== id),
        trous: d.trous.filter((t) => t.shift.personId !== id),
        missions: d.missions.map((m) => (m.personId === id ? { ...m, personId: null } : m)),
        gardes: d.gardes.map((g) => (g.personId === id ? { ...g, personId: null, communiqueLe: undefined } : g)),
      })),
    majOfficine: (patch) => commit((d) => ({ ...d, officine: { ...d.officine, ...patch } })),
    majRegle: (id, patch) =>
      commit((d) => {
        const r = d.regles.find((x) => x.id === id);
        if (!r) return d;
        const [maj, min] = r.version.split('.').map(Number);
        const version = `${maj}.${(min || 0) + 1}`;
        const next = { ...d, regles: d.regles.map((x) => (x.id === id ? { ...x, ...patch, version, dateEffet: get().today } : x)) };
        return journal(next, {
          type: 'regle',
          titre: `Règle « ${r.titre} » modifiée (version ${version})`,
          detail:
            patch.valeur !== undefined
              ? `Valeur : ${r.valeur} → ${patch.valeur} ${r.unite ?? ''}`.trim()
              : patch.active !== undefined
                ? patch.active
                  ? 'Alerte réactivée.'
                  : 'Alerte désactivée.'
                : undefined,
        });
      }),
    majMission: (id, patch) => commit((d) => ({ ...d, missions: d.missions.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
    lireNotification: (id) =>
      commit((d) => ({ ...d, notifications: d.notifications.map((n) => (n.id === id ? { ...n, luLe: now() } : n)) }), false),
  };
  return soumettre(magasin, get);
});

// Sauvegarde locale à chaque changement, avec l'heure de la dernière écriture réussie.
const enregistrer = (s: Store): void => {
  const e: Enregistrement = { courante: s.officineId, officines: { ...s.autres, [s.officineId]: s.data } };
  localStorage.setItem(KEY, JSON.stringify(e));
};
// Sauvegarde locale à chaque changement, avec l'heure de la dernière écriture réussie.
useStore.subscribe((s, prev) => {
  if (s.data === prev.data && s.autres === prev.autres && s.officineId === prev.officineId) return;
  try {
    enregistrer(s);
    useStore.setState({ derniereSauvegarde: now() });
  } catch {
    // Quota dépassé ou navigation privée : l'application continue en mémoire.
  }
});
if (typeof localStorage !== 'undefined') {
  try {
    enregistrer(useStore.getState());
  } catch {
    // idem
  }
}

/** Une semaine publiée a-t-elle des modifications non encore publiées ? */
export function modificationsEnAttente(data: AppData, monday: ISODate): number {
  if (data.semaines[monday]?.statut !== 'publie') return 0;
  return changementsSemaine(data, monday).length;
}
