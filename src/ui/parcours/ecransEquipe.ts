import type { Etape, Geste, OutilsVisite } from '../Parcours';
import { addDays, dayIndex, mondayOf, todayISO } from '../../domain/time';
import type { DocumentGed, Garde, Notification, Shift } from '../../domain/types';
import { tourDeRole } from '../../engine/appel';
import { decrireShift } from '../../engine/core';
import { proposerRdv } from '../../engine/rdv';
import { peutDemanderRemplacement } from '../../engine/remplacement';
import { posteAPrevenir } from '../../engine/retard';
import type { Vue } from '../../store/ui';
import { useUi } from '../../store/ui';

const NICOLAS = 'Nicolas · préparateur';
const LEA = 'Léa · pharmacienne';
const SARAH = 'Sarah · animatrice';
const MANON = 'Manon · apprentie';
const YANIS = 'Yanis · étudiant';
/** Nicolas, dans les données de l'exemple. */
const MOI = 'p_camille';
const CAROLINE = 'p_helene';

const ACCUEIL = 'Mon accueil';
const PLANNING = 'Mon planning et celui de l’équipe';
const DEMANDES = 'Mes demandes';
const AIDER = 'Aider un collègue';
const SUIVI = 'Mon suivi et mes gardes';
const DOCUMENTS = 'Mes documents';
const MESSAGES = 'Messages et rendez-vous';
const COMPTE = 'Mon compte et mes compétences';

/** Un PDF minuscule : le document d'exemple de Nicolas s'ouvre vraiment. */
const PDF_EXEMPLE = 'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2c+PgplbmRvYmoKdHJhaWxlcgo8PC9Sb290IDEgMCBSPj4KJSVFT0YK';

type Viseur = () => HTMLElement | null | undefined;
const norme = (t: string): string => t.replace(/\s+/g, ' ').trim().toLowerCase();
/** Le texte d'un libellé, sans le champ qu'il contient ni ses précisions. */
const texteDuLibelle = (l: HTMLElement): string => {
  const c = l.cloneNode(true) as HTMLElement;
  c.querySelectorAll('select, input, textarea, small, .soft, .oblig, .sr').forEach((x) => x.remove());
  return norme(c.textContent ?? '');
};
/** Le libellé dont le texte est exactement celui-ci : « De » ou « À » sans viser « Raison de la demande ». */
const exact =
  (texte: string, dans = '.dialog'): Viseur =>
  () => {
    const zone = [...document.querySelectorAll<HTMLElement>(dans)].pop() ?? document.body;
    return [...zone.querySelectorAll<HTMLElement>('label, legend')].find((l) => l.offsetParent !== null && texteDuLibelle(l) === norme(texte));
  };
/** Le champ (liste, saisie) que contient un libellé : c'est lui qu'on remplit. */
const champ =
  (libelle: Viseur): Viseur =>
  () =>
    libelle()?.querySelector<HTMLElement>('select, input, textarea');
/** Le bloc (carte, section) qui contient un élément. */
const autour =
  (selecteur: string, bloc: string): Viseur =>
  () =>
    document.querySelector<HTMLElement>(selecteur)?.closest<HTMLElement>(bloc);
/** Ferme la fenêtre ouverte par l'étape : l'étape suivante repart d'un écran propre. */
const FERMER: Geste = { faire: 'action', jouer: () => document.querySelector<HTMLElement>('.dialog .dialog-fermer')?.click() };
/** Vide un champ comme le ferait l'utilisateur. */
const vider = (selecteur: string): void => {
  const el = document.querySelector<HTMLInputElement>(selecteur);
  if (!el) return;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, '');
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

/**
 * « Écran par écran » : l'espace d'un membre de l'équipe, champ par champ. Un chapitre par écran ; dans chaque étape,
 * Solvi montre chaque champ (geste « expliquer ») : ce qu'on y met, à quoi il sert, avec un exemple quand c'est utile.
 * On suit Nicolas, préparateur ; Léa, pharmacienne, pour les gardes ; Sarah, Manon et Yanis pour ce qui est propre à leur métier.
 */
