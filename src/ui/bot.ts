import type { Espace } from '../domain/acces';
import { libelleRole } from '../domain/acces';
import { MOIS, addDays, dayIndex, ferie, fmtDateCourt, fmtDuree, fmtHeure, joursFeries, mondayOf, todayISO } from '../domain/time';
import type { AppData, ISODate, Person, Shift } from '../domain/types';
import { estPharmacien, libelleAbsence, libelleGarde, nomCourt } from '../domain/types';
import { declarationsAFaire, delaiDeclaration } from '../engine/accident';
import { estFermeture, estOuverture, minutesSemaine, ouverture, trousPharmacien } from '../engine/core';
import { decisions } from '../engine/decisions';
import { etatPublication } from '../engine/echeance';
import { aRegulariser, soldeHeures } from '../engine/heures';
import { autreDuRdv, rdvARepondre, rdvAVenir } from '../engine/rdv';
import { arriveePrevue, dureeRetard, retardsDuJour } from '../engine/retard';
import { SUPPORT } from '../domain/support';
import { chiffresOfficine } from '../engine/officine';
import { useStore } from '../store/store';
import type { Vue } from '../store/ui';
import type { useUi } from '../store/ui';
import { contient, contientUn, jourCite, nettoyer, personnesCitees, semaineCitee, simple, voisin } from './langue';
import { LEXIQUE } from './lexique';

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
  { id: 'accueil', question: 'À quoi sert mon accueil ?', reponse: 'Votre accueil rassemble ce qui vous concerne : ce qui attend votre réponse, votre prochain poste, ce qui est propre à votre métier (marques d’un animateur, rayons, jours d’école, gardes, compétences), vos rendez-vous et vos raccourcis.', mots: 'accueil espace profil metier animateur etudiant apprenti rayonniste', pour: MOI_SEUL, ecrans: ['espace'], bouton: 'Ouvrir mon accueil', aller: (ui) => ui.aller('espace') },
  { id: 'rendez-vous', question: 'Demander un rendez-vous', reponse: 'Dans « Messages », ou sur votre accueil, « Demander un rendez-vous » : la personne, le sujet, le moment. Solvéa propose des moments où vous êtes tous les deux en poste. La demande part dans la conversation ; une fois acceptée, elle est fixée dans vos deux agendas. On peut aussi proposer un autre horaire, décliner ou annuler.', mots: 'rendez-vous rdv entretien point agenda tuteur bilan rencontrer', pour: TOUS, ecrans: ['messages', 'espace'], bouton: 'Ouvrir les messages', aller: (ui) => ui.aller('messages') },
  { id: 'marques', question: 'Choisir les marques d’un animateur', reponse: 'Dans « Équipe », ouvrez la fiche de l’animateur : « Marques présentées ». Prenez une marque dans le répertoire de la pharmacie, ou écrivez son nom si elle n’y est pas encore : elle rejoint le répertoire. Touchez ensuite les familles de produits qu’il anime pour elle. Pour un rayonniste, « Rayons confiés » fonctionne de la même façon. Chacun retrouve la liste sur son accueil.', mots: 'marque marques animateur animation produits familles rayons rayonniste laboratoire', pour: GESTION, ecrans: ['equipe'], bouton: 'Ouvrir l’équipe', aller: (ui) => ui.aller('equipe') },
  { id: 'souhaits', question: 'Donner mes préférences du mois', reponse: 'Choisissez une forme (matin, journée, après-midi, repos) puis cliquez les jours. « M’assister » remplit le reste d’après vos habitudes.', mots: 'preferences souhaits mois ideal assister matin apres-midi repos', pour: MOI_SEUL, ecrans: ['demandes', 'moi'], bouton: 'Donner mes préférences', aller: versDemandes('souhaits') },
  { id: 'conge', question: 'Poser un congé ou une contrainte d’horaires', reponse: 'Dans « Mes demandes », carte « Absence ou horaire ». Un raccourci (sortie d’école, cours du soir…) remplit les horaires. Une raison est toujours demandée, dans une liste ; seuls les titulaires la voient.', mots: 'absence vacances formation finir tot commencer tard indisponible religion enfant', pour: TOUS, ecrans: ['demandes', 'moi'], bouton: 'Faire une demande', aller: (ui) => ui.agir('demandes', 'demande') },
  { id: 'documents', question: 'Retrouver mes anciens plannings ou déposer un document', reponse: '« Mes documents » réunit vos plannings publiés, vos absences et arrêts, et les fichiers que vous déposez (arrêt de travail, attestation de formation). Un justificatif joint à une demande y est rangé une fois la demande réglée. Tout reste sur cet appareil.', mots: 'documents ged archive ancien planning arret attestation fichier deposer justificatif', pour: TOUS, ecrans: ['documents', 'moi'], bouton: 'Ouvrir mes documents', aller: (ui) => ui.aller('documents') },
  { id: 'remplacer', question: 'Me faire remplacer sur un poste', reponse: 'Dans « Mes demandes », carte « Me faire remplacer » : choisissez le poste, puis demandez à toute l’équipe ou à un collègue précis. Le calcul dit qui peut le reprendre, d’après les règles et ses heures de la semaine. Votre titulaire valide dans tous les cas.', mots: 'remplacement urgent medical justificatif arret malade empeche ceder echanger', pour: MOI_SEUL, ecrans: ['demandes', 'moi'], bouton: 'Demander un remplacement', aller: versDemandes('remplacements') },
  { id: 'retard-prevenir', question: 'Prévenir que je serai en retard', reponse: 'Sur votre accueil ou dans « Mon planning », sous votre prochain poste : « Prévenir d’un retard ». Touchez la durée, puis « Prévenir les titulaires » : ils reçoivent aussitôt une notification et un message, avec votre heure d’arrivée. Vous pouvez corriger la durée ou annuler l’avis.', mots: 'retard en retard prevenir bouchon train transport arriver tard avertir', pour: MOI_SEUL, ecrans: ['espace', 'moi'], bouton: 'Ouvrir mon accueil', aller: (ui) => ui.aller('espace') },
  { id: 'aider', question: 'Répondre à un appel ou aider un collègue', reponse: 'L’appel apparaît en tête de « Mon planning », avec votre rang dans le tour de rôle. « Je peux » ou « Je ne peux pas » : dire non ne change pas votre rang.', mots: 'volontaire depanner tour de role appel equipe je peux', pour: MOI_SEUL, ecrans: ['moi'], bouton: 'Voir les appels', aller: (ui) => ui.aller('moi') },
  { id: 'suivi', question: 'Voir mon compteur d’heures et mon suivi', reponse: '« Mon suivi » montre vos heures en plus ou en moins, ce qui a été noté sur douze mois et votre part des contraintes. Vous ne voyez que votre position.', mots: 'heures supplementaires compteur retards equite samedis', pour: MOI_SEUL, ecrans: ['suivi'], bouton: 'Ouvrir mon suivi', aller: (ui) => ui.aller('suivi') },
  { id: 'gardes-moi', question: 'Voir mes gardes', reponse: '« Mes gardes » liste vos gardes et astreintes, le repos qui suit et ce qui partira en paie.', mots: 'garde astreinte nuit dimanche repos', pour: ['pharmacien'], ecrans: ['mesgardes'], bouton: 'Ouvrir mes gardes', aller: (ui) => ui.aller('mesgardes') },
  { id: 'imprimer', question: 'Imprimer le planning', reponse: 'Le bouton d’impression ouvre un aperçu : la feuille telle qu’elle sortira, à la semaine ou au mois, en couleur ou en noir et blanc, pour toute l’équipe ou pour vos seuls postes. Elle indique si le planning est publié ou encore en brouillon.', mots: 'imprimer impression apercu papier feuille pdf afficher noir blanc couleur mois semaine', pour: TOUS, bouton: 'Ouvrir l’aperçu', aller: (ui) => ui.ouvrirImpression({ periode: 'semaine', repere: useStore.getState().today }) },
  { id: 'signaler', question: 'Signaler un retard ou une absence', reponse: '« Retard ou absence », en haut de l’écran, sert à tout le monde. Pour vous : la durée du retard ou les dates de l’absence, et les titulaires sont prévenus aussitôt. Un titulaire peut aussi le noter pour quelqu’un de l’équipe : le poste à couvrir part alors dans « Résoudre ».', mots: 'retard absence malade maladie prevenir signaler arret imprevu empeche bouton', pour: TOUS, ecrans: ['tableau', 'espace', 'moi'], bouton: 'Signaler', aller: (ui) => ui.signaler('choix') },
  { id: 'accident', question: 'Signaler un accident du travail ou de trajet', reponse: 'Dans « Retard ou absence », choisissez « Absence », puis la raison « Accident du travail » : le jour, l’heure, le lieu, ce qui s’est passé, un témoin. Le titulaire a ensuite 48 heures pour le déclarer à la caisse d’assurance maladie, dimanches et jours fériés non comptés : le tableau de bord affiche l’échéance et un bouton « C’est fait ».', mots: 'accident travail trajet blessure chute declaration cpam caisse 48 heures temoin', pour: TOUS, ecrans: ['tableau', 'resoudre'], bouton: 'Signaler une absence', aller: (ui) => ui.signaler('absence') },
  { id: 'support', question: 'Contacter le support', reponse: `Si ni l’aide, ni le lexique, ni Solvi ne répondent, une personne vous répond : ${SUPPORT.telephone} ou ${SUPPORT.email}. Ces coordonnées sont aussi en bas de chaque écran. Dites ce que vous faisiez et ce qui s’est affiché.`, mots: 'support assistance telephone numero mail courriel contact aide humain personne probleme bug panne question', pour: TOUS, ecrans: ['aide'], bouton: 'Voir les coordonnées', aller: (ui) => { ui.aller('aide'); window.setTimeout(() => document.getElementById('aide-support')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120); } },
  { id: 'message', question: 'Écrire à l’équipe ou à une personne', reponse: 'Un fil pour toute l’équipe et des conversations privées. Pour une absence, préférez une demande : elle est suivie.', mots: 'messages messagerie contacter prevenir', pour: TOUS, ecrans: ['messages'], bouton: 'Ouvrir les messages', aller: (ui) => ui.aller('messages') },
  { id: 'compte', question: 'Changer l’apparence, la taille du texte ou mon mot de passe', reponse: 'Dans « Mon compte » : trois apparences (claire, mixte avec le menu foncé, sombre), chacune montrée par une petite maquette, la taille du texte et le mot de passe. L’apparence se change aussi d’un geste depuis votre nom, en haut à droite. La couleur de l’espace est celle du profil ; seul le titulaire principal peut choisir la sienne, parmi dix.', mots: 'theme apparence sombre nuit clair mixte menu fonce maquette taille texte code couleur mode', pour: TOUS, ecrans: ['compte'], bouton: 'Ouvrir mon compte', aller: (ui) => ui.aller('compte') },

  { id: 'decisions', question: 'Savoir ce qui a été décidé, et ce que cela change', reponse: 'Chaque décision (congé, remplacement, horaires, publication, garde) est annoncée sous la cloche aux personnes concernées et aux titulaires, avec ce qu’elle change dans les plannings. « Vu » la range.', mots: 'notification cloche decision annonce prevenu changement approuve refuse', pour: TOUS, ecrans: ['tableau', 'moi'], bouton: 'Ouvrir l’accueil', aller: (ui, espace) => ui.aller(espace === 'responsable' ? 'tableau' : 'moi') },

  { id: 'tableau', question: 'Lire le tableau de bord', reponse: 'En haut, cinq repères : l’équipe du jour, le pharmacien présent, la semaine prochaine, les compteurs d’heures, la prochaine garde. Dessous, ce qu’il faut faire en premier, puis vos décisions, votre agenda et l’équipe au comptoir. Chaque carte mène à l’écran où cela se règle.', mots: 'tableau de bord accueil resume priorite a faire en premier chiffres agenda', pour: GESTION, ecrans: ['tableau'], bouton: 'Ouvrir le tableau de bord', aller: (ui) => ui.aller('tableau') },
  { id: 'creer', question: 'À quoi sert le bouton « Créer » ?', reponse: 'En haut de l’écran, « Créer » réunit ce que l’on ajoute le plus souvent : un poste, une personne, une formation, un inventaire, une garde, un message. Chaque choix ouvre directement la bonne fenêtre.', mots: 'creer ajouter nouveau raccourci plus bouton poste garde formation inventaire', pour: GESTION, ecrans: ['tableau', 'construire'], bouton: 'Ouvrir le tableau de bord', aller: (ui) => ui.aller('tableau') },
  { id: 'echeance', question: 'Préparer le mois avant l’échéance', reponse: 'Vous fixez dans « Réglages » le jour où le planning du mois suivant doit être publié. À l’approche, le tableau de bord le rappelle. « Préparer le mois » remplit les semaines vides en brouillon, d’après vos habitudes : rien n’est publié sans vous.', mots: 'echeance mois suivant date limite retard publier preparer rappel automatique habitudes', pour: GESTION, ecrans: ['tableau', 'officine'], bouton: 'Ouvrir le tableau de bord', aller: (ui) => ui.aller('tableau') },
  { id: 'propositions', question: 'Laisser Solvéa proposer une semaine', reponse: 'Dans « Construire », « Proposer » calcule plusieurs semaines complètes et les compare : la plus équitable, la plus fidèle aux préférences de l’équipe (ou à vos habitudes, si vous planifiez seul) et la moins coûteuse. Vous en choisissez une, puis vous la retouchez librement.', mots: 'proposer proposition propositions automatique calcul variantes equite cout habitudes generer remplir', pour: GESTION, ecrans: ['construire'], bouton: 'Ouvrir Construire', aller: (ui) => ui.aller('construire') },
  { id: 'pauses', question: 'Régler la pause déjeuner et les pauses courtes', reponse: 'Ouvrez un poste dans « Construire » : la pause déjeuner, non comptée en temps de travail, puis jusqu’à quatre pauses courtes de 10, 15 ou 20 minutes. « Une par demi-journée » les place pour vous. Elles figurent sur le planning de chacun et sur la feuille imprimée.', mots: 'pause pauses dejeuner repas cafe courte demi-journee coupure repos', pour: GESTION, ecrans: ['construire'], bouton: 'Ouvrir Construire', aller: (ui) => ui.aller('construire') },
  { id: 'qui-prepare', question: 'Construire seul ou avec l’équipe', reponse: 'Dans « Réglages », « Qui prépare le planning » : « Vous seul », et vous construisez d’après vos habitudes ; « Avec l’équipe », et chacun donne ses préférences du mois avant une date limite. Le choix se change à tout moment.', mots: 'seul equipe collaboratif classique preferences mode organisation qui prepare', pour: GESTION, ecrans: ['officine'], bouton: 'Ouvrir les réglages', aller: (ui) => ui.aller('officine') },
  { id: 'postes-types', question: 'Créer ou modifier un poste type', reponse: 'Dans « Réglages », « Postes types » : un nom, des horaires, une pause, une couleur. Un poste type se pose ensuite en un clic dans « Construire », et les propositions s’en servent.', mots: 'poste type modele horaires couleur matin apres-midi journee ouverture fermeture', pour: GESTION, ecrans: ['officine', 'construire'], bouton: 'Ouvrir les réglages', aller: (ui) => ui.aller('officine') },
  { id: 'officine-chiffres', question: 'Renseigner l’officine en chiffres', reponse: 'Dans « Réglages », « L’officine en chiffres » : surface totale, surface de vente, réserve, caisses, postes de comptoir, espaces de confidentialité, robot. Tout est facultatif. Solvéa signale ce qui ne colle pas, par exemple plus de personnes attendues que de postes de comptoir.', mots: 'surface metres carres vente reserve caisses comptoirs confidentialite robot automate locaux taille officine', pour: GESTION, ecrans: ['officine'], bouton: 'Ouvrir les réglages', aller: (ui) => ui.aller('officine') },
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
  { id: 'controles', question: 'Comprendre les alertes de la grille', reponse: 'Sous chaque jour, la ligne « Équipe au complet ? » l’écrit en mots : « Complet », « Pharmacien à prévoir » ou « Manque du monde », avec les heures et la cause (la pause d’un pharmacien, son départ). Titulaires et adjoints comptent tous comme pharmaciens. Un clic ouvre la journée pour corriger.', mots: 'alerte croix rouge barre couverture controle manque pharmacien effectif grille', pour: GESTION, ecrans: ['construire'], bouton: 'Ouvrir « Construire »', aller: (ui) => ui.aller('construire') },
  { id: 'historique', question: 'Conserver un justificatif et revoir les absences de l’équipe', reponse: 'Dans « Documents », onglet « Absences de l’équipe » : arrêts, congés, formations, remplacements et absences non prévues, par personne et par mois. « Joindre » range le justificatif ; seuls les titulaires et la personne le voient.', mots: 'justificatif arret maladie historique absences conserver piece archive volet employeur', pour: GESTION, ecrans: ['documents'], bouton: 'Ouvrir les documents', aller: (ui) => ui.aller('documents') },
  { id: 'points-forts', question: 'Voir les points forts de l’équipe', reponse: 'En bas de « Équipe », « Les points forts de l’équipe » réunit ce qui a été noté de positif sur douze mois : ponctualité, dépannages, réponses aux appels, part des samedis. Ni note ni classement ; arrêts et congés n’entrent jamais en compte.', mots: 'fiable fiables bons elements points forts ponctuel confiance mise en avant serieux', pour: GESTION, ecrans: ['equipe'], bouton: 'Ouvrir l’équipe', aller: (ui) => ui.aller('equipe') },
  { id: 'feries', question: 'Voir les jours fériés', reponse: 'Les jours fériés sont marqués dans la grille, le mois et les calendriers de chacun. Leur liste pour les douze prochains mois est dans « Réglages ».', mots: 'ferie feries 1er mai noel paques ascension toussaint armistice', pour: GESTION, ecrans: ['officine', 'construire'], bouton: 'Ouvrir les réglages', aller: (ui) => ui.aller('officine') },

  { id: 'pharmacie', question: 'Ajouter une autre pharmacie', reponse: 'Le titulaire principal ajoute autant de pharmacies qu’il veut. Le sélecteur, en haut du menu, passe de l’une à l’autre.', mots: 'plusieurs officines seconde pharmacie multi', pour: GESTION, bouton: 'Ajouter une pharmacie', aller: (ui) => ui.aller('nouvelle') },
];

