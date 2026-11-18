import { ArrowLeft, ArrowRight, CircleCheck, Crown, FlaskConical, ListTree, MousePointer2, Pause, Pill as PillIcon, Play, RotateCcw, Store, Undo2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { peutGerer } from '../domain/acces';
import { addDays, mondayOf } from '../domain/time';
import type { AppData, Justificatif, Remplacement } from '../domain/types';
import { seed } from '../data/seed';
import { tourDeRole } from '../engine/appel';
import { sousEffectifs, trousPharmacien } from '../engine/core';
import { generer } from '../engine/generate';
import { moisACollecter, proposerSouhaits } from '../engine/souhaits';
import { evaluerRemplacement, peutDemanderRemplacement, peutRemplacer } from '../engine/remplacement';
import { useStore } from '../store/store';
import type { Vue } from '../store/ui';
import { useUi } from '../store/ui';
import { Logo } from './kit';

/** Les quatre regards de l'environnement de test, avec des personnes déjà créées. */
export const ROLES_TEST: { cle: string; id: string; identifiant: string; court: string; titre: string; nom: string; detail: string }[] = [
  { cle: 't1', id: 'p_helene', identifiant: 'caroline.tellier', court: 'Titulaire 1', titre: 'Titulaire principale', nom: 'Caroline Tellier', detail: 'Tous les droits : tableau de bord, plannings, équipe, gardes, réglages.' },
  { cle: 't2', id: 'p_antoine', identifiant: 'pierre.fiandino', court: 'Titulaire 2', titre: 'Titulaire secondaire', nom: 'Pierre Fiandino', detail: 'Mêmes écrans que la titulaire principale ; ses décisions attendent son accord.' },
  { cle: 'ph', id: 'p_karim', identifiant: 'igor.lerusse', court: 'Pharmacien', titre: 'Pharmacien adjoint', nom: 'Igor Le Russe', detail: 'Son planning, le planning publié, ses gardes, ses messages.' },
  { cle: 'pr', id: 'p_camille', identifiant: 'nicolas.lesyndicaliste', court: 'Préparateur', titre: 'Préparateur', nom: 'Nicolas Le Syndicaliste', detail: 'Ses horaires, ses demandes, les remplacements, ses messages.' },
];

/** Ouvre l'environnement de test dans la peau d'une personne ; l'écran d'arrivée dépend de ses droits. */
export function voirComme(identifiant: string, vue?: Vue): void {
  const { data } = useStore.getState();
  const p = data.personnes.find((x) => x.identifiant === identifiant);
  const gere = peutGerer(data, p);
  useStore.getState().setActeur(p?.id ?? null);
  useUi.getState().setTour(null);
  useUi.getState().connecter(identifiant, vue ?? (gere ? 'tableau' : 'moi'));
}

const store = (): ReturnType<typeof useStore.getState> => useStore.getState();
/** Ouvre « Mes demandes » sur l'onglet voulu, dans la peau de la personne. */
const versDemandes = (identifiant: string, onglet: 'souhaits' | 'absences' | 'remplacements'): void => {
  useUi.getState().setDemandesOnglet(onglet);
  voirComme(identifiant, 'demandes');
};
const demandeDeCamille = (d: AppData): Remplacement | undefined => d.remplacements.find((r) => r.demandeur === 'p_camille' && r.statut === 'ouverte');
const prenom = (d: AppData, id: string | undefined): string => d.personnes.find((p) => p.id === id)?.prenom ?? 'un collègue';

/** Collègue libre qui peut reprendre le poste sans enfreindre une règle ; à qualification égale d'abord. */
function volontairePour(d: AppData, r: Remplacement): string | undefined {
  const demandeur = d.personnes.find((p) => p.id === r.demandeur);
  const possibles = d.personnes.filter((p) => peutRemplacer(d, r, p) && evaluerRemplacement(d, r, p.id).ok);
  return (possibles.find((p) => p.qualification === demandeur?.qualification) ?? possibles[0])?.id;
}

/** Premier poste publié à venir de Nicolas qu'un autre préparateur, de préférence, peut reprendre. */
function posteARemplacer(d: AppData, today: string): string | null {
  const postes = d.shifts.filter((s) => s.personId === 'p_camille' && peutDemanderRemplacement(d, s.date, today) && d.semaines[mondayOf(s.date)]?.statut === 'publie').sort((a, b) => a.date.localeCompare(b.date));
  const essai = (s: (typeof postes)[number]): Remplacement => ({ id: 'essai', shiftId: s.id, demandeur: 'p_camille', date: s.date, start: s.start, end: s.end, creeLe: '', volontaires: [], statut: 'ouverte' });
  const prepa = postes.find((s) => d.personnes.find((p) => p.id === volontairePour(d, essai(s)))?.qualification === 'preparateur');
  return (prepa ?? postes.find((s) => volontairePour(d, essai(s))))?.id ?? null;
}

/** Ce que vise un geste : un sélecteur, ou une fonction qui trouve l'élément (par son texte, son rang…). */
type Cible = string | (() => HTMLElement | null | undefined);
/** Un geste que la visite fait elle-même, à l'écran : elle clique, tape, choisit, comme le ferait l'utilisateur. */
type Geste =
  | { faire: 'cliquer'; sur: Cible; dit?: string }
  | { faire: 'taper'; dans: Cible; texte: string; dit?: string }
  | { faire: 'choisir'; dans: Cible; valeur: string; dit?: string }
  | { faire: 'attendre'; que: Cible }
  | { faire: 'pause'; ms: number }
  | { faire: 'action'; jouer: () => void; dit?: string };
type GesteVisible = Extract<Geste, { faire: 'cliquer' | 'taper' | 'choisir' }>;
const visible = (g: Geste): g is GesteVisible => g.faire === 'cliquer' || g.faire === 'taper' || g.faire === 'choisir';

/**
 * Une démonstration se regarde geste par geste : chaque « temps » contient un seul geste visible
 * (un clic, une saisie, un choix), avec les attentes et les suites automatiques qui l'entourent.
 */
function decouper(gestes: Geste[]): Geste[][] {
  const temps: Geste[][] = [];
  let courant: Geste[] = [];
  let vu = false;
  for (const g of gestes) {
    if (visible(g) && vu) {
      temps.push(courant);
      courant = [];
      vu = false;
    }
    courant.push(g);
    if (visible(g)) vu = true;
  }
  if (courant.length) temps.push(courant);
  return temps;
}

/** Le nom lisible d'un élément : son texte, sans les mentions réservées aux lecteurs d'écran ni les précisions. */
function nomDe(el: HTMLElement): string {
  const copie = el.cloneNode(true) as HTMLElement;
  copie.querySelectorAll('.sr, small, svg, .small, .soft, .aide, .compte, .nav-badge, select, input, textarea, ol, ul, .modele-nom, .voie-etat, .voie-reponse, .pill').forEach((x) => x.remove());
  let texte = (copie.textContent ?? '').replace(/\s+/g, ' ').trim() || el.getAttribute('aria-label') || el.getAttribute('title') || '';
  // Un bloc qui contient un titre et une phrase : on garde le titre.
  const titre = copie.querySelector('b, strong, h2, h3')?.textContent?.trim();
  if (titre && texte.length > titre.length + 12) texte = titre;
  return texte.length > 44 ? `${texte.slice(0, 42).trim()}…` : texte;
}
const champDe = (el: HTMLElement): string => {
  const champ = el as HTMLInputElement;
  const libelle = champ.labels?.[0];
  return (libelle ? nomDe(libelle).replace(/\s*[:*]\s*$/, '') : '') || el.getAttribute('aria-label') || champ.placeholder || '';
};
/** Ce que le prochain temps va faire, dit simplement : « Cliquer sur… », « Écrire… », « Choisir… ». */
function decrire(temps: Geste[] | undefined): string {
  if (!temps) return '';
  const g = temps.find(visible);
  if (!g) return temps.find((x): x is Extract<Geste, { faire: 'action' }> => x.faire === 'action')?.dit ?? 'Voir la suite';
  if (g.dit) return g.dit;
  const el = element(g.faire === 'cliquer' ? g.sur : g.dans);
  if (g.faire === 'cliquer') {
    const nom = el ? nomDe(el) : '';
    return nom ? `Cliquer sur « ${nom} »` : 'Cliquer ici';
  }
  const champ = el ? champDe(el) : '';
  if (g.faire === 'taper') return champ ? `Écrire « ${g.texte} » dans « ${champ} »` : `Écrire « ${g.texte} »`;
  const option = el instanceof HTMLSelectElement ? [...el.options].find((o) => o.value === g.valeur)?.text : undefined;
  return champ ? `Choisir « ${option ?? g.valeur} » dans « ${champ} »` : `Choisir « ${option ?? g.valeur} »`;
}

interface Etape {
  /** Chapitre de la visite ; le sommaire permet de sauter de l'un à l'autre. */
  chapitre?: string;
  /** Élément mis en lumière pendant l'étape (sélecteur CSS). */
  cible?: string;
  /** Élément mis en lumière une fois la démonstration jouée. */
  cibleFin?: string;
  qui: string;
  titre: string;
  texte: (d: AppData) => string;
  /** Pose l'écran de l'étape. Peut être rejouée à tout moment : elle remet en place ce dont l'étape a besoin. */
  jouer: () => void;
  /** Démonstration : les gestes joués sous les yeux de l'utilisateur, l'un après l'autre. */
  gestes?: Geste[];
}

const element = (c: Cible): HTMLElement | null => (typeof c === 'string' ? document.querySelector<HTMLElement>(c) : (c() ?? null));
/** Le premier élément dont le texte contient ces mots : un bouton se désigne comme on le lit. */
const parTexte = (selecteur: string, texte: string): (() => HTMLElement | undefined) => () => [...document.querySelectorAll<HTMLElement>(selecteur)].find((e) => e.textContent?.includes(texte));
const nieme = (selecteur: string, n: number): (() => HTMLElement | undefined) => () => document.querySelectorAll<HTMLElement>(selecteur)[n];
const VALIDER = '.dialog-foot .btn.primary';

/** Écrit dans un champ comme le ferait le clavier : le formulaire reçoit chaque lettre. */
function ecrire(el: HTMLElement, valeur: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, valeur);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

/** Minuteries d'une étape : annulées dès qu'on change d'étape. */
let minuteries: number[] = [];
const plusTard = (fn: () => void, ms: number): void => {
  minuteries.push(window.setTimeout(fn, ms));
};
const annulerMinuteries = (): void => {
  minuteries.forEach((t) => window.clearTimeout(t));
  minuteries = [];
};

const semaineDans = (n: number): string => addDays(mondayOf(store().today), 7 * n);
const helene = (vue: Vue): void => voirComme('caroline.tellier', vue);
/** Mise en place directe des données de démonstration, sans passer par le journal. */
const poser = (fn: (d: AppData) => AppData): void => useStore.setState((s) => ({ data: fn(s.data) }));
/** L'équipe d'exemple et ses contraintes reconnues, sans aucun planning. */
const reference = (): AppData => seed(store().today, -99);

/** Construit puis pose le planning d'une semaine encore vide (un ou deux postes posés à la main ne comptent pas). */
function proposerSemaine(monday: string): void {
  const s = store();
  if (s.data.shifts.filter((x) => x.date >= monday && x.date <= addDays(monday, 6)).length > 8) return;
  s.appliquerGeneration(monday, generer(s.data, monday, { variante: 'equite', graine: 7, iterations: 9000 }));
}
function publierSemaine(monday: string): void {
  proposerSemaine(monday);
  if (store().data.semaines[monday]?.statut !== 'publie') store().publier(monday, [], 0);
}

/** L'équipe au complet. Une personne saisie pendant la démonstration laisse sa place à sa fiche d'exemple. */
function avecEquipe(): void {
  const ref = reference();
  poser((d) => {
    if (ref.personnes.every((p) => d.personnes.some((x) => x.id === p.id))) return d;
    return { ...d, personnes: ref.personnes.map((p) => d.personnes.find((x) => x.id === p.id) ?? p), besoins: d.besoins.length ? d.besoins : ref.besoins };
  });
}
/** L'équipe arrive, une personne après l'autre. */
function arriveeEquipe(): void {
  const ref = reference();
  const noms = new Set(ref.personnes.map((p) => `${p.prenom} ${p.nom}`));
  poser((d) => ({ ...d, personnes: d.personnes.filter((p) => ref.personnes.some((x) => x.id === p.id) || !noms.has(`${p.prenom} ${p.nom}`)) }));
  const manquants = ref.personnes.filter((p) => !store().data.personnes.some((x) => x.id === p.id));
  manquants.forEach((p, i) => plusTard(() => poser((d) => (d.personnes.some((x) => x.id === p.id) ? d : { ...d, personnes: d.personnes.concat(p) })), i * 200));
  plusTard(() => poser((d) => (d.besoins.length ? d : { ...d, besoins: ref.besoins })), manquants.length * 200 + 60);
}

/** Préférences du mois à collecter, d'après les habitudes, avec quelques demi-journées pour varier. */
function souhaitsPour(id: string): void {
  const s = store();
  const p = s.data.personnes.find((x) => x.id === id);
  const mois = moisACollecter(s.data.officine, s.today);
  if (!p) return;
  s.poserSouhaits(proposerSouhaits(s.data, p, mois, s.today).map((x, i) => (i % 7 === 3 ? { ...x, choix: 'matin' as const } : i % 9 === 5 ? { ...x, choix: 'soir' as const } : i % 11 === 8 ? { ...x, choix: 'repos' as const } : x)));
}
function avecSouhaits(camille = true): void {
  avecEquipe();
  ['p_lea', 'p_thomas', 'p_manon', 'p_ines', 'p_jules', 'p_antoine', 'p_sarah', ...(camille ? ['p_camille'] : [])].forEach(souhaitsPour);
}
function avecPlanning(): void {
  avecSouhaits();
  publierSemaine(semaineDans(1));
  publierSemaine(semaineDans(2));
}

/** Nicolas a demandé à être remplacée : la demande attend la réponse de sa titulaire. */
function avecDemande(): void {
  avecPlanning();
  const s = store();
  if (demandeDeCamille(s.data)) return;
  const id = posteARemplacer(s.data, s.today);
  const poste = s.data.shifts.find((x) => x.id === id);
  if (poste) s.demanderRemplacement(poste, 'prevu');
}
function accepterDemandeDeCamille(): void {
  const r = demandeDeCamille(store().data);
  if (r?.accord === 'attente') store().deciderDemande(r.id, true);
}
function avecDemandeAcceptee(): void {
  avecDemande();
  accepterDemandeDeCamille();
}
/** Le collègue qui peut reprendre le poste de Nicolas. */
function volontaire(): string | undefined {
  const r = demandeDeCamille(store().data);
  return r ? (r.volontaires[0] ?? volontairePour(store().data, r)) : undefined;
}
function avecVolontaire(): void {
  avecDemandeAcceptee();
  const r = demandeDeCamille(store().data);
  const v = volontaire();
  if (r && v && !r.volontaires.includes(v)) store().seProposer(r.id, v, true);
}

/** Un justificatif d'exemple : une simple image, pour montrer où il apparaît côté titulaire. */
const JUSTIFICATIF_EXEMPLE: Justificatif = {
  nom: 'justificatif-exemple.svg',
  type: 'image/svg+xml',
  taille: 480,
  data: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260"><rect width="420" height="260" rx="18" fill="#eef4fb"/><text x="210" y="120" font-family="sans-serif" font-size="22" font-weight="700" text-anchor="middle" fill="#1d2731">Justificatif</text><text x="210" y="154" font-family="sans-serif" font-size="15" text-anchor="middle" fill="#4a5a69">Exemple de démonstration</text></svg>')}`,
};
const urgenceMedicale = (d: AppData): Remplacement | undefined => d.remplacements.find((r) => r.urgence === 'medical' && r.statut === 'ouverte');
/** Thomas ne peut pas venir pour raison médicale : demande urgente, justificatif joint. */
function avecUrgenceMedicale(): void {
  avecPlanning();
  const s = store();
  if (urgenceMedicale(s.data)) return;
  const poste = s.data.shifts
    .filter((x) => x.personId === 'p_thomas' && x.date >= semaineDans(1))
    .sort((x, y) => x.date.localeCompare(y.date) || x.start - y.start)[0];
  if (poste) s.demanderRemplacement(poste, 'medical', JUSTIFICATIF_EXEMPLE);
}
/** Inès a demandé un congé, pour montrer un refus. */
function avecCongeARefuser(): void {
  avecPlanning();
  const s = store();
  if (!s.data.absences.some((x) => x.personId === 'p_ines' && x.type === 'conge')) s.declarerAbsence({ personId: 'p_ines', from: addDays(semaineDans(5), 0), to: addDays(semaineDans(5), 2), type: 'conge', statut: 'demandee' });
}

const manque = (d: AppData, date: string): number => sousEffectifs(d, date).length + trousPharmacien(d, date).length;

/** Un arrêt de deux jours la semaine prochaine, pour quelqu'un dont l'absence se voit et que plusieurs collègues peuvent couvrir. */
function avecAbsenceImprevue(): void {
  avecPlanning();
  const s = store();
  if (s.data.absences.some((a) => a.type === 'maladie' && a.statut === 'approuvee')) return;
  const jour = addDays(semaineDans(1), 1);
  const choix = ['p_thomas', 'p_ines', 'p_jules', 'p_karim'].find((id) => {
    const poste = s.data.shifts.find((x) => x.personId === id && x.date === jour);
    if (!poste) return false;
    const sans: AppData = { ...s.data, shifts: s.data.shifts.filter((x) => x !== poste) };
    return manque(sans, jour) > manque(s.data, jour) && tourDeRole(sans, poste, s.today).filter((c) => c.ok).length >= 2;
  });
  s.declarerAbsence({ personId: choix ?? 'p_karim', from: jour, to: addDays(jour, 1), type: 'maladie', statut: 'approuvee' });
}
const absent = (d: AppData): string => prenom(d, d.absences.find((a) => a.type === 'maladie' && a.statut === 'approuvee')?.personId);

/** Les volontaires répondent à l'appel en cours : deux collègues, pour montrer le tour de rôle. */
function reponsesAppel(): void {
  const appel = store().data.remplacements.find((r) => r.trouId && r.statut === 'ouverte');
  if (appel && !appel.volontaires.length) (appel.sollicites ?? []).filter((x) => x !== 'p_helene').slice(0, 2).forEach((x) => store().seProposer(appel.id, x, true));
}
/** L'appel à l'équipe, lancé sur le premier poste à couvrir si l'écran ne l'a pas fait. */
function appelEnCours(): void {
  const s = store();
  if (!s.data.remplacements.some((r) => r.trouId && r.statut === 'ouverte')) {
    const ouverts = s.data.trous.filter((t) => t.statut === 'ouvert' && t.shift.date >= s.today).sort((x, y) => x.shift.date.localeCompare(y.shift.date));
    const trou = ouverts.find((t) => manque(s.data, t.shift.date) > manque({ ...s.data, shifts: s.data.shifts.concat(t.shift) }, t.shift.date)) ?? ouverts[0];
    if (trou) s.appelerEquipe(trou.id);
  }
  reponsesAppel();
}

/** Une garde confiée à Léa, une autre encore à affecter. */
function avecGardes(): void {
  avecPlanning();
  const g = store().data.gardes;
  if (!g.some((x) => x.personId)) store().ajouterGardes([{ date: addDays(semaineDans(3), 5), start: 19 * 60 + 30, end: 8 * 60 + 30, type: 'volets_fermes', personId: 'p_lea', interventions: [] }], true);
  if (!store().data.gardes.some((x) => !x.personId)) store().ajouterGardes([{ date: addDays(semaineDans(5), 6), start: 9 * 60, end: 19 * 60, type: 'volets_ouverts', personId: null, interventions: [] }], false);
}
function avecAccordEnAttente(): void {
  avecGardes();
  const s = store();
  if ((s.data.accords ?? []).some((x) => x.auteur === 'p_antoine')) return;
  const garde = s.data.gardes.find((x) => !x.personId && x.date >= s.today);
  if (garde) s.proposer('p_antoine', 'affecterGarde', [garde.id, 'p_antoine', false]);
}
function avecFormation(): void {
  avecPlanning();
  const s = store();
  const jour = addDays(semaineDans(2), 3);
  if (!s.data.absences.some((x) => x.type === 'formation')) s.planifierFormation({ intitule: 'Gestes d’urgence', personnes: ['p_thomas', 'p_ines'], from: jour, to: jour });
}

// ---------------------------------------------------------------- Une journée type : la pharmacie tourne déjà

const HELENE = 'Caroline · titulaire';
const CAMILLE = 'Nicolas · préparateur';

const ETABLI: Etape[] = [
  {
    qui: HELENE,
    cible: "[data-focus='cycle']",
    titre: 'Le tableau de bord',
    texte: () => 'L’équipe du jour, où en est le planning, les décisions qui attendent.',
    jouer: () => voirComme('caroline.tellier', 'tableau'),
  },
  {
    qui: HELENE,
    cible: "[data-focus='appel']",
    titre: 'L’appel à l’équipe',
    texte: () => 'Un poste à couvrir : tous ceux qui peuvent sont prévenus ensemble. Le moins sollicité passe d’abord.',
    jouer: () => {
      appelEnCours();
      useUi.getState().setSujet('absences');
      voirComme('caroline.tellier', 'resoudre');
    },
  },
  {
    qui: CAMILLE,
    cible: '.prochain',
    titre: 'Ses horaires',
    texte: () => 'Nicolas voit d’abord son prochain poste. Il vient de demander un remplacement.',
    jouer: () => {
      const s = store();
      if (!demandeDeCamille(s.data)) {
        // Le poste est cherché une seule fois : le calcul relit les règles pour chaque collègue.
        const id = posteARemplacer(s.data, s.today);
        const poste = s.data.shifts.find((x) => x.id === id);
        if (poste) s.demanderRemplacement(poste);
        accepterDemandeDeCamille();
      }
      voirComme('nicolas.lesyndicaliste', 'moi');
    },
  },
  {
    qui: 'Un collègue',
    cible: "[data-focus='aider']",
    titre: 'Un collègue se propose',
    texte: () => 'La demande arrive en tête de son planning. Se proposer n’engage à rien.',
    jouer: () => {
      const s = store();
      const r = demandeDeCamille(s.data);
      if (!r) return voirComme('nicolas.lesyndicaliste', 'moi');
      if (r.accord === 'attente') accepterDemandeDeCamille();
      const v = volontaire();
      if (!v) return voirComme('nicolas.lesyndicaliste', 'moi');
      if (!r.volontaires.includes(v)) store().seProposer(r.id, v, true);
      voirComme(store().data.personnes.find((p) => p.id === v)?.identifiant ?? 'nicolas.lesyndicaliste', 'moi');
    },
  },
  {
    qui: HELENE,
    cible: "[data-focus='demande-remplacement']",
    titre: 'Valider',
    texte: () => 'Les règles sont relues, les heures en plus annoncées. Un clic valide.',
    jouer: () => {
      useUi.getState().setSujet('remplacements');
      voirComme('caroline.tellier', 'resoudre');
    },
  },
  {
    qui: CAMILLE,
    cible: '.sh-cal',
    titre: 'Mes préférences',
    texte: () => 'Une forme par jour, sans raison à donner. « M’assister » remplit le reste.',
    jouer: () => versDemandes('nicolas.lesyndicaliste', 'souhaits'),
  },
  {
    qui: 'Igor · pharmacien adjoint',
    cible: '.content .card',
    titre: 'Ses gardes',
    texte: () => 'Dates, repos qui suit, récupérations. Pas d’accès à la gestion.',
    jouer: () => voirComme('igor.lerusse', 'mesgardes'),
  },
  {
    qui: 'Pierre · titulaire secondaire',
    cible: '.panneau',
    titre: 'Décider à deux',
    texte: () => 'Mêmes écrans que Caroline. Sa décision attend son accord.',
    jouer: () => {
      const s = store();
      if (!(s.data.accords ?? []).some((x) => x.auteur === 'p_antoine')) {
        const garde = s.data.gardes.find((g) => !g.personId && g.date >= s.today);
        if (garde) s.proposer('p_antoine', 'affecterGarde', [garde.id, 'p_antoine', false]);
      }
      useUi.getState().setSujet('accords');
      voirComme('pierre.fiandino', 'resoudre');
    },
  },
  {
    qui: HELENE,
    cible: '.panneau',
    titre: 'Donner son accord',
    texte: () => 'Caroline accepte ou refuse. Pierre est prévenu.',
    jouer: () => {
      useUi.getState().setSujet('accords');
      voirComme('caroline.tellier', 'resoudre');
    },
  },
  {
    qui: HELENE,
    cible: '.dialog',
    titre: 'Pauses et retards',
    texte: () => 'Toute l’équipe sur une ligne de temps. On règle une pause, on note un retard.',
    jouer: () => {
      voirComme('caroline.tellier', 'construire');
      useUi.getState().setSemaine(mondayOf(store().today));
      useUi.getState().voirJour(store().today);
    },
  },
  {
    qui: HELENE,
    cible: "[data-tour='proposer']",
    titre: 'Construire',
    texte: () => '« Proposer un planning » calcule trois semaines comparables. Vous choisissez.',
    jouer: () => {
      voirComme('caroline.tellier', 'construire');
      // L'exemple a deux semaines publiées d'avance : la semaine à construire est la troisième.
      useUi.getState().setSemaine(addDays(mondayOf(store().today), 21));
    },
  },
  {
    qui: HELENE,
    cible: "[data-focus='mois']",
    titre: 'Le mois',
    texte: () => 'Objectif d’équipe, heures face au contrat, préférences données.',
    jouer: () => {
      voirComme('caroline.tellier', 'construire');
      useUi.getState().setPlanVue('mois');
    },
  },
  {
    qui: HELENE,
    cible: "[data-focus='compteurs-heures']",
    titre: 'Le compteur d’heures',
    texte: () => 'Heures en plus ou en moins. À régulariser à la main, ou automatiquement.',
    jouer: () => voirComme('caroline.tellier', 'heures'),
  },
];

// ---------------------------------------------------------------- Visite du titulaire : tout Solvéa, dans l'ordre du menu

const PREPARER = 'Préparer';
const PLANIFIER = 'Planifier';
const EQUIPE = 'Côté équipe';
const SUIVRE = 'Suivre';
const BILAN = 'Bilan';
const QUOTIDIEN = 'Au quotidien';
const semaineUne = (): void => {
  helene('construire');
  useUi.getState().setSemaine(semaineDans(1));
};

const COMPLET: Etape[] = [
  // ---- 1. Préparer
  {
    chapitre: PREPARER,
    qui: HELENE,
    cible: '.accueil-form',
    titre: 'Créer la pharmacie',
    texte: () => 'Trois écrans : le nom, les horaires, l’équipe. Ici, on part de zéro.',
    jouer: () => helene('nouvelle'),
    gestes: [{ faire: 'taper', dans: '#officine-nom', texte: 'Grande Pharmacie de la Pinède' }],
  },
  {
    chapitre: PREPARER,
    qui: HELENE,
    cible: '.content .split',
    titre: 'Horaires et effectif',
    texte: () => 'Les horaires jour par jour. À droite, le nombre de personnes attendues au comptoir.',
    jouer: () => helene('officine'),
  },
  {
    chapitre: PREPARER,
    qui: HELENE,
    cible: "[data-focus='modele']",
    titre: 'Classique ou collaboratif',
    texte: () => 'Collaboratif : l’équipe donne ses préférences. Classique : vous construisez seule.',
    jouer: () => helene('officine'),
    gestes: [
      { faire: 'cliquer', sur: parTexte("[data-focus='modele'] label", 'Classique') },
      { faire: 'pause', ms: 900 },
      { faire: 'cliquer', sur: parTexte("[data-focus='modele'] label", 'Collaboratif') },
    ],
  },
  {
    chapitre: PREPARER,
    qui: HELENE,
    cible: '.content .split > :first-child',
    titre: 'Ajouter l’équipe',
    texte: (d) => (d.personnes.length > 2 ? `${d.personnes.length} personnes, rangées par poste. Chacune a sa couleur et son compte.` : 'Prénom, nom, poste, heures du contrat. Regardez.'),
    jouer: () => helene('equipe'),
    gestes: [
      { faire: 'cliquer', sur: "[data-focus='ajouter-personne']" },
      { faire: 'taper', dans: '#personne-prenom', texte: 'Sarah' },
      { faire: 'taper', dans: '#personne-nom', texte: 'Lemoine' },
      { faire: 'choisir', dans: '#personne-fonction', valeur: 'animateur' },
      { faire: 'taper', dans: '#personne-heures', texte: '21' },
      { faire: 'cliquer', sur: VALIDER },
      { faire: 'action', jouer: arriveeEquipe },
      { faire: 'pause', ms: 2600 },
    ],
  },
  {
    chapitre: PREPARER,
    qui: HELENE,
    cible: '.content .split > :last-child',
    titre: 'La fiche d’une personne',
    texte: () => 'Contrat, compétences et diplômes, compte de connexion. Un clic coche une compétence.',
    jouer: () => {
      avecEquipe();
      helene('equipe');
      useUi.getState().ouvrirPersonne('p_camille');
    },
    gestes: [{ faire: 'cliquer', sur: parTexte('.content .split > :last-child button[aria-pressed]', 'Dermatologie') }],
  },
  {
    chapitre: PREPARER,
    qui: HELENE,
    cible: '.content .card',
    titre: 'Les règles',
    texte: () => 'Durées, repos, pauses, délais : chaque contrôle a sa source. Vos seuils se règlent ici.',
    jouer: () => {
      avecEquipe();
      helene('regles');
    },
  },
  // ---- 2. Planifier
  {
    chapitre: PLANIFIER,
    qui: CAMILLE,
    cible: '.sh-cal',
    titre: 'Les préférences du mois',
    texte: () => 'Nicolas choisit une forme, clique les jours. « M’assister » remplit le reste. Jamais de raison.',
    jouer: () => {
      avecSouhaits(false);
      versDemandes('nicolas.lesyndicaliste', 'souhaits');
    },
    gestes: [
      { faire: 'cliquer', sur: '.sh-choix.matin' },
      { faire: 'cliquer', sur: nieme('button.sh-jour', 1) },
      { faire: 'cliquer', sur: nieme('button.sh-jour', 2) },
      { faire: 'cliquer', sur: "[data-focus='assister']" },
    ],
  },
  {
    chapitre: PLANIFIER,
    qui: HELENE,
    cible: '.content .plan',
    titre: 'Une semaine à construire',
    texte: () => 'Une ligne par personne, un groupe par poste, une colonne par jour.',
    jouer: () => {
      avecSouhaits();
      semaineUne();
    },
  },
  {
    chapitre: PLANIFIER,
    qui: HELENE,
    cible: '.content .plan',
    cibleFin: '.content .plan',
    titre: 'Poser un poste',
    texte: () => 'Un « + » ouvre le poste : horaires, pause, activité. On enregistre.',
    jouer: () => {
      avecSouhaits();
      semaineUne();
    },
    gestes: [
      { faire: 'cliquer', sur: '.plan-grid .add' },
      { faire: 'attendre', que: '.dialog' },
      { faire: 'pause', ms: 900 },
      { faire: 'cliquer', sur: VALIDER },
    ],
  },
  {
    chapitre: PLANIFIER,
    qui: HELENE,
    cible: '.content .plan',
    cibleFin: '.content .plan',
    titre: 'Trois propositions',
    texte: () => 'Équité, préférences ou coût d’abord. Les règles passent toujours avant. Vous choisissez.',
    jouer: () => {
      avecSouhaits();
      semaineUne();
    },
    gestes: [
      { faire: 'cliquer', sur: "[data-tour='proposer']" },
      { faire: 'attendre', que: '.dialog .variant' },
      { faire: 'pause', ms: 1200 },
      { faire: 'cliquer', sur: nieme('.dialog .variant', 1), dit: 'Regarder la deuxième proposition' },
      { faire: 'cliquer', sur: nieme('.dialog .variant', 0), dit: 'Revenir à la première proposition' },
      { faire: 'cliquer', sur: VALIDER },
    ],
  },
  {
    chapitre: PLANIFIER,
    qui: HELENE,
    cible: '.content .plan',
    titre: 'La semaine est posée',
    texte: () => 'Jaune le matin, bleu la journée, violet l’après-midi. Chaque tuile se déplace ou se corrige.',
    jouer: () => {
      avecSouhaits();
      proposerSemaine(semaineDans(1));
      semaineUne();
    },
  },
  {
    chapitre: PLANIFIER,
    qui: HELENE,
    cible: "[data-tour='controles']",
    titre: 'Les contrôles',
    texte: () => 'Ce qui bloque, ce qui alerte. Un clic montre la personne et le jour.',
    jouer: () => {
      avecSouhaits();
      proposerSemaine(semaineDans(1));
      semaineUne();
    },
  },
  {
    chapitre: PLANIFIER,
    qui: HELENE,
    cible: "[data-focus='mois']",
    titre: 'Le mois',
    texte: () => 'Objectif d’équipe par jour, heures face au contrat, préférences en gris.',
    jouer: () => {
      avecSouhaits();
      proposerSemaine(semaineDans(1));
      semaineUne();
      useUi.getState().setPlanVue('mois');
    },
  },
  {
    chapitre: PLANIFIER,
    qui: HELENE,
    cible: '.dialog',
    titre: 'Une journée',
    texte: () => 'Toute l’équipe sur une ligne de temps. On règle les pauses, on note un retard.',
    jouer: () => {
      avecSouhaits();
      proposerSemaine(semaineDans(1));
      semaineUne();
      useUi.getState().voirJour(addDays(semaineDans(1), 1));
    },
  },
  {
    chapitre: PLANIFIER,
    qui: HELENE,
    cible: '.plan-bar',
    cibleFin: '.plan-bar',
    titre: 'Publier',
    texte: (d) => (d.semaines[semaineDans(1)]?.statut === 'publie' ? 'C’est publié : toute l’équipe voit la semaine.' : 'Un dernier contrôle, les accords à recueillir, puis l’envoi à l’équipe.'),
    jouer: () => {
      avecSouhaits();
      proposerSemaine(semaineDans(1));
      semaineUne();
    },
    gestes: [
      { faire: 'cliquer', sur: "[data-focus='publier']" },
      { faire: 'attendre', que: '.dialog' },
      { faire: 'cliquer', sur: parTexte('.dialog button', 'Tout cocher') },
      { faire: 'cliquer', sur: VALIDER },
      { faire: 'action', jouer: avecPlanning },
    ],
  },
  {
    chapitre: PLANIFIER,
    qui: HELENE,
    cible: "button[aria-label='Imprimer le planning']",
    titre: 'Imprimer',
    texte: () => 'Une feuille propre pour l’affichage. Chacun peut aussi imprimer son planning.',
    jouer: () => {
      avecPlanning();
      semaineUne();
    },
  },
  {
    chapitre: PLANIFIER,
    qui: HELENE,
    cible: '.content .card',
    cibleFin: '.content .card',
    titre: 'Les gardes',
    texte: () => 'On ajoute la garde, on la confie, le pharmacien est prévenu. Délai et repos sont contrôlés.',
    jouer: () => {
      avecPlanning();
      helene('gardes');
    },
    gestes: [
      { faire: 'cliquer', sur: parTexte('.content button', 'Ajouter une garde') },
      { faire: 'choisir', dans: '#garde-personne', valeur: 'p_lea' },
      { faire: 'cliquer', sur: VALIDER },
      { faire: 'action', jouer: avecGardes },
    ],
  },
  {
    chapitre: PLANIFIER,
    qui: HELENE,
    cible: '.topbar-in',
    cibleFin: "[data-tour='grille']",
    titre: 'Une formation',
    texte: () => 'Depuis « Créer » : un nom, des dates, des participants. Chacun est prévenu.',
    jouer: () => {
      avecPlanning();
      helene('construire');
      useUi.getState().setSemaine(semaineDans(2));
    },
    gestes: [
      { faire: 'cliquer', sur: '.top-creer' },
      { faire: 'cliquer', sur: parTexte('.outils .menu button', 'Une formation') },
      { faire: 'taper', dans: '#formation-intitule', texte: 'Gestes d’urgence' },
      { faire: 'cliquer', sur: '#formation-p_thomas', dit: 'Cocher Thomas parmi les participants' },
      { faire: 'cliquer', sur: '#formation-p_ines', dit: 'Cocher Inès' },
      { faire: 'cliquer', sur: VALIDER, dit: 'Cliquer sur « Planifier et prévenir »' },
      {
        faire: 'action',
        jouer: () => {
          helene('construire');
          useUi.getState().setSemaine(semaineDans(2));
        },
      },
    ],
  },
  {
    chapitre: PLANIFIER,
    qui: HELENE,
    cible: '.topbar-in',
    cibleFin: "[data-tour='grille']",
    titre: 'Un inventaire',
    texte: () => 'Une date, un horaire, les personnes mobilisées. Il compte dans leurs heures.',
    jouer: () => {
      avecFormation();
      helene('construire');
      useUi.getState().setSemaine(semaineDans(3));
    },
    gestes: [
      { faire: 'cliquer', sur: '.top-creer' },
      { faire: 'cliquer', sur: parTexte('.outils .menu button', 'Un inventaire') },
      { faire: 'cliquer', sur: parTexte('.dialog button', 'Toute l’équipe'), dit: 'Cliquer sur « Toute l’équipe »' },
      { faire: 'cliquer', sur: VALIDER },
      {
        faire: 'action',
        jouer: () => {
          const jour = store().data.shifts.find((x) => x.activite === 'inventaire')?.date;
          helene('construire');
          useUi.getState().setSemaine(jour ? mondayOf(jour) : semaineDans(3));
        },
      },
    ],
  },
  // ---- 3. Côté équipe
  {
    chapitre: EQUIPE,
    qui: CAMILLE,
    cible: '.prochain',
    titre: 'Mon planning',
    texte: () => 'Le prochain poste en grand, puis la semaine. Jamais un brouillon.',
    jouer: () => {
      avecPlanning();
      voirComme('nicolas.lesyndicaliste', 'moi');
    },
  },
  {
    chapitre: EQUIPE,
    qui: CAMILLE,
    cible: '.me-grid',
    cibleFin: 'table.cal',
    titre: 'Le calendrier du mois',
    texte: () => 'Le mois entier, les horaires dans chaque case.',
    jouer: () => {
      avecPlanning();
      voirComme('nicolas.lesyndicaliste', 'moi');
    },
    gestes: [{ faire: 'cliquer', sur: parTexte('.me-grid .seg button', 'Calendrier') }],
  },
  {
    chapitre: EQUIPE,
    qui: CAMILLE,
    cible: '.content .plan',
    titre: 'Le planning de l’équipe',
    texte: () => 'Qui travaille quand. « Mes postes » ne garde que sa ligne.',
    jouer: () => {
      avecPlanning();
      voirComme('nicolas.lesyndicaliste', 'planning');
      useUi.getState().setSemaine(semaineDans(1));
    },
    gestes: [
      { faire: 'cliquer', sur: parTexte('.plan-bar .seg button', 'Mes postes') },
      { faire: 'pause', ms: 1400 },
      { faire: 'cliquer', sur: parTexte('.plan-bar .seg button', 'Toute l’équipe') },
    ],
  },
  {
    chapitre: EQUIPE,
    qui: CAMILLE,
    cible: '.voies',
    titre: 'Mes demandes',
    texte: () => 'Trois cartes : mes préférences, une absence, un remplacement.',
    jouer: () => {
      avecPlanning();
      versDemandes('nicolas.lesyndicaliste', 'absences');
    },
    gestes: [
      { faire: 'cliquer', sur: parTexte('#contenu .voie', 'remplacer') },
      { faire: 'cliquer', sur: parTexte('#contenu .voie', 'Absence') },
    ],
  },
  {
    chapitre: EQUIPE,
    qui: CAMILLE,
    cible: '.dialog',
    titre: 'Demander, sans raison',
    texte: () => 'Un raccourci remplit les horaires. Le motif n’est jamais demandé ni conservé.',
    jouer: () => {
      avecPlanning();
      versDemandes('nicolas.lesyndicaliste', 'absences');
      useUi.getState().agir('demandes', 'demande');
    },
    gestes: [
      { faire: 'attendre', que: '.dialog' },
      { faire: 'cliquer', sur: parTexte('.dialog button', 'Sortie d’école') },
    ],
  },
  {
    chapitre: EQUIPE,
    qui: CAMILLE,
    cible: "[data-focus='remplacer']",
    cibleFin: "[data-focus='remplacer']",
    titre: 'Se faire remplacer',
    texte: () => 'Prévu, urgent ou urgence médicale, avec justificatif. La titulaire répondra.',
    jouer: () => {
      avecPlanning();
      versDemandes('nicolas.lesyndicaliste', 'remplacements');
    },
    gestes: [
      { faire: 'cliquer', sur: "[data-focus='remplacer'] .btn" },
      { faire: 'attendre', que: '.dialog .choix.urgence' },
      { faire: 'cliquer', sur: parTexte('.choix.urgence label', 'Urgence médicale') },
      { faire: 'pause', ms: 900 },
      { faire: 'cliquer', sur: parTexte('.choix.urgence label', 'Urgent') },
      { faire: 'cliquer', sur: VALIDER },
    ],
  },
  {
    chapitre: EQUIPE,
    qui: 'Léa · pharmacienne adjointe',
    cible: '.content .card',
    titre: 'Mes gardes',
    texte: () => 'Ses gardes, le repos qui suit, ce qui part en paie.',
    jouer: () => {
      avecGardes();
      voirComme('lea.fontaine', 'mesgardes');
    },
  },
  {
    chapitre: EQUIPE,
    qui: CAMILLE,
    cible: '.content .deux',
    titre: 'Mon suivi',
    texte: () => 'Son compteur d’heures, ce qui a été noté, sa part des contraintes. Aucun classement.',
    jouer: () => {
      avecPlanning();
      voirComme('nicolas.lesyndicaliste', 'suivi');
    },
  },
  // ---- 4. Suivre
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: "[data-focus='demande-remplacement']",
    cibleFin: "[data-focus='demande-remplacement']",
    titre: 'La demande arrive',
    texte: (d) => (demandeDeCamille(d)?.accord === 'attente' ? 'Triée par urgence. Caroline répond oui ou non.' : 'Acceptée : ceux qui peuvent tenir le poste sont prévenus ensemble.'),
    jouer: () => {
      avecDemande();
      useUi.getState().setSujet('remplacements');
      helene('resoudre');
    },
    gestes: [{ faire: 'cliquer', sur: parTexte('.demande-r button', 'Accepter') }],
  },
  {
    chapitre: SUIVRE,
    qui: 'Un collègue',
    cible: "[data-focus='aider']",
    cibleFin: "[data-focus='aider']",
    titre: 'Un collègue se propose',
    texte: () => 'La demande est en tête de son planning. Se proposer n’engage à rien.',
    jouer: () => {
      avecDemandeAcceptee();
      const v = volontaire();
      voirComme(store().data.personnes.find((p) => p.id === v)?.identifiant ?? 'nicolas.lesyndicaliste', 'moi');
    },
    gestes: [{ faire: 'cliquer', sur: parTexte("[data-focus='aider'] button", 'Je me propose') }],
  },
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: "[data-focus='demande-remplacement']",
    cibleFin: '.onglets, .content .empty, .content .card',
    titre: 'Valider le remplacement',
    texte: (d) => (demandeDeCamille(d) ? 'Règles relues, heures en plus annoncées. Caroline valide.' : 'Validé : les deux personnes sont prévenues, le compteur d’heures suit.'),
    jouer: () => {
      avecVolontaire();
      useUi.getState().setSujet('remplacements');
      helene('resoudre');
    },
    gestes: [{ faire: 'cliquer', sur: parTexte('.demande-r button', 'Valider avec') }],
  },
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: '.demande-r.u-medical',
    cibleFin: '.demande-r.u-medical, .onglets',
    titre: 'Une urgence médicale',
    texte: (d) => (urgenceMedicale(d)?.accord === 'attente' ? 'En tête de liste, en rouge. Le justificatif n’est visible que des titulaires.' : 'Acceptée. Le justificatif est effacé dès que le remplacement est réglé.'),
    jouer: () => {
      avecUrgenceMedicale();
      useUi.getState().setSujet('remplacements');
      helene('resoudre');
    },
    gestes: [{ faire: 'cliquer', sur: parTexte('.demande-r.u-medical button', 'Accepter') }],
  },
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: '.panneau',
    titre: 'Congés et horaires',
    texte: () => 'Jules demande un congé. Avant de répondre, on voit ce que l’absence découvre.',
    jouer: () => {
      avecPlanning();
      const s = store();
      if (!s.data.absences.some((x) => x.personId === 'p_jules' && x.type === 'conge')) s.declarerAbsence({ personId: 'p_jules', from: addDays(semaineDans(4), 0), to: addDays(semaineDans(4), 4), type: 'conge', statut: 'demandee' });
      useUi.getState().setSujet('demandes');
      helene('resoudre');
    },
    gestes: [{ faire: 'cliquer', sur: parTexte('.panneau button', 'Approuver') }],
  },
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: '.panneau',
    titre: 'Refuser une demande',
    texte: (d) => (d.absences.some((a) => a.personId === 'p_ines' && a.statut === 'refusee') ? 'Refusée. Inès reçoit le message, avec la raison.' : 'Inès demande un congé au mauvais moment. On refuse, en donnant la raison.'),
    jouer: () => {
      avecCongeARefuser();
      useUi.getState().setSujet('demandes');
      helene('resoudre');
    },
    gestes: [
      { faire: 'cliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.panneau .decision')].find((e) => /Inès/.test(e.textContent ?? ''))?.querySelector<HTMLElement>('button'), dit: 'Cliquer sur « Refuser », sur la demande d’Inès' },
      { faire: 'attendre', que: '#refus-raison' },
      { faire: 'choisir', dans: '#refus-raison', valeur: 'Plusieurs absences déjà prévues' },
      { faire: 'taper', dans: '#refus-mot', texte: 'La semaine suivante serait possible.' },
      { faire: 'cliquer', sur: '.dialog-foot .btn.danger' },
    ],
  },
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: '.panneau',
    titre: 'Une absence imprévue',
    texte: (d) => `${absent(d)} est en arrêt. Pour chaque jour : ce qui manque, et les options comparées.`,
    jouer: () => {
      avecAbsenceImprevue();
      useUi.getState().setSujet('absences');
      helene('resoudre');
    },
  },
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: "[data-focus='appel']",
    cibleFin: "[data-focus='appel']",
    titre: 'L’appel à l’équipe',
    texte: (d) => (d.remplacements.some((r) => r.trouId && r.statut === 'ouverte') ? 'Tous prévenus ensemble. Le moins sollicité passe d’abord. Dire non ne coûte rien.' : 'Plutôt que d’appeler toujours les mêmes : un clic prévient tout le monde.'),
    jouer: () => {
      avecAbsenceImprevue();
      useUi.getState().setSujet('absences');
      helene('resoudre');
    },
    gestes: [
      { faire: 'cliquer', sur: '.appel .btn.primary' },
      { faire: 'action', jouer: reponsesAppel },
      { faire: 'action', jouer: appelEnCours },
    ],
  },
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: '.panneau',
    cibleFin: '.panneau, .onglets, .content .empty',
    titre: 'Personne ne se propose',
    texte: (d) => (d.trous.some((t) => t.statut === 'ouvert') ? 'Pas de volontaire ? Pour chaque jour, la solution conseillée est cochée. Vous gardez la main.' : 'Réglé : chaque jour a sa solution, tout le monde est prévenu.'),
    jouer: () => {
      avecAbsenceImprevue();
      useUi.getState().setSujet('absences');
      helene('resoudre');
    },
    gestes: [
      { faire: 'cliquer', sur: parTexte('.panneau button', 'Voir et choisir la solution') },
      { faire: 'attendre', que: '.rs-jour' },
      { faire: 'cliquer', sur: '.rs-jour .rs-option:not(.on):not(.main)', dit: 'Choisir une autre option pour le premier jour' },
      { faire: 'cliquer', sur: '.dialog-foot .btn.primary' },
    ],
  },
  {
    chapitre: SUIVRE,
    qui: 'Pierre · titulaire secondaire',
    cible: '.panneau',
    titre: 'Décider à deux',
    texte: () => 'Pierre a les mêmes écrans. Sa décision attend l’accord de Caroline.',
    jouer: () => {
      avecAccordEnAttente();
      useUi.getState().setSujet('accords');
      voirComme('pierre.fiandino', 'resoudre');
    },
  },
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: '.panneau',
    cibleFin: '.onglets, .content .empty, .content .card',
    titre: 'Donner son accord',
    texte: (d) => ((d.accords ?? []).length ? 'La décision de Pierre arrive ici. Caroline l’accepte.' : 'Accord donné : la décision est appliquée, Pierre est prévenu.'),
    jouer: () => {
      avecAccordEnAttente();
      useUi.getState().setSujet('accords');
      helene('resoudre');
    },
    gestes: [{ faire: 'cliquer', sur: parTexte('.panneau button', 'Donner mon accord') }],
  },
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: '.fil',
    cibleFin: '.fil',
    titre: 'Les messages',
    texte: () => 'Un fil pour l’équipe, des conversations privées.',
    jouer: () => {
      avecEquipe();
      helene('messages');
    },
    gestes: [
      { faire: 'taper', dans: '#msg-texte', texte: 'Planning publié pour deux semaines.' },
      { faire: 'cliquer', sur: parTexte('.content button', 'Envoyer') },
    ],
  },
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: "[data-focus='compteurs-heures']",
    titre: 'Le compteur d’heures',
    texte: () => 'Heures en plus ou en moins. Payer, faire récupérer, ou régulariser automatiquement.',
    jouer: () => {
      avecPlanning();
      helene('heures');
    },
  },
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: '.compteurs',
    titre: 'Retards et suivi',
    texte: () => 'Un retard de Jules est noté. Sa fiche compte des dates et des durées, jamais une raison.',
    jouer: () => {
      avecPlanning();
      const s = store();
      if (!(s.data.ecarts ?? []).some((e) => e.personId === 'p_jules')) s.signalerEcart({ personId: 'p_jules', date: s.today, type: 'retard', minutes: 15 });
      helene('equipe');
      useUi.getState().ouvrirPersonne('p_jules');
    },
  },
  // ---- 5. Bilan
  {
    chapitre: BILAN,
    qui: HELENE,
    cible: '.content .card',
    titre: 'L’équité',
    texte: () => 'Samedis, fermetures, gardes, dépannages : qui a porté quoi, face à sa part.',
    jouer: () => {
      avecPlanning();
      helene('equite');
    },
  },
  {
    chapitre: BILAN,
    qui: HELENE,
    cible: '.content .card',
    titre: 'Le journal et la paie',
    texte: () => 'Chaque décision est tracée. La fiche navette du mois s’exporte pour le comptable.',
    jouer: () => {
      avecPlanning();
      helene('journal');
    },
  },
  // ---- 6. Au quotidien
  {
    chapitre: QUOTIDIEN,
    qui: HELENE,
    cible: "[data-focus='cycle']",
    titre: 'Le tableau de bord',
    texte: () => 'L’équipe du jour, puis où en est le planning : la prochaine étape est toujours indiquée.',
    jouer: () => {
      avecAbsenceImprevue();
      helene('tableau');
    },
  },
  {
    chapitre: QUOTIDIEN,
    qui: HELENE,
    cible: '.topbar-in',
    cibleFin: '.outils .menu',
    titre: 'Le bouton « Créer »',
    texte: () => 'Planning, garde, formation, inventaire, personne, absence, message : depuis partout.',
    jouer: () => {
      avecPlanning();
      helene('tableau');
    },
    gestes: [{ faire: 'cliquer', sur: '.top-creer' }],
  },
  {
    chapitre: QUOTIDIEN,
    qui: HELENE,
    cible: '.topbar-in',
    cibleFin: '.outils .menu',
    titre: 'La cloche',
    texte: () => 'Une ligne par demande, la plus urgente en tête. Un clic y mène.',
    jouer: () => {
      avecAbsenceImprevue();
      helene('tableau');
    },
    gestes: [{ faire: 'cliquer', sur: '.outils .top-ico' }],
  },
  {
    chapitre: QUOTIDIEN,
    qui: HELENE,
    cible: '#officine-choix',
    titre: 'Plusieurs pharmacies',
    texte: () => 'Autant de pharmacies que vous voulez. Ce sélecteur passe de l’une à l’autre.',
    jouer: () => {
      avecPlanning();
      helene('tableau');
    },
  },
  {
    chapitre: QUOTIDIEN,
    qui: HELENE,
    cible: "[data-focus='assistant']",
    cibleFin: '.aide-panneau',
    titre: 'L’assistant Solvéa',
    texte: () => 'Posez une question : il lit le planning, répond, et vous emmène au bon écran.',
    jouer: () => {
      avecPlanning();
      helene('tableau');
      useUi.getState().montrerAssistant(true);
    },
    gestes: [
      { faire: 'cliquer', sur: "[data-focus='assistant']" },
      { faire: 'taper', dans: '#aide-question', texte: 'Qui travaille demain ?' },
      { faire: 'cliquer', sur: '.aide-envoyer' },
      { faire: 'attendre', que: '.aide-bulle.bot ul, .aide-bulle.bot .btn' },
    ],
  },
  {
    chapitre: QUOTIDIEN,
    qui: HELENE,
    cible: "[aria-labelledby='c-code']",
    titre: 'Mot de passe et clé de secours',
    texte: () => 'Chacun change son mot de passe. La clé de secours sert en cas d’oubli.',
    jouer: () => {
      avecPlanning();
      helene('compte');
    },
  },
  {
    chapitre: QUOTIDIEN,
    qui: HELENE,
    cible: "[aria-labelledby='c-apparence']",
    titre: 'Votre compte',
    texte: () => 'Dix couleurs, clair ou sombre. La visite est terminée : tout reste à essayer.',
    jouer: () => {
      avecPlanning();
      helene('compte');
    },
    gestes: [
      { faire: 'cliquer', sur: 'label[for="mode-sombre"]' },
      { faire: 'pause', ms: 1600 },
      { faire: 'cliquer', sur: 'label[for="mode-clair"]' },
    ],
  },
];

