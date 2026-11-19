import { REGLES_INITIALES } from '../domain/rules';
import { addDays, dayIndex, decalageParis, ferie, fmtDateCourt, fromDayIndex, mondayOf, uid, weekDates } from '../domain/time';
import { empreinte, identifiantPropose } from '../domain/acces';
import type { AppData, Besoin, Garde, ISODate, Mission, Officine, Person, Shift } from '../domain/types';
import { decrireJournee, shiftsSemaine } from '../engine/core';
import { absenceDecouvre, tourDeRole } from '../engine/appel';
import { generer } from '../engine/generate';
import { pausesProposees } from '../engine/pauses';
import { moisACollecter, proposerSouhaits } from '../engine/souhaits';

const H = (h: number, m = 0): number => h * 60 + m;
const SEMAINE = [0, 1, 2, 3, 4];

export const OFFICINE_DEMO: Officine = {
  nom: 'Grande Pharmacie de la Pinède',
  surface: 180,
  infos: { surfaceVente: 110, reserve: 45, caisses: 3, comptoirs: 4, confidentialite: 1, passagesJour: 240 },
  responsableId: 'p_helene',
  horaires: [
    [{ start: H(8, 30), end: H(19, 30) }],
    [{ start: H(8, 30), end: H(19, 30) }],
    [{ start: H(8, 30), end: H(19, 30) }],
    [{ start: H(8, 30), end: H(19, 30) }],
    [{ start: H(8, 30), end: H(19, 30) }],
    [{ start: H(9), end: H(19) }],
    [],
  ],
  fermeJoursFeries: true,
  postes: [
    { id: 'ouverture', label: 'Ouverture', start: H(8, 30), end: H(16, 30), pauseStart: H(12, 30), pauseEnd: H(13, 30), jours: SEMAINE },
    { id: 'fermeture', label: 'Fermeture', start: H(11, 30), end: H(19, 30), pauseStart: H(14), pauseEnd: H(15), jours: SEMAINE },
    { id: 'matin', label: 'Matin', start: H(8, 30), end: H(13), jours: SEMAINE },
    { id: 'aprem', label: 'Après-midi', start: H(14), end: H(19, 30), jours: SEMAINE },
    { id: 'longue', label: 'Journée longue', start: H(8, 30), end: H(19, 30), pauseStart: H(12, 30), pauseEnd: H(14), jours: SEMAINE },
    { id: 'sam-matin', label: 'Samedi matin', start: H(9), end: H(14), jours: [5] },
    { id: 'sam-aprem', label: 'Samedi après-midi', start: H(14), end: H(19), jours: [5] },
    { id: 'sam-journee', label: 'Samedi journée', start: H(9), end: H(19), pauseStart: H(13), pauseEnd: H(14), jours: [5] },
  ],
  effectifs: [
    { jours: SEMAINE, start: H(8, 30), end: H(19, 30), minEquipe: 2 },
    { jours: SEMAINE, start: H(10), end: H(12, 30), minEquipe: 3 },
    { jours: SEMAINE, start: H(16, 30), end: H(19), minEquipe: 3 },
    { jours: [5], start: H(9), end: H(19), minEquipe: 2 },
    { jours: [5], start: H(10), end: H(12, 30), minEquipe: 3 },
  ],
  valeurPoint: null,
  plafondPrioritaires: 2,
  caAnnuelHT: 2_900_000,
};
// Chaque poste type proposé au départ porte une pause courte par demi-journée : elle se lit sur le planning et sur le papier.
OFFICINE_DEMO.postes = OFFICINE_DEMO.postes.map((p) => ({ ...p, pauses: pausesProposees(p) }));

const personne = (
  id: string,
  prenom: string,
  nom: string,
  qualification: Person['qualification'],
  heuresHebdo: number,
  tauxHoraire: number | null,
  extra: Partial<Person> = {},
): Person => ({
  id,
  prenom,
  nom,
  qualification,
  salarie: qualification !== 'titulaire',
  heuresHebdo,
  tauxHoraire,
  competences: [],
  volontaireHeuresComp: false,
  volontaireGardes: false,
  ...extra,
});

