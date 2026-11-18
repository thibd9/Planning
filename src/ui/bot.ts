import type { Espace } from '../domain/acces';
import { JOURS, addDays, dayIndex, fmtDateCourt, fmtDuree, fmtHeure, mondayOf, weekday } from '../domain/time';
import type { AppData, ISODate, Shift } from '../domain/types';
import { libelleGarde, nomCourt } from '../domain/types';
import { decisions } from '../engine/decisions';
import { aRegulariser, soldeHeures } from '../engine/heures';
import { useStore } from '../store/store';
import type { Vue } from '../store/ui';
import type { useUi } from '../store/ui';

export type Ui = ReturnType<typeof useUi.getState>;

export interface Fiche {
  id: string;
  question: string;
  reponse: string;
  /** Mots que la personne pourrait taper, en plus de ceux de la question. */
  mots: string;
  /** Qui est concerné : une fonction de gestion n'est pas proposée à l'équipe. */
  pour: Espace[];
  /** Écrans où la question se pose naturellement. */
  ecrans?: Vue[];
  bouton: string;
  aller: (ui: Ui, espace: Espace) => void;
}

const TOUS: Espace[] = ['responsable', 'pharmacien', 'equipe'];
/** Ce qui ne concerne que l'espace personnel d'un membre de l'équipe. */
const MOI_SEUL: Espace[] = ['pharmacien', 'equipe'];
const GESTION: Espace[] = ['responsable'];
const versDemandes = (onglet: 'souhaits' | 'absences' | 'remplacements') => (ui: Ui): void => {
  ui.setDemandesOnglet(onglet);
  ui.aller('demandes');
};
const versResoudre = (sujet: string) => (ui: Ui): void => {
  ui.setSujet(sujet);
  ui.aller('resoudre');
};