const MON_PLANNING = 'Mon planning';
const MES_DEMANDES = 'Mes demandes';
const AVEC_EQUIPE = 'L’équipe et moi';
const MON_ESPACE = 'Mon espace';

/** Un appel à l'équipe en cours auquel cette personne peut répondre : on le lance s'il n'existe pas. */
function appelPour(personId: string): void {
  const s = store();
  if (s.data.remplacements.some((r) => r.trouId && r.statut === 'ouverte' && (r.sollicites ?? []).includes(personId))) return;
  const peut = (d: AppData, poste: AppData['shifts'][number]): boolean => tourDeRole(d, poste, s.today).some((c) => c.personId === personId && c.ok);
  const ouvert = s.data.trous.find((t) => t.statut === 'ouvert' && t.shift.date >= s.today && peut(s.data, t.shift));
  if (ouvert) return s.appelerEquipe(ouvert.id);
  // Sinon, un collègue est absent dans les prochains jours, sur un poste que cette personne peut tenir.
  for (let j = 1; j <= 20; j++) {
    const date = addDays(s.today, j);
    if (s.data.semaines[mondayOf(date)]?.statut !== 'publie') continue;
    for (const q of s.data.personnes.filter((x) => !x.externe && x.id !== personId && x.id !== 'p_helene')) {
      const poste = s.data.shifts.find((x) => x.personId === q.id && x.date === date);
      if (!poste || !peut({ ...s.data, shifts: s.data.shifts.filter((x) => x !== poste) }, poste)) continue;
      s.declarerAbsence({ personId: q.id, from: date, to: date, type: 'maladie', statut: 'approuvee' });
      const trou = store().data.trous.find((t) => t.shift.id === poste.id && t.statut === 'ouvert');
      if (trou) store().appelerEquipe(trou.id);
      return;
    }
  }
}

