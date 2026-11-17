import { create } from 'zustand';
import { seed, vierge } from '../data/seed';
import { addDays, dayIndex, fmtDateCourt, fmtHHMM, fmtSemaine, fromDayIndex, todayISO, uid, weekDates } from '../domain/time';
import type {
  Absence,
  AppData,
  Besoin,
  BesoinStatut,
  Garde,
  ISODate,
  JournalEntry,
  Mission,
  Officine,
  Person,
  Regle,
  Shift,
} from '../domain/types';
import { ABSENCE_LABEL, GARDE_LABEL, nomCourt } from '../domain/types';
import { decrireBesoin, shiftsSemaine } from '../engine/core';
import { reposApresGarde } from '../engine/gardes';
import type { GenResult } from '../engine/generate';
import { VARIANTE_LABEL } from '../engine/generate';
import { changementsSemaine, controlePublication } from '../engine/publish';
import type { RepairOption } from '../engine/repair';
import { appliquerPatch } from '../engine/repair';

const KEY = 'releve.v3';

/** Ce qui est enregistré : toutes les pharmacies de l'appareil, et celle qui est ouverte. */
interface Enregistrement {
  courante: string;
  officines: Record<string, AppData>;
}

function normaliser(d: AppData): AppData {
  return { ...d, messages: d.messages ?? [], remplacements: d.remplacements ?? [] };
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
  chargerExemple: (neuf?: boolean) => void;
  /** Crée l'officine depuis l'écran d'accueil : nom, horaires et première équipe. */
  /** `ajout` garde les pharmacies existantes ; `nouvelleCle` vaut pour un autre titulaire, qui reçoit sa propre clé de secours. */
  creerOfficine: (nom: string, horaires: Officine['horaires'], personnes: Person[], ajout?: boolean, nouvelleCle?: boolean) => void;
  /** Un même identifiant peut avoir un compte dans plusieurs pharmacies : le mot de passe change partout. */
  definirMotDePasse: (identifiant: string, code: string) => void;
  changerOfficine: (id: string) => void;
  envoyerMessage: (de: string, a: string, texte: string) => void;
  lireFil: (moi: string, fil: string) => void;
  demanderRemplacement: (shift: Shift) => void;
  seProposer: (id: string, personId: string, oui: boolean) => void;
  cloreRemplacement: (id: string, statut: 'refusee' | 'annulee') => void;
  validerRemplacement: (id: string, remplacantId: string) => void;

  saveShift: (s: Shift) => void;
  deleteShift: (id: string) => void;
  moveShift: (id: string, personId: string, date: ISODate) => void;
  appliquerGeneration: (monday: ISODate, res: GenResult) => void;
  viderSemaine: (monday: ISODate) => void;
  copierSemaine: (source: ISODate, cible: ISODate) => void;
  publier: (monday: ISODate, accords: string[], bloquantsAssumes: number) => void;

  declarerAbsence: (a: Omit<Absence, 'id' | 'createdAt'>) => void;
  deciderAbsence: (id: string, approuver: boolean) => void;
  resoudreTrou: (id: string, option: RepairOption) => void;

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

  return {
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
    demanderRemplacement: (shift) =>
      commit((d) =>
        journal(
          { ...d, remplacements: d.remplacements.concat({ id: uid('r'), shiftId: shift.id, demandeur: shift.personId, date: shift.date, start: shift.start, end: shift.end, creeLe: now(), volontaires: [], statut: 'ouverte' }) },
          { type: 'modification', titre: `${nom(d, shift.personId)} demande un remplacement le ${fmtDateCourt(shift.date)}` },
        ),
      ),
    seProposer: (id, personId, oui) =>
      commit((d) => ({
        ...d,
        remplacements: d.remplacements.map((r) => (r.id === id ? { ...r, volontaires: oui ? [...new Set([...r.volontaires, personId])] : r.volontaires.filter((x) => x !== personId) } : r)),
      })),
    cloreRemplacement: (id, statut) => commit((d) => ({ ...d, remplacements: d.remplacements.map((r) => (r.id === id ? { ...r, statut } : r)) })),
    validerRemplacement: (id, remplacantId) =>
      commit((d, today) => {
        const r = d.remplacements.find((x) => x.id === id);
        const poste = d.shifts.find((x) => x.id === r?.shiftId);
        if (!r || !poste) return d;
        const at = now();
        const monday = fromDayIndex(dayIndex(poste.date) - ((dayIndex(poste.date) + 3) % 7));
        const passer = (liste: Shift[]): Shift[] => liste.map((x) => (x.id === poste.id ? { ...x, personId: remplacantId, origine: 'reparation' as const, explication: `Remplace ${nom(d, r.demandeur)} à sa demande.` } : x));
        const semaine = d.semaines[monday];
        const horaire = `${fmtDateCourt(poste.date)}`;
        return journal(
          {
            ...d,
            shifts: passer(d.shifts),
            // Le remplacement validé vaut publication : les deux personnes voient aussitôt leur changement.
            semaines: semaine?.snapshot ? { ...d.semaines, [monday]: { ...semaine, snapshot: passer(semaine.snapshot) } } : d.semaines,
            remplacements: d.remplacements.map((x) => (x.id === id ? { ...x, statut: 'acceptee' as const, remplacantId } : x)),
            notifications: [
              { id: uid('n'), personId: r.demandeur, at, date: poste.date, avant: 'En poste', apres: `Remplacé par ${nom(d, remplacantId)}`, tardif: dayIndex(poste.date) - dayIndex(today) < 7 },
              { id: uid('n'), personId: remplacantId, at, date: poste.date, avant: 'Repos', apres: `En poste à la place de ${nom(d, r.demandeur)}`, tardif: dayIndex(poste.date) - dayIndex(today) < 7 },
              ...d.notifications,
            ],
          },
          { type: 'reparation', titre: `Remplacement validé le ${horaire} : ${nom(d, remplacantId)} remplace ${nom(d, r.demandeur)}`, regles: true },
        );
      }),
    chargerExemple: (neuf = true) =>
      set((s) => {
        const existant = Object.entries(s.autres).find(([, d]) => d.demo);
        if (!neuf && s.data.demo) return s;
        const autres = Object.fromEntries(Object.entries(s.autres).filter(([, d]) => !d.demo));
        // Une vraie pharmacie ouverte est mise de côté, jamais effacée.
        if (!s.data.demo && (s.data.officine.nom.trim() || s.data.personnes.length)) autres[s.officineId] = s.data;
        if (!neuf && existant) return { officineId: existant[0], data: existant[1], autres, past: [], future: [] };
        return { officineId: uid('off'), data: seed(todayISO()), autres, past: [], future: [] };
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
    resoudreTrou: (id, option) =>
      commit((d) => {
        const trou = d.trous.find((t) => t.id === id);
        if (!trou) return d;
        const next = appliquerPatch(d, option.patch);
        return journal(
          { ...next, trous: d.trous.map((t) => (t.id === id ? { ...t, statut: 'resolu' as const, resolution: option.titre } : t)) },
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
