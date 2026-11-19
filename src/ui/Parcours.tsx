import { ArrowLeft, ArrowRight, CalendarCheck, Check, CirclePause, CirclePlay, Crown, FlaskConical, Gauge, GraduationCap, ListTree, Megaphone, MousePointer2, Pause, Pill as PillIcon, Play, RotateCcw, Siren, Sparkles, Sprout, Store, Undo2, UserRound, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { libelleRole, peutGerer } from '../domain/acces';
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
import type { GesteSolvi, Humeur } from './Solvi';
import { NomSolvi, Solvi } from './Solvi';

/** Les quatre regards de l'environnement de test, avec des personnes déjà créées. */
export const ROLES_TEST: { cle: string; id: string; identifiant: string; court: string; titre: string; nom: string; detail: string }[] = [
  { cle: 't1', id: 'p_helene', identifiant: 'caroline.tellier', court: 'Titulaire 1', titre: 'Titulaire principale', nom: 'Caroline Tellier', detail: 'Tous les droits : tableau de bord, plannings, équipe, gardes, réglages.' },
  { cle: 't2', id: 'p_antoine', identifiant: 'pierre.fiandino', court: 'Titulaire 2', titre: 'Titulaire secondaire', nom: 'Pierre Fiandino', detail: 'Mêmes écrans que la titulaire principale ; ses décisions attendent son accord.' },
  { cle: 'ph', id: 'p_karim', identifiant: 'igor.lerusse', court: 'Pharmacien', titre: 'Pharmacien', nom: 'Igor Le Russe', detail: 'Son planning, le planning publié, ses gardes, ses messages.' },
  { cle: 'pr', id: 'p_camille', identifiant: 'nicolas.lesyndicaliste', court: 'Préparateur', titre: 'Préparateur', nom: 'Nicolas Le Syndicaliste', detail: 'Ses horaires, ses demandes, les remplacements, ses messages.' },
  { cle: 'an', id: 'p_sarah', identifiant: 'sarah.lemoine', court: 'Animateur', titre: 'Animatrice', nom: 'Sarah Lemoine', detail: 'Son accueil : les marques qu’elle présente, ses jours d’animation, ses rendez-vous.' },
  { cle: 'ap', id: 'p_manon', identifiant: 'manon.girard', court: 'Apprenti', titre: 'Apprentie', nom: 'Manon Girard', detail: 'Son accueil : son alternance, ses jours d’école, le point avec son tuteur.' },
  { cle: 'et', id: 'p_yanis', identifiant: 'yanis.morel', court: 'Étudiant', titre: 'Étudiant', nom: 'Yanis Morel', detail: 'Son accueil : ses horaires autour de ses cours et de ses examens.' },
];

/** Ouvre l'environnement de test dans la peau d'une personne ; l'écran d'arrivée dépend de ses droits. */
export function voirComme(identifiant: string, vue?: Vue): void {
  const { data } = useStore.getState();
  const p = data.personnes.find((x) => x.identifiant === identifiant);
  const gere = peutGerer(data, p);
  useStore.getState().setActeur(p?.id ?? null);
  useUi.getState().setTour(null);
  useUi.getState().connecter(identifiant, vue ?? (gere ? 'tableau' : 'espace'));
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
  copie.querySelectorAll('.sr, small, svg, .small, .soft, .aide, .compte, .nav-badge, .q, select, input, textarea, ol, ul, .modele-nom, .voie-etat, .voie-reponse, .pill').forEach((x) => x.remove());
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
  // Solvi dit ce qu'on fait dans ce champ, pas ce qu'il y tape : sa saisie n'est qu'un exemple (voir `exempleDe`).
  const champ = el ? champDe(el) : '';
  if (g.faire === 'taper') return champ ? `Remplissez « ${champ} »` : 'Remplissez ce champ';
  return champ ? `Choisissez dans la liste « ${champ} »` : 'Choisissez dans la liste';
}
/** Ce que Solvi saisit ou choisit lui-même pendant la démonstration : un exemple, annoncé comme tel. */
function exempleDe(g: GesteVisible): string {
  if (g.faire === 'cliquer') return '';
  const el = element(g.dans);
  if (g.faire === 'taper') return `Pour l’exemple, j’écris « ${g.texte} ».`;
  const option = el instanceof HTMLSelectElement ? [...el.options].find((o) => o.value === g.valeur)?.text : undefined;
  // Une heure ou un nombre réglé dans un champ se lit déjà dans la consigne.
  return option ? `Pour l’exemple, je choisis « ${option} ».` : '';
}
/** À quoi sert le geste visible d'un temps, quand l'étape le dit. */
const utilite = (temps: Geste[] | undefined): string => temps?.find(visible)?.sert ?? '';

/**
 * Le rythme des démonstrations. Il ne change que le temps laissé pour lire et pour regarder : les déplacements
 * (Solvi, le pointeur, le projecteur) gardent la même durée, pour rester lisibles à toute allure.
 */
type Rythme = 'pose' | 'normal' | 'vif';
const RYTHMES: Record<Rythme, { nom: string; facteur: number }> = { pose: { nom: 'posé', facteur: 1.2 }, normal: { nom: 'normal', facteur: 0.92 }, vif: { nom: 'vif', facteur: 0.68 } };
const CLE_RYTHME = 'releve.visite.rythme';
const rythmeLu = (): Rythme => {
  try {
    const r = window.localStorage.getItem(CLE_RYTHME);
    return r === 'pose' || r === 'vif' ? r : 'normal';
  } catch {
    return 'normal';
  }
};
let rythme: Rythme = typeof window === 'undefined' ? 'normal' : rythmeLu();
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
const RYTHME_PHRASE: Record<Rythme, string> = { pose: 'Le temps de tout lire et de tout voir.', normal: 'Le temps de lire, sans attendre.', vif: 'Pour qui connaît déjà.' };

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

/** Un temps de lecture ou d'observation, au rythme choisi. */
const tempo = (ms: number): number => Math.round(ms * RYTHMES[rythme].facteur);
/** Le temps de lire ce que dit Solvi avant qu'il agisse, compté une fois sa bulle ouverte : plus elle est longue, plus il attend. */
const tempsDeLire = (texte: string): number => tempo(Math.min(5000, Math.max(1400, 400 + texte.trim().length * 32)));
/** La couleur du profil de chaque personnage de l'exemple : la pastille qui l'annonce en début de chapitre. */
const TEINTE_DE: Record<string, string> = { 'Caroline · titulaire': '#1f6bb8', 'Nicolas · préparateur': '#3730a3', 'Léa · pharmacienne': '#0a5a63', 'Igor · pharmacien': '#0a5a63', 'Pierre · titulaire secondaire': '#1b4f7f', 'Sarah · animatrice': '#a8326b', 'Manon · apprentie': '#17694a', 'Yanis · étudiant': '#8a5a00' };

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
interface Minuterie {
  id: number;
  /** Ce qu'il reste à attendre : mis à jour quand la démonstration est suspendue. */
  reste: number;
  fin: number;
  lancer: () => void;
}
let minuteries: Minuterie[] = [];
let suspendu = false;
const minuter = (fn: () => void, ms: number): Minuterie => {
  const m: Minuterie = {
    id: 0,
    reste: ms,
    fin: 0,
    lancer: () => {
      m.fin = Date.now() + m.reste;
      m.id = window.setTimeout(() => {
        minuteries = minuteries.filter((x) => x !== m);
        fn();
      }, m.reste);
    },
  };
  minuteries.push(m);
  // Pendant une pause, rien ne part : la minuterie attend la reprise.
  if (!suspendu) m.lancer();
  return m;
};
const plusTard = (fn: () => void, ms: number): void => {
  minuter(fn, ms);
};
const annulerUne = (m: Minuterie): void => {
  window.clearTimeout(m.id);
  minuteries = minuteries.filter((x) => x !== m);
};
const annulerMinuteries = (): void => {
  minuteries.forEach((m) => window.clearTimeout(m.id));
  minuteries = [];
  suspendu = false;
};
/** Pause : chaque attente en cours s'arrête là où elle en est. Reprise : elle repart pour ce qu'il lui restait. */
const suspendre = (): void => {
  if (suspendu) return;
  suspendu = true;
  const t = Date.now();
  minuteries.forEach((m) => {
    window.clearTimeout(m.id);
    m.reste = Math.max(0, m.fin - t);
  });
};
const reprendre = (): void => {
  if (!suspendu) return;
  suspendu = false;
  minuteries.forEach((m) => m.lancer());
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
  // La semaine en cours aussi : sans elle, le tableau de bord et « Mon planning » n'auraient personne aujourd'hui.
  publierSemaine(semaineDans(0));
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
  if (!s.data.absences.some((x) => x.type === 'formation')) s.planifierFormation({ intitule: 'Gestes d’urgence', personnes: ['p_thomas', 'p_ines'], from: jour, to: jour, cadre: 'externe', lieu: 'Centre de formation, à Lyon' });
}

/** Un collègue a prévenu d'un retard sur son poste du jour : la frise du tableau de bord le montre. */
function avecRetard(): void {
  const s = store();
  if (s.data.retards?.some((r) => r.date === s.today)) return;
  const postes = s.data.shifts.filter((x) => x.date === s.today && s.data.semaines[mondayOf(x.date)]?.statut === 'publie').sort((a, b) => b.start - a.start);
  const poste = postes.find((x) => x.personId === 'p_camille') ?? postes.find((x) => x.personId !== 'p_helene' && x.personId !== 'p_antoine');
  if (poste) s.prevenirRetard({ personId: poste.personId, date: s.today, start: poste.start, minutes: 10, motif: 'transport' });
}
/** Un accident du travail signalé ce matin : sa déclaration reste à faire, dans un délai légal. */
function avecAccident(): void {
  const s = store();
  if (s.data.absences.some((a) => a.type === 'accident')) return;
  const qui = ['p_jules', 'p_thomas', 'p_ines'].find((id) => s.data.personnes.some((p) => p.id === id) && !s.data.absences.some((a) => a.personId === id && a.to >= s.today)) ?? 'p_jules';
  s.signalerAbsence({ personId: qui, from: s.today, to: addDays(s.today, 2), type: 'accident', accident: { jour: s.today, ou: 'travail', circonstances: 'Chute dans la réserve, en rangeant une commande.' } });
}

// ---------------------------------------------------------------- Une journée type : la pharmacie tourne déjà

const HELENE = 'Caroline · titulaire';
const CAMILLE = 'Nicolas · préparateur';

/** Un chapitre du récit : son titre, ce qu'on y fait, et ses étapes dans l'ordre où l'histoire les raconte. */
interface Acte {
  chapitre: string;
  but: string;
  etapes: string[];
}
/** Ce qu'on fait dans chaque chapitre, en une phrase : la visite l'annonce avant de commencer. */
const BUTS: Record<string, string> = {};
/** Range les étapes dans l'ordre du récit. Une étape ajoutée sans être rangée ne disparaît pas : elle vient à la fin. */
function raconter(etapes: Etape[], recit: Acte[], strict = false): Etape[] {
  const rangees = recit.flatMap((a) => {
    BUTS[a.chapitre] = a.but;
    return a.etapes
      .map((t) => etapes.find((e) => e.titre === t))
      .filter((e): e is Etape => !!e)
      .map((e) => ({ ...e, chapitre: a.chapitre }));
  });
  // `strict` : la visite ne garde que les étapes nommées ; sinon, celles qui restent suivent, pour n'en perdre aucune.
  if (strict) return rangees;
  const titres = new Set(recit.flatMap((a) => a.etapes));
  return [...rangees, ...etapes.filter((e) => !titres.has(e.titre))];
}

const ETABLI_BRUT: Etape[] = [
  {
    qui: HELENE,
    cible: "[data-focus='cycle']",
    titre: 'Le tableau de bord',
    texte: () => 'Caroline ouvre Solvéa : l’équipe du jour, où en est le planning, et les décisions qui l’attendent.',
    jouer: () => voirComme('caroline.tellier', 'tableau'),
  },
  {
    qui: HELENE,
    cible: "[data-focus='appel']",
    titre: 'L’appel à l’équipe',
    texte: () => 'Un poste reste à couvrir. Tous ceux qui peuvent le tenir sont prévenus ensemble ; celui qui a le moins dépanné passe d’abord.',
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
    texte: () => 'Nicolas voit d’abord son prochain poste. Il vient de demander à être remplacé.',
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
    texte: () => 'La demande arrive en tête du planning d’un collègue. Se proposer n’engage à rien : la titulaire valide.',
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
    texte: () => 'Solvéa relit les règles et annonce les heures en plus. Un clic de Caroline valide le remplacement.',
    jouer: () => {
      useUi.getState().setSujet('remplacements');
      voirComme('caroline.tellier', 'resoudre');
    },
  },
  {
    qui: CAMILLE,
    cible: '.sh-cal',
    titre: 'Mes préférences',
    texte: () => 'Nicolas indique une forme d’horaire par jour. « M’assister » complète le reste du mois.',
    jouer: () => versDemandes('nicolas.lesyndicaliste', 'souhaits'),
  },
  {
    qui: 'Igor · pharmacien',
    cible: '.content .card',
    titre: 'Ses gardes',
    texte: () => 'Igor retrouve ses gardes, le repos qui suit et ses récupérations. Il n’a pas accès à la gestion.',
    jouer: () => voirComme('igor.lerusse', 'mesgardes'),
  },
  {
    qui: 'Pierre · titulaire secondaire',
    cible: '.panneau',
    titre: 'Décider à deux',
    texte: () => 'Pierre, second titulaire, a les mêmes écrans que Caroline. Sa décision attend son accord.',
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
    texte: () => 'Caroline accepte ou refuse la décision de Pierre. Il est prévenu aussitôt.',
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
    texte: () => 'Sous chaque date, « Voir la journée » montre toute l’équipe sur une ligne de temps : pauses et retards.',
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
    texte: () => '« Proposer un planning » calcule trois semaines complètes et comparables. C’est vous qui choisissez.',
    jouer: () => {
      voirComme('caroline.tellier', 'construire');
      // L'exemple a deux semaines publiées d'avance : la semaine à construire est la troisième.
      useUi.getState().setSemaine(addDays(mondayOf(store().today), 21));
    },
    gestes: [
      { faire: 'cliquer', sur: "[data-tour='proposer']", sert: 'Solvéa calcule trois plannings complets pour la semaine.' },
      { faire: 'attendre', que: '.dialog .variant' },
      { faire: 'pause', ms: 3600, dit: 'Trois plannings à comparer : équité, préférences, contrats' },
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
    texte: () => 'La vue « Mois » réunit l’objectif de l’équipe, les heures de chacun face à son contrat et les préférences données.',
    jouer: () => {
      voirComme('caroline.tellier', 'construire');
      useUi.getState().setPlanVue('mois');
    },
  },
  {
    qui: HELENE,
    cible: "[data-focus='compteurs-heures']",
    titre: 'Le compteur d’heures',
    texte: () => 'Heures en plus ou en moins. Vous choisissez où et quand les faire rattraper, ou vous laissez Solvéa régulariser.',
    jouer: () => voirComme('caroline.tellier', 'heures'),
    gestes: [
      { faire: 'cliquer', sur: "[data-regul='rattrapage']", dit: 'Cliquez sur « Faire rattraper »', sert: 'Une fenêtre s’ouvre sur le planning de la personne : vous gardez la main sur le jour et l’horaire.', facultatif: true },
      { faire: 'attendre', que: '.dialog .rat-pl', facultatif: true },
      { faire: 'cliquer', sur: () => document.querySelector<HTMLElement>('.rat-pl-ligne:not(.vise):not(.passe) .rat-pl-case'), dit: 'Cliquez sur une plage libre du planning', sert: 'Les heures se placent là, collées au poste voisin. Solvéa contrôle aussitôt le créneau avec les règles.', facultatif: true },
      { faire: 'cliquer', sur: '#rat-auto', dit: 'Cliquez sur « Laisser Solvéa choisir »', sert: 'Solvéa reprend son meilleur créneau : aucune règle enfreinte, là où le comptoir en a besoin.', facultatif: true },
      { faire: 'cliquer', sur: '#rat-valider', dit: 'Cliquez sur « Planifier et prévenir »', sert: 'Le planning est mis à jour, et le message part à la personne.', facultatif: true },
    ],
  },
  // ---- Une journée sous tension
  {
    qui: HELENE,
    cible: '.panneau',
    titre: 'Un arrêt ce matin',
    texte: (d) => `${absent(d)} est en arrêt depuis ce matin. « Résoudre » liste chaque poste laissé libre, jour par jour : ce qui manque, et les façons de le couvrir.`,
    jouer: () => {
      useUi.getState().setSujet('absences');
      voirComme('caroline.tellier', 'resoudre');
    },
  },
  {
    qui: HELENE,
    cible: '.panneau',
    cibleFin: '.panneau',
    titre: 'Choisir une solution',
    texte: (d) => (d.trous.some((t) => t.statut === 'ouvert') ? 'Pour chaque jour, la solution conseillée est cochée : un collègue qui allonge sa journée, un remplaçant, ou accepter le manque. Vous gardez la main.' : 'Réglé : chaque jour a sa solution. Le planning publié est à jour et chacun est prévenu.'),
    jouer: () => {
      useUi.getState().setSujet('absences');
      voirComme('caroline.tellier', 'resoudre');
    },
    gestes: [
      { faire: 'cliquer', sur: parTexte('.panneau button', 'Voir et choisir la solution'), sert: 'Solvéa montre comment régler chaque jour, option par option.', facultatif: true },
      { faire: 'attendre', que: '.rs-jour', facultatif: true },
      { faire: 'cliquer', sur: '.dialog-foot .btn.primary', sert: 'Les changements sont appliqués au planning publié, et annoncés aux personnes concernées.', facultatif: true },
    ],
  },
  {
    qui: CAMILLE,
    cible: '.prochain',
    cibleFin: '.prochain',
    titre: 'Un retard annoncé',
    texte: () => 'Nicolas est retenu sur la route. Deux gestes suffisent : 5, 10, 15 minutes, ou plus de 20. Ses titulaires reçoivent aussitôt une notification et un message, avec son heure d’arrivée.',
    jouer: () => voirComme('nicolas.lesyndicaliste', 'espace'),
    gestes: [
      { faire: 'cliquer', sur: '#ret-prevenir', sert: 'Le bouton est sous son prochain poste, aujourd’hui ou demain.', facultatif: true },
      { faire: 'cliquer', sur: parTexte('#ret-durees .comp', '10 min'), dit: 'Touchez « 10 min »', sert: 'L’heure d’arrivée se calcule toute seule.', facultatif: true },
      { faire: 'cliquer', sur: '#ret-envoyer', sert: 'Les titulaires sont prévenus. L’avis reste affiché : il se corrige ou s’annule.', facultatif: true },
    ],
  },
  {
    qui: HELENE,
    cible: '.tb-jour',
    titre: 'Le retard, vu du comptoir',
    texte: () => 'Caroline n’a rien à ressaisir : sur la frise du jour, l’étiquette « Retard » apparaît sous le nom, avec l’heure d’arrivée. Le trait bleu marque l’heure qu’il est.',
    jouer: () => {
      avecRetard();
      voirComme('caroline.tellier', 'tableau');
    },
  },
  {
    qui: HELENE,
    cible: '#tb-declarer',
    titre: 'Un accident du travail',
    texte: () => 'Un accident signalé ouvre un délai légal de déclaration à la caisse d’assurance maladie. Solvéa le rappelle en tête du tableau de bord jusqu’à ce que vous notiez « C’est fait ».',
    jouer: () => {
      avecAccident();
      voirComme('caroline.tellier', 'tableau');
    },
    gestes: [{ faire: 'cliquer', sur: '[data-declare]', dit: 'Cliquez sur « C’est fait »', sert: 'Le rappel est retiré : la déclaration est notée au dossier.', facultatif: true }],
  },
  {
    qui: HELENE,
    cible: '.content',
    titre: 'Prévenir l’équipe',
    texte: () => 'Un mot à une personne ou à tous : les messages restent dans Solvéa, à côté du planning. Chaque décision y laisse aussi sa trace.',
    jouer: () => voirComme('caroline.tellier', 'messages'),
  },
  {
    qui: HELENE,
    cible: "[data-focus='annonces']",
    titre: 'Les décisions du jour',
    texte: () => 'Le soir, tout est écrit : chaque décision prise, et ce qu’elle a changé aux plannings. Les personnes concernées ont été prévenues au moment même.',
    jouer: () => voirComme('caroline.tellier', 'tableau'),
  },
  // ---- Une veille de publication
  {
    qui: HELENE,
    cible: "[data-focus='echeance'], [data-focus='cycle']",
    titre: 'L’échéance du mois',
    texte: () => 'Le planning se transmet au mois. Solvéa calcule la date limite et la rappelle ici. Passé ce jour, il peut préparer les semaines vides en brouillon d’après vos habitudes : rien n’est publié sans vous.',
    jouer: () => voirComme('caroline.tellier', 'tableau'),
  },
  {
    qui: HELENE,
    cible: '.plan-bar',
    cibleFin: '.plan-bar',
    titre: 'Publier la semaine',
    texte: (d) => (d.semaines[addDays(mondayOf(store().today), 21)]?.statut === 'publie' ? 'C’est publié : toute l’équipe voit la semaine, et le message dit quand elle commence.' : 'Un dernier contrôle, les accords à recueillir, puis l’envoi à l’équipe.'),
    jouer: () => {
      const semaine = addDays(mondayOf(store().today), 21);
      proposerSemaine(semaine);
      enBrouillon(semaine);
      voirComme('caroline.tellier', 'construire');
      useUi.getState().setPlanVue('semaine');
      useUi.getState().setSemaine(semaine);
    },
    gestes: [
      { faire: 'cliquer', sur: "[data-focus='publier']", sert: 'Solvéa relit les règles et les délais avant d’envoyer.' },
      { faire: 'attendre', que: '.dialog' },
      { faire: 'cliquer', sur: parTexte('.dialog button', 'Tout cocher'), facultatif: true, sert: 'Les accords à recueillir sont notés d’un seul geste.' },
      { faire: 'cliquer', sur: VALIDER, sert: 'Toute l’équipe voit maintenant sa semaine.' },
      { faire: 'action', jouer: () => publierSemaine(addDays(mondayOf(store().today), 21)) },
    ],
  },
  {
    qui: CAMILLE,
    cible: '.me',
    titre: 'L’équipe reçoit son planning',
    texte: () => 'Dès la publication, chacun lit sa semaine dans « Mon planning » et reçoit une annonce. Personne ne voit jamais un brouillon.',
    jouer: () => {
      publierSemaine(addDays(mondayOf(store().today), 21));
      voirComme('nicolas.lesyndicaliste', 'moi');
    },
  },
  {
    qui: HELENE,
    cible: '.content',
    titre: 'L’équité du mois',
    texte: () => 'Samedis, fermetures, gardes, dépannages : qui a porté quoi, face à sa part. Un clic sur une ligne détaille ce qui est compté et d’où vient la part attendue.',
    jouer: () => voirComme('caroline.tellier', 'equite'),
    gestes: [{ faire: 'cliquer', sur: '.eq-detail summary', dit: 'Cliquez sur une ligne', sert: 'Le détail s’ouvre : les dates comptées, et le calcul de la part.', facultatif: true }],
  },
  {
    qui: HELENE,
    cible: '.content',
    titre: 'Ce qui part en paie',
    texte: () => 'Le journal garde chaque publication et chaque décision. L’export du mois reprend les heures, les absences et les gardes pour la paie.',
    jouer: () => voirComme('caroline.tellier', 'journal'),
  },
];

/** Une journée ordinaire, du matin au soir : chaque chapitre est un moment de la journée, avec ceux qui le vivent. */
const ETABLI: Etape[] = raconter(
  ETABLI_BRUT,
  [
    { chapitre: 'Le matin : l’équipe du jour', but: 'Caroline ouvre Solvéa : qui est là, quel poste reste à couvrir, qui est en pause ou en retard.', etapes: ['Le tableau de bord', 'L’appel à l’équipe', 'Pauses et retards'] },
    { chapitre: 'Un remplacement entre collègues', but: 'Nicolas ne peut pas tenir un poste. Il demande, un collègue se propose, Caroline valide.', etapes: ['Ses horaires', 'Un collègue se propose', 'Valider'] },
    { chapitre: 'Chacun son espace', but: 'Le même Solvéa, vu par un préparateur, un pharmacien et l’autre titulaire.', etapes: ['Mes préférences', 'Ses gardes', 'Décider à deux', 'Donner son accord'] },
    { chapitre: 'Le soir : préparer la suite', but: 'Caroline construit la semaine à venir, regarde le mois et solde les heures.', etapes: ['Construire', 'Le mois', 'Le compteur d’heures'] },
  ],
  true,
);

/** Une journée sous tension : un arrêt le matin, un retard, un accident du travail. Tout se règle, et tout le monde est prévenu. */
const TENSION: Etape[] = raconter(
  ETABLI_BRUT,
  [
    { chapitre: 'Le matin : un arrêt', but: 'Un pharmacien est en arrêt depuis ce matin. Caroline voit ce qui manque, appelle l’équipe et choisit une solution pour chaque jour.', etapes: ['Le tableau de bord', 'Un arrêt ce matin', 'L’appel à l’équipe', 'Choisir une solution'] },
    { chapitre: 'Dans la journée : les aléas', but: 'Un retard annoncé depuis la route, une pause à décaler, un accident du travail à déclarer.', etapes: ['Un retard annoncé', 'Le retard, vu du comptoir', 'Pauses et retards', 'Un accident du travail'] },
    { chapitre: 'Le soir : tout le monde est prévenu', but: 'Chaque décision a été annoncée à ceux qu’elle concerne. Caroline relit la journée.', etapes: ['Prévenir l’équipe', 'Les décisions du jour'] },
  ],
  true,
);

/** Une veille de publication : l'échéance du mois approche, on construit, on publie, on fait le bilan. */
const PUBLICATION: Etape[] = raconter(
  ETABLI_BRUT,
  [
    { chapitre: 'Le matin : l’échéance approche', but: 'Le planning du mois doit partir. Solvéa rappelle la date, et l’équipe a donné ses préférences.', etapes: ['L’échéance du mois', 'Mes préférences'] },
    { chapitre: 'L’après-midi : construire et publier', but: 'Caroline compare trois propositions, relit le mois, publie. L’équipe reçoit aussitôt son planning.', etapes: ['Construire', 'Le mois', 'Publier la semaine', 'L’équipe reçoit son planning'] },
    { chapitre: 'Le soir : le bilan', but: 'Les heures de chacun, l’équité entre collègues, et ce qui part en paie.', etapes: ['Le compteur d’heures', 'L’équité du mois', 'Ce qui part en paie'] },
  ],
  true,
);

// ---------------------------------------------------------------- Visite du titulaire : la vie d'un planning, de la création au bilan

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
    texte: () => 'Tout commence ici : vous donnez un nom à votre pharmacie, puis ses horaires et son équipe. Dans cette visite, on part de zéro.',
    jouer: () => helene('nouvelle'),
    gestes: [{ faire: 'taper', dans: '#officine-nom', texte: 'Grande Pharmacie de la Pinède', dit: 'Donnez un nom à votre pharmacie', sert: 'Il s’affiche en haut de l’écran et sur les plannings imprimés.' }],
  },
  {
    chapitre: PREPARER,
    qui: HELENE,
    cible: '.content .split',
    titre: 'Horaires et effectif',
    texte: () => 'Vous réglez les horaires d’ouverture, jour par jour. À côté, vous indiquez combien de personnes vous attendez au comptoir.',
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
    texte: () => 'Deux façons de faire. « Avec l’équipe », chacun dit ce qui l’arrange avant que vous construisiez. « Vous seul », vous construisez directement. Sous le choix, Solvéa écrit ce que cela change pour l’équipe et pour vous.',
    jouer: () => helene('officine'),
    gestes: [
      { faire: 'cliquer', sur: parTexte("[data-focus='modele'] label", 'Vous seul'), sert: 'Vous construisez directement, sans recueillir de préférences.' },
      { faire: 'pause', ms: 2600, dit: 'Dessous : ce que ce choix change', sert: 'Pour l’équipe, la carte « Mes préférences » disparaît. Pour vous, plus de date limite à attendre.' },
      { faire: 'cliquer', sur: parTexte("[data-focus='modele'] label", 'Avec l’équipe'), sert: 'L’équipe reçoit une carte « Mes préférences » ; vos propositions de planning en tiennent compte.' },
      { faire: 'pause', ms: 2600, dit: 'Avec l’équipe, le planning se prépare à plusieurs', sert: 'Chacun dit ce qui l’arrange jusqu’à la date limite ; le tableau de bord compte les préférences reçues.' },
    ],
  },
  {
    chapitre: PREPARER,
    qui: HELENE,
    cible: '.content .split > :first-child',
    titre: 'Ajouter l’équipe',
    texte: (d) => (d.personnes.length > 2 ? `Votre équipe compte ${d.personnes.length} personnes, rangées par fonction. Chacune a sa couleur et son compte.` : 'Vous ajoutez vos collaborateurs un par un : prénom, nom, fonction, heures du contrat. Regardez.'),
    jouer: () => helene('equipe'),
    gestes: [
      { faire: 'cliquer', sur: "[data-focus='ajouter-personne']", sert: 'Ce bouton ouvre la fiche d’une nouvelle personne.' },
      { faire: 'taper', dans: '#personne-prenom', texte: 'Sarah', dit: 'Saisissez le prénom de votre collaborateur', sert: 'Il apparaît sur chaque ligne du planning. Ici, inventons une personne.' },
      { faire: 'taper', dans: '#personne-nom', texte: 'Lemoine', dit: 'Puis son nom', sert: 'Il sert aussi à créer son identifiant de connexion.' },
      { faire: 'choisir', dans: '#personne-fonction', valeur: 'animateur', dit: 'Choisissez sa fonction dans la liste déroulante', sert: 'Titulaire, pharmacien, préparateur, animateur… La fonction fixe sa couleur et ce qu’il peut tenir seul.' },
      { faire: 'taper', dans: '#personne-heures', texte: '21', dit: 'Indiquez les heures de son contrat, par semaine', sert: 'Elles servent au compteur d’heures et à l’équité.' },
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
    texte: () => 'La fiche réunit le contrat, les compétences et diplômes, et le compte de connexion. Un clic suffit pour cocher une compétence.',
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
    cible: "[data-focus='marques']",
    titre: 'Les marques d’une animatrice',
    texte: () => 'Pour une animatrice, vous choisissez les marques qu’elle présente, et pour quelles familles de produits. Elle les retrouve sur son accueil.',
    jouer: () => {
      avecEquipe();
      helene('equipe');
      useUi.getState().ouvrirPersonne('p_sarah');
    },
    gestes: [
      { faire: 'cliquer', sur: "[data-focus='marques'] .mq .mq-types button[aria-pressed='false']", dit: 'Touchez une famille de produits', sert: 'Sarah présente désormais cette marque pour cette famille aussi.' },
      { faire: 'taper', dans: '#mq-nom', texte: 'NHCO', dit: 'Une marque absente du répertoire ? Écrivez son nom', sert: 'Tel qu’on le dit au comptoir.' },
      { faire: 'cliquer', sur: '#mq-ajouter', sert: 'La marque rejoint le répertoire de la pharmacie : elle se proposera aux autres animateurs.' },
      { faire: 'cliquer', sur: "[data-focus='marques'] .mq:last-child .mq-types button", dit: 'Choisissez sa première famille de produits', sert: 'Une marque sans famille n’apparaît pas encore sur l’accueil de Sarah.' },
    ],
  },
  {
    chapitre: PREPARER,
    qui: HELENE,
    cible: '.content .card',
    titre: 'Les règles',
    texte: () => 'Durées de travail, repos, pauses, délais : chaque contrôle indique sa source. C’est ici que vous réglez vos seuils.',
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
    texte: () => 'Nicolas indique ce qui l’arrange : il choisit une forme d’horaire, puis touche les jours. « M’assister » complète le reste.',
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
    texte: () => 'Voici la grille de la semaine : une ligne par personne, une colonne par jour, les fonctions regroupées.',
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
    texte: () => 'Le « + » d’une case ouvre un poste : vous réglez ses horaires, sa pause et son activité, puis vous enregistrez.',
    jouer: () => {
      avecSouhaits();
      semaineUne();
    },
    gestes: [
      { faire: 'cliquer', sur: '.plan-grid .add', dit: 'Cliquez sur le « + » d’une case', sert: 'Il ouvre un poste pour cette personne, ce jour-là.' },
      { faire: 'attendre', que: '.dialog' },
      { faire: 'cliquer', sur: parTexte('.dialog .ptc', 'Ouverture'), dit: 'Cliquez sur le poste type « Ouverture »', sert: 'Un poste type remplit les horaires et la pause d’un seul geste.', facultatif: true },
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
    texte: () => 'Solvéa calcule trois plannings complets : l’un privilégie l’équité, l’autre les préférences, le dernier le respect des contrats. Les règles passent toujours avant. Vous comparez, puis vous choisissez.',
    jouer: () => {
      avecSouhaits();
      semaineUne();
    },
    gestes: [
      { faire: 'cliquer', sur: "[data-tour='proposer']", sert: 'Solvéa va calculer trois plannings complets pour la semaine.' },
      { faire: 'attendre', que: '.dialog' },
      // Un poste a été posé à la main à l'étape précédente : la fenêtre demande d'abord quoi en faire.
      { faire: 'cliquer', sur: parTexte('.dialog label.check', 'Conserver les postes déjà posés'), facultatif: true, dit: 'Cochez « Conserver les postes déjà posés »', sert: 'Le poste posé à la main est gardé ; le calcul complète autour.' },
      { faire: 'cliquer', sur: parTexte('.dialog .btn', 'Calculer les propositions'), facultatif: true, dit: 'Cliquez sur « Calculer les propositions »', sert: 'Les règles impératives passent toujours avant le reste.' },
      { faire: 'attendre', que: '.dialog .variant' },
      // Le temps de lire les trois propositions côte à côte.
      { faire: 'pause', ms: 3600, dit: 'Trois plannings à comparer : équité, préférences, contrats' },
      { faire: 'cliquer', sur: nieme('.dialog .variant', 1), dit: 'Comparez : « Préférences d’abord »', sert: 'Elle suit le plus de préférences possible.' },
      { faire: 'pause', ms: 1400 },
      { faire: 'cliquer', sur: nieme('.dialog .variant', 2), dit: 'Comparez : « Contrats d’abord »', sert: 'Elle évite les heures au-delà des contrats.' },
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
    texte: () => 'La semaine est remplie. La couleur dit le moment de la journée : jaune le matin, bleu la journée, violet l’après-midi. Chaque tuile se déplace ou se corrige.',
    jouer: () => {
      avecSouhaits();
      proposerSemaine(semaineDans(1));
      semaineUne();
    },
    gestes: [
      { faire: 'cliquer', sur: parTexte('.plan-bar .seg button', 'Équité'), sert: 'La colonne de droite montre les samedis et les fermetures de chacun, face à sa part.' },
      { faire: 'cliquer', sur: parTexte('.plan-bar .seg button', 'Heures'), sert: 'Retour aux heures de la semaine, face au contrat.' },
      { faire: 'cliquer', sur: '.plan-grid .tile', dit: 'Cliquez sur une tuile', sert: 'Un poste s’ouvre pour être corrigé ou supprimé.' },
      { faire: 'attendre', que: '.dialog' },
      { faire: 'cliquer', sur: parTexte('.dialog .ptc', 'Journée longue'), dit: 'Cliquez sur le poste type « Journée longue »', sert: 'Les horaires et la pause changent d’un coup.', facultatif: true },
      { faire: 'cliquer', sur: VALIDER, sert: 'La tuile change de couleur avec son horaire.' },
      { faire: 'cliquer', sur: () => document.querySelector<HTMLElement>('[aria-label="Annuler la dernière manipulation"]'), dit: 'Cliquez sur « Annuler »', sert: 'Chaque manipulation de la grille peut être annulée, puis rétablie.' },
    ],
  },
  {
    chapitre: PLANIFIER,
    qui: HELENE,
    cible: "[data-tour='controles']",
    titre: 'Les contrôles',
    texte: () => 'Solvéa relit le planning : ce qui bloque, et ce qui mérite votre attention. Un clic vous montre la personne et le jour concernés.',
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
    texte: () => 'La vue « Mois » montre quatre semaines d’un coup d’œil : les horaires, l’équipe au complet ou non, les heures de chacun et les préférences reçues.',
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
    texte: () => 'Sous chaque date, « Voir la journée » montre toute l’équipe sur une ligne de temps. Vous y réglez les pauses et notez les retards.',
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
      { faire: 'choisir', dans: () => document.querySelector<HTMLElement>('.dialog select[id^="ecart-min-"]'), valeur: '15', dit: 'Choisissez la durée du retard', sert: 'Une date et une durée, jamais une raison.', facultatif: true },
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
    texte: () => 'Ce bouton ouvre un aperçu avant impression : la semaine ou le mois, en couleur ou en noir et blanc, avec les pauses. Chacun peut aussi imprimer son propre planning.',
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
    texte: () => 'Vous ajoutez une garde et la confiez à un pharmacien : il est prévenu. Le délai de prévenance et le repos qui suit sont contrôlés.',
    jouer: () => {
      avecPlanning();
      helene('gardes');
    },
    gestes: [
      { faire: 'cliquer', sur: parTexte('.content button', 'Ajouter une garde'), sert: 'On ajoute la garde du secteur : sa date et son type.' },
      { faire: 'choisir', dans: '#garde-personne', valeur: 'p_lea', dit: 'Choisissez le pharmacien de garde dans la liste', sert: 'Il est prévenu dans son espace.' },
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
    texte: () => 'Depuis « Créer », vous planifiez une formation : son intitulé, ses dates, ses participants. Chacun est prévenu.',
    jouer: () => {
      avecPlanning();
      helene('construire');
      useUi.getState().setSemaine(semaineDans(2));
    },
    gestes: [
      { faire: 'cliquer', sur: '.top-creer', sert: '« Créer » réunit tout ce que l’on peut ajouter.' },
      { faire: 'cliquer', sur: parTexte('.outils .menu button', 'Une formation'), sert: 'On ouvre la fenêtre de la formation.' },
      { faire: 'taper', dans: '#formation-intitule', texte: 'Gestes d’urgence', dit: 'Donnez un intitulé à la formation', sert: 'Il apparaîtra dans le planning des participants.' },
      { faire: 'cliquer', sur: 'label[for="formation-externe"]', dit: 'Précisez : formation interne ou externe', sert: 'Interne, elle a lieu à la pharmacie. Externe, dans un organisme.' },
      { faire: 'taper', dans: '#formation-lieu', texte: 'Centre de formation, à Lyon', dit: 'Indiquez le lieu', sert: 'Les participants le lisent dans leur espace, avec les dates.' },
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
    texte: () => 'Même principe pour un inventaire : une date, un horaire, les personnes mobilisées. Il compte dans leurs heures.',
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
    texte: () => 'Voici ce que voit Nicolas : son prochain poste en grand, puis sa semaine. Il ne voit jamais un brouillon.',
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
    texte: () => 'Le calendrier montre le mois entier, avec les horaires dans chaque case.',
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
    texte: () => 'Chacun voit qui travaille quand. « Mes postes » ne garde que sa propre ligne.',
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
    texte: () => '« Mes demandes » tient en trois cartes : mes préférences, une absence ou un horaire, un remplacement.',
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
    texte: () => 'Un raccourci remplit les horaires et la raison. Une raison est toujours demandée : seuls les titulaires la voient.',
    jouer: () => {
      avecPlanning();
      versDemandes('nicolas.lesyndicaliste', 'absences');
      useUi.getState().agir('demandes', 'demande');
    },
    gestes: [
      { faire: 'attendre', que: '.dialog' },
      { faire: 'cliquer', sur: parTexte('.dialog button', 'Sortie d’école'), sert: 'Le raccourci remplit les horaires et la raison ; on peut tout ajuster.' },
      { faire: 'choisir', dans: '#demande-motif', valeur: 'famille', dit: 'Choisissez la raison dans la liste', sert: 'Seuls les titulaires la voient.' },
      { faire: 'taper', dans: '#demande-precision', texte: 'Sortie à 16 h 30', dit: 'Ajoutez une précision, si vous le souhaitez', sert: 'Elle n’est pas obligatoire.' },
      { faire: 'cliquer', sur: VALIDER, sert: 'La demande part au titulaire, qui répond.' },
    ],
  },
  {
    chapitre: EQUIPE,
    qui: CAMILLE,
    cible: "[data-focus='remplacer']",
    cibleFin: "[data-focus='remplacer']",
    titre: 'Se faire remplacer',
    texte: () => 'Nicolas indique un motif et un niveau d’urgence, puis s’adresse à toute l’équipe ou à un collègue. La titulaire décide.',
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
      { faire: 'choisir', dans: '#rempl-motif', valeur: 'famille', dit: 'Choisissez le motif dans la liste', sert: 'Un motif est toujours demandé ; seuls les titulaires le voient.' },
      { faire: 'cliquer', sur: VALIDER, sert: 'La demande part au titulaire, qui décide.' },
    ],
  },
  {
    chapitre: EQUIPE,
    qui: 'Léa · pharmacienne',
    cible: '.content .card',
    titre: 'Mes gardes',
    texte: () => 'Léa retrouve ses gardes, le repos qui suit chacune, et ce qui part en paie.',
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
    texte: () => 'Son compteur d’heures, ce qui a été noté, sa part des contraintes de l’équipe. Aucun classement entre collègues.',
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
    gestes: [
      { faire: 'cliquer', sur: parTexte('.demande-r button', 'Décider'), sert: 'Une fenêtre réunit ce qu’il faut pour trancher, au lieu d’un simple oui ou non.' },
      { faire: 'attendre', que: '.dialog .dr' },
      { faire: 'pause', ms: 3200, dit: 'Tout est là pour décider', sert: 'La demande et sa raison, qui peut reprendre le poste, et ce qui se passe au comptoir s’il n’est pas repris.' },
      { faire: 'cliquer', sur: 'label[for="dr-equipe"]', dit: 'Choisissez « Accepter et prévenir l’équipe »', sert: 'Vous pourriez aussi confier le poste tout de suite, ou refuser en donnant la raison.', facultatif: true },
      { faire: 'cliquer', sur: '#dr-confirmer', sert: 'Tous ceux qui peuvent tenir le poste sont prévenus ensemble.', facultatif: true },
    ],
  },
  {
    chapitre: SUIVRE,
    qui: 'Un collègue',
    cible: "[data-focus='aider']",
    cibleFin: "[data-focus='aider']",
    titre: 'Un collègue se propose',
    texte: () => 'La demande apparaît en tête du planning des collègues qui peuvent la reprendre. Se proposer n’engage à rien : la titulaire valide.',
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
    gestes: [
      { faire: 'cliquer', sur: parTexte('.demande-r.u-medical button', 'Décider'), sert: 'Une demande médicale se traite toujours en premier.' },
      { faire: 'attendre', que: '.dialog .dr' },
      { faire: 'cliquer', sur: 'label[for="dr-equipe"]', dit: 'Choisissez « Accepter et prévenir l’équipe »', sert: 'Le justificatif est conservé pour les seuls titulaires.', facultatif: true },
      { faire: 'cliquer', sur: '#dr-confirmer', sert: 'L’équipe disponible est prévenue aussitôt.', facultatif: true },
    ],
  },
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: '.panneau',
    titre: 'Congés et horaires',
    texte: () => 'Jules demande un congé. Avant de répondre, vous voyez ce que son absence découvrirait.',
    jouer: () => {
      avecPlanning();
      const s = store();
      if (!s.data.absences.some((x) => x.personId === 'p_jules' && x.type === 'conge')) s.declarerAbsence({ motif: 'famille', personId: 'p_jules', from: addDays(semaineDans(4), 0), to: addDays(semaineDans(4), 4), type: 'conge', statut: 'demandee' });
      useUi.getState().setSujet('demandes');
      helene('resoudre');
    },
    gestes: [
      { faire: 'cliquer', sur: parTexte('.panneau button', 'Décider'), sert: 'Une demande ne se tranche pas d’un clic : la fenêtre montre d’abord ce qu’elle implique.' },
      { faire: 'attendre', que: '.dialog #dc-implications' },
      { faire: 'pause', ms: 3200, dit: 'Ce que cette absence implique', sert: 'Les postes déjà planifiés sur ces dates, ce qui manquerait au comptoir, et qui d’autre est absent.' },
      { faire: 'cliquer', sur: 'label[for="dc-accepter"]', dit: 'Choisissez « Accepter la demande »', sert: 'Vous pourriez aussi refuser en donnant la raison, ou en parler d’abord avec Jules.', facultatif: true },
      { faire: 'cliquer', sur: '#dc-confirmer', sert: 'L’absence est enregistrée ; les postes à couvrir vont dans « Résoudre ».', facultatif: true },
    ],
  },
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: '.content .fc',
    titre: 'Deux demandes sur les mêmes dates',
    texte: () => 'Inès et Thomas demandent les mêmes jours. La frise le montre et chaque demande le signale : à vous de répondre aux deux.',
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
      { faire: 'cliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.panneau .decision')].find((e) => /Inès/.test(e.textContent ?? ''))?.querySelector<HTMLElement>('button[data-decider]'), dit: 'Cliquez sur « Décider », sur la demande d’Inès', sert: 'La fenêtre montre ce que l’absence implique avant toute décision.' },
      { faire: 'attendre', que: '.dialog #dc-implications' },
      { faire: 'cliquer', sur: 'label[for="dc-refuser"]', dit: 'Choisissez « Refuser »', sert: 'Un refus se motive : la raison part avec le message.' },
      { faire: 'choisir', dans: '#dc-raison', valeur: 'Plusieurs absences déjà prévues', dit: 'Choisissez la raison du refus dans la liste', sert: 'Une liste, pour rester factuel.' },
      { faire: 'taper', dans: '#dc-mot', texte: 'La semaine suivante serait possible.', dit: 'Ajoutez un mot, si vous le souhaitez', sert: 'Il peut proposer une autre solution.' },
      { faire: 'cliquer', sur: '#dc-confirmer', sert: 'Le message part à la personne ; son planning ne change pas.' },
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
    texte: () => 'Pierre, second titulaire, a les mêmes écrans que Caroline. Sa décision attend l’accord de Caroline avant d’être appliquée.',
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
    texte: () => 'La messagerie réunit un fil pour toute l’équipe et des conversations privées.',
    jouer: () => {
      avecEquipe();
      helene('messages');
    },
    gestes: [
      { faire: 'taper', dans: '#msg-texte', texte: 'Planning publié pour deux semaines.', dit: 'Écrivez votre message', sert: 'Pour toute l’équipe, ou pour une seule personne.' },
      { faire: 'cliquer', sur: parTexte('.content button', 'Envoyer'), sert: 'Il arrive aussitôt dans l’espace de chacun.' },
    ],
  },
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: "[data-focus='compteurs-heures']",
    titre: 'Le compteur d’heures',
    texte: () => 'Le compteur compare les heures publiées au contrat de chacun. Vous payez, faites récupérer ou rattraper, ou laissez Solvéa régulariser.',
    jouer: () => {
      avecPlanning();
      helene('heures');
    },
    gestes: [
      { faire: 'cliquer', sur: "[data-regul='rattrapage']", dit: 'Cliquez sur « Faire rattraper »', sert: 'Une fenêtre s’ouvre sur le planning de la personne : vous gardez la main sur le jour et l’horaire.', facultatif: true },
      { faire: 'attendre', que: '.dialog .rat-pl', facultatif: true },
      { faire: 'cliquer', sur: () => document.querySelector<HTMLElement>('.rat-pl-ligne:not(.vise):not(.passe) .rat-pl-case'), dit: 'Cliquez sur une plage libre du planning', sert: 'Les heures se placent là, collées au poste voisin. Solvéa contrôle aussitôt le créneau avec les règles.', facultatif: true },
      { faire: 'cliquer', sur: '#rat-auto', dit: 'Cliquez sur « Laisser Solvéa choisir »', sert: 'Solvéa reprend son meilleur créneau : aucune règle enfreinte, là où le comptoir en a besoin.', facultatif: true },
      { faire: 'cliquer', sur: '#rat-valider', dit: 'Cliquez sur « Planifier et prévenir »', sert: 'Le planning est mis à jour, et le message part à la personne.', facultatif: true },
      { faire: 'cliquer', sur: "[data-focus='auto-heures']", sert: 'Les écarts restants sont résorbés sur la prochaine semaine à construire, sans rien publier.', facultatif: true },
    ],
  },
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: '.compteurs',
    titre: 'Retards et suivi',
    texte: () => 'Un retard de Jules est noté. Sa fiche ne garde que des dates et des durées, jamais une raison.',
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
    texte: () => 'Samedis, fermetures, gardes, dépannages : vous voyez qui a porté quoi, face à sa part.',
    jouer: () => {
      avecPlanning();
      helene('equite');
    },
    gestes: [
      { faire: 'cliquer', sur: parTexte('.content button', '12 semaines'), sert: 'La période se choisit : 8 semaines, 12 semaines ou 6 mois.' },
      { faire: 'cliquer', sur: parTexte('.content .jr-filtre', 'Fermetures en semaine'), sert: 'Un compteur à la fois : ici, qui ferme le soir.' },
      { faire: 'cliquer', sur: parTexte('.content summary', 'Comment c’est calculé'), sert: 'La part de chacun suit son temps de travail.', facultatif: true },
      { faire: 'cliquer', sur: '.eq-detail summary', dit: 'Cliquez sur une ligne de l’équipe', sert: 'Le détail s’ouvre : les dates comptées, et d’où vient la part attendue.', facultatif: true },
    ],
  },
  {
    chapitre: BILAN,
    qui: HELENE,
    cible: '.content .card',
    titre: 'Le journal et la paie',
    texte: () => 'Chaque décision est tracée dans le journal. La fiche navette du mois s’exporte pour votre comptable.',
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
    texte: () => 'Plannings publiés, absences, fichiers déposés : chacun retrouve ses documents au même endroit.',
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
    texte: () => 'L’historique de l’équipe, personne par personne : arrêts, congés, remplacements. « Joindre » conserve un justificatif, visible des seuls titulaires.',
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
    texte: () => 'Chaque matin, le tableau de bord vous dit quoi faire en premier, qui est là aujourd’hui et où en est le planning.',
    jouer: () => {
      avecAbsenceImprevue();
      helene('tableau');
    },
    gestes: [
      { faire: 'cliquer', sur: parTexte('.content .tb-jour .btn', 'Voir la journée'), sert: 'La journée d’aujourd’hui, avec toute l’équipe.', facultatif: true },
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
    texte: () => 'Depuis n’importe quel écran, « Créer » ouvre un planning, une garde, une formation, un inventaire, une personne, une absence ou un message.',
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
    texte: () => 'La cloche annonce chaque décision prise et ce qu’elle change au planning. Dessous, ce qui vous attend, le plus urgent en tête.',
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
    texte: () => 'Vous gérez autant de pharmacies que vous voulez : ce sélecteur passe de l’une à l’autre.',
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
    texte: () => 'Posez-lui une question avec vos mots : il lit le planning, répond, et vous emmène au bon écran.',
    jouer: () => {
      avecPlanning();
      helene('tableau');
      useUi.getState().montrerAssistant(true);
    },
    gestes: [
      { faire: 'cliquer', sur: "[data-focus='assistant']", dit: 'Cliquez sur « Aide », en bas à droite', sert: 'C’est moi, Solvi ! Un clic ouvre la conversation.' },
      { faire: 'taper', dans: '#aide-question', texte: 'Qui travaille demain ?', dit: 'Posez votre question', sert: 'Avec vos mots, comme à un collègue.' },
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
    texte: () => 'L’aide répertorie toutes les fonctions. Chaque fiche donne la réponse, un bouton pour y aller et un tutoriel.',
    jouer: () => {
      avecPlanning();
      helene('aide');
    },
    gestes: [
      { faire: 'taper', dans: '#aide-recherche', texte: 'garde', dit: 'Cherchez un mot dans l’aide', sert: 'La recherche filtre les fiches et le lexique en même temps.' },
      { faire: 'cliquer', sur: parTexte('.content .jr-filtre', 'Lexique'), sert: 'Le lexique définit le vocabulaire de Solvéa.' },
      { faire: 'cliquer', sur: parTexte('.content .jr-filtre', 'Comment faire'), sert: 'Et l’on revient aux fiches : « Voir le tutoriel » rejoue la tâche, rien qu’elle.' },
    ],
  },
  {
    chapitre: QUOTIDIEN,
    qui: HELENE,
    cible: "[aria-labelledby='c-code']",
    titre: 'Mot de passe et clé de secours',
    texte: () => 'Chacun choisit son mot de passe. La clé de secours vous sert en cas d’oubli.',
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
    texte: () => 'Trois apparences (claire, mixte, sombre), la disposition de votre tableau de bord, la taille du texte, et pour vous seule, titulaire principale, dix couleurs. La visite est terminée : tout reste à essayer.',
    jouer: () => {
      avecPlanning();
      helene('compte');
    },
    gestes: [
      { faire: 'cliquer', sur: 'label[for="mode-mixte"]', sert: 'Le thème mixte fonce le menu et garde le contenu clair.' },
      { faire: 'cliquer', sur: 'label[for="mode-sombre"]', sert: 'Le mode sombre repose les yeux le soir.' },
      { faire: 'pause', ms: 1600 },
      { faire: 'cliquer', sur: 'label[for="mode-clair"]', sert: 'Et l’on revient au mode clair d’un clic.' },
      { faire: 'cliquer', sur: 'label[for="theme-emeraude"]', dit: 'Choisissez la couleur « Émeraude »', sert: 'Toute l’application, et moi avec, prenons cette couleur.', facultatif: true },
      { faire: 'pause', ms: 1800 },
      { faire: 'cliquer', sur: 'label[for="theme-ciel"]', dit: 'Revenez au bleu ciel', sert: 'Dix couleurs sont proposées.', facultatif: true },
      { faire: 'cliquer', sur: 'label[for="texte-grand"]', dit: 'Passez le texte en grand', sert: 'Pour lire plus confortablement.', facultatif: true },
      { faire: 'cliquer', sur: 'label[for="texte-normal"]', dit: 'Revenez à la taille normale', sert: 'Chaque personne garde ses propres préférences.', facultatif: true },
      { faire: 'cliquer', sur: 'label[for="disposition-classique"]', dit: 'Choisissez la disposition « Priorité d’abord »', sert: 'Le tableau de bord se range autrement : la priorité et votre agenda en tête.', facultatif: true },
      { faire: 'cliquer', sur: 'label[for="disposition-comptoir"]', dit: 'Revenez à « Comptoir et décisions »', sert: 'Les mêmes informations, placées autrement. Le choix ne vaut que pour vous.', facultatif: true },
    ],
  },
  {
    chapitre: PREPARER,
    qui: HELENE,
    cible: '#dimensionnement',
    titre: 'L’équipe est-elle assez nombreuse ?',
    texte: () => 'Indiquez le nombre de clients servis par jour : Solvéa en déduit combien de personnes il faut au comptoir, à l’heure ordinaire et à la pointe, puis le compare à vos contrats. Les caisses ne fixent qu’un plafond.',
    jouer: () => {
      avecEquipe();
      helene('officine');
    },
    gestes: [
      { faire: 'taper', dans: '#dim-passages', texte: '240', dit: 'Indiquez 240 clients par jour', sert: 'Le besoin se recalcule aussitôt : les pharmaciens d’un côté, le reste du comptoir de l’autre.', facultatif: true },
      { faire: 'cliquer', sur: '.dim-calcul summary', dit: 'Ouvrez « Comment c’est calculé »', sert: 'Chaque hypothèse est écrite : c’est un repère, pas une norme.', facultatif: true },
    ],
  },
  {
    chapitre: SUIVRE,
    qui: CAMILLE,
    cible: '.prochain',
    cibleFin: '.prochain',
    titre: 'Un retard annoncé',
    texte: () => 'Nicolas est retenu sur la route. Deux gestes suffisent : 5, 10, 15 minutes, ou plus de 20. Ses titulaires reçoivent aussitôt une notification et un message, avec son heure d’arrivée.',
    jouer: () => {
      avecPlanning();
      voirComme('nicolas.lesyndicaliste', 'espace');
    },
    gestes: [
      { faire: 'cliquer', sur: '#ret-prevenir', sert: 'Le bouton est sous son prochain poste, aujourd’hui ou demain.', facultatif: true },
      { faire: 'cliquer', sur: parTexte('#ret-durees .comp', '10 min'), dit: 'Touchez « 10 min »', sert: 'L’heure d’arrivée se calcule toute seule.', facultatif: true },
      { faire: 'cliquer', sur: '#ret-envoyer', sert: 'Les titulaires sont prévenus. L’avis reste affiché : il se corrige ou s’annule.', facultatif: true },
    ],
  },
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: '.tb-jour',
    titre: 'Le retard, vu du comptoir',
    texte: () => 'Caroline n’a rien à ressaisir : sur la frise du jour, l’étiquette « Retard » apparaît sous le nom, avec l’heure d’arrivée. Le trait bleu marque l’heure qu’il est.',
    jouer: () => {
      avecPlanning();
      avecRetard();
      helene('tableau');
    },
  },
  {
    chapitre: SUIVRE,
    qui: HELENE,
    cible: '#tb-declarer',
    titre: 'Un accident du travail',
    texte: () => 'Un accident signalé ouvre un délai légal de déclaration à la caisse d’assurance maladie. Solvéa le rappelle en tête du tableau de bord jusqu’à ce que vous notiez « C’est fait ».',
    jouer: () => {
      avecPlanning();
      avecAccident();
      helene('tableau');
    },
    gestes: [{ faire: 'cliquer', sur: '[data-declare]', dit: 'Cliquez sur « C’est fait »', sert: 'Le rappel est retiré : la déclaration est notée au dossier.', facultatif: true }],
  },
  {
    chapitre: QUOTIDIEN,
    qui: HELENE,
    cible: '.mp-prochain',
    titre: 'Mes horaires de titulaire',
    texte: () => 'Un titulaire a lui aussi un planning. « Mon planning » montre vos semaines publiées, exactement comme chaque membre de l’équipe voit les siennes.',
    jouer: () => {
      avecPlanning();
      helene('moi');
    },
  },
];