/** La visite d'un membre de l'équipe : son planning, ses demandes, ses collègues, son espace. Rien de la gestion. */
function visiteDe(p: { id: string; identifiant: string; qui: string; prenom: string; pharmacien?: boolean }): Etape[] {
  const moi = (vue: Vue): void => voirComme(p.identifiant, vue);
  return [
    {
      chapitre: MON_PLANNING,
      qui: p.qui,
      cible: '.prochain',
      titre: 'Mon prochain poste',
      texte: () => 'La première chose qu’on cherche, la première qu’on voit.',
      jouer: () => moi('moi'),
    },
    {
      chapitre: MON_PLANNING,
      qui: p.qui,
      cible: '.me-grid .card',
      titre: 'Ma semaine',
      texte: () => 'Horaires, pause, durée. Seul le planning publié s’affiche.',
      jouer: () => moi('moi'),
    },
    {
      chapitre: MON_PLANNING,
      qui: p.qui,
      cible: '.me-grid',
      cibleFin: 'table.cal',
      titre: 'Le calendrier du mois',
      texte: () => 'Le mois entier, les mêmes couleurs que partout.',
      jouer: () => moi('moi'),
      gestes: [{ faire: 'cliquer', sur: parTexte('.me-grid .seg button', 'Calendrier') }],
    },
    {
      chapitre: MON_PLANNING,
      qui: p.qui,
      cible: '.content .plan',
      titre: 'Le planning de l’équipe',
      texte: () => 'Qui travaille quand. « Mes postes » ne garde que votre ligne.',
      jouer: () => {
        moi('planning');
        useUi.getState().setSemaine(mondayOf(store().today));
      },
      gestes: [{ faire: 'cliquer', sur: parTexte('.plan-bar .seg button', 'Mes postes') }],
    },
    {
      chapitre: MES_DEMANDES,
      qui: p.qui,
      cible: '.voies',
      titre: 'Mes demandes',
      texte: () => 'Trois cartes : mes préférences, une absence, un remplacement.',
      jouer: () => versDemandes(p.identifiant, 'absences'),
      gestes: [
        { faire: 'cliquer', sur: parTexte('#contenu .voie', 'remplacer') },
        { faire: 'cliquer', sur: parTexte('#contenu .voie', 'Absence') },
      ],
    },
    {
      chapitre: MES_DEMANDES,
      qui: p.qui,
      cible: '.sh-cal',
      titre: 'Mes préférences',
      texte: () => 'Une forme, puis les jours. « M’assister » remplit le reste. Jamais de raison.',
      jouer: () => versDemandes(p.identifiant, 'souhaits'),
      gestes: [
        { faire: 'cliquer', sur: '.sh-choix.matin' },
        { faire: 'cliquer', sur: nieme('button.sh-jour', 1) },
        { faire: 'cliquer', sur: nieme('button.sh-jour', 2) },
        { faire: 'cliquer', sur: "[data-focus='assister']" },
      ],
    },
    {
      chapitre: MES_DEMANDES,
      qui: p.qui,
      cible: '.dialog',
      titre: 'Demander un congé',
      texte: () => 'Des dates, c’est tout. Le motif n’est jamais demandé.',
      jouer: () => {
        versDemandes(p.identifiant, 'absences');
        useUi.getState().agir('demandes', 'demande');
      },
      gestes: [
        { faire: 'attendre', que: '.dialog' },
        { faire: 'cliquer', sur: parTexte('.dialog button', 'Sortie d’école') },
      ],
    },
    {
      chapitre: MES_DEMANDES,
      qui: p.qui,
      cible: "[data-focus='remplacer']",
      cibleFin: '.dialog',
      titre: 'Me faire remplacer',
      texte: () => 'Prévu, urgent ou urgence médicale, avec justificatif. Votre titulaire répond.',
      jouer: () => versDemandes(p.identifiant, 'remplacements'),
      gestes: [
        { faire: 'cliquer', sur: "[data-focus='remplacer'] .btn" },
        { faire: 'attendre', que: '.dialog .choix.urgence' },
        { faire: 'cliquer', sur: parTexte('.choix.urgence label', 'Urgence médicale') },
      ],
    },
    {
      chapitre: AVEC_EQUIPE,
      qui: p.qui,
      cible: "[data-focus='aider']",
      titre: 'Un appel à l’équipe',
      texte: () => 'Tous prévenus ensemble. Vous voyez votre rang. Dire non ne le change pas.',
      jouer: () => {
        appelPour(p.id);
        moi('moi');
      },
    },
    ...(p.pharmacien
      ? [
          {
            chapitre: AVEC_EQUIPE,
            qui: p.qui,
            cible: '.content .card',
            titre: 'Mes gardes',
            texte: () => 'Vos gardes, le repos qui suit, ce qui part en paie.',
            jouer: () => moi('mesgardes'),
          } satisfies Etape,
        ]
      : []),
    {
      chapitre: AVEC_EQUIPE,
      qui: p.qui,
      cible: '.fil',
      cibleFin: '.fil',
      titre: 'Les messages',
      texte: () => 'Un fil pour l’équipe, des conversations privées.',
      jouer: () => moi('messages'),
      gestes: [{ faire: 'taper', dans: '#msg-texte', texte: 'Bonjour à tous !' }],
    },
    {
      chapitre: MON_ESPACE,
      qui: p.qui,
      cible: '.content .deux',
      titre: 'Mon suivi',
      texte: () => 'Votre compteur d’heures et votre part des contraintes. Aucun classement.',
      jouer: () => moi('suivi'),
    },
    {
      chapitre: MON_ESPACE,
      qui: p.qui,
      cible: "[data-focus='assistant']",
      cibleFin: '.aide-panneau',
      titre: 'L’assistant Solvéa',
      texte: () => 'Posez une question : il lit votre planning et vous répond.',
      jouer: () => {
        moi('moi');
        useUi.getState().montrerAssistant(true);
      },
      gestes: [
        { faire: 'cliquer', sur: "[data-focus='assistant']" },
        { faire: 'taper', dans: '#aide-question', texte: 'Mon prochain poste ?' },
        { faire: 'cliquer', sur: '.aide-envoyer' },
        { faire: 'attendre', que: '.aide-bulle.bot + .aide-bulle.moi + .aide-bulle.bot, .aide-bulle.bot .btn' },
      ],
    },
    {
      chapitre: MON_ESPACE,
      qui: p.qui,
      cible: '.choix.themes',
      titre: 'Mon compte',
      texte: () => 'Dix couleurs, clair ou sombre, mot de passe. À vous de jouer.',
      jouer: () => moi('compte'),
    },
  ];
}