/** Ce que l'assistant sait : une question, une réponse courte, et le bouton qui y mène. */
export const FICHES: Fiche[] = [
  { id: 'prochain', question: 'Où voir mon prochain poste ?', reponse: 'Il est écrit en grand en haut de « Mon planning », avec la pause et la durée. Dessous, votre semaine jour par jour, puis le calendrier du mois.', mots: 'horaires semaine quand travaille planning perso personnel calendrier', pour: TOUS, ecrans: ['moi'], bouton: 'Ouvrir mon planning', aller: (ui) => ui.aller('moi') },
  { id: 'equipe-planning', question: 'Voir le planning de toute l’équipe', reponse: 'Le planning global montre qui travaille quand. « Mes postes » ne garde que votre ligne ; « Toute l’équipe » la remet au complet.', mots: 'global collegues qui travaille mes postes filtre', pour: TOUS, ecrans: ['moi', 'planning', 'construire'], bouton: 'Ouvrir le planning global', aller: (ui, e) => { ui.setSeulementMoi(false); ui.aller(e === 'responsable' ? 'construire' : 'planning'); } },
  { id: 'difference', question: 'Préférence, demande : quelle différence ?', reponse: 'Une préférence dit ce qui vous convient pour le mois à venir : le planning s’en inspire, personne ne vous répond. Une demande (congé, horaire à tenir, remplacement) attend une réponse du titulaire.', mots: 'preferences souhaits demandes comprendre onglets', pour: MOI_SEUL, ecrans: ['demandes'], bouton: 'Ouvrir mes demandes', aller: (ui) => ui.aller('demandes') },
  { id: 'souhaits', question: 'Donner mes préférences du mois', reponse: 'Choisissez une forme (matin, journée, après-midi, repos) puis cliquez les jours. « M’assister » remplit le reste d’après vos habitudes.', mots: 'preferences souhaits mois ideal assister matin apres-midi repos', pour: MOI_SEUL, ecrans: ['demandes', 'moi'], bouton: 'Donner mes préférences', aller: versDemandes('souhaits') },
  { id: 'conge', question: 'Poser un congé ou une contrainte d’horaires', reponse: 'Dans « Mes demandes », carte « Absence ou horaire ». Un raccourci (sortie d’école, cours du soir…) remplit les horaires. Une raison est toujours demandée, dans une liste ; seuls les titulaires la voient.', mots: 'absence vacances formation finir tot commencer tard indisponible religion enfant', pour: TOUS, ecrans: ['demandes', 'moi'], bouton: 'Faire une demande', aller: (ui) => ui.agir('demandes', 'demande') },
  { id: 'documents', question: 'Retrouver mes anciens plannings ou déposer un document', reponse: '« Mes documents » réunit vos plannings publiés, vos absences et arrêts, et les fichiers que vous déposez (arrêt de travail, attestation de formation). Un justificatif joint à une demande y est rangé une fois la demande réglée. Tout reste sur cet appareil.', mots: 'documents ged archive ancien planning arret attestation fichier deposer justificatif', pour: TOUS, ecrans: ['documents', 'moi'], bouton: 'Ouvrir mes documents', aller: (ui) => ui.aller('documents') },
  { id: 'remplacer', question: 'Me faire remplacer sur un poste', reponse: 'Dans « Mes demandes », carte « Me faire remplacer » : choisissez le poste, puis demandez à toute l’équipe ou à un collègue précis. Le calcul dit qui peut le reprendre, d’après les règles et ses heures de la semaine. Votre titulaire valide dans tous les cas.', mots: 'remplacement urgent medical justificatif arret malade empeche ceder echanger', pour: MOI_SEUL, ecrans: ['demandes', 'moi'], bouton: 'Demander un remplacement', aller: versDemandes('remplacements') },
  { id: 'aider', question: 'Répondre à un appel ou aider un collègue', reponse: 'L’appel apparaît en tête de « Mon planning », avec votre rang dans le tour de rôle. « Je peux » ou « Je ne peux pas » : dire non ne change pas votre rang.', mots: 'volontaire depanner tour de role appel equipe je peux', pour: MOI_SEUL, ecrans: ['moi'], bouton: 'Voir les appels', aller: (ui) => ui.aller('moi') },
  { id: 'suivi', question: 'Voir mon compteur d’heures et mon suivi', reponse: '« Mon suivi » montre vos heures en plus ou en moins, ce qui a été noté sur douze mois et votre part des contraintes. Vous ne voyez que votre position.', mots: 'heures supplementaires compteur retards equite samedis', pour: MOI_SEUL, ecrans: ['suivi'], bouton: 'Ouvrir mon suivi', aller: (ui) => ui.aller('suivi') },
  { id: 'gardes-moi', question: 'Voir mes gardes', reponse: '« Mes gardes » liste vos gardes et astreintes, le repos qui suit et ce qui partira en paie.', mots: 'garde astreinte nuit dimanche repos', pour: ['pharmacien'], ecrans: ['mesgardes'], bouton: 'Ouvrir mes gardes', aller: (ui) => ui.aller('mesgardes') },
  { id: 'message', question: 'Écrire à l’équipe ou à une personne', reponse: 'Un fil pour toute l’équipe et des conversations privées. Pour une absence, préférez une demande : elle est suivie.', mots: 'messages messagerie contacter prevenir', pour: TOUS, ecrans: ['messages'], bouton: 'Ouvrir les messages', aller: (ui) => ui.aller('messages') },
  { id: 'compte', question: 'Changer la couleur, le mode sombre ou mon mot de passe', reponse: 'Dans « Mon compte » : dix couleurs, mode clair ou sombre, taille du texte, mot de passe.', mots: 'theme apparence sombre nuit taille texte code', pour: TOUS, ecrans: ['compte'], bouton: 'Ouvrir mon compte', aller: (ui) => ui.aller('compte') },

  { id: 'decisions', question: 'Savoir ce qui a été décidé, et ce que cela change', reponse: 'Chaque décision (congé, remplacement, horaires, publication, garde) est annoncée sous la cloche aux personnes concernées et aux titulaires, avec ce qu’elle change dans les plannings. « Vu » la range.', mots: 'notification cloche decision annonce prevenu changement approuve refuse', pour: TOUS, ecrans: ['tableau', 'moi'], bouton: 'Ouvrir l’accueil', aller: (ui, espace) => ui.aller(espace === 'responsable' ? 'tableau' : 'moi') },

  { id: 'construire', question: 'Construire le planning d’une semaine', reponse: 'Dans « Construire », un « + » pose un poste à la main. « Proposer un planning » calcule trois propositions comparables : équité, souhaits, coût. Les règles impératives passent toujours d’abord.', mots: 'creer planning grille poste generer proposition automatique', pour: GESTION, ecrans: ['construire', 'tableau'], bouton: 'Ouvrir « Construire »', aller: (ui) => { ui.setPlanVue('semaine'); ui.aller('construire'); } },
  { id: 'publier', question: 'Publier un planning', reponse: 'Tant qu’il est en brouillon, vous seul le voyez. « Publier » relit les règles et les délais, puis l’envoie à l’équipe. Tout changement ultérieur est annoncé à la personne concernée.', mots: 'envoyer diffuser brouillon equipe voit', pour: GESTION, ecrans: ['construire'], bouton: 'Aller publier', aller: (ui) => { ui.setPlanVue('semaine'); ui.aller('construire'); } },
  { id: 'mois', question: 'Voir le mois entier et suivre les préférences', reponse: 'Dans « Construire », passez sur « Mois » : objectif d’équipe par jour, heures de chacun face à son contrat, préférences données. « Corriger automatiquement » recalcule les semaines en brouillon.', mots: 'mensuel objectif equipe heures contrat corriger', pour: GESTION, ecrans: ['construire'], bouton: 'Ouvrir la vue mois', aller: (ui) => { ui.setPlanVue('mois'); ui.aller('construire'); } },
  { id: 'absence', question: 'Couvrir une absence imprévue', reponse: 'Dans « Résoudre », onglet « Absences ». « Demander à toute l’équipe » prévient en même temps tous ceux qui peuvent tenir le poste ; entre volontaires, il revient à celui qui a le moins dépanné. Sinon, comparez les options proposées.', mots: 'arret maladie malade absent absente trou manque personnel appel tour role injustice urgence couvrir', pour: GESTION, ecrans: ['resoudre', 'tableau'], bouton: 'Voir les absences', aller: versResoudre('absences') },
  { id: 'demande-remplacement', question: 'Répondre à une demande de remplacement', reponse: 'Les demandes sont triées par urgence : médicale, urgente, prévue. Vous répondez oui ou non ; si oui, l’équipe est prévenue, puis vous validez le volontaire. Les heures en plus sont annoncées.', mots: 'remplacement urgence accepter refuser volontaire valider justificatif', pour: GESTION, ecrans: ['resoudre', 'tableau'], bouton: 'Voir les remplacements', aller: versResoudre('remplacements') },
  { id: 'demandes-equipe', question: 'Répondre à un congé ou à une demande d’horaires', reponse: 'Onglet « Demandes » de « Résoudre ». Avant de répondre, vous voyez ce que l’absence découvre. Pour un horaire, vous choisissez son poids : reconnue, prioritaire ou simple préférence.', mots: 'approuver refuser conge vacances besoin contrainte', pour: GESTION, ecrans: ['resoudre'], bouton: 'Voir les demandes', aller: versResoudre('demandes') },
  { id: 'gardes', question: 'Ajouter ou répartir les gardes', reponse: 'Dans « Gardes » : ajoutez une garde, confiez-la et prévenez le pharmacien dans la foulée. « Répartir » propose un partage équitable. Le délai de 15 jours et le repos qui suit sont contrôlés.', mots: 'garde astreinte nuit dimanche affecter repartir', pour: GESTION, ecrans: ['gardes'], bouton: 'Ajouter une garde', aller: (ui) => ui.agir('gardes', 'garde') },
  { id: 'formation', question: 'Planifier une formation ou un inventaire', reponse: 'Depuis « Créer », en haut de l’écran : intitulé, dates, participants. Chacun est prévenu et son planning est mis à jour.', mots: 'formation inventaire stage participants', pour: GESTION, ecrans: ['equipe', 'construire'], bouton: 'Planifier une formation', aller: (ui) => ui.agir('equipe', 'formation') },
  { id: 'personne', question: 'Ajouter une personne ou changer son poste', reponse: 'Dans « Équipe » : titulaire, adjoint, préparateur, animateur, apprenti, étudiant, rayonniste. Chaque poste a sa couleur. La fiche porte le contrat, les compétences et le compte de connexion.', mots: 'embauche nouveau salarie animateur preparateur fiche competences diplome', pour: GESTION, ecrans: ['equipe'], bouton: 'Ajouter une personne', aller: (ui) => ui.agir('equipe', 'personne') },
  { id: 'mdp-equipe', question: 'Donner un mot de passe à un membre de l’équipe', reponse: 'Ouvrez sa fiche dans « Équipe », carte « Compte de connexion » : un mot de passe provisoire à lui transmettre, qu’il changera ensuite.', mots: 'mot de passe oublie identifiant connexion provisoire', pour: GESTION, ecrans: ['equipe'], bouton: 'Ouvrir l’équipe', aller: (ui) => ui.aller('equipe') },
  { id: 'heures', question: 'Régulariser les heures en plus ou en moins', reponse: '« Heures » compare ce qui a été publié au contrat de chacun. « Faire rattraper » ou « Faire récupérer » ouvre le planning de la personne : vous cliquez là où placer les heures, ou vous gardez le créneau proposé, et un message la prévient. « Payer » et « Solder » remettent le compteur à zéro ; « Régulariser automatiquement » résorbe les écarts sur la prochaine semaine à construire.', mots: 'heures supplementaires compteur recuperation rattrapage rattraper recuperer payer solde creneau', pour: GESTION, ecrans: ['heures', 'tableau'], bouton: 'Ouvrir les heures', aller: (ui) => ui.aller('heures') },
  { id: 'retard', question: 'Noter un retard ou régler une pause', reponse: 'Cliquez sur un jour, dans « Construire » ou sur le tableau de bord : la journée s’ouvre avec toute l’équipe. On y règle les pauses et on y note un retard en deux clics.', mots: 'retard depart anticipe pause dejeuner journee', pour: GESTION, ecrans: ['tableau', 'construire'], bouton: 'Ouvrir la journée', aller: (ui) => ui.voirJour(useStore.getState().today) },
  { id: 'reglages', question: 'Changer les horaires d’ouverture ou l’effectif attendu', reponse: 'Dans « Réglages » : horaires jour par jour, effectif minimal au comptoir, postes types, et le choix entre planning collaboratif et classique.', mots: 'ouverture fermeture seuil comptoir collaboratif classique modele', pour: GESTION, ecrans: ['officine'], bouton: 'Ouvrir les réglages', aller: (ui) => ui.aller('officine') },
  { id: 'regles', question: 'Voir ou régler les règles appliquées', reponse: 'Chaque contrôle vient d’une fiche, avec sa source. Vous réglez aussi vos seuils : plafond d’heures par semaine, samedis libres par mois, délai des remplacements.', mots: 'loi code du travail repos pause plafond samedis delai', pour: GESTION, ecrans: ['regles'], bouton: 'Ouvrir les règles', aller: (ui) => ui.aller('regles') },
  { id: 'paie', question: 'Préparer la paie du mois', reponse: '« Journal et paie » trace chaque décision et prépare la fiche navette : heures et variables du mois, à exporter pour le comptable.', mots: 'export navette comptable journal historique', pour: GESTION, ecrans: ['journal'], bouton: 'Ouvrir le journal', aller: (ui) => ui.aller('journal') },
  { id: 'equite', question: 'Vérifier que la charge est bien répartie', reponse: '« Équité » compare samedis, fermetures, gardes et dépannages à la part attendue de chacun, au prorata de son contrat.', mots: 'equite injustice samedis fermetures repartition charge', pour: GESTION, ecrans: ['equite'], bouton: 'Ouvrir l’équité', aller: (ui) => ui.aller('equite') },
  { id: 'accord', question: 'Donner mon accord à un autre titulaire', reponse: 'Les décisions d’un titulaire secondaire attendent l’accord du titulaire principal, dans « Résoudre », onglet « Accords à donner ».', mots: 'titulaire secondaire associe validation accord', pour: GESTION, ecrans: ['resoudre'], bouton: 'Voir les accords', aller: versResoudre('accords') },
  { id: 'controles', question: 'Comprendre les alertes de la grille', reponse: 'Sous chaque jour, la ligne « Équipe au complet ? » l’écrit en mots : « Complet », « Pharmacien absent » ou « Manque du monde », avec les heures et la cause (la pause d’un pharmacien, son départ). Titulaires et adjoints comptent tous comme pharmaciens. Un clic ouvre la journée pour corriger.', mots: 'alerte croix rouge barre couverture controle manque pharmacien effectif grille', pour: GESTION, ecrans: ['construire'], bouton: 'Ouvrir « Construire »', aller: (ui) => ui.aller('construire') },
  { id: 'historique', question: 'Conserver un justificatif et revoir les absences de l’équipe', reponse: 'Dans « Documents », onglet « Absences de l’équipe » : arrêts, congés, formations, remplacements et absences non prévues, par personne et par mois. « Joindre » range le justificatif ; seuls les titulaires et la personne le voient.', mots: 'justificatif arret maladie historique absences conserver piece archive volet employeur', pour: GESTION, ecrans: ['documents'], bouton: 'Ouvrir les documents', aller: (ui) => ui.aller('documents') },
  { id: 'points-forts', question: 'Voir les points forts de l’équipe', reponse: 'En bas de « Équipe », « Les points forts de l’équipe » réunit ce qui a été noté de positif sur douze mois : ponctualité, dépannages, réponses aux appels, part des samedis. Ni note ni classement ; arrêts et congés n’entrent jamais en compte.', mots: 'fiable fiables bons elements points forts ponctuel confiance mise en avant serieux', pour: GESTION, ecrans: ['equipe'], bouton: 'Ouvrir l’équipe', aller: (ui) => ui.aller('equipe') },
  { id: 'feries', question: 'Voir les jours fériés', reponse: 'Les jours fériés sont marqués dans la grille, le mois et les calendriers de chacun. Leur liste pour les douze prochains mois est dans « Réglages ».', mots: 'ferie feries 1er mai noel paques ascension toussaint armistice', pour: GESTION, ecrans: ['officine', 'construire'], bouton: 'Ouvrir les réglages', aller: (ui) => ui.aller('officine') },

  { id: 'pharmacie', question: 'Ajouter une autre pharmacie', reponse: 'Le titulaire principal ajoute autant de pharmacies qu’il veut. Le sélecteur, en haut du menu, passe de l’une à l’autre.', mots: 'plusieurs officines seconde pharmacie multi', pour: GESTION, bouton: 'Ajouter une pharmacie', aller: (ui) => ui.aller('nouvelle') },
];

