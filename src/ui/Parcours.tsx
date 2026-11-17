import { ArrowLeft, ArrowRight, Check, Crown, FlaskConical, ListTree, MousePointerClick, Pause, Pill as PillIcon, Play, RotateCcw, Store, Undo2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { peutGerer } from '../domain/acces';
import { addDays, mondayOf } from '../domain/time';
import type { AppData, Remplacement } from '../domain/types';
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
  { cle: 't1', id: 'p_helene', identifiant: 'helene.marchetti', court: 'Titulaire 1', titre: 'Titulaire principale', nom: 'Hélène Marchetti', detail: 'Tous les droits : tableau de bord, plannings, équipe, gardes, réglages.' },
  { cle: 't2', id: 'p_antoine', identifiant: 'antoine.mercier', court: 'Titulaire 2', titre: 'Titulaire secondaire', nom: 'Antoine Mercier', detail: 'Mêmes écrans que la titulaire principale ; ses décisions attendent son accord.' },
  { cle: 'ph', id: 'p_karim', identifiant: 'karim.benali', court: 'Pharmacien', titre: 'Pharmacien adjoint', nom: 'Karim Benali', detail: 'Son planning, le planning publié, ses gardes, ses messages.' },
  { cle: 'pr', id: 'p_camille', identifiant: 'camille.roussel', court: 'Préparateur', titre: 'Préparatrice', nom: 'Camille Roussel', detail: 'Ses horaires, ses demandes, les remplacements, ses messages.' },
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
/** La visite clique elle-même sur un bouton de l'écran, comme le ferait l'utilisateur. */
const cliquer = (selecteur: string): void => document.querySelector<HTMLElement>(selecteur)?.click();
const demandeDeCamille = (d: AppData): Remplacement | undefined => d.remplacements.find((r) => r.demandeur === 'p_camille' && r.statut === 'ouverte');
const prenom = (d: AppData, id: string | undefined): string => d.personnes.find((p) => p.id === id)?.prenom ?? 'un collègue';

/** Collègue libre qui peut reprendre le poste sans enfreindre une règle ; à qualification égale d'abord. */
function volontairePour(d: AppData, r: Remplacement): string | undefined {
  const demandeur = d.personnes.find((p) => p.id === r.demandeur);
  const possibles = d.personnes.filter((p) => peutRemplacer(d, r, p) && evaluerRemplacement(d, r, p.id).ok);
  return (possibles.find((p) => p.qualification === demandeur?.qualification) ?? possibles[0])?.id;
}

/** Premier poste publié à venir de Camille qu'un autre préparateur, de préférence, peut reprendre. */
function posteARemplacer(d: AppData, today: string): string | null {
  const postes = d.shifts.filter((s) => s.personId === 'p_camille' && peutDemanderRemplacement(d, s.date, today) && d.semaines[mondayOf(s.date)]?.statut === 'publie').sort((a, b) => a.date.localeCompare(b.date));
  const essai = (s: (typeof postes)[number]): Remplacement => ({ id: 'essai', shiftId: s.id, demandeur: 'p_camille', date: s.date, start: s.start, end: s.end, creeLe: '', volontaires: [], statut: 'ouverte' });
  const prepa = postes.find((s) => d.personnes.find((p) => p.id === volontairePour(d, essai(s)))?.qualification === 'preparateur');
  return (prepa ?? postes.find((s) => volontairePour(d, essai(s))))?.id ?? null;
}

interface Etape {
  /** Chapitre de la visite ; le sommaire permet de sauter de l'un à l'autre. */
  chapitre?: string;
  /** Élément mis en lumière pendant l'étape (sélecteur CSS). */
  cible?: string;
  /** Bouton sur lequel la visite « clique » : un repère s'y pose avant l'action. */
  pointe?: string;
  qui: string;
  titre: string;
  texte: (d: AppData) => string;
  /** Pose l'écran de l'étape. Peut être rejouée à tout moment : elle remet en place ce dont l'étape a besoin. */
  jouer: () => void;
  /** Second temps : l'action est faite sous les yeux de l'utilisateur, après un court délai. */
  puis?: { apres?: number; jouer: () => void; cible?: string };
}

/** Lance l'appel à l'équipe sur le premier poste à couvrir et fait répondre deux collègues, pour montrer le tour de rôle. */
function appelEnCours(): void {
  const s = store();
  const trou = s.data.trous.find((t) => t.statut === 'ouvert' && t.shift.date >= s.today);
  if (!trou) return;
  if (!s.data.remplacements.some((r) => r.trouId === trou.id && r.statut === 'ouverte')) s.appelerEquipe(trou.id);
  const appel = store().data.remplacements.find((r) => r.trouId === trou.id && r.statut === 'ouverte');
  if (appel && !appel.volontaires.length) (appel.sollicites ?? []).filter((id) => id !== 'p_helene').slice(0, 2).forEach((id) => store().seProposer(appel.id, id, true));
}

/** La titulaire a dit oui à la demande de Camille : l'équipe disponible est prévenue. */
function accepterDemandeDeCamille(): void {
  const r = demandeDeCamille(store().data);
  if (r?.accord === 'attente') store().deciderDemande(r.id, true);
}

const APPEL: Etape = {
  qui: 'Hélène · titulaire principale',
  cible: "[data-focus='appel']",
  titre: 'Une absence à couvrir : personne n’est mis à l’écart',
  texte: () => 'Hélène lance un appel : tous ceux qui peuvent tenir le poste sont prévenus en même temps, avec le même message. Entre volontaires, le poste revient à celui qui a le moins dépanné depuis trois mois. Dire non ne change le rang de personne.',
  jouer: () => {
    voirComme('helene.marchetti', 'resoudre');
    appelEnCours();
    useUi.getState().setSujet('absences');
  },
};

const SOUHAITS: Etape = {
  qui: 'Camille · préparatrice',
  cible: '.sh-cal',
  titre: 'Mes souhaits du mois',
  texte: () => 'Camille choisit une forme (matin, journée, après-midi, repos) et clique les jours ; « M’assister » remplit le reste d’après ses habitudes. Elle voit l’effectif annoncé par l’équipe, jamais les raisons de chacun.',
  jouer: () => versDemandes('camille.roussel', 'souhaits'),
};

const MOIS_ENTIER: Etape = {
  qui: 'Hélène · titulaire principale',
  cible: "[data-focus='mois']",
  titre: 'Le mois d’un coup d’œil',
  texte: () => 'Objectif d’équipe jour par jour, heures de chacun face à son contrat, souhaits déjà posés. « Corriger automatiquement » recalcule les semaines en brouillon en suivant les souhaits, sans jamais passer devant une règle.',
  jouer: () => {
    voirComme('helene.marchetti', 'construire');
    useUi.getState().setPlanVue('mois');
  },
};

const HEURES: Etape = {
  qui: 'Hélène · titulaire principale',
  cible: "[data-focus='compteurs-heures']",
  titre: 'Le compteur d’heures',
  texte: () => 'Heures en plus ou en moins de chacun, face à son contrat. Hélène régularise à la main (payer, faire récupérer, faire rattraper) ou clique sur « Régulariser automatiquement » : le calcul résorbe les écarts sur la prochaine semaine à construire.',
  jouer: () => voirComme('helene.marchetti', 'heures'),
};

const ETABLI: Etape[] = [
  {
    qui: 'Hélène · titulaire principale',
    cible: ".tb-faire",
    titre: 'La journée commence sur le tableau de bord',
    texte: () => 'Hélène voit d’un coup d’œil les décisions en attente, la couverture pharmacien de la semaine et l’équipe du jour. Elle seule a tous les droits.',
    jouer: () => voirComme('helene.marchetti', 'tableau'),
  },
  APPEL,
  {
    qui: 'Camille · préparatrice',
    cible: ".prochain",
    titre: 'Une préparatrice consulte ses horaires',
    texte: (d) => {
      const r = demandeDeCamille(d);
      return r ? 'Aujourd’hui, demain, la suite : tout est en haut de « Mon planning ». Camille a demandé à être remplacée, sans donner de raison, et Hélène a accepté : les collègues qui peuvent tenir le poste sont prévenus. À moins de 7 jours, la demande devient urgente ; une urgence médicale passe en premier, avec un justificatif si besoin.' : 'Aujourd’hui, demain, la suite : tout est en haut de « Mon planning », avec la carte « Me faire remplacer ».';
    },
    jouer: () => {
      const s = store();
      if (!demandeDeCamille(s.data)) {
        const cible = posteARemplacer(s.data, s.today);
        const poste = s.data.shifts.find((x) => x.id === cible);
        if (poste) s.demanderRemplacement(poste);
        accepterDemandeDeCamille();
      }
      voirComme('camille.roussel', 'moi');
    },
  },
  {
    qui: 'Un collègue',
    cible: "[data-focus='aider']",
    titre: 'Un collègue libre se propose',
    texte: (d) => {
      const r = demandeDeCamille(d);
      return r?.volontaires.length ? `${prenom(d, r.volontaires[0])} voit la demande de Camille en haut de son planning et vient de cliquer sur « Je me propose ». Rien n’est encore décidé : la titulaire doit valider.` : 'Les collègues qui ont la bonne qualification voient la demande en haut de leur planning et peuvent se proposer.';
    },
    jouer: () => {
      const s = store();
      const r = demandeDeCamille(s.data);
      if (!r) return voirComme('camille.roussel', 'moi');
      const volontaire = r.volontaires[0] ?? volontairePour(s.data, r);
      if (!volontaire) return voirComme('camille.roussel', 'moi');
      if (!r.volontaires.includes(volontaire)) s.seProposer(r.id, volontaire, true);
      voirComme(s.data.personnes.find((p) => p.id === volontaire)?.identifiant ?? 'camille.roussel', 'moi');
    },
  },
  {
    qui: 'Hélène · titulaire principale',
    cible: ".panneau",
    titre: 'La titulaire valide le remplacement',
    texte: (d) => {
      const r = demandeDeCamille(d);
      return r?.volontaires.length ? `Dans « Résoudre », onglet « Remplacements » : les demandes sont triées par urgence. Le moteur a relu les règles pour ${prenom(d, r.volontaires[0])} et annonce les heures en plus. Cliquez sur « Valider avec ${prenom(d, r.volontaires[0])} » : les deux personnes sont prévenues, le compteur d’heures suit.` : 'Dans « Résoudre », chaque décision annonce ses conséquences avant d’être prise : absences à couvrir, remplacements, demandes, gardes.';
    },
    jouer: () => {
      useUi.getState().setSujet('remplacements');
      voirComme('helene.marchetti', 'resoudre');
    },
  },
  SOUHAITS,
  {
    qui: 'Karim · pharmacien adjoint',
    cible: ".content .card",
    titre: 'Un pharmacien suit ses gardes',
    texte: () => 'Karim n’a pas accès à la gestion. Il voit son planning, le planning publié de l’équipe et « Mes gardes » : dates, repos qui suit, récupérations.',
    jouer: () => voirComme('karim.benali', 'mesgardes'),
  },
  {
    qui: 'Antoine · titulaire secondaire',
    cible: ".panneau",
    titre: 'Un titulaire secondaire décide… à deux',
    texte: (d) => {
      const a = (d.accords ?? []).find((x) => x.auteur === 'p_antoine');
      return a ? `Antoine a les mêmes écrans qu’Hélène. Il vient de décider : « ${a.titre} ». Rien n’est appliqué : sa décision attend l’accord d’Hélène (onglet « En attente d’accord »).` : 'Antoine a les mêmes écrans qu’Hélène. Chacune de ses décisions attend l’accord de la titulaire principale avant d’être appliquée.';
    },
    jouer: () => {
      const s = store();
      if (!(s.data.accords ?? []).some((x) => x.auteur === 'p_antoine')) {
        const garde = s.data.gardes.find((g) => !g.personId && g.date >= s.today);
        if (garde) s.proposer('p_antoine', 'affecterGarde', [garde.id, 'p_antoine', false]);
      }
      useUi.getState().setSujet('accords');
      voirComme('antoine.mercier', 'resoudre');
    },
  },
  {
    qui: 'Hélène · titulaire principale',
    cible: ".panneau",
    titre: 'La titulaire principale donne son accord',
    texte: (d) => ((d.accords ?? []).length ? 'Dans « Résoudre », onglet « Accords à donner » : cliquez sur « Donner mon accord ». La décision d’Antoine est alors appliquée, et il en est prévenu par message.' : 'Les décisions d’Antoine arrivent dans « Résoudre », onglet « Accords à donner ». Ici, tout est à jour.'),
    jouer: () => {
      useUi.getState().setSujet('accords');
      voirComme('helene.marchetti', 'resoudre');
    },
  },
  {
    qui: 'Hélène · titulaire principale',
    cible: ".dialog",
    titre: 'Une journée : pauses et retards',
    texte: () => 'Un clic sur un jour ouvre toute l’équipe sur une même ligne de temps. Hélène y règle la pause déjeuner de chacun et note un retard en deux clics.',
    jouer: () => {
      voirComme('helene.marchetti', 'construire');
      useUi.getState().setSemaine(mondayOf(store().today));
      useUi.getState().voirJour(store().today);
    },
  },
  {
    qui: 'Hélène · titulaire principale',
    cible: "[data-tour='proposer']",
    titre: 'Construire la semaine prochaine',
    texte: () => 'Cliquez sur « Proposer un planning » : trois propositions comparables (équité, souhaits, coût). Les couleurs situent chaque poste dans la journée ; survolez un jour signalé dans « Couverture » pour lire le problème.',
    jouer: () => {
      voirComme('helene.marchetti', 'construire');
      // L'exemple a deux semaines publiées d'avance : la semaine à construire est la troisième.
      useUi.getState().setSemaine(addDays(mondayOf(store().today), 21));
    },
  },
  MOIS_ENTIER,
  HEURES,
];

// ---------------------------------------------------------------- Visite complète, pas à pas

const semaineDans = (n: number): string => addDays(mondayOf(store().today), 7 * n);
const helene = (vue: Vue): void => voirComme('helene.marchetti', vue);

/** Construit puis pose le planning d'une semaine encore vide ; ne touche pas une semaine déjà remplie. */
function proposerSemaine(monday: string): void {
  const s = store();
  if (s.data.shifts.some((x) => x.date >= monday && x.date <= addDays(monday, 6))) return;
  s.appliquerGeneration(monday, generer(s.data, monday, { variante: 'equite', graine: 7, iterations: 9000 }));
}
function publierSemaine(monday: string): void {
  proposerSemaine(monday);
  if (store().data.semaines[monday]?.statut !== 'publie') store().publier(monday, [], 0);
}

// ---------------------------------------------------------------- Visite « de zéro » : tout Solvéa, dans l'ordre où on s'en sert

/** Minuteries d'une étape (arrivées une à une, clic simulé) : annulées dès qu'on change d'étape. */
let minuteries: number[] = [];
const plusTard = (fn: () => void, ms: number): void => {
  minuteries.push(window.setTimeout(fn, ms));
};
const annulerMinuteries = (): void => {
  minuteries.forEach((t) => window.clearTimeout(t));
  minuteries = [];
};

/** Mise en place directe des données de démonstration, sans passer par le journal. */
const poser = (fn: (d: AppData) => AppData): void => useStore.setState((s) => ({ data: fn(s.data) }));
/** L'équipe d'exemple et ses contraintes reconnues, sans aucun planning. */
const reference = (): AppData => seed(store().today, -99);

function avecEquipe(): void {
  const ref = reference();
  poser((d) => (ref.personnes.every((p) => d.personnes.some((x) => x.id === p.id)) ? d : { ...d, personnes: ref.personnes.map((p) => d.personnes.find((x) => x.id === p.id) ?? p), besoins: d.besoins.length ? d.besoins : ref.besoins }));
}

/** Souhaits du mois à collecter, d'après les habitudes, avec quelques demi-journées pour varier. */
function souhaitsPour(id: string): void {
  const s = store();
  const p = s.data.personnes.find((x) => x.id === id);
  const mois = moisACollecter(s.data.officine, s.today);
  if (!p || (s.data.souhaits ?? []).some((x) => x.personId === id && x.date.startsWith(mois))) return;
  s.poserSouhaits(proposerSouhaits(s.data, p, mois, s.today).map((x, i) => (i % 7 === 3 ? { ...x, choix: 'matin' as const } : i % 9 === 5 ? { ...x, choix: 'soir' as const } : i % 11 === 8 ? { ...x, choix: 'repos' as const } : x)));
}
function avecSouhaits(camille = true): void {
  avecEquipe();
  ['p_lea', 'p_thomas', 'p_manon', 'p_ines', 'p_jules', 'p_antoine', ...(camille ? ['p_camille'] : [])].forEach(souhaitsPour);
}

function avecPlanning(): void {
  avecSouhaits();
  publierSemaine(semaineDans(1));
  publierSemaine(semaineDans(2));
}

/** Camille a demandé à être remplacée : la demande attend la réponse de sa titulaire. */
function avecDemande(): void {
  avecPlanning();
  const s = store();
  if (demandeDeCamille(s.data)) return;
  const poste = s.data.shifts.find((x) => x.id === posteARemplacer(s.data, s.today));
  if (poste) s.demanderRemplacement(poste, 'prevu');
}
function avecDemandeAcceptee(): void {
  avecDemande();
  accepterDemandeDeCamille();
}
function avecVolontaire(): string | undefined {
  avecDemandeAcceptee();
  const r = demandeDeCamille(store().data);
  const v = r ? (r.volontaires[0] ?? volontairePour(store().data, r)) : undefined;
  if (r && v && !r.volontaires.includes(v)) store().seProposer(r.id, v, true);
  return v;
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

/** Le poste à couvrir que l'écran montre en premier : le plus proche dont l'absence découvre vraiment quelque chose. */
function trouVisible(): string | undefined {
  const s = store();
  const ouverts = s.data.trous.filter((t) => t.statut === 'ouvert' && t.shift.date >= s.today).sort((a, b) => a.shift.date.localeCompare(b.shift.date));
  return (ouverts.find((t) => manque(s.data, t.shift.date) > manque({ ...s.data, shifts: s.data.shifts.concat(t.shift) }, t.shift.date)) ?? ouverts[0])?.id;
}
function lancerAppel(): void {
  const id = trouVisible();
  if (!id) return;
  if (!store().data.remplacements.some((r) => r.trouId === id && r.statut === 'ouverte')) store().appelerEquipe(id);
  const appel = store().data.remplacements.find((r) => r.trouId === id && r.statut === 'ouverte');
  if (appel && !appel.volontaires.length) (appel.sollicites ?? []).filter((x) => x !== 'p_helene').slice(0, 2).forEach((x) => store().seProposer(appel.id, x, true));
}

function avecGardes(): void {
  avecPlanning();
  const s = store();
  if (s.data.gardes.length) return;
  s.ajouterGardes([{ date: addDays(semaineDans(3), 5), start: 19 * 60 + 30, end: 8 * 60 + 30, type: 'volets_fermes', personId: 'p_lea', interventions: [] }], true);
  store().ajouterGardes([{ date: addDays(semaineDans(5), 6), start: 9 * 60, end: 19 * 60, type: 'volets_ouverts', personId: null, interventions: [] }], false);
}
function avecAccordEnAttente(): void {
  avecGardes();
  const s = store();
  if ((s.data.accords ?? []).some((x) => x.auteur === 'p_antoine')) return;
  const garde = s.data.gardes.find((g) => !g.personId && g.date >= s.today);
  if (garde) s.proposer('p_antoine', 'affecterGarde', [garde.id, 'p_antoine', false]);
}

const INSTALLER = 'Installer la pharmacie';
const CONSTRUIRE = 'Construire le planning';
const EQUIPE = 'Côté équipe';
const IMPREVUS = 'Demandes et imprévus';
const TEMPS_FORTS = 'Gardes, formations, inventaires';
const PILOTER = 'Décider à deux, suivre, piloter';

const COMPLET: Etape[] = [
  {
    chapitre: INSTALLER,
    qui: 'Hélène · titulaire',
    cible: '.accueil-form',
    titre: 'Tout part de trois écrans',
    texte: () => 'Le nom, les horaires d’ouverture, puis l’équipe : c’est le formulaire que vous remplirez pour créer votre pharmacie. Dans cette visite, la Pharmacie des Tilleuls vient d’être créée. Il n’y a encore ni équipe ni planning : on construit tout ensemble.',
    jouer: () => helene('nouvelle'),
  },
  {
    chapitre: INSTALLER,
    qui: 'Hélène · titulaire',
    cible: '.content .split',
    titre: 'Horaires et effectif attendu',
    texte: () => 'À gauche, les horaires jour par jour, avec la coupure du midi si vous fermez. À droite, l’effectif minimal au comptoir pour chaque tranche : c’est lui que le planning cherche à tenir, après la présence d’un pharmacien.',
    jouer: () => helene('officine'),
  },
  {
    chapitre: INSTALLER,
    qui: 'Hélène · titulaire',
    cible: "[data-focus='modele']",
    titre: 'Classique ou collaboratif',
    texte: () => 'Collaboratif : chacun pose ses souhaits du mois avant une date limite, puis vous ajustez. Classique : vous construisez seule, l’équipe consulte. Vous changez d’avis quand vous voulez.',
    jouer: () => helene('officine'),
  },
  {
    chapitre: INSTALLER,
    qui: 'Hélène · titulaire',
    cible: '.content .split > :first-child',
    pointe: "[data-focus='ajouter-personne']",
    titre: 'Ajouter l’équipe',
    texte: (d) => (d.personnes.length > 1 ? `${d.personnes.length} personnes sont maintenant dans l’équipe : un second titulaire, deux pharmaciens adjoints, des préparateurs, une animatrice, une apprentie, un étudiant. Chaque poste a sa couleur. Chacune a reçu son compte de connexion.` : '« Ajouter une personne » : prénom, nom, métier, heures du contrat. Regardez l’équipe arriver.'),
    jouer: () => helene('equipe'),
    puis: {
      jouer: () => {
        const ref = reference();
        const manquants = ref.personnes.filter((p) => !store().data.personnes.some((x) => x.id === p.id));
        manquants.forEach((p, i) => plusTard(() => poser((d) => (d.personnes.some((x) => x.id === p.id) ? d : { ...d, personnes: d.personnes.concat(p) })), i * 240));
        plusTard(() => poser((d) => (d.besoins.length ? d : { ...d, besoins: ref.besoins })), manquants.length * 240 + 60);
      },
    },
  },
  {
    chapitre: INSTALLER,
    qui: 'Hélène · titulaire',
    cible: '.content .split > :last-child',
    titre: 'Une fiche : contrat, compétences, compte',
    texte: () => 'La fiche de Camille : heures du contrat, compétences et diplômes (vaccination, dermatologie, phytothérapie…), contraintes d’horaires reconnues, compte de connexion avec son mot de passe provisoire. Pour un adjoint, une case donne l’accès à la gestion.',
    jouer: () => {
      avecEquipe();
      helene('equipe');
      useUi.getState().ouvrirPersonne('p_camille');
    },
  },
  {
    chapitre: INSTALLER,
    qui: 'Hélène · titulaire',
    cible: '.content .card',
    titre: 'Les règles que le planning respecte',
    texte: () => 'Durée du travail, repos, pause de 20 minutes, présence d’un pharmacien, délais de prévenance : chaque contrôle vient d’une fiche, avec sa source et sa valeur. Vous réglez aussi vos seuils de confort : plafond d’heures par semaine, samedis libres par mois.',
    jouer: () => {
      avecEquipe();
      helene('regles');
    },
  },
  {
    chapitre: CONSTRUIRE,
    qui: 'Camille · préparatrice',
    cible: '.sh-cal',
    pointe: "[data-focus='assister']",
    titre: 'Chacun pose ses souhaits du mois',
    texte: (d) => ((d.souhaits ?? []).some((x) => x.personId === 'p_camille') ? 'Le mois de Camille est rempli. Sous chaque jour, « M » et « A » comptent les collègues annoncés le matin et l’après-midi, face au seuil de la pharmacie. Elle ne donne jamais de raison.' : 'Camille choisit une forme dans la barre (matin, journée, après-midi, repos) puis clique les jours. Ou elle laisse « M’assister » remplir d’après ses habitudes : regardez.'),
    jouer: () => {
      avecSouhaits(false);
      versDemandes('camille.roussel', 'souhaits');
    },
    puis: { jouer: () => souhaitsPour('p_camille') },
  },
  {
    chapitre: CONSTRUIRE,
    qui: 'Hélène · titulaire',
    cible: '.content .plan',
    titre: 'Une semaine à construire',
    texte: () => 'La grille : une ligne par personne, une colonne par jour. Un « + » pose un poste à la main (horaires, pause, activité). Le bandeau du haut change de semaine, recopie la précédente, annule ou rétablit.',
    jouer: () => {
      avecSouhaits();
      helene('construire');
      useUi.getState().setSemaine(semaineDans(1));
    },
  },
  {
    chapitre: CONSTRUIRE,
    qui: 'Hélène · titulaire',
    cible: '.content .plan',
    pointe: '.plan-grid .add',
    titre: 'Poser un poste à la main',
    texte: () => 'Un clic sur un « + » ouvre le poste : horaires, pause, activité (comptoir, réception, administratif). Solvéa relit aussitôt les règles et dit ce qui bloque, avant même d’enregistrer.',
    jouer: () => {
      avecSouhaits();
      helene('construire');
      useUi.getState().setSemaine(semaineDans(1));
    },
    puis: { jouer: () => cliquer('.plan-grid .add'), cible: '.dialog' },
  },
  {
    chapitre: CONSTRUIRE,
    qui: 'Hélène · titulaire',
    cible: '.content .plan',
    pointe: "[data-tour='proposer']",
    titre: 'Trois propositions à comparer',
    texte: () => '« Proposer un planning » calcule trois semaines comparables : équité d’abord, souhaits d’abord, coût d’abord. Pour chacune, les points bloquants, les souhaits suivis, l’équité et le coût. Les règles impératives passent toujours avant le reste. Vous choisissez ; rien n’est publié.',
    jouer: () => {
      avecSouhaits();
      helene('construire');
      useUi.getState().setSemaine(semaineDans(1));
    },
    puis: { jouer: () => cliquer("[data-tour='proposer']"), cible: '.dialog' },
  },
  {
    chapitre: CONSTRUIRE,
    qui: 'Hélène · titulaire',
    cible: '.content .plan',
    titre: 'La semaine est posée',
    texte: () => 'La proposition « équité » est en brouillon. Jaune le matin, bleu la journée, orange en milieu de journée, violet l’après-midi : on lit la semaine d’un regard. Chaque tuile se déplace ou se corrige ; la ligne « Couverture » signale un jour sans pharmacien.',
    jouer: () => {
      avecSouhaits();
      proposerSemaine(semaineDans(1));
      helene('construire');
      useUi.getState().setSemaine(semaineDans(1));
    },
  },
  {
    chapitre: CONSTRUIRE,
    qui: 'Hélène · titulaire',
    cible: "[data-tour='controles']",
    titre: 'Les contrôles de la semaine',
    texte: () => 'Sous la grille, tout ce que Solvéa a relu : points bloquants (une règle impérative) et alertes (un seuil de l’officine). Un clic sur un contrôle montre la personne et le jour concernés. En haut, « Heures », « Coût » et « Équité » changent la lecture de la grille.',
    jouer: () => {
      avecSouhaits();
      helene('construire');
      useUi.getState().setSemaine(semaineDans(1));
      proposerSemaine(semaineDans(1));
    },
  },
  {
    chapitre: CONSTRUIRE,
    qui: 'Hélène · titulaire',
    cible: "[data-focus='mois']",
    titre: 'Le mois d’un coup d’œil',
    texte: () => 'Une lettre par jour et par personne, l’objectif d’équipe en tête de colonne, les heures de chacun face à son contrat. Les souhaits déjà posés apparaissent en gris. « Corriger automatiquement » recalcule les semaines en brouillon en les suivant.',
    jouer: () => {
      avecSouhaits();
      proposerSemaine(semaineDans(1));
      helene('construire');
      useUi.getState().setSemaine(semaineDans(1));
      useUi.getState().setPlanVue('mois');
    },
  },
  {
    chapitre: CONSTRUIRE,
    qui: 'Hélène · titulaire',
    cible: '.dialog',
    titre: 'Une journée, toute l’équipe',
    texte: () => 'Un clic sur un jour ouvre la journée : tout le monde sur la même ligne de temps. On y règle la pause déjeuner de chacun, et on y note un retard en deux clics.',
    jouer: () => {
      avecSouhaits();
      proposerSemaine(semaineDans(1));
      helene('construire');
      useUi.getState().setSemaine(semaineDans(1));
      useUi.getState().voirJour(addDays(semaineDans(1), 1));
    },
  },
  {
    chapitre: CONSTRUIRE,
    qui: 'Hélène · titulaire',
    cible: '.plan-bar',
    pointe: "[data-focus='publier']",
    titre: 'Publier : le dernier contrôle',
    texte: () => 'Tant qu’un planning est en brouillon, vous seule le voyez. « Publier » relit une dernière fois les règles et les délais de prévenance, et vous dit ce que vous assumez si un point reste ouvert.',
    jouer: () => {
      avecSouhaits();
      proposerSemaine(semaineDans(1));
      helene('construire');
      useUi.getState().setSemaine(semaineDans(1));
    },
    puis: { jouer: () => cliquer("[data-focus='publier']"), cible: '.dialog' },
  },
  {
    chapitre: CONSTRUIRE,
    qui: 'Hélène · titulaire',
    cible: '.plan-bar',
    titre: 'C’est publié',
    texte: () => 'Toute l’équipe voit maintenant cette semaine. Chaque changement ultérieur sera annoncé à la personne concernée, avant → après, avec un accusé de lecture.',
    jouer: () => {
      avecPlanning();
      helene('construire');
      useUi.getState().setSemaine(semaineDans(1));
    },
  },
  {
    chapitre: EQUIPE,
    qui: 'Camille · préparatrice',
    cible: '.prochain',
    titre: 'Mon planning',
    texte: () => 'Camille ouvre l’application : son prochain poste est écrit en grand, avec la pause et la durée. Dessous, sa semaine jour par jour. Elle ne voit jamais un brouillon.',
    jouer: () => {
      avecPlanning();
      voirComme('camille.roussel', 'moi');
    },
  },
  {
    chapitre: EQUIPE,
    qui: 'Camille · préparatrice',
    cible: 'table.cal',
    titre: 'Le calendrier du mois',
    texte: () => '« Calendrier » montre le mois entier, avec les horaires dans chaque case. Un clic sur un jour affiche toute l’équipe ce jour-là.',
    jouer: () => {
      avecPlanning();
      voirComme('camille.roussel', 'moi');
      useUi.getState().agir('moi', 'calendrier');
    },
  },
  {
    chapitre: EQUIPE,
    qui: 'Camille · préparatrice',
    cible: '.content .plan',
    titre: 'Le planning de toute l’équipe',
    texte: () => 'Qui travaille quand : la version publiée, en couleurs, sa propre ligne mise en avant. « Mes postes » ne garde que la sienne. Rien ne se modifie ici : on passe par une demande.',
    jouer: () => {
      avecPlanning();
      voirComme('camille.roussel', 'planning');
      useUi.getState().setSemaine(semaineDans(1));
    },
  },
  {
    chapitre: EQUIPE,
    qui: 'Camille · préparatrice',
    cible: '.onglets',
    titre: 'Mes demandes : trois onglets',
    texte: () => 'Souhaits du mois : ce que Camille préfère, sans réponse à attendre. Absences et horaires : ce qu’elle demande à sa titulaire. Remplacements : un poste qu’elle ne peut pas tenir. Chaque onglet rappelle à quoi il sert.',
    jouer: () => {
      avecPlanning();
      versDemandes('camille.roussel', 'absences');
    },
  },
  {
    chapitre: EQUIPE,
    qui: 'Camille · préparatrice',
    cible: '.dialog',
    titre: 'Une absence ou une contrainte, sans raison',
    texte: () => 'Congé, formation, horaire à tenir : un formulaire, des dates. Garde d’enfant, pratique religieuse, cours du soir : un raccourci remplit les horaires, mais aucun motif n’est demandé ni conservé.',
    jouer: () => {
      avecPlanning();
      voirComme('camille.roussel', 'demandes');
      useUi.getState().agir('demandes', 'demande');
    },
  },
  {
    chapitre: EQUIPE,
    qui: 'Camille · préparatrice',
    cible: "[data-focus='remplacer']",
    titre: 'Se faire remplacer : trois niveaux d’urgence',
    texte: () => 'Camille demande à être remplacée sur un poste. Prévu, urgent (à moins de 7 jours) ou urgence médicale, avec un justificatif que seuls les titulaires voient. Sa demande attend maintenant la réponse d’Hélène.',
    jouer: () => {
      avecDemande();
      versDemandes('camille.roussel', 'remplacements');
    },
  },
  {
    chapitre: IMPREVUS,
    qui: 'Hélène · titulaire',
    cible: "[data-focus='demande-remplacement']",
    pointe: '.demande-r .btn.primary',
    titre: 'La demande arrive, triée par urgence',
    texte: (d) => (demandeDeCamille(d)?.accord === 'attente' ? 'La cloche mène droit à la demande. Les urgences médicales passent en premier, puis l’urgent, puis le prévu. Hélène répond oui ou non : regardez.' : 'Hélène a dit oui. Tous les collègues qui peuvent tenir le poste sont prévenus en même temps, avec le même message.'),
    jouer: () => {
      avecDemande();
      useUi.getState().setSujet('remplacements');
      helene('resoudre');
    },
    puis: { jouer: () => accepterDemandeDeCamille() },
  },
  {
    chapitre: IMPREVUS,
    qui: 'Un collègue',
    cible: "[data-focus='aider']",
    titre: 'Un collègue se propose',
    texte: (d) => {
      const r = demandeDeCamille(d);
      return r?.volontaires.length ? `${prenom(d, r.volontaires[0])} voit la demande en tête de son planning et vient de se proposer. Se proposer n’engage à rien tant qu’Hélène n’a pas validé.` : 'Les collègues prévenus voient la demande en tête de leur planning et peuvent se proposer.';
    },
    jouer: () => {
      const v = avecVolontaire();
      voirComme(store().data.personnes.find((p) => p.id === v)?.identifiant ?? 'camille.roussel', 'moi');
    },
  },
  {
    chapitre: IMPREVUS,
    qui: 'Hélène · titulaire',
    cible: "[data-focus='demande-remplacement']",
    pointe: '.demande-r .btn.primary',
    titre: 'Valider : les heures en plus sont annoncées',
    texte: (d) => (demandeDeCamille(d) ? 'Solvéa a relu les règles pour le volontaire et annonce ce que le poste ajoute à son contrat. Entre plusieurs volontaires, « À son tour » désigne celui qui a le moins dépanné. Hélène valide : regardez.' : 'C’est validé. Les deux personnes sont prévenues, le planning publié est à jour et le compteur d’heures du remplaçant a bougé.'),
    jouer: () => {
      avecVolontaire();
      useUi.getState().setSujet('remplacements');
      helene('resoudre');
    },
    puis: {
      jouer: () => {
        const r = demandeDeCamille(store().data);
        const v = r?.volontaires.find((id) => evaluerRemplacement(store().data, r, id).ok);
        if (r && v) store().validerRemplacement(r.id, v);
      },
      cible: '.onglets, .content .empty, .content .card',
    },
  },
  {
    chapitre: IMPREVUS,
    qui: 'Hélène · titulaire',
    cible: '.panneau',
    titre: 'Congés et demandes d’horaires',
    texte: () => 'Onglet « Demandes » : Jules demande une semaine de congé. Avant de répondre, Hélène voit ce que l’absence découvre. Pour une contrainte d’horaires, elle choisit son poids : reconnue, prioritaire ou simple préférence.',
    jouer: () => {
      avecPlanning();
      const s = store();
      if (!s.data.absences.some((x) => x.personId === 'p_jules' && x.type === 'conge')) s.declarerAbsence({ personId: 'p_jules', from: addDays(semaineDans(4), 0), to: addDays(semaineDans(4), 4), type: 'conge', statut: 'demandee' });
      useUi.getState().setSujet('demandes');
      helene('resoudre');
    },
  },
  {
    chapitre: IMPREVUS,
    qui: 'Hélène · titulaire',
    cible: '.panneau',
    titre: 'Une absence imprévue',
    texte: (d) => `${absent(d)} est en arrêt deux jours. Ses postes sont à couvrir : pour chaque jour, Solvéa dit ce que l’absence découvre et compare les options (qui est touché, ce que ça coûte, ce qu’il faut valider). « Tout régler » applique les options conseillées d’un coup.`,
    jouer: () => {
      avecAbsenceImprevue();
      useUi.getState().setSujet('absences');
      helene('resoudre');
    },
  },
  {
    chapitre: IMPREVUS,
    qui: 'Hélène · titulaire',
    cible: "[data-focus='appel']",
    pointe: '.appel .btn.primary',
    titre: 'L’appel à l’équipe : personne n’est mis à l’écart',
    texte: (d) => (d.remplacements.some((r) => r.trouId && r.statut === 'ouverte') ? 'Tous ceux qui peuvent tenir le poste ont reçu le même message, en même temps. Entre volontaires, le poste revient à celui qui a le moins dépanné depuis trois mois, au prorata de son contrat. Dire non ne change le rang de personne, et la raison est affichée pour ceux qui ne sont pas sollicités.' : 'Plutôt que d’appeler toujours les mêmes, Hélène prévient tout le monde d’un clic : regardez.'),
    jouer: () => {
      avecAbsenceImprevue();
      useUi.getState().setSujet('absences');
      helene('resoudre');
    },
    puis: { jouer: () => lancerAppel() },
  },
  {
    chapitre: TEMPS_FORTS,
    qui: 'Hélène · titulaire',
    cible: '.content .card',
    titre: 'Les gardes',
    texte: () => 'Le calendrier des gardes : une garde vient d’être ajoutée, confiée à Léa et notifiée dans la foulée. Solvéa suit le délai de 15 jours, le repos qui suit la garde, les interventions et les variables de paie. « Répartir » propose un partage équitable entre pharmaciens.',
    jouer: () => {
      avecGardes();
      helene('gardes');
    },
  },
  {
    chapitre: TEMPS_FORTS,
    qui: 'Léa · pharmacienne adjointe',
    cible: '.content .card',
    titre: 'Côté pharmacien : mes gardes',
    texte: () => 'Léa retrouve sa garde dans « Mes gardes », avec le repos qui suit et ce qui partira en paie. Elle l’a aussi reçue en tête de « Mon planning », avec un accusé de lecture. Elle n’a pas accès à la gestion.',
    jouer: () => {
      avecGardes();
      voirComme('lea.fontaine', 'mesgardes');
    },
  },
  {
    chapitre: TEMPS_FORTS,
    qui: 'Hélène · titulaire',
    cible: "[data-tour='grille']",
    titre: 'Une formation',
    texte: () => 'Depuis « Créer », une formation se planifie en trois champs : intitulé, dates, participants. Chacun est prévenu, et la formation apparaît en turquoise dans tous les plannings.',
    jouer: () => {
      avecPlanning();
      const s = store();
      const jour = addDays(semaineDans(2), 3);
      if (!s.data.absences.some((x) => x.type === 'formation')) s.planifierFormation({ intitule: 'Gestes d’urgence', personnes: ['p_thomas', 'p_ines'], from: jour, to: jour });
      helene('construire');
      useUi.getState().setSemaine(semaineDans(2));
    },
  },
  {
    chapitre: TEMPS_FORTS,
    qui: 'Hélène · titulaire',
    cible: "[data-tour='grille']",
    titre: 'Un inventaire',
    texte: () => 'Toujours depuis « Créer » : une date, un horaire, les personnes mobilisées. L’inventaire s’ajoute à leur planning, compte dans leurs heures, et chacun est prévenu.',
    jouer: () => {
      avecPlanning();
      const s = store();
      if (!s.data.shifts.some((x) => x.activite === 'inventaire')) s.planifierInventaire({ date: addDays(semaineDans(3), 2), start: 19 * 60 + 30, end: 21 * 60 + 30, personnes: ['p_thomas', 'p_ines', 'p_jules', 'p_camille'] });
      helene('construire');
      useUi.getState().setSemaine(semaineDans(3));
    },
  },
  {
    chapitre: PILOTER,
    qui: 'Antoine · titulaire secondaire',
    cible: '.panneau',
    titre: 'Deux titulaires : décider à deux',
    texte: (d) => {
      const a = (d.accords ?? []).find((x) => x.auteur === 'p_antoine');
      return a ? `Antoine a les mêmes écrans qu’Hélène. Il vient de décider : « ${a.titre} ». Rien n’est appliqué tant qu’Hélène n’a pas donné son accord.` : 'Antoine a les mêmes écrans qu’Hélène ; chacune de ses décisions attend l’accord de la titulaire principale.';
    },
    jouer: () => {
      avecAccordEnAttente();
      useUi.getState().setSujet('accords');
      voirComme('antoine.mercier', 'resoudre');
    },
  },
  {
    chapitre: PILOTER,
    qui: 'Hélène · titulaire principale',
    cible: '.panneau',
    pointe: '.panneau .btn.primary',
    titre: 'Donner son accord',
    texte: (d) => ((d.accords ?? []).length ? 'La décision d’Antoine arrive dans « Accords à donner ». Hélène l’accepte ou la refuse : regardez.' : 'Accord donné : la décision est appliquée, et Antoine en est prévenu par message. Un refus n’aurait rien appliqué.'),
    jouer: () => {
      avecAccordEnAttente();
      useUi.getState().setSujet('accords');
      helene('resoudre');
    },
    puis: {
      jouer: () => {
        const a = (store().data.accords ?? [])[0];
        if (a) store().donnerAccord(a.id);
      },
      cible: '.onglets, .content .empty, .content .card',
    },
  },
  {
    chapitre: PILOTER,
    qui: 'Hélène · titulaire',
    cible: "[data-focus='compteurs-heures']",
    titre: 'Le compteur d’heures',
    texte: () => 'Heures en plus ou en moins de chacun, face à son contrat, sur les semaines publiées. Hélène régularise à la main (payer, faire récupérer, faire rattraper), ou clique sur « Régulariser automatiquement » : les écarts sont résorbés sur la prochaine semaine à construire.',
    jouer: () => {
      avecPlanning();
      helene('heures');
    },
  },
  {
    chapitre: PILOTER,
    qui: 'Hélène · titulaire',
    cible: '.compteurs',
    titre: 'Retards et suivi',
    texte: () => 'Un retard de Jules vient d’être noté. Sa fiche compte, sur douze mois, retards, départs, absences par nature et remplacements assurés : des dates et des durées, jamais une raison.',
    jouer: () => {
      avecPlanning();
      const s = store();
      if (!(s.data.ecarts ?? []).some((e) => e.personId === 'p_jules')) s.signalerEcart({ personId: 'p_jules', date: s.today, type: 'retard', minutes: 15 });
      helene('equipe');
      useUi.getState().ouvrirPersonne('p_jules');
    },
  },
  {
    chapitre: PILOTER,
    qui: 'Camille · préparatrice',
    cible: '.content .deux',
    titre: 'Côté salarié : mon suivi',
    texte: () => 'Camille voit son propre compteur d’heures, ce qui a été noté sur douze mois et sa part des contraintes (samedis, fermetures, dépannages), au prorata de son contrat. Elle ne voit que sa position : il n’existe aucun classement.',
    jouer: () => {
      avecPlanning();
      voirComme('camille.roussel', 'suivi');
    },
  },
  {
    chapitre: PILOTER,
    qui: 'Hélène · titulaire',
    cible: '.content .card',
    titre: 'L’équité',
    texte: () => 'Samedis, fermetures, gardes, dépannages, changements tardifs : qui a porté quoi, face à sa part attendue. Le calcul des plannings s’en sert pour rééquilibrer les semaines suivantes.',
    jouer: () => {
      avecPlanning();
      helene('equite');
    },
  },
  {
    chapitre: PILOTER,
    qui: 'Hélène · titulaire',
    cible: '.fil',
    titre: 'Les messages',
    texte: () => 'Un fil pour toute l’équipe, et des conversations privées. Pour une absence ou un horaire, mieux vaut une demande : elle est suivie et tracée.',
    jouer: () => {
      avecEquipe();
      const s = store();
      if (!s.data.messages.some((m) => m.a === 'equipe')) s.envoyerMessage('p_helene', 'equipe', 'Bonjour à tous, le planning des deux prochaines semaines est publié.');
      helene('messages');
    },
  },
  {
    chapitre: PILOTER,
    qui: 'Hélène · titulaire',
    cible: '.content .card',
    titre: 'Le journal et la paie',
    texte: () => 'Chaque décision laisse une trace datée, avec les règles en vigueur ce jour-là. La fiche navette prépare les heures et les variables du mois pour le comptable, à exporter.',
    jouer: () => {
      avecPlanning();
      helene('journal');
    },
  },
  {
    chapitre: PILOTER,
    qui: 'Hélène · titulaire',
    cible: '.tb-grille',
    titre: 'Le tableau de bord',
    texte: () => 'Chaque matin : les décisions à prendre, rangées par sujet, la présence d’un pharmacien sur la semaine, l’état de la semaine suivante, les compteurs d’heures, la prochaine garde. Dessous, l’équipe du jour.',
    jouer: () => {
      avecAbsenceImprevue();
      helene('tableau');
    },
  },
  {
    chapitre: PILOTER,
    qui: 'Hélène · titulaire',
    cible: '.topbar-in',
    pointe: '.top-creer',
    titre: '« Créer », d’un clic',
    texte: () => 'Depuis n’importe quel écran : un planning, une garde, une formation, un inventaire, une personne, une absence, un message. Chaque choix ouvre directement la bonne fenêtre.',
    jouer: () => {
      avecPlanning();
      helene('tableau');
    },
    puis: { jouer: () => cliquer('.top-creer'), cible: '.outils .menu' },
  },
  {
    chapitre: PILOTER,
    qui: 'Hélène · titulaire',
    cible: '.topbar-in',
    pointe: '.outils .top-ico',
    titre: 'La cloche : ce qui vous attend',
    texte: () => 'Une ligne par demande de remplacement, la plus urgente en tête : un clic mène droit à elle. Viennent ensuite les autres décisions, les compteurs d’heures à régulariser et les changements à lire.',
    jouer: () => {
      avecAbsenceImprevue();
      helene('tableau');
    },
    puis: { jouer: () => cliquer('.outils .top-ico'), cible: '.outils .menu' },
  },
  {
    chapitre: PILOTER,
    qui: 'Hélène · titulaire',
    cible: '#officine-choix',
    titre: 'Plusieurs pharmacies',
    texte: () => 'Le titulaire principal ajoute autant de pharmacies qu’il veut, chacune avec son équipe et ses plannings. Ce sélecteur passe de l’une à l’autre ; une personne qui travaille dans deux pharmacies garde le même identifiant.',
    jouer: () => {
      avecPlanning();
      helene('tableau');
    },
  },
  {
    chapitre: PILOTER,
    qui: 'Hélène · titulaire',
    cible: "[data-focus='assistant']",
    pointe: "[data-focus='assistant']",
    titre: 'L’assistant Solvéa',
    texte: () => 'Le bouton au logo de Solvéa reste à portée de main. Dites ce que vous voulez faire : il propose d’abord ce qui concerne l’écran en cours et votre rôle, répond en deux phrases et vous y emmène.',
    jouer: () => {
      avecPlanning();
      helene('tableau');
      useUi.getState().montrerAssistant(true);
    },
    puis: {
      jouer: () => {
        useUi.getState().montrerAssistant(true);
        useUi.getState().ouvrirAssistant(true);
      },
      cible: '.aide-panneau',
    },
  },
  {
    chapitre: PILOTER,
    qui: 'Hélène · titulaire',
    cible: "[aria-labelledby='c-code']",
    titre: 'Mot de passe et clé de secours',
    texte: () => 'Chacun change son mot de passe ici. La clé de secours, affichée au titulaire principal, lui permet de le redéfinir en cas d’oubli ; pour un membre de l’équipe, le titulaire donne un mot de passe provisoire depuis sa fiche.',
    jouer: () => {
      avecPlanning();
      helene('compte');
    },
  },
  {
    chapitre: PILOTER,
    qui: 'Hélène · titulaire',
    cible: '.choix.themes',
    titre: 'Votre compte, et la suite',
    texte: () => 'Dix couleurs, mode clair ou sombre, taille du texte, mot de passe, clé de secours. La visite est terminée : le bandeau « Environnement de test » vous laisse tout essayer comme titulaire, second titulaire, pharmacien ou préparateur.',
    jouer: () => {
      avecPlanning();
      helene('compte');
    },
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
      titre: 'Mon prochain poste, en grand',
      texte: () => `${p.prenom} ouvre Solvéa : son prochain poste est écrit en grand, avec la pause et la durée. C’est la première chose qu’on cherche, c’est la première chose qu’on voit.`,
      jouer: () => moi('moi'),
    },
    {
      chapitre: MON_PLANNING,
      qui: p.qui,
      cible: '.me-grid .card',
      titre: 'Ma semaine, jour par jour',
      texte: () => 'Chaque jour : les horaires en clair, la pause, la durée, un rendez-vous ou une garde s’il y en a. Un clic sur un jour montre toute l’équipe ce jour-là. Seul le planning publié s’affiche, jamais un brouillon.',
      jouer: () => moi('moi'),
    },
    {
      chapitre: MON_PLANNING,
      qui: p.qui,
      cible: 'table.cal',
      titre: 'Le calendrier du mois',
      texte: () => '« Calendrier » montre le mois entier, avec les horaires dans chaque case et les mêmes couleurs que partout : jaune le matin, bleu la journée, violet l’après-midi.',
      jouer: () => {
        moi('moi');
        useUi.getState().agir('moi', 'calendrier');
      },
    },
    {
      chapitre: MON_PLANNING,
      qui: p.qui,
      cible: '.content .plan',
      pointe: '.plan-bar .seg button:last-child',
      titre: 'Le planning de toute l’équipe',
      texte: () => 'Qui travaille quand : la version publiée, une couleur par moment de la journée, une couleur par poste. « Mes postes » ne garde que votre ligne : regardez.',
      jouer: () => {
        moi('planning');
        useUi.getState().setSemaine(mondayOf(store().today));
      },
      puis: { jouer: () => useUi.getState().setSeulementMoi(true) },
    },
    {
      chapitre: MES_DEMANDES,
      qui: p.qui,
      cible: '.onglets',
      titre: 'Mes demandes : trois onglets',
      texte: () => 'Souhaits du mois : ce que vous préférez, sans réponse à attendre. Absences et horaires : ce que vous demandez à votre titulaire. Remplacements : un poste que vous ne pouvez pas tenir.',
      jouer: () => versDemandes(p.identifiant, 'absences'),
    },
    {
      chapitre: MES_DEMANDES,
      qui: p.qui,
      cible: '.sh-cal',
      pointe: "[data-focus='assister']",
      titre: 'Mes souhaits du mois',
      texte: () => 'Une forme dans la barre (matin, journée, après-midi, repos), puis un clic par jour. « M’assister » remplit le reste d’après vos habitudes : regardez. Sous chaque jour, les collègues annoncés face au seuil de la pharmacie. Jamais de raison à donner.',
      jouer: () => versDemandes(p.identifiant, 'souhaits'),
      puis: { jouer: () => souhaitsPour(p.id) },
    },
    {
      chapitre: MES_DEMANDES,
      qui: p.qui,
      cible: '.dialog',
      titre: 'Un congé, un horaire à tenir',
      texte: () => 'Un formulaire, des dates. Garde d’enfant, pratique religieuse, cours du soir : un raccourci remplit les horaires, mais aucun motif n’est demandé ni conservé. Votre titulaire répond à chaque demande.',
      jouer: () => {
        versDemandes(p.identifiant, 'absences');
        useUi.getState().agir('demandes', 'demande');
      },
    },
    {
      chapitre: MES_DEMANDES,
      qui: p.qui,
      cible: "[data-focus='remplacer']",
      pointe: "[data-focus='remplacer'] .btn",
      titre: 'Me faire remplacer',
      texte: () => 'Choisissez le poste, puis un niveau : prévu, urgent (à moins de 7 jours) ou urgence médicale, avec un justificatif que seuls les titulaires voient. Votre titulaire répond oui ou non, puis un collègue volontaire reprend le poste.',
      jouer: () => versDemandes(p.identifiant, 'remplacements'),
      puis: { jouer: () => cliquer("[data-focus='remplacer'] .btn"), cible: '.dialog' },
    },
    {
      chapitre: AVEC_EQUIPE,
      qui: p.qui,
      cible: "[data-focus='aider']",
      titre: 'Un collègue absent : l’appel à l’équipe',
      texte: () => 'Quand une absence est à couvrir, tous ceux qui peuvent tenir le poste reçoivent le même message, en même temps. Vous voyez votre rang dans le tour de rôle. « Je peux » ou « Je ne peux pas » : dire non ne change pas votre rang.',
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
            texte: () => 'Vos gardes et astreintes, le repos qui suit chacune, et ce qui partira en paie. Une garde confiée arrive aussi en tête de « Mon planning », avec un accusé de lecture.',
            jouer: () => moi('mesgardes'),
          } satisfies Etape,
        ]
      : []),
    {
      chapitre: AVEC_EQUIPE,
      qui: p.qui,
      cible: '.fil',
      titre: 'Les messages',
      texte: () => 'Un fil pour toute l’équipe, et des conversations privées. Pour une absence ou un horaire, préférez une demande : elle est suivie jusqu’à sa réponse.',
      jouer: () => moi('messages'),
    },
    {
      chapitre: MON_ESPACE,
      qui: p.qui,
      cible: '.content .deux',
      titre: 'Mon suivi',
      texte: () => 'Votre compteur d’heures, en plus ou en moins de votre contrat. Ce qui a été noté sur douze mois : des dates et des durées, jamais une raison. Et votre part des samedis, des fermetures et des dépannages, face à ce qui est attendu de vous.',
      jouer: () => moi('suivi'),
    },
    {
      chapitre: MON_ESPACE,
      qui: p.qui,
      cible: "[data-focus='assistant']",
      pointe: "[data-focus='assistant']",
      titre: 'L’assistant Solvéa',
      texte: () => 'Le bouton au logo de Solvéa reste à portée de main. Dites ce que vous voulez faire : il ne propose que ce qui concerne votre rôle, répond en deux phrases et vous y emmène.',
      jouer: () => {
        moi('moi');
        useUi.getState().montrerAssistant(true);
      },
      puis: {
        jouer: () => {
          useUi.getState().montrerAssistant(true);
          useUi.getState().ouvrirAssistant(true);
        },
        cible: '.aide-panneau',
      },
    },
    {
      chapitre: MON_ESPACE,
      qui: p.qui,
      cible: '.choix.themes',
      titre: 'Mon compte',
      texte: () => 'Dix couleurs, mode clair ou sombre, taille du texte, mot de passe. La visite est terminée : tout ce que vous avez vu reste à essayer librement.',
      jouer: () => moi('compte'),
    },
  ];
}