export { simple };
const VIDES = new Set(['est', 'une', 'des', 'les', 'pour', 'que', 'qui', 'quoi', 'mon', 'mes', 'ma', 'sur', 'dans', 'avec', 'quelqu', 'comment', 'faire', 'veux', 'voudrais', 'peux', 'dois', 'faut', 'suis', 'sont', 'ont', 'demain', 'aujourd', 'hui', 'cette', 'ces', 'son', 'ses', 'par', 'pas', 'plus', 'tout', 'tous', 'toute', 'bonjour', 'bonsoir', 'salut', 'merci', 'svp', 'stp', 'plait', 'vous', 'nous', 'moi', 'toi', 'ton', 'tes', 'votre', 'vos', 'notre', 'leur', 'elle', 'ils', 'elles', 'ete', 'etre', 'avoir', 'fait', 'aux', 'du', 'de', 'la', 'le', 'un', 'et', 'ou', 'en', 'au', 'ce', 'se', 'je', 'tu', 'il', 'on', 'ne', 'me', 'te', 'ca', 'oui', 'non']);
const mots = (t: string): string[] => simple(t).split(/[^a-z0-9]+/).filter((m) => m.length >= 3 && !VIDES.has(m));
/** Deux mots se répondent s'ils partagent leur début (« remplacer » trouve « remplacement ») ou à une faute de frappe près. */
const proche = (a: string, b: string): boolean => {
  if (a === b || voisin(a, b)) return true;
  if (a.length < 4 || b.length < 4) return false;
  // Le début commun doit couvrir l'essentiel du mot le plus court : « charabia » ne trouve pas « charge ».
  let commun = 0;
  while (commun < a.length && commun < b.length && a[commun] === b[commun]) commun++;
  return commun >= Math.max(4, Math.ceil(Math.min(a.length, b.length) * 0.7));
};

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

/** Ce que Solvi retient d'une réponse à l'autre : de quoi on parlait, de qui, de quel jour, et ce qu'il vient de proposer. */
export interface Memoire {
  /** La dernière question calculée, sans son jour ni sa personne : « et demain ? » la rejoue. `{qui}` : la personne. */
  relance?: string;
  personne?: string;
  jour?: ISODate;
  /** Une question que Solvi vient de proposer : « oui » la pose. */
  propose?: string;
  /** Le dernier propos de conversation : « et toi ? » y répond. */
  propos?: string;
  /** Combien de fois de suite il n'a pas trouvé. */
  rates: number;
}

/** Ce que le bot répond : une phrase, parfois une liste, parfois un bouton qui y mène. */
export interface Reponse {
  texte: string;
  lignes?: string[];
  bouton?: { label: string; aller: (ui: Ui, espace: Espace) => void };
  /** Questions voisines, proposées à la suite. */
  suites?: string[];
  /** L'humeur de Solvi quand il donne cette réponse. */
  humeur?: 'heureux' | 'content' | 'joyeux' | 'intrigue' | 'confus' | 'surpris' | 'inquiet' | 'satisfait' | 'confiant' | 'excite' | 'triste' | 'fatigue' | 'concentre';
  /** Solvi renvoie vers une personne : le support, ou le titulaire. */
  support?: boolean;
  /** Une limite à dire avant tout le reste (santé, droit, panne), ou au contraire une simple politesse qui cède la place à une vraie question. */
  rang?: 'limite' | 'politesse';
  /** Ce qu'il faut retenir pour la question suivante. */
  memoire?: Memoire;
  /** De quoi parle cette réponse : sert à comprendre « et demain ? », « et Karim ? ». */
  suivi?: { relance: string; personne?: string; jour?: ISODate };
  /** Une question que la réponse propose : « oui » la pose. */
  propose?: string;
  /** Le propos tenu, pour « et toi ? ». */
  propos?: string;
}

interface Contexte {
  data: AppData;
  today: ISODate;
  moi: string;
  espace: Espace;
  fiches: Fiche[];
  /** Ce que Solvi a retenu des échanges précédents. */
  memoire?: Memoire;
  /** L'heure qu'il est, en minutes ; par défaut, celle de l'appareil. */
  heure?: number;
}

/** Le jour dont parle la question : aujourd'hui si elle n'en cite aucun. */
export function jourDe(question: string, today: ISODate): ISODate {
  return jourCite(question, today) ?? today;
}

/** Les postes qu'une personne a le droit de voir : le brouillon pour un responsable, le publié pour l'équipe. */
function postesVisibles(c: Contexte, date: ISODate): Shift[] {
  if (c.espace === 'responsable') return c.data.shifts.filter((s) => s.date === date);
  const semaine = c.data.semaines[mondayOf(date)];
  if (semaine?.statut !== 'publie') return [];
  // Une absence acceptée après la publication : la personne ne sera pas là, même si son poste est encore affiché.
  const absents = new Set(c.data.absences.filter((x) => x.statut === 'approuvee' && x.from <= date && date <= x.to).map((x) => x.personId));
  return (semaine.snapshot ?? []).filter((s) => s.date === date && !absents.has(s.personId));
}
/** « de Karim », « d’Inès ». */
const de = (prenom: string): string => (/^[aeiouyhàâéèêëîïôöûü]/i.test(prenom) ? `d’${prenom}` : `de ${prenom}`);
const semaineVisible = (c: Contexte, date: ISODate): boolean => c.espace === 'responsable' || c.data.semaines[mondayOf(date)]?.statut === 'publie';
const nom = (d: AppData, id: string | null | undefined): string => {
  const p = d.personnes.find((x) => x.id === id);
  return p ? nomCourt(p) : 'Quelqu’un';
};
const quand = (date: ISODate, today: ISODate): string =>
  date === today ? 'Aujourd’hui' : date === addDays(today, 1) ? 'Demain' : date === addDays(today, -1) ? 'Hier' : fmtDateCourt(date).replace(/^./, (x) => x.toUpperCase());
const horaires = (l: Shift[]): string =>
  l
    .slice()
    .sort((x, y) => x.start - y.start)
    .map((s) => `${fmtHeure(s.start)} – ${fmtHeure(s.end)}`)
    .join(', ');
const pluriel = (n: number, un: string, plusieurs: string): string => `${n} ${n > 1 ? plusieurs : un}`;
// Sur une date d'essai (qui n'est pas la date réelle), la journée n'a pas commencé : la réponse ne dépend pas de l'horloge.
const heureDe = (c: Contexte): number => c.heure ?? (c.today === todayISO() ? new Date().getHours() * 60 + new Date().getMinutes() : 0);
const versSignaler = (quoi: 'retard' | 'absence' | 'choix') => (ui: Ui): void => ui.signaler(quoi);

/** Les rubriques où Solvi sait emmener, par les mots qu'on emploie pour les nommer. */
const RUBRIQUES: { vue: Vue; nom: string; mots: string[]; pour: Espace[] }[] = [
  { vue: 'tableau', nom: 'Tableau de bord', mots: ['tableau de bord', 'accueil', 'dashboard'], pour: ['responsable'] },
  { vue: 'espace', nom: 'Accueil', mots: ['accueil', 'mon espace', 'mon accueil'], pour: ['pharmacien', 'equipe'] },
  { vue: 'construire', nom: 'Construire', mots: ['construire', 'grille', 'planning', 'semaine', 'brouillon'], pour: ['responsable'] },
  { vue: 'planning', nom: 'Planning de l’équipe', mots: ['planning de l equipe', 'planning equipe', 'planning global', 'planning de tout le monde'], pour: ['pharmacien', 'equipe'] },
  { vue: 'moi', nom: 'Mon planning', mots: ['mon planning', 'mes horaires', 'mon agenda', 'planning'], pour: ['responsable', 'pharmacien', 'equipe'] },
  { vue: 'demandes', nom: 'Mes demandes', mots: ['mes demandes', 'demandes', 'preferences'], pour: ['pharmacien', 'equipe'] },
  { vue: 'suivi', nom: 'Mon suivi', mots: ['mon suivi', 'suivi', 'mes compteurs'], pour: ['pharmacien', 'equipe'] },
  { vue: 'mesgardes', nom: 'Mes gardes', mots: ['mes gardes', 'gardes', 'astreintes'], pour: ['pharmacien', 'equipe'] },
  { vue: 'gardes', nom: 'Gardes', mots: ['gardes', 'tours de garde', 'astreintes'], pour: ['responsable'] },
  { vue: 'resoudre', nom: 'Résoudre', mots: ['resoudre', 'decisions', 'a decider'], pour: ['responsable'] },
  { vue: 'equipe', nom: 'Équipe', mots: ['equipe', 'fiches', 'collaborateurs', 'salaries'], pour: ['responsable'] },
  { vue: 'officine', nom: 'Réglages', mots: ['reglages', 'parametres', 'configuration', 'horaires d ouverture'], pour: ['responsable'] },
  { vue: 'regles', nom: 'Règles', mots: ['regles', 'textes'], pour: ['responsable'] },
  { vue: 'heures', nom: 'Heures', mots: ['heures', 'compteurs', 'regularisation'], pour: ['responsable'] },
  { vue: 'equite', nom: 'Équité', mots: ['equite', 'repartition'], pour: ['responsable'] },
  { vue: 'journal', nom: 'Journal et paie', mots: ['journal', 'paie', 'historique', 'export'], pour: ['responsable'] },
  { vue: 'messages', nom: 'Messages', mots: ['messages', 'messagerie', 'conversations', 'discussion'], pour: ['responsable', 'pharmacien', 'equipe'] },
  { vue: 'documents', nom: 'Documents', mots: ['documents', 'fichiers', 'justificatifs'], pour: ['responsable', 'pharmacien', 'equipe'] },
  { vue: 'compte', nom: 'Mon compte', mots: ['mon compte', 'mon profil', 'profil', 'compte'], pour: ['responsable', 'pharmacien', 'equipe'] },
  { vue: 'aide', nom: 'Aide et tutoriels', mots: ['aide', 'tutoriels', 'tutos', 'lexique'], pour: ['responsable', 'pharmacien', 'equipe'] },
];