/** Équipe fictive. Les taux horaires sont indicatifs et ne servent qu'à comparer des scénarios. */
export const EQUIPE_DEMO: Person[] = [
  personne('p_helene', 'Caroline', 'Tellier', 'titulaire', 42, null, { entreeLe: '2011-03-01', competences: ['vaccination', 'trod', 'entretien'], volontaireGardes: true }),
  // Titulaire secondaire, associé à temps réduit : sans droit de gestion tant que la titulaire principale ne le lui donne pas.
  personne('p_antoine', 'Pierre', 'Fiandino', 'titulaire', 24, null, { entreeLe: '2017-09-04', competences: ['vaccination'], volontaireGardes: true }),
  personne('p_karim', 'Igor', 'Le Russe', 'adjoint', 35, 24, { entreeLe: '2019-04-08', competences: ['vaccination', 'trod', 'entretien'], volontaireGardes: true }),
  personne('p_lea', 'Léa', 'Fontaine', 'adjoint', 28, 23.5, { entreeLe: '2021-09-06', competences: ['vaccination', 'entretien'], volontaireHeuresComp: true, volontaireGardes: true }),
  personne('p_camille', 'Nicolas', 'Le Syndicaliste', 'preparateur', 35, 15.8, { entreeLe: '2014-01-13', competences: ['orthopedie'] }),
  personne('p_thomas', 'Thomas', 'Nguyen', 'preparateur', 35, 15.2, { entreeLe: '2020-06-15', competences: ['commandes'] }),
  personne('p_ines', 'Inès', 'Da Silva', 'preparateur', 24, 15.2, { entreeLe: '2022-02-07', volontaireHeuresComp: true }),
  personne('p_jules', 'Jules', 'Perrin', 'preparateur', 35, 14.6, { entreeLe: '2023-10-02', competences: ['commandes'] }),
  personne('p_sarah', 'Sarah', 'Lemoine', 'animateur', 21, 13.2, {
    entreeLe: '2024-04-22',
    competences: ['dermo', 'beaute', 'para'],
    // Marques d'exemple, inventées pour la démonstration.
    marques: [
      { id: 'mq_1', marque: 'Lumaderm', types: ['dermocosmetique', 'solaire'] },
      { id: 'mq_2', marque: 'Petit Lin', types: ['bebe', 'hygiene'] },
      { id: 'mq_3', marque: 'Verdéa', types: ['phyto', 'complements'] },
    ],
  }),
  personne('p_manon', 'Manon', 'Girard', 'apprenti', 21, 9.4, { entreeLe: '2025-09-01' }),
  personne('p_yanis', 'Yanis', 'Morel', 'etudiant', 16, 13.9, { entreeLe: '2026-07-06' }),
  personne('x_paul', 'Paul', 'Lemaire', 'adjoint', 0, 62, { externe: true, competences: ['vaccination', 'trod'] }),
  personne('x_nadia', 'Nadia', 'Brun', 'preparateur', 0, 42, { externe: true }),
];

function besoin(b: Partial<Besoin> & Pick<Besoin, 'personId' | 'forme' | 'jours' | 'statut'>, quand: string): Besoin {
  return {
    id: uid('b'),
    frequence: 1,
    horsPlafond: false,
    decision: 'acceptee',
    decidedAt: quand,
    createdAt: quand,
    ...b,
  };
}

/** Dernière nuit de changement d'heure avant une date : la garde de démonstration y est placée. */
function dernierChangementHeure(today: ISODate): ISODate {
  for (let i = dayIndex(today) - 1; i > dayIndex(today) - 400; i--) {
    const d = fromDayIndex(i);
    if (decalageParis(d, 60) !== decalageParis(d, 240)) return d;
  }
  return addDays(today, -30);
}

