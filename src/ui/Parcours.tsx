import { ArrowLeft, ArrowRight, Crown, FlaskConical, Gauge, ListTree, MousePointer2, Pause, Pill as PillIcon, Play, RotateCcw, Store, Undo2, X } from 'lucide-react';
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
import type { Humeur } from './Solvi';
import { NomSolvi, Solvi } from './Solvi';

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
/**
 * `dit` : ce que Solvi demande de faire, quand le nom de l'élément ne suffit pas.
 * `sert` : à quoi sert le geste, en une phrase. `facultatif` : l'élément peut ne pas être là.
 */
type Geste =
  | { faire: 'cliquer'; sur: Cible; dit?: string; sert?: string; facultatif?: boolean }
  | { faire: 'taper'; dans: Cible; texte: string; dit?: string; sert?: string; facultatif?: boolean }
  | { faire: 'choisir'; dans: Cible; valeur: string; dit?: string; sert?: string; facultatif?: boolean }
  | { faire: 'attendre'; que: Cible; facultatif?: boolean }
  | { faire: 'pause'; ms: number; dit?: string; sert?: string }
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
    return nom ? `Cliquez sur « ${nom} »` : 'Cliquez ici';
  }
  const champ = el ? champDe(el) : '';
  if (g.faire === 'taper') return champ ? `Écrivez « ${g.texte} » dans « ${champ} »` : `Écrivez « ${g.texte} »`;
  const option = el instanceof HTMLSelectElement ? [...el.options].find((o) => o.value === g.valeur)?.text : undefined;
  return champ ? `Choisissez « ${option ?? g.valeur} » dans « ${champ} »` : `Choisissez « ${option ?? g.valeur} »`;
}
/** À quoi sert le geste visible d'un temps, quand l'étape le dit. */
const utilite = (temps: Geste[] | undefined): string => temps?.find(visible)?.sert ?? '';

/** Le rythme des démonstrations : posé par défaut, pour laisser le temps de voir et de comprendre. */
type Rythme = 'pose' | 'normal' | 'vif';
const RYTHMES: Record<Rythme, { nom: string; facteur: number }> = { pose: { nom: 'posé', facteur: 1 }, normal: { nom: 'normal', facteur: 0.72 }, vif: { nom: 'vif', facteur: 0.48 } };
const CLE_RYTHME = 'releve.visite.rythme';
const rythmeLu = (): Rythme => {
  try {
    const r = window.localStorage.getItem(CLE_RYTHME);
    return r === 'normal' || r === 'vif' ? r : 'pose';
  } catch {
    return 'pose';
  }
};
let rythme: Rythme = typeof window === 'undefined' ? 'pose' : rythmeLu();
/** Le rythme en cours, et de quoi le changer : la fenêtre des visites et la page d'aide le proposent avant de démarrer. */
export const rythmeChoisi = (): Rythme => rythme;
export function choisirRythme(r: Rythme): void {
  rythme = r;
  try {
    window.localStorage.setItem(CLE_RYTHME, r);
  } catch {
    /* le rythme reste celui de la séance */
  }
}
const RYTHME_PHRASE: Record<Rythme, string> = { pose: 'Le temps de tout lire et de tout voir.', normal: 'Un bon équilibre.', vif: 'Pour qui connaît déjà.' };