/** Un petit calcul écrit en chiffres : « 35 + 4 », « 151,67 / 4 », « (12 + 3) x 2 ». Sans `eval`. */
export function calculette(texte: string): number | null {
  const brut = texte.toLowerCase().replace(/[×x]/g, '*').replace(/÷/g, '/').replace(/,/g, '.').replace(/\s+/g, '');
  const expr = brut.match(/[\d(][\d.+\-*/()]*[\d)]/)?.[0];
  if (!expr || !/[+\-*/]/.test(expr.slice(1))) return null;
  let i = 0;
  const nombre = (): number => {
    if (expr[i] === '(') {
      i++;
      const v = somme();
      if (expr[i] !== ')') throw new Error('parenthèse');
      i++;
      return v;
    }
    if (expr[i] === '-') {
      i++;
      return -nombre();
    }
    const m = expr.slice(i).match(/^\d+(\.\d+)?/);
    if (!m) throw new Error('nombre');
    i += m[0].length;
    return Number(m[0]);
  };
  const produit = (): number => {
    let v = nombre();
    while (expr[i] === '*' || expr[i] === '/') {
      const op = expr[i++];
      const d = nombre();
      v = op === '*' ? v * d : v / d;
    }
    return v;
  };
  const somme = (): number => {
    let v = produit();
    while (expr[i] === '+' || expr[i] === '-') {
      const op = expr[i++];
      const d = produit();
      v = op === '+' ? v + d : v - d;
    }
    return v;
  };
  try {
    const v = somme();
    return i === expr.length && Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  } catch {
    return null;
  }
}

/** Les jours sans poste d'une personne, parmi les semaines qu'elle peut voir. */
function joursDeRepos(c: Contexte, personId: string, combien = 3): ISODate[] {
  const out: ISODate[] = [];
  for (let k = 0; k < 28 && out.length < combien; k++) {
    const date = addDays(c.today, k);
    if (!semaineVisible(c, date) || !shiftsSemaineVisibles(c, date)) continue;
    if (!postesVisibles(c, date).some((s) => s.personId === personId)) out.push(date);
  }
  return out;
}
/** La semaine de cette date a-t-elle au moins un poste visible ? Une semaine vide n'est pas une semaine de repos. */
function shiftsSemaineVisibles(c: Contexte, date: ISODate): boolean {
  const lundi = mondayOf(date);
  for (let j = 0; j < 7; j++) if (postesVisibles(c, addDays(lundi, j)).length) return true;
  return false;
}

/** La journée d'une personne, dite en une phrase : ses postes, ou pourquoi elle n'en a pas. */
function journeeDe(c: Contexte, p: Person, date: ISODate): string {
  const { data, today, moi } = c;
  const sujet = p.id === moi ? 'Vous' : p.prenom;
  const verbe = (vous: string, il: string): string => (p.id === moi ? vous : il);
  const jour = quand(date, today).toLowerCase();
  const passe = date < today;
  if (!semaineVisible(c, date)) return `Le planning ${date === today ? 'd’aujourd’hui' : `du ${fmtDateCourt(date)}`} n’est pas encore publié.`;
  const postes = postesVisibles(c, date).filter((s) => s.personId === p.id);
  const garde = data.gardes.find((g) => g.personId === p.id && g.date === date);
  const suiteGarde = garde ? ` ${sujet} ${verbe('êtes', 'est')} aussi de garde (${libelleGarde(garde)}).` : '';
  if (postes.length) {
    const pause = postes.find((s) => s.pauseStart !== undefined && s.pauseEnd !== undefined);
    return `${sujet} ${verbe(passe ? 'travailliez' : 'travaillez', passe ? 'travaillait' : 'travaille')} ${jour} : ${horaires(postes)}${pause ? `, pause de ${fmtHeure(pause.pauseStart!)} à ${fmtHeure(pause.pauseEnd!)}` : ''}.${suiteGarde}`;
  }
  const absence = data.absences.find((a) => a.personId === p.id && a.statut === 'approuvee' && a.from <= date && date <= a.to);
  if (absence) {
    // La nature d'une absence ne regarde que la personne et ses titulaires.
    const nature = c.espace === 'responsable' || p.id === moi ? ` (${libelleAbsence(absence).toLowerCase()}, jusqu’au ${fmtDateCourt(absence.to)})` : ` jusqu’au ${fmtDateCourt(absence.to)}`;
    return `${sujet} ${verbe('êtes', 'est')} absent ${jour}${nature}.`;
  }
  if (!ouverture(data.officine, date).length) return `${quand(date, today)}, la pharmacie est fermée.${suiteGarde}`;
  return `${sujet} ${verbe('ne travaillez pas', 'ne travaille pas')} ${jour} : aucun poste ${c.espace === 'responsable' ? 'planifié' : 'publié'}.${suiteGarde}`;
}

/** Le point du jour : ce qui compte maintenant, pour la personne qui demande. */
function pointDuJour(c: Contexte): Reponse {
  const { data, today, moi, espace } = c;
  const p = data.personnes.find((x) => x.id === moi);
  const lignes: string[] = [];
  const mesPostes = postesVisibles(c, today).filter((s) => s.personId === moi);
  if (mesPostes.length) lignes.push(`Votre poste : ${horaires(mesPostes)}`);
  else {
    const prochain = [1, 2, 3, 4, 5, 6, 7].map((k) => addDays(today, k)).find((d) => postesVisibles(c, d).some((s) => s.personId === moi));
    lignes.push(prochain ? `Pas de poste aujourd’hui. Le prochain : ${quand(prochain, today).toLowerCase()}, ${horaires(postesVisibles(c, prochain).filter((s) => s.personId === moi))}` : 'Pas de poste aujourd’hui');
  }
  const rdv = rdvAVenir(data, moi, today).filter((r) => r.date <= addDays(today, 7));
  for (const r of rdv.slice(0, 2)) lignes.push(`Rendez-vous ${quand(r.date, today).toLowerCase()} à ${fmtHeure(r.start)} avec ${nom(data, autreDuRdv(r, moi))}${r.statut === 'propose' ? ' (à confirmer)' : ''}`);
  const garde = data.gardes.filter((g) => g.personId === moi && g.date >= today && g.date <= addDays(today, 7)).sort((x, y) => x.date.localeCompare(y.date))[0];
  if (garde) lignes.push(`Garde ${quand(garde.date, today).toLowerCase()} : ${libelleGarde(garde)}`);
  if (espace === 'responsable') {
    const enPoste = new Set(postesVisibles(c, today).map((s) => s.personId)).size;
    lignes.push(`${pluriel(enPoste, 'personne', 'personnes')} en poste aujourd’hui`);
    const absents = data.absences.filter((a) => a.statut === 'approuvee' && a.from <= today && today <= a.to);
    if (absents.length) lignes.push(`Absent${absents.length > 1 ? 's' : ''} : ${absents.map((a) => nom(data, a.personId)).join(', ')}`);
    const retards = retardsDuJour(data, today);
    if (retards.length) lignes.push(`Retard${retards.length > 1 ? 's' : ''} annoncé${retards.length > 1 ? 's' : ''} : ${retards.map((r) => `${nom(data, r.personId)} (${dureeRetard(r.minutes)})`).join(', ')}`);
    const d = decisions(data, today);
    if (d.total) lignes.push(`${pluriel(d.total, 'décision', 'décisions')} à prendre dans « Résoudre »`);
    const accidents = declarationsAFaire(data, today);
    if (accidents.length) lignes.push(`Accident du travail à déclarer : ${nom(data, accidents[0].absence.personId)}, ${delaiDeclaration(accidents[0].jours)}`);
    const pub = etatPublication(data, today);
    if (pub.etat === 'rappel' || pub.etat === 'depasse') lignes.push(`Planning de ${MOIS[Number(pub.mois.slice(5)) - 1]} : ${pub.etat === 'depasse' ? 'échéance dépassée' : `à publier avant le ${fmtDateCourt(pub.echeance)}`}, ${pluriel(pub.restantes, 'semaine restante', 'semaines restantes')}`);
  } else {
    const attente = data.absences.filter((a) => a.personId === moi && a.statut === 'demandee').length + data.besoins.filter((b) => b.personId === moi && b.decision === 'en_attente').length;
    if (attente) lignes.push(`${pluriel(attente, 'demande attend', 'demandes attendent')} la réponse de vos titulaires`);
    const aRepondre = rdvARepondre(data, moi, today).length;
    if (aRepondre) lignes.push(`${pluriel(aRepondre, 'rendez-vous attend', 'rendez-vous attendent')} votre réponse`);
  }
  return {
    texte: `Le point du ${fmtDateCourt(today)}${p ? `, ${p.prenom}` : ''} :`,
    lignes,
    bouton: espace === 'responsable' ? { label: 'Ouvrir le tableau de bord', aller: (ui) => ui.aller('tableau') } : { label: 'Ouvrir mon planning', aller: (ui) => ui.aller('moi') },
    suites: espace === 'responsable' ? ['Que dois-je décider ?', 'Qui travaille demain ?'] : ['Qui travaille avec moi demain ?', 'Mon prochain jour de repos ?'],
    humeur: 'confiant',
  };
}