/**
 * La visite titulaire raconte la vie d'un planning, dans l'ordre où elle se vit : on installe la pharmacie,
 * l'équipe dit ses souhaits, on construit et on publie, l'équipe reçoit son planning et fait ses demandes,
 * on gère les imprévus, on fait le bilan. Quand l'histoire passe par un autre profil, la visite l'annonce
 * et l'interface prend la couleur de ce profil.
 */
const COMPLET: Etape[] = raconter(COMPLET_BRUT, [
  {
    chapitre: 'Installer la pharmacie',
    but: 'Caroline crée sa pharmacie : son équipe, ses horaires, ses règles. C’est tout ce qu’il faut à Solvéa pour proposer un planning.',
    etapes: ['Créer la pharmacie', 'Ajouter l’équipe', 'La fiche d’une personne', 'Les marques d’une animatrice', 'Horaires et effectif', 'L’équipe est-elle assez nombreuse ?', 'Qui prépare le planning', 'Les règles'],
  },
  { chapitre: 'Recueillir les souhaits', but: 'Avant de construire, chacun dit ce qui l’arrange. On passe un instant dans la peau de Nicolas, préparateur.', etapes: ['Les préférences du mois'] },
  {
    chapitre: 'Construire et publier',
    but: 'Caroline construit la semaine, la contrôle, y pose gardes et formations, puis l’envoie à l’équipe.',
    etapes: ['Une semaine à construire', 'Poser un poste', 'Trois propositions', 'La semaine est posée', 'Les contrôles', 'Les gardes', 'Une formation', 'Un inventaire', 'Le mois', 'Publier', 'Imprimer'],
  },
  {
    chapitre: 'L’équipe reçoit son planning',
    but: 'Le planning est publié. Voici ce que voient Nicolas, préparateur, puis Léa, pharmacienne.',
    etapes: ['Mon planning', 'Le calendrier du mois', 'Le planning de l’équipe', 'Mon suivi', 'Mes gardes'],
  },
  {
    chapitre: 'Les demandes de l’équipe',
    but: 'Un congé, un remplacement : la demande part de Nicolas, un collègue se propose, Caroline décide.',
    etapes: ['Mes demandes', 'Demander, avec sa raison', 'Se faire remplacer', 'La demande arrive', 'Un collègue se propose', 'Valider le remplacement', 'Une urgence médicale', 'Congés et horaires', 'Deux demandes sur les mêmes dates', 'Refuser une demande'],
  },
  {
    chapitre: 'Les imprévus',
    but: 'Un arrêt le matin même, un retard, une décision à prendre à deux titulaires : ce qui ne se prévoit pas.',
    etapes: ['Une absence imprévue', 'L’appel à l’équipe', 'Personne ne se propose', 'Une journée', 'Retards et suivi', 'Un retard annoncé', 'Le retard, vu du comptoir', 'Un accident du travail', 'Décider à deux', 'Donner son accord', 'Les messages'],
  },
  { chapitre: 'Le bilan du mois', but: 'En fin de mois : les heures de chacun, l’équité entre collègues, ce qui part en paie, les documents.', etapes: ['Le compteur d’heures', 'L’équité', 'Le journal et la paie', 'Les documents', 'Absences et justificatifs'] },
  {
    chapitre: 'Au quotidien',
    but: 'Les raccourcis de tous les jours, et où trouver de l’aide.',
    etapes: ['Le tableau de bord', 'Mes horaires de titulaire', 'Le bouton « Créer »', 'La cloche', 'Plusieurs pharmacies', 'Solvi, votre assistant', 'L’aide', 'Mot de passe et clé de secours', 'Votre compte'],
  },
]);