const PHARMACIEN = visiteDe({ id: 'p_lea', identifiant: 'lea.fontaine', qui: 'Léa · pharmacienne adjointe', prenom: 'Léa', pharmacien: true });
const EQUIPIER = visiteDe({ id: 'p_camille', identifiant: 'nicolas.lesyndicaliste', qui: 'Nicolas · préparateur', prenom: 'Nicolas' });

export const SCENARIOS = {
  complet: { court: 'Titulaire', role: 'Titulaire', titre: 'Tout Solvéa, de zéro', duree: `15 min · ${COMPLET.length} étapes`, etapes: COMPLET },
  pharmacien: { court: 'Pharmacien', role: 'Pharmacien adjoint', titre: 'Mon espace de pharmacien', duree: `5 min · ${PHARMACIEN.length} étapes`, etapes: PHARMACIEN },
  equipe: { court: 'Équipe', role: 'Préparateur, animateur, apprenti…', titre: 'Mon espace dans l’équipe', duree: `5 min · ${EQUIPIER.length} étapes`, etapes: EQUIPIER },
  etabli: { court: 'Journée type', role: 'Tous les rôles', titre: 'Une journée type', duree: `4 min · ${ETABLI.length} étapes`, etapes: ETABLI },
} as const;
export type Scenario = keyof typeof SCENARIOS;