const PHARMACIEN = visiteDe({ id: 'p_lea', identifiant: 'lea.fontaine', qui: 'Léa · pharmacienne adjointe', prenom: 'Léa', pharmacien: true });
const EQUIPIER = visiteDe({ id: 'p_camille', identifiant: 'camille.roussel', qui: 'Camille · préparatrice', prenom: 'Camille' });

export const SCENARIOS = {
  complet: { court: 'Titulaire', role: 'Titulaire', titre: 'Tout Solvéa, de zéro', duree: `${COMPLET.length} étapes · 15 min`, etapes: COMPLET },
  pharmacien: { court: 'Pharmacien', role: 'Pharmacien adjoint', titre: 'Mon espace de pharmacien', duree: `${PHARMACIEN.length} étapes · 5 min`, etapes: PHARMACIEN },
  equipe: { court: 'Équipe', role: 'Préparateur, animateur, apprenti…', titre: 'Mon espace dans l’équipe', duree: `${EQUIPIER.length} étapes · 5 min`, etapes: EQUIPIER },
  etabli: { court: 'Journée type', role: 'Tous les rôles', titre: 'Une journée type', duree: `${ETABLI.length} étapes · 4 min`, etapes: ETABLI },
} as const;
export type Scenario = keyof typeof SCENARIOS;