function finDeMoisSuivante(today: ISODate, minJours: number): ISODate {
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  for (;;) {
    const dernier = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const d = `${y}-${String(m).padStart(2, '0')}-${String(dernier).padStart(2, '0')}`;
    if (dayIndex(d) - dayIndex(today) >= minJours) return d;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
}

function prochainFerie(today: ISODate, minJours: number): ISODate {
  for (let i = dayIndex(today) + minJours; ; i++) {
    const d = fromDayIndex(i);
    if (ferie(d)) return d;
  }
}

/** Horaires, postes types et seuils proposés au départ : un point de départ à ajuster, pas une équipe. */
const OFFICINE_VIERGE: Officine = {
  ...OFFICINE_DEMO,
  nom: '',
  responsableId: undefined,
  caAnnuelHT: null,
};

/** Application vierge : aucune personne, aucun planning, aucune garde. Seuls les réglages de départ sont proposés. */
export function vierge(): AppData {
  return {
    officine: { ...OFFICINE_VIERGE, horaires: OFFICINE_VIERGE.horaires.map((h) => h.map((i) => ({ ...i }))), postes: OFFICINE_VIERGE.postes.map((x) => ({ ...x })), effectifs: OFFICINE_VIERGE.effectifs.map((x) => ({ ...x })) },
    personnes: [],
    shifts: [],
    missions: [],
    absences: [],
    besoins: [],
    gardes: [],
    semaines: {},
    regles: REGLES_INITIALES.map((r) => ({ ...r })),
    journal: [],
    notifications: [],
    trous: [],
    messages: [],
    remplacements: [],
    ecarts: [],
    accords: [],
    souhaits: [],
  };
}

/**
 * Jeu de démonstration : huit semaines d'historique publiées, la semaine en cours publiée
 * avec un arrêt à traiter, la semaine suivante à construire.
 */
/** À augmenter quand l'exemple change (noms, équipe) : les exemples enregistrés sur l'appareil sont alors régénérés. */
export const DEMO_VERSION = 10;

export function seed(today: ISODate, avance = 0): AppData {
  const lundi = mondayOf(today);
  const creation = new Date(`${addDays(lundi, -70)}T09:00:00`).toISOString();

  const besoins: Besoin[] = [
    besoin({ personId: 'p_manon', forme: 'indisponible', jours: [3, 4], statut: 'reconnue', horsPlafond: true }, creation),
    besoin({ personId: 'p_yanis', forme: 'indisponible', jours: [0, 1, 3, 4], statut: 'reconnue', horsPlafond: true }, creation),
    besoin({ personId: 'p_ines', forme: 'indisponible', jours: [2], statut: 'reconnue' }, creation),
    besoin(
      { personId: 'p_camille', forme: 'finir_avant', heure: H(17), jours: [2], frequence: 2, semaineRef: lundi, statut: 'prioritaire', to: addDays(lundi, 220) },
      creation,
    ),
    besoin({ personId: 'p_lea', forme: 'indisponible', jours: [5], frequence: 2, semaineRef: lundi, statut: 'prioritaire' }, creation),
    besoin({ personId: 'p_thomas', forme: 'commencer_apres', heure: H(9, 30), jours: [0], statut: 'preference' }, creation),
    besoin({ personId: 'p_karim', forme: 'finir_avant', heure: H(17), jours: [4], statut: 'preference' }, creation),
    {
      ...besoin({ personId: 'p_jules', forme: 'finir_avant', heure: H(18), jours: [4], statut: 'prioritaire' }, new Date(`${addDays(today, -1)}T18:40:00`).toISOString()),
      decision: 'en_attente',
      motif: 'famille',
      decidedAt: undefined,
      from: addDays(lundi, 7),
    },
  ];

  const nuitChangement = dernierChangementHeure(today);
  const finMois = finDeMoisSuivante(today, 12);
  const noel = prochainFerie(today, 20);
  const gardes: Garde[] = [
    {
      id: uid('g'),
      date: addDays(nuitChangement, -1),
      start: H(20),
      end: H(8),
      type: 'volets_fermes',
      personId: 'p_karim',
      communiqueLe: new Date(`${addDays(nuitChangement, -30)}T10:00:00`).toISOString(),
      interventions: [{ id: uid('i'), offset: 250, duree: 25 }],
    },
    {
      id: uid('g'),
      date: addDays(lundi, 13),
      start: H(9),
      end: H(19),
      type: 'volets_ouverts',
      personId: 'p_lea',
      communiqueLe: new Date(`${addDays(lundi, -14)}T10:00:00`).toISOString(),
      interventions: [],
    },
    {
      id: uid('g'),
      date: finMois,
      start: H(19, 30),
      end: H(8, 30),
      type: 'volets_fermes',
      personId: 'p_karim',
      communiqueLe: new Date(`${addDays(lundi, -6)}T10:00:00`).toISOString(),
      interventions: [],
    },
    { id: uid('g'), date: addDays(lundi, 26), start: H(19), end: H(9), type: 'astreinte', personId: null, interventions: [] },
    { id: uid('g'), date: noel, start: H(9), end: H(19), type: 'volets_ouverts', personId: null, interventions: [] },
  ];

  // Comptes d'exemple : identifiant prenom.nom, mot de passe « demo ».
  const personnes = EQUIPE_DEMO.map((p) => ({ ...p, identifiant: identifiantPropose(p.prenom, p.nom, []), code: empreinte('demo'), provisoire: p.id === 'p_helene' ? undefined : 'demo' }));
  let data: AppData = {
    // Le répertoire des marques de l'exemple : des noms inventés, qui restent proposés même retirés d'une fiche.
    officine: { ...OFFICINE_DEMO, secours: 'TILL-2026', marques: ['Lumaderm', 'Petit Lin', 'Verdéa'] },
    demo: true,
    demoVersion: DEMO_VERSION,
    messages: [
      { id: uid('msg'), de: 'p_helene', a: 'equipe', texte: 'Bonjour à tous, le planning de la semaine prochaine sera publié jeudi. Pensez à me signaler vos contraintes d’ici là.', at: new Date(`${addDays(today, -1)}T09:12:00`).toISOString(), luPar: ['p_helene'] },
      { id: uid('msg'), de: 'p_camille', a: 'p_helene', texte: 'Bonjour Caroline, serait-il possible de me libérer mercredi prochain après 17 h ? Merci.', at: new Date(`${addDays(today, -1)}T14:40:00`).toISOString(), luPar: ['p_camille'] },
    ],
    remplacements: [],
    accords: [],
    // Quelques écarts déjà constatés, pour que le suivi ne soit pas vide.
    ecarts: [
      { id: uid('e'), personId: 'p_jules', date: addDays(lundi, -20), type: 'retard', minutes: 15, at: creation },
      { id: uid('e'), personId: 'p_jules', date: addDays(lundi, -6), type: 'retard', minutes: 10, at: creation },
      { id: uid('e'), personId: 'p_manon', date: addDays(lundi, -13), type: 'retard', minutes: 20, at: creation },
      { id: uid('e'), personId: 'p_thomas', date: addDays(lundi, -9), type: 'depart', minutes: 30, at: creation },
    ],
    personnes,
    shifts: [],
    missions: [],
    absences: [],
    besoins,
    gardes,
    semaines: {},
    regles: REGLES_INITIALES.map((r) => ({ ...r })),
    journal: [],
    notifications: [],
    trous: [],
  };

  // ---- Activités à rendez-vous, cette semaine et la suivante
  const missions: Mission[] = [];
  for (const monday of [lundi, addDays(lundi, 7)]) {
    missions.push(
      { id: uid('m'), date: addDays(monday, 1), start: H(10), end: H(10, 30), type: 'entretien', personId: 'p_lea', salle: true, reportable: true },
      { id: uid('m'), date: addDays(monday, 1), start: H(14, 30), end: H(15, 30), type: 'rdv_labo', personId: 'p_thomas', salle: false, reportable: true },
      { id: uid('m'), date: addDays(monday, 3), start: H(16), end: H(17), type: 'vaccination', personId: 'p_karim', salle: true, reportable: false },
    );
  }
  // Départ « pharmacie à construire » : l'équipe et ses besoins existent, aucun planning n'est encore posé.
  if (avance < -8) return { ...data, gardes: [], messages: [], ecarts: [], besoins: data.besoins.filter((b) => b.decision === 'acceptee') };
  data.missions = missions;

  // ---- Historique : huit semaines passées et la semaine en cours, générées puis publiées.
  // `avance` : nombre de semaines déjà publiées au-delà de la semaine en cours (l'environnement de test en publie deux).
  for (let w = -8; w <= avance; w++) {
    const monday = addDays(lundi, 7 * w);
    const res = generer(data, monday, {
      variante: w % 3 === 0 ? 'equite' : 'cout',
      graine: 1000 + w * 17,
      iterations: 14000,
    });
    const shifts = res.shifts.map((s) => ({ ...s, origine: 'trame' as const, explication: undefined }));
    data = { ...data, shifts: data.shifts.concat(shifts) };
    const publishedAt = new Date(`${addDays(monday, -12)}T17:30:00`).toISOString();
    data.semaines[monday] = { statut: 'publie', publishedAt, snapshot: shifts.map((s) => ({ ...s })) };
    if (w >= -1) {
      data.journal.push({
        id: uid('j'),
        at: publishedAt,
        type: 'publication',
        titre: `Planning de la semaine du ${monday.split('-').reverse().join('/')} publié`,
        detail: `${shifts.length} postes communiqués à l'équipe, 12 jours avant le début de la semaine.`,
        semaine: monday,
        regles: data.regles.map((r) => `${r.id}@${r.version}`),
      });
    }
  }

  // Thomas réceptionne les commandes le mardi : son poste n'est pas au comptoir.
  data.shifts = data.shifts.map((s) =>
    s.personId === 'p_thomas' && s.date === addDays(lundi, 1) ? { ...s, activite: 'back' as const } : s,
  );
  data.semaines[lundi].snapshot = shiftsSemaine(data, lundi).map((s) => ({ ...s }));

  // ---- Un changement tardif absorbé la semaine dernière (alimente la mémoire d'équité)
  const dernier = addDays(lundi, -7);
  const posteJules = data.shifts.find((s) => s.personId === 'p_jules' && dayIndex(s.date) >= dayIndex(dernier) && dayIndex(s.date) < dayIndex(lundi));
  if (posteJules) {
    data.notifications.push({
      id: uid('n'),
      personId: 'p_jules',
      at: new Date(`${addDays(posteJules.date, -2)}T11:00:00`).toISOString(),
      date: posteJules.date,
      avant: 'Repos',
      apres: decrireJournee([posteJules]),
      tardif: true,
      luLe: new Date(`${addDays(posteJules.date, -2)}T12:10:00`).toISOString(),
    });
  }

  // ---- Arrêt d’Igor de mercredi à vendredi : les postes retirés deviennent des trous à résoudre.
  const arretId = uid('a');
  const from = addDays(lundi, 2);
  const to = addDays(lundi, 4);
  data.absences.push({
    id: arretId,
    personId: 'p_karim',
    from,
    to,
    type: 'maladie',
    statut: 'approuvee',
    createdAt: new Date(`${today}T07:40:00`).toISOString(),
  });
  const retires = data.shifts.filter((s) => s.personId === 'p_karim' && s.date >= from && s.date <= to);
  data.shifts = data.shifts.filter((s) => !retires.includes(s));
  // L'arrêt est une décision : la version publiée suit, chacun lit le même planning.
  for (const m of new Set(retires.map((s) => mondayOf(s.date)))) {
    const semaine = data.semaines[m];
    if (semaine?.snapshot) data.semaines[m] = { ...semaine, snapshot: semaine.snapshot.filter((s) => !(s.personId === 'p_karim' && s.date >= from && s.date <= to)) };
  }
  data.trous = retires.map((shift: Shift) => ({ id: uid('t'), absenceId: arretId, shift, statut: 'ouvert' as const }));
  data.journal.push({
    id: uid('j'),
    at: new Date(`${today}T07:40:00`).toISOString(),
    type: 'absence',
    titre: 'Arrêt d’Igor L. enregistré',
    detail: `Du ${from.split('-').reverse().join('/')} au ${to.split('-').reverse().join('/')} : ${retires.length} poste${retires.length > 1 ? 's' : ''} à couvrir.`,
    semaine: lundi,
  });
  // La décision est annoncée à Igor et aux titulaires, avec ce qu'elle change au planning.
  data.annonces = [
    {
      id: uid('an'),
      at: new Date(`${today}T07:40:00`).toISOString(),
      titre: 'Arrêt d’Igor L. enregistré',
      effets: [
        `${retires.length} poste${retires.length > 1 ? 's' : ''} d’Igor L. retiré${retires.length > 1 ? 's' : ''} du planning, du ${fmtDateCourt(from)} au ${fmtDateCourt(to)}.`,
        `${retires.length} poste${retires.length > 1 ? 's' : ''} à couvrir : les titulaires s’en chargent dans « Résoudre ».`,
      ],
      pour: ['p_karim', 'p_helene', 'p_antoine'],
      luPar: [],
    },
  ];

  // ---- Une demande de congé en attente, dans deux semaines
  data.absences.push({
    id: uid('a'),
    personId: 'p_camille',
    from: addDays(lundi, 14),
    to: addDays(lundi, 18),
    type: 'conge',
    statut: 'demandee',
    motif: 'repos',
    createdAt: new Date(`${addDays(today, -2)}T13:15:00`).toISOString(),
  });

  // ---- Une demande de remplacement en attente : un poste de samedi de cette semaine
  const aRemplacer = data.shifts.find((x) => x.date === addDays(lundi, 5) && x.personId !== 'p_helene' && dayIndex(x.date) >= dayIndex(today));
  if (aRemplacer) {
    data.remplacements.push({ id: uid('r'), shiftId: aRemplacer.id, demandeur: aRemplacer.personId, date: aRemplacer.date, start: aRemplacer.start, end: aRemplacer.end, creeLe: new Date(`${addDays(today, -8)}T08:05:00`).toISOString(), volontaires: [], statut: 'ouverte' });
  }

  // ---- Préférences du mois à venir : sept personnes ont déjà répondu, trois n'ont encore rien posé.
  const moisCible = moisACollecter(data.officine, today);
  const ontRepondu = ['p_camille', 'p_lea', 'p_thomas', 'p_manon', 'p_ines', 'p_jules', 'p_antoine'];
  data.souhaits = data.personnes
    .filter((p) => ontRepondu.includes(p.id))
    .flatMap((p) => proposerSouhaits(data, p, moisCible, today))
    // Quelques écarts aux habitudes, pour que le mois ne soit pas une copie du précédent.
    .map((x, i) => (i % 11 === 5 ? { ...x, choix: 'repos' as const } : i % 13 === 7 ? { ...x, choix: 'matin' as const } : x));

  // ---- Un appel à l'équipe déjà lancé pour le premier poste à couvrir : deux volontaires ont répondu.
  // On prend le poste que le plus de monde peut tenir : c'est là que le tour de rôle se voit.
  const premier = data.trous
    .map((t) => ({ t, n: tourDeRole(data, t.shift, today).filter((c) => c.ok && c.personId !== 'p_helene').length, visible: absenceDecouvre(data, t.shift) }))
    .filter((x) => x.n > 0)
    // Un poste dont l'absence se voit d'abord : c'est lui que « Résoudre » détaille.
    .sort((a, b) => Number(b.visible) - Number(a.visible) || b.n - a.n)[0]?.t;
  if (premier) {
    const peuvent = tourDeRole(data, premier.shift, today).filter((c) => c.ok).map((c) => c.personId);
    data.remplacements.push({
      id: uid('r'),
      shiftId: premier.shift.id,
      trouId: premier.id,
      demandeur: premier.shift.personId,
      date: premier.shift.date,
      start: premier.shift.start,
      end: premier.shift.end,
      creeLe: new Date(`${today}T07:55:00`).toISOString(),
      sollicites: peuvent,
      volontaires: peuvent.filter((id) => id !== 'p_helene').slice(0, 2),
      indisponibles: [],
      statut: 'ouverte',
    });
  }

  data.journal.sort((a, b) => b.at.localeCompare(a.at));
  return data;
}

export { weekDates };