/**
 * La visite du titulaire : gérer la pharmacie, sans l'installation ni les écrans de l'équipe. Les mêmes étapes
 * que la visite complète, rangées par tâche : construire, décider, suivre, faire le bilan, régler.
 */
const TITULAIRE: Etape[] = raconter(
  COMPLET_BRUT,
  [
    { chapitre: 'Construire la semaine', but: 'La grille, un poste posé à la main, trois propositions comparées, les contrôles, puis la publication.', etapes: ['Une semaine à construire', 'Poser un poste', 'Trois propositions', 'La semaine est posée', 'Les contrôles', 'Le mois', 'Publier', 'Imprimer'] },
    { chapitre: 'Gardes, formation, inventaire', but: 'Ce qui s’ajoute au planning ordinaire, et qui prévient chacun tout seul.', etapes: ['Les gardes', 'Une formation', 'Un inventaire'] },
    { chapitre: 'Décider', but: 'Remplacements, congés, absences imprévues : chaque demande arrive au même endroit, avec de quoi trancher.', etapes: ['La demande arrive', 'Valider le remplacement', 'Une urgence médicale', 'Congés et horaires', 'Deux demandes sur les mêmes dates', 'Refuser une demande', 'Une absence imprévue', 'L’appel à l’équipe', 'Personne ne se propose', 'Donner son accord'] },
    { chapitre: 'Suivre l’équipe', but: 'La journée en cours, les retards, un accident du travail, les messages.', etapes: ['Une journée', 'Retards et suivi', 'Le retard, vu du comptoir', 'Un accident du travail', 'Les messages'] },
    { chapitre: 'Faire le bilan', but: 'Les heures de chacun, l’équité entre collègues, ce qui part en paie, les documents.', etapes: ['Le compteur d’heures', 'L’équité', 'Le journal et la paie', 'Les documents'] },
    { chapitre: 'Piloter au quotidien', but: 'Le tableau de bord, vos propres horaires, les raccourcis, et les réglages de la pharmacie.', etapes: ['Le tableau de bord', 'Mes horaires de titulaire', 'La cloche', 'Le bouton « Créer »', 'Horaires et effectif', 'L’équipe est-elle assez nombreuse ?', 'Qui prépare le planning', 'Les règles', 'Votre compte'] },
  ],
  true,
);