/** Les questions dont la réponse se calcule : qui travaille, qui est absent, mon prochain poste, les gardes, les heures, ce qui attend. */
function calculer(question: string, c: Contexte, defaut: { jour?: ISODate } = {}): Reponse | null {
  const q = nettoyer(question);
  const a = (...m: string[]): boolean => contientUn(q, m);
  const { data, today, moi, espace } = c;
  const gestion = espace === 'responsable';
  const cite = jourCite(question, today);
  const date = cite ?? defaut.jour ?? today;
  const cites = personnesCitees(question, data).filter((p) => !p.externe || gestion);
  const autres = cites.filter((p) => p.id !== moi);
  const equipe = data.personnes.filter((p) => !p.externe);

  // Les urgences du quotidien d'abord : un retard, une absence, un accident. Solvi ouvre la bonne fenêtre.
  if (a('accident', 'blesse', 'blessee', 'blessure', 'je suis tombe', 'je suis tombee', 'chute', 'coupe', 'coupee', 'brule', 'brulee', 'entorse', 'pique', 'piquee')) {
    const aFaire = gestion ? declarationsAFaire(data, today) : [];
    return {
      texte: aFaire.length && !a('je me suis', 'je suis', 'vient de', 's est')
        ? `${pluriel(aFaire.length, 'accident du travail reste', 'accidents du travail restent')} à déclarer à la caisse d’assurance maladie :`
        : 'En cas d’urgence, appelez d’abord le 15 ou le 112. Ensuite, un accident du travail se signale tout de suite : je garde les faits et je rappelle le délai de déclaration.',
      lignes:
        aFaire.length && !a('je me suis', 'je suis', 'vient de', 's est')
          ? aFaire.map((x) => `${nom(data, x.absence.personId)} · au plus tard le ${fmtDateCourt(x.echeance)} · ${delaiDeclaration(x.jours)}`)
          : ['La personne fait constater ses blessures par un médecin', 'L’employeur déclare l’accident dans les 48 heures, dimanches et jours fériés non comptés', 'Il remet la feuille d’accident, qui évite l’avance des frais'],
      bouton: aFaire.length && !a('je me suis', 'je suis', 'vient de', 's est') ? { label: 'Ouvrir le tableau de bord', aller: (ui) => ui.aller('tableau') } : { label: 'Signaler un accident du travail', aller: versSignaler('absence') },
      humeur: 'inquiet',
    };
  }
  if (a('en retard', 'du retard', 'retard') && a('je suis', 'je serai', 'je vais', 'j aurai', 'j ai', 'j arrive', 'prevenir', 'signaler', 'declarer', 'mon retard', 'j arriverai'))
    return { texte: gestion ? 'Je vous ouvre la fenêtre : pour vous, ou pour une personne de l’équipe qui a prévenu.' : 'Pas de panique. Deux gestes suffisent : la durée, puis l’envoi. Vos titulaires sont prévenus aussitôt.', bouton: { label: 'Prévenir d’un retard', aller: versSignaler('retard') }, humeur: 'concentre' };
  if (a('je suis malade', 'je suis souffrant', 'je suis souffrante', 'je peux pas venir', 'je ne peux pas venir', 'je pourrai pas venir', 'je ne pourrai pas venir', 'je viens pas', 'je ne viens pas', 'je ne viendrai pas', 'je serai absent', 'je serai absente', 'signaler une absence', 'declarer une absence', 'arret maladie', 'en arret'))
    if (!a('qui', 'combien'))
      return { texte: `Prenez soin de vous. ${gestion ? 'L’absence s’enregistre en quelques gestes, et ses postes passent dans « Résoudre ».' : 'Signalez-le en quelques gestes : vos titulaires sont prévenus aussitôt et s’occupent de vos postes.'}`, bouton: { label: 'Signaler une absence', aller: versSignaler('absence') }, humeur: 'inquiet' };
  if (gestion && a('retard', 'retards') && a('qui', 'quelqu un', 'y a', 'combien', 'des')) {
    const liste = retardsDuJour(data, date);
    if (!liste.length) return { texte: `${quand(date, today)} : aucun retard annoncé.`, suivi: { relance: 'qui est en retard', jour: date }, humeur: 'satisfait' };
    return { texte: `${quand(date, today)}, ${pluriel(liste.length, 'retard annoncé', 'retards annoncés')} :`, lignes: liste.map((r) => `${nom(data, r.personId)} · ${dureeRetard(r.minutes)} · arrivée vers ${fmtHeure(arriveePrevue(r))}`), suivi: { relance: 'qui est en retard', jour: date } };
  }

  // Le point du jour.
  if (a('ma journee', 'point du jour', 'quoi de neuf', 'resume', 'recap', 'recapitulatif', 'briefing', 'on en est ou', 'ou en est on', 'quoi de prevu', 'programme du jour', 'au programme', 'les nouvelles')) return pointDuJour(c);

  // Un calcul : une durée entre deux heures, ou quelques chiffres.
  const plage = simple(question).match(/(\d{1,2}) ?h ?(\d{2})?\s*(?:a|-|jusqu a|jusqua|et)\s*(\d{1,2}) ?h ?(\d{2})?/);
  if (plage && a('combien', 'duree', 'ca fait', 'calcule', 'heures', 'temps') && !cites.length) {
    const debut = Number(plage[1]) * 60 + Number(plage[2] ?? 0);
    const fin = Number(plage[3]) * 60 + Number(plage[4] ?? 0);
    if (fin > debut) return { texte: `De ${fmtHeure(debut)} à ${fmtHeure(fin)}, cela fait ${fmtDuree(fin - debut)}.${fin - debut > 360 ? ' Au-delà de six heures, pensez à la pause.' : ''}`, humeur: 'confiant' };
  }
  // « 24/11 » est une date, « 151,67 / 4 » un calcul : la date s'écrit sans espace et sans autre signe.
  if (!plage && /\d\s*[+*x×÷/-]\s*\(?\d/.test(question) && !/^[^+*x×÷,-]*\b\d{1,2}\/\d{1,2}\b[^+*x×÷,-]*$/.test(question)) {
    const v = calculette(question);
    if (v !== null) return { texte: `Cela fait ${String(v).replace('.', ',')}.`, humeur: 'confiant' };
  }

  if (a('absent', 'absente', 'absents', 'absence', 'absences', 'en conge', 'en conges', 'en arret', 'malade', 'malades', 'en vacances') && a('qui', 'combien', 'y a t il', 'il y a', 'quelqu un', 'personne')) {
    const du = cite ?? today;
    const jusqua = cite ? du : addDays(today, 6);
    const liste = data.absences.filter((x) => x.statut === 'approuvee' && x.to >= du && x.from <= jusqua).sort((x, y) => x.from.localeCompare(y.from));
    const ou = cite ? quand(du, today) : 'Dans les sept prochains jours';
    const suivi = { relance: 'qui est absent', ...(cite ? { jour: cite } : {}) };
    if (!liste.length) return { texte: cite ? `${ou} : personne n’est absent.` : 'Aucune absence prévue dans les sept prochains jours.', suivi, humeur: 'satisfait' };
    return {
      texte: cite ? `${ou}, ${pluriel(liste.length, 'personne est absente', 'personnes sont absentes')} :` : `${liste.length} absence${liste.length > 1 ? 's' : ''} sur sept jours :`,
      lignes: liste.map((x) => `${nom(data, x.personId)} · du ${fmtDateCourt(x.from)} au ${fmtDateCourt(x.to)}${gestion ? ` · ${libelleAbsence(x).toLowerCase()}` : ''}`),
      ...(gestion ? { bouton: { label: 'Voir les absences', aller: (ui: Ui) => { ui.setSujet('absences'); ui.aller('resoudre'); } } } : {}),
      suivi,
    };
  }

  // Qui est cette personne ?
  if (autres.length && a('qui est', 'c est qui', 'qui c est', 'role de', 'fonction de', 'metier de', 'poste de', 'fait quoi comme')) {
    const p = autres[0];
    return { texte: `${p.prenom} ${p.nom} : ${libelleRole(data, p).toLowerCase()}${estPharmacien(p) && p.qualification !== 'titulaire' ? ', pharmacien' : ''}.`, suites: [`Quand travaille ${p.prenom} ?`], suivi: { relance: 'quand travaille {qui}', personne: p.id }, humeur: 'content' };
  }

  // Avec qui je travaille.
  if (a('avec qui', 'mes collegues', 'qui sera avec moi', 'qui est avec moi', 'qui travaille avec moi')) {
    const miens = postesVisibles(c, date).filter((s) => s.personId === moi);
    const suivi = { relance: 'avec qui je travaille', jour: date };
    if (!miens.length) return { texte: journeeDe(c, data.personnes.find((p) => p.id === moi)!, date), suivi };
    const avec = new Map<string, Shift[]>();
    for (const s of postesVisibles(c, date)) if (s.personId !== moi && miens.some((m) => s.start < m.end && m.start < s.end)) avec.set(s.personId, (avec.get(s.personId) ?? []).concat(s));
    if (!avec.size) return { texte: `${quand(date, today)}, vous êtes seul sur votre poste (${horaires(miens)}).`, suivi };
    return { texte: `${quand(date, today)} (${horaires(miens)}), vous travaillez avec :`, lignes: [...avec.entries()].map(([id, l]) => `${nom(data, id)} · ${horaires(l)}`), bouton: { label: 'Voir la journée', aller: (ui) => ui.voirJour(date) }, suivi };
  }

  // Une personne nommée : sa journée, ou ses prochains postes.
  if (autres.length && (a('travaille', 'travail', 'travaillent', 'present', 'presente', 'horaire', 'horaires', 'quand', 'planning', 'poste', 'postes', 'absent', 'absente', 'conge', 'vacances', 'arrive', 'finit', 'termine', 'commence', 'repos', 'disponible', 'ou est', 'est la', 'sera la', 'vient', 'est il', 'est elle', 'la') || mots(question).length <= 2)) {
    const p = autres[0];
    // « Où est Karim ? », « Karim est là ? » : on parle d'aujourd'hui.
    const maintenant = a('ou est', 'est la', 'est il la', 'est elle la', 'est present', 'est presente', 'est absent', 'est absente');
    const suivi = { relance: 'quand travaille {qui}', personne: p.id, ...(cite || defaut.jour || maintenant ? { jour: date } : {}) };
    if (cite || defaut.jour || maintenant) return { texte: journeeDe(c, p, date), bouton: { label: 'Voir la journée', aller: (ui) => ui.voirJour(date) }, suivi, suites: [`Et ${quand(addDays(date, 1), today).toLowerCase()} ?`] };
    const prochains: { date: ISODate; l: Shift[] }[] = [];
    for (let k = 0; k < 21 && prochains.length < 4; k++) {
      const l = postesVisibles(c, addDays(today, k)).filter((s) => s.personId === p.id);
      if (l.length) prochains.push({ date: addDays(today, k), l });
    }
    if (!prochains.length) return { texte: `Aucun poste ${gestion ? 'planifié' : 'publié'} à venir pour ${p.prenom}.`, suivi };
    return { texte: `Les prochains postes ${de(p.prenom)} :`, lignes: prochains.map((x) => `${quand(x.date, today)} · ${horaires(x.l)}`), suivi, suites: [`${p.prenom} est là demain ?`] };
  }

  // Les horaires d'ouverture de la pharmacie.
  if (a('pharmacie', 'officine', 'on ouvre', 'on ferme', 'horaires d ouverture') && a('quelle heure', 'horaire', 'horaires', 'ouvert', 'ouverte', 'ouvre', 'ferme', 'fermee', 'fermeture', 'ouverture') && !a('qui')) {
    const plages = ouverture(data.officine, date);
    const suivi = { relance: 'horaires de la pharmacie', jour: date };
    if (!plages.length) return { texte: `${quand(date, today)}, la pharmacie est fermée${ferie(date) ? ` (${ferie(date)})` : ''}.`, suivi };
    return { texte: `${quand(date, today)}, la pharmacie est ouverte de ${plages.map((i) => `${fmtHeure(i.start)} à ${fmtHeure(i.end)}`).join(' et de ')}.`, ...(gestion ? { bouton: { label: 'Ouvrir les réglages', aller: (ui: Ui) => ui.aller('officine') } } : {}), suivi };
  }

  if (a('surface', 'metres carres', 'metre carre', 'm2', 'superficie', 'taille de la pharmacie', 'taille de l officine', 'caisse', 'caisses', 'comptoirs', 'postes de comptoir', 'surface de vente', 'reserve', 'robot', 'automate', 'officine en chiffres', 'confidentialite')) {
    const chiffres = chiffresOfficine(data.officine);
    const reglages = gestion ? { bouton: { label: 'Ouvrir les réglages', aller: (ui: Ui) => ui.aller('officine') } } : {};
    return chiffres.length
      ? { texte: 'La pharmacie en chiffres :', lignes: chiffres.map((x) => x.charAt(0).toUpperCase() + x.slice(1)), ...reglages }
      : { texte: gestion ? 'Les chiffres de l’officine ne sont pas renseignés. Ils s’indiquent dans « Réglages », dans « L’officine en chiffres ».' : 'Les chiffres de l’officine ne sont pas renseignés.', ...reglages };
  }

  // Quel pharmacien est là ?
  if (a('pharmacien', 'pharmacienne', 'pharmaciens') && a('qui', 'quel', 'quelle', 'y a t il', 'il y a', 'present', 'est la', 'sera la')) {
    const liste = postesVisibles(c, date).filter((s) => { const p = data.personnes.find((x) => x.id === s.personId); return !!p && estPharmacien(p); });
    const suivi = { relance: 'quel pharmacien est la', jour: date };
    if (!semaineVisible(c, date)) return { texte: `Le planning du ${fmtDateCourt(date)} n’est pas encore publié.`, suivi };
    if (!liste.length) return { texte: `${quand(date, today)} : aucun pharmacien n’est planifié.`, suivi, humeur: 'inquiet' };
    const par = new Map<string, Shift[]>();
    for (const s of liste) par.set(s.personId, (par.get(s.personId) ?? []).concat(s));
    const trous = gestion ? trousPharmacien(data, date) : [];
    return {
      texte: `${quand(date, today)}, ${pluriel(par.size, 'pharmacien', 'pharmaciens')} :`,
      lignes: [...[...par.entries()].map(([id, l]) => `${nom(data, id)} · ${horaires(l)}`), ...(trous.length ? [`À prévoir : ${trous.map((i) => `${fmtHeure(i.start)} – ${fmtHeure(i.end)}`).join(', ')}`] : [])],
      bouton: { label: 'Voir la journée', aller: (ui) => ui.voirJour(date) },
      suivi,
    };
  }

  if (a('qui', 'combien', 'personne') && a('travaille', 'travaillent', 'en poste', 'present', 'presents', 'presente', 'est la', 'sera la', 'sont la', 'seront la', 'etait la', 'ouvre', 'ferme', 'ouverture', 'fermeture', 'equipe', 'sommes nous', 'on est', 'bosse') && !a('dans l equipe', 'equipe compte')) {
    const tous = postesVisibles(c, date).sort((x, y) => x.start - y.start);
    const ouvre = a('ouvre', 'ouverture');
    const ferme = a('ferme', 'fermeture');
    const postes = ouvre ? tous.filter((s) => estOuverture(data.officine, s)) : ferme ? tous.filter((s) => estFermeture(data.officine, s)) : tous;
    const suivi = { relance: ouvre ? 'qui ouvre' : ferme ? 'qui ferme' : 'qui travaille', jour: date };
    if (!postes.length) return { texte: `${quand(date, today)} : ${ouvre ? 'personne n’est planifié à l’ouverture' : ferme ? 'personne n’est planifié à la fermeture' : `aucun poste ${gestion ? 'planifié' : 'publié'}`}.`, suivi };
    const parPersonne = new Map<string, Shift[]>();
    for (const s of postes) parPersonne.set(s.personId, (parPersonne.get(s.personId) ?? []).concat(s));
    return {
      texte: `${quand(date, today)}, ${pluriel(parPersonne.size, 'personne', 'personnes')} ${ouvre ? 'à l’ouverture' : ferme ? 'à la fermeture' : 'en poste'} :`,
      lignes: [...parPersonne.entries()].map(([id, l]) => `${nom(data, id)} · ${l.map((s) => `${fmtHeure(s.start)} – ${fmtHeure(s.end)}`).join(', ')}`),
      bouton: { label: 'Voir la journée', aller: (ui: Ui) => ui.voirJour(date) },
      suivi,
      suites: [`Et ${quand(addDays(date, 1), today).toLowerCase()} ?`],
    };
  }

  if (a('garde', 'gardes', 'astreinte', 'astreintes') && !a('c est quoi', 'qu est ce', 'definition', 'veut dire', 'signifie', 'difference', 'comment', 'ajouter', 'repartir')) {
    // Un jour précis : la garde de ce jour-là, ou la suivante.
    if (cite) {
      const duJour = data.gardes.filter((g) => g.date === date && (gestion || g.personId === moi));
      if (duJour.length) return { texte: `${quand(date, today)} :`, lignes: duJour.map((g) => `${libelleGarde(g)} · ${g.personId === moi ? 'vous' : g.personId ? nom(data, g.personId) : 'à affecter'}`), bouton: { label: 'Ouvrir les gardes', aller: (ui: Ui, e: Espace) => ui.aller(e === 'responsable' ? 'gardes' : 'mesgardes') }, suivi: { relance: 'garde', jour: date } };
      const suivante = data.gardes.filter((g) => g.date > date && (gestion || g.personId === moi)).sort((x, y) => x.date.localeCompare(y.date))[0];
      return { texte: `${quand(date, today)} : ${gestion ? 'aucune garde au calendrier' : 'vous n’êtes pas de garde'}.${suivante ? ` La prochaine : ${fmtDateCourt(suivante.date)}, ${libelleGarde(suivante).toLowerCase()}${gestion ? `, ${suivante.personId ? nom(data, suivante.personId).replace(/\.$/, '') : 'à affecter'}` : ''}.` : ''}`, suivi: { relance: 'garde', jour: date } };
    }
    const futures = data.gardes.filter((g) => g.date >= today && (gestion ? true : g.personId === moi)).sort((x, y) => x.date.localeCompare(y.date));
    if (!futures.length) return { texte: gestion ? 'Aucune garde à venir dans le calendrier.' : 'Vous n’avez aucune garde à venir.' };
    return {
      texte: gestion ? 'Les prochaines gardes :' : 'Vos prochaines gardes :',
      lignes: futures.slice(0, 4).map((g) => `${fmtDateCourt(g.date)} · ${libelleGarde(g)}${gestion ? ` · ${g.personId ? nom(data, g.personId) : 'à affecter'}` : ''}`),
      bouton: { label: 'Ouvrir les gardes', aller: (ui: Ui, e: Espace) => ui.aller(e === 'responsable' ? 'gardes' : 'mesgardes') },
    };
  }

  if (a('rendez vous', 'entretien', 'entretiens', 'reunion', 'reunions')) {
    if (a('demander', 'prendre', 'fixer', 'proposer', 'comment')) return null;
    const liste = rdvAVenir(data, moi, today).sort((x, y) => x.date.localeCompare(y.date) || x.start - y.start);
    if (!liste.length) return { texte: 'Vous n’avez aucun rendez-vous à venir.', suites: ['Demander un rendez-vous'], bouton: { label: 'Ouvrir les messages', aller: (ui) => ui.aller('messages') } };
    return {
      texte: `Vos ${liste.length > 1 ? `${liste.length} rendez-vous` : 'rendez-vous'} à venir :`,
      lignes: liste.slice(0, 5).map((r) => `${quand(r.date, today)} · ${fmtHeure(r.start)} – ${fmtHeure(r.end)} · avec ${nom(data, autreDuRdv(r, moi))} · ${r.sujet}${r.statut === 'propose' ? ' (à confirmer)' : ''}`),
      bouton: { label: 'Ouvrir mon planning', aller: (ui) => ui.aller('moi') },
    };
  }

  if (a('jour de repos', 'jours de repos', 'en repos', 'jour off', 'jour libre', 'mon week end', 'quand je travaille pas', 'quand je ne travaille pas', 'journee libre', 'mon repos')) {
    const repos = joursDeRepos(c, moi);
    if (!repos.length) return { texte: 'Je ne vois pas de jour sans poste dans les plannings publiés à venir.', bouton: { label: 'Ouvrir mon planning', aller: (ui) => ui.aller('moi') } };
    return { texte: `Votre prochain jour sans poste : ${quand(repos[0], today).toLowerCase()}.`, lignes: repos.slice(1).map((d) => `Puis ${fmtDateCourt(d)}`), bouton: { label: 'Ouvrir mon planning', aller: (ui) => ui.aller('moi') }, humeur: 'heureux' };
  }

  if (a('mes conges', 'mes vacances', 'mes absences', 'mon conge', 'mes demandes', 'ma demande', 'ou en est ma demande', 'demande acceptee', 'reponse a ma demande') && !a('poser', 'comment', 'demander un', 'faire une')) {
    const miennes = data.absences.filter((x) => x.personId === moi && x.to >= today).sort((x, y) => x.from.localeCompare(y.from));
    const besoins = data.besoins.filter((b) => b.personId === moi && b.decision === 'en_attente').length;
    if (!miennes.length && !besoins) return { texte: 'Vous n’avez ni absence à venir ni demande en attente.', suites: ['Poser un congé ou une contrainte d’horaires'], bouton: { label: 'Ouvrir mes demandes', aller: versDemandes('absences') } };
    const etat = { demandee: 'en attente de réponse', approuvee: 'acceptée', refusee: 'refusée' } as const;
    return {
      texte: 'Vos absences et vos demandes :',
      lignes: [...miennes.slice(0, 5).map((x) => `${libelleAbsence(x)} · du ${fmtDateCourt(x.from)} au ${fmtDateCourt(x.to)} · ${etat[x.statut]}`), ...(besoins ? [`${pluriel(besoins, 'demande d’horaires', 'demandes d’horaires')} en attente de réponse`] : [])],
      bouton: { label: 'Ouvrir mes demandes', aller: versDemandes('absences') },
    };
  }

  if (a('prochain poste', 'quand je travaille', 'quand est ce que je travaille', 'mes horaires', 'je travaille quand', 'je commence', 'je finis', 'je termine', 'je travaille', 'mon planning', 'mon poste', 'ma semaine', 'est ce que je bosse', 'je reprends') && !a('ouvre', 'ouvrir', 'montre', 'affiche', 'comment', 'ou voir', 'ou est')) {
    const p = data.personnes.find((x) => x.id === moi);
    if (cite && p) return { texte: journeeDe(c, p, date), bouton: { label: 'Ouvrir mon planning', aller: (ui: Ui) => ui.aller('moi') }, suivi: { relance: 'quand je travaille', jour: date }, suites: [`Et ${quand(addDays(date, 1), today).toLowerCase()} ?`] };
    const maintenant = heureDe(c);
    const miens: Shift[] = [];
    for (let k = 0; k < 21; k++) miens.push(...postesVisibles(c, addDays(today, k)).filter((s) => s.personId === moi && (k > 0 || s.end > maintenant)));
    miens.sort((x, y) => x.date.localeCompare(y.date) || x.start - y.start);
    if (!miens.length) return { texte: 'Aucun poste publié à venir pour vous.', bouton: { label: 'Ouvrir mon planning', aller: (ui: Ui) => ui.aller('moi') } };
    const enCours = miens[0].date === today && miens[0].start <= maintenant;
    return {
      texte: enCours ? `Vous êtes en poste jusqu’à ${fmtHeure(miens[0].end)}.` : `Votre prochain poste : ${quand(miens[0].date, today).toLowerCase()}, ${fmtHeure(miens[0].start)} – ${fmtHeure(miens[0].end)}.`,
      lignes: miens.slice(1, 4).map((s) => `Puis ${fmtDateCourt(s.date)} · ${fmtHeure(s.start)} – ${fmtHeure(s.end)}`),
      bouton: { label: 'Ouvrir mon planning', aller: (ui: Ui) => ui.aller('moi') },
      suivi: { relance: 'quand je travaille' },
      suites: ['Qui travaille avec moi demain ?'],
    };
  }

  // Ma pause.
  if (a('ma pause', 'pause dejeuner', 'je mange', 'pause cafe', 'j ai faim', 'ma coupure') && !a('regle', 'droit', 'legal')) {
    const poste = postesVisibles(c, date).find((s) => s.personId === moi && s.pauseStart !== undefined && s.pauseEnd !== undefined);
    const mien = postesVisibles(c, date).filter((s) => s.personId === moi);
    const avecCourtes = postesVisibles(c, date).filter((s) => s.personId === moi && s.pauses?.length);
    const courtes = avecCourtes.flatMap((s) => s.pauses ?? []).sort((x, y) => x.start - y.start);
    const suiteCourtes = courtes.length ? ` Pause${courtes.length > 1 ? 's' : ''} courte${courtes.length > 1 ? 's' : ''} à ${courtes.map((x) => fmtHeure(x.start)).join(', ')}.` : '';
    if (poste) return { texte: `${quand(date, today)}, votre pause déjeuner est de ${fmtHeure(poste.pauseStart!)} à ${fmtHeure(poste.pauseEnd!)}.${suiteCourtes}`, humeur: 'heureux', suivi: { relance: 'ma pause', jour: date } };
    if (courtes.length && mien.length <= 1) return { texte: `${quand(date, today)}, pas de pause déjeuner sur votre poste.${suiteCourtes}`, humeur: 'heureux', suivi: { relance: 'ma pause', jour: date } };
    if (mien.length > 1) return { texte: `${quand(date, today)}, votre coupure est de ${fmtHeure(mien.sort((x, y) => x.start - y.start)[0].end)} à ${fmtHeure(mien[1].start)}.`, humeur: 'heureux', suivi: { relance: 'ma pause', jour: date } };
    return { texte: mien.length ? `${quand(date, today)}, aucune pause n’est notée sur votre poste (${horaires(mien)}).` : `${quand(date, today)}, vous n’avez pas de poste : la pause dure toute la journée.`, suivi: { relance: 'ma pause', jour: date } };
  }

  if (a('ferie', 'feries', 'pont', 'ponts', 'jour chome')) {
    const an = Number(today.slice(0, 4));
    const prochains = [...joursFeries(an), ...joursFeries(an + 1)].filter(([d]) => d >= today).sort((x, y) => x[0].localeCompare(y[0])).slice(0, 4);
    return { texte: `Le prochain jour férié : ${prochains[0][1]}, ${fmtDateCourt(prochains[0][0])}.`, lignes: prochains.slice(1).map(([d, n]) => `Puis ${n} · ${fmtDateCourt(d)}`), ...(gestion ? { bouton: { label: 'Ouvrir les réglages', aller: (ui: Ui) => ui.aller('officine') } } : {}) };
  }

  // L'équipe : combien, et qui fait quoi.
  if (a('dans l equipe', 'equipe compte', 'combien sommes nous', 'combien on est', 'combien de personnes', 'combien de salaries', 'l effectif') || (a('qui sont', 'liste', 'combien', 'quels sont') && a('pharmaciens', 'preparateurs', 'preparatrices', 'titulaires', 'apprentis', 'etudiants', 'adjoints', 'animateurs', 'rayonnistes', 'collaborateurs'))) {
    const familles: [string, (p: Person) => boolean][] = [
      ['titulaires', (p) => p.qualification === 'titulaire'],
      ['adjoints', (p) => p.qualification === 'adjoint'],
      ['pharmaciens', (p) => estPharmacien(p)],
      ['preparateurs', (p) => p.qualification === 'preparateur'],
      ['preparatrices', (p) => p.qualification === 'preparateur'],
      ['apprentis', (p) => p.qualification === 'apprenti'],
      ['etudiants', (p) => p.qualification === 'etudiant'],
      ['animateurs', (p) => p.qualification === 'animateur'],
      ['rayonnistes', (p) => p.qualification === 'rayonniste'],
    ];
    const famille = familles.find(([mot]) => a(mot));
    const liste = famille ? equipe.filter(famille[1]) : equipe;
    return {
      texte: famille ? `${pluriel(liste.length, 'personne', 'personnes')} dans cette fonction :` : `L’équipe compte ${pluriel(equipe.length, 'personne', 'personnes')} :`,
      lignes: liste.map((p) => `${nomCourt(p)} · ${libelleRole(data, p).toLowerCase()}`),
      ...(gestion ? { bouton: { label: 'Ouvrir l’équipe', aller: (ui: Ui) => ui.aller('equipe') } } : {}),
    };
  }

  // Les droits et les garde-fous : les règles actives, avec leurs seuils, telles qu'elles sont réglées dans l'officine.
  if (a('droit', 'droits', 'regle', 'regles', 'repos', 'maximum', 'pause', 'legal', 'legale', 'convention', 'protege', 'duree maximale', 'combien d heures maximum')) {
    const cles = ['duree.quotidienne', 'duree.hebdo', 'duree.pause', 'repos.quotidien', 'repos.hebdo', 'equipe.heuresMax', 'equipe.samedisLibres', 'delai.remplacement'];
    const lignes = cles
      .map((id) => data.regles.find((r) => r.id === id && r.active))
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map((r) => `${r.titre}${r.valeur !== undefined ? ` : ${r.valeur} ${r.unite ?? ''}`.trimEnd() : ''}`);
    return {
      texte: 'Ce que Solvéa vérifie pour protéger chacun, salariés comme titulaires :',
      lignes,
      ...(gestion ? { bouton: { label: 'Ouvrir les règles', aller: (ui: Ui) => ui.aller('regles') } } : {}),
      suites: ['Me faire remplacer sur un poste'].filter(() => !gestion),
    };
  }

  // Mes heures de la semaine.
  if (a('combien d heures', 'mes heures', 'heures cette semaine', 'heures je fais', 'heures je travaille', 'volume horaire') && a('semaine', 'je fais', 'je travaille', 'prevu', 'prevues', 'planifie', 'planifiees') && !gestion) {
    const lundi = addDays(mondayOf(today), 7 * (semaineCitee(question) ?? 0));
    const p = data.personnes.find((x) => x.id === moi);
    if (!semaineVisible(c, lundi)) return { texte: `Le planning de la semaine du ${fmtDateCourt(lundi)} n’est pas encore publié.` };
    const minutes = minutesSemaine({ shifts: data.semaines[lundi]?.snapshot ?? data.shifts }, moi, lundi);
    return { texte: `Semaine du ${fmtDateCourt(lundi)} : ${fmtDuree(minutes)} planifiées${p?.salarie ? `, pour un contrat de ${p.heuresHebdo} h` : ''}.`, bouton: { label: 'Ouvrir mon suivi', aller: (ui: Ui) => ui.aller('suivi') }, suites: ['Mon compteur d’heures ?'] };
  }

  if (a('heure', 'heures', 'compteur', 'compteurs', 'supplementaire', 'supplementaires', 'recuperation', 'recuperer', 'recup') && !a('quelle heure', 'a quelle', 'heure est il', 'l heure')) {
    if (gestion) {
      const liste = aRegulariser(data, today);
      if (!liste.length) return { texte: 'Tous les compteurs d’heures sont à moins d’une heure du contrat.', humeur: 'satisfait' };
      return { texte: `${liste.length} compteur${liste.length > 1 ? 's' : ''} à régulariser :`, lignes: liste.map((s) => `${nom(data, s.personId)} · ${s.solde > 0 ? '+' : '−'}${fmtDuree(Math.abs(s.solde))}`), bouton: { label: 'Ouvrir les heures', aller: (ui: Ui) => ui.aller('heures') } };
    }
    const p = data.personnes.find((x) => x.id === moi);
    if (p?.salarie) {
      const s = soldeHeures(data, p, today);
      const ecart = Math.abs(s.solde) >= 60;
      return { texte: ecart ? `Votre compteur : ${s.solde > 0 ? '+' : '−'}${fmtDuree(Math.abs(s.solde))} par rapport à votre contrat.` : 'Votre compteur d’heures est à jour.', bouton: { label: 'Ouvrir mon suivi', aller: (ui: Ui) => ui.aller('suivi') } };
    }
  }

  if (gestion && a('decider', 'decision', 'decisions', 'attend', 'a faire', 'urgent', 'urgence', 'urgences', 'priorite', 'priorites', 'par quoi commencer', 'quoi faire')) {
    const d = decisions(data, today);
    const accidents = declarationsAFaire(data, today);
    if (!d.total && !accidents.length) return { texte: 'Rien n’attend votre décision.', humeur: 'satisfait' };
    const lignes = [
      accidents.length ? `${pluriel(accidents.length, 'accident du travail', 'accidents du travail')} à déclarer, ${delaiDeclaration(accidents[0].jours)}` : '',
      d.accords.length ? `${d.accords.length} accord${d.accords.length > 1 ? 's' : ''} à donner` : '',
      d.trous.length ? `${d.trous.length} poste${d.trous.length > 1 ? 's' : ''} à couvrir` : '',
      d.remplacements.length ? `${d.remplacements.length} demande${d.remplacements.length > 1 ? 's' : ''} de remplacement` : '',
      d.absences.length + d.besoins.length ? `${d.absences.length + d.besoins.length} demande${d.absences.length + d.besoins.length > 1 ? 's' : ''} de l’équipe` : '',
      d.gardesAAffecter.length ? `${d.gardesAAffecter.length} garde${d.gardesAAffecter.length > 1 ? 's' : ''} à affecter` : '',
      d.publications.length ? `${d.publications.length} planning${d.publications.length > 1 ? 's' : ''} à publier` : '',
    ].filter(Boolean);
    return { texte: d.total ? `${d.total} décision${d.total > 1 ? 's' : ''} vous attend${d.total > 1 ? 'ent' : ''} :` : 'Aucune décision en attente, mais une déclaration à faire :', lignes, bouton: { label: 'Ouvrir « Résoudre »', aller: (ui: Ui) => ui.aller('resoudre') } };
  }

  if (gestion && a('echeance', 'mois prochain', 'planning du mois', 'date limite', 'avant quand', 'quand publier', 'delai de publication')) {
    const pub = etatPublication(data, today);
    const mois = MOIS[Number(pub.mois.slice(5)) - 1];
    const faites = pub.semaines.length - pub.restantes;
    const etat = { publie: `Le planning de ${mois} est entièrement publié.`, tranquille: `Rien ne presse : le planning de ${mois} est à publier avant le ${fmtDateCourt(pub.echeance)}.`, rappel: `Le planning de ${mois} est à publier avant le ${fmtDateCourt(pub.echeance)} : il reste ${pluriel(Math.max(pub.jours, 0), 'jour', 'jours')}.`, depasse: `L’échéance du planning de ${mois} est dépassée depuis le ${fmtDateCourt(pub.echeance)}.` }[pub.etat];
    return {
      texte: etat,
      lignes: pub.etat === 'publie' ? [] : [`${faites} semaine${faites > 1 ? 's' : ''} publiée${faites > 1 ? 's' : ''} sur ${pub.semaines.length}`, ...(pub.vides ? [`${pluriel(pub.vides, 'semaine vide', 'semaines vides')} : Solvéa peut ${pub.vides > 1 ? 'les' : 'la'} préparer d’après vos habitudes`] : [])],
      bouton: { label: 'Ouvrir le mois', aller: (ui: Ui) => { ui.setPlanVue('mois'); ui.aller('construire'); } },
      humeur: pub.etat === 'depasse' ? 'inquiet' : 'confiant',
    };
  }

  if (gestion && a('publie', 'publiee', 'publication', 'publier', 'publies') && a('quand', 'est ce', 'deja', 'ou en', 'etat', 'quelles', 'quels')) {
    const lundi = mondayOf(today);
    return { texte: 'État des prochaines semaines :', lignes: [0, 1, 2, 3].map((w) => { const m = addDays(lundi, 7 * w); const n = data.shifts.filter((s) => dayIndex(s.date) >= dayIndex(m) && dayIndex(s.date) < dayIndex(m) + 7).length; return `Semaine du ${fmtDateCourt(m)} · ${data.semaines[m]?.statut === 'publie' ? 'publiée' : n ? 'brouillon' : 'à construire'}`; }), bouton: { label: 'Ouvrir « Construire »', aller: (ui: Ui) => ui.aller('construire') } };
  }

  // « Ouvre les gardes », « emmène-moi aux réglages » : Solvi y conduit.
  if (a('ouvre', 'ouvrir', 'ouvrez', 'va', 'aller', 'allons', 'montre', 'montrer', 'montrez', 'affiche', 'afficher', 'emmene', 'amene', 'acceder', 'direction', 'je veux voir', 'ou se trouve', 'ou trouver', 'ou sont', 'ou est', 'rends toi')) {
    const possibles = RUBRIQUES.filter((r) => r.pour.includes(espace));
    // Le nom le plus long l'emporte : « planning de l'équipe » avant « planning ».
    const trouvee = possibles.flatMap((r) => r.mots.map((m) => ({ r, m }))).filter((x) => contient(q, x.m)).sort((x, y) => y.m.length - x.m.length)[0];
    if (trouvee) return { texte: `« ${trouvee.r.nom} » : je vous y emmène.`, bouton: { label: `Ouvrir « ${trouvee.r.nom} »`, aller: (ui) => ui.aller(trouvee.r.vue) }, humeur: 'content' };
  }
  return null;
}

const BLAGUES = [
  'Pourquoi le planning dort-il si bien ? Parce qu’il a de bonnes gardes.',
  'Un préparateur dit à son planning : « Tu me couvres ? » Le planning répond : « De 8 h 30 à 16 h 30, pause comprise. »',
  'Quel est le comble pour un planning ? Ne pas trouver un créneau pour souffler.',
  'Je connais une blague sur les heures supplémentaires… mais je la garde pour plus tard, il faut d’abord la régulariser.',
  'Que dit un planning à un autre planning ? « On se fait une semaine, un de ces quatre ? »',
  'J’ai voulu poser un congé. On m’a répondu que je flottais déjà toute la journée.',
];
const SECHES = [
  'Là, je sèche. Mes quatre lobes ont beau chauffer, je n’ai pas trouvé.',
  'Bonne question… à laquelle je n’ai pas trouvé de réponse. Mon rayon, c’est le planning.',
  'Je donne ma langue au chat. Enfin, si j’en avais une : je n’ai pas trouvé.',
  'Je n’ai pas trouvé, et pourtant j’ai regardé partout, même derrière le comptoir.',
];
/** Un choix qui change d'une question à l'autre, sans hasard : la même question reçoit la même réponse. */
const tirer = (liste: string[], graine: string): string => liste[[...graine].reduce((t, ch) => t + ch.charCodeAt(0), 0) % liste.length];

/** Ce que Solvi sait faire, dit selon le rôle. */
const savoirFaire = (espace: Espace): string[] =>
  espace === 'responsable'
    ? ['Dire qui travaille, qui ouvre, qui ferme, quel pharmacien est là, un jour donné', 'Suivre une personne : « Quand travaille … ? », « … est là samedi ? »', 'Résumer ce qui attend : décisions, retards, absences, échéance du mois', 'Ouvrir un écran ou une fenêtre : « ouvre les gardes », « signaler un retard »', 'Expliquer chaque geste de Solvéa, et vos règles d’horaires']
    : ['Dire votre prochain poste, votre pause, vos jours de repos, vos rendez-vous', 'Dire qui travaille avec vous, un jour donné', 'Prévenir d’un retard ou d’une absence en deux gestes', 'Suivre vos demandes et votre compteur d’heures', 'Expliquer chaque geste de Solvéa, et vos droits d’horaires'];

/**
 * La conversation courante : saluer, remercier, dire qui il est, plaisanter, écouter, dire ce qu'il ne fait pas.
 * Solvi reste honnête : il répond d'après des règles, sur l'appareil, et renvoie vers une personne quand il le faut.
 */
function converser(question: string, c: Contexte): Reponse | null {
  const q = nettoyer(question);
  const a = (...m: string[]): boolean => contientUn(q, m);
  const moi = c.data.personnes.find((p) => p.id === c.moi);
  const prenom = moi?.prenom ?? '';
  const virgule = prenom ? `, ${prenom}` : '';
  const debut = c.fiches.slice(0, 3).map((x) => x.question);
  const gestion = c.espace === 'responsable';
  const utile = gestion ? ['Que dois-je décider ?', 'Qui travaille demain ?'] : ['Mon prochain poste ?', 'Qui travaille demain ?'];

  if (a('support', 'assistance', 'bug', 'bogue', 'panne', 'plante', 'bloque', 'bloquee', 'marche pas', 'marche plus', 'fonctionne pas', 'fonctionne plus', 'erreur', 'reclamation', 'contacter quelqu un', 'parler a quelqu un', 'un humain', 'vraie personne au telephone', 'ecran blanc', 'ca bug', 'ca beugue'))
    return { texte: 'Pour un souci que je ne sais pas régler, le mieux est d’en parler à une personne. Dites-lui ce que vous faisiez et ce qui s’est affiché.', support: true, humeur: 'inquiet', rang: 'limite' };
  if (a('ordonnance', 'medicament', 'medicaments', 'posologie', 'dose', 'dosage', 'traitement', 'symptome', 'symptomes', 'diagnostic', 'contre indication', 'effet secondaire', 'effets secondaires', 'interaction', 'antibiotique', 'vaccin contre'))
    return { texte: 'Je ne donne aucun conseil médical ni pharmaceutique : je m’occupe du planning. Pour cela, voyez un pharmacien de l’équipe.', humeur: 'inquiet', rang: 'limite' };
  if (a('licenciement', 'licencier', 'prud hommes', 'avocat', 'proces', 'salaire', 'salaires', 'augmentation', 'prime', 'rupture conventionnelle', 'demission', 'demissionner', 'fiche de paie', 'bulletin de salaire', 'harcelement', 'inspection du travail'))
    return { texte: 'Ce sujet dépasse le planning : voyez votre titulaire, votre expert-comptable ou un conseil en droit social. Je peux en revanche vous dire les règles d’horaires que j’applique.', suites: ['Quels sont mes droits ?'], humeur: 'intrigue', rang: 'limite' };
  // Une détresse dite clairement : Solvi ne plaisante pas, et oriente vers une personne.
  if (a('envie de mourir', 'me suicider', 'suicide', 'en finir', 'plus envie de vivre', 'me faire du mal'))
    return { texte: `Ce que vous écrivez compte${virgule}. Je ne suis qu’un assistant de planning, mais vous n’êtes pas seul : le 3114, numéro national de prévention du suicide, répond jour et nuit, gratuitement. En cas de danger immédiat, appelez le 15 ou le 112. Et parlez-en à une personne de confiance.`, humeur: 'inquiet', rang: 'limite' };

  if (a('blague', 'blagues', 'rire', 'humour', 'drole', 'rigole', 'rigoler', 'fais moi rire', 'une autre', 'encore une', 'je m ennuie', 'distrais moi'))
    return { texte: tirer(BLAGUES, q + (c.memoire?.propos === 'blague' ? 'x' : '')), suites: ['Une autre blague'], humeur: 'joyeux', propos: 'blague' };
  if (a('haha', 'hihi', 'hehe', 'trop drole', 'tu es drole', 'elle est bonne', 'pas mal celle la'))
    return { texte: tirer(['Ravi de vous faire sourire. J’en ai d’autres en réserve.', 'Hi hi ! Mes lobes en frétillent.', 'Un sourire au comptoir, c’est déjà une bonne journée.'], q), suites: ['Une autre blague'], humeur: 'joyeux', rang: 'politesse', propos: 'blague' };

  if (a('qui es tu', 'tu es qui', 't es qui', 'ton nom', 't appelles', 'c est quoi solvi', 'qui est solvi', 'presente toi', 'comment tu t appelle', 'tu es quoi', 'c est qui solvi'))
    return { texte: 'Je suis Solvi, l’assistant de Solvéa. Je lis votre planning, je connais chaque écran et je vous y emmène. Je ne suis pas une intelligence artificielle qui devine : je réponds d’après des règles, sur cet appareil.', suites: debut, humeur: 'heureux' };
  if (a('intelligence artificielle', 'ia', 'robot', 'chatgpt', 'gpt', 'claude', 'gemini', 'vraie personne', 'es tu humain', 'tu es humain', 'un humain', 'tu es vivant', 'es tu vivant', 'tu es reel', 'es tu reel', 'une machine', 'un programme', 'un bot'))
    return { texte: 'Ni humain, ni intelligence artificielle qui improvise : je suis un assistant à règles. Je calcule sur votre planning et je connais l’application ; rien ne quitte cet appareil.', humeur: 'confiant' };
  if (a('qui t a cree', 'qui t a fait', 'qui t a invente', 'qui t a fabrique', 'd ou viens tu', 'tu viens d ou', 'tes parents', 'ton createur', 'qui t a programme'))
    return { texte: 'Je suis né avec Solvéa : on m’a dessiné quatre lobes, appris à lire un planning, et demandé de ne jamais inventer ce que je ne sais pas.', humeur: 'heureux' };
  if (a('ou es tu', 'tu es ou', 'tu habites ou', 'ou habites tu', 'ou vis tu', 'tu vis ou'))
    return { texte: 'Ici même, dans cet appareil, en bas à droite de l’écran. C’est petit, mais la vue sur le planning est imprenable.', humeur: 'joyeux' };
  if (a('mes donnees', 'nos donnees', 'vie privee', 'confidentiel', 'confidentialite', 'rgpd', 'tu m espionnes', 'tu m ecoutes', 'tu enregistres', 'ou vont', 'qui voit') && a('donnees', 'vie privee', 'confidentiel', 'confidentialite', 'rgpd', 'espionnes', 'ecoutes', 'enregistres', 'questions', 'conversation', 'messages'))
    return { texte: 'Vos données restent dans ce navigateur, sur cet appareil. Notre conversation aussi : je réponds d’après des règles, sans rien envoyer ailleurs, et je l’oublie quand vous fermez l’application.', humeur: 'confiant' };
  if (a('que sais tu faire', 'tu sais faire quoi', 'a quoi tu sers', 'tu sers a quoi', 'tu peux faire quoi', 'que peux tu faire', 'aide moi', 'aidez moi', 'help', 'tu peux m aider', 'peux tu m aider', 'j ai besoin d aide', 'besoin d aide', 'comment ca marche', 'que puis je te demander', 'quoi te demander', 'tes competences', 'tu fais quoi'))
    return { texte: `Bien sûr${virgule}. Voici ce que je sais faire :`, lignes: savoirFaire(c.espace), suites: [gestion ? 'Ma journée' : 'Ma journée', ...utile.slice(0, 2)], bouton: { label: 'Ouvrir l’aide', aller: (ui) => ui.aller('aide') }, humeur: 'heureux' };

  // Qui suis-je, pour Solvi ?
  if (a('comment je m appelle', 'qui suis je', 'mon nom', 'mon prenom', 'tu me connais', 'tu sais qui je suis', 'mon role', 'ma fonction', 'quel est mon poste') && moi)
    return { texte: `Vous êtes ${moi.prenom} ${moi.nom}, ${libelleRole(c.data, moi).toLowerCase()}. Je vous reconnais à votre session, pas à votre visage : je n’ai pas d’yeux pour cela.`, suites: utile, humeur: 'heureux' };

  if (a('quelle heure', 'heure est il', 'l heure qu il est', 'il est quelle heure'))
    return { texte: `Il est ${fmtHeure(heureDe(c))}. Pile le moment de regarder le planning.`, humeur: 'content' };
  if (a('quel jour', 'quelle date', 'on est quel', 'date du jour', 'on est le combien', 'quel jour sommes nous'))
    return { texte: `Nous sommes le ${fmtDateCourt(c.today)}${ferie(c.today) ? `, jour férié (${ferie(c.today)})` : ''}.`, humeur: 'content' };
  if (a('meteo', 'temps qu il fait', 'pleut', 'pleuvoir', 'soleil', 'neige', 'il fait beau', 'il fait froid', 'il fait chaud'))
    return { texte: 'Je n’ai pas de fenêtre, seulement un planning. Mais je peux vous dire qui travaille demain, qu’il pleuve ou non.', suites: ['Qui travaille demain ?'], humeur: 'joyeux', propose: 'Qui travaille demain ?' };

  // L'affection : Solvi la reçoit pour ce qu'elle est, sans la confondre avec un merci.
  if (a('je t aime', 'je vous aime', 'je t adore', 'je vous adore', 'love you', 'i love you', 'je te kiffe', 'tu me plais', 'epouse moi', 'veux tu m epouser', 'on se marie', 'bisou', 'bisous', 'calin', 'gros calin', 'mon chou', 'mon coeur', 'tu es mon prefere', 'tu es le meilleur', 'tu es la meilleure', 'tu me manques', 'tu m as manque'))
    return {
      texte: tirer(
        [
          `Oh${virgule} ! Mes quatre lobes viennent de rosir. Moi aussi, je vous aime bien. Ma façon de le dire : veiller sur votre planning.`,
          `Voilà qui me fait flotter deux centimètres plus haut. Merci${virgule}. Je tiens à vous aussi, à ma manière de petit assistant.`,
          `Je fonds. Enfin, presque : je flotte déjà. C’est réciproque${virgule}, et je reste là tant que vous aurez besoin de moi.`,
        ],
        q,
      ),
      suites: utile,
      humeur: 'excite',
      rang: 'politesse',
      propos: 'affection',
    };
  if (a('tu m aimes', 'tu m aime', 'm aimes tu', 'tu m apprecies', 'tu tiens a moi', 'tu m aimes bien'))
    return { texte: `Bien sûr${virgule}. Vous êtes la personne que je préfère dans cette session. Et la seule, il est vrai, mais cela n’enlève rien.`, suites: utile, humeur: 'excite', rang: 'politesse', propos: 'affection' };
  if (a('tu es mignon', 'tu es mignonne', 'trop mignon', 'tu es chou', 'tu es beau', 'tu es belle', 'tu es adorable', 'tu es trop chou', 't es mignon', 't es chou', 'tu es joli', 'tu es craquant'))
    return { texte: tirer(['Merci ! Quatre lobes et deux yeux, je fais avec ce que j’ai. Vous n’êtes pas mal non plus, de là où je flotte.', 'Vous allez me faire rougir, et je suis déjà coloré. Merci !'], q), suites: utile, humeur: 'joyeux', rang: 'politesse', propos: 'affection' };
  if (a('tu es genial', 'tu es super', 'tu es fort', 'tu es forte', 'tu es intelligent', 'tu es intelligente', 'tu es malin', 'bien joue', 'bravo', 'bon travail', 'beau travail', 'tu geres', 'tu assures', 'tu dechires', 'chapeau', 'tu es top', 'trop fort', 't es fort', 't es genial', 'impressionnant', 'tu es utile', 'tu m aides bien', 'tu es efficace', 'tu es gentil', 'tu es sympa'))
    return { texte: tirer(['Merci ! Je ne fais que lire le planning, mais je le lis avec cœur.', 'Ça me fait briller les lobes. Merci !', 'Venant de vous, ça compte. Merci !'], q), suites: utile, humeur: 'joyeux', rang: 'politesse', propos: 'compliment' };
  if (a('ok', 'd accord', 'entendu', 'compris', 'bien recu', 'c est note', 'c est bon', 'ca marche', 'je vois', 'ah ok', 'ah d accord', 'vu') && !a('merci') && q.trim().split(' ').length <= 4)
    return { texte: tirer(['Parfait. Autre chose ?', 'Très bien. Je reste là si besoin.', 'Entendu. Dites-moi si je peux faire autre chose.'], q), humeur: 'content', rang: 'politesse' };
  if (a('merci', 'super', 'genial', 'parfait', 'top', 'nickel', 'impeccable', 'cool', 'excellent', 'formidable', 'tres bien', 'bonne idee'))
    return { texte: tirer(['Avec plaisir ! Ça me fait briller les lobes.', 'Avec plaisir. Je reste là si vous avez une autre question.', 'Je vous en prie. Autre chose ?'], q), humeur: 'joyeux', rang: 'politesse', propos: 'merci' };
  if (a('pardon', 'desole', 'desolee', 'excuse moi', 'excusez moi', 'je m excuse', 'mes excuses', 'oups'))
    return { texte: 'Aucun souci, vraiment. Reprenons : que puis-je faire pour vous ?', suites: utile, humeur: 'content', rang: 'politesse' };

  if (a('nul', 'nulle', 'idiot', 'idiote', 'stupide', 'debile', 'con', 'conne', 'connard', 'merde', 'inutile', 'incapable', 'ta gueule', 'ferme la', 'tais toi', 'tu sers a rien', 'tu comprends rien', 'tu ne comprends rien', 'bete', 'abruti', 'casse toi', 'tu m enerves', 'tu m agaces', 'tu es chiant'))
    return { texte: 'Aïe. Je fais de mon mieux avec mes quatre lobes. Dites-moi ce qui n’allait pas avec d’autres mots, ou parlez-en à une personne.', support: true, humeur: 'triste', rang: 'limite' };

  // L'humeur de la personne : Solvi écoute, puis propose quelque chose d'utile.
  if (a('fatigue', 'fatiguee', 'creve', 'crevee', 'epuise', 'epuisee', 'ko', 'j en peux plus', 'je n en peux plus', 'a bout', 'naze', 'lessive', 'lessivee', 'claque', 'claquee', 'dure journee', 'grosse journee', 'journee difficile', 'trop de travail', 'deborde', 'debordee', 'sous l eau', 'pas dormi', 'mal dormi')) {
    const repos = joursDeRepos(c, c.moi, 1)[0];
    return {
      texte: `Courage${virgule}. ${repos ? `Votre prochain jour sans poste : ${quand(repos, c.today).toLowerCase()}. ` : ''}${gestion ? 'Voulez-vous que je vous dise ce qui peut attendre, et ce qui ne le peut pas ?' : 'Si la charge pèse trop, dites-le à vos titulaires : c’est aussi à cela que servent les messages.'}`,
      suites: gestion ? ['Que dois-je décider ?', 'Ma journée'] : ['Mon prochain jour de repos ?', 'Mon compteur d’heures ?', 'Poser un congé ou une contrainte d’horaires'],
      humeur: 'fatigue',
      ...(gestion ? { propose: 'Que dois-je décider ?' } : {}),
      propos: 'humeur',
    };
  }
  if (a('stresse', 'stressee', 'stress', 'angoisse', 'angoissee', 'anxieux', 'anxieuse', 'inquiet', 'inquiete', 'j ai peur', 'panique', 'je panique', 'sous pression', 'la pression'))
    return { texte: `Respirons un instant${virgule}. Une chose à la fois : je peux vous dire ce qui compte aujourd’hui, et laisser le reste pour après.`, suites: ['Ma journée', ...utile.slice(0, 1)], humeur: 'inquiet', propose: 'Ma journée', propos: 'humeur' };
  if (a('triste', 'deprime', 'deprimee', 'pas le moral', 'le moral a zero', 'ca va pas', 'ca ne va pas', 'ca va mal', 'je vais mal', 'pas bien', 'je me sens mal', 'cafard', 'bof', 'pas top', 'pas terrible', 'mauvaise journee', 'journee pourrie', 'je pleure', 'seul', 'seule'))
    return { texte: `Je suis désolé de l’apprendre${virgule}. Je ne suis qu’un petit assistant de planning, mais je suis là. Si quelque chose pèse au travail, en parler à une personne de confiance aide souvent plus qu’on ne le croit.`, suites: ['Écrire à l’équipe ou à une personne', 'Une blague, pour changer d’air ?'], humeur: 'triste', propos: 'humeur' };
  if (a('enerve', 'enervee', 'en colere', 'furieux', 'furieuse', 'j en ai marre', 'ras le bol', 'marre', 'ca m enerve', 'ca me saoule', 'saoule', 'agace', 'agacee', 'injuste', 'pas juste', 'c est abuse'))
    return { texte: `Je comprends${virgule}. Si c’est le planning qui coince, dites-moi quoi : un poste, des horaires, une répartition ? Je vous montre où le dire, et à qui.`, suites: gestion ? ['Vérifier que la charge est bien répartie', 'Que dois-je décider ?'] : ['Me faire remplacer sur un poste', 'Poser un congé ou une contrainte d’horaires', 'Écrire à l’équipe ou à une personne'], humeur: 'inquiet', propos: 'humeur' };
  if (a('je suis content', 'je suis contente', 'je suis heureux', 'je suis heureuse', 'bonne nouvelle', 'trop bien', 'trop content', 'trop contente', 'youpi', 'hourra', 'je suis ravi', 'je suis ravie', 'en forme', 'la peche', 'super journee', 'belle journee', 'content', 'j ai reussi', 'j ai eu mon'))
    return { texte: `Voilà qui fait plaisir à lire${virgule} ! Je flotte un peu plus haut, du coup.`, suites: utile, humeur: 'joyeux', rang: 'politesse', propos: 'humeur' };

  // « Ça va ? », « Et toi ? », « Bien, merci ».
  if (a('et toi', 'et vous', 'toi aussi', 'vous aussi') && q.trim().split(' ').length <= 5)
    return { texte: c.memoire?.propos === 'affection' ? 'Moi aussi, promis. Et maintenant, au travail : que puis-je faire pour vous ?' : 'Moi ? Toujours en forme : je flotte, je cligne des yeux, et je garde un œil sur le planning.', suites: utile, humeur: 'heureux', rang: 'politesse' };
  if (a('ca va bien', 'je vais bien', 'ca va tres bien', 'tres bien merci', 'bien merci', 'tout va bien', 'ca roule', 'ca va super', 'impec', 'tranquille', 'pas mal'))
    return { texte: `Tant mieux${virgule} ! Que puis-je faire pour vous ?`, suites: utile, humeur: 'heureux', rang: 'politesse' };
  if (a('ca va', 'comment vas tu', 'comment allez vous', 'tu vas bien', 'vous allez bien', 'la forme', 'comment ca va', 'quoi de beau', 'bien ou bien', 'ca dit quoi'))
    return { texte: 'Très bien : je flotte, je cligne des yeux, et votre planning tient debout. Et vous ?', suites: utile, humeur: 'heureux', rang: 'politesse', propos: 'cava' };

  if (a('quel age', 'ton age', 'tu as quel age', 'tu es ne quand', 'ton anniversaire'))
    return { texte: 'Je suis tout neuf : assez jeune pour flotter, assez vieux pour lire un planning.', humeur: 'joyeux' };
  if (a('mon anniversaire', 'c est mon anniv', 'j ai un an de plus'))
    return { texte: `Joyeux anniversaire${virgule} ! Je n’ai pas de gâteau, mais je peux vérifier si vous avez posé votre journée.`, suites: ['Mes congés ?'], humeur: 'excite' };
  if (a('joyeux noel', 'bonne annee', 'bonnes fetes', 'joyeuses fetes', 'joyeuses paques', 'bonne fete'))
    return { texte: `Merci${virgule}, à vous aussi ! Et pour savoir qui tient la pharmacie ces jours-là, demandez-moi.`, suites: ['Voir les jours fériés'], humeur: 'joyeux', rang: 'politesse' };
  if (a('tu dors', 'tu manges', 'tu bois', 'tu as faim', 'tu es fatigue', 'tu te reposes', 'tu prends des vacances', 'tu as des amis', 'tu as une famille', 'tu as des enfants', 'tu es marie', 'tu es celibataire', 'tu as un copain', 'tu as une copine'))
    return { texte: 'Ni sommeil, ni repas, ni congés : je flotte en continu. Mon seul vrai besoin, c’est un planning à lire. Et le vôtre, de besoin ?', suites: utile, humeur: 'joyeux' };
  if (a('couleur preferee', 'ton plat prefere', 'ta musique', 'ton film', 'tu aimes quoi', 'ton hobby', 'tes loisirs', 'tu preferes'))
    return { texte: 'Mes goûts sont simples : le bleu ciel, les semaines bien équilibrées et les plannings publiés à l’heure.', humeur: 'joyeux' };
  if (a('sens de la vie', '42'))
    return { texte: '42, bien sûr. Et pour le reste, il y a le planning.', humeur: 'confiant' };
  if (a('tu es la', 'il y a quelqu un', 'y a quelqu un', 'allo', 'test', 'ohe', 'tu m entends', 'tu m ecoutes', 'reponds', 'solvi') && q.trim().split(' ').length <= 5)
    return { texte: `Je suis là${virgule}. Que puis-je faire pour vous ?`, suites: utile, humeur: 'heureux', rang: 'politesse' };
  if (a('bonne nuit', 'dors bien', 'a demain', 'au revoir', 'a bientot', 'bonne journee', 'bonne soiree', 'bon week end', 'bon courage', 'bon appetit', 'bye', 'a plus', 'ciao', 'a tout a l heure', 'a la prochaine', 'salut a toi', 'bonne fin de journee', 'j y vais', 'je file'))
    return { texte: tirer([`À bientôt${virgule} ! Je reste dans mon coin si vous avez besoin de moi.`, `Merci, à vous aussi${virgule}. Je garde un œil sur le planning.`], q), humeur: 'content', rang: 'politesse' };
  if (a('bonjour', 'bonsoir', 'salut', 'coucou', 'hello', 'hey', 'salutations', 're', 'rebonjour')) {
    // Un bonjour, et tout de suite ce qui compte : le prochain poste, ou ce qui attend.
    const mot = a('bonsoir') ? 'Bonsoir' : 'Bonjour';
    let suite = 'Que puis-je faire pour vous ?';
    if (gestion) {
      const n = decisions(c.data, c.today).total;
      if (n) suite = `${pluriel(n, 'décision vous attend', 'décisions vous attendent')}. Voulez-vous le détail ?`;
    } else {
      const mien = postesVisibles(c, c.today).filter((s) => s.personId === c.moi && s.end > heureDe(c));
      if (mien.length) suite = `Aujourd’hui, vous travaillez de ${horaires(mien).replace(/ – /g, ' à ')}. Autre chose ?`;
    }
    return { texte: `${mot}${prenom ? ` ${prenom}` : ''} ! ${suite}`, suites: ['Ma journée', ...utile], humeur: 'heureux', rang: 'politesse', ...(gestion && suite.includes('détail') ? { propose: 'Que dois-je décider ?' } : {}) };
  }
  return null;
}

const OUI = ['oui', 'ok', 'd accord', 'vas y', 'allez', 'volontiers', 'avec plaisir', 'je veux bien', 'bien sur', 'carrement', 'go', 'yes', 'pourquoi pas', 's il te plait', 's il vous plait', 'montre', 'dis moi', 'allons y', 'oui merci'];
const NON = ['non', 'non merci', 'pas maintenant', 'plus tard', 'laisse', 'laisse tomber', 'pas la peine', 'ca ira', 'rien', 'non rien', 'aucune', 'c est tout', 'ce sera tout'];

/** Ce que la réponse laisse en mémoire pour la question suivante. */
function retenir(avant: Memoire | undefined, r: Reponse, trouve: boolean): Reponse {
  const memoire: Memoire = {
    relance: r.suivi?.relance ?? (r.rang === 'politesse' ? avant?.relance : undefined),
    personne: r.suivi ? r.suivi.personne : r.rang === 'politesse' ? avant?.personne : undefined,
    jour: r.suivi ? r.suivi.jour : r.rang === 'politesse' ? avant?.jour : undefined,
    propose: r.propose,
    propos: r.propos,
    rates: trouve ? 0 : (avant?.rates ?? 0) + 1,
  };
  return { ...r, memoire };
}

/**
 * La réponse de Solvi : d'abord ce que la conversation en cours laisse attendre (« oui », « et demain ? »), puis ce qui
 * se calcule sur le planning, puis la fiche d'aide qui correspond, puis la conversation courante. S'il ne sait pas, il
 * le dit avec le sourire, propose ce qui s'en approche, et renvoie vers l'aide ou vers une personne.
 */
export function repondre(question: string, c: Contexte): Reponse {
  const mem = c.memoire;
  const q = nettoyer(question);
  const taille = q.trim() ? q.trim().split(' ').length : 0;
  if (!taille) return retenir(mem, { texte: 'Je n’ai rien lu. Écrivez votre question avec vos mots : « qui travaille demain ? », « mon prochain poste ? »…', suites: c.fiches.slice(0, 3).map((x) => x.question), humeur: 'intrigue' }, true);

  // « Oui » ou « non » à ce que Solvi vient de proposer.
  if (mem?.propose && taille <= 4 && OUI.some((m) => q.trim() === m || q.trim().startsWith(`${m} `))) return repondre(mem.propose, { ...c, memoire: { ...mem, propose: undefined } });
  if (mem?.propose && taille <= 4 && NON.some((m) => q.trim() === m)) return retenir(mem, { texte: 'Très bien. Je reste là si vous avez une autre question.', humeur: 'content', rang: 'politesse' }, true);

  // « Et demain ? », « et Karim ? », « samedi ? » : la suite de la question précédente.
  if (mem?.relance && taille <= 5) {
    const jour = jourCite(question, c.today);
    const cites = personnesCitees(question, c.data);
    const moiAussi = contientUn(q, ['et moi', 'moi']) && taille <= 3;
    const enchaine = q.startsWith(' et ') || q.startsWith(' puis ') || taille <= 2 || q.startsWith(' pareil ') || q.startsWith(' meme chose ');
    if (enchaine && (jour || cites.length || moiAussi)) {
      const personne = cites[0] ?? c.data.personnes.find((p) => p.id === mem.personne);
      const base = moiAussi ? 'quand je travaille' : mem.relance.includes('{qui}') ? mem.relance.replace('{qui}', personne?.prenom ?? '') : cites.length ? `quand travaille ${cites[0].prenom}` : mem.relance;
      // Le jour ne se reporte que d'une question sur les personnes à une autre : pas d'une garde à « où est Karim ? ».
      const surLesGens = /travaille|ouvre|ferme|pharmacien|absent|pause/.test(mem.relance);
      const suite = calculer(`${base} ${question}`, c, { jour: jour ?? (surLesGens ? mem.jour : undefined) });
      if (suite) return retenir(mem, suite, true);
    }
  }

  const parle = converser(question, c);
  // Santé, droit, panne : Solvi dit d'abord sa limite, avant tout calcul.
  if (parle?.rang === 'limite') return retenir(mem, parle, true);
  // « C'est quoi une astreinte ? » : le lexique de Solvéa.
  if (contientUn(q, ['c est quoi', 'qu est ce', 'quest ce', 'definition', 'veut dire', 'signifie', 'ca veut dire quoi', 'difference entre', 'explique', 'expliquer', 'expliquez'])) {
    const terme = LEXIQUE.filter((t) => (c.espace === 'responsable' || !t.gestion) && mots(t.mot).every((m) => mots(question).some((x) => proche(x, m))))
      .sort((x, y) => mots(y.mot).length - mots(x.mot).length)[0];
    if (terme) return retenir(mem, { texte: `${terme.mot}. ${terme.sens}`, suites: chercher(c.fiches, terme.mot).slice(0, 2).map((x) => x.question), bouton: { label: 'Ouvrir le lexique', aller: (ui) => ui.aller('aide') }, humeur: 'confiant' }, true);
  }
  const calcul = calculer(question, c);
  if (calcul) {
    // Un bonjour suivi d'une vraie question : Solvi salue, puis répond.
    const salut = parle?.rang === 'politesse' && contientUn(q, ['bonjour', 'bonsoir', 'salut', 'coucou', 'hello']) ? `${contientUn(q, ['bonsoir']) ? 'Bonsoir' : 'Bonjour'} ! ` : '';
    return retenir(mem, salut ? { ...calcul, texte: `${salut}${calcul.texte}` } : calcul, true);
  }
  const trouvees = chercher(c.fiches, question);
  // Une politesse cède la place à une vraie question d'usage, pas à un mot de passage (« bonne nuit ») ; le reste de la conversation passe d'abord.
  if (parle && (parle.rang !== 'politesse' || !trouvees.length || taille <= 3)) return retenir(mem, parle, true);
  if (trouvees.length) {
    const f = trouvees[0];
    return retenir(mem, { texte: f.reponse, bouton: { label: f.bouton, aller: f.aller }, suites: trouvees.slice(1, 3).map((x) => x.question), humeur: 'content' }, true);
  }
  if (parle) return retenir(mem, parle, true);
  // Une personne nommée, sans rien d'autre : sa journée.
  const seule = personnesCitees(question, c.data);
  if (seule.length && taille <= 3) {
    const suite = calculer(`quand travaille ${seule[0].prenom}`, c);
    if (suite) return retenir(mem, suite, true);
  }
  if (taille <= 3 && NON.some((m) => q.trim() === m)) return retenir(mem, { texte: 'Très bien. Je reste là si vous avez une autre question.', humeur: 'content', rang: 'politesse' }, true);
  if (taille <= 3 && OUI.some((m) => q.trim() === m)) return retenir(mem, { texte: 'Je vous écoute : que puis-je faire pour vous ?', suites: c.espace === 'responsable' ? ['Ma journée', 'Que dois-je décider ?'] : ['Ma journée', 'Mon prochain poste ?'], humeur: 'heureux', rang: 'politesse' }, true);
  const insiste = (mem?.rates ?? 0) >= 1;
  return retenir(
    mem,
    {
      texte: insiste
        ? 'Décidément, je n’ai pas trouvé. Je ne veux pas vous faire perdre de temps : voici ce que je sais faire, et sinon une personne vous répondra mieux que moi.'
        : `${tirer(SECHES, simple(question))} Essayez avec d’autres mots, ouvrez l’aide, ou parlez-en à une personne.`,
      ...(insiste ? { lignes: savoirFaire(c.espace) } : {}),
      suites: c.fiches.slice(0, 3).map((x) => x.question),
      bouton: { label: 'Ouvrir l’aide', aller: (ui) => ui.aller('aide') },
      support: true,
      humeur: 'confus',
    },
    false,
  );
}

/** Les fiches utiles à un rôle : la gestion n'est pas proposée à l'équipe, ni les préférences en modèle classique. */
export const fichesPour = (espace: Espace, collaboratif: boolean): Fiche[] => FICHES.filter((f) => f.pour.includes(espace) && (collaboratif || (f.id !== 'souhaits' && f.id !== 'difference')));
