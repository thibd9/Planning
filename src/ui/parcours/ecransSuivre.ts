import type { Etape, OutilsVisite } from '../Parcours';
import { addDays, mondayOf } from '../../domain/time';
import type { AppData } from '../../domain/types';
import { tourDeRole } from '../../engine/appel';
import { sousEffectifs, trousPharmacien } from '../../engine/core';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';

/**
 * « Écran par écran » : le quotidien du titulaire, champ par champ. Un chapitre par écran ; dans chaque étape, Solvi
 * montre chaque champ (geste « expliquer ») : ce qu'on y met, à quoi il sert, avec un exemple quand c'est utile.
 */
export function ecransSuivre(o: OutilsVisite): Etape[] {
  const s = (): ReturnType<typeof useStore.getState> => useStore.getState();
  const ui = (): ReturnType<typeof useUi.getState> => useUi.getState();
  const manque = (d: AppData, date: string): number => sousEffectifs(d, date).length + trousPharmacien(d, date).length;

  /** Un collègue a prévenu d'un retard sur son poste du jour. */
  const avecRetard = (): void => {
    const st = s();
    if (st.data.retards?.some((r) => r.date === st.today)) return;
    const postes = st.data.shifts.filter((x) => x.date === st.today && st.data.semaines[mondayOf(x.date)]?.statut === 'publie').sort((a, b) => b.start - a.start);
    const poste = postes.find((x) => x.personId === 'p_camille') ?? postes.find((x) => x.personId !== 'p_helene' && x.personId !== 'p_antoine');
    if (poste) st.prevenirRetard({ personId: poste.personId, date: st.today, start: poste.start, minutes: 10, motif: 'transport' });
  };
  /** Un accident du travail signalé ce matin : sa déclaration reste à faire. */
  const avecAccident = (): void => {
    const st = s();
    if (st.data.absences.some((a) => a.type === 'accident')) return;
    const qui = ['p_jules', 'p_thomas', 'p_ines'].find((id) => st.data.personnes.some((p) => p.id === id) && !st.data.absences.some((a) => a.personId === id && a.to >= st.today)) ?? 'p_jules';
    st.signalerAbsence({ personId: qui, from: st.today, to: addDays(st.today, 2), type: 'accident', accident: { jour: st.today, ou: 'travail', circonstances: 'Chute dans la réserve, en rangeant une commande.' } });
  };
  /** Un arrêt de deux jours la semaine prochaine, que plusieurs collègues peuvent couvrir. */
  const avecAbsenceImprevue = (): void => {
    o.avecPlanning();
    const st = s();
    if (st.data.absences.some((a) => a.type === 'maladie' && a.statut === 'approuvee')) return;
    const jour = addDays(o.semaineDans(1), 1);
    const choix = ['p_thomas', 'p_ines', 'p_jules', 'p_karim'].find((id) => {
      const poste = st.data.shifts.find((x) => x.personId === id && x.date === jour);
      if (!poste) return false;
      const sans: AppData = { ...st.data, shifts: st.data.shifts.filter((x) => x !== poste) };
      return manque(sans, jour) > manque(st.data, jour) && tourDeRole(sans, poste, st.today).filter((c) => c.ok).length >= 2;
    });
    st.declarerAbsence({ personId: choix ?? 'p_karim', from: jour, to: addDays(jour, 1), type: 'maladie', statut: 'approuvee' });
  };
  /** Le tableau de bord d'une journée chargée : un arrêt à couvrir, un accident à déclarer, un retard annoncé. */
  const journeeChargee = (): void => {
    avecAbsenceImprevue();
    avecAccident();
    avecRetard();
  };
  /** Une retouche de la semaine en cours, faite après la publication : l'équipe ne la voit pas encore. */
  const retoucheCetteSemaine = (): void => {
    const st = s();
    const lundi = mondayOf(st.today);
    if (st.data.semaines[lundi]?.statut !== 'publie') return;
    const snap = st.data.semaines[lundi]?.snapshot ?? [];
    const poste = st.data.shifts.find((x) => x.date > st.today && x.date <= addDays(lundi, 6) && x.end - x.start >= 4 * 60 && snap.some((y) => y.id === x.id && y.end === x.end));
    if (poste && !st.data.shifts.some((x) => x.date >= lundi && x.date <= addDays(lundi, 6) && !snap.some((y) => y.id === x.id && y.end === x.end && y.start === x.start))) o.poser((d) => ({ ...d, shifts: d.shifts.map((x) => (x.id === poste.id ? { ...x, end: x.end - 30 } : x)) }));
  };
  void ui;

  o.buts({
    'Tableau de bord': 'Chaque bloc du tableau de bord : ce qu’il montre, et où mène chacun de ses boutons.',
    'Construire': 'La grille de la semaine et la fenêtre d’un poste, champ par champ.',
  });
  return [
    // ---------------------------------------------------------------- 1. Tableau de bord
    {
      chapitre: 'Tableau de bord',
      qui: o.HELENE,
      cible: '.tb-banniere',
      titre: 'Les repères du jour',
      texte: () => 'En haut du tableau de bord, cinq repères chiffrés résument la pharmacie. Chacun est un bouton qui mène à l’écran où l’on agit.',
      jouer: () => {
        journeeChargee();
        o.helene('tableau');
      },
      gestes: [
        { faire: 'expliquer', sur: '.tb-resume', nom: 'Le résumé', quoi: 'le nombre de décisions qui vous attendent, toutes rubriques confondues.', sert: 'Quand rien n’attend, il vous invite à avancer le prochain planning.' },
        { faire: 'expliquer', sur: o.nieme('.tb-chiffre', 0), nom: 'L’équipe aujourd’hui', quoi: 'le nombre de personnes en poste aujourd’hui, et celui des absents.', sert: 'Un clic ouvre la journée : chacun sur une ligne de temps, avec ses pauses.', exemple: '7 en poste, 1 absent' },
        { faire: 'expliquer', sur: o.nieme('.tb-chiffre', 1), nom: 'Pharmacien présent', quoi: 'la part des heures d’ouverture de la semaine où un pharmacien est planifié.', sert: 'Sous 100 %, un moment reste sans pharmacien. Un clic ouvre la semaine dans « Construire ».', exemple: '95 %' },
        { faire: 'expliquer', sur: o.nieme('.tb-chiffre', 2), nom: 'Semaine prochaine', quoi: 'l’état du planning de la semaine qui vient : à construire, brouillon ou publiée.', sert: 'Un clic ouvre cette semaine dans « Construire ».' },
        { faire: 'expliquer', sur: o.nieme('.tb-chiffre', 3), nom: 'Compteurs d’heures', quoi: 'le nombre de personnes dont les heures s’écartent d’au moins une heure de leur contrat, en plus ou en moins.', sert: 'Un clic ouvre l’écran « Heures », où l’on paie, fait récupérer ou fait rattraper.' },
        { faire: 'expliquer', sur: o.nieme('.tb-chiffre', 4), nom: 'Prochaine garde', quoi: 'la date de la prochaine garde, et le pharmacien qui l’assure ou « À affecter ».', sert: 'Un clic ouvre l’écran « Gardes ».' },
      ],
    },
    {
      chapitre: 'Tableau de bord',
      qui: o.HELENE,
      cible: '.tb-decider',
      titre: 'La priorité et les décisions',
      texte: () => 'À droite, ce qui attend votre décision : d’abord la seule chose à traiter en premier, puis toutes les décisions rangées par sujet.',
      jouer: () => {
        journeeChargee();
        o.helene('tableau');
      },
      gestes: [
        { faire: 'expliquer', sur: '.tb-priorite[data-focus="priorite"] .tb-prio-texte', nom: 'À faire en premier', quoi: 'la décision qui passe avant toutes les autres, dite en une phrase.', sert: 'L’ordre est fixe : un accident à déclarer le jour même, un poste sans personne, un remplacement, un accord, une demande, une garde, un planning à publier.' },
        { faire: 'expliquer', sur: '.tb-priorite[data-focus="priorite"] .btn.primary', quoi: 'le bouton qui mène droit à ce qu’il faut faire.', sert: 'Ici, il ouvre « Résoudre » sur les absences à couvrir.' },
        { faire: 'expliquer', sur: '.tb-faire .card-head', nom: 'À décider', quoi: 'le nombre total de décisions qui vous attendent.', sert: '« Tout voir » ouvre l’écran « Résoudre », qui les réunit toutes.' },
        { faire: 'expliquer', sur: '#tb-declarer li', nom: 'Déclarer l’accident du travail', quoi: 'un accident du travail signalé, dont la déclaration à la caisse d’assurance maladie reste à faire, avec la date limite.', sert: 'Le délai légal est court : le rappel reste là tant que la déclaration n’est pas notée.' },
        { faire: 'expliquer', sur: '[data-declare]', quoi: 'le bouton à cliquer une fois la déclaration envoyée.', sert: 'Le rappel est retiré et la déclaration est notée au dossier de la personne.' },
        { faire: 'expliquer', sur: '.tb-sujet', nom: 'Une ligne de décisions', quoi: 'un sujet et le nombre de décisions qui l’attendent : absences à couvrir, remplacements, demandes de l’équipe, gardes, accords, plannings à publier.', sert: 'Un clic ouvre le bon onglet de « Résoudre ».' },
      ],
    },
    {
      chapitre: 'Tableau de bord',
      qui: o.HELENE,
      cible: '.tb-jour',
      titre: 'L’équipe au comptoir aujourd’hui',
      texte: () => 'Le bloc « Aujourd’hui au comptoir » montre toute l’équipe du jour sur l’échelle des heures d’ouverture.',
      jouer: () => {
        journeeChargee();
        retoucheCetteSemaine();
        o.helene('tableau');
      },
      gestes: [
        { faire: 'expliquer', sur: '.tb-jour .card-head .grow', nom: 'Aujourd’hui au comptoir', quoi: 'le nombre de personnes en poste aujourd’hui, et celui des absents.' },
        { faire: 'expliquer', sur: '.tb-jour .card-head .btn', quoi: 'ouvre la journée dans une fenêtre.', sert: 'On y règle les pauses et l’on y note un retard, un départ anticipé ou une absence non prévue.' },
        { faire: 'expliquer', sur: '#tb-nonpublie', nom: 'Modifications non publiées', quoi: 'l’avertissement qu’une retouche de cette semaine n’est pas encore publiée : l’équipe lit toujours l’ancienne version.', sert: 'Son bouton ouvre la semaine dans « Construire », sur « Publier ».', facultatif: true },
        { faire: 'expliquer', sur: '.tbj-ligne:not(.tete)', nom: 'Une ligne par personne', quoi: 'le poste de la personne sur l’échelle des heures ; la partie hachurée est sa pause déjeuner.' },
        { faire: 'expliquer', sur: '.tbj-maintenant', nom: 'Maintenant', quoi: 'l’heure qu’il est, prolongée par un trait à travers toutes les lignes.', sert: 'On voit d’un coup d’œil qui est au comptoir en ce moment.', facultatif: true },
        { faire: 'expliquer', sur: '.tbj-retard', nom: 'Retard', quoi: 'un retard annoncé par la personne elle-même, avec son heure d’arrivée prévue.', sert: 'Vous n’avez rien à saisir : l’étiquette apparaît dès qu’elle prévient.' },
        { faire: 'expliquer', sur: '.tbj-absents', nom: 'Absents', quoi: 'les personnes absentes aujourd’hui, d’une absence acceptée ou d’un arrêt.' },
      ],
    },
    {
      chapitre: 'Tableau de bord',
      qui: o.HELENE,
      cible: '.cycle',
      titre: 'Le prochain planning',
      texte: () => 'Dessous, le prochain planning à préparer : la première semaine qui n’est pas encore publiée, et le rappel de l’échéance du mois quand elle approche.',
      jouer: () => {
        journeeChargee();
        o.helene('tableau');
      },
      gestes: [
        { faire: 'expliquer', sur: '.tb-echeance', nom: 'L’échéance du mois', quoi: 'la date limite pour transmettre le planning du mois à l’équipe, puis le retard une fois cette date passée.', sert: 'La date se règle dans « Réglages », onglet « Planning ».', facultatif: true },
        { faire: 'expliquer', sur: '#echeance-preparer, #echeance-ouvrir', quoi: 'le raccourci vers le mois : il prépare en brouillon les semaines vides d’après vos habitudes, ou ouvre le mois pour le relire.', sert: 'Rien n’est publié sans vous.', facultatif: true },
        { faire: 'expliquer', sur: '.cycle .cycle-tete .grow', nom: 'Le prochain planning', quoi: 'la première semaine dont le planning n’est pas encore publié.' },
        { faire: 'expliquer', sur: '.cycle-etapes', nom: 'Les étapes', quoi: 'où en est cette semaine : préférences reçues, brouillon, contrôles, publication.', sert: 'Une coche marque une étape faite ; l’étape en cours est mise en avant.' },
        { faire: 'expliquer', sur: '.cycle .cycle-tete .btn', quoi: 'le bouton de l’étape suivante : « Construire », « Corriger » ou « Publier ».', sert: 'Il ouvre la semaine dans « Construire », là où il reste à faire.' },
      ],
    },
    {
      chapitre: 'Tableau de bord',
      qui: o.HELENE,
      cible: '.tb-agenda',
      cibleFin: '.tb-annonces',
      titre: 'Mon agenda et les décisions récentes',
      texte: () => 'Un titulaire a lui aussi son planning et ses rendez-vous. En bas, les décisions déjà prises restent consultables.',
      jouer: () => {
        journeeChargee();
        o.helene('tableau');
      },
      gestes: [
        { faire: 'expliquer', sur: '.tb-agenda .card-head .grow', nom: 'Mon agenda', quoi: 'votre prochain poste publié, aujourd’hui, demain ou plus tard.' },
        { faire: 'expliquer', sur: '.tb-agenda .card-head .btn', quoi: 'ouvre votre planning personnel, semaine par semaine.' },
        { faire: 'expliquer', sur: '.tb-agenda-liste', nom: 'Ensuite', quoi: 'vos quatre postes suivants, et votre prochaine garde s’il y en a une.', facultatif: true },
        { faire: 'expliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.tb-agenda-titre')].pop(), nom: 'Rendez-vous', quoi: 'vos rendez-vous acceptés à venir.', sert: 'Un clic sur un rendez-vous ouvre la conversation avec la personne.' },
        { faire: 'expliquer', sur: '.tb-annonces .card-head .grow', nom: 'Décisions récentes', quoi: 'les six dernières décisions annoncées, et ce qu’elles changent dans les plannings.', sert: 'Les personnes concernées ont été prévenues.' },
        { faire: 'expliquer', sur: '.tb-annonces .annonce-vu', quoi: 'marque cette annonce comme lue.', facultatif: true },
        { faire: 'expliquer', sur: '.tb-annonces .card-head .btn', quoi: 'marque d’un coup toutes les annonces comme lues.', facultatif: true },
      ],
    },
    {
      chapitre: 'Construire',
      qui: o.HELENE,
      cible: '.content .plan',
      cibleFin: '.content .plan',
      titre: 'La fenêtre d’un poste',
      texte: () => 'Un « + » ouvre la fenêtre d’un poste. Voici ce que contient chacun de ses champs.',
      jouer: () => {
        o.avecPlanning();
        o.semaineUne();
      },
      gestes: [
        { faire: 'cliquer', sur: '.plan-grid .add', dit: 'Cliquez sur le « + » d’une case', sert: 'Il ouvre un poste pour cette personne, ce jour-là.' },
        { faire: 'attendre', que: '.dialog' },
        { faire: 'expliquer', sur: o.parLibelle('Début', '.dialog'), quoi: 'l’heure d’arrivée de la personne.', sert: 'Le poste commence à cette heure ; un poste type la remplit tout seul.', exemple: '8 h 30' },
        { faire: 'expliquer', sur: o.parLibelle('Fin', '.dialog'), quoi: 'l’heure de départ.', sert: 'Elle doit suivre l’heure de début. La durée de travail s’affiche en bas de la fenêtre.', exemple: '16 h 30' },
      ],
    },
  ];
}