const MON_PLANNING = 'Mon planning';
const MES_DEMANDES = 'Mes demandes';
const AVEC_EQUIPE = 'L’équipe et moi';
const MON_ESPACE = 'Mon espace';
BUTS[MON_PLANNING] = 'Votre accueil, votre prochain poste, votre semaine et celle de l’équipe.';
BUTS[MES_DEMANDES] = 'Dire vos préférences, demander un congé, vous faire remplacer, prévenir d’un retard.';
BUTS[AVEC_EQUIPE] = 'Aider un collègue, écrire à l’équipe, demander un rendez-vous.';
BUTS[MON_ESPACE] = 'Votre suivi, l’aide, et votre compte.';

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
  const etapes: Etape[] = [
    {
      chapitre: MON_PLANNING,
      qui: p.qui,
      cible: "[data-focus='mon-metier']",
      titre: 'Mon accueil',
      texte: () => 'Chaque profil a le sien : ce qui attend une réponse, le prochain poste, puis ce qui est propre au métier.',
      jouer: () => moi('espace'),
    },
    {
      chapitre: MON_PLANNING,
      qui: p.qui,
      cible: "[data-focus='mes-rdv']",
      titre: 'Demander un rendez-vous',
      texte: () => 'Un point avec le titulaire, un entretien : la demande part dans la messagerie, puis se fixe dans l’agenda.',
      jouer: () => moi('espace'),
      gestes: [
        { faire: 'cliquer', sur: '#esp-rdv-demander', dit: 'Cliquez sur « Demander un rendez-vous »', sert: 'La fenêtre propose les sujets de votre profil et la personne à voir.' },
        { faire: 'attendre', que: '.dialog #rdv-avis' },
        { faire: 'cliquer', sur: '.rdv-idees .comp', dit: 'Choisissez un moment proposé', sert: 'Solvéa propose des moments où vous êtes tous les deux en poste.', facultatif: true },
        { faire: 'cliquer', sur: '#rdv-envoyer', dit: 'Cliquez sur « Envoyer la demande »', sert: 'La demande part dans la conversation. Une fois acceptée, le rendez-vous est dans vos deux agendas.' },
      ],
    },
    {
      chapitre: MES_DEMANDES,
      qui: p.qui,
      cible: '.prochain',
      cibleFin: '.prochain',
      titre: 'Prévenir d’un retard',
      texte: () => 'Un imprévu sur la route : deux gestes suffisent. Vos titulaires reçoivent aussitôt une notification et un message, avec votre heure d’arrivée.',
      jouer: () => moi('espace'),
      gestes: [
        { faire: 'cliquer', sur: '#ret-prevenir', sert: 'Le bouton est sous votre prochain poste, aujourd’hui ou demain.', facultatif: true },
        { faire: 'cliquer', sur: parTexte('#ret-durees .comp', '15 min'), dit: 'Touchez « 15 min »', sert: 'L’heure d’arrivée se calcule toute seule.', facultatif: true },
        { faire: 'cliquer', sur: '#ret-envoyer', sert: 'Les titulaires sont prévenus. L’avis reste affiché : il se corrige ou s’annule.', facultatif: true },
      ],
    },
    {
      chapitre: MON_PLANNING,
      qui: p.qui,
      cible: '.prochain',
      titre: 'Mon prochain poste',
      texte: () => 'Votre prochain poste : c’est la première chose qu’on cherche, et la première qu’on voit.',
      jouer: () => moi('moi'),
    },
    {
      chapitre: MON_PLANNING,
      qui: p.qui,
      cible: '.me-grid .card',
      titre: 'Ma semaine',
      texte: () => 'Votre semaine, jour par jour : horaires, pause, durée. Seul le planning publié s’affiche.',
      jouer: () => moi('moi'),
    },
    {
      chapitre: MON_PLANNING,
      qui: p.qui,
      cible: '.me-grid',
      cibleFin: 'table.cal',
      titre: 'Le calendrier du mois',
      texte: () => 'Le calendrier montre le mois entier, avec les mêmes couleurs que partout ailleurs.',
      jouer: () => moi('moi'),
      gestes: [{ faire: 'cliquer', sur: parTexte('.me-grid .seg button', 'Calendrier'), sert: 'Le calendrier montre le mois entier, avec la couleur de chaque horaire.' }],
    },
    {
      chapitre: MON_PLANNING,
      qui: p.qui,
      cible: '.content .plan',
      titre: 'Le planning de l’équipe',
      texte: () => 'Vous voyez qui travaille quand. « Mes postes » ne garde que votre ligne.',
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
      texte: () => '« Mes demandes » tient en trois cartes : mes préférences, une absence ou un horaire, un remplacement.',
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
      texte: () => 'Dites ce qui vous arrange pour le mois suivant : une forme d’horaire, puis les jours. « M’assister » complète le reste.',
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
      texte: () => 'Vous indiquez des dates et une raison, choisie dans une liste. Seuls les titulaires la voient.',
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
      texte: () => 'Vous choisissez le poste et le niveau d’urgence : prévu, urgent ou urgence médicale, avec un justificatif. Votre titulaire répond.',
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
      texte: () => 'Quand un poste est à couvrir, tous ceux qui peuvent le tenir sont prévenus ensemble. Vous voyez votre rang ; dire non ne le change pas.',
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
      texte: () => 'La messagerie réunit un fil pour toute l’équipe et des conversations privées.',
      jouer: () => moi('messages'),
      gestes: [{ faire: 'taper', dans: '#msg-texte', texte: 'Bonjour à tous !', dit: 'Écrivez votre message', sert: 'Pour toute l’équipe, ou pour une seule personne.' }],
    },
    {
      chapitre: MON_ESPACE,
      qui: p.qui,
      cible: '.content .deux',
      titre: 'Mon suivi',
      texte: () => 'Votre compteur d’heures et votre part des contraintes de l’équipe. Aucun classement entre collègues.',
      jouer: () => moi('suivi'),
    },
    {
      chapitre: MON_ESPACE,
      qui: p.qui,
      cible: "[data-focus='assistant']",
      cibleFin: '.aide-panneau',
      titre: 'Solvi, votre assistant',
      texte: () => 'Posez-lui une question avec vos mots : il lit votre planning et vous répond.',
      jouer: () => {
        moi('moi');
        useUi.getState().montrerAssistant(true);
      },
      gestes: [
        { faire: 'cliquer', sur: "[data-focus='assistant']", dit: 'Cliquez sur « Aide », en bas à droite', sert: 'C’est moi, Solvi ! Un clic ouvre la conversation.' },
        { faire: 'taper', dans: '#aide-question', texte: 'Mon prochain poste ?', dit: 'Posez votre question', sert: 'Avec vos mots, comme à un collègue.' },
        { faire: 'cliquer', sur: '.aide-envoyer', dit: 'Cliquez sur la flèche pour envoyer', sert: 'Je lis le planning et je réponds, avec un bouton vers le bon écran.' },
        { faire: 'attendre', que: '.aide-bulle.bot + .aide-bulle.moi + .aide-bulle.bot, .aide-bulle.bot .btn' },
      ],
    },
    {
      chapitre: MON_ESPACE,
      qui: p.qui,
      cible: '.choix.themes',
      titre: 'Mon compte',
      texte: () => 'Trois apparences, taille du texte, mot de passe : votre compte se règle ici. La couleur est celle de votre profil. À vous de jouer.',
      jouer: () => moi('compte'),
    },
  ];
  // Le rendez-vous se demande à un collègue : il se range avec les messages, dans « L'équipe et moi ».
  const rdv = etapes.findIndex((e) => e.titre === 'Demander un rendez-vous');
  const [demande] = rdv >= 0 ? etapes.splice(rdv, 1) : [];
  const messages = etapes.findIndex((e) => e.titre === 'Les messages');
  if (demande) etapes.splice(messages >= 0 ? messages + 1 : etapes.length, 0, { ...demande, chapitre: AVEC_EQUIPE });
  // L'avis de retard se donne depuis l'accueil, mais il se range avec les demandes : il vient après le remplacement.
  const retard = etapes.findIndex((e) => e.titre === 'Prévenir d’un retard');
  const [avis] = retard >= 0 ? etapes.splice(retard, 1) : [];
  const remplacer = etapes.findIndex((e) => e.titre === 'Me faire remplacer');
  if (avis) etapes.splice(remplacer >= 0 ? remplacer + 1 : etapes.length, 0, avis);
  return etapes;
}

