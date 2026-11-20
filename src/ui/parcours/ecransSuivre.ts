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
  /** La semaine du mois dont on recueille les préférences, posée en brouillon : c'est là que tout se lit dans la grille. */
  const semaineBrouillonLundi = (): string => o.semaineASouhaits();
  const semaineBrouillon = (): string => {
    o.avecPlanning();
    const lundi = semaineBrouillonLundi();
    o.proposerSemaine(lundi);
    return lundi;
  };
  /** Ouvre « Construire » sur une semaine, toute l'équipe, préférences visibles. */
  const ouvrirSemaine = (lundi: string): void => {
    o.helene('construire');
    ui().setPlanVue('semaine');
    ui().setSeulementMoi(false);
    ui().setPrefsVisibles(true);
    ui().setSemaine(lundi);
  };
  /** Le libellé qui contient ce champ : quand plusieurs libellés se ressemblent (« Début », « Date de début »), on vise par l'identifiant. */
  const champ =
    (id: string): (() => HTMLElement | undefined) =>
    () =>
      document.getElementById(id)?.closest<HTMLElement>('label') ?? undefined;
  /** Ferme la fenêtre ouverte, s'il y en a une. */
  const fermer = (): void => document.querySelector<HTMLElement>('.dialog .dialog-fermer')?.click();
  const aria = (e: Element): string => e.getAttribute('aria-label') ?? '';
  /** Le « + » d'une case vide un jour de semaine (le samedi n'a pas de pause déjeuner par défaut). */
  const plusEnSemaine = (): HTMLElement | undefined => [...document.querySelectorAll<HTMLElement>('.plan-grid .add')].find((e) => !/samedi|dimanche/.test(aria(e)));
  const plusDe =
    (prenom: string, jour: string): (() => HTMLElement | undefined) =>
    () =>
      [...document.querySelectorAll<HTMLElement>('.plan-grid .add')].find((e) => aria(e).includes(prenom) && aria(e).includes(jour));
  /** La première tuile de poste d'une personne dans la grille. */
  const tuileDe =
    (prenom: string): (() => HTMLElement | undefined) =>
    () =>
      [...document.querySelectorAll<HTMLElement>('.plan-grid [role=row]')].find((r) => r.querySelector('.pg-p .nm')?.textContent?.includes(prenom))?.querySelector<HTMLElement>('button.tile:not(.repos-pose)') ?? undefined;
  /** Ces personnes demandent cette forme ce jour-là, et n'y ont pas encore de poste. */
  const demandes = (jour: string, ids: string[], choix: 'matin' | 'journee' | 'soir'): void =>
    o.poser((d) => ({
      ...d,
      souhaits: (d.souhaits ?? []).filter((x) => !(x.date === jour && (ids.includes(x.personId) || x.choix === choix))).concat(ids.map((personId) => ({ personId, date: jour, choix }))),
      shifts: d.shifts.filter((x) => !(x.date === jour && ids.includes(x.personId))),
    }));
  /** Un repos, une absence et une garde dans la semaine : chaque sorte de case se voit. */
  const casesParticulieres = (lundi: string): void => {
    const st = s();
    if (!(st.data.repos ?? []).some((r) => r.personId === 'p_karim' && r.date === addDays(lundi, 4))) st.poserRepos('p_karim', addDays(lundi, 4));
    if (!st.data.absences.some((a) => a.personId === 'p_sarah' && a.from === addDays(lundi, 3))) s().declarerAbsence({ motif: 'repos', personId: 'p_sarah', from: addDays(lundi, 3), to: addDays(lundi, 3), type: 'conge', statut: 'approuvee' });
    if (!s().data.gardes.some((g) => g.date >= lundi && g.date <= addDays(lundi, 6) && g.personId)) s().ajouterGardes([{ date: addDays(lundi, 5), start: 19 * 60 + 30, end: 8 * 60 + 30, type: 'volets_fermes', personId: 'p_lea', interventions: [] }], true);
  };
  /** Ouvre « Construire » en vue « Mois », sur le mois de cette semaine. */
  const ouvrirMois = (lundi: string): void => {
    o.helene('construire');
    ui().setSeulementMoi(false);
    ui().setPrefsVisibles(true);
    ui().setSemaine(lundi);
    // La vue « Mois » garde le mois qu'elle affiche : on la referme un instant pour qu'elle reparte de cette semaine.
    ui().setPlanVue('semaine');
    window.setTimeout(() => ui().setPlanVue('mois'), 80);
  };
  /** Une garde confiée à Léa, une autre encore à affecter : l'écran des gardes a de quoi se montrer. */
  const avecGardesDemo = (): void => {
    o.avecPlanning();
    const st = s();
    if (!st.data.gardes.some((x) => x.personId === 'p_lea' && x.date >= st.today && x.type === 'volets_fermes')) st.ajouterGardes([{ date: addDays(o.semaineDans(3), 5), start: 19 * 60 + 30, end: 8 * 60 + 30, type: 'volets_fermes', personId: 'p_lea', interventions: [] }], true);
    if (!s().data.gardes.some((x) => !x.personId && x.date >= st.today)) s().ajouterGardes([{ date: addDays(o.semaineDans(5), 6), start: 9 * 60, end: 19 * 60, type: 'volets_ouverts', personId: null, interventions: [] }], false);
  };
  /** Un poste publié pour cette personne demain : son retard a une heure d'arrivée à calculer. */
  const posteDemainPour = (id: string): void => {
    o.avecPlanning();
    const st = s();
    const demain = addDays(st.today, 1);
    if (st.data.semaines[mondayOf(demain)]?.statut !== 'publie' || st.data.shifts.some((x) => x.personId === id && x.date === demain)) return;
    o.poser((d) => ({ ...d, shifts: d.shifts.concat({ id: `demo-retard-${demain}`, personId: id, date: demain, start: 9 * 60, end: 14 * 60, activite: 'comptoir', origine: 'manuel' }) }));
  };
  /** Ouvre « Résoudre » sur un onglet. */
  const ouvrirResoudre = (onglet: string): void => {
    ui().setSujet(onglet);
    o.helene('resoudre');
  };
  /** Une décision dans chaque onglet de « Résoudre » : un arrêt, un remplacement, un congé, une garde, un accord. */
  const toutADecider = (): void => {
    avecAbsenceImprevue();
    o.avecDemande();
    avecGardesDemo();
    const st = s();
    if (!st.data.absences.some((x) => x.personId === 'p_jules' && x.type === 'conge')) st.declarerAbsence({ motif: 'famille', personId: 'p_jules', from: addDays(o.semaineDans(4), 0), to: addDays(o.semaineDans(4), 4), type: 'conge', statut: 'demandee' });
    const garde = s().data.gardes.find((x) => !x.personId && x.date >= st.today);
    if (garde && !(s().data.accords ?? []).some((x) => x.auteur === 'p_antoine')) s().proposer('p_antoine', 'affecterGarde', [garde.id, 'p_antoine', false]);
    // Une retouche de la semaine prochaine, pas encore publiée : l'onglet « À publier » a de quoi se montrer.
    retoucheProche();
  };
  /** Thomas ne peut pas venir pour raison médicale : demande urgente, justificatif joint. */
  const urgenceMedicale = (): void => {
    const st = s();
    if (st.data.remplacements.some((r) => r.urgence === 'medical' && r.statut === 'ouverte')) return;
    const poste = st.data.shifts.filter((x) => x.personId === 'p_thomas' && x.date >= o.semaineDans(1)).sort((x, y) => x.date.localeCompare(y.date) || x.start - y.start)[0];
    const piece = { nom: 'justificatif-exemple.svg', type: 'image/svg+xml', taille: 480, data: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260"><rect width="420" height="260" rx="18" fill="#eef4fb"/><text x="210" y="140" font-family="sans-serif" font-size="22" text-anchor="middle" fill="#1d2731">Justificatif</text></svg>')}` };
    if (poste) st.demanderRemplacement(poste, 'medical', piece, undefined, { motif: 'sante' });
  };
  /** Dans l'onglet « Demandes », un élément de la ligne de congé d'une personne. */
  const congeDe =
    (prenom: string, quoi: string): (() => HTMLElement | undefined) =>
    () =>
      [...document.querySelectorAll<HTMLElement>('.panneau .decision')].find((e) => e.textContent?.includes(prenom) && /Congé/.test(e.textContent ?? ''))?.querySelector<HTMLElement>(quoi) ?? undefined;
  /** Dans l'onglet « Demandes », un élément de la première demande d'horaires. */
  const besoin =
    (quoi: string): (() => HTMLElement | undefined) =>
    () =>
      [...document.querySelectorAll<HTMLElement>('.panneau .decision')].find((e) => e.textContent?.includes('à arbitrer'))?.querySelector<HTMLElement>(quoi) ?? undefined;
  /** Nicolas demande un rendez-vous à Caroline : la carte de réponse arrive dans leur conversation. */
  const avecRendezVous = (): void => {
    o.avecPlanning();
    const st = s();
    if ((st.data.rendezVous ?? []).some((r) => r.de === 'p_camille' && r.avec === 'p_helene')) return;
    const jour = addDays(o.semaineDans(1), 1);
    st.demanderRendezVous({ de: 'p_camille', avec: 'p_helene', sujet: 'Formation ou compétence', date: jour, start: 14 * 60, end: 14 * 60 + 30, note: 'J’aimerais parler de la formation en dermocosmétique.' });
  };
  /** Un fichier de Caroline et un arrêt partagé par Nicolas : chaque onglet des documents a de quoi se montrer. */
  const avecDocuments = (): void => {
    avecAbsenceImprevue();
    const st = s();
    const svg = (titre: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#eef4fb"/><text x="150" y="105" font-family="sans-serif" font-size="18" text-anchor="middle">${titre}</text></svg>`)}`;
    if (!(st.data.documents ?? []).some((d) => d.personId === 'p_helene')) st.ajouterDocument({ personId: 'p_helene', nom: 'avenant-horaires.svg', type: 'image/svg+xml', taille: 620, data: svg('Avenant'), categorie: 'contrat', partage: false });
    if (!(s().data.documents ?? []).some((d) => d.personId === 'p_camille')) s().ajouterDocument({ personId: 'p_camille', nom: 'arret-de-travail.svg', type: 'image/svg+xml', taille: 540, data: svg('Arrêt de travail'), categorie: 'arret', partage: true });
  };
  /** Le mardi de la semaine prochaine : une absence et une garde, pour que tout se lise dans la journée. */
  const journeeOuverte = (): void => {
    o.avecPlanning();
    const mardi = addDays(o.semaineDans(1), 1);
    if (!s().data.absences.some((a) => a.personId === 'p_sarah' && a.from === mardi)) s().declarerAbsence({ motif: 'repos', personId: 'p_sarah', from: mardi, to: mardi, type: 'conge', statut: 'approuvee' });
    if (!s().data.gardes.some((g) => g.date === mardi)) s().ajouterGardes([{ date: mardi, start: 19 * 60 + 30, end: 8 * 60 + 30, type: 'volets_fermes', personId: 'p_lea', interventions: [] }], true);
  };
  /** Un poste d'Inès (temps partiel), la semaine prochaine, retouché après publication : son accord est à recueillir. */
  const retoucheProche = (): void => {
    const lundi = o.semaineDans(1);
    const st = s();
    const snap = st.data.semaines[lundi]?.snapshot ?? [];
    if (st.data.shifts.some((x) => x.date >= lundi && x.date <= addDays(lundi, 6) && !snap.some((y) => y.id === x.id && y.start === x.start && y.end === x.end))) return;
    const poste = st.data.shifts.filter((x) => x.personId === 'p_ines' && x.date >= lundi && x.date <= addDays(lundi, 6) && x.end - x.start >= 4 * 60).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (poste) st.saveShift({ ...poste, end: poste.end - 60 });
  };

  o.buts({
    'Tableau de bord': 'Chaque bloc du tableau de bord : ce qu’il montre, et où mène chacun de ses boutons.',
    'Construire': 'La grille de la semaine, la fenêtre d’un poste, les propositions et la publication, champ par champ.',
    'Le mois': 'La vue « Mois » : les préférences reçues, les trois actions sur le mois, et ce que dit chaque case.',
    'Imprimer': 'L’aperçu avant impression : la période, l’encre, les personnes, et la feuille telle qu’elle sortira.',
    'Gardes': 'L’écran des gardes, la fiche d’une garde jusqu’à la paie, et ses trois fenêtres : ajouter, importer, répartir.',
    'Formation et inventaire': 'Les deux fenêtres ouvertes depuis « Créer » : une formation, un inventaire.',
    'Retard ou absence': 'Le bouton « Retard ou absence » : un retard, une absence, un accident du travail.',
    'Résoudre': 'Les onglets de « Résoudre », une absence à couvrir, et chaque fenêtre de décision.',
    'Messages et rendez-vous': 'La messagerie côté titulaire : les conversations, et les rendez-vous à demander ou à accepter.',
    'Heures': 'Le compteur d’heures et la fenêtre pour faire récupérer ou rattraper.',
    'Équité': 'Qui a porté quoi, face à sa part : la période, les compteurs, le détail et la fatigue.',
    'Statistiques': 'Les chiffres clés de l’équipe et ses quatre onglets.',
    'Journal et paie': 'Le journal des décisions et la fiche navette du mois.',
    'Documents de la pharmacie': 'Les cinq onglets des documents : plannings, absences, fichiers, documents reçus, historique de l’équipe.',
    'Aide': 'La recherche, le rythme, les thèmes, le lexique et le support.',
    'La journée': 'La fenêtre « Voir la journée » : lire l’équipe d’un jour, régler les pauses, noter un retard.',
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
    // ---------------------------------------------------------------- 2. Construire
    {
      chapitre: 'Construire',
      qui: o.HELENE,
      cible: '.page-head',
      titre: 'L’en-tête de « Construire »',
      texte: () => 'L’en-tête choisit ce que l’on regarde (qui, quelle période) et résume la semaine en trois chiffres.',
      jouer: () => {
        const lundi = semaineBrouillon();
        // Une manipulation sans effet, annulée : « Annuler » et « Rétablir » sont tous deux disponibles.
        const st = s();
        const x = st.data.shifts.find((y) => y.date >= lundi && y.date <= addDays(lundi, 6));
        if (x && !st.future.length) {
          st.saveShift({ ...x });
          s().saveShift({ ...x });
          s().undo();
        }
        ouvrirSemaine(lundi);
      },
      gestes: [
        { faire: 'expliquer', sur: '.ph-outils .seg[aria-label="Personnes affichées"]', nom: 'Toute l’équipe ou Mes postes', quoi: 'qui s’affiche dans la grille : toute l’équipe, ou seulement votre ligne.', sert: '« Mes postes » sert à lire, ou à imprimer, vos propres horaires de titulaire.' },
        { faire: 'expliquer', sur: '.ph-outils .seg[aria-label="Période affichée"]', nom: 'Semaine ou Mois', quoi: 'la période affichée : la grille d’une semaine, ou le mois entier.', sert: 'Le mois montre quatre semaines d’un coup, avec les préférences reçues, et se publie d’un bloc.' },
        { faire: 'expliquer', sur: '[aria-label="Annuler la dernière manipulation"]', nom: 'Annuler', quoi: 'défait la dernière manipulation : un poste posé, déplacé ou supprimé, une proposition placée.', sert: 'Raccourci clavier : Ctrl + Z.' },
        { faire: 'expliquer', sur: '[aria-label="Rétablir"]', nom: 'Rétablir', quoi: 'refait ce que vous venez d’annuler.', sert: 'Raccourci clavier : Ctrl + Maj + Z.' },
        { faire: 'expliquer', sur: '[aria-label="Imprimer le planning"]', nom: 'Imprimer', quoi: 'ouvre l’aperçu avant impression de la période affichée.', sert: 'Semaine ou mois, couleur ou noir et blanc, pauses ou non : tout se règle dans l’aperçu.' },
        { faire: 'expliquer', sur: o.nieme('.ph-reperes li', 0), nom: 'Personnes au planning', quoi: 'le nombre de personnes qui ont au moins un poste cette semaine.' },
        { faire: 'expliquer', sur: o.nieme('.ph-reperes li', 1), nom: 'Heures planifiées', quoi: 'le total des heures de travail posées cette semaine, pauses déjeuner déduites.' },
        { faire: 'expliquer', sur: o.nieme('.ph-reperes li', 2), nom: 'Pharmacien présent', quoi: 'la part des heures d’ouverture où un pharmacien est planifié.', sert: 'L’anneau devient vert à 100 % ; en dessous, la ligne « Équipe au complet ? » dit où il manque.' },
      ],
    },
    {
      chapitre: 'Construire',
      qui: o.HELENE,
      cible: '.plan-bar',
      titre: 'La barre de la semaine',
      texte: () => 'Au-dessus de la grille, la barre de la semaine : où l’on est, dans quel état est le planning, et les actions sur toute la semaine.',
      jouer: () => ouvrirSemaine(semaineBrouillon()),
      gestes: [
        { faire: 'expliquer', sur: '[aria-label="Semaine suivante"]', nom: 'Les flèches', quoi: 'passent à la semaine précédente ou suivante.' },
        { faire: 'expliquer', sur: '.week-nav .label', nom: 'La semaine affichée', quoi: 'ses dates, son numéro, et son éloignement : en cours, la semaine prochaine, dans trois semaines.' },
        { faire: 'expliquer', sur: '.plan-bar > .pill', nom: 'L’état de la semaine', quoi: '« Brouillon », visible de vous seuls ; « Publié » avec sa date ; ou les modifications qui attendent d’être publiées.' },
        { faire: 'expliquer', sur: '.plan-bar .seg[aria-label="Lecture du planning"]', nom: 'Heures ou Équité', quoi: 'ce que la grille montre à côté des postes : les heures de chacun sous son nom, ou une colonne d’équité sur huit semaines.', sert: 'Une lecture « Coût » s’ajoute quand les coûts sont activés dans les réglages.' },
        { faire: 'expliquer', sur: o.parTexte('.plan-bar .btn', 'Recopier'), quoi: 'recopie dans le brouillon les postes de la semaine précédente.', sert: 'Utile quand une semaine ressemble à la précédente : il ne reste qu’à retoucher.' },
        { faire: 'expliquer', sur: '#plan-zero', quoi: 'retire tous les postes et les repos de la semaine. Pour la semaine en cours, seuls les jours à venir.', sert: 'Si la semaine était publiée, l’équipe garde la version publiée tant que vous ne republiez pas.' },
        { faire: 'expliquer', sur: "[data-tour='proposer']", quoi: 'calcule trois plannings complets pour la semaine, sans rien publier.', sert: 'Équité, préférences ou contrats d’abord : vous comparez, puis vous en placez un dans le brouillon.' },
        { faire: 'expliquer', sur: "[data-focus='publier']", quoi: 'envoie la semaine à l’équipe après un dernier contrôle.', sert: 'Une fois publiée, le bouton devient « Publier les modifications » dès qu’une retouche attend.' },
      ],
    },
    {
      chapitre: 'Construire',
      qui: o.HELENE,
      cible: "[data-tour='grille']",
      titre: 'La grille',
      texte: () => 'La grille : une ligne par personne, une colonne par jour. En tête de chaque jour, le constat « Équipe au complet ? ».',
      jouer: () => ouvrirSemaine(semaineBrouillon()),
      gestes: [
        { faire: 'expliquer', sur: o.parLibelle('Préférences', '.plan-grid'), quoi: 'cochée, chaque case montre ce que la personne a demandé pour ce jour.', sert: 'La case n’existe que si le planning se prépare avec l’équipe.' },
        { faire: 'expliquer', sur: o.nieme('.plan-grid .jour-btn', 1), nom: 'Voir la journée', quoi: 'la date du jour ; un clic ouvre la journée, toute l’équipe sur une ligne de temps.', sert: 'On y règle les pauses et l’on y note les retards.' },
        { faire: 'expliquer', sur: '.plan-grid .pg-o.lab', nom: 'Équipe au complet ?', quoi: 'pour chaque jour, le constat : « Complet », « Manque du monde », « Pharmacien à prévoir », « Aucun pharmacien » ou « Rien de posé ».' },
        { faire: 'expliquer', sur: o.nieme('.plan-grid .pg-o:not(.lab)', 1), nom: 'Le constat du jour', quoi: 'une coche verte quand un pharmacien est là sur toute l’ouverture et que l’effectif est atteint ; sinon, l’heure où il manque quelqu’un.', sert: 'Survolez la case : la cause et quoi faire s’affichent.' },
        { faire: 'expliquer', sur: '.plan-grid .pg-group', nom: 'Les groupes', quoi: 'les personnes rangées par fonction : pharmaciens, titulaires compris, puis préparateurs, animateurs, apprentis, étudiants.' },
        { faire: 'expliquer', sur: '.plan-grid .pg-p', nom: 'Une personne', quoi: 'son nom, ses heures planifiées face à son contrat, et l’écart.', exemple: '35 h / 35 h · atteint' },
        { faire: 'expliquer', sur: '.plan-grid button.tile:not(.repos-pose)', nom: 'Une tuile', quoi: 'un poste : ses horaires, sa tâche et sa durée. Sa couleur dit le moment de la journée.', sert: 'Un clic l’ouvre pour la corriger ; on la fait glisser vers une autre case pour la déplacer.' },
        { faire: 'expliquer', sur: plusEnSemaine, nom: '+', quoi: 'pose un nouveau poste dans une case vide.' },
        { faire: 'expliquer', sur: '.plan-grid .pg-pref', nom: 'La pastille de préférence', quoi: 'ce que la personne a demandé ce jour-là : matin, journée, après-midi ou repos.', sert: 'Une coche quand le poste posé la suit ; une autre teinte quand il s’en écarte.' },
      ],
    },
    {
      chapitre: 'Construire',
      qui: o.HELENE,
      cible: "[data-tour='grille']",
      cibleFin: '.plan .legend',
      titre: 'Les autres cases, la colonne de droite et la légende',
      texte: () => 'Une case peut aussi porter un repos, une absence ou une garde. La lecture « Équité » ajoute une colonne à droite.',
      jouer: () => {
        const lundi = semaineBrouillon();
        casesParticulieres(lundi);
        ouvrirSemaine(lundi);
      },
      gestes: [
        { faire: 'expliquer', sur: '.plan-grid .tile.repos-pose', nom: 'Repos', quoi: 'un jour de repos posé : la personne ne travaille pas ce jour-là.', sert: 'Les propositions de planning le respectent. Un clic le change en poste.' },
        { faire: 'expliquer', sur: '.plan-grid .pg-c > span.tile:not(.garde)', nom: 'Une absence', quoi: 'un congé, un arrêt ou une formation acceptés : la case ne prend plus de poste.' },
        { faire: 'expliquer', sur: '.plan-grid .tile.garde', nom: 'Une garde', quoi: 'la garde confiée à ce pharmacien, avec ses horaires.', sert: 'Elle se règle dans l’écran « Gardes ».' },
        { faire: 'expliquer', sur: '.plan-grid .unavail', nom: 'Le cadenas', quoi: 'une indisponibilité reconnue : la personne ne peut pas travailler ce jour-là, par exemple un jour d’école.', sert: 'Survolez-le pour lire la raison.', facultatif: true },
        { faire: 'cliquer', sur: o.parTexte('.plan-bar .seg button', 'Équité'), dit: 'Passez en lecture « Équité »', sert: 'Une colonne s’ajoute à droite de la grille.' },
        { faire: 'expliquer', sur: '.plan-grid .pg-sum', nom: 'La colonne de droite', quoi: 'pour chaque personne : ses samedis travaillés face à sa part sur huit semaines, ses fermetures du soir, et son niveau de fatigue.', sert: 'Survolez-la : les facteurs de fatigue s’affichent.' },
        { faire: 'cliquer', sur: o.parTexte('.plan-bar .seg button', 'Heures'), dit: 'Revenez à la lecture « Heures »', sert: 'La colonne disparaît ; les heures restent sous chaque nom.' },
        { faire: 'expliquer', sur: '.plan .legend', nom: 'La légende', quoi: 'les pictogrammes des tâches, les couleurs des postes selon l’heure de fin ou de début, et les autres repères de la grille.' },
      ],
    },
    {
      chapitre: 'Construire',
      qui: o.HELENE,
      cible: "[data-tour='controles']",
      titre: 'La carte des contrôles',
      texte: () => 'Sous la grille, Solvéa relit la semaine : ce qui bloque, ce qui mérite votre attention, et la règle appliquée.',
      jouer: () => ouvrirSemaine(semaineBrouillon()),
      gestes: [
        { faire: 'expliquer', sur: "[data-tour='controles'] .card-head", nom: 'Contrôles', quoi: 'le nombre de points bloquants et d’alertes de la semaine.', sert: 'C’est une aide à la conformité : elle signale des écarts, elle ne vaut pas certification.' },
        { faire: 'expliquer', sur: "[data-tour='controles'] .issues-titre", nom: 'Les groupes de contrôles', quoi: '« Impossible en l’état », « À corriger », « À surveiller », « Pour information », du plus grave au plus léger.' },
        { faire: 'expliquer', sur: "[data-tour='controles'] .issue:not(.diag)", nom: 'Un contrôle', quoi: 'le constat, son détail, puis la règle qui s’applique et sa version.', sert: 'Un clic signale dans la grille la personne et le jour concernés.' },
        { faire: 'expliquer', sur: "[data-tour='controles'] .issue.diag .why summary", quoi: 'ouvre, pour une impossibilité, la raison de chacun et les pistes pour la lever.', facultatif: true },
        { faire: 'cliquer', sur: "[data-tour='controles'] .issue:not(.diag)", dit: 'Cliquez sur un contrôle', sert: 'La grille signale aussitôt la personne et le jour concernés.' },
      ],
    },
    {
      chapitre: 'Construire',
      qui: o.HELENE,
      cible: '.content .plan',
      cibleFin: '.content .plan',
      titre: 'La fenêtre d’un poste : les horaires',
      texte: () => 'Un « + » ouvre la fenêtre d’un nouveau poste. Elle commence par les postes types et les horaires.',
      jouer: () => ouvrirSemaine(semaineBrouillon()),
      gestes: [
        { faire: 'cliquer', sur: plusEnSemaine, dit: 'Cliquez sur le « + » d’une case', sert: 'Il ouvre un poste pour cette personne, ce jour-là.' },
        { faire: 'attendre', que: '.dialog' },
        { faire: 'expliquer', sur: '.dialog .ptc-liste', nom: 'Poste type', quoi: 'les horaires types de ce jour, réglés dans « Réglages » ; un clic remplit le début, la fin et les pauses.', sert: 'La coche montre le poste type qui correspond aux horaires saisis.' },
        { faire: 'expliquer', sur: '#ptc-repos', quoi: 'pose un jour de repos à la place d’un poste.', sert: 'Sur un poste déjà posé, il le retire. Les propositions de planning respectent ce repos.' },
        { faire: 'expliquer', sur: o.parLibelle('Début', '.dialog'), quoi: 'l’heure d’arrivée de la personne.', sert: 'Un poste type la remplit tout seul ; elle se règle au quart d’heure.', exemple: '8 h 30' },
        { faire: 'expliquer', sur: o.parLibelle('Fin', '.dialog'), quoi: 'l’heure de départ.', sert: 'Elle doit suivre l’heure de début. La durée de travail s’affiche en bas de la fenêtre.', exemple: '16 h 30' },
        { faire: 'expliquer', sur: o.parLibelle('Pause déjeuner', '.dialog'), quoi: 'cochée, le poste est coupé par une pause qui n’est pas comptée en temps de travail.' },
        { faire: 'expliquer', sur: o.parLibelle('Début de pause', '.dialog'), quoi: 'l’heure à laquelle la personne part déjeuner.', sert: 'La pause doit tenir à l’intérieur du poste.', exemple: '12 h 30' },
        { faire: 'expliquer', sur: o.parLibelle('Fin de pause', '.dialog'), quoi: 'l’heure de reprise.', exemple: '13 h 30' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Construire',
      qui: o.HELENE,
      cible: '.content .plan',
      cibleFin: '.content .plan',
      titre: 'Qui a demandé ce créneau ?',
      texte: () => 'Thomas, Inès et Jules ont tous les trois demandé le matin de ce mardi. La fenêtre du poste le dit, et départage par tirage au sort.',
      jouer: () => {
        const lundi = semaineBrouillon();
        demandes(addDays(lundi, 1), ['p_thomas', 'p_ines', 'p_jules'], 'matin');
        ouvrirSemaine(lundi);
      },
      gestes: [
        { faire: 'cliquer', sur: plusDe('Thomas', 'mardi'), dit: 'Ouvrez un poste pour Thomas, mardi', sert: 'Thomas, Inès et Jules ont tous les trois demandé ce matin-là.' },
        { faire: 'attendre', que: '.dialog' },
        { faire: 'cliquer', sur: o.parTexte('.dialog .ptc', 'Matin'), dit: 'Choisissez le poste type « Matin »', sert: 'Solvéa compte aussitôt qui a demandé ce créneau.' },
        { faire: 'attendre', que: '#dp-preferences' },
        { faire: 'expliquer', sur: '#dp-preferences .dp-pref-tete', nom: 'Qui a demandé ce créneau ?', quoi: 'la préférence à laquelle correspond ce poste : matin, journée, après-midi.', sert: 'Ce bloc n’apparaît que si le planning se prépare avec l’équipe.' },
        { faire: 'expliquer', sur: '#dp-pref-texte', nom: 'Le verdict', quoi: 'qui a demandé ce créneau : personne, la personne de la case, quelqu’un d’autre, plusieurs personnes ; ou un repos demandé ce jour-là.' },
        { faire: 'expliquer', sur: '.dp-pref-qui', nom: 'Les chances', quoi: 'chaque personne qui a demandé ce créneau, ses préférences suivies ces huit semaines et ses chances au tirage.', sert: 'Moins ses préférences ont été suivies, plus ses chances sont grandes.' },
        { faire: 'expliquer', sur: '#dp-tirer', quoi: 'tire au sort, parmi eux, qui reçoit le poste.', sert: 'Sans tirage, le poste reste à la personne de la case.' },
        { faire: 'cliquer', sur: '#dp-tirer', dit: 'Cliquez sur « Tirer au sort »', sert: 'Le résultat s’affiche, et le poste passe au nom désigné.' },
        { faire: 'expliquer', sur: '#dp-tirage', nom: 'Le résultat', quoi: 'le nom désigné par le sort.', sert: 'Rien n’est posé tant que vous n’enregistrez pas ; « Retirer au sort » recommence.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Construire',
      qui: o.HELENE,
      cible: '.content .plan',
      cibleFin: '.content .plan',
      titre: 'Accorder une préférence',
      texte: () => 'Ce mercredi, seule Inès a demandé le matin. Un poste ouvert dans la case de Thomas le signale, et le donne à Inès en un clic.',
      jouer: () => {
        const lundi = semaineBrouillon();
        const jour = addDays(lundi, 2);
        demandes(jour, ['p_ines'], 'matin');
        o.poser((d) => ({ ...d, souhaits: (d.souhaits ?? []).filter((x) => !(x.date === jour && x.personId === 'p_thomas')).concat({ personId: 'p_thomas', date: jour, choix: 'soir' as const }) }));
        o.poser((d) => ({ ...d, shifts: d.shifts.filter((x) => !(x.date === jour && x.personId === 'p_thomas')) }));
        ouvrirSemaine(lundi);
      },
      gestes: [
        { faire: 'cliquer', sur: plusDe('Thomas', 'mercredi'), dit: 'Ouvrez un poste pour Thomas, mercredi', sert: 'Seule Inès a demandé ce matin-là.' },
        { faire: 'attendre', que: '.dialog' },
        { faire: 'cliquer', sur: o.parTexte('.dialog .ptc', 'Matin'), dit: 'Choisissez le poste type « Matin »' },
        { faire: 'attendre', que: '#dp-accorder' },
        { faire: 'expliquer', sur: '#dp-pref-texte', nom: 'Le verdict', quoi: 'une seule personne a demandé ce créneau, et ce n’est pas celle de la case.' },
        { faire: 'expliquer', sur: '#dp-accorder', quoi: 'donne ce poste à la seule personne qui l’a demandé.', sert: 'La fenêtre change de nom ; il reste à enregistrer.' },
        { faire: 'cliquer', sur: '#dp-accorder', dit: 'Cliquez sur « Accorder ce poste à Inès »' },
        { faire: 'expliquer', sur: '#dp-revenir', quoi: 'rend le poste à la personne de la case.', sert: 'Utile si vous changez d’avis avant d’enregistrer.' },
        { faire: 'expliquer', sur: '.dp-pref-autres', nom: 'Les autres préférences', quoi: 'ce que les autres ont demandé ce jour-là, forme par forme.', facultatif: true },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Construire',
      qui: o.HELENE,
      cible: '.content .plan',
      cibleFin: '.content .plan',
      titre: 'La fenêtre d’un poste : la tâche',
      texte: () => 'Une tuile ouvre son poste. Sous les horaires, on choisit la tâche.',
      jouer: () => ouvrirSemaine(semaineBrouillon()),
      gestes: [
        { faire: 'cliquer', sur: tuileDe('Thomas'), dit: 'Cliquez sur une tuile de Thomas', sert: 'La fenêtre « Modifier le poste » s’ouvre.' },
        { faire: 'attendre', que: '.dialog' },
        { faire: 'expliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.dialog .notice.ok')].find((e) => e.textContent?.includes('Pourquoi ce poste')), nom: 'Pourquoi ce poste ?', quoi: 'la raison donnée par le calcul quand il a posé ce poste.', sert: 'Elle disparaît dès que vous modifiez le poste.', facultatif: true },
        { faire: 'expliquer', sur: o.parLibelle('Tâche', '.dialog'), quoi: 'ce que fait la personne pendant ce poste : comptoir, réception ou administratif.', sert: 'Le comptoir compte dans l’effectif attendu ; la tâche se lit sur la tuile.' },
        { faire: 'expliquer', sur: '#tache-vers-formation', quoi: 'ouvre la fenêtre « Planifier une formation » : intitulé, lieu, dates, participants.', sert: '« Inventaire » ouvre de même la fenêtre de l’inventaire.' },
        { faire: 'cliquer', sur: '#ptc-repos', dit: 'Choisissez le poste type « Repos »', sert: 'Les horaires laissent place à un jour de repos.' },
        { faire: 'expliquer', sur: '#dp-repos', nom: 'Jour de repos', quoi: 'la personne ne travaille pas ce jour-là ; le poste prévu sera retiré.', sert: 'Si c’est aussi sa préférence, la fenêtre le dit.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Construire',
      qui: o.HELENE,
      cible: '.content .plan',
      cibleFin: '.content .plan',
      titre: 'La fenêtre d’un poste : les pauses courtes',
      texte: () => 'Plus bas, les pauses courtes : dix à vingt minutes, sans effet sur le décompte des heures.',
      jouer: () => ouvrirSemaine(semaineBrouillon()),
      gestes: [
        { faire: 'cliquer', sur: tuileDe('Thomas'), dit: 'Cliquez sur une tuile de Thomas' },
        { faire: 'attendre', que: '.dialog' },
        { faire: 'expliquer', sur: '#pc-ajouter', quoi: 'ajoute une pause courte de 15 minutes, à la première place libre.', sert: 'Dix à vingt minutes, quatre au plus. Elles se lisent sur le planning sans changer le décompte des heures.' },
        { faire: 'expliquer', sur: '#pc-proposer', quoi: 'pose une pause courte par demi-journée de travail.', facultatif: true },
        { faire: 'cliquer', sur: '#pc-ajouter', dit: 'Cliquez sur « Ajouter une pause courte »' },
        { faire: 'expliquer', sur: o.parLibelle('Début', '.dialog .pc-ligne'), quoi: 'l’heure de la pause courte, à cinq minutes près.', sert: 'Hors du temps de travail ou en double, elle n’est pas gardée : un message le dit.' },
        { faire: 'expliquer', sur: o.parLibelle('Durée', '.dialog .pc-ligne'), quoi: '10, 15 ou 20 minutes.' },
        { faire: 'expliquer', sur: '.dialog .pc-ligne [aria-label^="Retirer la pause"]', nom: 'La corbeille', quoi: 'retire cette pause courte.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Construire',
      qui: o.HELENE,
      cible: '.content .plan',
      cibleFin: '.content .plan',
      titre: 'La fenêtre d’un poste : contrôle et enregistrement',
      texte: () => 'En bas de la fenêtre, le poste se dessine et se contrôle avant même d’être enregistré.',
      jouer: () => ouvrirSemaine(semaineBrouillon()),
      gestes: [
        { faire: 'cliquer', sur: tuileDe('Thomas'), dit: 'Cliquez sur une tuile de Thomas' },
        { faire: 'attendre', que: '.dialog' },
        { faire: 'expliquer', sur: '.dialog .dp-apercu', nom: 'L’aperçu', quoi: 'le poste dessiné sur l’échelle des heures d’ouverture, pause comprise.' },
        { faire: 'choisir', dans: () => [...document.querySelectorAll<HTMLElement>('.dialog .dp-horaires label.field input')][1], valeur: '23:30', dit: 'Repoussez la fin du poste à 23 h 30', sert: 'Le poste devient trop long : regardez ce qu’il déclenche.' },
        { faire: 'expliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.dialog .eyebrow')].find((e) => e.textContent?.includes('déclenche'))?.parentElement, nom: 'Ce que ce poste déclenche', quoi: 'les nouveaux points que ce poste créerait dans les contrôles, avant même d’enregistrer.', sert: 'En rouge un point bloquant, en orange une alerte. Sans rien de nouveau, un message vert le dit.' },
        { faire: 'expliquer', sur: '#dp-total', nom: 'La durée de travail', quoi: 'le temps de travail du poste, pause déjeuner déduite.' },
        { faire: 'expliquer', sur: '.dialog-foot .btn.danger', quoi: 'retire ce poste du brouillon.', sert: 'Il n’existe que sur un poste déjà posé.' },
        { faire: 'expliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.dialog-foot .btn')].find((e) => e.textContent?.trim() === 'Annuler'), quoi: 'ferme la fenêtre sans rien changer.' },
        { faire: 'expliquer', sur: o.VALIDER, quoi: 'pose le poste dans le brouillon.', sert: 'L’équipe ne le voit qu’après publication.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Construire',
      qui: o.HELENE,
      cible: '.content .plan',
      cibleFin: '.content .plan',
      titre: 'Proposer un planning',
      texte: () => '« Proposer un planning » calcule trois semaines complètes. Quand des postes sont déjà posés, la fenêtre demande d’abord quoi en faire.',
      jouer: () => ouvrirSemaine(semaineBrouillon()),
      gestes: [
        { faire: 'cliquer', sur: "[data-tour='proposer']", sert: 'La fenêtre des propositions s’ouvre.' },
        { faire: 'attendre', que: '.dialog' },
        { faire: 'expliquer', sur: o.parLibelle('Repartir d', '.dialog'), quoi: 'le calcul ignore les postes posés : la proposition retenue les remplacera.' },
        { faire: 'expliquer', sur: o.parLibelle('Conserver les postes', '.dialog'), quoi: 'le calcul garde les postes déjà posés et complète autour.', sert: 'Utile quand vous avez déjà fixé quelques postes à la main.' },
        { faire: 'cliquer', sur: o.parTexte('.dialog .btn', 'Calculer les propositions'), dit: 'Cliquez sur « Calculer les propositions »', sert: 'Les règles impératives d’abord, l’effectif ensuite, les préférences et l’équité enfin.' },
        { faire: 'attendre', que: '.dialog .variant' },
        { faire: 'expliquer', sur: o.nieme('.dialog .variant', 0), nom: 'Équité d’abord', quoi: 'répartit samedis et fermetures selon l’historique de chacun.' },
        { faire: 'expliquer', sur: o.nieme('.dialog .variant', 1), nom: 'Préférences d’abord', quoi: 'suit le plus de préférences possible.' },
        { faire: 'expliquer', sur: o.nieme('.dialog .variant', 2), nom: 'Contrats d’abord', quoi: 'évite les heures au-delà des contrats.', sert: 'Un clic sur une carte la sélectionne.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Construire',
      qui: o.HELENE,
      cible: '.content .plan',
      cibleFin: '.content .plan',
      titre: 'Une semaine vide',
      texte: () => 'Sur une semaine vide, une carte propose de commencer, et le calcul des propositions part tout de suite.',
      jouer: () => {
        o.avecPlanning();
        ouvrirSemaine(addDays(semaineBrouillonLundi(), 7));
      },
      gestes: [
        { faire: 'expliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.content .card.pad')].find((e) => e.textContent?.includes('Cette semaine est vide')), nom: 'Cette semaine est vide', quoi: 'le rappel qu’aucun poste n’est posé, et les trois façons de commencer : des propositions, la semaine précédente recopiée, ou un « + ».' },
        { faire: 'cliquer', sur: "[data-tour='proposer']", sert: 'La semaine est vide : le calcul démarre aussitôt.' },
        { faire: 'attendre', que: '.dialog .variant' },
        { faire: 'expliquer', sur: '.dialog .variant .variant-etat', nom: 'L’état', quoi: '« Règles respectées », ou le nombre de points bloquants de la proposition.' },
        { faire: 'expliquer', sur: '.dialog .variant .mini', nom: 'La miniature', quoi: 'la semaine de chacun, du lundi au samedi, une ligne par personne.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Construire',
      qui: o.HELENE,
      cible: '.content .plan',
      cibleFin: '.content .plan',
      titre: 'Les indicateurs des propositions',
      texte: () => 'Chaque proposition se compare sur les mêmes indicateurs ; le meilleur est mis en valeur.',
      jouer: () => {
        o.avecPlanning();
        ouvrirSemaine(addDays(semaineBrouillonLundi(), 7));
      },
      gestes: [
        { faire: 'cliquer', sur: "[data-tour='proposer']", dit: 'Cliquez sur « Proposer un planning »' },
        { faire: 'attendre', que: '.dialog .variant' },
        { faire: 'expliquer', sur: o.parTexte('.dialog .variant .kpi span', 'Préférences suivies'), quoi: 'la part des préférences de l’équipe que la proposition respecte.', sert: 'Quand vous préparez seul, l’indicateur devient « Fidèle à vos habitudes ».' },
        { faire: 'expliquer', sur: o.parTexte('.dialog .variant .kpi span', 'Écart d'), quoi: 'l’écart entre les samedis travaillés et la part attendue de chacun, sur huit semaines.', sert: 'Plus il est bas, plus la répartition est équilibrée.' },
        { faire: 'expliquer', sur: o.parTexte('.dialog .variant .kpi span', 'au-delà des contrats'), quoi: 'les heures planifiées au-delà des contrats, toutes personnes confondues.' },
        { faire: 'expliquer', sur: o.parTexte('.dialog .variant .kpi span', 'Sous l'), quoi: 'le temps où l’effectif attendu au comptoir n’est pas atteint.' },
        { faire: 'expliquer', sur: o.parTexte('.dialog-foot .btn', 'Recalculer'), quoi: 'relance le calcul pour obtenir d’autres propositions.' },
        { faire: 'expliquer', sur: o.VALIDER, quoi: 'place la proposition sélectionnée dans le brouillon.', sert: 'Rien n’est publié : vous pouvez encore tout modifier.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Construire',
      qui: o.HELENE,
      cible: '.plan-bar',
      cibleFin: '.plan-bar',
      titre: 'La fenêtre de publication',
      texte: () => 'Avant d’envoyer la semaine, la fenêtre de publication refait les contrôles et compte ce qui part à l’équipe.',
      jouer: () => ouvrirSemaine(semaineBrouillon()),
      gestes: [
        { faire: 'cliquer', sur: "[data-focus='publier']", sert: 'Solvéa relit les règles et les délais avant d’envoyer.' },
        { faire: 'attendre', que: '.dialog' },
        { faire: 'expliquer', sur: '.dialog .dialog-body > .notice, .dialog .dialog-body > .col > .notice', nom: 'Le bilan des contrôles', quoi: 'les points bloquants qui restent, ou « Aucun point bloquant » avec le nombre d’alertes.' },
        { faire: 'expliquer', sur: o.parLibelle('Je publie quand même', '.dialog'), quoi: 'à cocher pour publier malgré un point bloquant.', sert: 'Le nombre de points assumés est tracé dans le journal.', facultatif: true },
        { faire: 'expliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.dialog p.small.soft')].find((e) => e.textContent?.includes('postes envoyés')), nom: 'Postes envoyés', quoi: 'le nombre de postes que l’équipe va recevoir.' },
        { faire: 'expliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.dialog-foot .btn')].find((e) => e.textContent?.includes('Revenir au brouillon')), quoi: 'ferme la fenêtre sans rien publier.' },
        { faire: 'expliquer', sur: o.VALIDER, quoi: 'publie la semaine : chacun la voit dans son planning et en est prévenu.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Construire',
      qui: o.HELENE,
      cible: '.plan-bar',
      cibleFin: '.plan-bar',
      titre: 'Publier des modifications',
      texte: () => 'La semaine prochaine est déjà publiée, mais un poste d’Inès vient d’être retouché. La publication montre alors chaque changement, et les accords à recueillir.',
      jouer: () => {
        o.avecPlanning();
        retoucheProche();
        ouvrirSemaine(o.semaineDans(1));
      },
      gestes: [
        { faire: 'expliquer', sur: '.plan-bar > .pill', nom: 'Modifications en attente', quoi: 'le nombre de retouches que l’équipe ne voit pas encore.', sert: 'Les salariés lisent toujours la version publiée.' },
        { faire: 'cliquer', sur: "[data-focus='publier']", dit: 'Cliquez sur « Publier les modifications »' },
        { faire: 'attendre', que: '.dialog' },
        { faire: 'expliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.dialog .eyebrow')].find((e) => e.textContent?.includes('Accords'))?.parentElement?.parentElement, nom: 'Accords à recueillir', quoi: 'les salariés à temps partiel dont l’horaire change moins de sept jours ouvrés avant : leur accord est requis.', sert: 'Cochez chaque accord obtenu ; tant qu’il en manque, « Publier et notifier » reste grisé.' },
        { faire: 'expliquer', sur: () => document.querySelector<HTMLElement>('.dialog label.check.ligne'), nom: 'Un accord', quoi: 'la personne et la raison de l’accord : prévenue trop peu de jours avant.', sert: 'À cocher une fois son accord obtenu.' },
        { faire: 'expliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.dialog .eyebrow')].find((e) => / changement/.test(e.textContent ?? ''))?.parentElement, nom: 'Les changements', quoi: 'chaque journée modifiée : la personne, le jour, l’horaire avant et après.' },
        { faire: 'cliquer', sur: '.dialog label.check.ligne', dit: 'Cochez l’accord d’Inès', sert: 'Son accord est noté : le bouton de publication s’active.' },
        { faire: 'expliquer', sur: o.VALIDER, nom: 'Publier et notifier', quoi: 'publie les retouches et prévient chaque personne concernée.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    // ---------------------------------------------------------------- 3. La journée
    {
      chapitre: 'La journée',
      qui: o.HELENE,
      cible: "[data-tour='grille']",
      cibleFin: "[data-tour='grille']",
      titre: 'Lire une journée',
      texte: () => 'Sous chaque date de la grille, « Voir la journée » ouvre toute l’équipe de ce jour sur une ligne de temps.',
      jouer: () => {
        journeeOuverte();
        ouvrirSemaine(o.semaineDans(1));
      },
      gestes: [
        { faire: 'cliquer', sur: o.nieme('.plan-grid .jour-btn', 1), dit: 'Cliquez sur « Voir la journée », sous la date du mardi', sert: 'La journée s’ouvre dans une fenêtre.' },
        { faire: 'attendre', que: '.dialog .jour-equipe' },
        { faire: 'expliquer', sur: '.dialog .dialog-head .grow', nom: 'Le titre', quoi: 'la date, les heures d’ouverture et le nombre de postes du jour.' },
        { faire: 'expliquer', sur: '.dialog .dialog-body > p.notice', nom: 'Le contrôle du pharmacien', quoi: 'si un pharmacien est présent sur toute l’ouverture, pauses comprises ; sinon, les heures où il manque, et pourquoi.', sert: 'Il se recalcule à chaque pause déplacée.' },
        { faire: 'expliquer', sur: '.dialog .je-ligne:not(.regle) .je-qui', nom: 'La personne', quoi: 'son nom et sa fonction.' },
        { faire: 'expliquer', sur: '.dialog .je-pref', nom: 'A demandé', quoi: 'la préférence de la personne pour ce jour, quand les préférences sont affichées dans la grille.', sert: 'Verte si le poste la suit, d’une autre teinte sinon.', facultatif: true },
        { faire: 'expliquer', sur: '.dialog .je-corps > .row', nom: 'Les horaires', quoi: 'le début et la fin du poste, la durée de travail et les pauses.' },
        { faire: 'expliquer', sur: '.dialog .je-corps > .frise', nom: 'La frise', quoi: 'le poste dessiné sur l’échelle des heures ; la partie hachurée est la pause.' },
        { faire: 'expliquer', sur: () => document.querySelector<HTMLElement>('.dialog .dialog-body > .row.wrap'), nom: 'Absents et gardes', quoi: 'les personnes absentes ce jour-là, avec la nature de l’absence, et les gardes du soir.' },
        { faire: 'expliquer', sur: '.dialog p.tiny.muted', nom: 'Le rappel', quoi: 'la règle des pauses : au moins 20 minutes dès 6 heures de travail dans la journée.', sert: 'Un retard noté ici alimente le suivi de la personne ; aucune raison n’est demandée.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'La journée',
      qui: o.HELENE,
      cible: "[data-tour='grille']",
      cibleFin: "[data-tour='grille']",
      titre: 'Régler les pauses du jour',
      texte: () => 'Chaque ligne a ses outils : la pause déjeuner se décale ou se retire sans ouvrir le poste.',
      jouer: () => {
        journeeOuverte();
        ouvrirSemaine(o.semaineDans(1));
      },
      gestes: [
        { faire: 'cliquer', sur: o.nieme('.plan-grid .jour-btn', 1), dit: 'Cliquez sur « Voir la journée »' },
        { faire: 'attendre', que: '.dialog .jour-equipe' },
        { faire: 'expliquer', sur: '.dialog input[id^="pause-de-"]', nom: 'Début de la pause', quoi: 'l’heure à laquelle la personne part déjeuner.', sert: 'Changée ici, elle est enregistrée dès que vous quittez le champ ; la frise et le contrôle du pharmacien suivent.', exemple: '12 h 45' },
        { faire: 'expliquer', sur: '.dialog input[id^="pause-a-"]', nom: 'Fin de la pause', quoi: 'l’heure de retour.', sert: 'La pause doit tenir à l’intérieur du poste.' },
        { faire: 'expliquer', sur: o.parTexte('.dialog .je-pause button', 'Retirer'), quoi: 'supprime la pause déjeuner de ce poste.' },
        { faire: 'expliquer', sur: o.parTexte('.dialog .je-pause button', 'Ajouter une pause'), quoi: 'pose une pause d’une heure au milieu d’un poste qui n’en a pas.', facultatif: true },
        { faire: 'expliquer', sur: o.parTexte('.dialog .je-outils button', 'Noter un retard'), quoi: 'ouvre, sur la ligne, la saisie d’un écart de présence.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'La journée',
      qui: o.HELENE,
      cible: "[data-tour='grille']",
      cibleFin: "[data-tour='grille']",
      titre: 'Noter un retard ou un départ',
      texte: () => 'Un retard, un départ anticipé, une absence non prévue : on note une nature et une durée, jamais une raison.',
      jouer: () => {
        journeeOuverte();
        ouvrirSemaine(o.semaineDans(1));
      },
      gestes: [
        { faire: 'cliquer', sur: o.nieme('.plan-grid .jour-btn', 1), dit: 'Cliquez sur « Voir la journée »' },
        { faire: 'attendre', que: '.dialog .jour-equipe' },
        { faire: 'cliquer', sur: o.parTexte('.dialog .je-outils button', 'Noter un retard'), dit: 'Cliquez sur « Noter un retard »', sert: 'Deux listes apparaissent sur la ligne.' },
        { faire: 'expliquer', sur: '.dialog select[id^="ecart-type-"]', nom: 'Nature de l’écart', quoi: 'retard, départ anticipé ou absence non prévue.' },
        { faire: 'expliquer', sur: '.dialog select[id^="ecart-min-"]', nom: 'Durée en minutes', quoi: 'de 5 à 90 minutes. Elle disparaît pour une absence non prévue.', exemple: '15 min' },
        { faire: 'expliquer', sur: o.parTexte('.dialog .je-ecart button', 'Annuler'), quoi: 'referme la saisie sans rien noter.' },
        { faire: 'cliquer', sur: o.parTexte('.dialog .je-ecart .btn.primary', 'Noter'), dit: 'Cliquez sur « Noter »', sert: 'L’écart rejoint le suivi de la personne.' },
        { faire: 'expliquer', sur: '.dialog .je-corps .pill', nom: 'L’écart noté', quoi: 'la nature et la durée, à côté des horaires ; la corbeille le retire.' },
        { faire: 'expliquer', sur: o.parTexte('.dialog-foot .btn', 'Lendemain'), nom: 'Veille et Lendemain', quoi: 'passent au jour précédent ou suivant sans refermer la fenêtre.' },
        { faire: 'expliquer', sur: o.VALIDER, quoi: 'referme la journée.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    // ---------------------------------------------------------------- 4. Le mois
    {
      chapitre: 'Le mois',
      qui: o.HELENE,
      cible: '.plan.mois .plan-bar',
      titre: 'La barre du mois',
      texte: () => 'La bascule « Mois » montre tout le mois. Sa barre réunit les préférences reçues et trois actions sur le mois entier.',
      jouer: () => ouvrirMois(semaineBrouillon()),
      gestes: [
        { faire: 'expliquer', sur: '[aria-label="Mois suivant"]', nom: 'Les flèches', quoi: 'passent au mois précédent ou suivant.' },
        { faire: 'expliquer', sur: '.plan.mois .week-nav .label', nom: 'Le mois affiché', quoi: 'le mois, et le nombre de semaines encore en brouillon, ou « Tout est publié ».' },
        { faire: 'expliquer', sur: '#mois-reponses', nom: 'Préférences reçues', quoi: 'combien de personnes ont donné leurs préférences pour ce mois, sur combien.', sert: 'Un clic déplie la liste de ceux qui ont répondu et des autres.' },
        { faire: 'expliquer', sur: '.plan.mois .plan-bar > .pill', nom: 'Le délai', quoi: 'les jours qui restent pour donner ses préférences, ou la date à laquelle elles ont été closes.', sert: 'La date limite se règle dans « Réglages ».' },
        { faire: 'expliquer', sur: "[data-focus='corriger']", nom: 'Corriger automatiquement', quoi: 'recalcule toutes les semaines en brouillon du mois en suivant les préférences.', sert: 'Les semaines publiées ne bougent pas, et rien n’est publié.' },
        { faire: 'expliquer', sur: '#mois-zero', quoi: 'retire les postes et les repos des jours à venir du mois ; les jours passés restent.', sert: 'L’équipe garde la version publiée tant que vous ne republiez pas. « Annuler » rend ce qui a été retiré.' },
        { faire: 'expliquer', sur: '#mois-publier', quoi: 'publie d’un coup toutes les semaines du mois qui sont prêtes.', sert: 'Une semaine qui garde un point bloquant est laissée de côté, et le message dit laquelle.' },
      ],
    },
    {
      chapitre: 'Le mois',
      qui: o.HELENE,
      cible: '.plan.mois .plan-bar',
      cibleFin: '.plan.mois',
      titre: 'Préférences reçues et correction',
      texte: () => 'Avant la date limite, on voit qui a répondu et l’on relance les autres. Puis « Corriger automatiquement » refait les brouillons d’après les préférences.',
      jouer: () => ouvrirMois(semaineBrouillon()),
      gestes: [
        { faire: 'cliquer', sur: '#mois-reponses', dit: 'Ouvrez « préférences reçues »', sert: 'La liste se déplie sous la barre.' },
        { faire: 'expliquer', sur: o.nieme('.mo-rep-col', 0), nom: 'Ont répondu', quoi: 'les personnes qui ont déjà donné leurs préférences pour le mois.' },
        { faire: 'expliquer', sur: o.nieme('.mo-rep-col', 1), nom: 'Sans réponse', quoi: 'celles qui n’ont encore rien donné.' },
        { faire: 'expliquer', sur: '[data-relancer]', quoi: 'envoie à la personne un message de rappel, avec le nombre de jours qui restent.', sert: 'Le bouton disparaît une fois la date limite passée.' },
        { faire: 'cliquer', sur: "[data-focus='corriger']", dit: 'Cliquez sur « Corriger automatiquement »', sert: 'Le calcul prend un instant, sur cet appareil.' },
        { faire: 'attendre', que: '.mo-bilan' },
        { faire: 'expliquer', sur: '.mo-bilan', nom: 'Mois recalculé', quoi: 'le bilan : semaines recalculées, part des préférences suivies, semaines publiées laissées telles quelles, points bloquants.', sert: '« Annuler », en haut de l’écran, revient à la version d’avant.' },
      ],
    },
    {
      chapitre: 'Le mois',
      qui: o.HELENE,
      cible: "[data-focus='mois']",
      titre: 'Les cases du mois',
      texte: () => 'Une ligne par personne, une case par jour, l’horaire écrit dedans. Un clic sur une case y pose ou y corrige un poste, sans repasser par la semaine.',
      jouer: () => ouvrirMois(semaineBrouillon()),
      gestes: [
        { faire: 'expliquer', sur: '.mo-semaine', nom: 'La semaine', quoi: 'son numéro et son état : publiée, brouillon ou à construire.', sert: 'Un clic ouvre cette semaine dans la grille.' },
        { faire: 'expliquer', sur: '.mo-jour', nom: 'Le jour', quoi: 'le jour et sa date ; un « F » marque un jour férié.', sert: 'Un clic ouvre la journée.' },
        { faire: 'expliquer', sur: 'tr.mo-effectif th', nom: 'Équipe au complet ?', quoi: 'une coche si l’effectif est atteint toute la journée ; sinon, combien de personnes manquent au moment le plus tendu.', exemple: '−1' },
        { faire: 'expliquer', sur: 'tbody .mo-personne', nom: 'Une personne', quoi: 'ses heures planifiées sur le mois, face à ce que prévoit son contrat, avec une jauge.' },
        { faire: 'expliquer', sur: 'td button.mo-c:not(.mo-poser):not(.repos-pose)', nom: 'Une case avec un poste', quoi: 'l’heure de début et de fin. Un point signale un poste différent de la préférence.', sert: 'Un clic ouvre le poste pour le corriger, ou la semaine pour un jour passé.' },
        { faire: 'expliquer', sur: '.mo-c.souhait', nom: 'Une préférence sans poste', quoi: 'ce que la personne a demandé ce jour-là, alors qu’aucun poste n’est posé.', sert: 'Un clic pose un poste, ici même.', facultatif: true },
        { faire: 'expliquer', sur: '.mo-poser.libre', nom: '+', quoi: 'pose un poste dans une case vide.', facultatif: true },
        { faire: 'expliquer', sur: '.plan.mois .mo-legende', nom: 'La légende', quoi: 'les couleurs des postes, des absences et des gardes.' },
        { faire: 'expliquer', sur: o.parLibelle('Afficher les préférences', '.plan.mois'), quoi: 'cochée, chaque case montre aussi la préférence de la personne.' },
      ],
    },
    {
      chapitre: 'Le mois',
      qui: o.HELENE,
      cible: '.plan.mois .mo-legende',
      cibleFin: "[data-focus='mois']",
      titre: 'Les semaines passées',
      texte: () => 'Le mois en cours s’ouvre sur aujourd’hui : ses semaines passées sont rangées, et reviennent sur demande.',
      jouer: () => {
        o.avecPlanning();
        ouvrirMois(o.semaineDans(0));
      },
      gestes: [
        { faire: 'expliquer', sur: '.mo-anciennes', nom: 'Semaines passées', quoi: 'affiche, en grisé, les semaines déjà écoulées du mois.', sert: 'Elles sont rangées par défaut, pour ouvrir le mois sur la semaine en cours.' },
        { faire: 'cliquer', sur: '.mo-anciennes', dit: 'Cliquez sur « Semaines passées »', sert: 'Les semaines écoulées reviennent, en grisé.' },
        { faire: 'expliquer', sur: '.plan.mois th.debut.passe', nom: 'Une semaine passée', quoi: 'une semaine écoulée : on la consulte, on ne la modifie plus depuis le mois.' },
        { faire: 'expliquer', sur: '.mo-anciennes', nom: 'Masquer les semaines passées', quoi: 'range à nouveau les semaines écoulées.' },
      ],
    },
    // ---------------------------------------------------------------- 5. Imprimer
    {
      chapitre: 'Imprimer',
      qui: o.HELENE,
      cible: '.page-head',
      cibleFin: '.page-head',
      titre: 'L’aperçu avant impression',
      texte: () => 'Le bouton « Imprimer », en haut de « Construire », ouvre un aperçu : la feuille telle qu’elle sortira, et ses réglages.',
      jouer: () => ouvrirSemaine(semaineBrouillon()),
      gestes: [
        { faire: 'cliquer', sur: '[aria-label="Imprimer le planning"]', dit: 'Cliquez sur l’imprimante, en haut à droite', sert: 'L’aperçu s’ouvre sur la période affichée.' },
        { faire: 'attendre', que: '.dialog .imp' },
        { faire: 'expliquer', sur: '.imp-outils .seg[aria-label="Période"]', nom: 'Semaine ou Mois', quoi: 'une semaine sur la feuille, ou le mois entier, semaine par semaine.' },
        { faire: 'expliquer', sur: '.imp-nav', nom: 'La période imprimée', quoi: 'la semaine ou le mois qui sera imprimé ; les flèches passent au précédent ou au suivant.' },
        { faire: 'expliquer', sur: '.imp-outils .seg[aria-label="Encre"]', nom: 'Couleur ou Noir et blanc', quoi: 'en couleur, chaque poste prend la teinte de son moment ; en noir et blanc, le gras, l’italique et les hachures prennent le relais.' },
        { faire: 'expliquer', sur: '.imp-outils .seg[aria-label="Personnes imprimées"]', nom: 'Toute l’équipe ou Mes postes', quoi: 'imprime le planning de toute l’équipe, ou seulement le vôtre.' },
        { faire: 'expliquer', sur: '.imp-note', nom: 'La mention brouillon', quoi: 'l’avertissement qu’un planning non publié, ou vide, figure sur la feuille.', sert: 'La mention « Brouillon » s’imprime aussi sur le papier.', facultatif: true },
        { faire: 'expliquer', sur: '.imp-zone', nom: 'L’aperçu', quoi: 'la feuille A4 en paysage : le nom de la pharmacie, la période, l’état de publication, la date d’impression, la légende et le numéro de page.', sert: 'Ce que vous voyez est exactement ce qui s’imprime.' },
        { faire: 'expliquer', sur: '#imp-format', nom: 'Le format', quoi: 'le nombre de pages, en A4 paysage.' },
        { faire: 'expliquer', sur: '#imp-imprimer', quoi: 'ouvre l’impression du navigateur : seule la feuille sort, sans les menus.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Imprimer',
      qui: o.HELENE,
      cible: '.page-head',
      cibleFin: '.page-head',
      titre: 'Changer les réglages de l’aperçu',
      texte: () => 'Chaque réglage change la feuille aussitôt. Voici le mois, en noir et blanc, pour vos seuls postes.',
      jouer: () => ouvrirSemaine(semaineBrouillon()),
      gestes: [
        { faire: 'cliquer', sur: '[aria-label="Imprimer le planning"]', dit: 'Ouvrez l’aperçu' },
        { faire: 'attendre', que: '.dialog .imp' },
        { faire: 'cliquer', sur: o.parTexte('.imp-outils .seg button', 'Mois'), dit: 'Choisissez « Mois »', sert: 'Le mois se range semaine par semaine, les horaires en abrégé.' },
        { faire: 'cliquer', sur: o.parTexte('.imp-outils .seg button', 'Noir et blanc'), dit: 'Choisissez « Noir et blanc »', sert: 'La légende change : elle explique le gras, l’italique et les hachures.' },
        { faire: 'expliquer', sur: '.imp-zone .f-legende-nb', nom: 'La légende en noir et blanc', quoi: 'comment lire la feuille sans couleur : les heures en gras, les absences en italique, les jours fermés hachurés.' },
        { faire: 'cliquer', sur: o.parTexte('.imp-outils .seg button', 'Mes postes'), dit: 'Choisissez « Mes postes »', sert: 'La feuille ne garde que votre ligne : « Planning de Caroline Tellier ».' },
        { faire: 'action', jouer: fermer },
      ],
    },
    // ---------------------------------------------------------------- 6. Gardes
    {
      chapitre: 'Gardes',
      qui: o.HELENE,
      cible: '.content',
      titre: 'L’écran des gardes',
      texte: () => 'Le calendrier de garde est fixé hors de la pharmacie. Ici, vous l’importez, vous confiez chaque garde, puis vous la suivez jusqu’à la paie.',
      jouer: () => {
        avecGardesDemo();
        o.helene('gardes');
        ui().ouvrirGarde(null);
      },
      gestes: [
        { faire: 'expliquer', sur: o.parTexte('.page-head .btn', 'Importer un calendrier'), quoi: 'colle d’un coup les gardes reçues du syndicat ou de l’ARS.' },
        { faire: 'expliquer', sur: o.parTexte('.page-head .btn', 'Répartir'), quoi: 'propose de confier chaque garde restée sans pharmacien, au moins chargé de l’année.', sert: 'Le bouton n’apparaît que s’il reste des gardes à affecter.' },
        { faire: 'expliquer', sur: o.parTexte('.page-head .btn', 'Ajouter une garde'), quoi: 'saisit une garde, ou une série régulière, et la confie à un pharmacien.' },
        { faire: 'expliquer', sur: () => document.querySelector<HTMLElement>('.content > div > .card.pad'), nom: 'Répartition de l’année', quoi: 'le nombre de gardes de l’année pour chaque pharmacien, titulaires compris.' },
        { faire: 'expliquer', sur: '#cal-gardes', nom: 'Calendrier sur douze mois', quoi: 'chaque garde des douze prochains mois : pastille pleine si elle est affectée, cerclée si elle reste à affecter.', sert: 'Un clic sur une pastille ouvre sa fiche.' },
        { faire: 'expliquer', sur: '.split [role="group"] .g-item', nom: 'Une garde de la liste', quoi: 'sa date, sa forme, son étape (prévue, affectée, réalisée, repos réglé, validée) et qui la tient.', sert: 'Un clic ouvre sa fiche à droite.' },
      ],
    },
    {
      chapitre: 'Gardes',
      qui: o.HELENE,
      cible: '.content .split > .card',
      titre: 'La fiche d’une garde : qui l’assure ?',
      texte: () => 'La fiche suit la garde pas à pas. D’abord : à qui la confier, et dans quel délai.',
      jouer: () => {
        avecGardesDemo();
        const st = s();
        const g = st.data.gardes.filter((x) => x.personId === 'p_lea' && x.date >= st.today).sort((a, b) => a.date.localeCompare(b.date))[0];
        o.helene('gardes');
        ui().ouvrirGarde(g?.id ?? null);
      },
      gestes: [
        { faire: 'expliquer', sur: '.content .split > .card .card-head .grow', nom: 'La garde', quoi: 'sa forme, sa date, ses heures et sa durée réelle.' },
        { faire: 'expliquer', sur: '[aria-label="Supprimer cette garde"]', nom: 'La corbeille', quoi: 'supprime cette garde du calendrier.' },
        { faire: 'expliquer', sur: '.content .stepper', nom: 'Parcours de la garde', quoi: 'ses cinq étapes : prévue, affectée, réalisée, repos réglé, validée pour la paie.', sert: 'L’étape en cours est mise en avant.' },
        { faire: 'expliquer', sur: '.content .nightline', nom: 'La frise', quoi: 'la garde découpée jour par jour (jour ouvrable, dimanche, jour férié), avec les interventions déclarées.' },
        { faire: 'expliquer', sur: '.content .g-section .g-item', nom: 'Qui assure la garde ?', quoi: 'chaque pharmacien, comparé sur sa disponibilité, ses gardes de l’année, le repos à protéger et le coût.', sert: 'Un clic confie la garde ; un second clic retire l’affectation.' },
        { faire: 'expliquer', sur: '.content .g-section .notice', nom: 'Le délai de prévenance', quoi: 'si la garde a été communiquée au moins quinze jours avant, et quand.', sert: 'Hors délai, une case « Circonstances exceptionnelles » ramène le délai à deux jours ouvrables.' },
      ],
    },
    {
      chapitre: 'Gardes',
      qui: o.HELENE,
      cible: '.content .split > .card',
      titre: 'Interventions, repos et paie',
      texte: () => 'Une garde passée se termine ici : les interventions de la nuit, le repos qui suit, puis les variables pour le comptable.',
      jouer: () => {
        avecGardesDemo();
        const st = s();
        const g = st.data.gardes.filter((x) => x.personId && x.date < st.today && x.type !== 'volets_ouverts').sort((a, b) => b.date.localeCompare(a.date))[0];
        if (g?.valideLe) o.poser((d) => ({ ...d, gardes: d.gardes.map((x) => (x.id === g.id ? { ...x, valideLe: undefined } : x)) }));
        o.helene('gardes');
        ui().ouvrirGarde(g?.id ?? null);
      },
      gestes: [
        { faire: 'expliquer', sur: o.parLibelle('Heure', '.content .split > .card'), quoi: 'l’heure à laquelle le pharmacien a été dérangé pendant la garde.', exemple: '23 h 30' },
        { faire: 'expliquer', sur: o.parLibelle('Durée, trajet compris', '.content .split > .card'), quoi: 'la durée de l’intervention en minutes, trajet compris.', exemple: '25' },
        { faire: 'expliquer', sur: o.parTexte('.content .g-section .btn', 'Déclarer'), quoi: 'ajoute l’intervention à la garde ; elle se voit sur la frise et compte dans les variables de paie.' },
        { faire: 'expliquer', sur: '.content .g-section .pill', nom: 'Une intervention déclarée', quoi: 'son heure et sa durée ; la corbeille la retire.', facultatif: true },
        { faire: 'expliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.content .g-section')].find((e) => e.textContent?.includes('Conséquences sur le repos')), nom: 'Conséquences sur le repos', quoi: 'le repos dû après la garde, et les postes planifiés qui empiètent dessus.', sert: '« Corriger le poste » décale le poste en cause ; un repos compensateur est signalé après un dimanche ou un jour férié.' },
        { faire: 'expliquer', sur: '.content table[aria-label="Variables de paie de la garde"]', nom: 'Variables pour le comptable', quoi: 'chaque variable de paie de la garde : son mois, sa quantité et son montant estimé.', sert: 'Calculées d’après l’accord du 23 mars 2000 ; à faire relire par votre cabinet comptable.' },
        { faire: 'expliquer', sur: o.parTexte('.content .g-section .btn.primary', 'Valider pour le comptable'), quoi: 'valide les variables de la garde : elles rejoignent la fiche navette du mois.', sert: 'Le bouton ne s’active qu’une fois la garde passée.' },
      ],
    },
    {
      chapitre: 'Gardes',
      qui: o.HELENE,
      cible: '.page-head',
      cibleFin: '.content',
      titre: 'Ajouter une garde',
      texte: () => '« Ajouter une garde » ouvre une fenêtre : le moment, la forme, les dates, puis le pharmacien qui la tiendra.',
      jouer: () => {
        avecGardesDemo();
        o.helene('gardes');
      },
      gestes: [
        { faire: 'cliquer', sur: o.parTexte('.page-head .btn', 'Ajouter une garde'), sert: 'La fenêtre de la garde s’ouvre.' },
        { faire: 'attendre', que: '.dialog #garde-type' },
        { faire: 'expliquer', sur: o.parLibelle('Quand ?', '.dialog'), quoi: 'nuit, jour (dimanche ou jour férié) ou 24 heures : un clic remplit les horaires habituels.' },
        { faire: 'expliquer', sur: o.parLibelle('Forme', '.dialog'), quoi: 'garde à volets ouverts, à volets fermés, ou astreinte à domicile.', sert: 'La forme change ce qui compte comme travail effectif, et donc la paie.' },
        { faire: 'expliquer', sur: o.parLibelle('Date de début', '.dialog'), quoi: 'le jour où commence la garde.', sert: 'Moins de quinze jours avant, un avertissement rappelle l’accord à recueillir.' },
        { faire: 'expliquer', sur: champ('garde-debut'), quoi: 'l’heure de début de la garde.', exemple: '19 h 30' },
        { faire: 'expliquer', sur: champ('garde-fin'), quoi: 'l’heure de fin. Plus tôt que le début, la garde se termine le lendemain ; identique, elle dure 24 heures.', exemple: '8 h 30' },
        { faire: 'expliquer', sur: o.parLibelle('Confier à', '.dialog'), quoi: 'le pharmacien qui tiendra la garde, ou « Affecter plus tard ».', sert: '« Conseillé » : disponible et le moins chargé en gardes cette année.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Gardes',
      qui: o.HELENE,
      cible: '.page-head',
      cibleFin: '.content',
      titre: 'Confier, prévenir, répéter',
      texte: () => 'Une garde confiée peut prévenir la personne tout de suite. Un tour de garde régulier se crée en une fois.',
      jouer: () => {
        avecGardesDemo();
        o.helene('gardes');
      },
      gestes: [
        { faire: 'cliquer', sur: o.parTexte('.page-head .btn', 'Ajouter une garde'), dit: 'Cliquez sur « Ajouter une garde »' },
        { faire: 'attendre', que: '.dialog #garde-personne' },
        { faire: 'choisir', dans: '#garde-personne', valeur: 'p_lea', dit: 'Confiez la garde à Léa', sert: 'Une case « Prévenir » apparaît.' },
        { faire: 'expliquer', sur: o.parLibelle('Prévenir', '.dialog'), quoi: 'cochée, Léa reçoit une notification dans son espace, avec un accusé de lecture.', sert: 'La date de communication est notée pour le délai de quinze jours.' },
        { faire: 'expliquer', sur: o.parLibelle('Créer une série régulière', '.dialog'), quoi: 'pour un tour de garde qui revient à intervalle fixe.', sert: 'Toute la série est confiée à la même personne.' },
        { faire: 'cliquer', sur: '#garde-repeter', dit: 'Cochez « Créer une série régulière »' },
        { faire: 'expliquer', sur: o.parLibelle('Toutes les (semaines)', '.dialog'), quoi: 'l’intervalle entre deux gardes de la série, en semaines.', exemple: '4' },
        { faire: 'expliquer', sur: o.parLibelle('Nombre de gardes', '.dialog'), quoi: 'combien de gardes créer, la première comprise.', sert: 'La date de la dernière garde s’affiche à côté.', exemple: '6' },
        { faire: 'expliquer', sur: o.VALIDER, quoi: 'ajoute la garde, ou toute la série, et prévient la personne si la case est cochée.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Gardes',
      qui: o.HELENE,
      cible: '.page-head',
      cibleFin: '.content',
      titre: 'Importer un calendrier de garde',
      texte: () => 'Le calendrier reçu du syndicat ou de l’ARS se colle tel quel : une garde par ligne.',
      jouer: () => {
        avecGardesDemo();
        o.helene('gardes');
      },
      gestes: [
        { faire: 'cliquer', sur: o.parTexte('.page-head .btn', 'Importer un calendrier'), sert: 'La fenêtre d’import s’ouvre.' },
        { faire: 'attendre', que: '.dialog textarea' },
        { faire: 'expliquer', sur: o.parLibelle('Lignes à importer', '.dialog'), quoi: 'les gardes à ajouter, une par ligne : date ; début ; fin ; type.', exemple: '14/02/2027;19:30;08:30;volets fermés' },
        { faire: 'taper', dans: '.dialog textarea', texte: '14/02/2027;19:30;08:30;volets fermés', dit: 'Collez une ligne du calendrier', sert: 'Solvéa la lit aussitôt.' },
        { faire: 'expliquer', sur: '.dialog .notice.ok', nom: 'Gardes reconnues', quoi: 'les gardes que Solvéa a comprises, avec leur date et leurs heures.', sert: 'Une ligne illisible est signalée en orange, avec la raison.' },
        { faire: 'expliquer', sur: o.parLibelle('Type si la ligne ne le précise pas', '.dialog'), quoi: 'la forme appliquée aux lignes qui ne la disent pas.' },
        { faire: 'expliquer', sur: o.VALIDER, quoi: 'ajoute les gardes reconnues au calendrier ; il reste à les affecter.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Gardes',
      qui: o.HELENE,
      cible: '.page-head',
      cibleFin: '.content',
      titre: 'Répartir les gardes à affecter',
      texte: () => 'Les gardes encore sans pharmacien peuvent être réparties d’un coup : une proposition à relire, jamais appliquée d’office.',
      jouer: () => {
        avecGardesDemo();
        o.helene('gardes');
      },
      gestes: [
        { faire: 'cliquer', sur: o.parTexte('.page-head .btn', 'Répartir'), sert: 'La répartition proposée s’affiche.' },
        { faire: 'attendre', que: '.dialog' },
        { faire: 'expliquer', sur: '.dialog table[aria-label="Répartition proposée"]', nom: 'La répartition proposée', quoi: 'pour chaque garde : sa date, le pharmacien proposé, et pourquoi.', sert: 'Chaque garde va au pharmacien disponible le moins chargé cette année.' },
        { faire: 'expliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.dialog p.small.soft')].find((e) => e.textContent?.includes('Charge ajoutée')), nom: 'Charge ajoutée', quoi: 'ce que la répartition ajoute à chacun : une nuit de 12 heures compte pour 1, un dimanche ou un jour férié pour moitié plus, une astreinte pour moitié moins.' },
        { faire: 'expliquer', sur: o.VALIDER, quoi: 'applique la répartition. Chaque affectation reste modifiable ensuite, dans la fiche de la garde.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    // ---------------------------------------------------------------- 7. Formation et inventaire
    {
      chapitre: 'Formation et inventaire',
      qui: o.HELENE,
      cible: '.topbar-in',
      cibleFin: '.content',
      titre: 'Planifier une formation',
      texte: () => 'Le bouton « Créer », en haut de l’écran, ouvre la fenêtre d’une formation : son nom, son cadre, son lieu et ses dates.',
      jouer: () => {
        o.avecPlanning();
        o.helene('tableau');
      },
      gestes: [
        { faire: 'cliquer', sur: '.top-creer', sert: '« Créer » réunit tout ce que l’on peut ajouter.' },
        { faire: 'cliquer', sur: o.parTexte('.outils .menu button', 'Une formation'), sert: 'La fenêtre « Planifier une formation » s’ouvre.' },
        { faire: 'expliquer', sur: o.parLibelle('Nom de la formation', '.dialog'), quoi: 'l’intitulé, tel que les participants le liront dans leur planning.', sert: 'La liste propose les formations déjà faites à la pharmacie, puis les plus courantes.', exemple: 'Gestes d’urgence' },
        { faire: 'expliquer', sur: o.parLibelle('Cette formation est', '.dialog'), quoi: 'interne, à la pharmacie, ou externe, dans un organisme de formation.', sert: 'Interne, le lieu se remplit avec le nom de la pharmacie.' },
        { faire: 'expliquer', sur: o.parLibelle('Lieu de la formation', '.dialog'), quoi: 'où elle a lieu : une salle, un organisme, une ville.', sert: 'Les participants le lisent dans leur espace, avec les dates.', exemple: 'Centre de formation, à Lyon' },
        { faire: 'expliquer', sur: o.parLibelle('Premier jour', '.dialog'), quoi: 'le jour où commence la formation.' },
        { faire: 'expliquer', sur: o.parLibelle('Dernier jour', '.dialog'), quoi: 'le dernier jour ; le même que le premier pour une formation d’une journée.', sert: 'Le résumé à côté redit la période.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Formation et inventaire',
      qui: o.HELENE,
      cible: '.topbar-in',
      cibleFin: '.content',
      titre: 'Les participants d’une formation',
      texte: () => 'On coche les participants. Solvéa dit aussitôt combien de leurs postes tombent sur ces dates.',
      jouer: () => {
        o.avecPlanning();
        o.helene('tableau');
      },
      gestes: [
        { faire: 'cliquer', sur: '.top-creer', dit: 'Cliquez sur « Créer »' },
        { faire: 'cliquer', sur: o.parTexte('.outils .menu button', 'Une formation'), dit: 'Puis sur « Une formation »' },
        { faire: 'taper', dans: '#formation-intitule', texte: 'Gestes d’urgence', dit: 'Donnez un nom à la formation', sert: 'Il apparaîtra dans le planning des participants.' },
        { faire: 'cliquer', sur: 'label[for="formation-interne"]', dit: 'Choisissez « Interne »', sert: 'Le lieu se remplit avec le nom de la pharmacie.' },
        { faire: 'cliquer', sur: 'label[for="formation-p_thomas"]', dit: 'Cochez Thomas parmi les participants', sert: 'Seuls les participants quittent le comptoir.' },
        { faire: 'expliquer', sur: o.parLibelle('Participants', '.dialog'), quoi: 'les personnes qui suivent la formation, cochées une à une.', sert: 'Chacune est prévenue dans son espace.' },
        { faire: 'expliquer', sur: '.dialog p.notice', nom: 'Les postes touchés', quoi: 'le nombre de postes déjà planifiés pour les participants sur ces dates.', sert: 'Ils deviennent des absences à couvrir dans « Résoudre », avec des options comparées.' },
        { faire: 'expliquer', sur: '.dialog p.tiny.muted', nom: 'Quelques heures seulement ?', quoi: 'pour une formation de quelques heures pendant un poste, ouvrez plutôt le poste et choisissez la tâche « Formation ».' },
        { faire: 'expliquer', sur: o.VALIDER, quoi: 'planifie la formation et prévient chaque participant.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Formation et inventaire',
      qui: o.HELENE,
      cible: '.topbar-in',
      cibleFin: '.content',
      titre: 'Fixer un inventaire',
      texte: () => 'Même bouton « Créer » pour un inventaire : une date, un horaire, les personnes mobilisées. Chacune reçoit un poste « Inventaire ».',
      jouer: () => {
        o.avecPlanning();
        o.helene('tableau');
      },
      gestes: [
        { faire: 'cliquer', sur: '.top-creer', dit: 'Cliquez sur « Créer »' },
        { faire: 'cliquer', sur: o.parTexte('.outils .menu button', 'Un inventaire'), sert: 'La fenêtre « Fixer un inventaire » s’ouvre.' },
        { faire: 'expliquer', sur: champ('inventaire-date'), quoi: 'le jour de l’inventaire.', sert: 'Trois semaines plus tard, par défaut.' },
        { faire: 'expliquer', sur: champ('inventaire-debut'), quoi: 'l’heure de début.', sert: 'La durée et l’horaire se lisent à côté.', exemple: '19 h 30' },
        { faire: 'expliquer', sur: champ('inventaire-fin'), quoi: 'l’heure de fin, après le début.', exemple: '22 h 30' },
        { faire: 'expliquer', sur: o.parLibelle('Participants', '.dialog'), quoi: 'les personnes mobilisées, cochées une à une.', sert: 'Chacune reçoit un poste « Inventaire » qui compte dans ses heures.' },
        { faire: 'cliquer', sur: o.parTexte('.dialog .btn', 'Toute l’équipe'), dit: 'Cliquez sur « Toute l’équipe »', sert: 'Tout le monde est coché d’un seul geste ; le même bouton décoche tout.' },
        { faire: 'expliquer', sur: '.dialog p.notice', nom: 'Le contrôle de l’horaire', quoi: 'si l’inventaire tombe pendant l’ouverture, et qui a déjà un poste sur cet horaire.', sert: 'Durées et repos seront contrôlés dans « Construire ».' },
        { faire: 'expliquer', sur: o.VALIDER, quoi: 'fixe l’inventaire et prévient chaque participant.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    // ---------------------------------------------------------------- 8. Retard ou absence
    {
      chapitre: 'Retard ou absence',
      qui: o.HELENE,
      cible: '.topbar-in',
      cibleFin: '.topbar-in',
      titre: 'Signaler un retard',
      texte: () => 'Le bouton « Retard ou absence », en haut de l’écran, sert pour vous ou pour quelqu’un qui vous a prévenu par téléphone.',
      jouer: () => {
        posteDemainPour('p_camille');
        o.helene('tableau');
      },
      gestes: [
        { faire: 'cliquer', sur: '#top-signaler', sert: 'La fenêtre « Signaler un retard ou une absence » s’ouvre.' },
        { faire: 'attendre', que: '.dialog #sg-qui' },
        { faire: 'expliquer', sur: o.parLibelle('Pour qui ?', '.dialog'), quoi: 'vous-même, ou la personne de l’équipe qui vous a prévenu.', sert: 'Un titulaire signale pour un autre ; un membre de l’équipe ne signale que pour lui.' },
        { faire: 'choisir', dans: '#sg-qui', valeur: 'p_camille', dit: 'Choisissez Nicolas', sert: 'Nicolas a téléphoné : un retard est annoncé.' },
        { faire: 'expliquer', sur: o.parLibelle('Que se passe-t-il ?', '.dialog'), quoi: 'un retard, ou une absence.' },
        { faire: 'cliquer', sur: 'label[for="sg-retard"]', dit: 'Choisissez « Un retard »' },
        { faire: 'expliquer', sur: o.parLibelle('De combien ?', '.dialog'), quoi: '5, 10 ou 15 minutes, ou plus de 20 ; à côté, le poste concerné, aujourd’hui ou demain.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Retard ou absence',
      qui: o.HELENE,
      cible: '.topbar-in',
      cibleFin: '.topbar-in',
      titre: 'La durée du retard',
      texte: () => 'Au-delà de vingt minutes, on saisit la durée exacte. L’heure d’arrivée se calcule toute seule.',
      jouer: () => {
        posteDemainPour('p_camille');
        o.helene('tableau');
      },
      gestes: [
        { faire: 'cliquer', sur: '#top-signaler', dit: 'Cliquez sur « Retard ou absence »' },
        { faire: 'attendre', que: '.dialog #sg-qui' },
        { faire: 'choisir', dans: '#sg-qui', valeur: 'p_camille', dit: 'Choisissez Nicolas' },
        { faire: 'cliquer', sur: 'label[for="sg-retard"]', dit: 'Choisissez « Un retard »' },
        { faire: 'cliquer', sur: o.parTexte('#sg-durees .comp', '+ de 20'), dit: 'Choisissez « + de 20 min »', sert: 'Un champ apparaît pour la durée exacte.' },
        { faire: 'expliquer', sur: o.parLibelle('Durée en minutes', '.dialog'), quoi: 'la durée du retard, de 20 minutes à 4 heures.', exemple: '30' },
        { faire: 'expliquer', sur: '.dialog .ret-arrivee', nom: 'L’arrivée prévue', quoi: 'l’heure d’arrivée calculée, au lieu de l’heure du poste.', sert: 'Elle s’affiche sur la frise du tableau de bord.' },
        { faire: 'expliquer', sur: o.parLibelle('Un mot', '.dialog'), quoi: 'une précision, si besoin.', exemple: 'train supprimé' },
        { faire: 'expliquer', sur: '#sg-confirmer', quoi: 'enregistre le retard : l’heure d’arrivée s’affiche sous le nom de la personne, sur la frise du tableau de bord.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Retard ou absence',
      qui: o.HELENE,
      cible: '.topbar-in',
      cibleFin: '.topbar-in',
      titre: 'Signaler une absence',
      texte: () => 'Une absence imprévue se note en deux dates et une raison. Ses postes passent aussitôt dans « Résoudre ».',
      jouer: () => {
        o.avecPlanning();
        o.helene('tableau');
      },
      gestes: [
        { faire: 'cliquer', sur: '#top-signaler', dit: 'Cliquez sur « Retard ou absence »' },
        { faire: 'attendre', que: '.dialog #sg-qui' },
        { faire: 'choisir', dans: '#sg-qui', valeur: 'p_jules', dit: 'Choisissez Jules' },
        { faire: 'cliquer', sur: 'label[for="sg-absence"]', dit: 'Choisissez « Une absence »' },
        { faire: 'expliquer', sur: o.parLibelle('À partir du', '.dialog'), quoi: 'le premier jour d’absence, aujourd’hui ou plus tard.' },
        { faire: 'expliquer', sur: o.parLibelle('Jusqu’au', '.dialog'), quoi: 'le dernier jour d’absence.' },
        { faire: 'expliquer', sur: '#sg-raisons', nom: 'La raison', quoi: 'maladie, accident du travail ou autre raison.', sert: 'Un accident du travail ouvre les questions utiles à sa déclaration.' },
        { faire: 'expliquer', sur: '#sg-postes', nom: 'Les postes touchés', quoi: 'le nombre de postes planifiés sur ces dates.', sert: 'Ils seront à couvrir dans « Résoudre », avec les options comparées.' },
        { faire: 'expliquer', sur: '.dialog .ret-qui', nom: 'Qui est prévenu', quoi: 'les autres titulaires, qui reçoivent une notification.', facultatif: true },
        { faire: 'expliquer', sur: '#sg-confirmer', quoi: 'enregistre l’absence : elle est acquise, sans demande à valider.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Retard ou absence',
      qui: o.HELENE,
      cible: '.topbar-in',
      cibleFin: '.topbar-in',
      titre: 'Un accident du travail',
      texte: () => 'Pour un accident du travail, la fenêtre recueille les faits tant qu’ils sont frais, et rappelle la suite dans l’ordre.',
      jouer: () => {
        o.avecPlanning();
        o.helene('tableau');
      },
      gestes: [
        { faire: 'cliquer', sur: '#top-signaler', dit: 'Cliquez sur « Retard ou absence »' },
        { faire: 'attendre', que: '.dialog #sg-qui' },
        { faire: 'cliquer', sur: 'label[for="sg-absence"]', dit: 'Choisissez « Une absence »' },
        { faire: 'cliquer', sur: o.parTexte('#sg-raisons .comp', 'Accident du travail'), dit: 'Puis « Accident du travail »', sert: 'Le bloc « L’accident » apparaît.' },
        { faire: 'expliquer', sur: '#sg-ou', nom: 'Où est-ce arrivé ?', quoi: 'à la pharmacie, en mission à l’extérieur, ou sur le trajet.' },
        { faire: 'expliquer', sur: o.parLibelle('Le jour de l’accident', '.dialog'), quoi: 'le jour où il s’est produit, aujourd’hui au plus tard.', sert: 'Le délai de déclaration de 48 heures part de là.' },
        { faire: 'expliquer', sur: o.parLibelle('Vers quelle heure', '.dialog'), quoi: 'l’heure de l’accident, si elle est connue.', exemple: '10 h 15' },
        { faire: 'expliquer', sur: o.parLibelle('Ce qui s’est passé', '.dialog'), quoi: 'les faits, en quelques mots.', exemple: 'chute dans la réserve en rangeant une livraison' },
        { faire: 'expliquer', sur: o.parLibelle('Un témoin', '.dialog'), quoi: 'un témoin, ou la première personne prévenue, si l’on en connaît un.' },
        { faire: 'expliquer', sur: '#sg-acc-suite', nom: 'La suite, dans l’ordre', quoi: 'le certificat du médecin, la déclaration à la caisse avec sa date limite, puis la feuille d’accident à remettre.', sert: 'Solvéa rappelle le délai sur votre tableau de bord ; la déclaration se fait auprès de la caisse.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    // ---------------------------------------------------------------- 9. Résoudre
    {
      chapitre: 'Résoudre',
      qui: o.HELENE,
      cible: '.content .onglets',
      titre: 'Les onglets de « Résoudre »',
      texte: () => '« Résoudre » réunit tout ce qui attend une décision, une famille par onglet. Le nombre dit ce qui reste à traiter.',
      jouer: () => {
        toutADecider();
        ouvrirResoudre('absences');
      },
      gestes: [
        { faire: 'expliquer', sur: '#onglet-accords', nom: 'Accords à donner', quoi: 'les décisions du titulaire secondaire, qui attendent votre accord pour s’appliquer.', sert: 'L’onglet n’apparaît que s’il y en a.' },
        { faire: 'expliquer', sur: '#onglet-absences', nom: 'Absences', quoi: 'les postes découverts par une absence acceptée, jour par jour.' },
        { faire: 'expliquer', sur: '#onglet-remplacements', nom: 'Remplacements', quoi: 'les demandes de remplacement de l’équipe, triées par urgence.' },
        { faire: 'expliquer', sur: '#onglet-demandes', nom: 'Demandes', quoi: 'les congés et les demandes d’horaires à trancher.' },
        { faire: 'expliquer', sur: '#onglet-gardes', nom: 'Gardes', quoi: 'les gardes à affecter, un repos à protéger, une garde confiée à un absent, des variables à valider.' },
        { faire: 'expliquer', sur: '#onglet-publications', nom: 'À publier', quoi: 'les semaines à construire ou à publier, et les modifications que l’équipe ne voit pas encore.' },
      ],
    },
    {
      chapitre: 'Résoudre',
      qui: o.HELENE,
      cible: '.panneau',
      titre: 'Une absence à couvrir',
      texte: () => 'Un arrêt découvre des postes. Pour chaque jour, Solvéa dit ce qui manque, puis propose d’appeler l’équipe ou de régler vous-même.',
      jouer: () => {
        toutADecider();
        ouvrirResoudre('absences');
      },
      gestes: [
        { faire: 'expliquer', sur: '.panneau > .col > .card > .card-head .grow', nom: 'L’absence', quoi: 'qui est absent, de quand à quand, et combien de postes sont à couvrir.' },
        { faire: 'expliquer', sur: '.panneau > .col > .card > .card-head .pill', nom: 'Le délai', quoi: '« Urgent » pour aujourd’hui ou demain, sinon le nombre de jours avant le premier poste.' },
        { faire: 'expliquer', sur: o.parTexte('.panneau .card-head .btn', 'Voir et choisir la solution'), quoi: 'ouvre tous les jours de l’absence avec la solution conseillée cochée pour chacun.' },
        { faire: 'expliquer', sur: '.panneau details.volet > summary', nom: 'Un jour à couvrir', quoi: 'la date, le poste vacant et le nombre d’options à comparer.', sert: 'Le premier jour qui demande un vrai choix est déplié ; un clic ouvre ou referme les autres.' },
        { faire: 'expliquer', sur: '.panneau details.volet[open] .volet-corps > .notice', nom: 'À couvrir', quoi: 'ce qui manquerait au comptoir sans ce poste : un pharmacien, ou l’effectif attendu, avec les heures.' },
        { faire: 'expliquer', sur: '.panneau details.volet[open] .appel-tete', nom: 'Demander à toute l’équipe', quoi: 'l’appel : tous ceux qui peuvent tenir le poste sont prévenus en même temps, avec le même message.', sert: 'Entre volontaires, le poste revient à celui qui a le moins dépanné.' },
        { faire: 'expliquer', sur: '.panneau details.volet[open] .appel-tete .btn', quoi: 'lance l’appel : chacun reçoit le message et répond oui ou non.', facultatif: true },
        { faire: 'expliquer', sur: '.panneau details.volet[open] .appel-liste li', nom: 'Le tour de rôle', quoi: 'les personnes qui peuvent tenir le poste, avec leurs dépannages sur trois mois et la date du dernier.', sert: 'Une fois l’appel lancé, chaque réponse s’affiche ; « Confier » donne le poste au volontaire.' },
      ],
    },
    {
      chapitre: 'Résoudre',
      qui: o.HELENE,
      cible: '.panneau',
      titre: 'Les options pour régler un jour',
      texte: () => 'Sous l’appel, les options pour régler vous-même ce jour : chacune dit ce qu’elle change avant que vous ne choisissiez.',
      jouer: () => {
        toutADecider();
        ouvrirResoudre('absences');
      },
      gestes: [
        { faire: 'expliquer', sur: '.panneau details.volet[open] .option', nom: 'Une option', quoi: 'une façon de couvrir le poste : ce qu’elle fait, et si la couverture est maintenue, sous conditions ou partielle.' },
        { faire: 'expliquer', sur: '.panneau details.volet[open] .option .reco-tag', nom: 'Conseillé', quoi: 'l’option que Solvéa recommande : la couverture la plus sûre, avec le moins de changements.', facultatif: true },
        { faire: 'expliquer', sur: '.panneau details.volet[open] .option .facts', nom: 'Personnes et horaires', quoi: 'les personnes touchées, le nombre d’horaires modifiés et, si les coûts sont activés, le coût en plus.' },
        { faire: 'expliquer', sur: '.panneau details.volet[open] .option details.plus > summary', nom: 'Règles et points à valider', quoi: 'un clic déplie les points à valider et chaque règle contrôlée, respectée ou non.' },
        { faire: 'expliquer', sur: '.panneau details.volet[open] .option .notice.warn', nom: 'Reste à régler', quoi: 'ce que l’option laisse découvert.', facultatif: true },
        { faire: 'expliquer', sur: '.panneau details.volet[open] .option > .btn', nom: 'Choisir', quoi: 'applique cette option à ce jour.', sert: 'Si la semaine est publiée, pensez à publier la modification pour prévenir l’équipe.' },
      ],
    },
    {
      chapitre: 'Résoudre',
      qui: o.HELENE,
      cible: '.panneau',
      cibleFin: '.panneau',
      titre: 'Régler toute l’absence d’un coup',
      texte: () => '« Voir et choisir la solution » montre tous les jours de l’absence. La solution conseillée est cochée : gardez-la, changez-la, ou réglez le jour à la main.',
      jouer: () => {
        toutADecider();
        ouvrirResoudre('absences');
      },
      gestes: [
        { faire: 'cliquer', sur: o.parTexte('.panneau .card-head .btn', 'Voir et choisir la solution'), sert: 'La fenêtre « Comment régler cette absence ? » s’ouvre.' },
        { faire: 'attendre', que: '.dialog .rs-jour' },
        { faire: 'expliquer', sur: '.dialog .rs-jour legend', nom: 'Le jour', quoi: 'la date et le poste vacant.' },
        { faire: 'expliquer', sur: '.dialog .rs-impact', nom: 'Ce qui est découvert', quoi: 'ce qui manquerait ce jour-là, ou « Rien n’est découvert ».' },
        { faire: 'expliquer', sur: '.dialog .rs-option.on', nom: 'La solution retenue', quoi: 'cochée d’office : la solution conseillée, avec ses changements, les personnes touchées et les règles.', sert: 'Les jours sont calculés l’un après l’autre : le choix d’un jour compte pour le suivant.' },
        { faire: 'expliquer', sur: '.dialog .rs-option:not(.on):not(.libre)', nom: 'Une autre option', quoi: 'une autre façon de couvrir ce jour ; un clic la retient à la place.', facultatif: true },
        { faire: 'expliquer', sur: '.dialog .rs-option.libre', nom: 'Je règle ce jour à la main', quoi: 'rien n’est changé pour ce jour ; le planning s’ouvre ensuite sur la case concernée.' },
        { faire: 'expliquer', sur: '.dialog-foot .grow', nom: 'Le bilan', quoi: 'combien de jours vos choix règlent, et combien restent à la main. Rien n’est appliqué avant votre accord.' },
        { faire: 'expliquer', sur: o.VALIDER, quoi: 'applique vos choix, jour par jour, et prévient les personnes concernées.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Résoudre',
      qui: o.HELENE,
      cible: '.panneau',
      cibleFin: '.panneau',
      titre: 'Une demande de remplacement',
      texte: () => 'Nicolas demande un remplacement. La carte résume la demande ; « Décider » ouvre tout ce qu’il faut pour trancher.',
      jouer: () => {
        toutADecider();
        ouvrirResoudre('remplacements');
      },
      gestes: [
        { faire: 'expliquer', sur: '.panneau .demande-r .row.wrap', nom: 'Urgence et délai', quoi: 'l’urgence de la demande (urgence médicale, urgent, prévu) et le délai avant le poste.', sert: 'Les cartes sont rangées par urgence et entourées de sa couleur.' },
        { faire: 'expliquer', sur: '.panneau .demande-r .rm-faits', nom: 'Motif', quoi: 'la raison donnée, et le nombre de demandes de remplacement de la personne sur trois mois.', sert: 'Seuls les titulaires voient le motif.' },
        { faire: 'cliquer', sur: '.panneau .demande-r [data-decider]', dit: 'Cliquez sur « Décider »', sert: 'La fenêtre de décision s’ouvre.' },
        { faire: 'attendre', que: '.dialog .dr' },
        { faire: 'expliquer', sur: '.dialog section[aria-labelledby="dr-demande"]', nom: 'La demande', quoi: 'l’urgence, le délai, le motif, le nombre de demandes en trois mois, et le justificatif s’il y en a un.' },
        { faire: 'expliquer', sur: '.dialog section[aria-labelledby="dr-qui"]', nom: 'Qui peut reprendre ce poste', quoi: 'les collègues qui le peuvent sans enfreindre une règle, ce que cela fait à leurs heures, et qui est à son tour.', sert: 'Dessous, ceux qui ne peuvent pas, avec la raison.' },
        { faire: 'expliquer', sur: '.dialog section[aria-labelledby="dr-sans"]', nom: 'Si personne ne le reprend', quoi: 'ce qui se passerait au comptoir : sans pharmacien, ou sous l’effectif, à quelles heures.', sert: 'Le poste reste à la personne tant qu’un remplaçant n’est pas validé.' },
        { faire: 'expliquer', sur: o.parLibelle('Votre décision', '.dialog'), quoi: 'accepter et prévenir l’équipe, accepter et confier le poste, ou refuser.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Résoudre',
      qui: o.HELENE,
      cible: '.panneau',
      cibleFin: '.panneau',
      titre: 'Confier ou refuser un remplacement',
      texte: () => 'Chaque décision a ses champs, et la fenêtre montre le message que la personne recevra.',
      jouer: () => {
        toutADecider();
        ouvrirResoudre('remplacements');
      },
      gestes: [
        { faire: 'cliquer', sur: '.panneau .demande-r [data-decider]', dit: 'Cliquez sur « Décider »' },
        { faire: 'attendre', que: '.dialog .dr' },
        { faire: 'cliquer', sur: 'label[for="dr-confier"]', dit: 'Choisissez « Accepter et confier le poste »', sert: 'Utile si vous vous êtes déjà mis d’accord avec un collègue.' },
        { faire: 'expliquer', sur: o.parLibelle('Qui reprend le poste ?', '.dialog'), quoi: 'le collègue qui reprend le poste, parmi ceux qui le peuvent, avec ce que cela ajoute à ses heures.' },
        { faire: 'expliquer', sur: '#dr-message', nom: 'Ce que la personne recevra', quoi: 'le message envoyé au demandeur, qui change avec votre décision.' },
        { faire: 'cliquer', sur: 'label[for="dr-refuser"]', dit: 'Choisissez maintenant « Refuser »' },
        { faire: 'expliquer', sur: o.parLibelle('Raison du refus', '.dialog'), quoi: 'une raison choisie dans la liste, ou « Ne pas préciser ».', sert: 'Une liste, pour rester factuel.' },
        { faire: 'expliquer', sur: o.parLibelle('Un mot pour', '.dialog'), quoi: 'une phrase de votre part, si vous le souhaitez.', exemple: 'un autre jour de la semaine serait possible' },
        { faire: 'expliquer', sur: '#dr-confirmer', quoi: 'confirme la décision ; le bouton dit ce qui va se passer.', sert: '« Plus tard » referme la fenêtre sans rien décider.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Résoudre',
      qui: o.HELENE,
      cible: '.panneau',
      cibleFin: '.panneau',
      titre: 'Le titulaire en dernier recours',
      texte: () => 'Une urgence médicale ne se refuse pas faute de remplaçant : un choix de plus apparaît, un titulaire assure le poste.',
      jouer: () => {
        toutADecider();
        urgenceMedicale();
        ouvrirResoudre('remplacements');
      },
      gestes: [
        { faire: 'expliquer', sur: '.panneau .demande-r.u-medical .piece-bloc', nom: 'Le justificatif', quoi: 'la pièce jointe à une urgence médicale, visible des seuls titulaires.', sert: 'Elle est conservée dans « Documents » après votre décision.' },
        { faire: 'cliquer', sur: '.panneau .demande-r.u-medical [data-decider]', dit: 'Cliquez sur « Décider », sur l’urgence médicale' },
        { faire: 'attendre', que: '.dialog .dr' },
        { faire: 'expliquer', sur: 'label[for="dr-titulaire"]', nom: 'Un titulaire assure le poste', quoi: 'le dernier recours : la personne est libérée, et un titulaire tient le poste.', sert: 'Toujours proposé pour une urgence médicale, et dès qu’aucun collègue ne peut reprendre le poste.' },
        { faire: 'cliquer', sur: 'label[for="dr-titulaire"]', dit: 'Choisissez ce dernier recours' },
        { faire: 'expliquer', sur: o.parLibelle('Quel titulaire assure le poste ?', '.dialog'), quoi: 'le titulaire qui assure le poste ; un titulaire libre sur l’horaire est proposé d’abord.', sert: 'Libre, il reprend le poste ; déjà en poste, la personne est libérée et le comptoir compte une personne de moins.' },
        { faire: 'expliquer', sur: '#dr-confirmer', quoi: 'libère la personne, attribue le poste et prévient tout le monde.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Résoudre',
      qui: o.HELENE,
      cible: '.panneau',
      cibleFin: '.panneau',
      titre: 'Une demande de congé',
      texte: () => 'Jules demande un congé. La frise montre qui est déjà absent ; la fenêtre de décision dit ce que l’absence découvrirait.',
      jouer: () => {
        toutADecider();
        ouvrirResoudre('demandes');
      },
      gestes: [
        { faire: 'expliquer', sur: '.panneau .fc .card-head', nom: 'Absences de l’équipe', quoi: 'les semaines à venir, une ligne par personne : les absences acceptées, et en pointillés les demandes en attente.', sert: 'On voit d’un coup d’œil qui demande les mêmes dates.' },
        { faire: 'expliquer', sur: congeDe('Jules', '.demande-motif'), nom: 'Raison donnée', quoi: 'le motif choisi par la personne, et sa précision.' },
        { faire: 'expliquer', sur: congeDe('Jules', '.notice'), nom: 'Si vous approuvez', quoi: 'ce que l’absence découvrirait au comptoir, calculé avant toute décision.' },
        { faire: 'cliquer', sur: congeDe('Jules', '[data-decider]'), dit: 'Cliquez sur « Décider », sur la demande de Jules' },
        { faire: 'attendre', que: '.dialog #dc-implications' },
        { faire: 'expliquer', sur: '.dialog section[aria-labelledby="dc-demande"]', nom: 'La demande', quoi: 'sa nature, sa durée, la raison donnée et le délai avant le premier jour.' },
        { faire: 'expliquer', sur: '#dc-implications', nom: 'Ce que cela implique', quoi: 'les postes déjà planifiés sur ces dates, ce qui manquerait au comptoir, et qui d’autre est absent.' },
        { faire: 'expliquer', sur: o.parLibelle('Votre décision', '.dialog'), quoi: 'accepter la demande, ou la refuser en donnant la raison.' },
        { faire: 'expliquer', sur: '#dc-ecrire', quoi: 'ouvre votre conversation avec Jules ; la demande reste à décider.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Résoudre',
      qui: o.HELENE,
      cible: '.panneau',
      cibleFin: '.panneau',
      titre: 'Refuser une demande',
      texte: () => 'Un refus se motive. La raison et le mot partent avec le message ; on le relit avant d’envoyer.',
      jouer: () => {
        toutADecider();
        ouvrirResoudre('demandes');
      },
      gestes: [
        { faire: 'cliquer', sur: congeDe('Jules', '[data-decider]'), dit: 'Cliquez sur « Décider »' },
        { faire: 'attendre', que: '.dialog #dc-implications' },
        { faire: 'cliquer', sur: 'label[for="dc-refuser"]', dit: 'Choisissez « Refuser »' },
        { faire: 'expliquer', sur: o.parLibelle('Raison du refus', '.dialog'), quoi: 'une raison choisie dans la liste, ou « Ne pas préciser ».', exemple: 'Plusieurs absences déjà prévues' },
        { faire: 'expliquer', sur: o.parLibelle('Un mot pour', '.dialog'), quoi: 'une phrase de votre part, facultative.', exemple: 'la semaine suivante serait possible' },
        { faire: 'expliquer', sur: '#dc-message', nom: 'Ce que Jules recevra', quoi: 'le message exact, raison et mot compris.' },
        { faire: 'expliquer', sur: '#dc-confirmer', quoi: 'envoie la décision ; en cas de refus, la personne garde ses postes.' },
        { faire: 'expliquer', sur: o.parTexte('.dialog-foot .btn', 'Plus tard'), quoi: 'referme la fenêtre ; la demande reste à décider.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Résoudre',
      qui: o.HELENE,
      cible: '.panneau',
      cibleFin: '.panneau',
      titre: 'Une demande d’horaires',
      texte: () => 'Une demande d’horaires s’accepte de trois façons : simple préférence, préférence prioritaire, ou indisponibilité reconnue.',
      jouer: () => {
        toutADecider();
        ouvrirResoudre('demandes');
      },
      gestes: [
        { faire: 'expliquer', sur: besoin('.pill'), nom: 'Demandes prioritaires actives', quoi: 'combien de demandes prioritaires la personne a déjà, face au plafond fixé pour toute l’équipe.' },
        { faire: 'cliquer', sur: besoin('[data-decider]'), dit: 'Cliquez sur « Décider », sur la demande d’horaires' },
        { faire: 'attendre', que: '.dialog #dc-implications' },
        { faire: 'expliquer', sur: 'label[for="dc-preference"]', nom: 'Simple préférence', quoi: 'le planning en tient compte quand c’est possible.' },
        { faire: 'expliquer', sur: 'label[for="dc-prioritaire"]', nom: 'Préférence prioritaire', quoi: 'elle passe avant les simples préférences, et compte dans le plafond de la personne.', sert: 'Grisée quand le plafond est atteint.' },
        { faire: 'expliquer', sur: 'label[for="dc-reconnue"]', nom: 'Indisponibilité reconnue', quoi: 'aucun poste ne sera proposé sur cette plage : c’est une règle pour le calcul.' },
        { faire: 'expliquer', sur: 'label[for="dc-refuser"]', nom: 'Refuser', quoi: 'la personne reçoit votre raison ; le refus compte dans la mémoire d’équité.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Résoudre',
      qui: o.HELENE,
      cible: '.panneau',
      cibleFin: '.panneau',
      titre: 'Refuser un remplacement déjà accepté',
      texte: () => 'Une fois une demande acceptée, « Refuser » ouvre une fenêtre plus courte : le message, la raison, le mot.',
      jouer: () => {
        o.avecDemande();
        const st = s();
        const r = st.data.remplacements.find((x) => x.demandeur === 'p_camille' && x.statut === 'ouverte');
        if (r?.accord === 'attente') st.deciderDemande(r.id, true);
        ouvrirResoudre('remplacements');
      },
      gestes: [
        { faire: 'cliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.panneau .demande-r .btn')].find((e) => e.textContent?.trim() === 'Refuser'), dit: 'Cliquez sur « Refuser »', sert: 'La fenêtre « Refuser la demande » s’ouvre.' },
        { faire: 'attendre', que: '.dialog #refus-prevenir' },
        { faire: 'expliquer', sur: o.parLibelle('Envoyer un message', '.dialog'), quoi: 'cochée, la personne reçoit un message dans ses messages.', sert: 'Décochée, le refus est seulement enregistré.' },
        { faire: 'expliquer', sur: o.parLibelle('Raison', '.dialog'), quoi: 'la raison du refus, choisie dans la liste, ou « Ne pas préciser ».' },
        { faire: 'expliquer', sur: o.parLibelle('Un mot pour', '.dialog'), quoi: 'une phrase de votre part, facultative.' },
        { faire: 'expliquer', sur: '.dialog .refus-apercu', nom: 'Ce que la personne recevra', quoi: 'le message exact, tel qu’il partira.' },
        { faire: 'expliquer', sur: '.dialog-foot .btn.danger', quoi: 'refuse la demande et prévient la personne : elle reste en poste.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Résoudre',
      qui: o.HELENE,
      cible: '.content .onglets',
      cibleFin: '.panneau',
      titre: 'Gardes, publications et accords',
      texte: () => 'Les trois derniers onglets mènent chacun à l’écran où l’on agit.',
      jouer: () => {
        toutADecider();
        ouvrirResoudre('gardes');
      },
      gestes: [
        { faire: 'expliquer', sur: '.panneau .decision', nom: 'Une garde à régler', quoi: 'une garde à affecter avant la limite des quinze jours, un repos à protéger, ou des variables à valider.', sert: 'Le bouton ouvre la fiche de la garde.' },
        { faire: 'cliquer', sur: '#onglet-publications', dit: 'Ouvrez l’onglet « À publier »' },
        { faire: 'expliquer', sur: '.panneau .decision', nom: 'Une semaine à publier', quoi: 'son numéro, ses dates, et ce qui l’attend : construire, publier, ou des modifications que l’équipe ne voit pas encore.' },
        { faire: 'expliquer', sur: '.panneau [data-publier]', quoi: 'ouvre la semaine dans « Construire », sur la grille ou sur « Publier ».' },
        { faire: 'cliquer', sur: '#onglet-accords', dit: 'Ouvrez l’onglet « Accords à donner »' },
        { faire: 'expliquer', sur: '.panneau .decision', nom: 'Une décision à approuver', quoi: 'ce que propose le titulaire secondaire, et quand.' },
        { faire: 'expliquer', sur: o.parTexte('.panneau .btn', 'Donner mon accord'), quoi: 'applique aussitôt la décision ; son auteur est prévenu.' },
        { faire: 'expliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.panneau .decision .btn')].find((e) => e.textContent?.trim() === 'Refuser'), nom: 'Refuser', quoi: 'écarte la décision : rien n’est appliqué.' },
      ],
    },
    // ---------------------------------------------------------------- 10. Messages et rendez-vous
    {
      chapitre: 'Messages et rendez-vous',
      qui: o.HELENE,
      cible: '.content .split',
      titre: 'Les conversations',
      texte: () => 'La messagerie réunit un fil pour toute l’équipe et une conversation privée avec chaque personne.',
      jouer: () => {
        avecRendezVous();
        o.helene('messages');
      },
      gestes: [
        { faire: 'expliquer', sur: '.msg-alerte', nom: 'Messages non lus', quoi: 'le nombre de messages non lus dans les autres conversations.', facultatif: true },
        { faire: 'expliquer', sur: o.nieme('.msg-fils .msg-fil', 0), nom: 'Toute l’équipe', quoi: 'le fil que tout le monde lit : une annonce, une information générale.' },
        { faire: 'expliquer', sur: '.msg-fils .msg-rubrique', nom: 'Les rubriques', quoi: 'les conversations privées, toujours dans le même ordre : titulaires, pharmaciens, préparateurs, autres postes.', sert: 'Une pastille compte les messages non lus, sans déplacer la conversation.' },
        { faire: 'expliquer', sur: '.msg-fils .msg-fil.non-lu', nom: 'Une conversation non lue', quoi: 'le nom, l’heure et le début du dernier message, avec le nombre de messages non lus.', facultatif: true },
        { faire: 'expliquer', sur: '.content .split > section.card .card-head', nom: 'La conversation ouverte', quoi: 'avec qui vous échangez.' },
        { faire: 'expliquer', sur: '.content .fil', nom: 'Le fil', quoi: 'les messages, du plus ancien au plus récent ; les nouveaux sont signalés à l’ouverture.', sert: 'Une demande de rendez-vous y arrive avec sa carte de réponse.' },
        { faire: 'expliquer', sur: o.parLibelle('Votre message', '.content'), quoi: 'votre message, mille caractères au plus.', sert: 'Pour une absence ou un horaire, une demande est préférable : elle est suivie.' },
        { faire: 'taper', dans: '#msg-texte', texte: 'Planning publié pour deux semaines.', dit: 'Écrivez un message', sert: 'Il partira dans la conversation ouverte.' },
        { faire: 'expliquer', sur: o.parTexte('.content form .btn', 'Envoyer'), quoi: 'envoie le message ; il arrive aussitôt dans l’espace de chacun.' },
      ],
    },
    {
      chapitre: 'Messages et rendez-vous',
      qui: o.HELENE,
      cible: '.content .split',
      cibleFin: '.content .split',
      titre: 'Répondre à un rendez-vous',
      texte: () => 'Nicolas demande un rendez-vous. Sa demande arrive dans la conversation, avec une carte pour répondre.',
      jouer: () => {
        avecRendezVous();
        ui().viserFil('p_camille');
        o.helene('messages');
      },
      gestes: [
        { faire: 'expliquer', sur: '.content .rdv-carte .rdv-etat', nom: 'L’état du rendez-vous', quoi: 'proposé, fixé, décliné ou annulé ; ou « En attente » quand c’est à l’autre de répondre.' },
        { faire: 'expliquer', sur: '.content .rdv-carte .rdv-quand', nom: 'Le moment', quoi: 'le jour et l’horaire demandés, sous le sujet.' },
        { faire: 'expliquer', sur: o.parTexte('.content .rdv-actions .btn', 'Accepter'), quoi: 'fixe le rendez-vous dans les deux agendas.', sert: 'Grisé si vous n’êtes pas libre à ce moment : la carte dit pourquoi.' },
        { faire: 'expliquer', sur: o.parTexte('.content .rdv-actions .btn', 'Proposer un autre horaire'), quoi: 'ouvre la même fenêtre que la demande, pour suggérer un autre moment.' },
        { faire: 'expliquer', sur: o.parTexte('.content .rdv-actions .btn', 'Décliner'), quoi: 'refuse le rendez-vous ; la personne le voit dans la conversation.' },
        { faire: 'cliquer', sur: o.parTexte('.content .rdv-actions .btn', 'Accepter'), dit: 'Cliquez sur « Accepter »', sert: 'Le rendez-vous est fixé : il figure dans « Mon planning » et sur le tableau de bord.' },
        { faire: 'expliquer', sur: o.parTexte('.content .rdv-actions .btn', 'Déplacer'), quoi: 'propose un autre horaire pour un rendez-vous déjà fixé.' },
        { faire: 'expliquer', sur: o.parTexte('.content .rdv-actions .btn', 'Annuler le rendez-vous'), quoi: 'annule le rendez-vous pour les deux.' },
      ],
    },
    {
      chapitre: 'Messages et rendez-vous',
      qui: o.HELENE,
      cible: '.page-head',
      cibleFin: '.content .split',
      titre: 'Demander un rendez-vous',
      texte: () => '« Demander un rendez-vous » choisit la personne et le sujet ; Solvéa propose des moments où vous êtes tous les deux en poste.',
      jouer: () => {
        avecRendezVous();
        o.helene('messages');
      },
      gestes: [
        { faire: 'cliquer', sur: '#rdv-demander', sert: 'La fenêtre « Demander un rendez-vous » s’ouvre.' },
        { faire: 'attendre', que: '.dialog #rdv-avec' },
        { faire: 'expliquer', sur: o.parLibelle('Avec', '.dialog'), quoi: 'la personne avec qui prendre rendez-vous.', sert: 'Ouverte depuis une conversation, la fenêtre la choisit d’avance.' },
        { faire: 'expliquer', sur: o.parLibelle('Sujet', '.dialog'), quoi: 'l’objet du rendez-vous : point d’équipe, entretien annuel, organisation du planning, ou autre sujet.' },
        { faire: 'choisir', dans: '#rdv-sujet', valeur: 'Autre sujet', dit: 'Choisissez « Autre sujet »', sert: 'Un champ s’ajoute pour le préciser.' },
        { faire: 'expliquer', sur: o.parLibelle('Précisez le sujet', '.dialog'), quoi: 'le sujet, en quelques mots.', exemple: 'Bilan de la saison des vaccins' },
        { faire: 'expliquer', sur: '.dialog .rdv-idees', nom: 'Les moments proposés', quoi: 'les prochains moments où vous êtes tous les deux en poste ; un clic en retient un.', sert: 'Sans moment commun, choisissez le jour et l’heure vous-même.', facultatif: true },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Messages et rendez-vous',
      qui: o.HELENE,
      cible: '.page-head',
      cibleFin: '.content .split',
      titre: 'Le moment du rendez-vous',
      texte: () => 'Sous les moments proposés, le jour, l’heure et la durée se règlent à la main. Solvéa vérifie aussitôt que le moment convient.',
      jouer: () => {
        avecRendezVous();
        o.helene('messages');
      },
      gestes: [
        { faire: 'cliquer', sur: '#rdv-demander', dit: 'Cliquez sur « Demander un rendez-vous »' },
        { faire: 'attendre', que: '.dialog #rdv-date' },
        { faire: 'expliquer', sur: champ('rdv-date'), quoi: 'le jour du rendez-vous, dans les quatre mois.' },
        { faire: 'expliquer', sur: champ('rdv-debut'), quoi: 'l’heure de début, au quart d’heure.', exemple: '14 h' },
        { faire: 'expliquer', sur: o.parLibelle('Durée', '.dialog'), quoi: '15, 30, 45 minutes ou une heure.' },
        { faire: 'expliquer', sur: '#rdv-avis', nom: 'Le contrôle du moment', quoi: 'le moment retenu, ou pourquoi il ne convient pas : l’un de vous absent, hors de son poste, déjà pris.', sert: 'Tant qu’il ne convient pas, la demande ne part pas.' },
        { faire: 'expliquer', sur: o.parLibelle('Un mot pour', '.dialog'), quoi: 'ce que vous aimeriez aborder, si vous le souhaitez.' },
        { faire: 'expliquer', sur: '#rdv-envoyer', quoi: 'envoie la demande dans la conversation ; une fois acceptée, le rendez-vous est fixé dans les deux agendas.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    // ---------------------------------------------------------------- 11. Heures
    {
      chapitre: 'Heures',
      qui: o.HELENE,
      cible: '.content',
      titre: 'Le compteur d’heures',
      texte: () => 'Le compteur compare les heures publiées de chacun à son contrat. L’objectif : le moins d’heures en plus possible.',
      jouer: () => {
        o.avecPlanning();
        o.helene('heures');
      },
      gestes: [
        { faire: 'expliquer', sur: "[data-focus='auto-heures']", nom: 'Régulariser automatiquement', quoi: 'résorbe tous les écarts sur la prochaine semaine à construire, par demi-heures, sans rien publier.', sert: 'Le brouillon de cette semaine est recalculé ; vous le relisez avant de publier.' },
        { faire: 'expliquer', sur: o.nieme('.content .chiffres .chiffre', 0), nom: 'En plus des contrats', quoi: 'le total des heures faites au-delà des contrats, et le nombre de personnes concernées.' },
        { faire: 'expliquer', sur: o.nieme('.content .chiffres .chiffre', 1), nom: 'En moins des contrats', quoi: 'le total des heures qui manquent pour atteindre les contrats.' },
        { faire: 'expliquer', sur: o.nieme('.content .chiffres .chiffre', 2), nom: 'À jour', quoi: 'le nombre de personnes à moins d’une heure de leur contrat.' },
        { faire: 'expliquer', sur: '.content .hc-alerte', nom: 'L’alerte', quoi: 'qui a des heures en plus, et la semaine où les faire récupérer plutôt que de les payer.' },
        { faire: 'expliquer', sur: '.content .hc .hc-qui', nom: 'Une personne', quoi: 'ses heures planifiées, son contrat, les régularisations déjà prévues, et une jauge.' },
        { faire: 'expliquer', sur: '.content .hc .hc-solde', nom: 'Le solde', quoi: 'l’écart avec le contrat, en plus ou en moins, ou « À jour » sous une heure.' },
        { faire: 'expliquer', sur: "[data-regul='recuperation']", nom: 'Faire récupérer', quoi: 'pour des heures en plus : choisissez le jour et l’horaire où la personne travaillera moins.', facultatif: true },
        { faire: 'expliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.content .hc .btn')].find((e) => e.textContent?.trim() === 'Payer'), nom: 'Payer', quoi: 'efface le solde : les heures en plus partent en paie.', facultatif: true },
        { faire: 'expliquer', sur: "[data-regul='rattrapage']", nom: 'Faire rattraper', quoi: 'pour des heures en moins : choisissez quand la personne travaillera davantage.' },
        { faire: 'expliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.content .hc .btn')].find((e) => e.textContent?.trim() === 'Solder'), nom: 'Solder', quoi: 'efface le solde sans rattrapage : les heures manquantes ne sont pas demandées.' },
      ],
    },
    {
      chapitre: 'Heures',
      qui: o.HELENE,
      cible: '.content',
      titre: 'Les régularisations enregistrées',
      texte: () => 'Chaque régularisation est gardée dans une liste : la personne, la nature, les heures et la date.',
      jouer: () => {
        o.avecPlanning();
        o.helene('heures');
      },
      gestes: [
        { faire: 'cliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.content .hc .btn')].find((e) => e.textContent?.trim() === 'Solder'), dit: 'Cliquez sur « Solder », sur une ligne', sert: 'Le solde est effacé, et la régularisation s’ajoute en bas.' },
        { faire: 'expliquer', sur: 'section[aria-label="Régularisations enregistrées"] .decision', nom: 'Une régularisation', quoi: 'la personne, la nature (payé, soldé, récupéré, rattrapé), les heures, et quand.', sert: '« Automatique » marque celles faites par « Régulariser automatiquement ».' },
        { faire: 'expliquer', sur: 'section[aria-label="Régularisations enregistrées"] [aria-label^="Retirer la régularisation"]', nom: 'La corbeille', quoi: 'annule la régularisation : le solde revient au compteur.' },
        { faire: 'expliquer', sur: '.content > div > p.tiny.muted', nom: 'Le rappel', quoi: 'le compteur aide à décider ; il ne calcule ni majoration ni repos compensateur.', sert: 'Faites valider le choix entre paiement et récupération par votre expert-comptable.' },
      ],
    },
    {
      chapitre: 'Heures',
      qui: o.HELENE,
      cible: '.content',
      cibleFin: '.content',
      titre: 'Faire rattraper des heures',
      texte: () => '« Faire rattraper » ouvre le planning de la personne : vous choisissez combien d’heures, et où les placer.',
      jouer: () => {
        o.avecPlanning();
        o.helene('heures');
      },
      gestes: [
        { faire: 'cliquer', sur: "[data-regul='rattrapage']", dit: 'Cliquez sur « Faire rattraper »', sert: 'La fenêtre s’ouvre sur le planning de la personne.' },
        { faire: 'attendre', que: '.dialog .rat-pl' },
        { faire: 'expliquer', sur: '.dialog section[aria-labelledby="rat-combien"]', nom: 'Combien d’heures ?', quoi: 'la durée à rattraper, par demi-heures, avec « − » et « + » ; « Tout » reprend le solde entier.', sert: 'Dessous : ce qu’il restera au compteur.' },
        { faire: 'expliquer', sur: '.dialog .rat-pl-nav', nom: 'La semaine', quoi: 'la semaine du planning affichée, et son état : communiqué, brouillon, ou pas encore construite.' },
        { faire: 'expliquer', sur: '.dialog .rat-pl', nom: 'Le planning de la personne', quoi: 'ses postes jour par jour ; en couleur, les manques au comptoir et les créneaux proposés.', sert: 'Un clic sur une plage libre y place les heures, collées au poste voisin.' },
        { faire: 'expliquer', sur: champ('rat-date'), quoi: 'le jour du rattrapage, au clavier.' },
        { faire: 'expliquer', sur: champ('rat-debut'), nom: 'De', quoi: 'l’heure de début du créneau.' },
        { faire: 'expliquer', sur: champ('rat-fin'), nom: 'À', quoi: 'l’heure de fin du créneau.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    {
      chapitre: 'Heures',
      qui: o.HELENE,
      cible: '.content',
      cibleFin: '.content',
      titre: 'Les propositions et le message',
      texte: () => 'À droite, Solvéa propose des créneaux contrôlés, et prépare le message que la personne recevra.',
      jouer: () => {
        o.avecPlanning();
        o.helene('heures');
      },
      gestes: [
        { faire: 'cliquer', sur: "[data-regul='rattrapage']", dit: 'Cliquez sur « Faire rattraper »' },
        { faire: 'attendre', que: '.dialog .rat-pl' },
        { faire: 'expliquer', sur: '.dialog .rat-propose-tete', nom: 'Solvéa propose', quoi: 'des créneaux sans règle enfreinte, sur les quatre prochaines semaines.', sert: '« Laisser Solvéa choisir » reprend la meilleure proposition.' },
        { faire: 'expliquer', sur: '.dialog .rat-carte:not(#rat-sans-date)', nom: 'Un créneau proposé', quoi: 'le jour et l’horaire, la durée, la forme, ce qui le rend intéressant, et s’il faut l’accord de la personne.', facultatif: true },
        { faire: 'expliquer', sur: '#rat-sans-date', nom: 'Sans date précise', quoi: 'les heures s’ajoutent à l’objectif de la prochaine semaine à construire.' },
        { faire: 'expliquer', sur: '#rat-controle', nom: 'Le contrôle', quoi: 'le créneau retenu, contrôlé avec les règles : retenu, ou la raison pour laquelle il ne peut pas l’être.', facultatif: true },
        { faire: 'expliquer', sur: o.parLibelle('Prévenir', '.dialog'), quoi: 'cochée, la personne reçoit un message, en plus de l’annonce sous sa cloche.' },
        { faire: 'expliquer', sur: champ('rat-texte'), nom: 'Ce que la personne recevra', quoi: 'le message préparé par Solvéa ; vous pouvez le réécrire.', sert: '« Revenir au texte proposé » efface vos changements.' },
        { faire: 'expliquer', sur: '#rat-valider', quoi: 'met le planning à jour et envoie le message.' },
        { faire: 'action', jouer: fermer },
      ],
    },
    // ---------------------------------------------------------------- 12. Équité
    {
      chapitre: 'Équité',
      qui: o.HELENE,
      cible: '.content',
      titre: 'La charge est-elle bien répartie ?',
      texte: () => 'L’équité compare chacun à sa part, selon son temps de travail. Jamais de note globale.',
      jouer: () => {
        o.avecPlanning();
        o.helene('equite');
      },
      gestes: [
        { faire: 'expliquer', sur: '.page-head .seg[aria-label="Période"]', nom: 'La période', quoi: 'sur combien de temps on compare : 8 semaines, 12 semaines ou 6 mois.' },
        { faire: 'expliquer', sur: o.nieme('.content .chiffres .chiffre', 0), nom: 'À l’équilibre', quoi: 'le nombre de personnes proches de leur part, tous compteurs confondus.' },
        { faire: 'expliquer', sur: o.nieme('.content .chiffres .chiffre', 1), nom: 'Ont porté plus', quoi: 'qui a porté nettement plus que sa part.' },
        { faire: 'expliquer', sur: o.nieme('.content .chiffres .chiffre', 2), nom: 'Ont porté moins', quoi: 'qui a porté nettement moins que sa part : à solliciter en premier.' },
        { faire: 'expliquer', sur: '.content .jr-filtres', nom: 'Ce qu’on compare', quoi: 'un compteur à la fois : samedis, fermetures, gardes, dépannages, changements tardifs, demandes refusées.' },
        { faire: 'cliquer', sur: o.parTexte('.content .jr-filtre', 'Fermetures'), dit: 'Choisissez « Fermetures en semaine »', sert: 'La liste répond à la question « Qui ferme le soir ? ».' },
        { faire: 'expliquer', sur: '.content section.card .card-head', nom: 'La question', quoi: 'ce que la liste compare, et la période.', sert: 'La barre part du centre : à droite, plus que sa part ; à gauche, moins.' },
      ],
    },
    {
      chapitre: 'Équité',
      qui: o.HELENE,
      cible: '.content',
      titre: 'Le détail d’une ligne, et la fatigue',
      texte: () => 'Chaque ligne s’ouvre sur ce qui est compté et sur le calcul de la part. Dessous, la fatigue de la semaine.',
      jouer: () => {
        o.avecPlanning();
        o.helene('equite');
      },
      gestes: [
        { faire: 'expliquer', sur: '.content .eq-detail > summary', nom: 'Une ligne', quoi: 'la personne, ce qu’elle a fait face à sa part attendue, la barre d’écart et le verdict.' },
        { faire: 'cliquer', sur: '.content .eq-detail > summary', dit: 'Ouvrez une ligne', sert: 'Le détail se déplie.' },
        { faire: 'expliquer', sur: '.content .eq-detail[open] .eq-bloc', nom: 'Ce qui est compté', quoi: 'les dates prises en compte sur la période.' },
        { faire: 'expliquer', sur: () => document.querySelectorAll<HTMLElement>('.content .eq-detail[open] .eq-bloc')[1], nom: 'D’où vient la part attendue', quoi: 'le total de l’équipe, et la part de la personne selon son contrat et ses semaines travaillées.' },
        { faire: 'expliquer', sur: '.content .eq-fatigue', nom: 'Fatigue', quoi: 'les personnes en fatigue modérée ou élevée cette semaine, et pourquoi.', sert: 'À ménager dans le prochain planning.' },
        { faire: 'expliquer', sur: '.content details.eq-plus > summary', nom: 'Comment c’est calculé', quoi: 'la méthode : la part suit le temps de travail et les semaines travaillées ; une indisponibilité reconnue n’est jamais comptée contre la personne.' },
      ],
    },
    // ---------------------------------------------------------------- 13. Statistiques
    {
      chapitre: 'Statistiques',
      qui: o.HELENE,
      cible: '#stats-cles',
      titre: 'Les chiffres clés',
      texte: () => 'L’équipe en chiffres, calculés d’après ce qui est déjà saisi. Ni note, ni classement.',
      jouer: () => {
        o.avecPlanning();
        o.helene('stats');
      },
      gestes: [
        { faire: 'expliquer', sur: '[data-cle="effectif"]', nom: 'Effectif', quoi: 'le nombre de personnes de l’équipe, et les remplaçants habituels à part.' },
        { faire: 'expliquer', sur: '[data-cle="etp"]', nom: 'Temps de travail', quoi: 'les équivalents temps plein, et le nombre de salariés à temps partiel.' },
        { faire: 'expliquer', sur: '[data-cle="competences"]', nom: 'Compétences couvertes', quoi: 'combien de compétences suivies sont détenues, et combien reposent sur une seule personne.' },
        { faire: 'expliquer', sur: '[data-cle="points-forts"]', nom: 'Points forts relevés', quoi: 'le nombre de points forts constatés sur douze mois.' },
        { faire: 'expliquer', sur: '[data-cle="heures"]', nom: 'Heures planifiées', quoi: 'les heures des dernières semaines publiées, face aux contrats.' },
        { faire: 'expliquer', sur: '#stats .ong-barre', nom: 'Les quatre onglets', quoi: 'composition, compétences, points forts, activité : une famille de chiffres à la fois.' },
      ],
    },
    {
      chapitre: 'Statistiques',
      qui: o.HELENE,
      cible: '#stats',
      titre: 'Composition et compétences',
      texte: () => 'Les deux premiers onglets : qui compose l’équipe, et quelles compétences elle couvre.',
      jouer: () => {
        o.avecPlanning();
        o.helene('stats');
      },
      gestes: [
        { faire: 'cliquer', sur: '#stats-onglet-composition', dit: 'Ouvrez l’onglet « Composition »' },
        { faire: 'expliquer', sur: () => document.querySelectorAll<HTMLElement>('#stats-composition .st-colonnes > div')[0], nom: 'Par fonction', quoi: 'l’effectif et les équivalents temps plein de chaque fonction.' },
        { faire: 'expliquer', sur: () => document.querySelectorAll<HTMLElement>('#stats-composition .st-colonnes > div')[1], nom: 'Par contrat', quoi: 'la répartition par type de contrat.' },
        { faire: 'expliquer', sur: '#stats-composition .st-reperes', nom: 'Repères', quoi: 'les temps partiels, l’ancienneté moyenne d’après le jour d’entrée, et les remplaçants habituels.' },
        { faire: 'cliquer', sur: '#stats-onglet-competences', dit: 'Ouvrez l’onglet « Compétences »' },
        { faire: 'expliquer', sur: () => document.querySelectorAll<HTMLElement>('#stats-competences-signal > div')[0], nom: 'Reposent sur une seule personne', quoi: 'les compétences qui se perdent dès que leur seul détenteur est absent.', sert: 'Un clic sur le nom ouvre sa fiche.' },
        { faire: 'expliquer', sur: () => document.querySelectorAll<HTMLElement>('#stats-competences-signal > div')[1], nom: 'Que personne ne détient', quoi: 'les compétences suivies absentes de l’équipe.' },
        { faire: 'expliquer', sur: '#stats-competences-1', nom: 'Une famille de compétences', quoi: 'chaque compétence de la famille, qui la détient, et un signal quand une seule personne la porte.' },
      ],
    },
    {
      chapitre: 'Statistiques',
      qui: o.HELENE,
      cible: '#stats',
      titre: 'Points forts et activité',
      texte: () => 'Les deux derniers onglets : ce qui a été noté de positif, puis l’activité de l’équipe.',
      jouer: () => {
        o.avecPlanning();
        o.helene('stats');
      },
      gestes: [
        { faire: 'cliquer', sur: '#stats-onglet-points-forts', dit: 'Ouvrez l’onglet « Points forts »' },
        { faire: 'expliquer', sur: '#stats-points-forts-totaux', nom: 'Par nature', quoi: 'ponctualité, entraide, volontariat, part des contraintes : combien de personnes chacune concerne, et son critère.' },
        { faire: 'expliquer', sur: '#stats-points-forts-detail', nom: 'Le détail par personne', quoi: 'les points forts de chacun, par ordre alphabétique.', sert: 'Les arrêts, les congés et les absences n’entrent jamais en compte.' },
        { faire: 'cliquer', sur: '#stats-onglet-activite', dit: 'Ouvrez l’onglet « Activité »' },
        { faire: 'expliquer', sur: '#stats-heures', nom: 'Heures planifiées face aux contrats', quoi: 'les heures des dernières semaines publiées, et l’écart avec les contrats.', sert: 'L’accordéon détaille les heures par personne.' },
        { faire: 'expliquer', sur: '#stats-compteurs .st-totaux', nom: 'Sur douze mois', quoi: 'les samedis, fermetures, gardes et dépannages de toute l’équipe.' },
        { faire: 'expliquer', sur: '#stats-compteurs .st-faits', nom: 'Les repères', quoi: 'la période comptée, les gardes à venir et les demandes de remplacement de l’année.' },
        { faire: 'expliquer', sur: '#stats-compteurs-detail', nom: 'Le détail par personne', quoi: 'les mêmes décomptes, personne par personne. Pour la part attendue de chacun, voyez « Équité ».' },
      ],
    },
    // ---------------------------------------------------------------- 14. Journal et paie
    {
      chapitre: 'Journal et paie',
      qui: o.HELENE,
      cible: '.content',
      titre: 'Le journal',
      texte: () => 'Le journal est votre dossier de preuve : tout ce qui a été publié, modifié ou décidé, avec la date et l’heure.',
      jouer: () => {
        o.avecPlanning();
        o.helene('journal');
      },
      gestes: [
        { faire: 'expliquer', sur: '.page-head .seg[aria-label="Vue"]', nom: 'Journal ou Fiche navette', quoi: 'le journal des décisions, ou la fiche navette du mois pour le comptable.' },
        { faire: 'expliquer', sur: o.nieme('.content .chiffres .chiffre', 0), nom: 'Événements enregistrés', quoi: 'le nombre total d’événements du journal.' },
        { faire: 'expliquer', sur: o.nieme('.content .chiffres .chiffre', 1), nom: 'Plannings publiés', quoi: 'le nombre de publications.' },
        { faire: 'expliquer', sur: o.nieme('.content .chiffres .chiffre', 2), nom: 'Changements lus', quoi: 'combien de changements notifiés l’équipe a déjà lus : ce sont les accusés de lecture.' },
        { faire: 'expliquer', sur: '.content .jr-filtres', nom: 'Les filtres', quoi: 'une nature d’événement à la fois : publications, modifications, absences, gardes, corrections, propositions, règles.' },
        { faire: 'expliquer', sur: o.parTexte('.content .jr-barre .btn', 'Exporter le dossier'), quoi: 'exporte le journal, les règles appliquées et les accusés de lecture dans un fichier.', sert: 'À garder en cas de contrôle ou de litige.' },
        { faire: 'expliquer', sur: '.content .jr-jour .jr-date', nom: 'Le jour', quoi: 'les événements sont rangés par jour, du plus récent au plus ancien.' },
        { faire: 'expliquer', sur: '.content article.jr', nom: 'Un événement', quoi: 'l’heure, la nature, le titre et le détail ; selon le cas, les changements avant et après et les accords recueillis.' },
        { faire: 'expliquer', sur: '.content .jr-regles > summary', nom: 'Règles appliquées', quoi: 'un clic déplie les règles contrôlées lors de cette décision.', facultatif: true },
      ],
    },
    {
      chapitre: 'Journal et paie',
      qui: o.HELENE,
      cible: '.content',
      titre: 'La fiche navette',
      texte: () => 'La fiche navette réunit les heures prévues du mois et les variables de paie, à transmettre au cabinet comptable.',
      jouer: () => {
        o.avecPlanning();
        o.helene('journal');
      },
      gestes: [
        { faire: 'cliquer', sur: o.parTexte('.page-head .seg button', 'Fiche navette'), dit: 'Choisissez « Fiche navette »' },
        { faire: 'expliquer', sur: '.content .nv-barre .week-nav', nom: 'Le mois', quoi: 'le mois de la fiche ; les flèches passent au précédent ou au suivant.' },
        { faire: 'expliquer', sur: o.nieme('.content .chiffres .chiffre', 0), nom: 'Salariés', quoi: 'le nombre de salariés sur la fiche ; titulaires et remplaçants facturés n’y figurent pas.' },
        { faire: 'expliquer', sur: o.nieme('.content .chiffres .chiffre', 1), nom: 'Prévues au planning', quoi: 'le total des heures planifiées du mois.' },
        { faire: 'expliquer', sur: o.nieme('.content .chiffres .chiffre', 2), nom: 'En plus des contrats', quoi: 'les heures complémentaires et supplémentaires du mois.' },
        { faire: 'expliquer', sur: o.nieme('.content .chiffres .chiffre', 3), nom: 'D’absence', quoi: 'le total des jours d’absence du mois.' },
        { faire: 'expliquer', sur: '.content .nv-avis', nom: 'Heures prévues, pas pointées', quoi: 'le rappel que la fiche part du planning : à rapprocher des heures réellement faites avant la paie.' },
      ],
    },
    {
      chapitre: 'Journal et paie',
      qui: o.HELENE,
      cible: '.content',
      cibleFin: '.content',
      titre: 'Le tableau de la fiche navette',
      texte: () => 'Une ligne par salarié : ses heures prévues, ce qui dépasse son contrat, ses absences et ses gardes.',
      jouer: () => {
        o.avecPlanning();
        o.helene('journal');
      },
      gestes: [
        { faire: 'cliquer', sur: o.parTexte('.page-head .seg button', 'Fiche navette'), dit: 'Choisissez « Fiche navette »' },
        { faire: 'expliquer', sur: '.content table.nv thead', nom: 'Les colonnes', quoi: 'prévues ; en plus, en heures complémentaires ou supplémentaires à 25 % et 50 % ; absences par nature ; variables de garde.' },
        { faire: 'expliquer', sur: '.content table.nv tbody tr', nom: 'Une ligne', quoi: 'le salarié, sa fonction et son contrat, puis ses chiffres du mois.' },
        { faire: 'expliquer', sur: '.content table.nv tfoot', nom: 'Total du mois', quoi: 'les heures prévues, les heures en plus et les jours d’absence de toute l’équipe.' },
        { faire: 'expliquer', sur: '.content > div > p.tiny.muted', nom: 'La précision', quoi: 'une semaine à cheval sur deux mois compte sur le mois de son lundi pour les heures supplémentaires.', sert: 'À confirmer avec votre cabinet.' },
        { faire: 'expliquer', sur: o.parTexte('.content .nv-barre .btn', 'Exporter pour le comptable'), quoi: 'exporte la fiche du mois en tableau, prêt pour le comptable.' },
        { faire: 'cliquer', sur: o.parTexte('.content .nv-barre .btn', 'Exporter pour le comptable'), dit: 'Cliquez sur « Exporter pour le comptable »', sert: 'Ici, le contenu s’affiche pour être copié.' },
        { faire: 'expliquer', sur: o.parLibelle('Contenu du fichier', '.dialog'), quoi: 'le contenu du fichier, à copier puis à coller dans un fichier ou un tableur, quand la page ne peut pas l’enregistrer elle-même.', facultatif: true },
        { faire: 'expliquer', sur: o.VALIDER, nom: 'Copier le contenu', quoi: 'copie tout le contenu d’un clic.', facultatif: true },
        { faire: 'action', jouer: fermer },
      ],
    },
    // ---------------------------------------------------------------- 15. Documents
    {
      chapitre: 'Documents de la pharmacie',
      qui: o.HELENE,
      cible: '.content .jr-barre',
      cibleFin: '.content',
      titre: 'Les onglets et les plannings publiés',
      texte: () => 'Les documents réunissent les plannings publiés, vos absences, vos fichiers, ceux que l’équipe vous a partagés et l’historique des absences.',
      jouer: () => {
        avecDocuments();
        o.helene('documents');
      },
      gestes: [
        { faire: 'expliquer', sur: o.parTexte('.content .jr-filtres .jr-filtre', 'Plannings publiés'), quoi: 'les semaines publiées, rangées par mois.' },
        { faire: 'expliquer', sur: o.parTexte('.content .jr-filtres .jr-filtre', 'Mes absences'), quoi: 'vos propres absences et arrêts, avec leur état.' },
        { faire: 'expliquer', sur: o.parTexte('.content .jr-filtres .jr-filtre', 'Mes fichiers'), quoi: 'les fichiers que vous déposez.' },
        { faire: 'expliquer', sur: o.parTexte('.content .jr-filtres .jr-filtre', 'Reçus de l’équipe'), quoi: 'les documents que l’équipe a rendus visibles des titulaires.' },
        { faire: 'expliquer', sur: o.parTexte('.content .jr-filtres .jr-filtre', 'Absences de l’équipe'), quoi: 'l’historique de l’équipe : arrêts, congés, formations, remplacements, absences non prévues.' },
        { faire: 'expliquer', sur: '.content .doc-liste .doc', nom: 'Une semaine publiée', quoi: 'ses dates, le nombre de postes publiés, et « terminée » une fois passée.' },
        { faire: 'expliquer', sur: '.content .doc-liste .doc .btn', nom: 'Voir', quoi: 'ouvre cette semaine dans « Construire ».' },
      ],
    },
    {
      chapitre: 'Documents de la pharmacie',
      qui: o.HELENE,
      cible: '.content .jr-barre',
      cibleFin: '.content',
      titre: 'Déposer un fichier',
      texte: () => 'Dans « Mes fichiers », vous rangez une photo ou un PDF. Tout reste sur cet appareil.',
      jouer: () => {
        avecDocuments();
        o.helene('documents');
      },
      gestes: [
        { faire: 'cliquer', sur: o.parTexte('.content .jr-filtres .jr-filtre', 'Mes absences'), dit: 'Ouvrez « Mes absences »' },
        { faire: 'expliquer', sur: '.content .doc-liste .doc, .content .card.empty', nom: 'Mes absences', quoi: 'chaque absence, ses dates, sa durée et son état : acceptée, refusée ou en attente.' },
        { faire: 'cliquer', sur: o.parTexte('.content .jr-filtres .jr-filtre', 'Mes fichiers'), dit: 'Ouvrez « Mes fichiers »' },
        { faire: 'expliquer', sur: o.parLibelle('Nature', '.content'), quoi: 'arrêt de travail, justificatif d’absence, attestation de formation, contrat ou avenant, autre document.' },
        { faire: 'expliquer', sur: o.parLibelle('Choisir un fichier', '.content'), quoi: 'choisit la photo ou le PDF à déposer, 600 Ko au plus.', sert: 'Une photo trop lourde est réduite ; un fichier illisible est signalé.' },
        { faire: 'expliquer', sur: '.content .doc-depot .doc-note', nom: 'Place utilisée', quoi: 'la place prise par les documents sur cet appareil, sur les 3 Mo disponibles.', sert: 'Rien n’est envoyé ailleurs.' },
        { faire: 'expliquer', sur: '.content .doc-liste .doc', nom: 'Un fichier', quoi: 'son nom, sa nature, sa date et son poids.' },
        { faire: 'expliquer', sur: o.parTexte('.content .doc-liste .doc .btn', 'Ouvrir'), quoi: 'ouvre ou télécharge le fichier.' },
        { faire: 'expliquer', sur: '.content .doc-liste .doc [aria-label^="Supprimer"]', nom: 'La corbeille', quoi: 'supprime le fichier de l’appareil.' },
      ],
    },
    {
      chapitre: 'Documents de la pharmacie',
      qui: o.HELENE,
      cible: '.content .jr-barre',
      cibleFin: '.content',
      titre: 'Les documents reçus de l’équipe',
      texte: () => 'Un membre de l’équipe peut rendre un document visible des titulaires : un arrêt, un justificatif.',
      jouer: () => {
        avecDocuments();
        o.helene('documents');
      },
      gestes: [
        { faire: 'cliquer', sur: o.parTexte('.content .jr-filtres .jr-filtre', 'Reçus de l’équipe'), dit: 'Ouvrez « Reçus de l’équipe »' },
        { faire: 'expliquer', sur: '.content .doc-liste .doc-qui', nom: 'La personne', quoi: 'les documents sont rangés par personne.' },
        { faire: 'expliquer', sur: '.content .doc-liste .doc', nom: 'Un document reçu', quoi: 'sa nature, sa date, son poids et la personne qui l’a déposé.', sert: 'Un justificatif n’est visible que des titulaires.' },
        { faire: 'expliquer', sur: o.parTexte('.content .doc-liste .doc .btn', 'Ouvrir'), quoi: 'ouvre ou télécharge le document.' },
      ],
    },
    {
      chapitre: 'Documents de la pharmacie',
      qui: o.HELENE,
      cible: '.content .jr-barre',
      cibleFin: '.content',
      titre: 'L’historique des absences',
      texte: () => 'L’historique de l’équipe, personne par personne : des faits datés, jamais un diagnostic.',
      jouer: () => {
        avecDocuments();
        o.helene('documents');
      },
      gestes: [
        { faire: 'cliquer', sur: o.parTexte('.content .jr-filtres .jr-filtre', 'Absences de l’équipe'), dit: 'Ouvrez « Absences de l’équipe »' },
        { faire: 'expliquer', sur: '.content .fc .card-head', nom: 'Absences de l’équipe', quoi: 'la frise des semaines à venir, une ligne par personne.' },
        { faire: 'expliquer', sur: o.parLibelle('Personne', '.content'), quoi: 'toute l’équipe, ou une seule personne : les chiffres et la liste suivent.' },
        { faire: 'expliquer', sur: '.content .hist-chiffres', nom: 'Sur douze mois', quoi: 'les jours d’arrêt, les jours de congé, les absences non prévues et les pièces conservées.' },
        { faire: 'expliquer', sur: '.content .jr-filtres[aria-label="Nature"]', nom: 'Nature', quoi: 'arrêts, congés, formations, remplacements, absences non prévues : une nature à la fois.' },
        { faire: 'expliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.content .doc-liste .doc')].find((e) => e.querySelector('.pill')), nom: 'Un événement', quoi: 'la personne, la nature, les dates et l’issue : acceptée, refusée ou en attente.' },
        { faire: 'expliquer', sur: o.parLibelle('Joindre', '.content'), quoi: 'conserve un justificatif remis par la personne, rattaché à cet événement.', sert: 'Il n’est visible que des titulaires et de la personne concernée.' },
        { faire: 'expliquer', sur: '.content > div > p.tiny.muted.doc-note', nom: 'La confidentialité', quoi: 'qui voit les justificatifs, et le conseil de les supprimer quand la paie n’en a plus besoin.' },
      ],
    },
    // ---------------------------------------------------------------- 16. Aide
    {
      chapitre: 'Aide',
      qui: o.HELENE,
      cible: '.content .ad-recherche',
      cibleFin: '.content',
      titre: 'Chercher dans l’aide',
      texte: () => 'L’aide répertorie chaque tâche : la réponse en deux lignes, le bouton qui y mène et un tutoriel.',
      jouer: () => {
        o.avecPlanning();
        o.helene('aide');
      },
      gestes: [
        { faire: 'expliquer', sur: '#aide-recherche', nom: 'Chercher dans l’aide', quoi: 'un mot ou deux.', sert: 'La recherche filtre les fiches et le lexique en même temps.', exemple: 'garde' },
        { faire: 'expliquer', sur: '.content .rythme', nom: 'Rythme de la visite', quoi: 'posé, normal ou vif : le temps laissé pour lire pendant les tutoriels.', sert: 'Il se choisit avant d’en lancer un, et se garde d’une fois sur l’autre.' },
        { faire: 'expliquer', sur: o.parTexte('.content .jr-filtres .jr-filtre', 'Comment faire'), quoi: 'les fiches de tâches, rangées par thème.' },
        { faire: 'expliquer', sur: o.parTexte('.content .jr-filtres .jr-filtre', 'Lexique'), quoi: 'le vocabulaire de Solvéa, défini en une phrase.' },
        { faire: 'expliquer', sur: '#aide-themes .ong-barre', nom: 'Les thèmes', quoi: 'un onglet par famille de tâches : au quotidien, préparer, construire et publier, absences, bilan, messages.' },
        { faire: 'expliquer', sur: '.content .ad-fiche', nom: 'Une fiche', quoi: 'la question, la réponse en deux lignes, puis les boutons.' },
        { faire: 'expliquer', sur: o.parTexte('.content .ad-fiche .btn', 'Voir le tutoriel'), quoi: 'rejoue cette tâche sur la pharmacie d’exemple, puis vous ramène ici.', sert: 'Le nombre d’étapes est indiqué.' },
        { faire: 'expliquer', sur: () => [...document.querySelectorAll<HTMLElement>('.content .ad-fiche .ad-actions .btn')].find((e) => !e.textContent?.includes('tutoriel')), nom: 'Le bouton de la fiche', quoi: 'mène droit à l’écran où l’on fait la tâche.' },
      ],
    },
    {
      chapitre: 'Aide',
      qui: o.HELENE,
      cible: '.content .ad-recherche',
      cibleFin: '.content',
      titre: 'Le lexique et le support',
      texte: () => 'Une recherche, le lexique, puis les autres aides : la visite complète, Solvi, et une personne au support.',
      jouer: () => {
        o.avecPlanning();
        o.helene('aide');
      },
      gestes: [
        { faire: 'taper', dans: '#aide-recherche', texte: 'garde', dit: 'Cherchez « garde »', sert: 'Les fiches et le lexique se filtrent ensemble.' },
        { faire: 'expliquer', sur: '[aria-label="Effacer la recherche"]', nom: 'Effacer', quoi: 'vide la recherche : toutes les fiches reviennent.' },
        { faire: 'cliquer', sur: o.parTexte('.content .jr-filtres .jr-filtre', 'Lexique'), dit: 'Ouvrez « Lexique »' },
        { faire: 'expliquer', sur: '.content .lex .lex-terme', nom: 'Un terme', quoi: 'un mot de Solvéa, et ce qu’il veut dire.' },
        { faire: 'expliquer', sur: o.nieme('.content .ad-pied .ad-autre', 0), nom: 'La visite guidée complète', quoi: 'toutes les fonctions, dans l’ordre, sur une pharmacie d’exemple.' },
        { faire: 'expliquer', sur: o.nieme('.content .ad-pied .ad-autre', 1), nom: 'Demander à Solvi', quoi: 'ouvre l’assistant : vous posez votre question avec vos mots, il répond d’après votre planning.' },
        { faire: 'expliquer', sur: '#aide-support', nom: 'Le support', quoi: 'les coordonnées d’une personne qui vous répond, quand ni l’aide ni Solvi ne suffisent.' },
      ],
    },
  ];
}