/** Trois boutons : posé, normal, vif. À choisir avant de lancer une visite ; se change aussi en cours de route. */
export function ChoixRythme({ compact }: { compact?: boolean }): JSX.Element {
  const [r, setR] = useState<Rythme>(rythme);
  return (
    <div className={`rythme${compact ? ' compact' : ''}`} role="radiogroup" aria-label="Rythme de la visite">
      <span className="rythme-titre">
        <Gauge size={15} aria-hidden="true" /> Rythme de la visite
      </span>
      <div className="rythme-choix">
        {(Object.keys(RYTHMES) as Rythme[]).map((cle) => (
          <button
            key={cle}
            type="button"
            role="radio"
            aria-checked={r === cle}
            className={`rythme-option${r === cle ? ' on' : ''}`}
            onClick={() => {
              choisirRythme(cle);
              setR(cle);
            }}
          >
            <b className="cap1">{RYTHMES[cle].nom}</b>
            {compact ? null : <span>{RYTHME_PHRASE[cle]}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Une durée de démonstration, au rythme choisi. */
const tempo = (ms: number): number => Math.round(ms * RYTHMES[rythme].facteur);
/** Le temps de lire ce que dit Solvi avant qu'il agisse : plus la bulle est longue, plus il attend. */
const tempsDeLire = (texte: string): number => tempo(Math.min(5200, Math.max(2100, 1000 + texte.length * 36)));

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
/** La semaine redevient un brouillon : sa publication peut être montrée. */
function enBrouillon(monday: string): void {
  poser((d) => (d.semaines[monday]?.statut === 'publie' ? { ...d, semaines: Object.fromEntries(Object.entries(d.semaines).filter(([lundi]) => lundi !== monday)) } : d));
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
  if (poste) s.demanderRemplacement(poste, 'prevu', undefined, undefined, { motif: 'famille' });
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
  if (poste) s.demanderRemplacement(poste, 'medical', JUSTIFICATIF_EXEMPLE, undefined, { motif: 'sante' });
}
/** Inès a demandé un congé, pour montrer un refus. */
function avecCongeARefuser(): void {
  avecPlanning();
  const s = store();
  if (!s.data.absences.some((x) => x.personId === 'p_ines' && x.type === 'conge')) s.declarerAbsence({ motif: 'repos', personId: 'p_ines', from: addDays(semaineDans(5), 0), to: addDays(semaineDans(5), 2), type: 'conge', statut: 'demandee' });
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
        if (poste) s.demanderRemplacement(poste, 'prevu', undefined, undefined, { motif: 'famille' });
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
    texte: () => 'Une forme par jour. « M’assister » remplit le reste.',
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
    cible: '.plan-grid .pg-h.today',
    cibleFin: '.dialog',
    titre: 'Pauses et retards',
    texte: () => 'Sous chaque date, « Voir la journée » ouvre toute l’équipe sur une ligne de temps.',
    jouer: () => {
      voirComme('caroline.tellier', 'construire');
      useUi.getState().setSemaine(mondayOf(store().today));
    },
    gestes: [
      { faire: 'cliquer', sur: '.plan-grid .pg-h.today .jour-btn', dit: 'Cliquez sur « Voir la journée », sous la date du jour', sert: 'La journée s’ouvre : toute l’équipe sur une ligne de temps.' },
      { faire: 'attendre', que: '.dialog' },
      { faire: 'pause', ms: 3000, dit: 'Chaque ligne montre un poste et sa pause', sert: 'On y règle une pause et on y note un retard, en deux clics.' },
    ],
  },
  {
    qui: HELENE,
    cible: "[data-tour='proposer']",
    cibleFin: '.content .plan',
    titre: 'Construire',
    texte: () => '« Proposer un planning » calcule trois semaines comparables. Vous choisissez.',
    jouer: () => {
      voirComme('caroline.tellier', 'construire');
      // L'exemple a deux semaines publiées d'avance : la semaine à construire est la troisième.
      useUi.getState().setSemaine(addDays(mondayOf(store().today), 21));
    },
    gestes: [
      { faire: 'cliquer', sur: "[data-tour='proposer']", sert: 'Solvéa calcule trois plannings complets pour la semaine.' },
      { faire: 'attendre', que: '.dialog .variant' },
      { faire: 'pause', ms: 3600, dit: 'Trois plannings à comparer : équité, préférences, coût' },
      { faire: 'cliquer', sur: nieme('.dialog .variant', 1), dit: 'Comparez avec « Préférences d’abord »', sert: 'Un clic sur une carte la sélectionne ; les chiffres soulignés sont les meilleurs.' },
      { faire: 'pause', ms: 1400 },
      { faire: 'cliquer', sur: nieme('.dialog .variant', 0), dit: 'Revenez à « Équité d’abord »', sert: 'Samedis et fermetures y sont les mieux répartis.' },
      { faire: 'pause', ms: 900 },
      { faire: 'cliquer', sur: VALIDER, sert: 'La proposition retenue devient le brouillon : rien n’est encore publié.' },
    ],
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
const EQUIPE = 'Vu par l’équipe';
const SUIVRE = 'Suivre';
const BILAN = 'Bilan';
const QUOTIDIEN = 'Au quotidien';
const semaineUne = (): void => {
  helene('construire');
  useUi.getState().setSemaine(semaineDans(1));
};

const COMPLET_BRUT: Etape[] = [
  // ---- 1. Préparer
  {
    chapitre: PREPARER,
    qui: HELENE,
    cible: '.accueil-form',
    titre: 'Créer la pharmacie',
    texte: () => 'Trois écrans : le nom, les horaires, l’équipe. Ici, on part de zéro.',
    jouer: () => helene('nouvelle'),
    gestes: [{ faire: 'taper', dans: '#officine-nom', texte: 'Grande Pharmacie de la Pinède', sert: 'Ce nom s’affiche en haut de l’écran et sur les plannings imprimés.' }],
  },
  {
    chapitre: PREPARER,
    qui: HELENE,
    cible: '.content .split',
    titre: 'Horaires et effectif',
    texte: () => 'Les horaires jour par jour. À droite, le nombre de personnes attendues au comptoir.',
    jouer: () => helene('officine'),
    gestes: [
      { faire: 'choisir', dans: () => document.querySelector<HTMLElement>('[aria-label="Fermeture le samedi"]'), valeur: '18:00', dit: 'Réglez la fermeture du samedi à 18 h', sert: 'Chaque jour a ses heures d’ouverture et de fermeture.' },
      { faire: 'cliquer', sur: () => document.querySelector<HTMLElement>('[aria-label="Coupure le midi : lundi"]'), dit: 'Cliquez sur « Coupure le midi », le lundi', sert: 'La pharmacie ferme alors à l’heure du déjeuner ce jour-là.' },
      { faire: 'choisir', dans: () => document.querySelector<HTMLElement>('[aria-label^="Nombre minimum de personnes"]'), valeur: '3', dit: 'Passez le minimum au comptoir à 3 personnes', sert: 'En dessous, la grille écrit « Manque du monde ».', facultatif: true },
      // Les réglages de l'exemple sont remis en place pour la suite de la visite.
      { faire: 'action', jouer: () => poser((d) => ({ ...d, officine: { ...d.officine, horaires: reference().officine.horaires, effectifs: reference().officine.effectifs } })) },
    ],
  },
  {
    chapitre: PREPARER,
    qui: HELENE,
    cible: "[data-focus='modele']",
    titre: 'Qui prépare le planning',
    texte: () => 'Avec l’équipe : chacun donne ses préférences. Vous seul : vous construisez sans les demander.',
    jouer: () => helene('officine'),
    gestes: [
      { faire: 'cliquer', sur: parTexte("[data-focus='modele'] label", 'Vous seul'), sert: 'Planning classique : vous construisez sans recueillir de préférences.' },
      { faire: 'pause', ms: 900 },
      { faire: 'cliquer', sur: parTexte("[data-focus='modele'] label", 'Avec l’équipe'), sert: 'Planning collaboratif : chacun donne ses préférences avant le calcul.' },
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
      { faire: 'cliquer', sur: "[data-focus='ajouter-personne']", sert: 'Ce bouton ouvre la fiche d’une nouvelle personne.' },
      { faire: 'taper', dans: '#personne-prenom', texte: 'Sarah', sert: 'Le prénom apparaît sur chaque ligne du planning.' },
      { faire: 'taper', dans: '#personne-nom', texte: 'Lemoine', sert: 'Le nom sert aussi à créer son identifiant de connexion.' },
      { faire: 'choisir', dans: '#personne-fonction', valeur: 'animateur', sert: 'La fonction fixe sa couleur et ce qu’elle peut tenir seule.' },
      { faire: 'taper', dans: '#personne-heures', texte: '21', sert: 'Les heures du contrat servent au compteur d’heures et à l’équité.' },
      { faire: 'cliquer', sur: VALIDER, sert: 'La personne rejoint l’équipe ; son compte est prêt.' },
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
    gestes: [{ faire: 'cliquer', sur: parTexte('.content .split > :last-child button[aria-pressed]', 'Dermatologie'), sert: 'Une compétence cochée aide le planning à placer la bonne personne au bon moment.' }],
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
    gestes: [
      { faire: 'cliquer', sur: parTexte('.content .jr-filtre', 'Réglables'), sert: 'On ne garde que les règles dont vous fixez le seuil.' },
      { faire: 'cliquer', sur: parTexte('.content summary', 'Repos quotidien'), dit: 'Ouvrez la fiche « Repos quotidien »', sert: 'Chaque fiche dit ce qui est contrôlé, sa source et son seuil.' },
      { faire: 'cliquer', sur: parTexte('.content .jr-filtre', 'À faire valider'), sert: 'Ces règles viennent de sources secondaires : à faire relire par un spécialiste.' },
      { faire: 'cliquer', sur: parTexte('.content .jr-filtre', 'Toutes'), sert: 'Et l’on retrouve toutes les règles.' },
    ],
  },
  // ---- 2. Planifier
  {
    chapitre: PLANIFIER,
    qui: CAMILLE,
    cible: '.sh-cal',
    titre: 'Les préférences du mois',
    texte: () => 'Nicolas choisit une forme, clique les jours. « M’assister » remplit le reste.',
    jouer: () => {
      avecSouhaits(false);
      // Son mois repart vide : sinon « M’assister » n’aurait plus rien à remplir.
      poser((d) => ({ ...d, souhaits: (d.souhaits ?? []).filter((x) => x.personId !== 'p_camille') }));
      versDemandes('nicolas.lesyndicaliste', 'souhaits');
    },
    gestes: [
      { faire: 'cliquer', sur: '.sh-choix.matin', sert: 'On choisit d’abord une forme : matin, journée, après-midi ou repos.' },
      { faire: 'cliquer', sur: nieme('button.sh-jour', 1), dit: 'Cliquez sur un jour du calendrier', sert: 'Le jour prend la forme choisie.' },
      { faire: 'cliquer', sur: nieme('button.sh-jour', 2), dit: 'Cliquez sur un autre jour', sert: 'Autant de jours que l’on veut, de la même façon.' },
      { faire: 'cliquer', sur: "[data-focus='assister']", sert: '« M’assister » remplit le reste du mois d’après les habitudes.' },
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
    gestes: [
      { faire: 'cliquer', sur: () => document.querySelector<HTMLElement>('[aria-label="Semaine suivante"]'), dit: 'Cliquez sur la flèche « Semaine suivante »', sert: 'On passe d’une semaine à l’autre avec ces deux flèches.' },
      { faire: 'cliquer', sur: () => document.querySelector<HTMLElement>('[aria-label="Semaine précédente"]'), dit: 'Revenez à la semaine précédente', sert: 'La semaine affichée est rappelée en haut de la grille.' },
    ],
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
      { faire: 'cliquer', sur: '.plan-grid .add', dit: 'Cliquez sur le « + » d’une case', sert: 'Il ouvre un poste pour cette personne, ce jour-là.' },
      { faire: 'attendre', que: '.dialog' },
      { faire: 'cliquer', sur: parTexte('.dialog .btn.sm', 'Ouverture'), dit: 'Cliquez sur le poste type « Ouverture »', sert: 'Un poste type remplit les horaires et la pause d’un seul geste.', facultatif: true },
      { faire: 'cliquer', sur: () => document.querySelector<HTMLElement>('label[for="tache-comptoir"], #tache-comptoir'), dit: 'Choisissez l’activité « Comptoir »', sert: 'Comptoir, réserve, administratif : l’activité compte pour l’effectif.', facultatif: true },
      { faire: 'cliquer', sur: VALIDER, sert: 'Horaires, pause et activité sont enregistrés dans le brouillon.' },
    ],
  },
  {
    chapitre: PLANIFIER,
    qui: HELENE,
    cible: '.content .plan',
    cibleFin: '.content .plan',
    titre: 'Trois propositions',
    texte: () => 'Solvéa calcule trois plannings : équité, préférences ou coût d’abord. Les règles passent toujours avant. Vous comparez, vous choisissez.',
    jouer: () => {
      avecSouhaits();
      semaineUne();
    },
    gestes: [
      { faire: 'cliquer', sur: "[data-tour='proposer']", sert: 'Solvéa va calculer trois plannings complets pour la semaine.' },
      { faire: 'attendre', que: '.dialog' },
      // Un poste a été posé à la main à l'étape précédente : la fenêtre demande d'abord quoi en faire.
      { faire: 'cliquer', sur: parTexte('.dialog label.check', 'Conserver les postes déjà posés'), facultatif: true, dit: 'Cochez « Conserver les postes déjà posés »', sert: 'Le poste posé à la main est gardé ; le calcul complète autour.' },
      { faire: 'cliquer', sur: parTexte('.dialog .btn', 'Calculer trois propositions'), facultatif: true, dit: 'Cliquez sur « Calculer trois propositions »', sert: 'Les règles impératives passent toujours avant le reste.' },
      { faire: 'attendre', que: '.dialog .variant' },
      // Le temps de lire les trois propositions côte à côte.
      { faire: 'pause', ms: 3600, dit: 'Trois plannings à comparer : équité, préférences, coût' },
      { faire: 'cliquer', sur: nieme('.dialog .variant', 1), dit: 'Comparez : « Préférences d’abord »', sert: 'Elle suit le plus de préférences possible.' },
      { faire: 'pause', ms: 1400 },
      { faire: 'cliquer', sur: nieme('.dialog .variant', 2), dit: 'Comparez : « Coût d’abord »', sert: 'Elle évite les heures au-delà des contrats.' },
      { faire: 'pause', ms: 1400 },
      { faire: 'cliquer', sur: nieme('.dialog .variant', 0), dit: 'Retenez « Équité d’abord »', sert: 'Samedis et fermetures y sont répartis selon l’historique de chacun.' },
      { faire: 'pause', ms: 900 },
      { faire: 'cliquer', sur: VALIDER, sert: 'La proposition devient le brouillon : vous pourrez encore tout modifier.' },
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
    gestes: [
      { faire: 'cliquer', sur: parTexte('.plan-bar .seg button', 'Coût'), sert: 'La colonne de droite passe au coût estimé de chacun.' },
      { faire: 'cliquer', sur: parTexte('.plan-bar .seg button', 'Équité'), sert: 'Ici : les samedis de chacun, face à sa part.' },
      { faire: 'cliquer', sur: parTexte('.plan-bar .seg button', 'Heures'), sert: 'Retour aux heures de la semaine, face au contrat.' },
      { faire: 'cliquer', sur: '.plan-grid .tile', dit: 'Cliquez sur une tuile', sert: 'Un poste s’ouvre pour être corrigé ou supprimé.' },
      { faire: 'attendre', que: '.dialog' },
      { faire: 'cliquer', sur: parTexte('.dialog .btn.sm', 'Journée longue'), dit: 'Cliquez sur le poste type « Journée longue »', sert: 'Les horaires et la pause changent d’un coup.', facultatif: true },
      { faire: 'cliquer', sur: VALIDER, sert: 'La tuile change de couleur avec son horaire.' },
      { faire: 'cliquer', sur: () => document.querySelector<HTMLElement>('[aria-label="Annuler la dernière manipulation"]'), dit: 'Cliquez sur « Annuler »', sert: 'Chaque manipulation de la grille peut être annulée, puis rétablie.' },
    ],
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
    gestes: [
      { faire: 'cliquer', sur: '.content .issue', dit: 'Cliquez sur un contrôle', sert: 'La grille montre aussitôt la personne et le jour concernés.', facultatif: true },
    ],
  },
  {
    chapitre: PLANIFIER,
    qui: HELENE,
    cible: "[data-focus='mois']",
    titre: 'Le mois',
    texte: () => 'Le mois d’un coup d’œil : horaires, équipe au complet ou non, heures de chacun. Et les préférences reçues.',
    jouer: () => {
      avecSouhaits();
      proposerSemaine(semaineDans(1));
      semaineUne();
      useUi.getState().setPlanVue('mois');
    },
    gestes: [{ faire: 'cliquer', sur: () => document.querySelector<HTMLElement>('.mo-pref input'), dit: 'Cochez « Afficher les préférences »', sert: 'Les préférences de chacun s’affichent dans les cases du mois.' }],
  },
  {
    chapitre: PLANIFIER,
    qui: HELENE,
    cible: '.plan-grid .pg-h:nth-child(3)',
    cibleFin: '.dialog',
    titre: 'Une journée',
    texte: () => 'Sous chaque date, « Voir la journée » ouvre toute l’équipe sur une ligne de temps : pauses, retards.',
    jouer: () => {
      avecSouhaits();
      proposerSemaine(semaineDans(1));
      semaineUne();
    },
    gestes: [
      { faire: 'cliquer', sur: nieme('.plan-grid .jour-btn', 1), dit: 'Cliquez sur « Voir la journée », sous la date', sert: 'La journée s’ouvre : toute l’équipe sur une ligne de temps.' },
      { faire: 'attendre', que: '.dialog' },
      { faire: 'pause', ms: 2600, dit: 'Chaque ligne montre un poste et sa pause', sert: 'On y règle une pause et on y note un retard, en deux clics.' },
      { faire: 'choisir', dans: () => document.querySelector<HTMLElement>('.dialog input[id^="pause-de-"]'), valeur: '12:45', dit: 'Décalez le début d’une pause à 12 h 45', sert: 'La frise et le contrôle « pharmacien présent » se recalculent aussitôt.', facultatif: true },
      { faire: 'cliquer', sur: parTexte('.dialog button', 'Noter un retard'), sert: 'Un retard, un départ anticipé ou une absence non prévue se note ici.' },
      { faire: 'choisir', dans: () => document.querySelector<HTMLElement>('.dialog select[id^="ecart-min-"]'), valeur: '15', dit: 'Choisissez « 15 min »', sert: 'Une date et une durée, jamais une raison.', facultatif: true },
      { faire: 'cliquer', sur: parTexte('.dialog .btn.sm.primary', 'Noter'), sert: 'Le retard rejoint le suivi de la personne.', facultatif: true },
      { faire: 'cliquer', sur: parTexte('.dialog button', 'Lendemain'), sert: 'On passe d’un jour à l’autre sans refermer la fenêtre.' },
    ],
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
      // Une étape précédente a pu publier la semaine : on repart du brouillon pour montrer la publication.
      enBrouillon(semaineDans(1));
      semaineUne();
    },
    gestes: [
      { faire: 'cliquer', sur: "[data-focus='publier']", sert: 'Solvéa relit les règles et les délais avant d’envoyer.' },
      { faire: 'attendre', que: '.dialog' },
      { faire: 'cliquer', sur: parTexte('.dialog button', 'Tout cocher'), facultatif: true, sert: 'Les accords à recueillir sont notés d’un seul geste.' },
      { faire: 'cliquer', sur: VALIDER, sert: 'Toute l’équipe voit maintenant sa semaine.' },
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
      { faire: 'cliquer', sur: parTexte('.content button', 'Ajouter une garde'), sert: 'On ajoute la garde du secteur : sa date et son type.' },
      { faire: 'choisir', dans: '#garde-personne', valeur: 'p_lea', sert: 'Le pharmacien choisi est prévenu dans son espace.' },
      { faire: 'cliquer', sur: VALIDER, sert: 'Le délai de 15 jours et le repos qui suit sont contrôlés.' },
      { faire: 'action', jouer: avecGardes },
      { faire: 'cliquer', sur: '.content .g-item', dit: 'Cliquez sur une garde de la liste', sert: 'Sa fiche s’ouvre : à qui elle est confiée, le repos qui suit, ce qui part en paie.', facultatif: true },
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
      { faire: 'cliquer', sur: '.top-creer', sert: '« Créer » réunit tout ce que l’on peut ajouter.' },
      { faire: 'cliquer', sur: parTexte('.outils .menu button', 'Une formation'), sert: 'On ouvre la fenêtre de la formation.' },
      { faire: 'taper', dans: '#formation-intitule', texte: 'Gestes d’urgence', sert: 'L’intitulé apparaîtra dans le planning des participants.' },
      { faire: 'cliquer', sur: '#formation-p_thomas', dit: 'Cochez Thomas parmi les participants', sert: 'Seuls les participants seront absents du comptoir.' },
      { faire: 'cliquer', sur: '#formation-p_ines', dit: 'Cochez Inès', sert: 'On coche autant de personnes que nécessaire.' },
      { faire: 'cliquer', sur: VALIDER, dit: 'Cliquez sur « Planifier et prévenir »', sert: 'Chacun est prévenu ; les postes à couvrir vont dans « Résoudre ».' },
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
      { faire: 'cliquer', sur: '.top-creer', sert: 'Le même bouton « Créer ».' },
      { faire: 'cliquer', sur: parTexte('.outils .menu button', 'Un inventaire'), sert: 'On ouvre la fenêtre de l’inventaire.' },
      { faire: 'cliquer', sur: parTexte('.dialog button', 'Toute l’équipe'), dit: 'Cliquez sur « Toute l’équipe »', sert: 'Tout le monde est coché d’un seul geste.' },
      { faire: 'cliquer', sur: VALIDER, sert: 'Un poste « Inventaire » est ajouté au planning de chacun.' },
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
    gestes: [{ faire: 'cliquer', sur: parTexte('.me-grid .seg button', 'Calendrier'), sert: 'Le calendrier montre le mois entier, avec la couleur de chaque horaire.' }],
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
      { faire: 'cliquer', sur: parTexte('.plan-bar .seg button', 'Mes postes'), sert: '« Mes postes » ne garde que sa propre ligne.' },
      { faire: 'pause', ms: 1400 },
      { faire: 'cliquer', sur: parTexte('.plan-bar .seg button', 'Toute l’équipe'), sert: '« Toute l’équipe » remet le planning au complet.' },
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
      { faire: 'cliquer', sur: parTexte('#contenu .voie', 'remplacer'), sert: 'Chaque carte ouvre un type de demande. Ici : se faire remplacer.' },
      { faire: 'cliquer', sur: parTexte('#contenu .voie', 'Absence'), sert: 'Et ici : un congé ou une contrainte d’horaires.' },
    ],
  },
  {
    chapitre: EQUIPE,
    qui: CAMILLE,
    cible: '.dialog',
    titre: 'Demander, avec sa raison',
    texte: () => 'Un raccourci remplit les horaires et la raison. Une raison est toujours demandée ; seuls les titulaires la voient.',
    jouer: () => {
      avecPlanning();
      versDemandes('nicolas.lesyndicaliste', 'absences');
      useUi.getState().agir('demandes', 'demande');
    },
    gestes: [
      { faire: 'attendre', que: '.dialog' },
      { faire: 'cliquer', sur: parTexte('.dialog button', 'Sortie d’école'), sert: 'Le raccourci remplit les horaires et la raison ; on peut tout ajuster.' },
      { faire: 'choisir', dans: '#demande-motif', valeur: 'famille', sert: 'La raison se choisit dans une liste ; seuls les titulaires la voient.' },
      { faire: 'taper', dans: '#demande-precision', texte: 'Sortie à 16 h 30', sert: 'Une précision est possible, sans être obligatoire.' },
      { faire: 'cliquer', sur: VALIDER, sert: 'La demande part au titulaire, qui répond.' },
    ],
  },
  {
    chapitre: EQUIPE,
    qui: CAMILLE,
    cible: "[data-focus='remplacer']",
    cibleFin: "[data-focus='remplacer']",
    titre: 'Se faire remplacer',
    texte: () => 'Un motif, un niveau d’urgence, à toute l’équipe ou à un collègue. La titulaire décide.',
    jouer: () => {
      avecPlanning();
      versDemandes('nicolas.lesyndicaliste', 'remplacements');
    },
    gestes: [
      { faire: 'cliquer', sur: "[data-focus='remplacer'] .btn", sert: 'On choisit le poste à faire reprendre par un collègue.' },
      { faire: 'attendre', que: '.dialog .choix.urgence' },
      { faire: 'cliquer', sur: parTexte('.choix.urgence label', 'Urgence médicale'), sert: 'L’urgence médicale passe en tête, avec un justificatif possible.' },
      { faire: 'pause', ms: 900 },
      { faire: 'cliquer', sur: parTexte('.choix.urgence label', 'Urgent'), sert: 'Urgent : le poste est à moins de sept jours.' },
      { faire: 'choisir', dans: '#rempl-motif', valeur: 'famille', sert: 'Un motif est demandé ; seuls les titulaires le voient.' },
      { faire: 'cliquer', sur: VALIDER, sert: 'La demande part au titulaire, qui décide.' },
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
    gestes: [{ faire: 'cliquer', sur: parTexte('.demande-r button', 'Accepter'), sert: 'Accepter prévient tous ceux qui peuvent tenir le poste.' }],
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
    gestes: [{ faire: 'cliquer', sur: parTexte("[data-focus='aider'] button", 'Je me propose'), sert: 'Le collègue se propose ; le calcul vérifie son repos et ses heures.' }],
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
    gestes: [{ faire: 'cliquer', sur: parTexte('.demande-r button', 'Valider avec'), sert: 'Les deux plannings changent, et chacun est prévenu.' }],
  },
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: '.demande-r.u-medical',
    cibleFin: '.demande-r.u-medical, .onglets',
    titre: 'Une urgence médicale',
    texte: (d) => (urgenceMedicale(d)?.accord === 'attente' ? 'En tête de liste, en rouge. Le justificatif n’est visible que des titulaires.' : 'Acceptée. Le justificatif est conservé dans « Mes documents », pour les seuls titulaires.'),
    jouer: () => {
      avecUrgenceMedicale();
      useUi.getState().setSujet('remplacements');
      helene('resoudre');
    },
    gestes: [{ faire: 'cliquer', sur: parTexte('.demande-r.u-medical button', 'Accepter'), sert: 'Une demande médicale se traite toujours en premier.' }],
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
      if (!s.data.absences.some((x) => x.personId === 'p_jules' && x.type === 'conge')) s.declarerAbsence({ motif: 'famille', personId: 'p_jules', from: addDays(semaineDans(4), 0), to: addDays(semaineDans(4), 4), type: 'conge', statut: 'demandee' });
      useUi.getState().setSujet('demandes');
      helene('resoudre');
    },
    gestes: [{ faire: 'cliquer', sur: parTexte('.panneau button', 'Approuver'), sert: 'Avant d’approuver, vous voyez ce que l’absence découvre.' }],
  },
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: '.content .fc',
    titre: 'Deux demandes sur les mêmes dates',
    texte: () => 'Inès et Thomas demandent les mêmes jours. La frise le montre, chaque demande le signale : vous répondez aux deux.',
    jouer: () => {
      avecCongeARefuser();
      const s = store();
      const ines = s.data.absences.find((x) => x.personId === 'p_ines' && x.type === 'conge');
      if (ines && !s.data.absences.some((x) => x.personId === 'p_thomas' && x.type === 'conge')) s.declarerAbsence({ motif: 'famille', personId: 'p_thomas', from: ines.from, to: ines.to, type: 'conge', statut: 'demandee' });
      useUi.getState().setSujet('demandes');
      helene('resoudre');
    },
    gestes: [{ faire: 'cliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.panneau .decision')].find((e) => /Thomas/.test(e.textContent ?? '') && /Congé/.test(e.textContent ?? ''))?.querySelector<HTMLElement>('.btn.primary'), dit: 'Approuvez le congé de Thomas, arrivé à sa place', sert: 'Sur la demande d’Inès, « Thomas est déjà absent » s’affiche aussitôt.', facultatif: true }],
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
      { faire: 'cliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.panneau .decision')].find((e) => /Inès/.test(e.textContent ?? ''))?.querySelector<HTMLElement>('button'), dit: 'Cliquez sur « Refuser », sur la demande d’Inès', sert: 'Un refus s’explique toujours : la fenêtre vous y aide.' },
      { faire: 'attendre', que: '#refus-raison' },
      { faire: 'choisir', dans: '#refus-raison', valeur: 'Plusieurs absences déjà prévues', sert: 'La raison se choisit dans une liste, pour rester factuel.' },
      { faire: 'taper', dans: '#refus-mot', texte: 'La semaine suivante serait possible.', sert: 'Un mot libre peut proposer une autre solution.' },
      { faire: 'cliquer', sur: '.dialog-foot .btn.danger', sert: 'Le message part à la personne ; son planning ne change pas.' },
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
      { faire: 'cliquer', sur: '.appel .btn.primary', sert: 'Tous ceux qui peuvent tenir le poste sont prévenus en même temps.' },
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
      { faire: 'cliquer', sur: parTexte('.panneau button', 'Voir et choisir la solution'), sert: 'Solvéa montre comment régler chaque jour, option par option.' },
      { faire: 'attendre', que: '.rs-jour' },
      { faire: 'cliquer', sur: '.rs-jour .rs-option:not(.on):not(.libre)', dit: 'Choisissez une autre option pour le premier jour', sert: 'Vous gardez la main : l’option conseillée n’est qu’une proposition.' },
      { faire: 'cliquer', sur: '.dialog-foot .btn.primary', sert: 'Les changements sont appliqués et annoncés aux personnes concernées.' },
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
    gestes: [{ faire: 'cliquer', sur: parTexte('.panneau button', 'Donner mon accord'), sert: 'La décision de l’autre titulaire est appliquée dès votre accord.' }],
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
      { faire: 'taper', dans: '#msg-texte', texte: 'Planning publié pour deux semaines.', sert: 'Un message pour toute l’équipe, ou pour une seule personne.' },
      { faire: 'cliquer', sur: parTexte('.content button', 'Envoyer'), sert: 'Il arrive aussitôt dans l’espace de chacun.' },
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
    gestes: [
      { faire: 'cliquer', sur: "[data-focus='auto-heures']", sert: 'Les écarts sont résorbés sur la prochaine semaine à construire, sans rien publier.', facultatif: true },
    ],
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
    gestes: [
      { faire: 'cliquer', sur: parTexte('.content button', '12 semaines'), sert: 'La période se choisit : 8 semaines, 12 semaines ou 6 mois.' },
      { faire: 'cliquer', sur: parTexte('.content .jr-filtre', 'Fermetures en semaine'), sert: 'Un compteur à la fois : ici, qui ferme le soir.' },
      { faire: 'cliquer', sur: parTexte('.content summary', 'Comment c’est calculé'), sert: 'La part de chacun suit son temps de travail.', facultatif: true },
    ],
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
    gestes: [
      { faire: 'cliquer', sur: parTexte('.content .jr-filtre', 'Publications'), sert: 'Le journal se filtre par nature de décision.', facultatif: true },
      { faire: 'cliquer', sur: parTexte('.content button', 'Fiche navette'), sert: 'Les heures et variables du mois, prêtes pour le comptable.' },
    ],
  },
  {
    chapitre: BILAN,
    qui: HELENE,
    cible: '.content .jr-barre',
    cibleFin: '.content .doc-liste, .content .card',
    titre: 'Les documents',
    texte: () => 'Plannings publiés, absences, fichiers déposés : chacun retrouve tout au même endroit.',
    jouer: () => {
      avecPlanning();
      helene('documents');
    },
    gestes: [{ faire: 'cliquer', sur: parTexte('.content .jr-filtre', 'absences'), sert: 'Vos absences et vos arrêts, avec leur état.' }, { faire: 'cliquer', sur: parTexte('.content .jr-filtre', 'Mes fichiers'), sert: 'Les fichiers que vous déposez : une photo ou un PDF.' }],
  },
  {
    chapitre: BILAN,
    qui: HELENE,
    cible: '.content .jr-barre',
    cibleFin: '.content .doc-liste, .content .hist-tete',
    titre: 'Absences et justificatifs',
    texte: () => 'L’historique de l’équipe : arrêts, congés, remplacements, par personne. « Joindre » conserve un justificatif, vu des seuls titulaires.',
    jouer: () => {
      avecAbsenceImprevue();
      helene('documents');
    },
    gestes: [{ faire: 'cliquer', sur: parTexte('.content .jr-filtre', 'Absences de l’équipe'), sert: 'Tout l’historique de l’équipe, par personne et par nature.' }],
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
    gestes: [
      { faire: 'cliquer', sur: parTexte('.content .btn.primary', 'Voir la journée'), sert: 'La journée d’aujourd’hui, avec toute l’équipe.', facultatif: true },
      { faire: 'attendre', que: '.dialog', facultatif: true },
      { faire: 'cliquer', sur: '.dialog .dialog-fermer', dit: 'Fermez la fenêtre', sert: 'On revient au tableau de bord.', facultatif: true },
      { faire: 'cliquer', sur: '.content .tb-sujet', dit: 'Cliquez sur une ligne de décisions', sert: 'Elle mène droit à ce qui attend votre réponse, dans « Résoudre ».' },
    ],
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
    gestes: [{ faire: 'cliquer', sur: '.top-creer', sert: 'Poste, personne, garde, formation, inventaire : tout part d’ici.' }],
  },
  {
    chapitre: QUOTIDIEN,
    qui: HELENE,
    cible: '.topbar-in',
    cibleFin: '.outils .menu',
    titre: 'La cloche',
    texte: () => 'Chaque décision prise y est annoncée, avec ce qu’elle change au planning. Dessous, ce qui vous attend, le plus urgent en tête.',
    jouer: () => {
      avecAbsenceImprevue();
      helene('tableau');
    },
    gestes: [{ faire: 'cliquer', sur: '.outils .top-ico', dit: 'Cliquez sur la cloche', sert: 'Elle réunit les décisions prises et ce qui vous attend.' }],
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
    titre: 'Solvi, votre assistant',
    texte: () => 'Posez une question : il lit le planning, répond, et vous emmène au bon écran.',
    jouer: () => {
      avecPlanning();
      helene('tableau');
      useUi.getState().montrerAssistant(true);
    },
    gestes: [
      { faire: 'cliquer', sur: "[data-focus='assistant']", dit: 'Cliquez sur « Aide », en bas à droite', sert: 'C’est moi, Solvi ! Un clic ouvre la conversation.' },
      { faire: 'taper', dans: '#aide-question', texte: 'Qui travaille demain ?', sert: 'Posez la question avec vos mots.' },
      { faire: 'cliquer', sur: '.aide-envoyer', dit: 'Cliquez sur la flèche pour envoyer', sert: 'Je lis le planning et je réponds, avec un bouton vers le bon écran.' },
      { faire: 'attendre', que: () => [...document.querySelectorAll<HTMLElement>('.aide-bulle.bot:not(.attente)')][1] },
      { faire: 'pause', ms: 2600, dit: 'La réponse arrive, avec le bouton qui y mène', sert: 'Je réponds d’après votre planning du moment.' },
    ],
  },
  {
    chapitre: QUOTIDIEN,
    qui: HELENE,
    cible: '.content .ad-recherche',
    cibleFin: '.content',
    titre: 'L’aide',
    texte: () => 'Toutes les fonctions sont répertoriées. Chaque fiche a sa réponse, son bouton et son tutoriel.',
    jouer: () => {
      avecPlanning();
      helene('aide');
    },
    gestes: [
      { faire: 'taper', dans: '#aide-recherche', texte: 'garde', sert: 'La recherche filtre les fiches et le lexique en même temps.' },
      { faire: 'cliquer', sur: parTexte('.content .jr-filtre', 'Lexique'), sert: 'Le lexique définit le vocabulaire de Solvéa.' },
      { faire: 'cliquer', sur: parTexte('.content .jr-filtre', 'Comment faire'), sert: 'Et l’on revient aux fiches : « Voir le tutoriel » rejoue la tâche, rien qu’elle.' },
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
      { faire: 'cliquer', sur: 'label[for="mode-sombre"]', sert: 'Le mode sombre repose les yeux le soir.' },
      { faire: 'pause', ms: 1600 },
      { faire: 'cliquer', sur: 'label[for="mode-clair"]', sert: 'Et l’on revient au mode clair d’un clic.' },
      { faire: 'cliquer', sur: 'label[for="theme-emeraude"]', dit: 'Choisissez la couleur « Émeraude »', sert: 'Toute l’application, et moi avec, prenons cette couleur.', facultatif: true },
      { faire: 'pause', ms: 1800 },
      { faire: 'cliquer', sur: 'label[for="theme-ciel"]', dit: 'Revenez au bleu ciel', sert: 'Dix couleurs sont proposées.', facultatif: true },
      { faire: 'cliquer', sur: 'label[for="texte-grand"]', dit: 'Passez le texte en grand', sert: 'Pour lire plus confortablement.', facultatif: true },
      { faire: 'cliquer', sur: 'label[for="texte-normal"]', dit: 'Revenez à la taille normale', sert: 'Chaque personne garde ses propres préférences.', facultatif: true },
    ],
  },
];

/**
 * La visite titulaire reste dans la peau de la titulaire, rubrique après rubrique, dans l'ordre du menu :
 * Équipe, Réglages, Règles, Construire, Gardes, Résoudre, Messages, Heures, Équité, Journal, Documents,
 * puis les gestes du quotidien. Ce que voit l'équipe vient ensuite, dans un seul chapitre.
 */
const ORDRE_TITULAIRE = [
  'Créer la pharmacie',
  'Ajouter l’équipe',
  'La fiche d’une personne',
  'Horaires et effectif',
  'Qui prépare le planning',
  'Les règles',
  'Une semaine à construire',
  'Poser un poste',
  'Trois propositions',
  'La semaine est posée',
  'Les contrôles',
  'Une journée',
  'Retards et suivi',
  'Le mois',
  'Publier',
  'Imprimer',
  'Une formation',
  'Un inventaire',
  'Les gardes',
  'La demande arrive',
  'Valider le remplacement',
  'Une urgence médicale',
  'Congés et horaires',
  'Deux demandes sur les mêmes dates',
  'Refuser une demande',
  'Une absence imprévue',
  'L’appel à l’équipe',
  'Personne ne se propose',
  'Donner son accord',
  'Les messages',
  'Le compteur d’heures',
  'L’équité',
  'Le journal et la paie',
  'Les documents',
  'Absences et justificatifs',
  'Le tableau de bord',
  'Le bouton « Créer »',
  'La cloche',
  'Plusieurs pharmacies',
  'Solvi, votre assistant',
  'L’aide',
  'Mot de passe et clé de secours',
  'Votre compte',
];
/** Le dernier chapitre : les mêmes sujets, vus par un préparateur, une pharmacienne, l'autre titulaire. */
const ORDRE_EQUIPE = ['Mon planning', 'Le calendrier du mois', 'Le planning de l’équipe', 'Les préférences du mois', 'Mes demandes', 'Demander, avec sa raison', 'Se faire remplacer', 'Un collègue se propose', 'Mes gardes', 'Mon suivi', 'Décider à deux'];
/** Quelques étapes changent de chapitre pour rester avec leur rubrique du menu. */
const CHAPITRE_DE: Record<string, string> = { 'Créer la pharmacie': 'Démarrer', 'Retards et suivi': PLANIFIER };
const dans = (ordre: string[], chapitre?: string): Etape[] =>
  ordre
    .map((t) => COMPLET_BRUT.find((e) => e.titre === t))
    .filter((e): e is Etape => !!e)
    .map((e) => ({ ...e, chapitre: chapitre ?? CHAPITRE_DE[e.titre] ?? e.chapitre }));
const COMPLET: Etape[] = [
  ...dans(ORDRE_TITULAIRE),
  ...dans(ORDRE_EQUIPE, EQUIPE),
  // Une étape ajoutée sans être rangée ne disparaît pas : elle vient à la fin.
  ...COMPLET_BRUT.filter((e) => !ORDRE_TITULAIRE.includes(e.titre) && !ORDRE_EQUIPE.includes(e.titre)),
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
      gestes: [{ faire: 'cliquer', sur: parTexte('.me-grid .seg button', 'Calendrier'), sert: 'Le calendrier montre le mois entier, avec la couleur de chaque horaire.' }],
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
      gestes: [{ faire: 'cliquer', sur: parTexte('.plan-bar .seg button', 'Mes postes'), sert: '« Mes postes » ne garde que sa propre ligne.' }],
    },
    {
      chapitre: MES_DEMANDES,
      qui: p.qui,
      cible: '.voies',
      titre: 'Mes demandes',
      texte: () => 'Trois cartes : mes préférences, une absence, un remplacement.',
      jouer: () => versDemandes(p.identifiant, 'absences'),
      gestes: [
        { faire: 'cliquer', sur: parTexte('#contenu .voie', 'remplacer'), sert: 'Chaque carte ouvre un type de demande. Ici : se faire remplacer.' },
        { faire: 'cliquer', sur: parTexte('#contenu .voie', 'Absence'), sert: 'Et ici : un congé ou une contrainte d’horaires.' },
      ],
    },
    {
      chapitre: MES_DEMANDES,
      qui: p.qui,
      cible: '.sh-cal',
      titre: 'Mes préférences',
      texte: () => 'Une forme, puis les jours. « M’assister » remplit le reste.',
      jouer: () => {
        // Son mois repart vide : sinon « M’assister » n’aurait plus rien à remplir.
        poser((d) => ({ ...d, souhaits: (d.souhaits ?? []).filter((x) => x.personId !== p.id) }));
        versDemandes(p.identifiant, 'souhaits');
      },
      gestes: [
        { faire: 'cliquer', sur: '.sh-choix.matin', sert: 'On choisit d’abord une forme : matin, journée, après-midi ou repos.' },
        { faire: 'cliquer', sur: nieme('button.sh-jour', 1), dit: 'Cliquez sur un jour du calendrier', sert: 'Le jour prend la forme choisie.' },
        { faire: 'cliquer', sur: nieme('button.sh-jour', 2), dit: 'Cliquez sur un autre jour', sert: 'Autant de jours que l’on veut, de la même façon.' },
        { faire: 'cliquer', sur: "[data-focus='assister']", sert: '« M’assister » remplit le reste du mois d’après les habitudes.' },
      ],
    },
    {
      chapitre: MES_DEMANDES,
      qui: p.qui,
      cible: '.dialog',
      titre: 'Demander un congé',
      texte: () => 'Des dates et une raison, choisie dans une liste. Seuls les titulaires la voient.',
      jouer: () => {
        versDemandes(p.identifiant, 'absences');
        useUi.getState().agir('demandes', 'demande');
      },
      gestes: [
        { faire: 'attendre', que: '.dialog' },
        { faire: 'cliquer', sur: parTexte('.dialog button', 'Sortie d’école'), sert: 'Le raccourci remplit les horaires et la raison ; on peut tout ajuster.' },
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
        { faire: 'cliquer', sur: "[data-focus='remplacer'] .btn", sert: 'On choisit le poste à faire reprendre par un collègue.' },
        { faire: 'attendre', que: '.dialog .choix.urgence' },
        { faire: 'cliquer', sur: parTexte('.choix.urgence label', 'Urgence médicale'), sert: 'L’urgence médicale passe en tête, avec un justificatif possible.' },
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
      gestes: [{ faire: 'taper', dans: '#msg-texte', texte: 'Bonjour à tous !', sert: 'Un message pour toute l’équipe, ou pour une seule personne.' }],
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
      titre: 'Solvi, votre assistant',
      texte: () => 'Posez une question : il lit votre planning et vous répond.',
      jouer: () => {
        moi('moi');
        useUi.getState().montrerAssistant(true);
      },
      gestes: [
        { faire: 'cliquer', sur: "[data-focus='assistant']", dit: 'Cliquez sur « Aide », en bas à droite', sert: 'C’est moi, Solvi ! Un clic ouvre la conversation.' },
        { faire: 'taper', dans: '#aide-question', texte: 'Mon prochain poste ?', sert: 'Posez la question avec vos mots.' },
        { faire: 'cliquer', sur: '.aide-envoyer', dit: 'Cliquez sur la flèche pour envoyer', sert: 'Je lis le planning et je réponds, avec un bouton vers le bon écran.' },
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
  complet: { court: 'Titulaire', role: 'Titulaire', titre: 'Tout Solvéa, de zéro', duree: `30 min · ${COMPLET.length} étapes`, etapes: COMPLET },
  pharmacien: { court: 'Pharmacien', role: 'Pharmacien adjoint', titre: 'Mon espace de pharmacien', duree: `7 min · ${PHARMACIEN.length} étapes`, etapes: PHARMACIEN },
  equipe: { court: 'Équipe', role: 'Préparateur, animateur, apprenti…', titre: 'Mon espace dans l’équipe', duree: `7 min · ${EQUIPIER.length} étapes`, etapes: EQUIPIER },
  etabli: { court: 'Journée type', role: 'Tous les rôles', titre: 'Une journée type', duree: `8 min · ${ETABLI.length} étapes`, etapes: ETABLI },
} as const;
export type Scenario = keyof typeof SCENARIOS;

/** Lance un parcours guidé sur un environnement d'exemple remis à neuf. */
export function lancerParcours(scenario: Scenario = 'etabli'): void {
  annulerMinuteries();
  store().chargerExemple(true, scenario === 'complet' ? 'zero' : 'etabli');
  useUi.getState().montrerAssistant(false);
  // Le parcours est remis à l'étape 1 : l'écran de la première étape est posé par le composant.
  voirComme('caroline.tellier');
  useUi.getState().setParcours(0, scenario, null);
  // Relancé depuis l'étape 1, le parcours ne change pas d'étape : son écran est reposé ici.
  SCENARIOS[scenario].etapes[0].jouer();
}

/** Où revenir une fois le tutoriel d'une tâche terminé : la pharmacie et le compte d'où il a été lancé. */
let retour: { officineId: string | null; session: string | null } | null = null;

/** Tutoriel d'une tâche, pour la rubrique d'aide : les étapes de la visite qui la montrent, et rien d'autre. */
export interface Tutoriel {
  scenario: Scenario;
  de: number;
  a: number;
}
/** Pour chaque fiche d'aide : la visite et les titres de la première et de la dernière étape qui la montrent. */
const TUTORIELS: Record<string, { gestion?: [string, string?]; equipe?: [string, string?]; pharmacien?: [string, string?] }> = {
  prochain: { equipe: ['Mon prochain poste', 'Ma semaine'] },
  'equipe-planning': { equipe: ['Le planning de l’équipe'] },
  difference: { equipe: ['Mes demandes'] },
  souhaits: { equipe: ['Mes préférences'] },
  conge: { equipe: ['Demander un congé'] },
  remplacer: { equipe: ['Me faire remplacer'] },
  aider: { equipe: ['Un appel à l’équipe'] },
  suivi: { equipe: ['Mon suivi'] },
  'gardes-moi': { pharmacien: ['Mes gardes'] },
  documents: { gestion: ['Les documents'] },
  message: { gestion: ['Les messages'], equipe: ['Les messages'] },
  compte: { gestion: ['Votre compte'], equipe: ['Mon compte'] },
  construire: { gestion: ['Une semaine à construire', 'La semaine est posée'] },
  publier: { gestion: ['Publier', 'Imprimer'] },
  mois: { gestion: ['Le mois'] },
  absence: { gestion: ['Une absence imprévue', 'Personne ne se propose'] },
  'demande-remplacement': { gestion: ['La demande arrive', 'Valider le remplacement'] },
  'demandes-equipe': { gestion: ['Congés et horaires', 'Refuser une demande'] },
  gardes: { gestion: ['Les gardes'] },
  formation: { gestion: ['Une formation', 'Un inventaire'] },
  personne: { gestion: ['Ajouter l’équipe', 'La fiche d’une personne'] },
  'mdp-equipe': { gestion: ['Mot de passe et clé de secours'] },
  heures: { gestion: ['Le compteur d’heures'] },
  retard: { gestion: ['Une journée', 'Retards et suivi'] },
  reglages: { gestion: ['Horaires et effectif', 'Qui prépare le planning'] },
  regles: { gestion: ['Les règles'] },
  paie: { gestion: ['Le journal et la paie'] },
  equite: { gestion: ['L’équité'] },
  accord: { gestion: ['Donner son accord'] },
  pharmacie: { gestion: ['Plusieurs pharmacies'] },
  historique: { gestion: ['Absences et justificatifs'] },
  feries: { gestion: ['Horaires et effectif'] },
  decisions: { gestion: ['La cloche'] },
  assistant: { gestion: ['Solvi, votre assistant'], equipe: ['Solvi, votre assistant'] },
  controles: { gestion: ['Les contrôles'] },
};

/** Le tutoriel d'une fiche d'aide pour ce rôle, s'il existe. */
export function tutorielDe(ficheId: string, espace: 'responsable' | 'pharmacien' | 'equipe'): Tutoriel | null {
  const t = TUTORIELS[ficheId];
  if (!t) return null;
  const essais: [Scenario, [string, string?] | undefined][] =
    espace === 'responsable' ? [['complet', t.gestion], ['equipe', t.equipe], ['pharmacien', t.pharmacien]] : espace === 'pharmacien' ? [['pharmacien', t.pharmacien ?? t.equipe]] : [['equipe', t.equipe]];
  for (const [scenario, titres] of essais) {
    if (!titres) continue;
    const etapes: readonly Etape[] = SCENARIOS[scenario].etapes;
    const de = etapes.findIndex((e) => e.titre === titres[0]);
    const a = titres[1] ? etapes.findIndex((e, i) => i >= de && e.titre === titres[1]) : de;
    if (de >= 0 && a >= de) return { scenario, de, a };
  }
  return null;
}

/** Lance le tutoriel d'une tâche sur l'exemple ; à la fin, on retrouve sa pharmacie et la rubrique d'aide. */
export function lancerTutoriel(t: Tutoriel): void {
  const s = store();
  retour = { officineId: s.data.demo ? null : s.officineId, session: useUi.getState().session };
  annulerMinuteries();
  s.chargerExemple(true, t.scenario === 'complet' ? 'zero' : 'etabli');
  useUi.getState().montrerAssistant(false);
  voirComme('caroline.tellier');
  useUi.getState().setParcours(t.de, t.scenario, { de: t.de, a: t.a });
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
  const { parcours, setParcours, scenario, session, vue, tache } = useUi();
  const data = useStore((s) => s.data);
  const ETAPES: readonly Etape[] = SCENARIOS[scenario].etapes;
  const etape = parcours !== null ? ETAPES[parcours] : null;
  /** On lit d'abord ; la démonstration ne se joue que sur demande, fiche refermée ; puis la fiche revient. */
  const [phase, setPhase] = useState<'lire' | 'demo' | 'fini'>('lire');
  /** La rubrique du menu où l'on se trouve, lue à l'écran : « Réglages », « Construire »… */
  const [section, setSection] = useState('');
  /** Les temps de la démonstration, et combien ont déjà été joués. */
  const temps = useRef<Geste[][]>([]);
  const [joues, setJoues] = useState(0);
  const [nbTemps, setNbTemps] = useState(0);
  /** Ce que le prochain temps va faire, lu à l'écran. */
  const [annonce, setAnnonce] = useState('');
  /** À quoi sert le geste en cours : la deuxième ligne de la bulle de Solvi. */
  const [sert, setSert] = useState('');
  /** Où Solvi se pose pendant la démonstration, pour ne jamais cacher ce qu'il montre. */
  const [coin, setCoin] = useState<'bas' | 'gauche' | 'haut'>('bas');
  /** Sur grand écran, Solvi vole se poser près de ce qu'il montre : sa place, et de quel côté il arrive. */
  const [pose, setPose] = useState<{ left: number; top: number; cote: 'droite' | 'gauche' | 'dessous' | 'dessus' } | null>(null);
  const [elan, setElan] = useState<'' | 'vers-droite' | 'vers-gauche'>('');
  const guide = useRef<HTMLDivElement>(null);
  const zoneVue = useRef<Zone | null>(null);
  const [allure, setAllure] = useState<Rythme>(rythme);
  /** L'humeur de Solvi suit ce qu'il fait : il explique, clique, écrit, attend un calcul, montre un résultat. */
  const [humeur, setHumeur] = useState<Humeur>('neutre');
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
  // Le tutoriel d'une tâche est terminé ou quitté : on retrouve sa pharmacie, son compte et la rubrique d'aide.
  useEffect(() => {
    if (parcours !== null || !retour) return;
    const r = retour;
    retour = null;
    annulerMinuteries();
    if (r.officineId) store().changerOfficine(r.officineId);
    if (r.session) voirComme(r.session, 'aide');
  }, [parcours]);


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
    setSert('');
    let faits = 0;
    const dernierePas = parcours >= (useUi.getState().tache?.a ?? SCENARIOS[scenario].etapes.length - 1);
    /** Un temps est joué : le suivant s'enchaîne. Après le dernier, on laisse voir le résultat, puis l'étape suivante arrive. */
    const fin = (): void => {
      visee.current = null;
      setClic(false);
      faits++;
      setJoues(faits);
      if (faits < liste.length) {
        setAnnonce(decrire(liste[faits]));
        setSert(utilite(liste[faits]));
        setHumeur('neutre');
        plusTard(() => derouler(liste[faits], 0), tempo(650));
        return;
      }
      // La démonstration de l'étape est finie : Solvi est content du résultat.
      setHumeur('heureux');
      plusTard(() => {
        contexte.current = null;
        if (dernierePas) {
          setPhase('fini');
          noter();
          setOuvert(true);
        } else setParcours(parcours + 1);
      }, tempo(2600));
    };
    /** Joue le geste i du temps en cours, puis le suivant. Un élément introuvable est attendu un instant, puis ignoré. */
    const derouler = (gestes: Geste[], i: number): void => {
      if (i >= gestes.length) return fin();
      const g = gestes[i];
      const suite = (ms: number): void => plusTard(() => derouler(gestes, i + 1), ms);
      if (g.faire === 'pause') {
        // Une pause peut dire ce qu'on regarde pendant qu'elle dure.
        if (g.dit) {
          setAnnonce(g.dit);
          setSert(g.sert ?? '');
          // Il montre un résultat : il s'en réjouit.
          setHumeur('excite');
        }
        return suite(tempo(g.ms));
      }
      if (g.faire === 'action') {
        g.jouer();
        return suite(tempo(900));
      }
      const cible = g.faire === 'cliquer' ? g.sur : g.faire === 'attendre' ? g.que : g.dans;
      let essais = 0;
      const facultatif = 'facultatif' in g && !!g.facultatif;
      const viser = (): void => {
        const el = element(cible);
        if (!el || (el as HTMLButtonElement).disabled) {
          // Une attente qui dure (un calcul) : Solvi réfléchit.
          if (g.faire === 'attendre' && essais === 4) setHumeur('reflechi');
          if (++essais > (g.faire === 'attendre' ? (facultatif ? 14 : 200) : facultatif ? 6 : 14)) {
            // Un geste qui ne trouve pas sa cible est sauté : on le signale, pour qu'une étape ne se vide pas en silence.
            if (facultatif) console.debug(`[visite·facultatif] « ${SCENARIOS[scenario].etapes[parcours]?.titre ?? '?'} » : ${'dit' in g && g.dit ? g.dit : typeof cible === 'string' ? cible : g.faire}`);
            else console.warn(`[visite] geste sauté à l’étape « ${SCENARIOS[scenario].etapes[parcours]?.titre ?? '?'} » : ${g.faire}${'dit' in g && g.dit ? ` (${g.dit})` : typeof cible === 'string' ? ` ${cible}` : ''}`);
            return derouler(gestes, i + 1);
          }
          return plusTard(viser, 150);
        }
        if (g.faire === 'attendre') return suite(350);
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
        visee.current = cible;
        plusTard(() => mesure.current(), 60);
        // Solvi se pose là où il ne cache pas ce qu'il montre : en bas, sinon à gauche, sinon en haut.
        plusTard(() => {
          const r = element(cible)?.getBoundingClientRect();
          if (!r) return;
          const W = window.innerWidth;
          const H = window.innerHeight;
          const touche = (x1: number, y1: number, x2: number, y2: number): boolean => r.left < x2 + 16 && r.right > x1 - 16 && r.top < y2 + 16 && r.bottom > y1 - 16;
          const large = Math.min(560, W - 32);
          const bas = touche(W / 2 - large / 2, H - 170, W / 2 + large / 2, H);
          const gauche = touche(0, H - 190, Math.min(440, W), H);
          setCoin(!bas ? 'bas' : !gauche && W > 900 ? 'gauche' : 'haut');
          // Grand écran : Solvi vole près de ce qu'il montre, à côté de la fenêtre ou du bloc éclairé, sans rien cacher.
          if (W < 900) return setPose(null);
          const w = Math.min(guide.current?.offsetWidth ?? 392, 392);
          const h = guide.current?.offsetHeight ?? 150;
          const z = zoneVue.current ?? { top: r.top, left: r.left, width: r.width, height: r.height };
          const borne = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
          const haut = borne(r.top + r.height / 2 - h / 2, 84, H - h - 16);
          const aligne = borne(r.left - 30, 16, W - w - 16);
          const choix: { left: number; top: number; cote: 'droite' | 'gauche' | 'dessous' | 'dessus'; ok: boolean }[] = [
            { left: z.left + z.width + 18, top: haut, cote: 'droite', ok: z.left + z.width + 18 + w <= W - 12 },
            { left: z.left - 18 - w, top: haut, cote: 'gauche', ok: z.left - 18 - w >= 12 },
            { left: aligne, top: z.top + z.height + 14, cote: 'dessous', ok: z.top + z.height + 14 + h <= H - 12 },
            { left: aligne, top: z.top - 14 - h, cote: 'dessus', ok: z.top - 14 - h >= 84 },
            { left: aligne, top: r.bottom + 18, cote: 'dessous', ok: r.bottom + 18 + h <= H - 12 },
            { left: aligne, top: r.top - 18 - h, cote: 'dessus', ok: r.top - 18 - h >= 84 },
          ];
          const place = choix.find((c) => c.ok) ?? { left: borne(W / 2 - w / 2, 16, W - w - 16), top: H - h - 20, cote: 'dessous' as const };
          setPose((avant) => {
            if (avant && Math.abs(avant.left - place.left) < 6 && Math.abs(avant.top - place.top) < 6) return avant;
            // Il penche dans le sens du trajet, le temps d'arriver.
            if (avant) {
              setElan(place.left > avant.left + 20 ? 'vers-droite' : place.left < avant.left - 20 ? 'vers-gauche' : '');
              plusTard(() => setElan(''), 750);
            }
            return { left: Math.round(place.left), top: Math.round(place.top), cote: place.cote };
          });
        }, 420);
        const aLire = tempsDeLire(`${g.dit ?? decrire([g])} ${g.sert ?? ''}`);
        // Le pointeur glisse jusqu'à la cible, s'y pose, puis agit.
        plusTard(() => {
          setClic(true);
          // Un clin d'œil au moment d'agir ; il se concentre pour écrire.
          setHumeur(g.faire === 'taper' ? 'concentre' : g.faire === 'choisir' ? 'content' : 'confiant');
          plusTard(() => {
            setClic(false);
            const cibleFinale = element(cible);
            if (!cibleFinale) return derouler(gestes, i + 1);
            if (g.faire === 'cliquer') {
              cibleFinale.click();
              // Le temps de voir ce que le clic a changé.
              suite(tempo(1900));
            } else if (g.faire === 'choisir') {
              ecrire(cibleFinale, g.valeur);
              suite(tempo(1700));
            } else {
              cibleFinale.focus();
              const taper = (n: number): void => {
                const champ = element(cible);
                if (!champ) return derouler(gestes, i + 1);
                ecrire(champ, g.texte.slice(0, n));
                if (n >= g.texte.length) return suite(tempo(1300));
                plusTard(() => taper(n + 1), tempo(90));
              };
              taper(1);
            }
          }, 520);
        }, aLire);
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
      setAnnonce(decrire(liste[faits]));
      setSert(utilite(liste[faits]));
      setHumeur('neutre');
      setAllure(rythme);
      setCoin('bas');
      setPose(null);
      // La fiche a le temps de s'effacer avant le premier geste.
      plusTard(() => derouler(liste[faits], 0), 800);
    };
    plusTard(() => {
      const ici = document.querySelector<HTMLElement>('.side .nav-item.on, .tabbar .on');
      const nom = ici ? nomDe(ici) : '';
      setSection((avant) => {
        // On change de rubrique : son entrée dans le menu se signale un instant.
        if (nom && nom !== avant && ici) ici.animate([{ boxShadow: '0 0 0 0 var(--a-2)' }, { boxShadow: '0 0 0 7px transparent' }], { duration: 900, iterations: 2, easing: 'ease-out' });
        return nom;
      });
      noter();
      setOuvert(true);
    }, 520);
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
    let dernierRecadrage = 0;
    const mesurer = (): void => {
      const base = cible ? document.querySelector<HTMLElement>(cible) : null;
      const geste = visee.current ? element(visee.current) : null;
      // Une fenêtre ouverte passe devant tout le reste : c'est elle qu'on éclaire, pas le bloc resté derrière.
      const devant = document.querySelector<HTMLElement>('.overlay .dialog, .overlay .decouvrir, .assistant .aide-panneau');
      const autour = (g: HTMLElement): HTMLElement => g.closest<HTMLElement>('.dialog, .decouvrir, .menu, .aide-panneau') ?? (base?.contains(g) ? base : (g.closest<HTMLElement>('.card, .plan, .panneau, .voies, .side, .bandeau-test, .topbar-in') ?? g));
      // Pendant une démonstration, le projecteur suit le geste ; entre deux gestes, il reste là où l'on travaille.
      if (phase === 'demo' && geste) contexte.current = autour(geste);
      if (devant && contexte.current && !devant.contains(contexte.current) && !contexte.current.closest('.menu')) contexte.current = devant;
      const el = phase === 'demo' ? (contexte.current?.isConnected ? contexte.current : (devant ?? base)) : devant && !(base && devant.contains(base)) ? devant : base;
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
        // Ce que le projecteur éclaire reste à l'écran : s'il sort du champ, la page défile pour le ramener au centre.
        const champ = basMax - haut;
        const suivi = phase === 'demo' && geste?.isConnected ? geste : el;
        const s = suivi.getBoundingClientRect();
        const dehors = s.height > champ - 24 ? s.bottom < haut + 80 || s.top > basMax - 80 : s.top < haut - 2 || s.bottom > basMax + 2;
        if (amene || phase === 'demo') {
          if (dehors && Date.now() - dernierRecadrage > 900) {
            dernierRecadrage = Date.now();
            suivi.scrollIntoView({ block: s.height > champ * 0.8 ? 'start' : 'center', inline: 'nearest', behavior: 'smooth' });
          }
        }
        const m = 8;
        const top = Math.max(haut, r.top - m);
        const bas = Math.min(basMax, r.bottom + m);
        const left = Math.max(6, r.left - m);
        const droite = Math.min(window.innerWidth - 6, r.right + m);
        const z = bas - top > 24 && droite - left > 24 ? { top, left, width: droite - left, height: bas - top } : null;
        zoneVue.current = z;
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
  }, [cible, parcours, scenario, tirage, phase, joues]);

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
  // Tutoriel d'une tâche : la visite s'arrête à la dernière étape de la tâche.
  const debut = tache?.de ?? 0;
  const terme = tache?.a ?? N - 1;
  const dernier = parcours === terme;
  const demonstration = nbTemps > 0;
  /** Il reste un geste à montrer dans cette étape. */
  const reste = demonstration && joues < nbTemps && !libre;
  /** « Suivant » : le prochain geste s'il en reste un, sinon l'étape suivante. */
  const avancer = (): void => {
    if (parcours === null) return;
    if (reste) return demarrer.current();
    if (parcours < terme) setParcours(parcours + 1);
  };
  // Lecture automatique : le temps de lire, un geste, le temps de voir, puis la suite.
  const duree = etape ? Math.min(9000, Math.max(4500, 2200 + etape.texte(data).length * 45)) : 0;
  const attente = phase === 'fini' ? Math.max(3200, duree * 0.6) : duree;
  useEffect(() => {
    if (!lecture || parcours === null || libre || sommaire || phase === 'demo' || !ouvert) return;
    if (!reste && parcours >= terme) return setLecture(false);
    const t = window.setTimeout(() => (reste ? demarrer.current() : setParcours(parcours + 1)), attente);
    return () => window.clearTimeout(t);
  }, [lecture, parcours, libre, sommaire, phase, ouvert, reste, terme, attente, setParcours]);

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
        <div ref={guide} className={`solvi-guide no-print ${pose ? `vole c-${pose.cote}` : coin} ${elan}`} style={pose ? { left: pose.left, top: pose.top } : undefined}>
          {/* Solvi reprend la parole à chaque geste : un petit bond le signale. */}
          <span key={annonce} className="solvi-guide-qui">
            <Solvi size={pose ? 64 : 72} humeur={humeur} />
          </span>
          <div className="solvi-bulle" role="status">
            <span className="solvi-bulle-tete" aria-hidden="true">
              <NomSolvi className="solvi-bulle-nom" />
              {nbTemps > 1 ? (
                <span className="solvi-pas">
                  {Array.from({ length: nbTemps }, (_, i) => (
                    <i key={i} className={i < joues ? 'fait' : i === joues ? 'on' : ''} />
                  ))}
                </span>
              ) : null}
            </span>
            <span key={annonce} className="solvi-dit">
              <b>{annonce || etape.titre}</b>
              {sert ? <span className="solvi-sert">{sert}</span> : null}
            </span>
            <span className="solvi-outils">
              <button
                type="button"
                className="solvi-rythme"
                title="Changer le rythme de la démonstration"
                onClick={() => {
                  const suivant: Rythme = allure === 'pose' ? 'normal' : allure === 'normal' ? 'vif' : 'pose';
                  choisirRythme(suivant);
                  setAllure(suivant);
                }}
              >
                <Gauge size={13} aria-hidden="true" /> Rythme {RYTHMES[allure].nom}
              </button>
              <button type="button" className="solvi-passer" onClick={() => (dernier ? setParcours(null) : setParcours(parcours + 1))}>
                Passer
              </button>
            </span>
          </div>
        </div>
      ) : null}
      <aside ref={panneau} className={`parcours-test no-print${ferme ? ' ferme' : ''}`} aria-label="Parcours guidé" aria-hidden={ferme} {...(ferme ? { inert: '' } : {})} style={place ? { left: place.left, top: place.top, right: 'auto', bottom: 'auto' } : undefined}>
        <div className="row" style={{ gap: 10 }}>
          <span className="pt-solvi" aria-hidden="true">
            <Solvi size={54} humeur={phase === 'fini' ? (dernier ? 'joyeux' : 'heureux') : 'neutre'} />
          </span>
          <div className="grow">
            <div className="eyebrow">
              {tache ? `Tutoriel · ${parcours - debut + 1} sur ${terme - debut + 1}` : `${SCENARIOS[scenario].court} · ${parcours + 1} sur ${N}`}
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
            {etape.chapitre && !tache ? (
              <button type="button" className="pt-chapitre" onClick={() => setSommaire(true)} title="Ouvrir le sommaire">
                <ListTree size={14} aria-hidden="true" /> {etape.chapitre}
                {section && section !== etape.chapitre ? <span className="pt-section">{section}</span> : null}
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
            ) : reste ? (
              <div className="pt-annonce small">
                <MousePointer2 size={15} aria-hidden="true" /> « Suivant » : Solvi vous le montre à l’écran{nbTemps > 1 ? `, en ${nbTemps} gestes` : ''}.
              </div>
            ) : null}
          </div>
        )}
        {!sommaire && !libre ? <ChoixRythme key={`${parcours}-${allure}`} compact /> : null}
        <div className="pt-segments" aria-hidden="true">
          {(tache ? [{ titre: 'Tutoriel', debut, n: terme - debut + 1 }] : chapitres).map((c) => (
            <span key={c.titre} style={{ flexGrow: c.n }}>
              <i style={{ width: `${Math.max(0, Math.min(1, (parcours + 1 - c.debut) / c.n)) * 100}%` }} />
            </span>
          ))}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn sm" disabled={parcours === debut} onClick={() => setParcours(parcours - 1)}>
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
          <ChoixRythme />
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