const PHARMACIEN = visiteDe({ id: 'p_lea', identifiant: 'lea.fontaine', qui: 'Léa · pharmacienne', prenom: 'Léa', pharmacien: true });
const EQUIPIER = visiteDe({ id: 'p_camille', identifiant: 'nicolas.lesyndicaliste', qui: 'Nicolas · préparateur', prenom: 'Nicolas' });
const ANIMATRICE = visiteDe({ id: 'p_sarah', identifiant: 'sarah.lemoine', qui: 'Sarah · animatrice', prenom: 'Sarah' });
const APPRENTIE = visiteDe({ id: 'p_manon', identifiant: 'manon.girard', qui: 'Manon · apprentie', prenom: 'Manon' });
const ETUDIANT = visiteDe({ id: 'p_yanis', identifiant: 'yanis.morel', qui: 'Yanis · étudiant', prenom: 'Yanis' });

/** La durée annoncée : une demi-minute par étape, au rythme normal. */
const minutes = (etapes: Etape[]): string => `${Math.max(3, Math.round(etapes.length * 0.5))} min · ${etapes.length} étapes`;

/**
 * Le catalogue des visites. `depart` : « zero » part d'une pharmacie qui vient d'être créée, « etabli » d'une pharmacie
 * qui tourne déjà. `groupe` range les cartes dans « Découvrir Solvéa » : les parcours, les autres métiers, les journées types.
 */