export const simple = (t: string): string => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, ' ');
const VIDES = new Set(['est', 'une', 'des', 'les', 'pour', 'que', 'qui', 'quoi', 'mon', 'mes', 'ma', 'sur', 'dans', 'avec', 'quelqu', 'comment', 'faire', 'veux', 'voudrais', 'peux', 'dois', 'faut', 'suis', 'sont', 'ont', 'demain', 'aujourd', 'hui', 'cette', 'ces', 'son', 'ses', 'pas', 'plus', 'tout', 'tous', 'ou', 'et', 'la', 'le', 'un', 'je', 'il', 'elle', 'on', 'du', 'de', 'au', 'aux', 'en', 'ne', 'se', 'ce', 'voir', 'quel', 'quelle', 'quels', 'quelles', 'pourquoi', 'quand', 'combien', 'vous', 'nous', 'moi', 'toi', 'tes', 'ton', 'ete', 'etre', 'avoir', 'fait', 'dit', 'donc', 'alors', 'tres', 'bien', 'bonjour', 'salut', 'merci', 'svp', 'plait']);
const mots = (t: string): string[] => simple(t).split(/[^a-z0-9]+/).filter((m) => m.length >= 3 && !VIDES.has(m));
/** Deux mots se répondent s'ils partagent leur début : « remplacer » trouve « remplacement ». */
const proche = (a: string, b: string): boolean => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b.slice(0, Math.max(4, b.length - 3))) || b.startsWith(a.slice(0, Math.max(4, a.length - 3)))));

