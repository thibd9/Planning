import { ArrowLeft, ArrowRight, FlaskConical, Map, Play, RotateCcw, Store, X } from 'lucide-react';
import { useEffect } from 'react';
import { peutGerer } from '../domain/acces';
import { addDays, mondayOf } from '../domain/time';
import type { AppData, Remplacement } from '../domain/types';
import { generer } from '../engine/generate';
import { evaluerRemplacement, peutDemanderRemplacement, peutRemplacer } from '../engine/remplacement';
import { useStore } from '../store/store';
import type { Vue } from '../store/ui';
import { useUi } from '../store/ui';
import { Dialog } from './kit';

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
  qui: string;
  titre: string;
  texte: (d: AppData) => string;
  jouer: () => void;
}

const ETABLI: Etape[] = [
  {
    qui: 'Hélène · titulaire principale',
    titre: 'La journée commence sur le tableau de bord',
    texte: () => 'Hélène voit d’un coup d’œil les décisions en attente, la couverture pharmacien de la semaine et l’équipe du jour. Elle seule a tous les droits.',
    jouer: () => voirComme('helene.marchetti', 'tableau'),
  },
  {
    qui: 'Camille · préparatrice',
    titre: 'Une préparatrice consulte ses horaires',
    texte: (d) => {
      const r = demandeDeCamille(d);
      return r ? 'Aujourd’hui, demain, la suite : tout est en haut de « Mon planning ». Camille vient de demander à être remplacée sur un poste à plus de 7 jours, sans donner de raison. Plus près, la demande est bloquée : le collègue doit être prévenu dans les délais.' : 'Aujourd’hui, demain, la suite : tout est en haut de « Mon planning », avec la carte « Me faire remplacer ».';
    },
    jouer: () => {
      const s = store();
      if (!demandeDeCamille(s.data)) {
        const cible = posteARemplacer(s.data, s.today);
        const poste = s.data.shifts.find((x) => x.id === cible);
        if (poste) s.demanderRemplacement(poste);
      }
      voirComme('camille.roussel', 'moi');
    },
  },
  {
    qui: 'Un collègue',
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
    titre: 'La titulaire valide le remplacement',
    texte: (d) => {
      const r = demandeDeCamille(d);
      return r?.volontaires.length ? `Dans « Résoudre », onglet « Remplacements » : le moteur a relu les règles pour ${prenom(d, r.volontaires[0])}. Cliquez sur « Valider avec ${prenom(d, r.volontaires[0])} » : les deux personnes sont prévenues.` : 'Dans « Résoudre », chaque décision annonce ses conséquences avant d’être prise : absences à couvrir, remplacements, demandes, gardes.';
    },
    jouer: () => {
      useUi.getState().setSujet('remplacements');
      voirComme('helene.marchetti', 'resoudre');
    },
  },
  {
    qui: 'Karim · pharmacien adjoint',
    titre: 'Un pharmacien suit ses gardes',
    texte: () => 'Karim n’a pas accès à la gestion. Il voit son planning, le planning publié de l’équipe et « Mes gardes » : dates, repos qui suit, récupérations.',
    jouer: () => voirComme('karim.benali', 'mesgardes'),
  },
  {
    qui: 'Antoine · titulaire secondaire',
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
    titre: 'La titulaire principale donne son accord',
    texte: (d) => ((d.accords ?? []).length ? 'Dans « Résoudre », onglet « Accords à donner » : cliquez sur « Donner mon accord ». La décision d’Antoine est alors appliquée, et il en est prévenu par message.' : 'Les décisions d’Antoine arrivent dans « Résoudre », onglet « Accords à donner ». Ici, tout est à jour.'),
    jouer: () => {
      useUi.getState().setSujet('accords');
      voirComme('helene.marchetti', 'resoudre');
    },
  },
  {
    qui: 'Hélène · titulaire principale',
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
    titre: 'Construire la semaine prochaine',
    texte: () => 'Cliquez sur « Proposer un planning » : trois propositions comparables (équité, souhaits, coût). Les couleurs situent chaque poste dans la journée ; survolez un jour signalé dans « Couverture » pour lire le problème.',
    jouer: () => {
      voirComme('helene.marchetti', 'construire');
      // L'exemple a deux semaines publiées d'avance : la semaine à construire est la troisième.
      useUi.getState().setSemaine(addDays(mondayOf(store().today), 21));
    },
  },
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

const COMPLET: Etape[] = [
  {
    qui: 'Hélène · titulaire principale',
    titre: 'L’équipe est créée',
    texte: () => 'Onze personnes : deux titulaires, deux pharmaciens adjoints, des préparateurs, un apprenti, un étudiant. Chaque fiche porte le contrat, les compétences, les besoins d’horaires et le compte de connexion.',
    jouer: () => helene('equipe'),
  },
  {
    qui: 'Hélène · titulaire principale',
    titre: 'Les réglages de la pharmacie',
    texte: () => 'Horaires d’ouverture jour par jour, coupure du midi, effectif attendu au comptoir. Tout se modifie ici, à tout moment.',
    jouer: () => helene('officine'),
  },
  {
    qui: 'Hélène · titulaire principale',
    titre: 'Une semaine à construire',
    texte: () => 'La grille est vide. Un « + » pose un poste à la main ; « Proposer un planning » calcule trois propositions comparables : équité, souhaits, coût.',
    jouer: () => {
      helene('construire');
      useUi.getState().setSemaine(semaineDans(1));
    },
  },
  {
    qui: 'Hélène · titulaire principale',
    titre: 'Le planning proposé',
    texte: () => 'La proposition « équité » vient d’être posée. Chaque couleur situe le poste dans la journée ; la ligne « Couverture » signale un jour sans pharmacien, et les contrôles (durées, repos, pauses) sont juste en dessous.',
    jouer: () => {
      helene('construire');
      useUi.getState().setSemaine(semaineDans(1));
      proposerSemaine(semaineDans(1));
    },
  },
  {
    qui: 'Hélène · titulaire principale',
    titre: 'Une journée, toute l’équipe',
    texte: () => 'Un clic sur un jour ouvre la journée : qui travaille, quand tombent les pauses. Les pauses déjeuner se règlent ici, et un retard se note en deux clics.',
    jouer: () => {
      helene('construire');
      proposerSemaine(semaineDans(1));
      useUi.getState().setSemaine(semaineDans(1));
      useUi.getState().voirJour(addDays(semaineDans(1), 1));
    },
  },
  {
    qui: 'Hélène · titulaire principale',
    titre: 'Publier',
    texte: () => 'Deux semaines viennent d’être publiées. Tant qu’un planning est en brouillon, vous seule le voyez ; publié, il devient la version de toute l’équipe, et chaque changement ultérieur sera annoncé avant → après.',
    jouer: () => {
      useUi.getState().voirJour(null);
      helene('construire');
      publierSemaine(semaineDans(1));
      publierSemaine(semaineDans(2));
      useUi.getState().setSemaine(semaineDans(1));
    },
  },
  {
    qui: 'Camille · préparatrice',
    titre: 'Côté équipe : mon planning',
    texte: () => 'Camille ouvre l’application : son prochain poste est écrit en grand, puis sa semaine, jour par jour. Elle ne voit que la version publiée.',
    jouer: () => voirComme('camille.roussel', 'moi'),
  },
  {
    qui: 'Camille · préparatrice',
    titre: 'Le calendrier du mois',
    texte: () => 'La vue « Calendrier » montre le mois entier. Un clic sur un jour affiche toute l’équipe ce jour-là.',
    jouer: () => {
      voirComme('camille.roussel', 'moi');
      useUi.getState().agir('moi', 'calendrier');
    },
  },
  {
    qui: 'Camille · préparatrice',
    titre: 'Se faire remplacer',
    texte: (d) => {
      const r = demandeDeCamille(d);
      return r ? `Camille a demandé à être remplacée, sans donner de raison${r.volontaires.length ? `, et ${prenom(d, r.volontaires[0])} s’est proposé` : ''}. C’est possible jusqu’à 7 jours avant le poste : plus près, le collègue ne serait pas prévenu dans les délais légaux.` : 'Une demande de remplacement est possible jusqu’à 7 jours avant le poste. Plus près, il faut prévenir le responsable.';
    },
    jouer: () => {
      const s = store();
      if (!demandeDeCamille(s.data)) {
        const poste = s.data.shifts.find((x) => x.id === posteARemplacer(s.data, s.today));
        if (poste) s.demanderRemplacement(poste);
      }
      const r = demandeDeCamille(store().data);
      const v = r ? (r.volontaires[0] ?? volontairePour(store().data, r)) : undefined;
      if (r && v && !r.volontaires.includes(v)) store().seProposer(r.id, v, true);
      voirComme('camille.roussel', 'moi');
    },
  },
  {
    qui: 'Camille · préparatrice',
    titre: 'Une demande d’horaires, sans raison',
    texte: () => 'Garde d’enfant, pratique religieuse, cours du soir : un raccourci remplit le formulaire, mais seule la contrainte d’horaire part au responsable. Aucun motif n’est demandé ni conservé.',
    jouer: () => {
      voirComme('camille.roussel', 'moi');
      useUi.getState().agir('moi', 'demande');
    },
  },
  {
    qui: 'Hélène · titulaire principale',
    titre: 'Résoudre : un sujet par onglet',
    texte: () => 'Remplacements, demandes, absences, gardes, plannings à publier. Ici, le remplacement de Camille : le moteur a relu les règles pour le volontaire, il reste à valider.',
    jouer: () => {
      helene('resoudre');
      const s = store();
      if (!s.data.absences.some((x) => x.personId === 'p_jules' && x.statut === 'demandee')) s.declarerAbsence({ personId: 'p_jules', from: addDays(semaineDans(4), 0), to: addDays(semaineDans(4), 4), type: 'conge', statut: 'demandee' });
      useUi.getState().setSujet('remplacements');
    },
  },
  {
    qui: 'Hélène · titulaire principale',
    titre: 'Une absence imprévue',
    texte: () => 'Karim est arrêté trois jours. Ses postes sont à couvrir : chaque option dit qui est touché, ce que ça coûte et ce qu’il faut valider. « Tout régler » applique les options conseillées d’un coup.',
    jouer: () => {
      helene('resoudre');
      const s = store();
      const debut = addDays(semaineDans(1), 1);
      if (!s.data.absences.some((x) => x.personId === 'p_karim' && x.type === 'maladie')) s.declarerAbsence({ personId: 'p_karim', from: debut, to: addDays(debut, 2), type: 'maladie', statut: 'approuvee' });
      useUi.getState().setSujet('absences');
    },
  },
  {
    qui: 'Hélène · titulaire principale',
    titre: 'Les gardes',
    texte: () => 'Une garde vient d’être ajoutée, confiée à Léa et notifiée dans la foulée. L’application suit le délai de 15 jours, le repos qui suit la garde et les variables pour la paie.',
    jouer: () => {
      helene('gardes');
      const s = store();
      if (!s.data.gardes.length) {
        s.ajouterGardes([{ date: addDays(semaineDans(3), 5), start: 19 * 60 + 30, end: 8 * 60 + 30, type: 'volets_fermes', personId: 'p_lea', interventions: [] }], true);
        store().ajouterGardes([{ date: addDays(semaineDans(5), 6), start: 9 * 60, end: 19 * 60, type: 'volets_ouverts', personId: null, interventions: [] }], false);
      }
    },
  },
  {
    qui: 'Léa · pharmacienne adjointe',
    titre: 'Côté pharmacien : la garde reçue',
    texte: () => 'Léa trouve la garde en tête de son planning, avec un accusé de lecture, puis dans « Mes gardes ». Elle n’a pas accès à la gestion.',
    jouer: () => voirComme('lea.fontaine', 'moi'),
  },
  {
    qui: 'Hélène · titulaire principale',
    titre: 'Une formation',
    texte: () => 'Depuis « Créer », une formation se planifie en trois champs : intitulé, dates, participants. Chacun est prévenu, et la formation apparaît en turquoise dans les plannings.',
    jouer: () => {
      helene('construire');
      const s = store();
      const jour = addDays(semaineDans(2), 3);
      if (!s.data.absences.some((x) => x.type === 'formation')) s.planifierFormation({ intitule: 'Gestes d’urgence', personnes: ['p_thomas', 'p_ines'], from: jour, to: jour });
      useUi.getState().setSemaine(semaineDans(2));
    },
  },
  {
    qui: 'Antoine · titulaire secondaire',
    titre: 'Deux titulaires : décider à deux',
    texte: (d) => {
      const a = (d.accords ?? []).find((x) => x.auteur === 'p_antoine');
      return a ? `Antoine a les mêmes écrans qu’Hélène. Il vient de décider : « ${a.titre} ». Rien n’est appliqué tant qu’Hélène n’a pas donné son accord.` : 'Antoine a les mêmes écrans qu’Hélène ; chacune de ses décisions attend l’accord de la titulaire principale.';
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
    titre: 'Donner son accord',
    texte: () => 'La décision d’Antoine arrive dans l’onglet « Accords à donner ». Un clic l’applique, et Antoine en est prévenu par message. Un refus n’applique rien.',
    jouer: () => {
      useUi.getState().setSujet('accords');
      helene('resoudre');
    },
  },
  {
    qui: 'Hélène · titulaire principale',
    titre: 'Retards et suivi',
    texte: () => 'Un retard de Jules vient d’être noté. Sa fiche compte, sur douze mois, retards, départs, absences par nature et remplacements assurés : des dates et des durées, jamais une raison.',
    jouer: () => {
      helene('equipe');
      const s = store();
      if (!(s.data.ecarts ?? []).some((e) => e.personId === 'p_jules')) s.signalerEcart({ personId: 'p_jules', date: s.today, type: 'retard', minutes: 15 });
      useUi.getState().ouvrirPersonne('p_jules');
    },
  },
  {
    qui: 'Hélène · titulaire principale',
    titre: 'Les messages',
    texte: () => 'Un fil pour toute l’équipe, et des conversations privées. Pour une absence ou un horaire, mieux vaut une demande : elle est suivie et tracée.',
    jouer: () => {
      helene('messages');
      const s = store();
      if (!s.data.messages.some((m) => m.a === 'equipe')) s.envoyerMessage('p_helene', 'equipe', 'Bonjour à tous, le planning des deux prochaines semaines est publié.');
    },
  },
  {
    qui: 'Hélène · titulaire principale',
    titre: 'L’équité',
    texte: () => 'Samedis, fermetures, gardes, changements tardifs : qui a porté quoi, au prorata du temps de travail. Le générateur s’en sert pour rééquilibrer les semaines suivantes.',
    jouer: () => helene('equite'),
  },
  {
    qui: 'Hélène · titulaire principale',
    titre: 'Les règles appliquées',
    texte: () => 'Chaque contrôle vient d’une fiche : sa source, sa valeur, son niveau de vérification. Délai de prévenance, pause de 20 minutes, repos : tout est lisible et versionné.',
    jouer: () => helene('regles'),
  },
  {
    qui: 'Hélène · titulaire principale',
    titre: 'Le journal et la paie',
    texte: () => 'Chaque décision laisse une trace datée. La fiche navette prépare les heures et les variables pour le comptable.',
    jouer: () => helene('journal'),
  },
  {
    qui: 'Hélène · titulaire principale',
    titre: 'Votre compte',
    texte: () => 'Couleur du thème, taille du texte, mot de passe, clé de secours. Depuis « Créer », vous ajoutez une autre pharmacie et passez de l’une à l’autre. La visite est terminée : tout ce que vous avez vu reste à explorer librement.',
    jouer: () => helene('compte'),
  },
];

export const SCENARIOS = {
  complet: { titre: 'Visite complète', duree: `${COMPLET.length} étapes · environ 6 minutes`, detail: 'On part d’une pharmacie tout juste créée et on construit tout, pas à pas : planning, publication, remplacements, gardes, formations, accords entre titulaires, suivi, paie.', etapes: COMPLET },
  etabli: { titre: 'Une journée dans une pharmacie en place', duree: `${ETABLI.length} étapes · environ 3 minutes`, detail: 'La pharmacie tourne déjà : huit semaines d’historique, un arrêt à couvrir, des demandes en attente. On suit la journée de la titulaire et de son équipe.', etapes: ETABLI },
} as const;
export type Scenario = keyof typeof SCENARIOS;

/** Lance un parcours guidé sur un environnement d'exemple remis à neuf. */
export function lancerParcours(scenario: Scenario = 'etabli'): void {
  store().chargerExemple(true, scenario === 'complet' ? 'vide' : 'etabli');
  useUi.getState().setParcours(0, scenario);
  SCENARIOS[scenario].etapes[0].jouer();
}

/** Parcours guidé : chaque étape change d'écran, parfois de personne, et explique ce qu'on regarde. */
export function Parcours(): JSX.Element | null {
  const { parcours, setParcours, scenario } = useUi();
  const data = useStore((s) => s.data);
  const ETAPES = SCENARIOS[scenario].etapes;
  const etape = parcours !== null ? ETAPES[parcours] : null;

  useEffect(() => {
    if (parcours === null) return;
    // Une fenêtre ouverte par l'étape précédente est refermée avant de jouer la suivante.
    useUi.getState().voirJour(null);
    SCENARIOS[scenario].etapes[parcours]?.jouer();
  }, [parcours, scenario]);

  if (!etape || parcours === null || !data.demo) return null;
  const dernier = parcours === ETAPES.length - 1;
  return (
    <aside className="parcours-test no-print" aria-label="Parcours guidé">
      <div className="row" style={{ gap: 10 }}>
        <span className="pt-n num" aria-hidden="true">
          {parcours + 1}
        </span>
        <div className="grow">
          <div className="eyebrow">
            {SCENARIOS[scenario].titre} · {parcours + 1} sur {ETAPES.length}
          </div>
          <div className="small" style={{ fontWeight: 650 }}>{etape.qui}</div>
        </div>
        <button type="button" className="btn ghost icon sm" onClick={() => setParcours(null)} aria-label="Quitter le parcours guidé">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div aria-live="polite">
        <h2 className="h3" style={{ marginBottom: 4 }}>{etape.titre}</h2>
        <p className="small">{etape.texte(data)}</p>
      </div>
      <div className="pt-barre" aria-hidden="true">
        <i style={{ width: `${((parcours + 1) / ETAPES.length) * 100}%` }} />
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
  );
}

/** Fenêtre de choix : deux parcours guidés, ou une entrée libre dans la peau de quelqu'un. */
export function ChoixParcours(): JSX.Element | null {
  const { tutoriels, ouvrirTutoriels } = useUi();
  if (!tutoriels) return null;
  const entrer = (identifiant: string): void => {
    store().chargerExemple(false);
    ouvrirTutoriels(false);
    voirComme(identifiant);
  };
  return (
    <Dialog size="mid" title="Découvrir Solvéa" subtitle="Deux parcours guidés, sur une pharmacie d’exemple. Vos vraies données ne sont pas touchées." onClose={() => ouvrirTutoriels(false)}>
      <div className="choix-parcours">
        {(Object.keys(SCENARIOS) as Scenario[]).map((cle) => (
          <button key={cle} type="button" className="cp-carte" onClick={() => lancerParcours(cle)}>
            <span className="cp-ico" aria-hidden="true">
              {cle === 'complet' ? <Map size={22} /> : <Store size={22} />}
            </span>
            <b>{SCENARIOS[cle].titre}</b>
            <span className="small soft">{SCENARIOS[cle].detail}</span>
            <span className="cp-pied">
              <span className="small">{SCENARIOS[cle].duree}</span>
              <span className="cp-go">
                Commencer <ArrowRight size={15} aria-hidden="true" />
              </span>
            </span>
          </button>
        ))}
      </div>
      <div>
        <h3 style={{ marginBottom: 8 }}>Ou explorer librement, dans la peau de…</h3>
        <div className="test-roles">
          {ROLES_TEST.map((r) => (
            <button key={r.cle} type="button" className="test-role" onClick={() => entrer(r.identifiant)} title={r.detail}>
              <span className="tr-titre">{r.titre}</span>
              <b>{r.nom}</b>
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

/** Bandeau de l'environnement de test : changer de regard en un clic, lancer ou relancer le parcours. */
export function BandeauTest({ moi }: { moi: string }): JSX.Element {
  const { ouvrirTutoriels, scenario } = useUi();
  return (
    <div className="bandeau-test no-print" role="region" aria-label="Environnement de test">
      <span className="bt-titre" title="Environnement de test">
        <FlaskConical size={16} aria-hidden="true" /> Environnement de test
      </span>
      <div className="seg" role="group" aria-label="Voir l’application comme">
        {ROLES_TEST.map((r) => (
          <button key={r.cle} type="button" className={moi === r.id ? 'on' : ''} aria-pressed={moi === r.id} title={`${r.nom} · ${r.titre}`} onClick={() => voirComme(r.identifiant)}>
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