export const SCENARIOS = {
  complet: { groupe: 'parcours', depart: 'zero', court: 'Complet', role: 'Tous les rôles', titre: 'Tout Solvéa, de zéro', fil: 'De la création de la pharmacie au bilan du mois. On suit Caroline, titulaire, et l’on passe par moments dans la peau de son équipe.', duree: minutes(COMPLET), etapes: COMPLET },
  titulaire: { groupe: 'parcours', depart: 'zero', court: 'Titulaire', role: 'Titulaire', titre: 'Gérer la pharmacie', fil: 'Construire, publier, décider, suivre, faire le bilan : tout ce que fait Caroline, titulaire, une fois la pharmacie installée.', duree: minutes(TITULAIRE), etapes: TITULAIRE },
  pharmacien: { groupe: 'parcours', depart: 'etabli', court: 'Pharmacien', role: 'Pharmacien', titre: 'Mon espace de pharmacien', fil: 'Tout ce que voit Léa, pharmacienne : son planning, ses demandes, ses gardes, son compte.', duree: minutes(PHARMACIEN), etapes: PHARMACIEN },
  equipe: { groupe: 'parcours', depart: 'etabli', court: 'Préparateur', role: 'Préparateur', titre: 'Mon espace de préparateur', fil: 'Tout ce que voit Nicolas, préparateur : son planning, ses demandes, ses collègues, son compte.', duree: minutes(EQUIPIER), etapes: EQUIPIER },
  animateur: { groupe: 'metiers', depart: 'etabli', court: 'Animatrice', role: 'Animateur', titre: 'Mon espace d’animatrice', fil: 'Tout ce que voit Sarah, animatrice : ses jours d’animation, les marques qu’elle présente, ses demandes.', duree: minutes(ANIMATRICE), etapes: ANIMATRICE },
  apprenti: { groupe: 'metiers', depart: 'etabli', court: 'Apprentie', role: 'Apprenti', titre: 'Mon espace d’apprentie', fil: 'Tout ce que voit Manon, apprentie : son alternance, ses jours d’école, ses horaires à la pharmacie.', duree: minutes(APPRENTIE), etapes: APPRENTIE },
  etudiant: { groupe: 'metiers', depart: 'etabli', court: 'Étudiant', role: 'Étudiant', titre: 'Mon espace d’étudiant', fil: 'Tout ce que voit Yanis, étudiant : ses horaires autour de ses cours, ses demandes, son suivi.', duree: minutes(ETUDIANT), etapes: ETUDIANT },
  etabli: { groupe: 'journees', depart: 'etabli', court: 'Journée ordinaire', role: 'Tous les rôles', titre: 'Une journée ordinaire', fil: 'Une journée à la pharmacie, du matin au soir, avec ceux qui la vivent.', duree: minutes(ETABLI), etapes: ETABLI },
  tension: { groupe: 'journees', depart: 'etabli', court: 'Journée sous tension', role: 'Tous les rôles', titre: 'Une journée sous tension', fil: 'Un arrêt le matin, un retard, un accident du travail : tout se règle, et tout le monde est prévenu.', duree: minutes(TENSION), etapes: TENSION },
  publication: { groupe: 'journees', depart: 'etabli', court: 'Veille de publication', role: 'Tous les rôles', titre: 'Une veille de publication', fil: 'L’échéance du mois approche : on construit, on publie, l’équipe reçoit son planning, on fait le bilan.', duree: minutes(PUBLICATION), etapes: PUBLICATION },
} as const;
export type Scenario = keyof typeof SCENARIOS;

/**
 * Dans une visite, chaque compte de l'exemple porte la couleur de son profil : quand l'histoire change de
 * personne, l'interface change de couleur, et l'on sait aussitôt chez qui l'on est.
 */
function couleursDeProfil(): void {
  useUi.getState().oublierCouleurs(store().data.personnes.map((x) => x.identifiant ?? '').filter(Boolean));
}