/** Lance un parcours guidé sur un environnement d'exemple remis à neuf. */
export function lancerParcours(scenario: Scenario = 'etabli'): void {
  annulerMinuteries();
  store().chargerExemple(true, scenario === 'complet' ? 'zero' : 'etabli');
  useUi.getState().montrerAssistant(false);
  // Le parcours est remis à l'étape 1 : l'écran de la première étape est posé par le composant.
  voirComme('helene.marchetti');
  useUi.getState().setParcours(0, scenario);
  // Relancé depuis l'étape 1, le parcours ne change pas d'étape : son écran est reposé ici.
  SCENARIOS[scenario].etapes[0].jouer();
}

interface Zone {
  top: number;
  left: number;
  width: number;
  height: number;
}
const memeZone = (a: Zone | null, b: Zone | null): boolean => (!a || !b ? a === b : Math.abs(a.top - b.top) < 1 && Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1);

/** Parcours guidé : chaque étape pose l'écran, éclaire ce qu'elle montre, fait l'action sous les yeux et l'explique. */
export function Parcours(): JSX.Element | null {
  const { parcours, setParcours, scenario, session, vue } = useUi();
  const data = useStore((s) => s.data);
  const ETAPES: readonly Etape[] = SCENARIOS[scenario].etapes;
  const etape = parcours !== null ? ETAPES[parcours] : null;
  /** 0 : on montre ; 1 : l'action de l'étape vient d'être faite. */
  const [phase, setPhase] = useState(0);
  const [clic, setClic] = useState(false);
  const [lecture, setLecture] = useState(false);
  const [sommaire, setSommaire] = useState(false);
  /** L'utilisateur a quitté l'écran de l'étape pour explorer : le projecteur s'efface. */
  const [libre, setLibre] = useState(false);
  const attendu = useRef<{ session: string | null; vue: Vue } | null>(null);
  const panneau = useRef<HTMLElement>(null);

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
  const preparer = (): void => {
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
    attendu.current = null;
  };

  useEffect(() => {
    if (parcours === null) return;
    const e = SCENARIOS[scenario].etapes[parcours] as Etape | undefined;
    if (!e) return;
    annulerMinuteries();
    setPhase(0);
    setClic(false);
    setSommaire(false);
    setLibre(false);
    preparer();
    e.jouer();
    plusTard(noter, 150);
    if (e.puis) {
      const apres = e.puis.apres ?? 2100;
      plusTard(() => setClic(true), apres);
      plusTard(() => {
        setClic(false);
        attendu.current = null;
        e.puis?.jouer();
        setPhase(1);
        plusTard(noter, 150);
      }, apres + 560);
    }
    return annulerMinuteries;
  }, [parcours, scenario]);

  // Si la personne ou l'écran ne sont plus ceux de l'étape, l'utilisateur explore : on le lui dit, sans le gêner.
  useEffect(() => {
    const a = attendu.current;
    if (a) setLibre(a.session !== session || a.vue !== vue);
  }, [session, vue]);

  const revenir = (): void => {
    if (!etape) return;
    annulerMinuteries();
    preparer();
    etape.jouer();
    etape.puis?.jouer();
    setPhase(etape.puis ? 1 : 0);
    setLibre(false);
    plusTard(noter, 150);
  };

  // Projecteur : la zone de ce qui est présenté. L'écran défile pour l'amener au centre, puis le projecteur le suit.
  const [zone, setZone] = useState<Zone | null>(null);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const cible = libre ? undefined : phase === 1 && etape?.puis?.cible ? etape.puis.cible : etape?.cible;
  const pointe = libre || phase === 1 ? undefined : etape?.pointe;
  useEffect(() => {
    if (parcours === null || (!cible && !pointe)) {
      setZone(null);
      setPoint(null);
      return;
    }
    let amene = false;
    const mesurer = (): void => {
      const el = cible ? document.querySelector<HTMLElement>(cible) : null;
      const r = el?.getBoundingClientRect();
      if (el && r && r.width >= 4 && r.height >= 4) {
        if (!amene) {
          amene = true;
          el.scrollIntoView({ block: r.height > window.innerHeight * 0.62 ? 'start' : 'center', inline: 'nearest', behavior: 'smooth' });
        }
        const m = 8;
        const top = Math.max(6, r.top - m);
        const bas = Math.min(window.innerHeight - 6, r.bottom + m);
        const left = Math.max(6, r.left - m);
        const droite = Math.min(window.innerWidth - 6, r.right + m);
        const z = bas - top > 24 && droite - left > 24 ? { top, left, width: droite - left, height: bas - top } : null;
        setZone((avant) => (memeZone(avant, z) ? avant : z));
      } else setZone(null);
      const p = pointe ? document.querySelector<HTMLElement>(pointe)?.getBoundingClientRect() : null;
      const brut = p && p.width > 2 && p.top > 0 && p.bottom < window.innerHeight ? { x: Math.round(p.left + p.width / 2), y: Math.round(p.top + p.height / 2) } : null;
      const dessous = brut && pointe ? document.elementFromPoint(brut.x, brut.y) : null;
      const pt = brut && dessous?.closest(pointe ?? '') ? brut : null;
      setPoint((avant) => (avant?.x === pt?.x && avant?.y === pt?.y ? avant : pt));
    };
    mesurer();
    const suivi = window.setInterval(mesurer, 280);
    window.addEventListener('resize', mesurer);
    window.addEventListener('scroll', mesurer, true);
    return () => {
      window.clearInterval(suivi);
      window.removeEventListener('resize', mesurer);
      window.removeEventListener('scroll', mesurer, true);
    };
  }, [cible, pointe, parcours, scenario]);

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
  }, [zone, parcours, phase, sommaire, libre, data]);

  const N = ETAPES.length;
  const dernier = parcours === N - 1;
  // Lecture automatique : le temps de lire, plus le temps de l'action.
  const duree = etape ? Math.min(16000, Math.max(7000, 2600 + etape.texte(data).length * 48)) + (etape.puis ? 2800 : 0) : 0;
  useEffect(() => {
    if (!lecture || parcours === null || libre || sommaire) return;
    if (parcours >= N - 1) return setLecture(false);
    const t = window.setTimeout(() => setParcours(parcours + 1), duree);
    return () => window.clearTimeout(t);
  }, [lecture, parcours, libre, sommaire, phase, N, duree, setParcours]);

  // Visite quittée : le bouton d'aide reprend sa place habituelle.
  useEffect(() => {
    if (parcours === null) useUi.getState().montrerAssistant(false);
  }, [parcours]);

  // Flèches du clavier : étape suivante, étape précédente.
  useEffect(() => {
    if (parcours === null) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowRight' && parcours < N - 1) setParcours(parcours + 1);
      if (e.key === 'ArrowLeft' && parcours > 0) setParcours(parcours - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [parcours, N, setParcours]);

  if (!etape || parcours === null || !data.demo) return null;
  const rang = chapitres.findIndex((c) => parcours >= c.debut && parcours < c.debut + c.n);
  return (
    <>
      {zone ? <div className="focus-parcours" style={zone} aria-hidden="true" /> : null}
      {point ? (
        <div className={`pointe-parcours${clic ? ' clic' : ''}`} style={{ left: point.x, top: point.y }} aria-hidden="true">
          <MousePointerClick size={22} />
        </div>
      ) : null}
      <aside ref={panneau} className="parcours-test no-print" aria-label="Parcours guidé" style={place ? { left: place.left, top: place.top, right: 'auto', bottom: 'auto' } : undefined}>
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
          {lecture && !libre && !sommaire && !dernier ? <i key={`${parcours}-${phase}`} className="pt-chrono" style={{ animationDuration: `${duree}ms` }} aria-hidden="true" /> : null}
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
                <button type="button" className="btn sm" onClick={revenir}>
                  <Undo2 size={14} aria-hidden="true" /> Revenir à l’étape
                </button>
              </div>
            ) : etape.puis && phase === 0 ? (
              <div className="pt-action small">
                <span className="spinner" /> L’action se fait sous vos yeux…
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
          {dernier ? (
            <button type="button" className="btn sm primary" onClick={() => setParcours(null)}>
              Terminer
            </button>
          ) : (
            <button type="button" className="btn sm primary" onClick={() => setParcours(parcours + 1)}>
              Étape suivante <ArrowRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

const POINTS: Record<Scenario, string[]> = {
  complet: ['On part de zéro : pharmacie, équipe, premier planning', 'Toutes les fonctions de gestion, en six chapitres', 'Chaque action se fait sous vos yeux'],
  pharmacien: ['Mon planning, mes demandes, mes gardes', 'Répondre à un appel de l’équipe', 'Rien de la gestion : seulement ce qui vous sert'],
  equipe: ['Mon planning et celui de l’équipe', 'Souhaits, absences, remplacements', 'Mon suivi et mon compteur d’heures'],
  etabli: ['Les décisions du matin', 'Un remplacement, du besoin à la validation', 'Deux titulaires qui décident ensemble'],
};
const ICONE_VISITE: Record<Scenario, JSX.Element> = {
  complet: <Crown size={22} />,
  pharmacien: <PillIcon size={22} />,
  equipe: <FlaskConical size={22} />,
  etabli: <Store size={22} />,
};

/** Fenêtre « Découvrir Solvéa » : le principe en trois temps, une visite par rôle, ou une entrée libre. */
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
          <span className="dialog-filigrane" aria-hidden="true">
            <Logo size={230} />
          </span>
          <div>
            <span className="eyebrow">Comment ça marche</span>
            <h2 id="decouvrir-titre">Découvrir Solvéa</h2>
            <ol className="dc-principe">
              <li>
                <span className="n" aria-hidden="true">1</span> Chacun donne ses souhaits
              </li>
              <li>
                <span className="n" aria-hidden="true">2</span> Solvéa propose, vous décidez
              </li>
              <li>
                <span className="n" aria-hidden="true">3</span> L’équipe est prévenue
              </li>
            </ol>
          </div>
          <button type="button" className="dialog-fermer" onClick={() => ouvrirTutoriels(false)} aria-label="Fermer" autoFocus>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="dc-corps">
          <div>
            <h3 className="dc-sous">Une visite guidée, selon votre rôle</h3>
            <p className="small soft" style={{ margin: '2px 0 14px' }}>Sur une pharmacie d’exemple : vos données ne sont pas touchées.</p>
            <div className="choix-parcours">
              {(Object.keys(SCENARIOS) as Scenario[]).map((cle) => (
                <article key={cle} className={`cp-carte${cle === 'complet' ? ' reco' : ''}`}>
                  <div className="row" style={{ gap: 12 }}>
                    <span className="cp-ico" aria-hidden="true">
                      {ICONE_VISITE[cle]}
                    </span>
                    <span>
                      <span className="cp-role">{SCENARIOS[cle].role}</span>
                      <span className="cp-duree">{SCENARIOS[cle].duree}</span>
                    </span>
                  </div>
                  <h3>{SCENARIOS[cle].titre}</h3>
                  <ul className="cp-points">
                    {POINTS[cle].map((x) => (
                      <li key={x}>
                        <Check size={15} aria-hidden="true" /> {x}
                      </li>
                    ))}
                  </ul>
                  <button type="button" className={`btn${cle === 'complet' ? ' primary' : ''}`} onClick={() => lancerParcours(cle)}>
                    <Play size={15} aria-hidden="true" /> Lancer <span className="sr">: {SCENARIOS[cle].titre}</span>
                  </button>
                </article>
              ))}
            </div>
          </div>
          <div className="dc-libre">
            <h3 className="dc-sous">Ou entrez directement comme…</h3>
            <div className="dc-roles">
              {exemple.map((r) => (
                <button key={r.cle} type="button" className="dc-role" onClick={() => entrer(r.identifiant)} title={r.detail}>
                  <span className="dc-av" aria-hidden="true">
                    {r.nom.split(' ').map((x) => x.charAt(0)).join('')}
                  </span>
                  <span>
                    <b>{r.nom}</b>
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