/** Lance un parcours guidé sur un environnement d'exemple remis à neuf. */
export function lancerParcours(scenario: Scenario = 'etabli'): void {
  annulerMinuteries();
  store().chargerExemple(true, scenario === 'complet' ? 'zero' : 'etabli');
  useUi.getState().montrerAssistant(false);
  // Le parcours est remis à l'étape 1 : l'écran de la première étape est posé par le composant.
  voirComme('caroline.tellier');
  useUi.getState().setParcours(0, scenario);
  // Relancé depuis l'étape 1, le parcours ne change pas d'étape : son écran est reposé ici.
  SCENARIOS[scenario].etapes[0].jouer();
}

/** Le nouvel écran d'une étape arrive en fondu. Rien si l'appareil demande moins d'animations. */
function adoucir(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (const id of ['contenu']) {
    document.getElementById(id)?.animate(
      [
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 620, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  }
}

interface Zone {
  top: number;
  left: number;
  width: number;
  height: number;
}
const memeZone = (a: Zone | null, b: Zone | null): boolean => (!a || !b ? a === b : Math.abs(a.top - b.top) < 1 && Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1);

/** Parcours guidé : chaque étape pose l'écran, éclaire ce qu'elle montre, joue les gestes elle-même et l'explique en une phrase. */
export function Parcours(): JSX.Element | null {
  const { parcours, setParcours, scenario, session, vue } = useUi();
  const data = useStore((s) => s.data);
  const ETAPES: readonly Etape[] = SCENARIOS[scenario].etapes;
  const etape = parcours !== null ? ETAPES[parcours] : null;
  /** On lit d'abord ; la démonstration ne se joue que sur demande, fiche refermée ; puis la fiche revient. */
  const [phase, setPhase] = useState<'lire' | 'demo' | 'pause' | 'fini'>('lire');
  /** Les temps de la démonstration, et combien ont déjà été joués. */
  const temps = useRef<Geste[][]>([]);
  const [joues, setJoues] = useState(0);
  const [nbTemps, setNbTemps] = useState(0);
  /** Ce que le prochain temps va faire, lu à l'écran. */
  const [annonce, setAnnonce] = useState('');
  /** La fiche d'explication est-elle à l'écran ? Elle s'efface le temps d'une transition ou d'une démonstration. */
  const [ouvert, setOuvert] = useState(false);
  const [clic, setClic] = useState(false);
  const [lecture, setLecture] = useState(false);
  const [sommaire, setSommaire] = useState(false);
  /** L'utilisateur a quitté l'écran de l'étape pour explorer : le projecteur s'efface. */
  const [libre, setLibre] = useState(false);
  /** Rejouer l'étape en cours, démonstration comprise. */
  const [tirage, setTirage] = useState(0);
  const attendu = useRef<{ session: string | null; vue: Vue } | null>(null);
  const panneau = useRef<HTMLElement>(null);
  /** Ce que le repère de clic vise en ce moment. */
  const visee = useRef<Cible | null>(null);
  const mesure = useRef<() => void>(() => undefined);
  /** Joue le prochain temps de la démonstration. */
  const demarrer = useRef<() => void>(() => undefined);
  /** Ce que le projecteur éclaire pendant une démonstration : la fenêtre ou le bloc où se passe le geste. */
  const contexte = useRef<HTMLElement | null>(null);
  const action = useRef<HTMLButtonElement>(null);


  const chapitres = useMemo(() => {
    const out: { titre: string; debut: number; n: number }[] = [];
    ETAPES.forEach((e, i) => {
      const dernier = out[out.length - 1];
      if (dernier && dernier.titre === (e.chapitre ?? '')) dernier.n++;
      else out.push({ titre: e.chapitre ?? '', debut: i, n: 1 });
    });
    return out;
  }, [ETAPES]);

  const noter = (): void => {
    const u = useUi.getState();
    attendu.current = { session: u.session, vue: u.vue };
  };

  useEffect(() => {
    if (parcours === null) return;
    const e = SCENARIOS[scenario].etapes[parcours] as Etape | undefined;
    if (!e) return;
    annulerMinuteries();
    setPhase('lire');
    setOuvert(false);
    setClic(false);
    setSommaire(false);
    setLibre(false);
    visee.current = null;
    attendu.current = null;
    contexte.current = null;
    const u = useUi.getState();
    // Fenêtres et menus ouverts par l'étape précédente sont refermés, comme le ferait la touche Échap.
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    u.voirJour(null);
    // « Mon planning » repart sur la semaine : une étape précédente a pu le laisser sur le calendrier.
    u.setIntention('semaine');
    u.ouvrirAssistant(false);
    u.montrerAssistant(false);
    u.setPlanVue('semaine');
    u.setSeulementMoi(false);
    // Les mises en place sont des décisions de la titulaire principale : elles ne partent jamais « pour accord ».
    useStore.getState().setActeur('p_helene');
    e.jouer();
    // Le nouvel écran arrive en fondu, plutôt que de remplacer l'ancien d'un coup.
    adoucir();

    const liste = decouper(e.gestes ?? []);
    temps.current = liste;
    setNbTemps(liste.length);
    setJoues(0);
    setAnnonce('');
    let faits = 0;
    /** Le temps est joué : on laisse voir le résultat un instant, puis la fiche revient pour la suite. */
    const fin = (): void => {
      visee.current = null;
      setClic(false);
      plusTard(() => {
        faits++;
        setJoues(faits);
        if (faits >= liste.length) contexte.current = null;
        setPhase(faits >= liste.length ? 'fini' : 'pause');
        noter();
        setOuvert(true);
      }, 850);
    };
    /** Joue le geste i du temps en cours, puis le suivant. Un élément introuvable est attendu un instant, puis ignoré. */
    const derouler = (gestes: Geste[], i: number): void => {
      if (i >= gestes.length) return fin();
      const g = gestes[i];
      const suite = (ms: number): void => plusTard(() => derouler(gestes, i + 1), ms);
      if (g.faire === 'pause') return suite(g.ms);
      if (g.faire === 'action') {
        g.jouer();
        return suite(700);
      }
      const cible = g.faire === 'cliquer' ? g.sur : g.faire === 'attendre' ? g.que : g.dans;
      let essais = 0;
      const viser = (): void => {
        const el = element(cible);
        if (!el || (el as HTMLButtonElement).disabled) {
          if (++essais > (g.faire === 'attendre' ? 80 : 14)) return derouler(gestes, i + 1);
          return plusTard(viser, 150);
        }
        if (g.faire === 'attendre') return suite(350);
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
        visee.current = cible;
        plusTard(() => mesure.current(), 60);
        // Le pointeur glisse jusqu'à la cible, s'y pose, puis agit.
        plusTard(() => {
          setClic(true);
          plusTard(() => {
            setClic(false);
            const cibleFinale = element(cible);
            if (!cibleFinale) return derouler(gestes, i + 1);
            if (g.faire === 'cliquer') {
              cibleFinale.click();
              suite(950);
            } else if (g.faire === 'choisir') {
              ecrire(cibleFinale, g.valeur);
              suite(800);
            } else {
              cibleFinale.focus();
              const taper = (n: number): void => {
                const champ = element(cible);
                if (!champ) return derouler(gestes, i + 1);
                ecrire(champ, g.texte.slice(0, n));
                if (n >= g.texte.length) return suite(600);
                plusTard(() => taper(n + 1), 70);
              };
              taper(1);
            }
          }, 460);
        }, 1150);
      };
      viser();
    };
    demarrer.current = (): void => {
      if (faits >= liste.length) return;
      annulerMinuteries();
      attendu.current = null;
      setLibre(false);
      setSommaire(false);
      setOuvert(false);
      setPhase('demo');
      // La fiche a le temps de s'effacer avant le geste.
      plusTard(() => derouler(liste[faits], 0), 700);
    };
    plusTard(() => {
      noter();
      setOuvert(true);
    }, 560);
    return annulerMinuteries;
  }, [parcours, scenario, tirage]);

  // Si la personne ou l'écran ne sont plus ceux de l'étape, l'utilisateur explore : on le lui dit, sans le gêner.
  useEffect(() => {
    const a = attendu.current;
    if (a) setLibre(a.session !== session || a.vue !== vue);
  }, [session, vue]);

  // Projecteur : la zone de ce qui est présenté. L'écran défile pour l'amener au centre, puis le projecteur le suit.
  const [zone, setZone] = useState<Zone | null>(null);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const cible = libre ? undefined : phase === 'fini' && etape?.cibleFin ? etape.cibleFin : etape?.cible;
  useEffect(() => {
    if (parcours === null) {
      setZone(null);
      setPoint(null);
      return;
    }
    let amene = false;
    const mesurer = (): void => {
      const base = cible ? document.querySelector<HTMLElement>(cible) : null;
      const geste = visee.current ? element(visee.current) : null;
      // Pendant une démonstration, le projecteur suit le geste : la fenêtre ou le menu où il a lieu, sinon le bloc présenté.
      if (phase === 'demo' && geste) {
        contexte.current = geste.closest<HTMLElement>('.dialog, .decouvrir, .menu, .aide-panneau') ?? (base?.contains(geste) ? base : (geste.closest<HTMLElement>('.card, .plan, .panneau, .voies, .side, .bandeau-test, .topbar-in') ?? geste));
      }
      const el = (phase === 'demo' || phase === 'pause') && contexte.current?.isConnected ? contexte.current : base;
      const r = el?.getBoundingClientRect();
      if (el && r && r.width >= 4 && r.height >= 4) {
        // Ce qui est dans la page ne déborde pas sur les barres du haut : le cadre s'arrête au bord de la zone de contenu.
        const page = document.getElementById('contenu');
        const bords = page?.contains(el) ? page.getBoundingClientRect() : null;
        const haut = Math.max(6, (bords?.top ?? 0) + 4);
        const basMax = Math.min(window.innerHeight - 6, (bords?.bottom ?? window.innerHeight) - 4);
        // Tant qu'un geste est en cours, c'est lui qui fait défiler l'écran.
        if (!amene && phase !== 'demo') {
          amene = true;
          el.style.scrollMarginTop = '18px';
          el.scrollIntoView({ block: r.height > (basMax - haut) * 0.8 ? 'start' : 'center', inline: 'nearest', behavior: 'smooth' });
        }
        const m = 8;
        const top = Math.max(haut, r.top - m);
        const bas = Math.min(basMax, r.bottom + m);
        const left = Math.max(6, r.left - m);
        const droite = Math.min(window.innerWidth - 6, r.right + m);
        const z = bas - top > 24 && droite - left > 24 ? { top, left, width: droite - left, height: bas - top } : null;
        setZone((avant) => (memeZone(avant, z) ? avant : z));
      } else setZone(null);
      const v = visee.current ? element(visee.current) : null;
      const p = v?.getBoundingClientRect();
      const pt = p && p.width > 2 && p.bottom > 0 && p.top < window.innerHeight ? { x: Math.round(p.left + Math.min(p.width / 2, 120)), y: Math.round(p.top + p.height / 2) } : null;
      setPoint((avant) => (avant?.x === pt?.x && avant?.y === pt?.y ? avant : pt));
    };
    mesure.current = mesurer;
    mesurer();
    const suivi = window.setInterval(mesurer, 200);
    window.addEventListener('resize', mesurer);
    window.addEventListener('scroll', mesurer, true);
    return () => {
      window.clearInterval(suivi);
      window.removeEventListener('resize', mesurer);
      window.removeEventListener('scroll', mesurer, true);
    };
  }, [cible, parcours, scenario, tirage, phase]);

  // La fiche d'explication se range là où elle ne cache pas ce qu'elle montre.
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    const el = panneau.current;
    if (!el || window.innerWidth < 760) return setPlace(null);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const coins = [
      { left: W - 24 - w, top: H - 24 - h },
      { left: 24, top: H - 24 - h },
      { left: W - 24 - w, top: 96 },
      { left: 24, top: 96 },
    ];
    const cache = (c: { left: number; top: number }): number => (zone ? Math.max(0, Math.min(c.left + w, zone.left + zone.width) - Math.max(c.left, zone.left)) * Math.max(0, Math.min(c.top + h, zone.top + zone.height) - Math.max(c.top, zone.top)) : 0);
    const meilleur = coins.reduce((a, b) => (cache(b) < cache(a) * 0.5 - 400 ? b : a));
    setPlace((avant) => (avant && avant.left === meilleur.left && avant.top === meilleur.top ? avant : meilleur));
  }, [zone, parcours, phase, sommaire, libre, data, ouvert]);

  const N = ETAPES.length;
  const dernier = parcours === N - 1;
  const demonstration = nbTemps > 0;
  /** Il reste un geste à montrer dans cette étape. */
  const reste = demonstration && joues < nbTemps && !libre;
  /** « Suivant » : le prochain geste s'il en reste un, sinon l'étape suivante. */
  const avancer = (): void => {
    if (parcours === null) return;
    if (reste) return demarrer.current();
    if (parcours < N - 1) setParcours(parcours + 1);
  };
  // Ce que le prochain geste va faire se lit sur l'écran lui-même ; l'élément peut mettre un instant à apparaître.
  useEffect(() => {
    if (!ouvert || !reste) return;
    let essais = 0;
    const lire = (): void => {
      const texte = decrire(temps.current[joues]);
      setAnnonce(texte);
      if (/^(Cliquer ici|Écrire « [^»]* »|Choisir « [^»]* »)$/.test(texte) && ++essais < 12) minuterie = window.setTimeout(lire, 200);
    };
    let minuterie = window.setTimeout(lire, 0);
    return () => window.clearTimeout(minuterie);
  }, [ouvert, reste, joues, parcours, tirage]);
  // Lecture automatique : le temps de lire, un geste, le temps de voir, puis la suite.
  const duree = etape ? Math.min(9000, Math.max(4500, 2200 + etape.texte(data).length * 45)) : 0;
  const attente = phase === 'pause' ? 2600 : phase === 'fini' ? Math.max(3200, duree * 0.6) : duree;
  useEffect(() => {
    if (!lecture || parcours === null || libre || sommaire || phase === 'demo' || !ouvert) return;
    if (!reste && parcours >= N - 1) return setLecture(false);
    const t = window.setTimeout(() => (reste ? demarrer.current() : setParcours(parcours + 1)), attente);
    return () => window.clearTimeout(t);
  }, [lecture, parcours, libre, sommaire, phase, ouvert, reste, N, attente, setParcours]);

  // La fiche revient : le bouton principal reprend le focus, pour continuer au clavier.
  useEffect(() => {
    if (ouvert && !sommaire) action.current?.focus({ preventScroll: true });
  }, [ouvert, phase, parcours, sommaire, joues]);

  // Visite quittée : le bouton d'aide reprend sa place habituelle.
  useEffect(() => {
    if (parcours === null) useUi.getState().montrerAssistant(false);
  }, [parcours]);

  // Flèches du clavier : étape suivante, étape précédente.
  useEffect(() => {
    if (parcours === null) return;
    const onKey = (e: KeyboardEvent): void => {
      const origine = e.target instanceof Element ? e.target : null;
      if (!e.isTrusted || e.altKey || e.ctrlKey || e.metaKey || origine?.closest('input, textarea, select, [contenteditable]')) return;
      if (phase === 'demo') return;
      if (e.key === 'ArrowRight') avancer();
      if (e.key === 'ArrowLeft' && parcours > 0) setParcours(parcours - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [parcours, N, setParcours, phase, reste]);

  if (!etape || parcours === null || !data.demo) return null;
  const rang = chapitres.findIndex((c) => parcours >= c.debut && parcours < c.debut + c.n);
  const ferme = !ouvert || phase === 'demo';
  return (
    <>
      {zone ? <div className={`focus-parcours${phase === 'demo' ? ' demo' : ''}`} style={zone} aria-hidden="true" /> : null}
      {point && phase === 'demo' && !libre ? (
        <div className={`pointe-parcours${clic ? ' clic' : ''}`} style={{ left: point.x, top: point.y }} aria-hidden="true">
          <i className="pointe-halo" />
          <MousePointer2 size={26} />
        </div>
      ) : null}
      {phase === 'demo' ? (
        <div className="pt-legende no-print" role="status">
          <span className="pt-legende-pic" aria-hidden="true">
            <Play size={13} />
          </span>
          <span>
            <b>{annonce || etape.titre}</b>
          </span>
          <button type="button" className="btn sm" onClick={() => (dernier ? setParcours(null) : setParcours(parcours + 1))}>
            Passer
          </button>
        </div>
      ) : null}
      <aside ref={panneau} className={`parcours-test no-print${ferme ? ' ferme' : ''}`} aria-label="Parcours guidé" aria-hidden={ferme} {...(ferme ? { inert: '' } : {})} style={place ? { left: place.left, top: place.top, right: 'auto', bottom: 'auto' } : undefined}>
        <div className="row" style={{ gap: 10 }}>
          <span className="pt-n num" aria-hidden="true">
            {parcours + 1}
          </span>
          <div className="grow">
            <div className="eyebrow">
              {SCENARIOS[scenario].court} · {parcours + 1} sur {N}
            </div>
            <div className="small" style={{ fontWeight: 650 }}>{etape.qui}</div>
          </div>
          <button type="button" className="btn ghost icon sm" onClick={() => setLecture(!lecture)} aria-pressed={lecture} aria-label={lecture ? 'Mettre la lecture automatique en pause' : 'Lecture automatique'} title={lecture ? 'Pause' : 'Lecture automatique'}>
            {lecture ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          </button>
          <button type="button" className="btn ghost icon sm" onClick={() => setParcours(null)} aria-label="Quitter le parcours guidé">
            <X size={16} aria-hidden="true" />
          </button>
          {lecture && !libre && !sommaire && ouvert && phase !== 'demo' && !(dernier && !reste) ? <i key={`${parcours}-${tirage}-${phase}-${joues}`} className="pt-chrono" style={{ animationDuration: `${attente}ms` }} aria-hidden="true" /> : null}
        </div>
        {sommaire ? (
          <nav className="pt-sommaire" aria-label="Sommaire de la visite">
            <ol>
              {chapitres.map((c, i) => (
                <li key={c.titre}>
                  <button type="button" className={i === rang ? 'on' : ''} aria-current={i === rang ? 'step' : undefined} onClick={() => (c.debut === parcours ? setSommaire(false) : setParcours(c.debut))}>
                    <span className="num">{i + 1}</span>
                    <span className="grow">{c.titre}</span>
                    <span className="small soft">{c.n} étapes</span>
                  </button>
                </li>
              ))}
            </ol>
            <button type="button" className="btn sm pt-retour" onClick={() => setSommaire(false)}>
              <Undo2 size={14} aria-hidden="true" /> Reprendre à l’étape {parcours + 1}
            </button>
          </nav>
        ) : (
          <div aria-live="polite" key={parcours} className="pt-corps">
            {etape.chapitre ? (
              <button type="button" className="pt-chapitre" onClick={() => setSommaire(true)} title="Ouvrir le sommaire">
                <ListTree size={14} aria-hidden="true" /> {rang + 1}/{chapitres.length} · {etape.chapitre}
                <span className="sr">, ouvrir le sommaire</span>
              </button>
            ) : null}
            <h2 className="h3" style={{ marginBottom: 4 }}>{etape.titre}</h2>
            <p className="small">{etape.texte(data)}</p>
            {libre ? (
              <div className="pt-libre">
                <span className="small">Vous explorez librement.</span>
                <button type="button" className="btn sm" onClick={() => setTirage((t) => t + 1)}>
                  <Undo2 size={14} aria-hidden="true" /> Revenir à l’étape
                </button>
              </div>
            ) : demonstration && !reste ? (
              <div className="pt-fait small">
                <CircleCheck size={15} aria-hidden="true" /> {nbTemps > 1 ? `${nbTemps} gestes montrés` : 'Geste montré'}
                <button type="button" className="pt-revoir" onClick={() => setTirage((t) => t + 1)}>
                  <RotateCcw size={13} aria-hidden="true" /> Revoir
                </button>
              </div>
            ) : demonstration ? (
              <div className="pt-geste">
                <span className="pt-geste-tete">
                  <MousePointer2 size={14} aria-hidden="true" />
                  {nbTemps > 1 ? `Geste ${joues + 1} sur ${nbTemps}` : 'À l’écran'}
                  {nbTemps > 1 ? (
                    <span className="pt-points" aria-hidden="true">
                      {Array.from({ length: nbTemps }, (_, i) => (
                        <i key={i} className={i < joues ? 'fait' : i === joues ? 'on' : ''} />
                      ))}
                    </span>
                  ) : null}
                </span>
                <b>{annonce || 'Voir la suite'}</b>
              </div>
            ) : null}
          </div>
        )}
        <div className="pt-segments" aria-hidden="true">
          {chapitres.map((c) => (
            <span key={c.titre} style={{ flexGrow: c.n }}>
              <i style={{ width: `${Math.max(0, Math.min(1, (parcours + 1 - c.debut) / c.n)) * 100}%` }} />
            </span>
          ))}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn sm" disabled={parcours === 0} onClick={() => setParcours(parcours - 1)}>
            <ArrowLeft size={15} aria-hidden="true" /> Précédent
          </button>
          <span className="grow" />
          {reste && !dernier ? (
            <button type="button" className="btn sm ghost pt-passer" onClick={() => setParcours(parcours + 1)}>
              Passer
            </button>
          ) : null}
          {reste ? (
            <button ref={action} type="button" className="btn sm primary pt-voir" data-suite="geste" onClick={avancer}>
              Suivant <ArrowRight size={15} aria-hidden="true" />
            </button>
          ) : dernier ? (
            <button ref={action} type="button" className="btn sm primary" data-suite="fin" onClick={() => setParcours(null)}>
              Terminer
            </button>
          ) : (
            <button ref={action} type="button" className="btn sm primary" data-suite="etape" onClick={avancer}>
              Étape suivante <ArrowRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

/** Une carte par visite : un mot pour le rôle, une phrase, trois repères. */
const CARTES: Record<Scenario, { nom: string; phrase: string; mots: string[]; teinte: string; icone: JSX.Element }> = {
  complet: { nom: 'Titulaire', phrase: 'Tout, en partant de zéro.', mots: ['Créer', 'Planifier', 'Piloter'], teinte: 'v-titulaire', icone: <Crown size={30} /> },
  pharmacien: { nom: 'Pharmacien', phrase: 'Planning et gardes.', mots: ['Planning', 'Demandes', 'Gardes'], teinte: 'v-pharmacien', icone: <PillIcon size={30} /> },
  equipe: { nom: 'Équipe', phrase: 'Votre espace à vous.', mots: ['Planning', 'Demandes', 'Suivi'], teinte: 'v-equipe', icone: <FlaskConical size={30} /> },
  etabli: { nom: 'Journée type', phrase: 'Tous les rôles, en action.', mots: ['Décider', 'Remplacer', 'Valider'], teinte: 'v-journee', icone: <Store size={30} /> },
};

/** Fenêtre « Découvrir Solvéa » : une visite guidée par rôle, ou une entrée libre. */
export function ChoixParcours(): JSX.Element | null {
  const { tutoriels, ouvrirTutoriels } = useUi();
  const exemple = useMemo(() => (tutoriels ? ROLES_TEST : []), [tutoriels]);
  useEffect(() => {
    if (!tutoriels) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') ouvrirTutoriels(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tutoriels, ouvrirTutoriels]);
  if (!tutoriels) return null;
  const entrer = (identifiant: string): void => {
    store().chargerExemple(false);
    ouvrirTutoriels(false);
    voirComme(identifiant);
  };
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && ouvrirTutoriels(false)}>
      <div className="decouvrir" role="dialog" aria-modal="true" aria-labelledby="decouvrir-titre">
        <div className="dc-tete">
          <span className="dc-logo" aria-hidden="true">
            <Logo size={34} />
          </span>
          <div className="grow">
            <h2 id="decouvrir-titre">Découvrir Solvéa</h2>
            <p>Choisissez votre rôle. La visite s’adapte.</p>
          </div>
          <button type="button" className="dialog-fermer" onClick={() => ouvrirTutoriels(false)} aria-label="Fermer" autoFocus>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="dc-corps">
          <div className="choix-parcours">
            {(Object.keys(SCENARIOS) as Scenario[]).map((cle) => {
              const c = CARTES[cle];
              return (
                <article key={cle} className={`cp-carte ${c.teinte}`}>
                  <div className="cp-visuel">
                    <span className="cp-temps">
                      {SCENARIOS[cle].duree.split(' · ')[0]}
                      <span className="cp-etapes"> · {SCENARIOS[cle].duree.split(' · ')[1]}</span>
                    </span>
                    <span className="cp-ico" aria-hidden="true">
                      {c.icone}
                    </span>
                  </div>
                  <div className="cp-texte">
                    <h3>{c.nom}</h3>
                    <p className="cp-phrase">{c.phrase}</p>
                    <ul className="cp-mots">
                      {c.mots.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="cp-pied">
                    <button type="button" className={`btn${cle === 'complet' ? ' primary' : ''}`} onClick={() => lancerParcours(cle)}>
                      <Play size={15} aria-hidden="true" /> Lancer <span className="sr">la visite {c.nom}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="dc-libre">
            <h3 className="dc-sous">Ou entrer librement</h3>
            <div className="dc-roles">
              {exemple.map((r) => (
                <button key={r.cle} type="button" className="dc-role" onClick={() => entrer(r.identifiant)} title={r.detail}>
                  <span className="dc-av" aria-hidden="true">
                    {r.nom.split(' ').map((x) => x.charAt(0)).join('')}
                  </span>
                  <span>
                    <b>{r.nom.split(' ')[0]}</b>
                    <span className="small soft">{r.titre}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Bandeau de l'environnement de test : changer de regard en un clic, lancer ou relancer le parcours. */
export function BandeauTest({ moi }: { moi: string }): JSX.Element {
  const { ouvrirTutoriels, scenario } = useUi();
  const personnes = useStore((s) => s.data.personnes);
  return (
    <div className="bandeau-test no-print" role="region" aria-label="Environnement de test">
      <span className="bt-titre" title="Environnement de test">
        <FlaskConical size={16} aria-hidden="true" /> Environnement de test
      </span>
      <div className="seg" role="group" aria-label="Voir l’application comme">
        {ROLES_TEST.map((r) => (
          <button key={r.cle} type="button" className={moi === r.id ? 'on' : ''} aria-pressed={moi === r.id} title={`${r.nom} · ${r.titre}`} disabled={!personnes.some((p) => p.id === r.id)} onClick={() => voirComme(r.identifiant)}>
            {r.court}
          </button>
        ))}
      </div>
      <span className="grow" />
      <button type="button" className="btn sm primary" onClick={() => ouvrirTutoriels(true)}>
        <Play size={14} aria-hidden="true" /> Tutoriels
      </button>
      <button type="button" className="btn sm" onClick={() => lancerParcours(scenario)} title="Remet les données d’exemple à neuf et reprend le parcours à l’étape 1">
        <RotateCcw size={14} aria-hidden="true" /> Réinitialiser
      </button>
    </div>
  );
}