/** Lance un parcours guidé sur un environnement d'exemple remis à neuf. */
export function lancerParcours(scenario: Scenario = 'etabli'): void {
  annulerMinuteries();
  store().chargerExemple(true, SCENARIOS[scenario].depart);
  couleursDeProfil();
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
  accueil: { equipe: ['Mon accueil'] },
  'rendez-vous': { equipe: ['Demander un rendez-vous'] },
  'retard-prevenir': { equipe: ['Prévenir d’un retard'] },
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
  imprimer: { gestion: ['Imprimer'], equipe: ['Le planning de l’équipe'] },
  mois: { gestion: ['Le mois'] },
  absence: { gestion: ['Une absence imprévue', 'Personne ne se propose'] },
  'demande-remplacement': { gestion: ['La demande arrive', 'Valider le remplacement'] },
  'demandes-equipe': { gestion: ['Congés et horaires', 'Refuser une demande'] },
  gardes: { gestion: ['Les gardes'] },
  formation: { gestion: ['Une formation', 'Un inventaire'] },
  personne: { gestion: ['Ajouter l’équipe', 'La fiche d’une personne'] },
  marques: { gestion: ['Les marques d’une animatrice'] },
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
  signaler: { gestion: ['Retards et suivi'], equipe: ['Prévenir d’un retard'] },
  accident: { gestion: ['Une absence imprévue'], equipe: ['Demander un congé'] },
  support: { gestion: ['L’aide'], equipe: ['Solvi, votre assistant'] },
  tableau: { gestion: ['Le tableau de bord'] },
  creer: { gestion: ['Le bouton « Créer »'] },
  echeance: { gestion: ['Le tableau de bord'] },
  propositions: { gestion: ['Trois propositions'] },
  pauses: { gestion: ['Poser un poste'] },
  'qui-prepare': { gestion: ['Qui prépare le planning'] },
  'postes-types': { gestion: ['Horaires et effectif'] },
  'officine-chiffres': { gestion: ['Horaires et effectif'] },
  dimensionnement: { gestion: ['Horaires et effectif'] },
  'points-forts': { gestion: ['La fiche d’une personne'] },
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
  s.chargerExemple(true, SCENARIOS[t.scenario].depart);
  couleursDeProfil();
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
  /** Ce que Solvi saisit lui-même pour montrer : « Pour l'exemple, j'écris… ». */
  const [exemple, setExemple] = useState('');
  /** À quoi sert le geste en cours : la deuxième ligne de la bulle de Solvi. */
  const [sert, setSert] = useState('');
  /** Où Solvi se tient pendant la démonstration : près de ce qu'il montre, sans rien cacher. */
  const [pose, setPose] = useState<{ x: number; y: number } | null>(null);
  const poseRef = useRef<{ x: number; y: number } | null>(null);
  /** Pendant qu'il vole, sa bulle est rangée : on suit un seul objet, puis on lit. */
  const [vol, setVol] = useState(false);
  const enVol = useRef(false);
  /** La durée du vol en cours, selon la distance. */
  const [dureeVol, setDureeVol] = useState(0);
  const [elan, setElan] = useState<'' | 'vers-droite' | 'vers-gauche'>('');
  /** La démonstration de l'étape est finie : Solvi s'efface avant que la fiche ne revienne. */
  const [sortie, setSortie] = useState(false);
  /** La démonstration est en pause : plus rien ne bouge tant qu'on ne la reprend pas. */
  const [pause, setPause] = useState(false);
  const basculerPause = (): void => {
    if (suspendu) reprendre();
    else suspendre();
    setPause(suspendu);
  };
  /** Le temps laissé pour lire ou regarder, montré sur « Continuer » ; ce bouton, ou la flèche droite, l'écourte. */
  const [compte, setCompte] = useState<{ cle: number; ms: number } | null>(null);
  const compteCle = useRef(0);
  const passe = useRef<(() => void) | null>(null);
  /** Le pointeur : il part de Solvi à chaque geste, glisse jusqu'à sa cible, agit, puis s'efface. */
  const [pointeCle, setPointeCle] = useState(0);
  const [pointeVue, setPointeVue] = useState(false);
  const pointee = useRef<Cible | null>(null);
  /** Début de chapitre : la visite annonce ce qu'on va y faire, et dans la peau de qui. */
  const [acte, setActe] = useState(false);
  /** On change de personne en cours de chapitre : un bandeau le dit, l'interface a pris sa couleur. */
  const [regard, setRegard] = useState<{ cle: number; qui: string } | null>(null);
  const precedent = useRef<{ parcours: number; qui: string; scenario: Scenario } | null>(null);
  const arrivee = useRef<{ cle: string; annonce: boolean; regard: string | null } | null>(null);
  const guide = useRef<HTMLDivElement>(null);
  const zoneVue = useRef<Zone | null>(null);
  const [allure, setAllure] = useState<Rythme>(rythme);
  /** L'humeur de Solvi suit ce qu'il fait : il explique, clique, écrit, attend un calcul, montre un résultat. */
  const [humeur, setHumeur] = useState<Humeur>('neutre');
  /** La fiche d'explication est-elle à l'écran ? Elle s'efface le temps d'une transition ou d'une démonstration. */
  const [ouvert, setOuvert] = useState(false);
  const [clic, setClic] = useState(false);
  // Les gestes de Solvi : il s'écrase un peu en se posant, hoche la tête quand il prend la parole, sursaute à un clic.
  const [gesteSolvi, setGesteSolvi] = useState<GesteSolvi | null>(null);
  const gesteN = useRef(0);
  const jouerGeste = useCallback((nom: GesteSolvi['nom']): void => {
    setGesteSolvi({ nom, cle: ++gesteN.current });
    window.setTimeout(() => setGesteSolvi((g) => (g && g.cle === gesteN.current ? null : g)), 1150);
  }, []);
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
    if (parcours === null) {
      precedent.current = null;
      arrivee.current = null;
      setActe(false);
      setRegard(null);
      return;
    }
    const e = SCENARIOS[scenario].etapes[parcours] as Etape | undefined;
    if (!e) return;
    annulerMinuteries();
    setPause(false);
    passe.current = null;
    pointee.current = null;
    setCompte(null);
    setSortie(false);
    setPointeVue(false);
    setRegard(null);
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
    // Un chapitre commence : on dit d'abord ce qu'on va y faire. Pas en revenant en arrière, ni dans le tutoriel d'une tâche.
    // La décision est prise une fois par arrivée sur une étape : la rejouer ne ré-annonce rien.
    const cle = `${scenario}:${parcours}:${tirage}`;
    if (arrivee.current?.cle !== cle) {
      const avant = precedent.current?.scenario === scenario ? precedent.current : null;
      const suiteDe = SCENARIOS[scenario].etapes[parcours - 1] as Etape | undefined;
      const annonce = !useUi.getState().tache && !!e.chapitre && suiteDe?.chapitre !== e.chapitre && avant?.parcours !== parcours + 1 && avant?.parcours !== parcours;
      // On change de personne : l'interface a pris la couleur de son profil, un bandeau dit qui l'on est devenu.
      const ici = useStore.getState().data;
      const personne = ici.personnes.find((x) => x.identifiant === useUi.getState().session);
      const qui = e.qui === 'Un collègue' && personne ? `${personne.prenom} · ${libelleRole(ici, personne).toLowerCase()}` : e.qui;
      arrivee.current = { cle, annonce, regard: !annonce && avant && avant.parcours !== parcours && avant.qui !== e.qui ? qui : null };
      precedent.current = { parcours, qui: e.qui, scenario };
    }
    const annoncer = arrivee.current.annonce;
    setActe(annoncer);
    if (arrivee.current.regard) {
      setRegard({ cle: parcours * 1000 + tirage, qui: arrivee.current.regard });
      plusTard(() => setRegard(null), 3400);
    }

    const liste = decouper(e.gestes ?? []);
    temps.current = liste;
    setNbTemps(liste.length);
    setJoues(0);
    setAnnonce('');
    setSert('');
    let faits = 0;
    const dernierePas = parcours >= (useUi.getState().tache?.a ?? SCENARIOS[scenario].etapes.length - 1);
    /** Une attente que l'on peut écourter : « Continuer », ou la flèche droite, passe tout de suite à la suite. */
    const patienter = (ms: number, puis: () => void): void => {
      const fini = (): void => {
        passe.current = null;
        setCompte(null);
        puis();
      };
      const m = minuter(fini, ms);
      passe.current = () => {
        annulerUne(m);
        fini();
      };
      setCompte({ cle: ++compteCle.current, ms });
    };
    const montrerBulle = (): void => {
      if (!enVol.current) return;
      enVol.current = false;
      setVol(false);
    };
    const poser = (place: { x: number; y: number }): void => {
      poseRef.current = place;
      setPose(place);
    };
    /** Où Solvi se tient pour montrer cet élément : à côté du bloc éclairé, sinon dessous ou dessus, jamais devant. */
    const placePour = (el: HTMLElement): { x: number; y: number } => {
      const r = el.getBoundingClientRect();
      const W = window.innerWidth;
      const H = window.innerHeight;
      const w = guide.current?.offsetWidth ?? Math.min(440, W - 24);
      const h = Math.max(guide.current?.offsetHeight ?? 0, 136);
      const borne = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
      if (W < 900) {
        // Petit écran : en bas, au-dessus de la barre d'onglets ; en haut si ce qu'il montre est en bas.
        const bas = H - h - 92;
        return { x: 12, y: r.bottom > bas - 12 ? 76 : bas };
      }
      const z = zoneVue.current ?? { top: r.top, left: r.left, width: r.width, height: r.height };
      const proche = (p: { x: number; y: number }, a: Zone, marge: number): boolean => p.x < a.left + a.width + marge && p.x + w > a.left - marge && p.y < a.top + a.height + marge && p.y + h > a.top - marge;
      const cible: Zone = { top: r.top, left: r.left, width: r.width, height: r.height };
      const haut = borne(r.top + r.height / 2 - h / 2, 84, H - h - 16);
      const aligne = borne(r.left - 30, 16, W - w - 16);
      const choix: { x: number; y: number; ok: boolean }[] = [
        { x: z.left + z.width + 18, y: haut, ok: z.left + z.width + 18 + w <= W - 12 },
        { x: z.left - 18 - w, y: haut, ok: z.left - 18 - w >= 12 },
        { x: aligne, y: z.top + z.height + 14, ok: z.top + z.height + 14 + h <= H - 12 },
        { x: aligne, y: z.top - 14 - h, ok: z.top - 14 - h >= 84 },
        { x: aligne, y: r.bottom + 18, ok: r.bottom + 18 + h <= H - 12 },
        { x: aligne, y: r.top - 18 - h, ok: r.top - 18 - h >= 84 },
      ];
      const avant = poseRef.current;
      // Moins il bouge, mieux on le suit : il garde sa place tant qu'il ne cache pas ce qu'il montre et qu'il en reste proche.
      // S'il est devant le bloc éclairé alors qu'une place est libre à côté, il s'y range.
      if (avant && avant.x >= 12 && avant.x + w <= W - 12 && avant.y >= 76 && avant.y + h <= H - 12 && !proche(avant, cible, 12)) {
        const ecartX = Math.max(0, cible.left - (avant.x + w), avant.x - (cible.left + cible.width));
        const ecartY = Math.max(0, cible.top - (avant.y + h), avant.y - (cible.top + cible.height));
        const devant = proche(avant, z, 4);
        const aCote = choix.slice(0, 4).some((c) => c.ok);
        if (Math.hypot(ecartX, ecartY) <= 420 && !(devant && aCote)) return avant;
      }
      const place = choix.find((c) => c.ok) ?? { x: borne(W / 2 - w / 2, 16, W - w - 16), y: H - h - 20 };
      return { x: Math.round(place.x), y: Math.round(place.y) };
    };
    /** Une fenêtre vient de s'ouvrir sous lui : s'il y a la place à côté, Solvi s'y range ; sinon il reste où il est. */
    const degager = (): { x: number; y: number } | null => {
      const avant = poseRef.current;
      const z = zoneVue.current;
      const g = guide.current;
      const W = window.innerWidth;
      const H = window.innerHeight;
      if (!avant || !z || !g || W < 900) return avant;
      const w = g.offsetWidth;
      const h = Math.max(g.offsetHeight, 136);
      if (!(avant.x < z.left + z.width + 4 && avant.x + w > z.left - 4 && avant.y < z.top + z.height + 4 && avant.y + h > z.top - 4)) return avant;
      const y = Math.max(84, Math.min(H - h - 16, avant.y));
      const x = Math.max(16, Math.min(W - w - 16, avant.x));
      if (z.left + z.width + 18 + w <= W - 12) return { x: Math.round(z.left + z.width + 18), y };
      if (z.left - 18 - w >= 12) return { x: Math.round(z.left - 18 - w), y };
      if (z.top + z.height + 14 + h <= H - 12) return { x, y: Math.round(z.top + z.height + 14) };
      if (z.top - 14 - h >= 84) return { x, y: Math.round(z.top - 14 - h) };
      return avant;
    };
    /** Une bulle plus haute que prévu ne sort pas de l'écran : Solvi remonte d'autant. */
    const recaler = (): void => {
      const g = guide.current;
      const p = poseRef.current;
      if (!g || !p) return;
      const depasse = p.y + g.offsetHeight - (window.innerHeight - 12);
      if (depasse <= 0) return;
      setDureeVol(280);
      poser({ x: p.x, y: Math.max(76, Math.round(p.y - depasse)) });
    };
    /**
     * Solvi prend la parole. S'il doit changer de place, il range sa bulle, vole d'un seul trait, puis la rouvre
     * avec ce qu'il a à dire : on suit un seul objet à la fois, et l'on ne lit qu'une fois arrivé.
     */
    const parler = (vers: HTMLElement | null, dit: string, aQuoi: string, puis: () => void, enExemple = ''): void => {
      const avant = poseRef.current;
      const place = vers ? placePour(vers) : degager();
      const distance = avant && place ? Math.hypot(place.x - avant.x, place.y - avant.y) : 0;
      const dire = (): void => {
        setAnnonce(dit);
        setSert(aQuoi);
        setExemple(enExemple);
      };
      if (!avant || !place || distance < 12) {
        dire();
        montrerBulle();
        return plusTard(() => {
          recaler();
          puis();
        }, 280);
      }
      const dejaRangee = enVol.current;
      enVol.current = true;
      setVol(true);
      plusTard(
        () => {
          dire();
          const d = Math.round(Math.min(900, Math.max(460, 360 + distance * 0.5)));
          setDureeVol(d);
          setElan(place.x > avant.x + 24 ? 'vers-droite' : place.x < avant.x - 24 ? 'vers-gauche' : '');
          poser(place);
          plusTard(() => {
            setElan('');
            montrerBulle();
            plusTard(() => {
              recaler();
              puis();
            }, 260);
          }, d + 40);
        },
        dejaRangee ? 0 : 170,
      );
    };
    /** Le pointeur part de Solvi et glisse jusqu'à sa cible : l'œil passe de la bulle au bouton sans chercher. */
    const partir = (cible: Cible): void => {
      const q = guide.current?.querySelector('.solvi-guide-qui')?.getBoundingClientRect();
      pointee.current = null;
      setPointeCle((k) => k + 1);
      if (q) setPoint({ x: Math.round(q.left + q.width / 2), y: Math.round(q.top + q.height / 2) });
      setPointeVue(true);
      plusTard(() => {
        pointee.current = cible;
        mesure.current();
      }, 60);
    };
    /** Un temps est joué : le suivant s'enchaîne. Après le dernier, on laisse voir le résultat, puis l'étape suivante arrive. */
    const fin = (): void => {
      visee.current = null;
      pointee.current = null;
      setPointeVue(false);
      setClic(false);
      faits++;
      setJoues(faits);
      if (faits < liste.length) {
        setHumeur('neutre');
        // Un temps sans geste visible s'annonce tout de suite ; sinon Solvi parle une fois posé près de sa cible.
        if (!liste[faits].some(visible)) {
          setAnnonce(decrire(liste[faits]));
          setSert(utilite(liste[faits]));
          setExemple('');
        }
        plusTard(() => derouler(liste[faits], 0), 160);
        return;
      }
      // La démonstration de l'étape est finie : Solvi est content du résultat, puis s'efface.
      setHumeur('heureux');
      patienter(tempo(1700), () => {
        setSortie(true);
        plusTard(() => {
          contexte.current = null;
          if (dernierePas) {
            setPhase('fini');
            noter();
            setOuvert(true);
          } else setParcours(parcours + 1);
        }, 320);
      });
    };
    /** Joue le geste i du temps en cours, puis le suivant. Un élément introuvable est attendu un instant, puis ignoré. */
    const derouler = (gestes: Geste[], i: number): void => {
      if (i >= gestes.length) return fin();
      const g = gestes[i];
      const suite = (ms: number): void => plusTard(() => derouler(gestes, i + 1), ms);
      if (g.faire === 'pause') {
        // Une pause peut dire ce qu'on regarde pendant qu'elle dure : on laisse alors le temps de la lire.
        if (g.dit) {
          const dit = g.dit;
          const aQuoi = g.sert ?? '';
          // Il montre un résultat : il s'en réjouit.
          setHumeur('excite');
          return parler(null, dit, aQuoi, () => patienter(Math.max(tempo(g.ms), tempsDeLire(`${dit} ${aQuoi}`)), () => derouler(gestes, i + 1)));
        }
        montrerBulle();
        return suite(tempo(g.ms));
      }
      if (g.faire === 'action') {
        g.jouer();
        montrerBulle();
        return suite(tempo(700));
      }
      const cible = g.faire === 'cliquer' ? g.sur : g.faire === 'attendre' ? g.que : g.dans;
      let essais = 0;
      const facultatif = 'facultatif' in g && !!g.facultatif;
      const viser = (): void => {
        const el = element(cible);
        if (!el || (el as HTMLButtonElement).disabled) {
          // Pendant une attente, Solvi garde sa bulle ouverte ; si elle dure (un calcul), il réfléchit.
          if (essais === 2) montrerBulle();
          if (g.faire === 'attendre' && essais === 4) setHumeur('reflechi');
          if (++essais > (g.faire === 'attendre' ? (facultatif ? 14 : 200) : facultatif ? 6 : 14)) {
            // Un geste qui ne trouve pas sa cible est sauté : on le signale, pour qu'une étape ne se vide pas en silence.
            if (facultatif) console.debug(`[visite·facultatif] « ${SCENARIOS[scenario].etapes[parcours]?.titre ?? '?'} » : ${'dit' in g && g.dit ? g.dit : typeof cible === 'string' ? cible : g.faire}`);
            else console.warn(`[visite] geste sauté à l’étape « ${SCENARIOS[scenario].etapes[parcours]?.titre ?? '?'} » : ${g.faire}${'dit' in g && g.dit ? ` (${g.dit})` : typeof cible === 'string' ? ` ${cible}` : ''}`);
            return derouler(gestes, i + 1);
          }
          return plusTard(viser, 150);
        }
        if (g.faire === 'attendre') return suite(300);
        // 1. L'écran défile et le projecteur se pose sur le bloc où le geste a lieu.
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
        visee.current = cible;
        plusTard(() => mesure.current(), 60);
        const dit = g.dit ?? decrire([g]);
        const aQuoi = g.sert ?? '';
        const enExemple = exempleDe(g);
        setHumeur('neutre');
        // 2. Solvi vient se poser à côté et dit ce qu'il va faire. 3. Le temps de lire. 4. Le pointeur y va, puis agit.
        plusTard(() => {
          const suiteDuGeste = (): void =>
            patienter(tempsDeLire(`${dit} ${aQuoi} ${enExemple}`), () => {
              if (!element(cible)) return derouler(gestes, i + 1);
              partir(cible);
              plusTard(() => {
                setClic(true);
                // Un clin d'œil au moment d'agir ; il se concentre pour écrire.
                setHumeur(g.faire === 'taper' ? 'concentre' : g.faire === 'choisir' ? 'content' : 'confiant');
                plusTard(() => {
                  setClic(false);
                  const cibleFinale = element(cible);
                  if (!cibleFinale) return derouler(gestes, i + 1);
                  // Le geste est fait : le pointeur s'efface, on regarde ce qui a changé.
                  plusTard(() => setPointeVue(false), 520);
                  if (g.faire === 'cliquer') {
                    cibleFinale.click();
                    suite(tempo(950));
                  } else if (g.faire === 'choisir') {
                    ecrire(cibleFinale, g.valeur);
                    suite(tempo(850));
                  } else {
                    cibleFinale.focus({ preventScroll: true });
                    // Une saisie longue ne s'éternise pas : elle tient en deux secondes environ.
                    const pas = Math.max(22, Math.min(tempo(58), Math.round(tempo(2000) / Math.max(1, g.texte.length))));
                    const taper = (n: number): void => {
                      const champ = element(cible);
                      if (!champ) return derouler(gestes, i + 1);
                      ecrire(champ, g.texte.slice(0, n));
                      if (n >= g.texte.length) return suite(tempo(700));
                      plusTard(() => taper(n + 1), pas);
                    };
                    taper(1);
                  }
                }, 340);
              }, 780);
            });
          parler(element(cible) ?? null, dit, aQuoi, suiteDuGeste, enExemple);
        }, 320);
      };
      viser();
    };
    demarrer.current = (): void => {
      if (faits >= liste.length) return;
      annulerMinuteries();
      setPause(false);
      passe.current = null;
      setCompte(null);
      attendu.current = null;
      setLibre(false);
      setSommaire(false);
      // Solvi quitte la fiche : il apparaît là où il s'y tenait, bulle rangée, puis vole vers ce qu'il montre.
      const W = window.innerWidth;
      const H = window.innerHeight;
      const w = Math.min(440, W - 24);
      const s = panneau.current?.querySelector('.pt-solvi')?.getBoundingClientRect();
      const depart = W >= 900 && s && s.width > 0 ? { x: Math.round(Math.max(12, Math.min(W - w - 12, s.left - 5))), y: Math.round(Math.max(76, Math.min(H - 160, s.top - 42))) } : { x: W < 900 ? 12 : Math.round((W - w) / 2), y: H - 150 - (W < 900 ? 92 : 26) };
      setDureeVol(0);
      poser(depart);
      enVol.current = true;
      setVol(true);
      setSortie(false);
      setPointeVue(false);
      pointee.current = null;
      setOuvert(false);
      setPhase('demo');
      setAnnonce(decrire(liste[faits]));
      setSert(utilite(liste[faits]));
      setExemple('');
      setHumeur('neutre');
      setAllure(rythme);
      // La fiche a le temps de s'effacer avant le premier geste.
      plusTard(() => derouler(liste[faits], 0), 460);
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
      if (!annoncer) setOuvert(true);
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
      // Le pointeur : tant qu'il n'a pas de cible, il reste où il est (au départ, sur Solvi).
      const v = phase === 'demo' && pointee.current ? element(pointee.current) : null;
      const p = v?.getBoundingClientRect();
      const pt = p && p.width > 2 && p.bottom > 0 && p.top < window.innerHeight ? { x: Math.round(p.left + Math.min(p.width / 2, 120)), y: Math.round(p.top + p.height / 2) } : null;
      if (phase !== 'demo') setPoint(null);
      else if (pt) setPoint((avant) => (avant?.x === pt.x && avant?.y === pt.y ? avant : pt));
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
  /** « Continuer » : on n'attend pas la fin du temps de lecture ; une démonstration en pause repart. */
  const continuer = (): void => {
    if (suspendu) {
      reprendre();
      setPause(false);
    }
    passe.current?.();
  };
  /** Le chapitre est annoncé : on entre dans sa première étape. */
  const ouvrirChapitre = (): void => {
    setActe(false);
    noter();
    setOuvert(true);
  };
  // Lecture automatique : l'annonce d'un chapitre se referme d'elle-même.
  useEffect(() => {
    if (!acte || !lecture) return;
    const t = window.setTimeout(ouvrirChapitre, 6500);
    return () => window.clearTimeout(t);
  }, [acte, lecture]);
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
      // Pendant une démonstration, la flèche droite écourte l'attente en cours.
      if (phase === 'demo') {
        if (e.key === ' ' && !origine?.closest('button, a')) {
          e.preventDefault();
          basculerPause();
        }
        if (e.key === 'ArrowRight') continuer();
        return;
      }
      if (acte) {
        if (e.key === 'ArrowRight') ouvrirChapitre();
        return;
      }
      if (e.key === 'ArrowRight') avancer();
      if (e.key === 'ArrowLeft' && parcours > 0) setParcours(parcours - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [parcours, N, setParcours, phase, reste, acte]);

  // Il se pose : un petit écrasement. Il prend la parole : un hochement de tête. Il clique : un sursaut.
  const poseLe = useRef(0);
  const volAvant = useRef(false);
  useEffect(() => {
    if (volAvant.current && !vol) {
      poseLe.current = Date.now();
      jouerGeste('atterrit');
    }
    volAvant.current = vol;
  }, [vol, jouerGeste]);
  useEffect(() => {
    if (!annonce || vol || Date.now() - poseLe.current < 900) return;
    jouerGeste('hoche');
  }, [annonce, vol, jouerGeste]);
  useEffect(() => {
    if (clic) jouerGeste('bond');
  }, [clic, jouerGeste]);

  if (!etape || parcours === null || !data.demo) return null;
  // Où Solvi regarde : dans le sens du vol quand il se déplace, vers le pointeur quand il montre un geste, sinon vers
  // sa bulle, qu'il lit avec vous.
  const regardSolvi = ((): { x: number; y: number } => {
    if (vol) return { x: elan === 'vers-gauche' ? -1 : elan === 'vers-droite' ? 1 : 0, y: -0.2 };
    if (point && pointeVue && !sortie && pose) {
      const dx = point.x - (pose.x + 32);
      const dy = point.y - (pose.y + 32);
      const d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d };
    }
    return { x: 0.45, y: 0.1 };
  })();
  const rang = chapitres.findIndex((c) => parcours >= c.debut && parcours < c.debut + c.n);
  const ferme = !ouvert || phase === 'demo';
  return (
    <>
      {zone ? <div className={`focus-parcours${phase === 'demo' ? ' demo' : ''}`} style={zone} aria-hidden="true" /> : null}
      {point && phase === 'demo' && !libre ? (
        <div key={pointeCle} className={`pointe-parcours${clic ? ' clic' : ''}${pointeVue && !sortie ? '' : ' efface'}`} style={{ left: point.x, top: point.y }} aria-hidden="true">
          <i className="pointe-halo" />
          <MousePointer2 size={26} />
        </div>
      ) : null}
      {phase === 'demo' ? (
        <div
          ref={guide}
          className={`solvi-guide no-print${vol ? ' en-vol' : ''}${sortie ? ' part' : ''}${pause ? ' pause' : ''}${elan ? ` ${elan}` : ''}`}
          style={{ transform: `translate3d(${pose?.x ?? 12}px, ${pose?.y ?? 84}px, 0)`, transitionDuration: `${dureeVol}ms, 300ms` }}
        >
          <span className="solvi-guide-qui">
            <Solvi size={64} humeur={humeur} vivant={!vol && !pause} regard={regardSolvi} geste={gesteSolvi ?? undefined} />
          </span>
          <div className="solvi-bulle" role="status">
            <span className="solvi-bulle-tete">
              <NomSolvi className="solvi-bulle-nom" />
              <button
                type="button"
                className="solvi-rythme"
                title="Changer le temps laissé pour lire et regarder"
                onClick={() => {
                  const suivant: Rythme = allure === 'pose' ? 'normal' : allure === 'normal' ? 'vif' : 'pose';
                  choisirRythme(suivant);
                  setAllure(suivant);
                }}
              >
                <Gauge size={13} aria-hidden="true" />
                <span className="sr">Rythme </span>
                <span className="cap1">{RYTHMES[allure].nom}</span>
              </button>
              {nbTemps > 1 ? (
                <span className="solvi-pas" aria-hidden="true">
                  {Array.from({ length: nbTemps }, (_, i) => (
                    <i key={i} className={i < joues ? 'fait' : i === joues ? 'on' : ''} />
                  ))}
                </span>
              ) : null}
            </span>
            <span key={annonce} className="solvi-dit">
              <b>{annonce || etape.titre}</b>
              {sert ? <span className="solvi-sert">{sert}</span> : null}
              {exemple ? <span className="solvi-exemple">{exemple}</span> : null}
            </span>
            <span className="solvi-outils">
              <button type="button" className="solvi-pause" aria-pressed={pause} title={pause ? 'Reprendre la démonstration (barre d’espace)' : 'Mettre la démonstration en pause (barre d’espace)'} onClick={basculerPause}>
                {pause ? <CirclePlay size={15} aria-hidden="true" /> : <CirclePause size={15} aria-hidden="true" />}
                <span>{pause ? 'Reprendre' : 'Pause'}</span>
              </button>
              <button type="button" className="solvi-passer" title="Passer à l’étape suivante sans voir la fin de la démonstration" onClick={() => (dernier ? setParcours(null) : setParcours(parcours + 1))}>
                Passer
              </button>
              <button type="button" className="solvi-continuer" disabled={!compte} title="Ne pas attendre : passer tout de suite à la suite (flèche droite)" onClick={continuer}>
                {compte ? <i key={compte.cle} style={{ animationDuration: `${compte.ms}ms` }} aria-hidden="true" /> : null}
                <span>Continuer</span>
                <ArrowRight size={13} aria-hidden="true" />
              </button>
            </span>
          </div>
        </div>
      ) : null}
      {regard && !acte ? (
        <>
          <div key={`rideau-${regard.cle}`} className="pt-rideau no-print" aria-hidden="true" />
          <div key={regard.cle} className="pt-regard no-print" role="status">
            <span className="pt-regard-av" aria-hidden="true">
              <UserRound size={19} />
            </span>
            <span className="pt-regard-texte">
              <span className="tiny">Changement de regard : vous êtes maintenant</span>
              <b>{regard.qui}</b>
            </span>
          </div>
        </>
      ) : null}
      {acte && etape.chapitre ? (
        <div className="pt-acte-fond no-print">
          <section className="pt-acte" role="dialog" aria-labelledby="pt-acte-titre">
            <div className="pt-acte-tete">
              <Solvi size={66} humeur="heureux" vivant geste={{ nom: 'salue', cle: 1 }} />
              <div className="grow">
                <div className="eyebrow">
                  {SCENARIOS[scenario].titre} · chapitre {rang + 1} sur {chapitres.length}
                </div>
                <h2 id="pt-acte-titre">{etape.chapitre}</h2>
              </div>
            </div>
            <div className="pt-acte-corps">
              {rang === 0 ? <p className="pt-acte-fil">{SCENARIOS[scenario].fil}</p> : null}
              <p className="pt-acte-but">{BUTS[etape.chapitre] ?? ''}</p>
              <p className="pt-acte-qui">
                <span className="soft">Dans la peau de</span>
                {[...new Set(ETAPES.filter((x) => x.chapitre === etape.chapitre).map((x) => x.qui))].map((q, i) => (
                  <span key={q} className="pt-acte-regard">
                    {i > 0 ? <span className="soft">puis</span> : null}
                    <i style={{ background: TEINTE_DE[q] ?? 'var(--n-4)' }} aria-hidden="true" />
                    <b>{q.toLowerCase() === 'un collègue' ? 'un collègue' : q}</b>
                  </span>
                ))}
              </p>
              <ol className="pt-acte-plan" aria-label="Les chapitres de la visite">
                {chapitres.map((c, i) => (
                  <li key={c.titre} className={i < rang ? 'fait' : i === rang ? 'on' : ''} aria-current={i === rang ? 'step' : undefined}>
                    <span className="num" aria-hidden="true">
                      {i < rang ? <Check size={13} /> : i + 1}
                    </span>
                    <span className="grow">{c.titre}</span>
                    <span className="tiny soft">
                      {c.n} étape{c.n > 1 ? 's' : ''}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="pt-acte-pied">
              <button type="button" className="btn sm ghost" onClick={() => setParcours(null)}>
                Quitter la visite
              </button>
              <span className="grow" />
              <button type="button" className="btn primary" data-acte="go" onClick={ouvrirChapitre} autoFocus>
                {rang === 0 ? 'Commencer' : 'Continuer'} <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <aside ref={panneau} className={`parcours-test no-print${ferme ? ' ferme' : ''}`} aria-label="Parcours guidé" aria-hidden={ferme} {...(ferme ? { inert: '' } : {})} style={place ? { left: place.left, top: place.top, right: 'auto', bottom: 'auto' } : undefined}>
        <div className="row" style={{ gap: 10 }}>
          <span className="pt-solvi" aria-hidden="true">
            <Solvi size={54} humeur={phase === 'fini' ? (dernier ? 'joyeux' : 'heureux') : 'neutre'} vivant={!ferme} />
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
              <div className="pt-annonce">
                <span className="pt-annonce-ico" aria-hidden="true">
                  <MousePointer2 size={16} />
                </span>
                <span>
                  <b>Démonstration en {nbTemps > 1 ? `${nbTemps} gestes` : 'un geste'}.</b> Solvi le fait à l’écran, vous regardez. Vous pouvez la mettre en pause à tout moment.
                </span>
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
            <button type="button" className="btn sm ghost pt-passer" title="Aller à l’étape suivante sans voir la démonstration" onClick={() => setParcours(parcours + 1)}>
              Passer
            </button>
          ) : null}
          {reste ? (
            <button ref={action} type="button" className="btn sm primary pt-voir" data-suite="geste" onClick={avancer}>
              <Play size={15} aria-hidden="true" /> Voir la démonstration
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
  complet: { nom: 'Complet', phrase: 'Tout Solvéa, de la création au bilan.', mots: ['Installer', 'Construire', 'Décider'], teinte: 'v-titulaire', icone: <Sparkles size={30} /> },
  titulaire: { nom: 'Titulaire', phrase: 'Gérer la pharmacie au quotidien.', mots: ['Construire', 'Décider', 'Bilan'], teinte: 'v-titulaire2', icone: <Crown size={30} /> },
  pharmacien: { nom: 'Pharmacien', phrase: 'Votre planning et vos gardes.', mots: ['Planning', 'Demandes', 'Gardes'], teinte: 'v-pharmacien', icone: <PillIcon size={30} /> },
  equipe: { nom: 'Préparateur', phrase: 'Votre espace, pas à pas.', mots: ['Planning', 'Demandes', 'Suivi'], teinte: 'v-equipe', icone: <FlaskConical size={30} /> },
  animateur: { nom: 'Animatrice', phrase: 'Ses jours d’animation et ses marques.', mots: [], teinte: 'v-animateur', icone: <Megaphone size={22} /> },
  apprenti: { nom: 'Apprentie', phrase: 'Son alternance, ses jours d’école.', mots: [], teinte: 'v-apprenti', icone: <Sprout size={22} /> },
  etudiant: { nom: 'Étudiant', phrase: 'Ses horaires autour de ses cours.', mots: [], teinte: 'v-etudiant', icone: <GraduationCap size={22} /> },
  etabli: { nom: 'Journée ordinaire', phrase: 'Du matin au soir, tous les rôles.', mots: [], teinte: 'v-journee', icone: <Store size={22} /> },
  tension: { nom: 'Journée sous tension', phrase: 'Un arrêt, un retard, un accident.', mots: [], teinte: 'v-tension', icone: <Siren size={22} /> },
  publication: { nom: 'Veille de publication', phrase: 'Construire, publier, faire le bilan.', mots: [], teinte: 'v-publication', icone: <CalendarCheck size={22} /> },
};
const GROUPES: { cle: (typeof SCENARIOS)[Scenario]['groupe']; titre: string; phrase: string }[] = [
  { cle: 'parcours', titre: 'Les parcours', phrase: 'Le plus complet d’abord, puis un parcours par rôle.' },
  { cle: 'metiers', titre: 'Les autres métiers', phrase: 'Chaque profil a son accueil : animatrice, apprentie, étudiant.' },
  { cle: 'journees', titre: 'Une journée type, trois scénarios', phrase: 'La pharmacie tourne déjà : on la suit du matin au soir.' },
];

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
            <p>Choisissez une visite : chacune raconte une histoire, chapitre après chapitre. Ou entrez librement.</p>
          </div>
          <button type="button" className="dialog-fermer" onClick={() => ouvrirTutoriels(false)} aria-label="Fermer" autoFocus>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="dc-corps">
          <ChoixRythme />
          {GROUPES.map((g) => {
            const cles = (Object.keys(SCENARIOS) as Scenario[]).filter((cle) => SCENARIOS[cle].groupe === g.cle);
            const grandes = g.cle === 'parcours';
            return (
              <section key={g.cle} className="dc-groupe" aria-labelledby={`dc-${g.cle}`}>
                <div className="dc-groupe-tete">
                  <h3 className="dc-sous" id={`dc-${g.cle}`}>
                    {g.titre}
                  </h3>
                  <span className="small soft">{g.phrase}</span>
                </div>
                <div className={`choix-parcours${grandes ? '' : ' compactes'}`}>
                  {cles.map((cle) => {
                    const c = CARTES[cle];
                    const [temps, etapes] = SCENARIOS[cle].duree.split(' · ');
                    return grandes ? (
                      <article key={cle} className={`cp-carte ${c.teinte}`} data-scenario={cle}>
                        <div className="cp-visuel">
                          <span className="cp-temps">
                            {temps}
                            <span className="cp-etapes"> · {etapes}</span>
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
                    ) : (
                      <article key={cle} className={`cp-carte cp-compacte ${c.teinte}`} data-scenario={cle}>
                        <span className="cp-ico" aria-hidden="true">
                          {c.icone}
                        </span>
                        <div className="cp-texte">
                          <h3>{c.nom}</h3>
                          <p className="cp-phrase">{c.phrase}</p>
                          <span className="cp-duree">
                            {temps} · {etapes}
                          </span>
                        </div>
                        <button type="button" className="btn sm" onClick={() => lancerParcours(cle)}>
                          <Play size={14} aria-hidden="true" /> Lancer <span className="sr">la visite {c.nom}</span>
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <div className="dc-libre">
            <div className="dc-groupe-tete">
              <h3 className="dc-sous">Ou entrer librement, en testeur</h3>
              <span className="small soft">Sans guide : choisissez un profil et essayez tout. Les données d’exemple se remettent à neuf quand vous voulez.</span>
            </div>
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

/**
 * Le menu de l'environnement de test. Il s'ouvre depuis l'étiquette « Espace … » de la barre du haut : on y change de
 * profil, on y lance les tutoriels, on y remet les données d'exemple à neuf. Aucune barre ne s'ajoute à la page.
 */
export function MenuTest({ moi, onClose }: { moi: string; onClose: () => void }): JSX.Element {
  const { ouvrirTutoriels, scenario } = useUi();
  const personnes = useStore((s) => s.data.personnes);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button[aria-pressed="true"]')?.focus();
    const fermer = (e: MouseEvent | KeyboardEvent): void => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.parentElement?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', fermer);
    document.addEventListener('keydown', fermer);
    return () => {
      document.removeEventListener('mousedown', fermer);
      document.removeEventListener('keydown', fermer);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="bandeau-test menu-test no-print" role="dialog" aria-label="Environnement de test">
      <div className="bt-tete">
        <FlaskConical size={18} aria-hidden="true" />
        <div>
          <b>Environnement de test</b>
          <span className="small soft">Des données d’exemple. Changez de profil pour voir chaque espace.</span>
        </div>
      </div>
      <div className="bt-roles" role="group" aria-label="Voir l’application comme">
        {ROLES_TEST.map((r) => (
          <button
            key={r.cle}
            type="button"
            className={moi === r.id ? 'on' : ''}
            aria-pressed={moi === r.id}
            disabled={!personnes.some((p) => p.id === r.id)}
            onClick={() => {
              onClose();
              voirComme(r.identifiant);
            }}
          >
            <b>{r.court}</b>
            <span className="small">{r.titre}</span>
          </button>
        ))}
      </div>
      <div className="bt-actions">
        <button
          type="button"
          className="btn sm primary"
          onClick={() => {
            onClose();
            ouvrirTutoriels(true);
          }}
        >
          <Play size={14} aria-hidden="true" /> Tutoriels
        </button>
        <button
          type="button"
          className="btn sm"
          onClick={() => {
            onClose();
            lancerParcours(scenario);
          }}
          title="Remet les données d’exemple à neuf et reprend le parcours à l’étape 1"
        >
          <RotateCcw size={14} aria-hidden="true" /> Réinitialiser
        </button>
      </div>
    </div>
  );
}