/** Les fiches qui répondent à une question tapée : un mot du titre compte triple, un mot-clé double. */
export function chercher(fiches: Fiche[], question: string): Fiche[] {
  const demandes = mots(question);
  if (!demandes.length) return [];
  return fiches
    .map((f) => {
      const titre = mots(f.question);
      const cles = mots(f.mots);
      const texte = mots(f.reponse);
      const points = demandes.map((m) => (titre.some((x) => proche(x, m)) ? 3 : cles.some((x) => proche(x, m)) ? 2 : texte.some((x) => proche(x, m)) ? 1 : 0));
      const score = points.reduce<number>((t, x) => t + x, 0);
      // Une fiche ne répond que si elle parle vraiment de la question : au moins un tiers de ses mots, ou un mot de son titre.
      const pertinent = points.filter(Boolean).length / demandes.length >= 0.34 && (score >= 2 || demandes.length === 1);
      return { f, score: pertinent ? score : 0 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.f.pour.length - b.f.pour.length)
    .slice(0, 5)
    .map((x) => x.f);
}


/** Ce que le bot répond : une phrase, parfois une liste, parfois un bouton qui y mène. */
export interface Reponse {
  texte: string;
  lignes?: string[];
  bouton?: { label: string; aller: (ui: Ui, espace: Espace) => void };
  /** Questions voisines, proposées à la suite. */
  suites?: string[];
  /** L'humeur de Solvi quand il donne cette réponse. */
  humeur?: 'heureux' | 'content' | 'joyeux' | 'intrigue' | 'confus' | 'surpris' | 'inquiet' | 'satisfait' | 'confiant';
  /** Solvi renvoie vers une personne : le support, ou le titulaire. */
  support?: boolean;
  /** Une limite à dire avant tout le reste (santé, droit, panne), ou au contraire une simple politesse qui cède la place à une vraie question. */
  rang?: 'limite' | 'politesse';
}

interface Contexte {
  data: AppData;
  today: ISODate;
  moi: string;
  espace: Espace;
  fiches: Fiche[];
}

/** Le jour dont parle la question : aujourd'hui, demain, après-demain, ou un jour de la semaine à venir. */
export function jourDe(question: string, today: ISODate): ISODate {
  const q = simple(question);
  if (q.includes('apres-demain') || q.includes('apres demain')) return addDays(today, 2);
  if (q.includes('demain')) return addDays(today, 1);
  const i = JOURS.findIndex((j) => q.includes(j));
  if (i < 0) return today;
  return addDays(today, (i - weekday(today) + 7) % 7);
}

/** Les postes qu'une personne a le droit de voir : le brouillon pour un responsable, le publié pour l'équipe. */
function postesVisibles(c: Contexte, date: ISODate): Shift[] {
  if (c.espace === 'responsable') return c.data.shifts.filter((s) => s.date === date);
  const semaine = c.data.semaines[mondayOf(date)];
  return semaine?.statut === 'publie' ? (semaine.snapshot ?? []).filter((s) => s.date === date) : [];
}
const nom = (d: AppData, id: string | null | undefined): string => {
  const p = d.personnes.find((x) => x.id === id);
  return p ? nomCourt(p) : 'Quelqu’un';
};
const quand = (date: ISODate, today: ISODate): string => (date === today ? 'Aujourd’hui' : date === addDays(today, 1) ? 'Demain' : fmtDateCourt(date).replace(/^./, (x) => x.toUpperCase()));

/** Les questions dont la réponse se calcule : qui travaille, qui est absent, mon prochain poste, les gardes, les heures, ce qui attend. */
function calculer(question: string, c: Contexte): Reponse | null {
  const q = simple(question);
  const a = (...mots: string[]): boolean => mots.some((m) => q.includes(m));
  const { data, today, moi, espace } = c;

  if (a('absent', 'absence', 'en conge', 'en arret', 'malade') && a('qui', 'combien', 'y a-t-il', 'y a t il')) {
    const jusqua = addDays(today, 6);
    const liste = data.absences.filter((x) => x.statut === 'approuvee' && x.to >= today && x.from <= jusqua).sort((x, y) => x.from.localeCompare(y.from));
    if (!liste.length) return { texte: 'Aucune absence prévue dans les sept prochains jours.' };
    return { texte: `${liste.length} absence${liste.length > 1 ? 's' : ''} sur sept jours :`, lignes: liste.map((x) => `${nom(data, x.personId)} · du ${fmtDateCourt(x.from)} au ${fmtDateCourt(x.to)}`), ...(espace === 'responsable' ? { bouton: { label: 'Voir les absences', aller: (ui: Ui) => { ui.setSujet('absences'); ui.aller('resoudre'); } } } : {}) };
  }

  if (a('qui') && a('travaille', 'en poste', 'present', 'la ', 'ouvre', 'ferme', 'equipe')) {
    const date = jourDe(question, today);
    const postes = postesVisibles(c, date).sort((x, y) => x.start - y.start);
    if (!postes.length) return { texte: `${quand(date, today)} : aucun poste ${espace === 'responsable' ? 'planifié' : 'publié'}.` };
    const parPersonne = new Map<string, Shift[]>();
    for (const s of postes) parPersonne.set(s.personId, (parPersonne.get(s.personId) ?? []).concat(s));
    return {
      texte: `${quand(date, today)}, ${parPersonne.size} personne${parPersonne.size > 1 ? 's' : ''} en poste :`,
      lignes: [...parPersonne.entries()].map(([id, l]) => `${nom(data, id)} · ${l.map((s) => `${fmtHeure(s.start)} – ${fmtHeure(s.end)}`).join(', ')}`),
      bouton: { label: 'Voir la journée', aller: (ui: Ui) => ui.voirJour(date) },
    };
  }

  if (a('garde', 'astreinte')) {
    const futures = data.gardes.filter((g) => g.date >= today && (espace === 'responsable' ? true : g.personId === moi)).sort((x, y) => x.date.localeCompare(y.date));
    if (!futures.length) return { texte: espace === 'responsable' ? 'Aucune garde à venir dans le calendrier.' : 'Vous n’avez aucune garde à venir.' };
    return {
      texte: espace === 'responsable' ? 'Les prochaines gardes :' : 'Vos prochaines gardes :',
      lignes: futures.slice(0, 4).map((g) => `${fmtDateCourt(g.date)} · ${libelleGarde(g)}${espace === 'responsable' ? ` · ${g.personId ? nom(data, g.personId) : 'à affecter'}` : ''}`),
      bouton: { label: 'Ouvrir les gardes', aller: (ui: Ui, e: Espace) => ui.aller(e === 'responsable' ? 'gardes' : 'mesgardes') },
    };
  }

  if (a('prochain poste', 'quand je travaille', 'quand est-ce que je travaille', 'mes horaires', 'je travaille quand', 'je commence')) {
    const semaines = [mondayOf(today), addDays(mondayOf(today), 7), addDays(mondayOf(today), 14)];
    const miens = semaines.flatMap((m) => (data.semaines[m]?.statut === 'publie' ? (data.semaines[m].snapshot ?? []) : [])).filter((s) => s.personId === moi && s.date >= today).sort((x, y) => x.date.localeCompare(y.date) || x.start - y.start);
    if (!miens.length) return { texte: 'Aucun poste publié à venir pour vous.', bouton: { label: 'Ouvrir mon planning', aller: (ui: Ui) => ui.aller('moi') } };
    return { texte: `Votre prochain poste : ${quand(miens[0].date, today).toLowerCase()}, ${fmtHeure(miens[0].start)} – ${fmtHeure(miens[0].end)}.`, lignes: miens.slice(1, 4).map((s) => `Puis ${fmtDateCourt(s.date)} · ${fmtHeure(s.start)} – ${fmtHeure(s.end)}`), bouton: { label: 'Ouvrir mon planning', aller: (ui: Ui) => ui.aller('moi') } };
  }

  // Les droits et les garde-fous : les règles actives, avec leurs seuils, telles qu'elles sont réglées dans l'officine.
  if (a('droit', 'regle', 'repos', 'maximum', 'pause', 'legal', 'convention', 'protege')) {
    const cles = ['duree.quotidienne', 'duree.hebdo', 'duree.pause', 'repos.quotidien', 'repos.hebdo', 'equipe.heuresMax', 'equipe.samedisLibres', 'delai.remplacement'];
    const lignes = cles
      .map((id) => data.regles.find((r) => r.id === id && r.active))
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map((r) => `${r.titre}${r.valeur !== undefined ? ` : ${r.valeur} ${r.unite ?? ''}`.trimEnd() : ''}`);
    return {
      texte: 'Ce que Solvéa vérifie pour protéger chacun, salariés comme titulaires :',
      lignes,
      ...(espace === 'responsable' ? { bouton: { label: 'Ouvrir les règles', aller: (ui: Ui) => ui.aller('regles') } } : {}),
      suites: ['Me faire remplacer sur un poste'].filter(() => espace !== 'responsable'),
    };
  }

  if (a('heure', 'compteur', 'supplementaire', 'recuper')) {
    if (espace === 'responsable') {
      const liste = aRegulariser(data, today);
      if (!liste.length) return { texte: 'Tous les compteurs d’heures sont à moins d’une heure du contrat.' };
      return { texte: `${liste.length} compteur${liste.length > 1 ? 's' : ''} à régulariser :`, lignes: liste.map((s) => `${nom(data, s.personId)} · ${s.solde > 0 ? '+' : '−'}${fmtDuree(Math.abs(s.solde))}`), bouton: { label: 'Ouvrir les heures', aller: (ui: Ui) => ui.aller('heures') } };
    }
    const p = data.personnes.find((x) => x.id === moi);
    if (p?.salarie) {
      const s = soldeHeures(data, p, today);
      const ecart = Math.abs(s.solde) >= 60;
      return { texte: ecart ? `Votre compteur : ${s.solde > 0 ? '+' : '−'}${fmtDuree(Math.abs(s.solde))} par rapport à votre contrat.` : 'Votre compteur d’heures est à jour.', bouton: { label: 'Ouvrir mon suivi', aller: (ui: Ui) => ui.aller('suivi') } };
    }
  }

  if (espace === 'responsable' && a('decider', 'decision', 'attend', 'a faire', 'quoi de neuf', 'urgent', 'en retard')) {
    const d = decisions(data, today);
    if (!d.total) return { texte: 'Rien n’attend votre décision.' };
    const lignes = [
      d.accords.length ? `${d.accords.length} accord${d.accords.length > 1 ? 's' : ''} à donner` : '',
      d.trous.length ? `${d.trous.length} poste${d.trous.length > 1 ? 's' : ''} à couvrir` : '',
      d.remplacements.length ? `${d.remplacements.length} demande${d.remplacements.length > 1 ? 's' : ''} de remplacement` : '',
      d.absences.length + d.besoins.length ? `${d.absences.length + d.besoins.length} demande${d.absences.length + d.besoins.length > 1 ? 's' : ''} de l’équipe` : '',
      d.gardesAAffecter.length ? `${d.gardesAAffecter.length} garde${d.gardesAAffecter.length > 1 ? 's' : ''} à affecter` : '',
      d.publications.length ? `${d.publications.length} planning${d.publications.length > 1 ? 's' : ''} à publier` : '',
    ].filter(Boolean);
    return { texte: `${d.total} décision${d.total > 1 ? 's' : ''} vous attend${d.total > 1 ? 'ent' : ''} :`, lignes, bouton: { label: 'Ouvrir « Résoudre »', aller: (ui: Ui) => ui.aller('resoudre') } };
  }

  if (espace === 'responsable' && a('publie', 'publication', 'publier') && a('quand', 'est-ce', 'est ce', 'deja', 'ou en')) {
    const lundi = mondayOf(today);
    return { texte: 'État des prochaines semaines :', lignes: [0, 1, 2, 3].map((w) => { const m = addDays(lundi, 7 * w); const n = data.shifts.filter((s) => dayIndex(s.date) >= dayIndex(m) && dayIndex(s.date) < dayIndex(m) + 7).length; return `Semaine du ${fmtDateCourt(m)} · ${data.semaines[m]?.statut === 'publie' ? 'publiée' : n ? 'en brouillon' : 'à construire'}`; }), bouton: { label: 'Ouvrir « Construire »', aller: (ui: Ui) => ui.aller('construire') } };
  }
  return null;
}

const BLAGUES = [
  'Pourquoi le planning dort-il si bien ? Parce qu’il a de bonnes gardes.',
  'Un préparateur dit à son planning : « Tu me couvres ? » Le planning répond : « De 8 h 30 à 16 h 30, pause comprise. »',
  'Quel est le comble pour un planning ? Ne pas trouver un créneau pour souffler.',
  'Je connais une blague sur les heures supplémentaires… mais je la garde pour plus tard, il faut d’abord la régulariser.',
];
const SECHES = [
  'Là, je sèche. Mes quatre lobes ont beau chauffer, je n’ai pas trouvé.',
  'Bonne question… à laquelle je n’ai pas trouvé de réponse. Mon rayon, c’est le planning.',
  'Je donne ma langue au chat. Enfin, si j’en avais une : je n’ai pas trouvé.',
  'Je n’ai pas trouvé, et pourtant j’ai regardé partout, même derrière le comptoir.',
];
/** Un choix qui change d'une question à l'autre, sans hasard : la même question reçoit la même réponse. */
const tirer = (liste: string[], graine: string): string => liste[[...graine].reduce((t, ch) => t + ch.charCodeAt(0), 0) % liste.length];

/**
 * La conversation courante : saluer, remercier, dire qui il est, plaisanter, dire ce qu'il ne fait pas.
 * Solvi reste honnête : il répond d'après des règles, sur l'appareil, et renvoie vers une personne quand il le faut.
 */
function converser(question: string, c: Contexte): Reponse | null {
  const q = ` ${simple(question).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const a = (...mots: string[]): boolean => mots.some((m) => q.includes(` ${m} `) || q.includes(` ${m}s `));
  const prenom = c.data.personnes.find((p) => p.id === c.moi)?.prenom ?? '';
  const debut = c.fiches.slice(0, 3).map((x) => x.question);
  if (a('support', 'assistance', 'bug', 'bogue', 'panne', 'plante', 'bloque', 'marche pas', 'fonctionne pas', 'erreur', 'reclamation', 'contacter quelqu un', 'parler a quelqu un', 'humain'))
    return { texte: 'Pour un souci que je ne sais pas régler, le mieux est d’en parler à une personne. Dites-lui ce que vous faisiez et ce qui s’est affiché.', support: true, humeur: 'inquiet', rang: 'limite' };
  if (a('ordonnance', 'medicament', 'posologie', 'dose', 'dosage', 'traitement', 'symptome', 'diagnostic', 'malade'))
    return { texte: 'Je ne donne aucun conseil médical ni pharmaceutique : je m’occupe du planning. Pour cela, voyez un pharmacien de l’équipe.', humeur: 'inquiet', rang: 'limite' };
  if (a('licenciement', 'prud hommes', 'avocat', 'proces', 'salaire', 'augmentation', 'prime', 'rupture conventionnelle', 'demission'))
    return { texte: 'Ce sujet dépasse le planning : voyez votre titulaire, votre expert-comptable ou un conseil en droit social. Je peux en revanche vous dire les règles d’horaires que j’applique.', suites: ['Quels sont mes droits ?'], humeur: 'intrigue', rang: 'limite' };
  if (a('blague', 'rire', 'humour', 'drole', 'rigole'))
    return { texte: tirer(BLAGUES, q), suites: ['Une autre blague'], humeur: 'joyeux' };
  if (a('qui es tu', 'tu es qui', 'ton nom', 't appelles', 'c est quoi solvi', 'qui est solvi', 'presente toi'))
    return { texte: 'Je suis Solvi, l’assistant de Solvéa. Je lis votre planning, je connais chaque écran et je vous y emmène. Je ne suis pas une intelligence artificielle qui devine : je réponds d’après des règles, sur cet appareil.', suites: debut, humeur: 'heureux' };
  if (a('intelligence artificielle', 'ia', 'robot', 'chatgpt', 'claude', 'vraie personne', 'es tu humain'))
    return { texte: 'Ni humain, ni intelligence artificielle qui improvise : je suis un assistant à règles. Je calcule sur votre planning et je connais l’application ; rien ne quitte cet appareil.', humeur: 'confiant' };
  if (a('que sais tu faire', 'tu sais faire quoi', 'a quoi tu sers', 'tu peux faire quoi', 'que peux tu faire', 'aide moi', 'aidez moi', 'help'))
    return { texte: 'Je sais dire qui travaille un jour donné, qui est absent, votre prochain poste, vos droits d’horaires, et vous montrer comment faire chaque chose dans Solvéa.', suites: debut, bouton: { label: 'Ouvrir l’aide', aller: (ui) => ui.aller('aide') }, humeur: 'heureux' };
  if (a('quelle heure', 'heure est il', 'l heure'))
    return { texte: `Il est ${new Date().toLocaleTimeString('fr-FR', { hour: 'numeric', minute: '2-digit' }).replace(':', ' h ')}. Pile le moment de regarder le planning.`, humeur: 'content' };
  if (a('quel jour', 'quelle date', 'on est quel', 'date du jour'))
    return { texte: `Nous sommes le ${fmtDateCourt(c.today)}.`, humeur: 'content' };
  if (a('meteo', 'temps qu il fait', 'pleut', 'soleil'))
    return { texte: 'Je n’ai pas de fenêtre, seulement un planning. Mais je peux vous dire qui travaille demain, qu’il pleuve ou non.', suites: ['Qui travaille demain ?'], humeur: 'joyeux' };
  if (a('merci', 'super', 'genial', 'parfait', 'bravo', 'top', 'je t aime', 'je t adore', 'tu es mignon'))
    return { texte: tirer(['Avec plaisir ! Ça me fait briller les lobes.', 'Merci ! Je flotte de joie.', 'Avec plaisir. Revenez quand vous voulez, je ne bouge pas d’ici.'], q), humeur: 'joyeux', rang: 'politesse' };
  if (a('nul', 'idiot', 'stupide', 'debile', 'con', 'merde', 'inutile', 'incapable'))
    return { texte: 'Aïe. Je fais de mon mieux avec mes quatre lobes. Dites-moi ce qui n’allait pas avec d’autres mots, ou parlez-en à une personne.', support: true, humeur: 'inquiet', rang: 'limite' };
  if (a('ca va', 'comment vas tu', 'comment allez vous', 'tu vas bien', 'la forme'))
    return { texte: 'Très bien : je flotte, je cligne des yeux, et votre planning tient debout. Une question ?', suites: debut, humeur: 'heureux', rang: 'politesse' };
  if (a('quel age', 'ton age', 'tu as quel age'))
    return { texte: 'Je suis tout neuf : assez jeune pour flotter, assez vieux pour lire un planning.', humeur: 'joyeux' };
  if (a('sens de la vie', '42'))
    return { texte: '42, bien sûr. Et pour le reste, il y a le planning.', humeur: 'confiant' };
  if (a('au revoir', 'a bientot', 'bonne journee', 'bonne soiree', 'bye', 'a plus', 'ciao'))
    return { texte: `À bientôt${prenom ? `, ${prenom}` : ''} ! Je reste dans mon coin si vous avez besoin de moi.`, humeur: 'content', rang: 'politesse' };
  if (a('bonjour', 'bonsoir', 'salut', 'coucou', 'hello', 'hey'))
    return { texte: `Bonjour${prenom ? ` ${prenom}` : ''} ! Que puis-je faire pour vous ?`, suites: debut, humeur: 'heureux', rang: 'politesse' };
  return null;
}

/**
 * La réponse de Solvi : ce qui se calcule sur le planning, puis la fiche d'aide qui correspond, puis la
 * conversation courante. S'il ne sait pas, il le dit avec le sourire et renvoie vers l'aide ou vers une personne.
 */
export function repondre(question: string, c: Contexte): Reponse {
  const parle = converser(question, c);
  // Santé, droit, panne : Solvi dit d'abord sa limite, avant tout calcul.
  if (parle?.rang === 'limite') return parle;
  const calcul = calculer(question, c);
  if (calcul) return calcul;
  const trouvees = chercher(c.fiches, question);
  // Une politesse cède la place à une vraie question d'usage ; le reste de la conversation passe d'abord.
  if (parle && (parle.rang !== 'politesse' || !trouvees.length)) return parle;
  if (trouvees.length) {
    const f = trouvees[0];
    return { texte: f.reponse, bouton: { label: f.bouton, aller: f.aller }, suites: trouvees.slice(1, 3).map((x) => x.question), humeur: 'content' };
  }
  if (parle) return parle;
  return {
    texte: `${tirer(SECHES, simple(question))} Essayez avec d’autres mots, ouvrez l’aide, ou parlez-en à une personne.`,
    suites: c.fiches.slice(0, 3).map((x) => x.question),
    bouton: { label: 'Ouvrir l’aide', aller: (ui) => ui.aller('aide') },
    support: true,
    humeur: 'confus',
  };
}

/** Les fiches utiles à un rôle : la gestion n'est pas proposée à l'équipe, ni les préférences en modèle classique. */
export const fichesPour = (espace: Espace, collaboratif: boolean): Fiche[] => FICHES.filter((f) => f.pour.includes(espace) && (collaboratif || (f.id !== 'souhaits' && f.id !== 'difference')));