export function ecransEquipe(o: OutilsVisite): Etape[] {
  o.buts({
    [ACCUEIL]: 'Ce que Nicolas voit en arrivant : son prochain poste, ce qui attend sa réponse, son métier, ses rendez-vous, et la barre du haut.',
    [PLANNING]: 'Son prochain poste, un retard à annoncer, ses semaines, le calendrier du mois, l’impression et le planning de toute l’équipe.',
    [AIDER]: 'Un poste à couvrir ou un collègue qui cherche un remplaçant : se proposer, ou dire non sans se justifier.',
    [SUIVI]: 'Le compteur d’heures, ce qui a été noté, la part des contraintes ; puis les gardes d’une pharmacienne.',
    [DOCUMENTS]: 'Les plannings publiés, les absences, et les fichiers que l’on dépose soi-même.',
    [MESSAGES]: 'Écrire à toute l’équipe ou à une personne, répondre à un rendez-vous, en demander un.',
    [COMPTE]: 'Le profil, les compétences, l’apparence de l’espace et le mot de passe.',
  });
  const ui = (): ReturnType<typeof useUi.getState> => useUi.getState();
  const s = (): ReturnType<OutilsVisite['store']> => o.store();
  const nicolas = (vue: Vue): void => o.voirComme('nicolas.lesyndicaliste', vue);
  /** « Mes demandes », sur l'onglet voulu. */
  const demandes = (onglet: 'souhaits' | 'absences' | 'remplacements'): void => {
    ui().setDemandesOnglet(onglet);
    nicolas('demandes');
  };
  /** La fenêtre « Nouvelle demande », ouverte depuis « Mes demandes ». */
  const nouvelleDemande = (): void => {
    o.avecPlanning();
    demandes('absences');
    ui().agir('demandes', 'demande');
  };

  // ---- Les données dont les étapes ont besoin : posées si elles manquent, sans rien dupliquer.
  /** L'heure qu'il est, comme la compte « Prévenir d'un retard ». */
  const maintenant = (): number => {
    if (s().today !== todayISO()) return 0;
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const sansRetard = (): void => o.poser((d) => ({ ...d, retards: (d.retards ?? []).filter((r) => r.personId !== MOI) }));
  /** Un poste aujourd'hui ou demain : sans lui, « Prévenir d'un retard » n'apparaît pas. */
  const posteProche = (): void => {
    const { data, today } = s();
    if (posteAPrevenir(data, MOI, today, addDays(today, 1), maintenant())) return;
    const modele = data.shifts.find((x) => x.personId === MOI);
    if (!modele) return;
    const demain = addDays(today, 1);
    const poste: Shift = { ...modele, id: 'sh_eq_retard', date: demain, start: 9 * 60, end: 13 * 60, pauseStart: undefined, pauseEnd: undefined, pauses: undefined, origine: 'manuel' };
    o.poser((d) => {
      const lundi = mondayOf(demain);
      const semaine = d.semaines[lundi];
      return {
        ...d,
        shifts: d.shifts.filter((x) => x.id !== poste.id).concat(poste),
        semaines: semaine ? { ...d.semaines, [lundi]: { ...semaine, snapshot: (semaine.snapshot ?? []).filter((x) => x.id !== poste.id).concat(poste) } } : d.semaines,
      };
    });
  };
  /** Un avis de retard déjà donné, pour montrer ce qu'il devient. */
  const avecMonRetard = (): void => {
    sansRetard();
    posteProche();
    const { data, today } = s();
    const poste = posteAPrevenir(data, MOI, today, addDays(today, 1), maintenant());
    if (poste) o.poser((d) => ({ ...d, retards: (d.retards ?? []).concat({ id: 'ret_eq', personId: MOI, date: poste.date, start: poste.start, minutes: 10, motif: 'transport', at: new Date().toISOString() }) }));
  };
  /** Un horaire de Nicolas modifié après publication : la carte « Ce qui a changé » a quelque chose à montrer. */
  const changementALire = (): void => {
    const { data, today } = s();
    const poste = data.shifts.filter((x) => x.personId === MOI && x.date > today && data.semaines[mondayOf(x.date)]?.statut === 'publie').sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)[0];
    if (!poste) return;
    const n: Notification = { id: 'n_eq_changement', personId: MOI, at: new Date().toISOString(), date: poste.date, avant: decrireShift({ ...poste, start: poste.start + 60 }), apres: decrireShift(poste), tardif: dayIndex(poste.date) - dayIndex(today) < 7 };
    o.poser((d) => ({ ...d, notifications: [n, ...d.notifications.filter((x) => x.id !== n.id)] }));
  };
  /** Caroline propose un rendez-vous à Nicolas : il attend sa réponse. */
  const rdvPropose = (): void => {
    const { data, today } = s();
    if ((data.rendezVous ?? []).some((r) => r.de === CAROLINE && r.avec === MOI && r.statut === 'propose' && r.date > today)) return;
    const moment = proposerRdv(data, CAROLINE, MOI, 30, today)[0];
    if (moment) s().demanderRendezVous({ de: CAROLINE, avec: MOI, sujet: 'Entretien annuel', ...moment, note: 'Faisons le point sur votre année.' });
  };
  /** Une absence déjà accordée dans l'équipe : la frise des absences a une ligne à montrer. */
  const absenceDansLEquipe = (): void => {
    const { data, today } = s();
    const debut = mondayOf(today);
    if (data.absences.some((a) => a.statut === 'approuvee' && a.personId !== MOI && a.to >= debut && a.from <= addDays(debut, 69))) return;
    o.poser((d) => ({ ...d, absences: d.absences.concat({ id: 'abs_eq_lea', personId: 'p_lea', from: addDays(debut, 28), to: addDays(debut, 32), type: 'conge', statut: 'approuvee', createdAt: new Date().toISOString() }) }));
  };
  /** Une demande de congé de Nicolas, en attente : son suivi a quelque chose à montrer. */
  const congeEnAttente = (): void => {
    const { data, today } = s();
    if (data.absences.some((a) => a.personId === MOI && a.statut === 'demandee' && a.to >= today)) return;
    const debut = addDays(mondayOf(today), 14);
    o.poser((d) => ({ ...d, absences: d.absences.concat({ id: 'abs_eq_conge', personId: MOI, from: debut, to: addDays(debut, 4), type: 'conge', statut: 'demandee', motif: 'repos', createdAt: new Date().toISOString() }) }));
  };
  /** Un appel à l'équipe auquel Nicolas peut répondre ; sa réponse précédente est oubliée. */
  const appelPourMoi = (): void => {
    const st = s();
    const ouvert = (): boolean => s().data.remplacements.some((r) => r.trouId && r.statut === 'ouverte' && (r.sollicites ?? []).includes(MOI));
    if (!ouvert()) {
      const peut = (d: typeof st.data, poste: Shift): boolean => tourDeRole(d, poste, st.today).some((c) => c.personId === MOI && c.ok);
      const trou = st.data.trous.find((t) => t.statut === 'ouvert' && t.shift.date >= st.today && peut(st.data, t.shift));
      if (trou) st.appelerEquipe(trou.id);
      // Sinon, un collègue est absent dans les prochains jours, sur un poste que Nicolas peut tenir.
      for (let j = 1; j <= 20 && !trou && !ouvert(); j++) {
        const date = addDays(st.today, j);
        if (st.data.semaines[mondayOf(date)]?.statut !== 'publie') continue;
        for (const q of st.data.personnes.filter((x) => !x.externe && x.id !== MOI && x.id !== CAROLINE)) {
          const poste = st.data.shifts.find((x) => x.personId === q.id && x.date === date);
          if (!poste || !peut({ ...st.data, shifts: st.data.shifts.filter((x) => x !== poste) }, poste)) continue;
          st.declarerAbsence({ personId: q.id, from: date, to: date, type: 'maladie', statut: 'approuvee' });
          const libre = s().data.trous.find((t) => t.shift.id === poste.id && t.statut === 'ouvert');
          if (libre) s().appelerEquipe(libre.id);
          break;
        }
      }
    }
    o.poser((d) => ({ ...d, remplacements: d.remplacements.map((r) => (r.trouId && r.statut === 'ouverte' && (r.sollicites ?? []).includes(MOI) ? { ...r, volontaires: r.volontaires.filter((x) => x !== MOI), indisponibles: (r.indisponibles ?? []).filter((x) => x !== MOI) } : r)) }));
  };
  /** Un préparateur demande à Nicolas, à lui seul, de reprendre un de ses postes. */
  const demandePourMoi = (): void => {
    const st = s();
    if (!st.data.remplacements.some((r) => r.statut === 'ouverte' && r.destinataire === MOI && r.date >= st.today)) {
      const miens = st.data.shifts.filter((x) => x.personId === MOI);
      const libre = (x: Shift): boolean => !miens.some((m) => m.date === x.date && m.start < x.end && x.start < m.end);
      const preparateur = (id: string): boolean => st.data.personnes.find((p) => p.id === id)?.qualification === 'preparateur';
      const poste = st.data.shifts
        .filter((x) => x.personId !== MOI && preparateur(x.personId) && peutDemanderRemplacement(st.data, x.date, st.today) && st.data.semaines[mondayOf(x.date)]?.statut === 'publie' && libre(x))
        .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)[0];
      if (poste) st.demanderRemplacement(poste, 'prevu', undefined, MOI, { motif: 'famille' });
    }
    o.poser((d) => ({ ...d, remplacements: d.remplacements.map((r) => (r.statut === 'ouverte' && r.destinataire === MOI ? { ...r, volontaires: r.volontaires.filter((x) => x !== MOI), indisponibles: (r.indisponibles ?? []).filter((x) => x !== MOI) } : r)) }));
  };
  /** Les gardes de Léa : une à venir, une passée où déclarer ses interventions. */
  const gardesDeLea = (): void => {
    const { today } = s();
    const communique = new Date(`${addDays(today, -30)}T10:00:00`).toISOString();
    o.poser((d) => {
      const autres = d.gardes.filter((g) => g.id !== 'g_eq_passee' && g.id !== 'g_eq_avenir');
      const passee: Garde = { id: 'g_eq_passee', date: addDays(today, -4), start: 20 * 60, end: 8 * 60, type: 'astreinte', personId: 'p_lea', communiqueLe: communique, interventions: [{ id: 'i_eq_1', offset: 150, duree: 25 }] };
      const avenir: Garde[] = autres.some((g) => g.personId === 'p_lea' && g.date >= today) ? [] : [{ id: 'g_eq_avenir', date: addDays(o.semaineDans(3), 5), start: 19 * 60 + 30, end: 8 * 60 + 30, type: 'volets_fermes', personId: 'p_lea', communiqueLe: communique, interventions: [] }];
      return { ...d, gardes: [...autres, passee, ...avenir].sort((a, b) => a.date.localeCompare(b.date)) };
    });
  };
  /** Un fichier déjà déposé par Nicolas : sa ligne a des boutons à montrer. */
  const monDocument = (): void => {
    const doc: DocumentGed = { id: 'doc_eq', personId: MOI, nom: 'attestation-orthopedie.pdf', type: 'application/pdf', taille: 48 * 1024, data: PDF_EXEMPLE, categorie: 'formation', at: new Date().toISOString(), partage: true };
    o.poser((d) => ((d.documents ?? []).some((x) => x.id === doc.id) ? d : { ...d, documents: (d.documents ?? []).concat(doc) }));
  };

  // Les dates d'exemple saisies dans la fenêtre d'une absence : dans trois semaines, sur trois jours.
  const premierJour = addDays(s().today, 21);
  const dernierJour = addDays(premierJour, 2);
  /** Le bouton d'un poste « prévu » à faire reprendre ; à défaut, le premier possible. */
  const posteAConfier: Viseur = () =>
    document.querySelector<HTMLElement>("[data-focus='remplacer'] .dm-groupe.info ~ .dm:not(.actif) .btn:not([disabled])") ?? document.querySelector<HTMLElement>("[data-focus='remplacer'] .dm:not(.actif) .btn:not([disabled])");
  /** La carte d'une garde, sous son titre (« À venir » ou « Passées »). */
  const carteGarde =
    (titre: string): Viseur =>
    () =>
      document.getElementById(titre)?.parentElement?.querySelector<HTMLElement>('article.card');
  const dansGarde = (titre: string, selecteur: string): Viseur => () => carteGarde(titre)()?.querySelector<HTMLElement>(selecteur);

  return [
    // ---------------------------------------------------------------- Mon accueil
    {
      chapitre: ACCUEIL,
      qui: NICOLAS,
      cible: '.page-espace',
      titre: 'L’essentiel, en arrivant',
      texte: () => 'L’accueil d’un membre de l’équipe tient sur un écran : ce qui l’attend, son prochain poste, puis son métier et ses rendez-vous.',
      jouer: () => {
        o.avecPlanning();
        rdvPropose();
        sansRetard();
        posteProche();
        nicolas('espace');
      },
      gestes: [
        { faire: 'expliquer', sur: '.page-espace .tb-banniere', nom: 'La bannière', quoi: 'votre nom, votre métier, la pharmacie et la date du jour, avec ce qui vous attend en une phrase.', sert: 'Elle dit d’emblée si un rendez-vous attend votre réponse, ou combien d’heures sont planifiées cette semaine face à votre contrat.' },
        { faire: 'expliquer', sur: '.page-espace .esp-phrase', nom: 'La phrase du profil', quoi: 'ce à quoi sert votre espace, selon votre métier.', sert: 'Un préparateur, une animatrice ou une apprentie n’ont pas tout à fait le même accueil.' },
        { faire: 'expliquer', sur: "[data-focus='priorite']", nom: 'À faire en premier', quoi: 'ce qui attend votre réponse : un collègue à dépanner, un rendez-vous proposé, ou un changement de planning à lire.', sert: 'Le bouton mène droit à l’écran où vous répondez. Quand rien n’attend, le bloc disparaît.', facultatif: true },
        { faire: 'expliquer', sur: '.page-espace .prochain', nom: 'Prochain poste', quoi: 'le jour et les heures de votre prochain poste publié, sa durée de travail et ses pauses, puis le suivant.', sert: 'Seul le planning publié s’affiche, jamais un brouillon. Un poste d’aujourd’hui déjà terminé laisse la place au suivant.' },
        { faire: 'expliquer', sur: '.page-espace #ret-prevenir', nom: 'Prévenir d’un retard', quoi: 'un raccourci pour annoncer que vous arriverez en retard à ce poste.', sert: 'Il n’apparaît que pour un poste d’aujourd’hui ou de demain. Sa fenêtre est détaillée dans le chapitre suivant.', facultatif: true },
      ],
    },
    {
      chapitre: ACCUEIL,
      qui: NICOLAS,
      cible: '.page-espace .esp-grille',
      titre: 'Mon métier, mes rendez-vous',
      texte: () => 'Sous le prochain poste : ce qui est propre au métier, l’agenda des rendez-vous et trois raccourcis.',
      jouer: () => {
        o.avecPlanning();
        rdvPropose();
        nicolas('espace');
      },
      gestes: [
        { faire: 'expliquer', sur: "[data-focus='mon-metier']", nom: 'Mes compétences et mes postes', quoi: 'les compétences notées sur votre fiche, puis vos quatre prochains postes publiés.', sert: 'Ce bloc change avec le métier : les marques d’une animatrice, les jours d’école d’une apprentie, les cours d’un étudiant.' },
        { faire: 'expliquer', sur: o.parTexte("[data-focus='mon-metier'] button", 'Parler d’une formation'), nom: 'Parler d’une formation', quoi: 'une demande de rendez-vous avec votre titulaire, au sujet « Formation ou compétence ».', sert: 'La fenêtre du rendez-vous s’ouvre, sujet déjà choisi. Elle est détaillée dans le chapitre « Messages et rendez-vous ».' },
        { faire: 'expliquer', sur: "[data-focus='mes-rdv']", nom: 'Mes rendez-vous', quoi: 'vos rendez-vous à venir, fixés ou en attente de réponse, avec leur sujet et la personne.', sert: 'Un clic sur une ligne ouvre la conversation où le rendez-vous s’accepte, se déplace ou s’annule.' },
        { faire: 'expliquer', sur: '#esp-rdv-demander', nom: 'Demander un rendez-vous', quoi: 'une demande de point avec votre titulaire ou un collègue.', sert: 'Solvéa propose des moments où vous êtes tous les deux en poste.' },
        { faire: 'expliquer', sur: o.parTexte('.esp-raccourcis button', 'Voir mon planning'), nom: 'Voir mon planning', quoi: 'le lien vers vos semaines publiées.', sert: 'Le même écran que « Mon planning », dans le menu.' },
        { faire: 'expliquer', sur: o.parTexte('.esp-raccourcis button', 'Demander une absence'), nom: 'Demander une absence ou un horaire', quoi: 'le lien vers « Mes demandes ».', sert: 'Pour un congé, une formation ou un horaire à tenir : votre titulaire y répond.' },
        { faire: 'expliquer', sur: o.parTexte('.esp-raccourcis button', 'Écrire à'), nom: 'Écrire à votre titulaire', quoi: 'la conversation privée avec votre titulaire principal.', sert: 'Pour une question rapide. Une absence ou un horaire passent plutôt par une demande : elle est suivie.' },
        { faire: 'expliquer', sur: autour('#esp-annonces', 'section'), nom: 'Décisions qui me concernent', quoi: 'les dernières décisions de vos titulaires qui vous touchent, avec ce qu’elles changent à votre planning.', sert: 'Le bouton « Vu » les marque comme lues ; elles restent sous la cloche, en haut de l’écran.', facultatif: true },
      ],
    },
    {
      chapitre: ACCUEIL,
      qui: SARAH,
      cible: "[data-focus='mon-metier']",
      titre: 'L’accueil d’une animatrice',
      texte: () => 'Sarah, animatrice, voit d’abord les marques qu’elle présente et ses prochains jours d’animation.',
      jouer: () => {
        o.avecPlanning();
        o.voirComme('sarah.lemoine', 'espace');
      },
      gestes: [
        { faire: 'expliquer', sur: '.esp-marques', nom: 'Les marques que je présente', quoi: 'les marques que votre titulaire vous a confiées, avec leurs familles de produits.', sert: 'C’est votre titulaire qui les choisit, dans votre fiche. Elles vous servent de repère avant chaque journée d’animation.' },
        { faire: 'expliquer', sur: '.esp-marques .mqc-types', nom: 'Familles de produits', quoi: 'les familles d’une marque : dermocosmétique, solaire, bébé, compléments…', sert: 'Un pictogramme par famille, pour reconnaître la marque d’un coup d’œil.', facultatif: true },
        { faire: 'expliquer', sur: o.parTexte('.esp-sous', 'Mes prochains jours d’animation'), nom: 'Mes prochains jours d’animation', quoi: 'vos quatre prochains jours à la pharmacie, avec leurs horaires.', sert: 'Seuls les plannings publiés comptent.', facultatif: true },
        { faire: 'expliquer', sur: o.parTexte("[data-focus='mon-metier'] button", 'bilan d’animation'), nom: 'Demander un bilan d’animation', quoi: 'une demande de rendez-vous avec votre titulaire, au sujet « Bilan d’animation ».', sert: 'Pour faire le point sur une animation et sur les marques à présenter ensuite.' },
      ],
    },
    {
      chapitre: ACCUEIL,
      qui: MANON,
      cible: "[data-focus='mon-metier']",
      titre: 'L’accueil d’une apprentie',
      texte: () => 'Manon, apprentie, retrouve son alternance : ses jours d’école, ses jours à la pharmacie et le point avec son tuteur.',
      jouer: () => {
        o.avecPlanning();
        o.voirComme('manon.girard', 'espace');
      },
      gestes: [
        { faire: 'expliquer', sur: o.parTexte('.esp-sous', 'Jours d’école signalés'), nom: 'Jours d’école signalés', quoi: 'vos jours d’école, une fois reconnus par votre titulaire.', sert: 'Ils sont pris en compte dans le planning : aucun poste ne vous est donné ces jours-là.' },
        { faire: 'expliquer', sur: o.parTexte("[data-focus='mon-metier'] button", 'Signaler mes jours d’école'), nom: 'Signaler mes jours d’école', quoi: 'la fenêtre d’une nouvelle demande, pour déclarer vos jours d’école.', sert: 'Choisissez « Ne pas travailler certains jours », touchez les jours, et la raison « Études, formation ». Votre titulaire répond.' },
        { faire: 'expliquer', sur: o.parTexte('.esp-sous', 'Mes prochains jours en officine'), nom: 'Mes prochains jours en officine', quoi: 'vos quatre prochains jours à la pharmacie, avec leurs horaires.', facultatif: true },
        { faire: 'expliquer', sur: o.parTexte("[data-focus='mon-metier'] button", 'point avec mon tuteur'), nom: 'Demander un point avec mon tuteur', quoi: 'une demande de rendez-vous, au sujet « Point avec mon tuteur ».', sert: 'Choisissez votre tuteur dans « Avec » : la fenêtre propose des moments où vous êtes tous les deux en poste.' },
      ],
    },
    {
      chapitre: ACCUEIL,
      qui: YANIS,
      cible: "[data-focus='mon-metier']",
      titre: 'L’accueil d’un étudiant',
      texte: () => 'Yanis, étudiant, organise ses horaires autour de ses cours et de ses examens.',
      jouer: () => {
        o.avecPlanning();
        o.voirComme('yanis.morel', 'espace');
      },
      gestes: [
        { faire: 'expliquer', sur: o.parTexte('.esp-sous', 'Cours et examens signalés'), nom: 'Cours et examens signalés', quoi: 'les jours de cours ou d’examen déjà reconnus par votre titulaire.', sert: 'Le planning vous laisse libre ces jours-là.' },
        { faire: 'expliquer', sur: o.parTexte("[data-focus='mon-metier'] button", 'Signaler un cours'), nom: 'Signaler un cours ou un examen', quoi: 'la fenêtre d’une nouvelle demande.', sert: 'Pour un examen, choisissez « Un jour précis » ; pour des cours chaque semaine, « Ne pas travailler certains jours ». Votre titulaire répond.' },
        { faire: 'expliquer', sur: o.parTexte('.esp-sous', 'Mes prochains postes'), nom: 'Mes prochains postes', quoi: 'vos quatre prochains postes publiés, avec leurs horaires.', facultatif: true },
      ],
    },
    {
      chapitre: ACCUEIL,
      qui: NICOLAS,
      cible: '.topbar-in',
      titre: 'Toujours à portée',
      texte: () => 'La barre du haut et le menu restent les mêmes sur tous les écrans.',
      jouer: () => {
        o.avecPlanning();
        nicolas('espace');
      },
      gestes: [
        { faire: 'expliquer', sur: '.top-creer', nom: 'Faire une demande', quoi: 'la fenêtre d’une nouvelle demande, depuis n’importe quel écran.', sert: 'Un congé, une formation, un horaire à tenir : la demande part à votre titulaire.' },
        { faire: 'expliquer', sur: '#top-signaler', nom: 'Retard ou absence', quoi: 'pour annoncer un retard ou une absence imprévue, depuis n’importe quel écran.', sert: 'Vos titulaires sont prévenus aussitôt. La fenêtre est détaillée juste après.' },
        { faire: 'expliquer', sur: ".topbar-in .top-ico[aria-haspopup='true']", nom: 'La cloche', quoi: 'ce qui vous attend : un collègue à aider, un rendez-vous, un changement de planning, une décision qui vous concerne.', sert: 'Le chiffre compte ce qui reste à voir ; un clic sur une ligne y mène.' },
        { faire: 'expliquer', sur: ".topbar-in .top-ico[aria-label^='Messages']", nom: 'Messages', quoi: 'la messagerie, avec le nombre de messages non lus.' },
        { faire: 'expliquer', sur: ".topbar-in [data-tour='aide']", nom: 'Aide et tutoriels', quoi: 'les guides pas à pas, le lexique et les visites comme celle-ci.' },
        { faire: 'expliquer', sur: '.topbar-in .compte-btn', nom: 'Mon compte', quoi: 'le menu de votre compte : vos réglages et la déconnexion.', sert: 'Le compte est détaillé dans le dernier chapitre.' },
        { faire: 'expliquer', sur: '.side', nom: 'Le menu', quoi: 'les écrans de votre espace : accueil, planning, demandes, suivi, documents, planning de l’équipe, messages, aide.', sert: 'Un chiffre à côté d’un écran signale ce qui reste à lire.' },
      ],
    },
    {
      chapitre: ACCUEIL,
      qui: NICOLAS,
      cible: '.page-espace',
      titre: 'Signaler un retard ou une absence',
      texte: () => 'Le bouton « Retard ou absence » ouvre une fenêtre en deux temps : ce qui se passe, puis quand et pourquoi.',
      jouer: () => {
        o.avecPlanning();
        nicolas('espace');
      },
      gestes: [
        { faire: 'cliquer', sur: '#top-signaler', dit: 'Cliquez sur « Retard ou absence », en haut', sert: 'La fenêtre s’ouvre au-dessus de l’écran où vous êtes.' },
        { faire: 'attendre', que: '.dialog .fo-choix' },
        { faire: 'expliquer', sur: o.parLibelle('Que se passe-t-il', '.dialog'), nom: 'Que se passe-t-il ?', quoi: 'un retard (vous viendrez, plus tard) ou une absence (vous ne viendrez pas).', sert: 'La suite de la fenêtre s’adapte à votre choix.' },
        { faire: 'cliquer', sur: "label[for='sg-retard']", dit: 'Choisissez « Un retard »', sert: 'Les durées s’affichent, avec le poste concerné.' },
        { faire: 'expliquer', sur: o.parLibelle('De combien', '.dialog'), nom: 'De combien ?', quoi: '5, 10 ou 15 minutes d’un geste, ou « + de 20 min » pour saisir la durée.', sert: 'L’heure d’arrivée se calcule pour votre poste d’aujourd’hui ou de demain. Sans poste publié, l’avis part quand même, sans heure.' },
        { faire: 'cliquer', sur: "label[for='sg-absence']", dit: 'Choisissez maintenant « Une absence »', sert: 'Les dates et la raison remplacent les durées.' },
        { faire: 'expliquer', sur: exact('À partir du'), quoi: 'le premier jour où vous ne pourrez pas venir.', sert: 'Aujourd’hui par défaut ; une date passée n’est pas possible.' },
        { faire: 'expliquer', sur: exact('Jusqu’au'), quoi: 'le dernier jour d’absence prévu.', sert: 'Le nombre de vos postes sur ces dates s’affiche dessous : vos titulaires décideront comment les couvrir.' },
        { faire: 'expliquer', sur: '#sg-raisons', nom: 'La raison', quoi: 'maladie, accident du travail ou autre raison.', sert: 'Un accident du travail ajoute quelques questions : sa déclaration a un délai légal.' },
        { faire: 'expliquer', sur: autour('#sg-note', 'label'), nom: 'Un mot', quoi: 'quelques mots pour vos titulaires, si vous le voulez.', sert: 'Facultatif ; ils les lisent avec la notification.', exemple: 'Je vous tiens au courant demain' },
        FERMER,
      ],
    },
    {
      chapitre: ACCUEIL,
      qui: NICOLAS,
      cible: '.dialog',
      titre: 'Un accident du travail',
      texte: () => 'Choisir « Accident du travail » ajoute les faits utiles à la déclaration, et la suite à donner.',
      jouer: () => {
        o.avecPlanning();
        nicolas('espace');
        ui().signaler('absence');
      },
      gestes: [
        { faire: 'attendre', que: '#sg-raisons' },
        { faire: 'cliquer', sur: o.parTexte('#sg-raisons .comp', 'Accident du travail'), dit: 'Touchez « Accident du travail »', sert: 'Le bloc « L’accident » s’ajoute : ces faits servent à la déclaration.' },
        { faire: 'expliquer', sur: '#sg-ou', nom: 'Où est-ce arrivé ?', quoi: 'à la pharmacie, en mission à l’extérieur, ou sur le trajet.', sert: 'Le lieu est repris dans la déclaration.' },
        { faire: 'expliquer', sur: exact('Le jour de l’accident'), quoi: 'la date de l’accident : aujourd’hui, ou un jour passé.', exemple: 'aujourd’hui' },
        { faire: 'expliquer', sur: o.parLibelle('Vers quelle heure', '.dialog'), nom: 'Vers quelle heure', quoi: 'l’heure de l’accident, si vous la connaissez.', sert: 'Facultatif ; elle complète la déclaration.', exemple: '10 h 15' },
        { faire: 'expliquer', sur: o.parLibelle('Ce qui s’est passé', '.dialog'), nom: 'Ce qui s’est passé', quoi: 'les circonstances, en quelques mots : ce que vous faisiez, ce qui est arrivé.', sert: 'Notés tant qu’ils sont frais, ces faits servent à la déclaration.', exemple: 'Chute dans la réserve en rangeant une livraison' },
        { faire: 'expliquer', sur: o.parLibelle('Un témoin', '.dialog'), nom: 'Un témoin', quoi: 'la personne qui a vu l’accident, ou la première que vous avez prévenue.', sert: 'Facultatif.' },
        { faire: 'expliquer', sur: '#sg-acc-suite', nom: 'La suite, dans l’ordre', quoi: 'le certificat du médecin, la déclaration par votre employeur sous 48 heures, puis la feuille d’accident.', sert: 'La date limite de la déclaration y est écrite. Elle se fait auprès de la caisse d’assurance maladie.' },
        { faire: 'expliquer', sur: '#sg-confirmer', nom: 'Prévenir les titulaires', quoi: 'l’envoi de votre signalement.', sert: 'Vos titulaires reçoivent une notification et un message, puis décident comment couvrir vos postes.' },
        FERMER,
      ],
    },

    // ---------------------------------------------------------------- Mon planning et celui de l'équipe
    {
      chapitre: PLANNING,
      qui: NICOLAS,
      cible: '.me .page-head',
      cibleFin: '.me',
      titre: 'Le haut de « Mon planning »',
      texte: () => '« Mon planning » répond à une question : quand est-ce que je travaille ? En haut, les actions et le prochain poste.',
      jouer: () => {
        o.avecPlanning();
        sansRetard();
        posteProche();
        changementALire();
        nicolas('moi');
      },
      gestes: [
        { faire: 'expliquer', sur: o.parTexte('.mp-actions button', 'Faire une demande'), nom: 'Faire une demande', quoi: 'la fenêtre d’une nouvelle demande : un congé, une formation, un horaire à tenir.', sert: 'La même que dans « Mes demandes » ; votre titulaire y répond.' },
        { faire: 'expliquer', sur: '#moi-imprimer', nom: 'Imprimer', quoi: 'l’aperçu de votre semaine sur papier.', sert: 'Il est détaillé plus loin dans ce chapitre.' },
        { faire: 'expliquer', sur: o.parTexte('.mp-actions button', 'Planning de l’équipe'), nom: 'Planning de l’équipe', quoi: 'le planning publié de toute l’équipe, en lecture seule.', sert: 'Pour savoir qui travaille avec vous, un jour donné.' },
        { faire: 'expliquer', sur: '.mp-actions .pill', nom: 'Changements à lire', quoi: 'le nombre de vos horaires modifiés que vous n’avez pas encore lus.', sert: 'Le détail est plus bas, dans « Ce qui a changé ».', facultatif: true },
        { faire: 'expliquer', sur: '.mp-prochain .prochain', nom: 'Prochain poste', quoi: 'votre prochain poste publié : le jour, les heures, la durée de travail et les pauses.', sert: 'Le bouton « Prévenir d’un retard » est dessous, pour un poste d’aujourd’hui ou de demain.' },
        { faire: 'expliquer', sur: "[data-focus='changements']", nom: 'Ce qui a changé', quoi: 'chaque horaire modifié ces sept derniers jours, avec l’avant et l’après.', sert: 'Un changement fait moins de sept jours avant la date porte la mention « prévenu moins de 7 jours avant ».', facultatif: true },
        { faire: 'cliquer', sur: o.parTexte("[data-focus='changements'] button", 'vu ce changement'), dit: 'Cliquez sur « J’ai vu ce changement »', sert: 'Le changement est noté comme lu : la date de lecture remplace le bouton.', facultatif: true },
      ],
    },
    {
      chapitre: PLANNING,
      qui: NICOLAS,
      cible: '.mp-prochain',
      cibleFin: '.mp-prochain',
      titre: 'Prévenir d’un retard',
      texte: () => 'Un imprévu sur la route : la durée, puis l’envoi. Le reste de la fenêtre est facultatif.',
      jouer: () => {
        o.avecPlanning();
        sansRetard();
        posteProche();
        nicolas('moi');
      },
      gestes: [
        { faire: 'cliquer', sur: '.mp-prochain #ret-prevenir', sert: 'La fenêtre porte sur votre poste d’aujourd’hui, ou de demain s’il n’y en a plus aujourd’hui.' },
        { faire: 'attendre', que: '.dialog #ret-durees' },
        { faire: 'expliquer', sur: o.parLibelle('De combien serez-vous en retard', '.dialog'), nom: 'De combien serez-vous en retard ?', quoi: '5, 10 ou 15 minutes, d’un geste. 10 minutes sont choisies d’avance.', sert: 'L’heure d’arrivée prévue se recalcule aussitôt, juste en dessous.' },
        { faire: 'cliquer', sur: o.parTexte('#ret-durees .comp', '+ de 20 min'), dit: 'Touchez « + de 20 min »', sert: 'Un champ s’ouvre pour une durée plus longue.' },
        { faire: 'expliquer', sur: o.parLibelle('Durée en minutes', '.dialog'), quoi: 'la durée du retard, de 20 minutes à 4 heures, par pas de 5.', exemple: '35' },
        { faire: 'expliquer', sur: '#ret-arrivee', nom: 'Arrivée prévue', quoi: 'l’heure à laquelle vous arriverez, d’après la durée choisie.', sert: 'C’est elle que reçoivent vos titulaires.' },
        { faire: 'expliquer', sur: '#ret-motifs', nom: 'Pourquoi ?', quoi: 'transport, santé, famille ou autre raison, si vous voulez la donner.', sert: 'Facultatif : un second toucher retire le choix. Seuls les titulaires voient la raison.' },
        { faire: 'expliquer', sur: o.parLibelle('Un mot pour les titulaires', '.dialog'), nom: 'Un mot pour les titulaires', quoi: 'une précision libre, en 140 caractères au plus.', sert: 'Facultatif ; elle accompagne la notification.', exemple: 'Train supprimé, je prends le suivant' },
        { faire: 'expliquer', sur: '.dialog .ret-qui', nom: 'Qui est prévenu', quoi: 'vos titulaires, et ce qu’ils reçoivent : une notification et un message.', sert: 'Si votre retard laisse le comptoir sans personne, ou sans pharmacien, la fenêtre le dit, et ils en sont avertis.' },
        { faire: 'cliquer', sur: '#ret-envoyer', sert: 'Les titulaires sont prévenus. L’avis reste affiché sous votre prochain poste.' },
      ],
    },
    {
      chapitre: PLANNING,
      qui: NICOLAS,
      cible: '.mp-prochain',
      titre: 'L’avis de retard, ensuite',
      texte: () => 'Une fois envoyé, l’avis reste sous le prochain poste. Il se corrige ou s’annule.',
      jouer: () => {
        o.avecPlanning();
        avecMonRetard();
        nicolas('moi');
      },
      gestes: [
        { faire: 'expliquer', sur: '.mp-prochain .ret-etat', nom: 'Retard annoncé', quoi: 'la durée annoncée et l’heure d’arrivée prévue.', sert: 'Sur la frise du jour de vos titulaires, l’étiquette « Retard » apparaît sous votre nom.' },
        { faire: 'expliquer', sur: '#ret-modifier', nom: 'Modifier', quoi: 'la fenêtre « Modifier mon avis de retard », avec ce que vous aviez saisi.', sert: 'Vos titulaires reçoivent la nouvelle heure d’arrivée.' },
        { faire: 'cliquer', sur: '#ret-annuler', dit: 'Cliquez sur « Je serai à l’heure »', sert: 'L’avis est annulé, et vos titulaires en sont prévenus.' },
      ],
    },
    {
      chapitre: PLANNING,
      qui: NICOLAS,
      cible: '.me-grid',
      titre: 'Mes semaines',
      texte: () => 'Cette semaine et la suivante, jour par jour : horaires, pauses, durée de travail.',
      jouer: () => {
        o.avecPlanning();
        nicolas('moi');
        ui().setIntention('semaine');
      },
      gestes: [
        { faire: 'expliquer', sur: '.me-grid .seg', nom: 'Semaine ou Calendrier', quoi: 'deux façons de lire vos horaires : semaine par semaine, ou le mois entier.', sert: 'Le calendrier est montré à l’étape suivante.' },
        { faire: 'expliquer', sur: '.me-grid .card .card-head', nom: 'Cette semaine', quoi: 'la semaine en cours, son numéro et sa date de publication.', sert: 'Une semaine encore en préparation reste vide : vous êtes prévenu dès sa publication.' },
        { faire: 'expliquer', sur: '.me-grid .card .jh-bilan', nom: 'Heures prévues et jours', quoi: 'le total de vos heures de travail et le nombre de jours travaillés.', sert: 'Les pauses déjeuner ne comptent pas, ni un jour d’absence acceptée.' },
        { faire: 'expliquer', sur: '.me-grid .jour-h:not(.t-repos)', nom: 'Un jour travaillé', quoi: 'le moment de la journée, les horaires, la durée de travail et les pauses.', sert: 'La frise dessine le poste de 7 h à 21 h, la pause en creux. Une garde ou un rendez-vous s’y ajoutent en pastille.' },
        { faire: 'expliquer', sur: '.me-grid .jour-h.t-repos', nom: 'Un jour sans poste', quoi: 'un repos, un jour férié, ou une absence acceptée.', facultatif: true },
        { faire: 'expliquer', sur: o.nieme('.me-grid .card', 1), nom: 'Semaine prochaine', quoi: 'la semaine suivante, de la même façon.', sert: 'Au-delà, le calendrier du mois prend le relais.' },
        { faire: 'cliquer', sur: '.me-grid .lien-jour', dit: 'Cliquez sur une date', sert: 'La journée s’ouvre : toute l’équipe de ce jour-là, sur une ligne de temps.' },
        { faire: 'attendre', que: '.dialog' },
        { faire: 'pause', ms: 2600, dit: 'Chaque ligne montre un collègue en poste ce jour-là', sert: 'Vous savez avec qui vous travaillez. Seul le planning publié s’y lit.' },
        FERMER,
      ],
    },
    {
      chapitre: PLANNING,
      qui: NICOLAS,
      cible: '.me-grid',
      cibleFin: '.me-grid',
      titre: 'Le calendrier du mois',
      texte: () => 'Le calendrier montre le mois entier, une case par jour, avec les mêmes couleurs que partout ailleurs.',
      jouer: () => {
        o.avecPlanning();
        nicolas('moi');
        ui().setIntention('semaine');
      },
      gestes: [
        { faire: 'cliquer', sur: o.parTexte('.me-grid .seg button', 'Calendrier'), dit: 'Cliquez sur « Calendrier »', sert: 'Le mois entier s’affiche.' },
        { faire: 'expliquer', sur: () => document.querySelector('.me-grid table.cal')?.closest('.card')?.querySelector<HTMLElement>('.card-head .grow'), nom: 'Le mois', quoi: 'le nom du mois, vos jours travaillés et vos heures prévues.', sert: 'Seules les semaines publiées comptent.' },
        { faire: 'cliquer', sur: ".me-grid [aria-label='Mois suivant']", dit: 'Cliquez sur la flèche du mois suivant', sert: 'Le mois suivant s’affiche ; une semaine encore à publier reste sans horaires.' },
        { faire: 'cliquer', sur: o.parTexte('.me-grid .card-head button', 'Aujourd’hui'), dit: 'Cliquez sur « Aujourd’hui »', sert: 'Retour au mois en cours. Le bouton est grisé quand vous y êtes.' },
        { faire: 'expliquer', sur: '.me-grid .cal .cal-poste', nom: 'Un poste', quoi: 'le moment de la journée, les horaires et la durée de travail.', sert: 'Une garde, une absence ou un rendez-vous ont leur propre case, dans leur couleur.' },
        { faire: 'expliquer', sur: '.me-grid .legend', nom: 'La légende', quoi: 'ce que veut dire chaque couleur.', sert: 'Un clic sur le numéro d’un jour ouvre toute l’équipe ce jour-là.' },
        { faire: 'cliquer', sur: o.parTexte('.me-grid .seg button', 'Semaine'), dit: 'Revenez à « Semaine »', sert: 'Les semaines reviennent.' },
      ],
    },
    {
      chapitre: PLANNING,
      qui: NICOLAS,
      cible: '.me .page-head',
      titre: 'Imprimer mon planning',
      texte: () => '« Imprimer » ouvre un aperçu : la feuille telle qu’elle sortira, à régler avant d’imprimer.',
      jouer: () => {
        o.avecPlanning();
        nicolas('moi');
      },
      gestes: [
        { faire: 'cliquer', sur: '#moi-imprimer', sert: 'L’aperçu s’ouvre sur votre semaine.' },
        { faire: 'attendre', que: '.dialog .imp-outils' },
        { faire: 'expliquer', sur: ".dialog .seg[aria-label='Période']", nom: 'Période', quoi: 'une semaine, ou un mois entier.', sert: 'La feuille est en A4 paysage ; un mois peut tenir sur plusieurs pages.' },
        { faire: 'expliquer', sur: '.dialog .imp-nav', nom: 'Période affichée', quoi: 'la semaine ou le mois imprimé, avec ses flèches.', sert: 'Une période encore à publier sortirait vide : l’aperçu le dit.' },
        { faire: 'expliquer', sur: ".dialog .seg[aria-label='Encre']", nom: 'Encre', quoi: 'en couleur, ou en noir et blanc.' },
        { faire: 'expliquer', sur: ".dialog .seg[aria-label='Personnes imprimées']", nom: 'Personnes imprimées', quoi: 'toute l’équipe, ou vos seuls postes.', sert: 'Depuis « Mon planning », vos seuls postes sont choisis d’avance.' },
        { faire: 'expliquer', sur: '.dialog .imp-zone', nom: 'L’aperçu', quoi: 'la feuille, réduite pour tenir à l’écran.', sert: 'Ce que vous voyez est ce qui s’imprime.' },
        { faire: 'expliquer', sur: '#imp-imprimer', nom: 'Imprimer', quoi: 'l’impression de la feuille.', sert: 'La fenêtre d’impression de votre navigateur s’ouvre. Le nombre de pages est écrit à côté.' },
        FERMER,
      ],
    },
    {
      chapitre: PLANNING,
      qui: NICOLAS,
      cible: '.content .plan',
      cibleFin: '.content .plan',
      titre: 'Le planning de l’équipe',
      texte: () => 'Le planning officiel de toute l’équipe, tel que le titulaire l’a publié. Il se lit, il ne se modifie pas.',
      jouer: () => {
        o.avecPlanning();
        nicolas('planning');
        ui().setSemaine(mondayOf(s().today));
        ui().setSeulementMoi(false);
      },
      gestes: [
        { faire: 'expliquer', sur: '.plan-bar .week-nav', nom: 'La semaine', quoi: 'la semaine affichée, son numéro, et les flèches pour passer à la précédente ou à la suivante.' },
        { faire: 'expliquer', sur: '.plan-bar .pill', nom: 'Publié le', quoi: 'la date de publication de la semaine.', sert: 'Une semaine pas encore publiée n’affiche rien : le titulaire la prépare encore.' },
        { faire: 'cliquer', sur: o.parTexte('.plan-bar .seg button', 'Mes postes'), dit: 'Cliquez sur « Mes postes »', sert: 'Seule votre ligne reste.' },
        { faire: 'pause', ms: 1200 },
        { faire: 'cliquer', sur: o.parTexte('.plan-bar .seg button', 'Toute l’équipe'), dit: 'Revenez à « Toute l’équipe »', sert: 'Toute l’équipe revient, une ligne par personne.' },
        { faire: 'expliquer', sur: 'table.lecture tr.moi th', nom: 'Votre ligne', quoi: 'votre nom, suivi de « (vous) », avec votre métier.', sert: 'Elle est mise en valeur, pour vous repérer d’un coup d’œil.' },
        { faire: 'expliquer', sur: 'table.lecture .tile', nom: 'Un poste', quoi: 'les horaires de la personne ce jour-là, sa durée de travail et son activité.' },
        { faire: 'expliquer', sur: 'table.lecture .lecture-vide', nom: 'Repos ou absent', quoi: '« Repos » quand la personne ne travaille pas, « Absent » pour une absence acceptée.', sert: 'La raison d’une absence n’est jamais montrée à l’équipe.', facultatif: true },
        { faire: 'expliquer', sur: '#equipe-imprimer', nom: 'Imprimer', quoi: 'l’aperçu de la semaine affichée, pour toute l’équipe ou vos seuls postes.', sert: 'Le même aperçu que depuis « Mon planning ».' },
      ],
    },

    // ---------------------------------------------------------------- Mes demandes
    {
      chapitre: DEMANDES,
      qui: NICOLAS,
      cible: '.content',
      titre: 'Trois façons de demander',
      texte: () => '« Mes demandes » réunit tout ce que vous pouvez demander à votre titulaire. Chaque carte ouvre un formulaire différent.',
      jouer: () => {
        o.avecPlanning();
        demandes('souhaits');
      },
      gestes: [
        { faire: 'expliquer', sur: o.nieme('.voie', 0), nom: 'Mes préférences', quoi: 'ce qui vous arrange pour le mois à venir : matin, journée, après-midi ou repos.', sert: 'Le planning s’en inspire ; personne n’a à vous répondre.' },
        { faire: 'expliquer', sur: o.nieme('.voie', 1), nom: 'Une absence ou un horaire', quoi: 'un congé, une absence ou un horaire à tenir.', sert: 'Votre titulaire l’accepte ou la refuse ; vous êtes prévenu de sa réponse.' },
        { faire: 'expliquer', sur: o.nieme('.voie', 2), nom: 'Me faire remplacer', quoi: 'un poste publié que vous ne pouvez pas tenir.', sert: 'Un collègue peut se proposer ; votre titulaire valide.' },
        { faire: 'expliquer', sur: o.nieme('.voie .voie-etat', 0), nom: 'L’état', quoi: 'où en est chaque carte : les jours qui restent pour vos préférences, les demandes en attente ou en cours.', sert: 'Il change de couleur quand quelque chose attend.' },
        { faire: 'expliquer', sur: o.nieme('.voie .voie-reponse', 2), nom: 'Qui répond', quoi: 'qui répond à ce type de demande.', sert: 'Vos préférences n’attendent pas de réponse ; une absence passe par votre titulaire ; un remplacement, par votre titulaire puis un collègue volontaire.' },
      ],
    },
    {
      chapitre: DEMANDES,
      qui: NICOLAS,
      cible: '.sh-cal',
      cibleFin: '.sh-cal',
      titre: 'Mes préférences : la forme et les jours',
      texte: () => 'Pour le mois à venir, vous dites ce qui vous arrange, jour par jour. Ce ne sont que des préférences : rien à justifier.',
      jouer: () => {
        o.avecPlanning();
        // Son mois repart vide : « M’assister » aura des jours à remplir.
        o.poser((d) => ({ ...d, souhaits: (d.souhaits ?? []).filter((x) => x.personId !== MOI) }));
        demandes('souhaits');
      },
      gestes: [
        { faire: 'expliquer', sur: '.sh-barre .week-nav', nom: 'Le mois', quoi: 'le mois dont on recueille les préférences, et le nombre de jours déjà remplis.', sert: 'Les flèches changent de mois. Un mois dont la collecte est close se lit sans se modifier.' },
        { faire: 'expliquer', sur: '.sh-barre > .pill', nom: 'Jours restants', quoi: 'le temps qu’il reste pour donner ou changer vos préférences.', sert: 'Passé la date limite fixée par votre titulaire, la collecte est close et le calendrier se fige.' },
        { faire: 'expliquer', sur: '.sh-palette', nom: 'Je préfère', quoi: 'la forme d’horaire à poser : matin, journée, après-midi ou repos.', sert: 'Choisissez une forme, puis touchez les jours : chaque jour touché la prend.' },
        { faire: 'cliquer', sur: '.sh-choix.matin', dit: 'Choisissez « Matin »', sert: 'La forme « Matin » est prête à être posée.' },
        { faire: 'cliquer', sur: o.nieme('button.sh-jour', 1), dit: 'Touchez un jour du calendrier', sert: 'Le jour prend la forme choisie. Chaque choix est enregistré aussitôt, sans bouton à valider.' },
        { faire: 'cliquer', sur: '.sh-choix.effacer', dit: 'Choisissez « Effacer »', sert: '« Effacer » retire la forme des jours que vous touchez.' },
        { faire: 'cliquer', sur: o.nieme('button.sh-jour', 1), dit: 'Touchez le même jour', sert: 'Il redevient « À remplir ».' },
        { faire: 'expliquer', sur: '.sh-legende', nom: 'Le repère des jours à renforcer', quoi: 'il marque un jour où l’équipe annoncée ne suffit pas encore.', sert: 'Touchez ce jour pour voir qui vient, et aider si vous le voulez.' },
      ],
    },
    {
      chapitre: DEMANDES,
      qui: NICOLAS,
      cible: '.souhaits',
      cibleFin: '.souhaits',
      titre: 'Mes préférences : le jour choisi et l’équipe',
      texte: () => 'Le panneau de droite détaille le jour touché. « M’assister » remplit le reste du mois d’après vos habitudes.',
      jouer: () => {
        o.avecPlanning();
        o.poser((d) => ({ ...d, souhaits: (d.souhaits ?? []).filter((x) => x.personId !== MOI) }));
        demandes('souhaits');
      },
      gestes: [
        { faire: 'cliquer', sur: o.nieme('button.sh-jour', 3), dit: 'Touchez un jour', sert: 'Il prend « Journée », la forme choisie au départ, et le panneau de droite le détaille.' },
        { faire: 'expliquer', sur: "[data-focus='jour-souhait']", nom: 'Le jour choisi', quoi: 'votre préférence ce jour-là, puis, matin et après-midi, combien de personnes viennent face au besoin.', sert: 'Vous voyez qui s’est positionné. Quand il manque du monde, « Je peux venir » vous ajoute au créneau.' },
        { faire: 'cliquer', sur: "[data-focus='assister']", dit: 'Cliquez sur « M’assister »', sert: 'Les jours restants se remplissent d’après vos habitudes. Corrigez ce qui ne convient pas.' },
        { faire: 'expliquer', sur: o.parTexte('.souhaits aside .card', 'ont répondu'), nom: 'L’équipe', quoi: 'combien de collègues ont déjà donné leurs préférences, et jusqu’à quand.', sert: 'Chacun voit l’effectif annoncé, jamais les raisons.' },
      ],
    },
    {
      chapitre: DEMANDES,
      qui: NICOLAS,
      cible: '#panneau-demandes',
      titre: 'Une absence ou un horaire',
      texte: () => 'Avant de demander, on voit les absences déjà accordées dans l’équipe. Puis « Nouvelle demande ».',
      jouer: () => {
        o.avecPlanning();
        absenceDansLEquipe();
        demandes('absences');
      },
      gestes: [
        { faire: 'expliquer', sur: "[data-focus='frise-conges']", nom: 'Absences de l’équipe', quoi: 'les absences déjà accordées sur les dix prochaines semaines, une ligne par personne.', sert: 'Pour choisir vos dates en connaissance de cause. Vous voyez qui est absent, jamais pourquoi.', facultatif: true },
        { faire: 'expliquer', sur: o.parTexte('#panneau-demandes .btn.primary', 'Nouvelle demande'), nom: 'Nouvelle demande', quoi: 'la fenêtre pour demander un congé, une formation ou un horaire à tenir.', sert: 'Ses champs sont détaillés dans les étapes qui suivent.' },
        { faire: 'expliquer', sur: '#panneau-demandes .tiny.muted', nom: 'Demandes prioritaires utilisées', quoi: 'combien de vos demandes « prioritaires » sont actives, face au plafond.', sert: 'Le même plafond vaut pour toute l’équipe : il garde l’équité entre collègues.' },
      ],
    },
    {
      chapitre: DEMANDES,
      qui: NICOLAS,
      cible: '.dialog',
      titre: 'Nouvelle demande : la raison',
      texte: () => 'Une demande porte toujours sa raison : une catégorie choisie dans une liste, et une précision si vous le voulez.',
      jouer: nouvelleDemande,
      gestes: [
        { faire: 'attendre', que: '.dialog #demande-motif' },
        { faire: 'expliquer', sur: o.parLibelle('Besoins courants', '.dialog'), nom: 'Besoins courants', quoi: 'des raccourcis pour les besoins fréquents : sortie d’école, mercredi, cours du soir, pratiques religieuses.', sert: 'Un raccourci remplit le formulaire et la raison. Il n’est jamais enregistré : votre titulaire ne voit que des horaires.' },
        { faire: 'cliquer', sur: o.parTexte('.dialog button', 'Sortie d’école'), dit: 'Touchez « Sortie d’école »', sert: 'Le type, les jours, l’heure et la raison se remplissent. Tout reste modifiable ; un second toucher retire le raccourci.' },
        { faire: 'expliquer', sur: o.parLibelle('Raison de la demande', '.dialog'), nom: 'Raison de la demande', quoi: 'la catégorie : congés, famille, santé, études, démarche administrative, ou raison personnelle.', sert: 'Obligatoire pour envoyer. Seuls vos titulaires la voient ; vos collègues ne voient que vos horaires.' },
        { faire: 'expliquer', sur: o.parLibelle('Précision', '.dialog'), nom: 'Précision', quoi: 'quelques mots de plus pour vos titulaires, en 120 caractères au plus.', sert: 'Facultative.', exemple: 'Rendez-vous à 15 h' },
        { faire: 'taper', dans: '#demande-precision', texte: 'Sortie à 16 h 30', dit: 'Écrivez une précision', sert: 'Elle part avec la demande.' },
        { faire: 'expliquer', sur: o.parLibelle('Type de besoin', '.dialog'), nom: 'Type de besoin', quoi: 'ne pas travailler certains jours, finir avant une heure, commencer après une heure, un jour précis, ou une absence de plusieurs jours.', sert: 'Les champs qui suivent changent avec ce choix.' },
        FERMER,
      ],
    },
    {
      chapitre: DEMANDES,
      qui: NICOLAS,
      cible: '.dialog',
      titre: 'Nouvelle demande : certains jours',
      texte: () => '« Ne pas travailler certains jours » : les jours de la semaine, le rythme, et la partie de la journée.',
      jouer: nouvelleDemande,
      gestes: [
        { faire: 'attendre', que: '.dialog #demande-motif' },
        { faire: 'expliquer', sur: o.parLibelle('Jours concernés', '.dialog'), nom: 'Jours concernés', quoi: 'les jours de la semaine concernés, à toucher un par un.', sert: 'Il en faut au moins un.' },
        { faire: 'cliquer', sur: () => o.parLibelle('Jours concernés', '.dialog')()?.closest('fieldset')?.querySelectorAll<HTMLElement>('button')[2], dit: 'Touchez « mercredi »', sert: 'Le jour est retenu ; un second toucher le retire.' },
        { faire: 'expliquer', sur: o.parLibelle('Rythme', '.dialog'), nom: 'Rythme', quoi: 'chaque semaine, ou une semaine sur deux.', sert: 'Une semaine sur deux se compte à partir de la date de début.' },
        { faire: 'expliquer', sur: o.parLibelle('Partie de la journée', '.dialog'), nom: 'Partie de la journée', quoi: 'la journée entière, le matin jusqu’à 13 h, l’après-midi dès 13 h, ou une plage horaire.' },
        { faire: 'choisir', dans: champ(o.parLibelle('Partie de la journée', '.dialog')), valeur: 'perso', dit: 'Choisissez « Une plage horaire »', sert: 'Deux heures s’ajoutent : le début et la fin de la plage.' },
        { faire: 'expliquer', sur: exact('De'), nom: 'De', quoi: 'le début de la plage où vous ne pouvez pas travailler.', exemple: '12 h' },
        { faire: 'expliquer', sur: exact('À'), nom: 'À', quoi: 'la fin de la plage.', sert: 'Elle doit suivre l’heure de début, sinon la demande ne part pas.', exemple: '14 h' },
        FERMER,
      ],
    },
    {
      chapitre: DEMANDES,
      qui: NICOLAS,
      cible: '.dialog',
      titre: 'Nouvelle demande : un horaire à tenir',
      texte: () => '« Finir avant » ou « commencer après » une heure : l’heure, la période, et l’importance de la demande.',
      jouer: nouvelleDemande,
      gestes: [
        { faire: 'attendre', que: '.dialog #demande-motif' },
        { faire: 'choisir', dans: champ(o.parLibelle('Type de besoin', '.dialog')), valeur: 'finir_avant', dit: 'Choisissez « Finir avant une heure »', sert: 'Une heure limite remplace la partie de la journée.' },
        { faire: 'expliquer', sur: exact('Finir avant'), nom: 'Finir avant', quoi: 'l’heure à laquelle vous devez avoir fini, les jours choisis.', sert: '« Commencer après une heure » fonctionne de la même façon, pour l’heure d’arrivée.', exemple: '16 h 30' },
        { faire: 'expliquer', sur: exact('À partir du'), nom: 'À partir du', quoi: 'la date à partir de laquelle la demande vaut.', sert: 'Aujourd’hui par défaut ; une date passée n’est pas possible.' },
        { faire: 'expliquer', sur: o.parLibelle('Jusqu’au', '.dialog'), nom: 'Jusqu’au', quoi: 'la date où elle s’arrête, si elle a une fin.', sert: 'Laissée vide, la demande vaut jusqu’à nouvel ordre.', exemple: 'la fin de l’année scolaire' },
        { faire: 'expliquer', sur: o.parLibelle('Importance', '.dialog'), nom: 'Importance', quoi: 'simple préférence, ou préférence prioritaire.', sert: 'Une préférence prioritaire est servie avant les autres, sans être garantie.' },
        { faire: 'expliquer', sur: o.parTexte('.dialog .pill', 'prioritaires actives'), nom: 'Demandes prioritaires actives', quoi: 'combien vous en avez déjà, face au plafond.', sert: 'Plafond atteint, une nouvelle demande prioritaire ne part pas : choisissez « Simple préférence », ou retirez-en une.' },
        FERMER,
      ],
    },
    {
      chapitre: DEMANDES,
      qui: NICOLAS,
      cible: '.dialog',
      titre: 'Nouvelle demande : un jour précis',
      texte: () => '« Un jour précis » : une seule date. Des repères de calendrier aident à la retrouver.',
      jouer: nouvelleDemande,
      gestes: [
        { faire: 'attendre', que: '.dialog #demande-motif' },
        { faire: 'choisir', dans: champ(o.parLibelle('Type de besoin', '.dialog')), valeur: 'jour', dit: 'Choisissez « Un jour précis »', sert: 'Une seule date suffit.' },
        { faire: 'expliquer', sur: exact('Date'), nom: 'Date', quoi: 'le jour où vous ne pouvez pas travailler.', sert: 'La demande vaut pour ce seul jour.' },
        { faire: 'cliquer', sur: o.parTexte('.dialog button', 'Repères de calendrier'), dit: 'Cliquez sur « Repères de calendrier »', sert: 'Les fêtes et jours particuliers à venir s’affichent, de toutes traditions.' },
        { faire: 'expliquer', sur: o.parTexte('.dialog .notice', 'Fêtes et jours particuliers'), nom: 'Repères de calendrier', quoi: 'des fêtes et jours particuliers à venir, pour retrouver une date.', sert: 'Un clic remplit la date. Le repère choisi n’est pas enregistré : seule la date part dans la demande.' },
        FERMER,
      ],
    },
    {
      chapitre: DEMANDES,
      qui: NICOLAS,
      cible: '.dialog',
      cibleFin: '#panneau-demandes',
      titre: 'Nouvelle demande : une absence',
      texte: () => '« Une absence de plusieurs jours » : le premier et le dernier jour, la nature, puis l’envoi.',
      jouer: nouvelleDemande,
      gestes: [
        { faire: 'attendre', que: '.dialog #demande-motif' },
        { faire: 'choisir', dans: champ(o.parLibelle('Type de besoin', '.dialog')), valeur: 'absence', dit: 'Choisissez « Une absence de plusieurs jours »', sert: 'Le premier et le dernier jour, et la nature de l’absence.' },
        { faire: 'choisir', dans: champ(exact('Premier jour')), valeur: premierJour, dit: 'Indiquez le premier jour', sert: 'Pas avant aujourd’hui.' },
        { faire: 'choisir', dans: champ(exact('Dernier jour')), valeur: dernierJour, dit: 'Indiquez le dernier jour', sert: 'Il suit le premier. Si des collègues sont déjà absents ces jours-là, la fenêtre le signale, sans les nommer.' },
        { faire: 'expliquer', sur: o.parLibelle('Nature', '.dialog'), nom: 'Nature', quoi: 'un congé, ou une formation.', sert: 'Un arrêt ou un accident se signale autrement : par « Retard ou absence », en haut de l’écran.' },
        { faire: 'choisir', dans: champ(o.parLibelle('Nature', '.dialog')), valeur: 'formation', dit: 'Choisissez « Formation »', sert: 'Un champ s’ajoute pour son nom.' },
        { faire: 'taper', dans: '#demande-formation', texte: 'Vaccination', dit: 'Écrivez le nom de la formation', sert: 'Les formations déjà connues sont proposées pendant la saisie.' },
        { faire: 'choisir', dans: '#demande-motif', valeur: 'etudes', dit: 'Choisissez la raison « Études, formation »', sert: 'Sans raison, la demande ne part pas.' },
        { faire: 'cliquer', sur: o.VALIDER, dit: 'Cliquez sur « Envoyer au responsable »', sert: 'La demande part à votre titulaire. Elle s’ajoute à votre liste, en attente de sa réponse.' },
      ],
    },
    {
      chapitre: DEMANDES,
      qui: NICOLAS,
      cible: '#panneau-demandes',
      titre: 'Suivre une demande envoyée',
      texte: () => 'Chaque demande suit trois étapes : envoyée, réponse du titulaire, au planning. Vous êtes prévenu à chaque réponse.',
      jouer: () => {
        o.avecPlanning();
        congeEnAttente();
        demandes('absences');
      },
      gestes: [
        { faire: 'expliquer', sur: '#panneau-demandes .dm', nom: 'Une demande d’absence', quoi: 'sa nature, ses dates, son nombre de jours, et le temps qu’il reste avant le premier jour.' },
        { faire: 'expliquer', sur: '#panneau-demandes .dm .etapes', nom: 'Les trois étapes', quoi: 'envoyée, réponse du titulaire, au planning.', sert: 'L’étape en cours est marquée ; une croix signale un refus.' },
        { faire: 'expliquer', sur: '#panneau-demandes .dm .dm-etat', nom: 'Où elle en est', quoi: 'la réponse de votre titulaire, en une phrase.', sert: 'Acceptée, l’absence est inscrite au planning : vos postes de ces jours-là sont retirés.' },
        { faire: 'expliquer', sur: '#panneau-demandes .dm > .pill', nom: 'L’état', quoi: 'en attente, acceptée ou refusée.' },
        { faire: 'expliquer', sur: o.parTexte('#panneau-demandes .dm', 'Horaire à tenir'), nom: 'Un horaire à tenir', quoi: 'la contrainte demandée, par exemple « finir avant 17 h le mercredi ».', sert: 'Une fois acceptée, son niveau s’affiche : seule une indisponibilité reconnue est garantie ; une préférence prioritaire passe avant les autres.', facultatif: true },
      ],
    },
    {
      chapitre: DEMANDES,
      qui: NICOLAS,
      cible: "[data-focus='remplacer']",
      titre: 'Me faire remplacer : le poste',
      texte: () => 'Vos postes publiés à venir, rangés selon le délai : assez loin pour une demande prévue, ou trop proches.',
      jouer: () => {
        o.avecDemande();
        demandes('remplacements');
      },
      gestes: [
        { faire: 'expliquer', sur: "[data-focus='remplacer'] .card-head", nom: 'Quel poste ne pouvez-vous pas tenir ?', quoi: 'vos huit prochains postes publiés.', sert: 'Un brouillon n’est jamais proposé.' },
        { faire: 'expliquer', sur: "[data-focus='remplacer'] .dm-groupe.warn", nom: 'Demande urgente', quoi: 'les postes trop proches pour le délai normal.', sert: 'Seul un collègue volontaire peut alors reprendre le poste : le bouton devient « Demande urgente ».', facultatif: true },
        { faire: 'expliquer', sur: "[data-focus='remplacer'] .dm-groupe.info", nom: 'Délai normal', quoi: 'les postes assez loin pour que votre titulaire s’organise.', facultatif: true },
        { faire: 'expliquer', sur: "[data-focus='remplacer'] .dm.actif", nom: 'Une demande en cours', quoi: 'le poste dont vous avez demandé le remplacement, avec son urgence.', sert: 'Trois étapes : demandé, accord du titulaire, un collègue reprend. Vous restez en poste tant que rien n’est validé.', facultatif: true },
        { faire: 'expliquer', sur: "[data-focus='remplacer'] .dm.actif .btn", nom: 'Annuler', quoi: 'le retrait de votre demande.', sert: 'Le poste reste le vôtre, comme avant.', facultatif: true },
        { faire: 'expliquer', sur: posteAConfier, nom: 'Me faire remplacer', quoi: 'la fenêtre de demande, pour ce poste.', sert: 'Ses champs sont détaillés dans les deux étapes suivantes.' },
      ],
    },
    {
      chapitre: DEMANDES,
      qui: NICOLAS,
      cible: "[data-focus='remplacer']",
      titre: 'Me faire remplacer : le motif et le collègue',
      texte: () => 'La fenêtre rappelle le poste et son délai, puis demande un motif et à qui s’adresser.',
      jouer: () => {
        o.avecPlanning();
        demandes('remplacements');
      },
      gestes: [
        { faire: 'cliquer', sur: posteAConfier, dit: 'Cliquez sur « Me faire remplacer »', sert: 'La fenêtre s’ouvre : le jour et les horaires du poste sont rappelés en haut.' },
        { faire: 'attendre', que: '.dialog .rm-motif' },
        { faire: 'expliquer', sur: '.dialog .delai-info', nom: 'Le délai', quoi: 'dans combien de jours a lieu le poste.', sert: 'Au-delà du délai, vos collègues sont prévenus dans les règles ; en deçà, seul un volontaire peut le reprendre.' },
        { faire: 'expliquer', sur: o.parLibelle('Motif de la demande', '.dialog'), nom: 'Motif de la demande', quoi: 'la raison : santé, famille, rendez-vous administratif, formation ou examen, transport, ou autre.', sert: 'Obligatoire : c’est votre titulaire qui décide. Seuls les titulaires le voient.' },
        { faire: 'choisir', dans: '#rempl-motif', valeur: 'administratif', dit: 'Choisissez le motif', sert: 'Le bouton d’envoi devient possible.' },
        { faire: 'expliquer', sur: autour('#rempl-precision', 'label'), nom: 'Précision', quoi: 'quelques mots pour votre titulaire.', sert: 'Facultative, sauf pour « Autre raison ». Elle est effacée une fois la demande réglée.', exemple: 'Rendez-vous à la préfecture' },
        { faire: 'expliquer', sur: o.parLibelle('À qui demander', '.dialog'), nom: 'À qui demander ?', quoi: 'toute l’équipe, ou un collègue précis parmi ceux qui peuvent reprendre le poste.', sert: 'Un collègue choisi est prévenu tout de suite. Dans tous les cas, votre titulaire valide.' },
        { faire: 'expliquer', sur: '.dialog .choix.collegues label:nth-of-type(2)', nom: 'Un collègue possible', quoi: 'son nom, et ses heures de la semaine avant et après le remplacement, face à son contrat.', sert: 'Solvéa a relu les règles de repos et compté ses heures.', facultatif: true },
        { faire: 'expliquer', sur: '.dialog .col-non', nom: 'Ceux qui ne peuvent pas', quoi: 'les collègues écartés, chacun avec sa raison.', sert: 'Un repos trop court, trop d’heures dans la semaine, une absence.', facultatif: true },
        FERMER,
      ],
    },
    {
      chapitre: DEMANDES,
      qui: NICOLAS,
      cible: "[data-focus='remplacer']",
      titre: 'Me faire remplacer : l’urgence',
      texte: () => 'Le niveau d’urgence dit à votre titulaire comment traiter la demande. En cas de raison médicale, un justificatif peut suivre.',
      jouer: () => {
        o.avecPlanning();
        demandes('remplacements');
      },
      gestes: [
        { faire: 'cliquer', sur: posteAConfier, dit: 'Cliquez sur « Me faire remplacer »', sert: 'La fenêtre s’ouvre de nouveau.' },
        { faire: 'attendre', que: '.dialog .choix.urgence' },
        { faire: 'expliquer', sur: o.parLibelle('Niveau d’urgence', '.dialog'), nom: 'Niveau d’urgence', quoi: 'prévu, urgent, ou urgence médicale.', sert: '« Prévu » n’est proposé que si le poste est assez loin. « Urgent » : votre titulaire répond d’abord, puis prévient l’équipe.' },
        { faire: 'cliquer', sur: o.parTexte('.dialog .choix.urgence label', 'Urgence médicale'), dit: 'Choisissez « Urgence médicale »', sert: 'La demande est traitée en premier, et son motif devient « Raison de santé ».' },
        { faire: 'expliquer', sur: '.dialog .piece', nom: 'Justificatif (facultatif)', quoi: 'une photo ou un PDF de 600 Ko au plus.', sert: 'Joignez le volet destiné à l’employeur : il ne mentionne pas le diagnostic. Seuls les titulaires le voient.' },
        { faire: 'expliquer', sur: '.dialog .piece-bouton', nom: 'Joindre une photo ou un PDF', quoi: 'le choix du fichier, sur votre appareil.', sert: 'Une photo est réduite pour rester légère. Une fois la demande réglée, la pièce est rangée dans vos documents.' },
        { faire: 'expliquer', sur: o.VALIDER, nom: 'Envoyer la demande', quoi: 'l’envoi à votre titulaire.', sert: 'Sans motif, le bouton reste grisé. Tant qu’aucun remplaçant n’est validé, le poste reste le vôtre.' },
        FERMER,
      ],
    },

    // ---------------------------------------------------------------- Aider un collègue
    {
      chapitre: AIDER,
      qui: NICOLAS,
      cible: "[data-focus='aider']",
      titre: 'Un appel à l’équipe',
      texte: () => 'Un collègue est absent : tous ceux qui peuvent tenir son poste reçoivent le même message, en tête de « Mon planning ».',
      jouer: () => {
        o.avecPlanning();
        appelPourMoi();
        nicolas('moi');
      },
      gestes: [
        { faire: 'expliquer', sur: "[data-focus='aider'] .card-head", nom: 'Le coup de main demandé', quoi: 'les postes à couvrir et les collègues qui cherchent un remplaçant, quand vous pouvez les aider.', sert: 'Vous proposer n’engage à rien tant que votre titulaire n’a pas validé.' },
        { faire: 'expliquer', sur: '.appel-recu .pill', nom: 'Absence à couvrir', quoi: 'le jour et les horaires du poste laissé libre.' },
        { faire: 'expliquer', sur: '.appel-recu .grow > .small', nom: 'Votre rang', quoi: 'combien de personnes ont reçu le même message, et votre rang dans le tour de rôle.', sert: 'Celui qui a le moins dépanné ces trois derniers mois passe d’abord. Dire non ne change pas votre rang.' },
        { faire: 'expliquer', sur: o.parTexte('.appel-recu button', 'Je peux'), nom: 'Je peux', quoi: 'votre réponse « oui ».', sert: 'Votre titulaire choisit parmi les volontaires, selon le tour de rôle.' },
        { faire: 'expliquer', sur: o.parTexte('.appel-recu button', 'Je ne peux pas'), nom: 'Je ne peux pas', quoi: 'votre réponse « non », avec ou sans message.', sert: 'Sa fenêtre est détaillée à l’étape suivante.' },
      ],
    },
    {
      chapitre: AIDER,
      qui: NICOLAS,
      cible: "[data-focus='aider']",
      titre: 'Répondre non',
      texte: () => 'Dire non se fait proprement : une raison si vous le voulez, et l’aperçu du message avant de l’envoyer.',
      jouer: () => {
        o.avecPlanning();
        appelPourMoi();
        nicolas('moi');
      },
      gestes: [
        { faire: 'cliquer', sur: o.parTexte('.appel-recu button', 'Je ne peux pas'), dit: 'Cliquez sur « Je ne peux pas »', sert: 'La fenêtre « Répondre non » s’ouvre.' },
        { faire: 'attendre', que: '.dialog #refus-prevenir' },
        { faire: 'expliquer', sur: o.parLibelle('Envoyer un message', '.dialog'), quoi: 'la case qui joint un message à votre réponse.', sert: 'Décochée, votre « non » est noté sans message.' },
        { faire: 'expliquer', sur: o.parLibelle('Raison', '.dialog'), nom: 'Raison', quoi: 'une raison choisie dans la liste, ou « Ne pas préciser ».', sert: 'Indisponible ce jour-là, déjà beaucoup d’heures, délai trop court, ou je laisse mon tour.' },
        { faire: 'choisir', dans: '#refus-raison', valeur: 'Indisponible ce jour-là', dit: 'Choisissez une raison', sert: 'L’aperçu du message se met à jour, dessous.' },
        { faire: 'expliquer', sur: o.parLibelle('Un mot pour', '.dialog'), quoi: 'quelques mots de plus, si vous le voulez, en 240 caractères au plus.', exemple: 'Je peux le lendemain' },
        { faire: 'taper', dans: '#refus-mot', texte: 'Je peux le lendemain.', dit: 'Écrivez un mot', sert: 'Il s’ajoute au message.' },
        { faire: 'expliquer', sur: '.dialog .refus-apercu', nom: 'Ce que votre titulaire recevra', quoi: 'le message tel qu’il partira.' },
        { faire: 'cliquer', sur: '.dialog-foot .btn.danger', dit: 'Cliquez sur « Répondre non »', sert: 'Votre réponse est notée. « Je peux » reste possible si vous changez d’avis.' },
      ],
    },
    {
      chapitre: AIDER,
      qui: NICOLAS,
      cible: "[data-focus='aider']",
      cibleFin: "[data-focus='aider']",
      titre: 'Se proposer',
      texte: () => '« Je peux » vous porte volontaire. Le poste n’est à vous qu’une fois confié par votre titulaire.',
      jouer: () => {
        o.avecPlanning();
        appelPourMoi();
        nicolas('moi');
      },
      gestes: [
        { faire: 'cliquer', sur: o.parTexte('.appel-recu button', 'Je peux'), dit: 'Cliquez sur « Je peux »', sert: 'Vous êtes volontaire, et votre titulaire le voit.' },
        { faire: 'expliquer', sur: o.parTexte('.appel-recu .pill', 'volontaire'), nom: 'Vous êtes volontaire', quoi: 'votre « oui », enregistré.', sert: 'Si votre titulaire vous confie le poste, vous êtes prévenu, et il s’ajoute à votre planning.' },
        { faire: 'expliquer', sur: o.parTexte('.appel-recu button', 'Retirer'), nom: 'Retirer', quoi: 'le retrait de votre proposition, tant que rien n’est validé.' },
        { faire: 'cliquer', sur: o.parTexte('.appel-recu button', 'Retirer'), dit: 'Cliquez sur « Retirer »', sert: 'Vous n’êtes plus volontaire : « Je peux » revient.' },
      ],
    },
    {
      chapitre: AIDER,
      qui: NICOLAS,
      cible: "[data-focus='aider']",
      titre: 'Un collègue vous demande',
      texte: () => 'Un collègue peut aussi vous demander, à vous seul, de reprendre son poste. Il reçoit votre réponse ; votre titulaire valide.',
      jouer: () => {
        o.avecPlanning();
        demandePourMoi();
        nicolas('moi');
      },
      gestes: [
        { faire: 'expliquer', sur: o.parTexte("[data-focus='aider'] .decision", 'vous le demande'), nom: 'Une demande pour vous', quoi: 'le jour et les horaires du poste qu’un collègue vous demande de reprendre.', sert: 'Si vous travaillez déjà à cet horaire, vous ne pouvez pas accepter : c’est écrit dessous.' },
        { faire: 'expliquer', sur: o.parTexte("[data-focus='aider'] button", 'J’accepte'), nom: 'J’accepte', quoi: 'votre accord.', sert: 'Votre collègue est prévenu ; votre titulaire valide ensuite le remplacement.' },
        { faire: 'expliquer', sur: o.parTexte("[data-focus='aider'] .decision button", 'Je ne peux pas'), nom: 'Je ne peux pas', quoi: 'votre refus, avec ou sans message, dans la même fenêtre « Répondre non ».', sert: 'Votre collègue peut alors demander à toute l’équipe.' },
        { faire: 'expliquer', sur: o.parTexte("[data-focus='aider'] .decision", 'Demandé par'), nom: 'Une demande ouverte à l’équipe', quoi: 'un collègue cherche un remplaçant, et votre titulaire a donné son accord.', sert: '« Je me propose » vous porte volontaire ; votre titulaire valide.', facultatif: true },
      ],
    },

    // ---------------------------------------------------------------- Mon suivi et mes gardes
    {
      chapitre: SUIVI,
      qui: NICOLAS,
      cible: '.content .deux',
      titre: 'Mon suivi',
      texte: () => 'Vos compteurs et votre part des contraintes de l’équipe. Vous ne voyez que votre position : il n’existe aucun classement.',
      jouer: () => {
        o.avecPlanning();
        nicolas('suivi');
      },
      gestes: [
        { faire: 'expliquer', sur: "[data-focus='mon-compteur']", nom: 'Mon compteur d’heures', quoi: 'vos heures planifiées face à celles de votre contrat, sur les semaines publiées.', sert: '« À jour » à moins d’une heure près. Un rattrapage ou une récupération prévus s’affichent dessous, avec leur semaine.', facultatif: true },
        { faire: 'expliquer', sur: '.hc-solde', nom: 'Le solde', quoi: '« + » pour des heures en plus, « − » pour des heures en moins.', sert: 'Un remplacement assuré s’y ajoute aussitôt ; votre titulaire décide ensuite : paiement ou récupération.', facultatif: true },
        { faire: 'expliquer', sur: '.pf-fiche', nom: 'Vos points forts', quoi: 'ce que vos titulaires relèvent de positif : ponctualité, entraide, volontariat, part des contraintes.', sert: 'Des faits, sans note.', facultatif: true },
        { faire: 'expliquer', sur: '.compteurs', nom: 'Ce qui a été noté', quoi: 'sur douze mois : retards, départs anticipés, absences non prévues, congés, arrêts, formations, remplacements assurés.', sert: 'Des dates et des durées notées par votre responsable, jamais une raison.' },
        { faire: 'expliquer', sur: '.part-liste', nom: 'Ma part des contraintes', quoi: 'sur huit semaines : vos samedis, fermetures, dépannages et changements tardifs, face à votre part.', sert: 'Votre part, c’est le total de l’équipe partagé selon les heures de chacun.', facultatif: true },
        { faire: 'expliquer', sur: '.part .part-mot', nom: 'Dans votre part', quoi: '« Dans votre part », « 2 de plus » ou « 2 de moins ».', sert: '« De plus » : vous en avez porté davantage, cela vous sera rendu sur les prochains plannings.', facultatif: true },
      ],
    },
    {
      chapitre: SUIVI,
      qui: LEA,
      cible: '.page-mesgardes',
      titre: 'Mes gardes',
      texte: () => 'Un pharmacien retrouve ses gardes : le délai de prévenance, le repos qui suit, et ce qui part en paie.',
      jouer: () => {
        o.avecPlanning();
        gardesDeLea();
        o.voirComme('lea.fontaine', 'mesgardes');
      },
      gestes: [
        { faire: 'expliquer', sur: carteGarde('g-avenir'), nom: 'Une garde à venir', quoi: 'le type de garde, le jour, les horaires et la durée.', sert: 'Une garde de nuit finit le lendemain : c’est écrit.' },
        { faire: 'expliquer', sur: dansGarde('g-avenir', '.card-head .pill'), nom: 'L’état', quoi: 'à venir ; une fois passée, à valider par le responsable ; puis validée pour la paie.' },
        { faire: 'expliquer', sur: dansGarde('g-avenir', '.notice'), nom: 'Le délai de prévenance', quoi: 'combien de jours avant la garde elle vous a été communiquée.', sert: 'Un délai plus court que celui des règles est signalé.' },
        { faire: 'expliquer', sur: dansGarde('g-avenir', '.card-body > p.small'), nom: 'Le repos', quoi: 'ce que la garde change à votre repos quotidien.', sert: 'Un poste trop proche de la garde est signalé, avec l’heure de reprise possible.', facultatif: true },
        { faire: 'expliquer', sur: o.parLibelle('Mois', '.page-mesgardes'), nom: 'Mois', quoi: 'le mois du récapitulatif.', sert: 'Le tableau liste, garde par garde, les éléments qui partent en paie.' },
        { faire: 'expliquer', sur: autour('#recap-mois', '.card-head'), nom: 'Récapitulatif mensuel', quoi: 'le mois choisi et son nombre de gardes.', sert: 'Le bouton « Imprimer », à côté, l’imprime.' },
      ],
    },
    {
      chapitre: SUIVI,
      qui: LEA,
      cible: '.page-mesgardes',
      titre: 'Déclarer une intervention',
      texte: () => 'Après une garde de nuit ou une astreinte, on déclare chaque intervention : elle compte dans la paie et dans le repos.',
      jouer: () => {
        o.avecPlanning();
        gardesDeLea();
        o.voirComme('lea.fontaine', 'mesgardes');
      },
      gestes: [
        { faire: 'expliquer', sur: carteGarde('g-passees'), nom: 'Une garde passée', quoi: 'une garde déjà faite, en attente de validation par le responsable.', sert: 'Tant qu’elle n’est pas validée, ses interventions se déclarent et se corrigent.' },
        { faire: 'expliquer', sur: dansGarde('g-passees', '.chips'), nom: 'Interventions', quoi: 'les interventions déjà déclarées, avec leur heure et leur durée.', sert: 'La corbeille en retire une.', facultatif: true },
        { faire: 'expliquer', sur: dansGarde('g-passees', 'label.field'), nom: 'Heure', quoi: 'l’heure de l’appel ou du déplacement.', sert: 'Elle doit tomber pendant la garde.', exemple: '23 h 40' },
        { faire: 'expliquer', sur: () => carteGarde('g-passees')()?.querySelectorAll<HTMLElement>('label.field')[1], nom: 'Durée, trajet compris', quoi: 'le temps passé, trajet compris, en minutes.', sert: 'De 5 à 240 minutes, par pas de 5.', exemple: '30' },
        { faire: 'cliquer', sur: () => [...(carteGarde('g-passees')()?.querySelectorAll<HTMLElement>('button') ?? [])].find((b) => b.textContent?.includes('Déclarer')), dit: 'Cliquez sur « Déclarer »', sert: 'L’intervention s’ajoute à la liste, puis au récapitulatif du mois.' },
      ],
    },

    // ---------------------------------------------------------------- Mes documents
    {
      chapitre: DOCUMENTS,
      qui: NICOLAS,
      cible: '.page-documents',
      titre: 'Mes plannings et mes absences',
      texte: () => 'Trois onglets : vos plannings publiés, vos absences, et les fichiers que vous déposez.',
      jouer: () => {
        o.avecPlanning();
        monDocument();
        nicolas('documents');
      },
      gestes: [
        { faire: 'cliquer', sur: o.parTexte('.jr-filtre', 'Mes plannings'), dit: 'Cliquez sur l’onglet « Mes plannings »', sert: 'Chaque semaine publiée où vous travaillez, rangée par mois.' },
        { faire: 'expliquer', sur: '.jr-filtres', nom: 'Les onglets', quoi: 'mes plannings, mes absences, mes fichiers, chacun avec son nombre.' },
        { faire: 'expliquer', sur: '.page-documents .doc-liste .doc', nom: 'Une semaine publiée', quoi: 'la semaine, vos postes et vos heures.', sert: 'De la plus récente à la plus ancienne ; une semaine passée porte la mention « terminée ».' },
        { faire: 'expliquer', sur: '.page-documents .doc-liste .doc .btn', nom: 'Voir', quoi: 'la semaine dans le planning de l’équipe, sur vos seuls postes.' },
        { faire: 'cliquer', sur: o.parTexte('.jr-filtre', 'Mes absences'), dit: 'Cliquez sur l’onglet « Mes absences »', sert: 'Vos absences et arrêts, passés et à venir.' },
        { faire: 'expliquer', sur: '.page-documents .doc-liste .doc', nom: 'Une absence', quoi: 'sa nature, ses dates, sa durée et la réponse : acceptée, refusée ou en attente.', sert: 'C’est votre historique ; une absence passée le dit.', facultatif: true },
      ],
    },
    {
      chapitre: DOCUMENTS,
      qui: NICOLAS,
      cible: '.page-documents',
      titre: 'Déposer un fichier',
      texte: () => 'Un arrêt, une attestation, un contrat : vous les rangez vous-même, et vous choisissez qui les voit.',
      jouer: () => {
        o.avecPlanning();
        monDocument();
        nicolas('documents');
      },
      gestes: [
        { faire: 'cliquer', sur: o.parTexte('.jr-filtre', 'Mes fichiers'), dit: 'Cliquez sur l’onglet « Mes fichiers »', sert: 'Le dépôt d’un fichier, puis ceux que vous avez déjà déposés.' },
        { faire: 'expliquer', sur: o.parLibelle('Nature', '.page-documents'), nom: 'Nature', quoi: 'le type de document : arrêt de travail, justificatif d’absence, attestation de formation, contrat ou avenant, autre.', sert: 'Elle s’affiche avec le fichier, pour vous, et pour vos titulaires s’il leur est visible.' },
        { faire: 'expliquer', sur: o.parLibelle('Visible par les titulaires', '.doc-depot'), nom: 'Visible par les titulaires', quoi: 'la case qui partage le fichier avec vos titulaires.', sert: 'Cochée d’avance. Décochée, le fichier reste dans votre seul espace.' },
        { faire: 'expliquer', sur: '.doc-depot .doc-bouton', nom: 'Choisir un fichier', quoi: 'une photo ou un PDF, choisi sur votre appareil.', sert: 'Il est rangé dès qu’il est choisi. Un PDF de plus de 600 Ko est refusé : photographiez plutôt le document.' },
        { faire: 'expliquer', sur: '.doc-depot .doc-note', nom: 'Place utilisée', quoi: 'la place que prennent vos documents.', sert: 'Ils restent sur cet appareil : rien n’est envoyé ailleurs.' },
        { faire: 'expliquer', sur: '.page-documents .doc-liste .doc', nom: 'Un fichier déposé', quoi: 'son nom, sa nature, sa date de dépôt et son poids.' },
        { faire: 'expliquer', sur: '.page-documents .doc-liste .doc-partage', nom: 'Visible par les titulaires', quoi: 'le partage de ce fichier, à changer quand vous voulez.' },
        { faire: 'expliquer', sur: '.page-documents .doc-liste .doc a.btn', nom: 'Ouvrir', quoi: 'le téléchargement du fichier.' },
        { faire: 'expliquer', sur: '.page-documents .doc-liste .doc .btn.icon', nom: 'Supprimer', quoi: 'la suppression du fichier.', sert: 'Une pièce conservée par vos titulaires, après une demande, porte la mention « Conservé par vos titulaires » et ne se retire pas.' },
      ],
    },

    // ---------------------------------------------------------------- Messages et rendez-vous
    {
      chapitre: MESSAGES,
      qui: NICOLAS,
      cible: '.content .split',
      titre: 'Écrire à l’équipe',
      texte: () => 'Un fil pour toute l’équipe, et une conversation privée avec chaque collègue. Les messages restent sur cet appareil.',
      jouer: () => {
        o.avecPlanning();
        nicolas('messages');
      },
      gestes: [
        { faire: 'expliquer', sur: '.msg-fils', nom: 'Les conversations', quoi: 'le fil de toute l’équipe, puis une conversation avec chaque collègue, rangées par métier.', sert: 'L’ordre ne change jamais ; un message non lu se signale par une pastille.' },
        { faire: 'cliquer', sur: o.parTexte('.msg-fil', 'Toute l’équipe'), dit: 'Cliquez sur « Toute l’équipe »', sert: 'Le fil commun : toute l’équipe le lit.' },
        { faire: 'expliquer', sur: '.content .fil', nom: 'Le fil', quoi: 'les messages, du plus ancien au plus récent, avec leur auteur et leur heure.', sert: 'Les nouveaux sont signalés par un séparateur.' },
        { faire: 'expliquer', sur: o.parLibelle('Votre message', '.content'), nom: 'Votre message', quoi: 'votre texte, en 1 000 caractères au plus.', sert: 'Pour une absence ou un horaire, préférez une demande : elle est suivie.' },
        { faire: 'taper', dans: '#msg-texte', texte: 'Bonjour à tous, je peux échanger mon samedi si besoin.', dit: 'Écrivez votre message', sert: 'Pour toute l’équipe, puisque c’est son fil qui est ouvert.' },
        { faire: 'cliquer', sur: o.parTexte('.content form button', 'Envoyer'), dit: 'Cliquez sur « Envoyer »', sert: 'Le message part dans le fil.' },
        { faire: 'cliquer', sur: o.parTexte('.msg-fil', 'Caroline'), dit: 'Cliquez sur la conversation avec Caroline', sert: 'Une conversation privée : vous seuls la lisez.' },
      ],
    },
    {
      chapitre: MESSAGES,
      qui: NICOLAS,
      cible: '.content .split',
      cibleFin: '.content .split',
      titre: 'Répondre à un rendez-vous',
      texte: () => 'Une demande de rendez-vous arrive dans la conversation, sous forme de carte. On l’accepte, on propose un autre horaire, ou on décline.',
      jouer: () => {
        o.avecPlanning();
        rdvPropose();
        nicolas('messages');
      },
      gestes: [
        { faire: 'cliquer', sur: o.parTexte('.msg-fil', 'Caroline'), dit: 'Cliquez sur la conversation avec Caroline', sert: 'La demande de rendez-vous de votre titulaire y est.' },
        { faire: 'expliquer', sur: '.content .rdv-carte.propose', nom: 'Une demande de rendez-vous', quoi: 'le sujet, le jour et l’heure proposés.', sert: 'Elle est aussi en tête de votre accueil, dans « À faire en premier ».' },
        { faire: 'expliquer', sur: o.parTexte('.rdv-carte.propose button', 'Proposer un autre horaire'), nom: 'Proposer un autre horaire', quoi: 'une contre-proposition : un autre jour, une autre heure.', sert: 'Votre titulaire doit alors l’accepter à son tour.' },
        { faire: 'expliquer', sur: o.parTexte('.rdv-carte.propose button', 'Décliner'), nom: 'Décliner', quoi: 'votre refus du rendez-vous.', sert: 'Votre titulaire le voit dans la conversation.' },
        { faire: 'cliquer', sur: o.parTexte('.rdv-carte.propose button', 'Accepter'), dit: 'Cliquez sur « Accepter »', sert: 'Le rendez-vous est fixé : il s’ajoute à votre planning et à celui de votre titulaire.' },
        { faire: 'expliquer', sur: o.parTexte('.rdv-carte.fixe button', 'Déplacer'), nom: 'Déplacer', quoi: 'un nouvel horaire à proposer, si le moment ne convient plus.', facultatif: true },
        { faire: 'expliquer', sur: o.parTexte('.rdv-carte.fixe button', 'Annuler le rendez-vous'), nom: 'Annuler le rendez-vous', quoi: 'l’annulation, visible dans la conversation.', facultatif: true },
      ],
    },
    {
      chapitre: MESSAGES,
      qui: NICOLAS,
      cible: '.content',
      titre: 'Demander un rendez-vous : le sujet',
      texte: () => '« Demander un rendez-vous » : avec qui, à quel sujet, puis quand. La demande part dans la conversation.',
      jouer: () => {
        o.avecPlanning();
        nicolas('messages');
      },
      gestes: [
        { faire: 'cliquer', sur: '#rdv-demander', dit: 'Cliquez sur « Demander un rendez-vous »', sert: 'La fenêtre propose les sujets de votre métier et la personne à voir.' },
        { faire: 'attendre', que: '.dialog #rdv-avis' },
        { faire: 'expliquer', sur: o.parLibelle('Avec', '.dialog'), nom: 'Avec', quoi: 'la personne à voir : votre titulaire, ou un collègue.', sert: 'Depuis une conversation privée, c’est la personne de la conversation qui est choisie.' },
        { faire: 'expliquer', sur: o.parLibelle('Sujet', '.dialog'), nom: 'Sujet', quoi: 'les sujets de votre métier : formation ou compétence, votre planning, votre contrat ou vos heures, l’entretien annuel, ou un autre sujet.' },
        { faire: 'choisir', dans: '#rdv-sujet', valeur: 'Autre sujet', dit: 'Choisissez « Autre sujet »', sert: 'Un champ s’ajoute pour le préciser.' },
        { faire: 'expliquer', sur: o.parLibelle('Précisez le sujet', '.dialog'), nom: 'Précisez le sujet', quoi: 'le sujet en quelques mots, 80 caractères au plus.', exemple: 'Mes congés d’été' },
        { faire: 'taper', dans: '#rdv-sujet-libre', texte: 'Mes congés d’été', dit: 'Écrivez le sujet', sert: 'Il sera le titre du rendez-vous.' },
        { faire: 'expliquer', sur: '.dialog .rdv-idees', nom: 'Solvéa propose', quoi: 'jusqu’à trois moments, dans les trois semaines, où vous êtes tous les deux en poste.', sert: 'Un toucher retient le moment : le jour et l’heure se remplissent.', facultatif: true },
        { faire: 'cliquer', sur: o.nieme('.dialog .rdv-idees .comp', 1), dit: 'Touchez un autre moment proposé', sert: 'Le jour et l’heure suivent.', facultatif: true },
        FERMER,
      ],
    },
    {
      chapitre: MESSAGES,
      qui: NICOLAS,
      cible: '.content',
      cibleFin: '.content .split',
      titre: 'Demander un rendez-vous : le moment',
      texte: () => 'Le jour, l’heure et la durée se règlent à la main. Solvéa vérifie aussitôt que le moment convient.',
      jouer: () => {
        o.avecPlanning();
        nicolas('messages');
      },
      gestes: [
        { faire: 'cliquer', sur: '#rdv-demander', dit: 'Cliquez sur « Demander un rendez-vous »', sert: 'La fenêtre s’ouvre de nouveau.' },
        { faire: 'attendre', que: '.dialog #rdv-avis' },
        { faire: 'expliquer', sur: exact('Jour'), nom: 'Jour', quoi: 'le jour du rendez-vous, dans les quatre prochains mois.', sert: 'Tant que vous n’en choisissez pas, le premier moment proposé est retenu.' },
        { faire: 'expliquer', sur: exact('À'), nom: 'À', quoi: 'l’heure de début, au quart d’heure.', exemple: '14 h 30' },
        { faire: 'expliquer', sur: o.parLibelle('Durée', '.dialog'), nom: 'Durée', quoi: '15, 30 ou 45 minutes, ou une heure.' },
        { faire: 'choisir', dans: '#rdv-duree', valeur: '45', dit: 'Choisissez « 45 minutes »', sert: 'Le contrôle, dessous, relit le moment.' },
        { faire: 'expliquer', sur: '#rdv-avis', nom: 'Le contrôle', quoi: 'le moment retenu, et ce qui pourrait gêner : une absence, un autre rendez-vous, une personne pas en poste, l’officine fermée.', sert: 'Une absence ou un autre rendez-vous bloquent l’envoi ; le reste est signalé, sans bloquer.' },
        { faire: 'expliquer', sur: o.parLibelle('Un mot pour', '.dialog'), quoi: 'ce que vous aimeriez aborder, en 300 caractères au plus.', sert: 'Facultatif ; il part avec la demande.', exemple: 'Je voudrais parler de mes horaires du mercredi' },
        { faire: 'cliquer', sur: '#rdv-envoyer', dit: 'Cliquez sur « Envoyer la demande »', sert: 'La demande part dans la conversation. Une fois acceptée, le rendez-vous est fixé dans vos deux agendas.' },
      ],
    },

    // ---------------------------------------------------------------- Mon compte et mes compétences
    {
      chapitre: COMPTE,
      qui: NICOLAS,
      cible: "[aria-labelledby='c-profil']",
      titre: 'Mon profil',
      texte: () => 'Le compte s’ouvre depuis votre nom, en haut à droite. Il commence par votre profil.',
      jouer: () => nicolas('compte'),
      gestes: [
        { faire: 'expliquer', sur: "[aria-labelledby='c-profil'] .grow", nom: 'Mon profil', quoi: 'votre nom, votre métier, votre espace, vos heures et votre contrat, votre ancienneté et la pharmacie.', sert: 'Ces informations viennent de votre fiche : c’est votre titulaire qui les modifie.' },
        { faire: 'expliquer', sur: o.parTexte("[aria-labelledby='c-profil'] button", 'Se déconnecter'), nom: 'Se déconnecter', quoi: 'la sortie de votre compte, sur cet appareil.', sert: 'À faire sur un poste partagé, au comptoir par exemple.' },
      ],
    },
    {
      chapitre: COMPTE,
      qui: NICOLAS,
      cible: '#mes-competences',
      titre: 'Mes compétences',
      texte: () => 'Vos compétences et diplômes, c’est vous qui les tenez à jour. Vos titulaires sont informés de chaque changement.',
      jouer: () => nicolas('compte'),
      gestes: [
        { faire: 'expliquer', sur: '#mes-competences .card-head', nom: 'Mes compétences et diplômes', quoi: 'ce que vous savez faire, et le nombre de compétences retenues.' },
        { faire: 'expliquer', sur: '#mes-competences .comp-famille', nom: 'Une famille', quoi: 'actes et diplômes, conseil, ou organisation, avec le nombre acquis.' },
        { faire: 'cliquer', sur: "#mes-competences [data-competence='phyto']", dit: 'Touchez « Phytothérapie »', sert: 'Elle s’ajoute, cochée, à votre profil ; vos titulaires en reçoivent l’annonce.' },
        { faire: 'cliquer', sur: "#mes-competences [data-competence='phyto']", dit: 'Touchez-la de nouveau', sert: 'Elle est retirée : un toucher ajoute, un autre retire.' },
        { faire: 'expliquer', sur: '#mes-competences .comp-regle', nom: 'Les actes réservés', quoi: 'les entretiens pharmaceutiques et les tests suivis d’une délivrance, montrés verrouillés.', sert: 'Ils sont réservés aux pharmaciens. Un préparateur conseille et délivre au comptoir, sous le contrôle effectif d’un pharmacien présent.', facultatif: true },
      ],
    },
    {
      chapitre: COMPTE,
      qui: NICOLAS,
      cible: "[aria-labelledby='c-apparence']",
      titre: 'Apparence',
      texte: () => 'Le mode, la couleur et la taille du texte : vos réglages ne changent que votre espace.',
      jouer: () => nicolas('compte'),
      gestes: [
        { faire: 'expliquer', sur: o.parLibelle('Mode', "[aria-labelledby='c-apparence']"), nom: 'Mode', quoi: 'clair, mixte (le menu foncé), sombre, ou comme l’appareil.', sert: 'Chaque carte montre l’écran en miniature.' },
        { faire: 'cliquer', sur: "label[for='mode-sombre']", dit: 'Choisissez « Sombre »', sert: 'Tout l’écran passe en sombre, aussitôt.' },
        { faire: 'cliquer', sur: "label[for='mode-clair']", dit: 'Revenez à « Clair »', sert: 'Le mode clair revient.' },
        { faire: 'expliquer', sur: '#couleur-profil', nom: 'Couleur de votre espace', quoi: 'la couleur de votre profil : indigo pour un préparateur.', sert: 'Elle dit d’un coup d’œil dans quel espace on se trouve. Seul le titulaire principal choisit la sienne.' },
        { faire: 'expliquer', sur: o.parLibelle('Taille du texte', "[aria-labelledby='c-apparence']"), nom: 'Taille du texte', quoi: 'normale, ou grande.', sert: 'Le grand texte agrandit toute l’interface, pour une lecture plus confortable.' },
      ],
    },
    {
      chapitre: COMPTE,
      qui: NICOLAS,
      cible: "[aria-labelledby='c-code']",
      titre: 'Mon mot de passe',
      texte: () => 'L’identifiant de connexion, et le mot de passe à changer vous-même.',
      jouer: () => nicolas('compte'),
      gestes: [
        { faire: 'expliquer', sur: "[aria-labelledby='c-code'] .card-head", nom: 'Connexion', quoi: 'votre identifiant, et si votre mot de passe est provisoire ou personnel.', sert: 'Un mot de passe provisoire est celui que vous a donné votre titulaire : remplacez-le par le vôtre.' },
        { faire: 'expliquer', sur: o.parLibelle('Mot de passe actuel', '.content'), nom: 'Mot de passe actuel', quoi: 'celui avec lequel vous vous connectez aujourd’hui.', sert: 'Il prouve que c’est bien vous.' },
        { faire: 'taper', dans: '#code-actuel', texte: 'ancien-mot', dit: 'Écrivez le mot de passe actuel', sert: 'Les caractères restent masqués.' },
        { faire: 'expliquer', sur: o.parLibelle('Nouveau mot de passe', '.content'), nom: 'Nouveau mot de passe', quoi: 'celui que vous choisissez, 6 caractères au moins.', sert: 'Seule une empreinte en est gardée, sur cet appareil.' },
        { faire: 'taper', dans: '#code-nouveau', texte: 'nouveau-mot', dit: 'Écrivez le nouveau', sert: 'Le bouton « Changer le mot de passe » devient possible.' },
        { faire: 'expliquer', sur: () => document.querySelector('#code-nouveau')?.parentElement?.querySelector<HTMLElement>('.mdp-oeil'), nom: 'L’œil', quoi: 'le bouton qui affiche ou masque ce que vous tapez.' },
        { faire: 'expliquer', sur: o.parTexte("[aria-labelledby='c-code'] button", 'Changer le mot de passe'), nom: 'Changer le mot de passe', quoi: 'l’enregistrement du nouveau mot de passe.', sert: 'Si le mot de passe actuel ne correspond pas, un message le dit, et rien ne change.' },
        {
          faire: 'action',
          jouer: () => {
            vider('#code-actuel');
            vider('#code-nouveau');
          },
        },
      ],
    },
  ];
}
