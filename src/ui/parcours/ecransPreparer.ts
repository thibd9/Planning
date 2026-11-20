import type { Etape, Geste, OutilsVisite } from '../Parcours';
import { EQUIPE_DEMO, OFFICINE_DEMO } from '../../data/seed';
import type { Person } from '../../domain/types';
import type { Mode } from '../../store/ui';
import { prefsDe, useUi } from '../../store/ui';

/** Ce que vise un geste : l'élément, ou rien s'il n'est pas (encore) là. */
type Vise = () => HTMLElement | null | undefined;

const norme = (t: string): string => t.replace(/\s+/g, ' ').trim().toLowerCase();
/**
 * Le libellé (label ou legend) qui contient ce texte, dans un bloc. Contrairement à `o.parLibelle`, il trouve aussi un
 * champ d'une rubrique repliée ou d'un onglet masqué : la visite ouvre alors la rubrique en le visant.
 */
const lib =
  (texte: string, dans = '.content'): Vise =>
  () => {
    const zone = [...document.querySelectorAll<HTMLElement>(dans)].pop();
    if (!zone) return null;
    const tous = [...zone.querySelectorAll<HTMLElement>('label, legend')].filter((l) => norme(l.textContent ?? '').includes(norme(texte)));
    return tous.find((l) => l.offsetParent !== null) ?? tous[0];
  };
/** Le champ de cet identifiant, avec le libellé qui l'entoure quand il y en a un. */
const champ =
  (id: string): Vise =>
  () => {
    const el = document.getElementById(id);
    return el?.closest<HTMLElement>('label') ?? el;
  };
/** Le premier élément dont le texte contient ces mots, même dans une rubrique repliée. */
const avecTexte =
  (sel: string, texte: string): Vise =>
  () =>
    [...document.querySelectorAll<HTMLElement>(sel)].find((e) => norme(e.textContent ?? '').includes(norme(texte)));
/** Le titre d'une rubrique en accordéon : le viser l'ouvre. */
const rubrique =
  (titre: string, dans = '.content'): Vise =>
  () =>
    [...document.querySelectorAll<HTMLElement>(`${dans} details.acc > summary`)].find((s) => norme(s.querySelector('.acc-titre b')?.textContent ?? '') === norme(titre));
/** Un élément du contenu d'une rubrique. */
const dansRubrique =
  (titre: string, sel: string, dans = '.content'): Vise =>
  () =>
    rubrique(titre, dans)()?.parentElement?.querySelector<HTMLElement>(`:scope > .acc-corps ${sel}`);
/** Le groupe d'un formulaire (fieldset) par le titre de sa légende. */
const groupe =
  (titre: string): Vise =>
  () =>
    [...document.querySelectorAll<HTMLElement>('.accueil-form legend')].find((l) => norme(l.querySelector('b')?.textContent ?? '') === norme(titre));

/** La fiche ouverte dans l'écran « Équipe ». */
const FICHE = '.content .split > :last-child';
const FERMER: Geste = { faire: 'action', jouer: () => document.querySelector<HTMLElement>('.dialog .dialog-fermer')?.click() };

/** Une règle de l'écran « Règles », par le début de son nom. */
const regle = (titre: string): HTMLDetailsElement | undefined => [...document.querySelectorAll<HTMLDetailsElement>('.content details.rg')].find((d) => norme(d.querySelector('summary')?.textContent ?? '').includes(norme(titre)));
const dansRegle =
  (titre: string, sel: string): Vise =>
  () =>
    regle(titre)?.querySelector<HTMLElement>(sel);
const PLAFOND = 'Plafond d’heures par semaine';

/** Écrit dans un champ comme le clavier, sans geste visible : pour remettre l'assistant à l'étape voulue. */
function ecrire(el: HTMLInputElement, valeur: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, valeur);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Vide un champ, sans geste visible : ce qui a été saisi pour l'exemple ne reste pas. */
const vider = (id: string): void => {
  const el = document.getElementById(id);
  if (el instanceof HTMLInputElement && el.value) ecrire(el, '');
};

/** L'assistant « Ajouter une pharmacie » : l'étape affichée (0 pharmacie, 1 équipe, 2 vérification). */
const NOUVELLE = 'Pharmacie des Tilleuls';
const etapeAccueil = (): number => (document.getElementById('officine-nom') ? 0 : document.getElementById('tit-prenom') ? 1 : document.getElementById('recap-pharmacie') ? 2 : -1);
const boutonAccueil = (texte: string): HTMLElement | undefined => [...document.querySelectorAll<HTMLElement>('.accueil-actions button')].find((b) => b.textContent?.includes(texte));
/**
 * Un pas vers l'étape voulue de l'assistant : « Retour », ou le nom puis « Continuer ». Chaque appel fait un seul pas,
 * le temps que l'écran suive ; trois appels suffisent depuis n'importe quelle étape.
 */
const versEtape = (cible: number): Geste => ({
  faire: 'action',
  jouer: () => {
    const e = etapeAccueil();
    if (e < 0) return;
    if (e > cible) {
      boutonAccueil('Retour')?.click();
      return;
    }
    const nom = document.getElementById('officine-nom') as HTMLInputElement | null;
    if (nom && !nom.value.trim()) return ecrire(nom, NOUVELLE);
    if (e < cible) document.querySelector<HTMLElement>('.accueil-actions button[type="submit"]')?.click();
  },
});

/** Une personne d'exemple, le temps d'une étape : la fiche d'un rayonniste. */
const RAYONNISTE: Person = { id: 'p_visite_rayon', prenom: 'Camille', nom: 'Roux', qualification: 'rayonniste', salarie: true, heuresHebdo: 35, tauxHoraire: null, competences: [], volontaireHeuresComp: false, volontaireGardes: false, rayons: ['hygiene'], entreeLe: '2025-03-03' };

/** Les préférences d'affichage de Caroline, avant qu'une démonstration ne les change : elles sont rendues ensuite. */
let modeAvant: Mode = 'clair';
let texteAvant: 'normal' | 'grand' = 'normal';
const prefsCaroline = (): ReturnType<typeof prefsDe> => prefsDe(useUi.getState().preferences, 'caroline.tellier', 'ciel', true);

/**
 * « Écran par écran » : la mise en place, champ par champ. Un chapitre par écran ; dans chaque étape, Solvi montre
 * chaque champ (geste « expliquer ») : ce qu'on y met, à quoi il sert, avec un exemple quand c'est utile.
 */
export function ecransPreparer(o: OutilsVisite): Etape[] {
  o.buts({
    'Réglages': 'Les cinq onglets des réglages, rubrique par rubrique : ce qu’on y saisit, et ce que cela change.',
    'Postes types': 'La fenêtre qui crée un poste type : chaque champ, et l’aperçu de la tuile.',
    'Équipe': 'La liste, la fiche d’une personne rubrique par rubrique, et la fenêtre « Ajouter une personne ».',
    'Règles': 'Les filtres, une règle ouverte, et le réglage de son seuil.',
    'Votre compte': 'Votre profil, vos compétences, l’apparence et votre mot de passe.',
    'Plusieurs pharmacies et le menu': 'Le sélecteur de pharmacie, l’assistant « Ajouter une pharmacie » et le menu à votre nom.',
  });

  /**
   * Remet l'exemple en place pour une étape : les coûts estimés affichés ou non, sans la personne d'exemple d'une autre
   * étape, et les réglages que d'autres étapes ont pu changer.
   */
  const remettre = (couts = false): void => {
    const d = o.store().data;
    if (!!d.officine.couts !== couts || d.personnes.some((p) => p.id === RAYONNISTE.id) || d.officine.infos?.activiteAnnuelle !== undefined) {
      o.poser((x) => {
        const infos = { ...(x.officine.infos ?? {}) };
        delete infos.activiteAnnuelle;
        return { ...x, officine: { ...x.officine, couts, infos }, personnes: x.personnes.filter((p) => p.id !== RAYONNISTE.id) };
      });
    }
  };
  /** Les horaires et le modèle de l'exemple : une étape précédente a pu les changer. */
  const horairesExemple = (): void => {
    const off = o.store().data.officine;
    if (JSON.stringify(off.horaires) !== JSON.stringify(OFFICINE_DEMO.horaires) || (off.modele ?? 'collaboratif') !== 'collaboratif') o.poser((x) => ({ ...x, officine: { ...x.officine, horaires: OFFICINE_DEMO.horaires.map((h) => h.map((i) => ({ ...i }))), modele: 'collaboratif' } }));
  };
  /** La fiche d'une personne de l'exemple, telle que l'exemple la décrit (compétences et marques comprises). */
  const ficheExemple = (id: string): void => {
    const ref = EQUIPE_DEMO.find((p) => p.id === id);
    if (ref) o.poser((x) => ({ ...x, personnes: x.personnes.map((p) => (p.id === id ? { ...p, competences: [...ref.competences], ...(ref.marques ? { marques: ref.marques.map((m) => ({ ...m, types: [...m.types] })) } : {}) } : p)) }));
  };
  const equipe = (id: string | null, couts = false): void => {
    remettre(couts);
    o.avecEquipe();
    o.helene('equipe');
    useUi.getState().ouvrirPersonne(id);
  };

  return [
    // ---------------------------------------------------------------- 1. Réglages
    {
      chapitre: 'Réglages',
      qui: o.HELENE,
      cible: '#acc-identite',
      titre: 'Le nom de la pharmacie',
      texte: () => 'Les réglages décrivent votre pharmacie en cinq onglets. Le premier, « Pharmacie », porte son nom et ses chiffres. Chaque champ se modifie librement.',
      jouer: () => {
        remettre();
        o.helene('officine');
      },
      gestes: [
        { faire: 'expliquer', sur: '#reglages-onglet-pharmacie', nom: 'Pharmacie', quoi: 'le premier des cinq onglets : le nom de la pharmacie et ses locaux.', sert: 'Chaque onglet réunit une famille de réglages. Chaque rubrique s’y replie sous son titre, avec un résumé d’une ligne.' },
        { faire: 'expliquer', sur: lib('Nom de la pharmacie'), quoi: 'le nom de votre officine, tel que vous voulez le lire.', sert: 'Il s’affiche en haut de l’écran, dans le sélecteur de pharmacie et sur les plannings imprimés.', exemple: 'Grande Pharmacie de la Pinède' },
        { faire: 'expliquer', sur: '#acc-chiffres > summary', nom: 'L’officine en chiffres', quoi: 'la rubrique des repères sur vos locaux. Tout y est facultatif.', sert: 'Repliée, elle résume ce qui est saisi et compte les points à vérifier. Les premiers chiffres s’affichent aussi sous le titre de la page.' },
      ],
    },
    {
      chapitre: 'Réglages',
      qui: o.HELENE,
      cible: '#acc-chiffres',
      titre: 'L’officine en chiffres',
      texte: () => 'Six chiffres et une case, tous facultatifs. Ils nourrissent le repère « L’équipe est-elle bien dimensionnée ? » et les contrôles de cohérence.',
      jouer: () => {
        remettre();
        o.helene('officine');
      },
      gestes: [
        { faire: 'expliquer', sur: champ('officine-surface'), quoi: 'la surface de toute l’officine, en mètres carrés.', sert: 'Au-delà de 100 m², le repère compte au moins deux personnes au comptoir. Solvéa vérifie que la vente et la réserve y tiennent.', exemple: '180' },
        { faire: 'expliquer', sur: champ('officine-surfaceVente'), quoi: 'l’espace ouvert aux clients, en mètres carrés.', sert: 'Sans nombre de clients par jour, le repère s’appuie sur elle : une personne pour 45 m² à l’heure ordinaire. C’est grossier, et c’est dit.', exemple: '110' },
        { faire: 'expliquer', sur: champ('officine-reserve'), quoi: 'la surface de la réserve et du préparatoire.', sert: 'Elle sert au contrôle de cohérence : avec la surface de vente, elle ne doit pas dépasser la surface totale.', exemple: '45' },
        { faire: 'expliquer', sur: champ('officine-caisses'), quoi: 'le nombre de caisses.', sert: 'À défaut de postes de comptoir, elles fixent le plafond utile. Le nombre de caisses ne fixe jamais l’effectif.', exemple: '3' },
        { faire: 'expliquer', sur: champ('officine-comptoirs'), quoi: 'le nombre de postes où l’on sert en même temps.', sert: 'Ils fixent le plafond utile : vos postes, plus une personne hors comptoir. Solvéa vous prévient si vous attendez plus de monde que de postes.', exemple: '4' },
        { faire: 'expliquer', sur: champ('officine-confidentialite'), quoi: 'le nombre d’espaces où parler à l’écart du comptoir.', sert: 'Un repère descriptif : il figure dans le résumé de la rubrique, sans entrer dans un calcul.', exemple: '1' },
        { faire: 'expliquer', sur: champ('officine-robot'), quoi: 'cochez si un robot ou un automate délivre les boîtes.', sert: 'Le repère compte alors 4 minutes par client au lieu de 5, et moins de travail hors comptoir.' },
      ],
    },
    {
      chapitre: 'Réglages',
      qui: o.HELENE,
      cible: '#acc-horaires',
      titre: 'Les horaires d’un jour',
      texte: () => 'Dans « Horaires », une ligne par jour. Un pharmacien doit être planifié sur chaque minute d’ouverture : ces heures guident tout le planning.',
      jouer: () => {
        remettre();
        horairesExemple();
        o.helene('officine');
      },
      gestes: [
        { faire: 'expliquer', sur: '#reglages-onglet-horaires', nom: 'Horaires', quoi: 'l’onglet des horaires d’ouverture et des jours fériés.' },
        { faire: 'expliquer', sur: '[aria-label="Ouverture le lundi"]', nom: 'Ouverture', quoi: 'l’heure où la pharmacie ouvre ce jour-là.', sert: 'Les propositions de planning couvrent l’ouverture, et le contrôle « pharmacien présent » part de cette heure.', exemple: '8 h 30' },
        { faire: 'expliquer', sur: '[aria-label="Fermeture le lundi"]', nom: 'Fermeture', quoi: 'l’heure où elle ferme ce jour-là.', sert: 'Un poste qui finit à cette heure compte comme une fermeture, dans l’équité entre collègues.', exemple: '19 h 30' },
        { faire: 'expliquer', sur: '[aria-label="Coupure le midi : lundi"]', nom: 'Coupure le midi', quoi: 'coupe la journée en deux, si la pharmacie ferme pour le déjeuner.', sert: 'Le bouton n’apparaît que sur une journée continue de plus de quatre heures.' },
        { faire: 'cliquer', sur: '[aria-label="Coupure le midi : lundi"]', dit: 'Cliquez sur « Coupure le midi », le lundi', sert: 'Deux horaires apparaissent : la fermeture du midi et la réouverture.' },
        { faire: 'expliquer', sur: '[aria-label="Fermeture du midi le lundi"]', nom: 'Fermeture du midi', quoi: 'l’heure où la pharmacie ferme pour le déjeuner.', sert: 'Pendant la coupure, la pharmacie est fermée : aucun pharmacien n’y est exigé, aucun minimum au comptoir ne s’y applique.', exemple: '12 h 30' },
        { faire: 'expliquer', sur: '[aria-label="Réouverture le lundi"]', nom: 'Réouverture', quoi: 'l’heure où elle rouvre l’après-midi.', exemple: '14 h' },
        { faire: 'expliquer', sur: '[aria-label="Retirer la coupure : lundi"]', nom: 'Retirer la coupure', quoi: 'remet une journée continue, de l’ouverture du matin à la fermeture du soir.' },
        { faire: 'cliquer', sur: '[aria-label="Retirer la coupure : lundi"]', dit: 'Cliquez sur « Retirer la coupure »', sert: 'Le lundi redevient continu, comme dans l’exemple.' },
      ],
    },
    {
      chapitre: 'Réglages',
      qui: o.HELENE,
      cible: '#acc-horaires',
      titre: 'Recopier, fermer, ouvrir un jour',
      texte: () => '« Recopier » reprend les horaires d’un autre jour. « Fermer ce jour » et « Ouvrir ce jour » changent un jour d’un clic.',
      jouer: () => {
        remettre();
        horairesExemple();
        o.helene('officine');
      },
      gestes: [
        // Les options d'une démonstration interrompue sont refermées : le clic suivant les ouvre.
        { faire: 'action', jouer: () => (document.getElementById('jl-recopier-5')?.getAttribute('aria-expanded') === 'true' ? document.getElementById('jl-recopier-5')?.click() : undefined) },
        { faire: 'expliquer', sur: '#jl-recopier-5', nom: 'Recopier', quoi: 'déplie deux façons de recopier des horaires, pour ce jour.' },
        { faire: 'cliquer', sur: '#jl-recopier-5', dit: 'Cliquez sur « Recopier », le samedi', sert: 'Les options s’ouvrent sous la ligne du samedi.' },
        { faire: 'expliquer', sur: avecTexte('#jl-recopie-5 button', 'Appliquer ces horaires'), nom: 'Appliquer ces horaires aux autres jours ouverts', quoi: 'donne les horaires de ce jour à tous les autres jours ouverts.', sert: 'Les jours fermés le restent. Pratique quand toute la semaine suit le même horaire.' },
        { faire: 'expliquer', sur: avecTexte('#jl-recopie-5 button', 'Copier la veille'), nom: 'Copier la veille', quoi: 'reprend pour ce jour les horaires de la veille, ici le vendredi.', sert: 'Si la veille a déjà les mêmes horaires, Solvéa l’écrit à la place du bouton.' },
        { faire: 'cliquer', sur: '#jl-recopier-5', dit: 'Cliquez de nouveau sur « Recopier »', sert: 'Les options se referment, sans rien changer.' },
        { faire: 'expliquer', sur: '[aria-label="Fermer ce jour : samedi"]', nom: 'Fermer ce jour', quoi: 'ferme la pharmacie toute la journée.', sert: 'Le jour passe à « Fermé » : plus aucun poste n’y est proposé.' },
        { faire: 'expliquer', sur: '[aria-label="Ouvrir ce jour : dimanche"]', nom: 'Ouvrir ce jour', quoi: 'rouvre un jour fermé, de 9 h à 19 h, à ajuster ensuite.', sert: 'Dans l’exemple, le dimanche est fermé : les gardes se gèrent à part.' },
        { faire: 'expliquer', sur: '#acc-horaires > summary', nom: 'Horaires d’ouverture', quoi: 'le résumé de la semaine, quand la rubrique est repliée.', sert: 'Les jours qui ont les mêmes heures y sont réunis.' },
      ],
    },
    {
      chapitre: 'Réglages',
      qui: o.HELENE,
      cible: '#acc-feries',
      titre: 'Les jours fériés',
      texte: () => 'Les jours fériés des douze prochains mois, calculés par Solvéa. Rien à saisir, sauf votre choix d’ouvrir ou non.',
      jouer: () => {
        remettre();
        o.helene('officine');
      },
      gestes: [
        { faire: 'expliquer', sur: '#acc-feries > summary', nom: 'Jours fériés', quoi: 'la rubrique des jours fériés.', sert: 'Repliée, elle dit votre choix et le prochain jour férié.' },
        { faire: 'expliquer', sur: '#acc-feries label.check', nom: 'Officine fermée les jours fériés', quoi: 'cochez si la pharmacie ferme ces jours-là, hors gardes.', sert: 'Cochée, un jour férié compte comme fermé : aucun poste n’y est proposé, aucun pharmacien n’y est exigé. Décochée, il garde les horaires du jour et il est signalé dans les plannings.' },
        { faire: 'expliquer', sur: '#acc-feries .feries', nom: 'Les prochains jours fériés', quoi: 'la liste des jours fériés à venir, avec leur date.', sert: 'Les fêtes mobiles, comme le lundi de Pâques ou l’Ascension, sont recalculées chaque année.' },
      ],
    },
    {
      chapitre: 'Réglages',
      qui: o.HELENE,
      cible: '#acc-effectif',
      titre: 'Combien de personnes au comptoir',
      texte: () => 'Dans « Comptoir », le minimum de personnes à tenir, plage par plage. En dessous, le planning vous prévient.',
      jouer: () => {
        remettre();
        o.helene('officine');
      },
      gestes: [
        { faire: 'expliquer', sur: '#reglages-onglet-comptoir', nom: 'Comptoir', quoi: 'l’onglet de l’effectif attendu, et du repère sur la taille de l’équipe.' },
        { faire: 'expliquer', sur: '#acc-effectif tbody tr:first-child td:first-child', nom: 'Jours', quoi: 'les jours de la semaine où la plage s’applique.' },
        { faire: 'expliquer', sur: '#acc-effectif tbody tr:first-child .of-plage', nom: 'Horaire', quoi: 'le début et la fin de la plage.', sert: 'Les plages peuvent se chevaucher : à chaque demi-heure, c’est le minimum le plus élevé qui compte.' },
        { faire: 'expliquer', sur: '#acc-effectif tbody tr:nth-child(1) input', nom: 'Personnes au minimum', quoi: 'le nombre de personnes qu’il faut au moins sur cette plage.', sert: 'En dessous, la grille de la semaine écrit « Manque du monde », et les propositions de planning cherchent à l’atteindre.', exemple: '2' },
        { faire: 'expliquer', sur: '#acc-effectif tbody tr:nth-child(2) input', nom: 'Une plage de pointe', quoi: 'un minimum plus élevé, ici de 10 h à 12 h 30 en semaine.', sert: 'Il passe par-dessus la plage de la journée : 3 personnes de 10 h à 12 h 30, puis 2 de nouveau.', exemple: '3' },
        { faire: 'expliquer', sur: '#acc-effectif .of-note', nom: 'Le pharmacien', quoi: 'un rappel : un pharmacien doit être présent à chaque minute d’ouverture.', sert: 'C’est contrôlé à part, quel que soit le minimum réglé ici.' },
      ],
    },
    {
      chapitre: 'Réglages',
      qui: o.HELENE,
      cible: '#dimensionnement',
      titre: 'L’équipe est-elle bien dimensionnée ?',
      texte: () => 'Un repère réservé aux titulaires. Il part des clients à servir, et le compare aux heures des contrats. Ce n’est pas une norme : toutes les hypothèses sont écrites.',
      jouer: () => {
        remettre();
        o.helene('officine');
      },
      gestes: [
        { faire: 'expliquer', sur: '#dimensionnement > summary', nom: 'L’équipe est-elle bien dimensionnée ?', quoi: 'la rubrique qui compare le travail à faire aux heures des contrats.', sert: 'Repliée, elle dit combien de personnes il faut au comptoir, et si les contrats suivent.' },
        { faire: 'expliquer', sur: champ('dim-passages'), quoi: 'le nombre moyen de clients servis un jour ordinaire.', sert: 'C’est la base du calcul ; votre logiciel de gestion le donne. Sans lui, le calcul se rabat sur la surface de vente.', exemple: '240' },
        { faire: 'expliquer', sur: champ('dim-minutes'), quoi: 'le temps passé en moyenne avec un client, en minutes. Facultatif.', sert: 'Laissé vide, Solvéa compte 5 minutes, ou 4 avec un robot.', exemple: '6' },
        { faire: 'expliquer', sur: champ('dim-activite'), quoi: 'votre chiffre d’affaires annuel hors taxes, en euros. Facultatif.', sert: 'Il donne le nombre minimal de pharmaciens fixé par la réglementation. Il reste sur cet appareil.', exemple: '2 900 000' },
        { faire: 'taper', dans: '#dim-activite', texte: '2900000', dit: 'Saisissez l’activité annuelle', sert: 'La règle officielle s’affiche aussitôt, sous le calcul.' },
        { faire: 'expliquer', sur: '#dim-adjoints', nom: 'Règle officielle', quoi: 'le nombre de pharmaciens exigé en plus du titulaire : un par tranche révolue de 1,3 million d’euros.', sert: 'Solvéa le compare à votre équipe, titulaires associés à temps plein compris. Les seuils peuvent être révisés : vérifiez le texte en vigueur.' },
        // L'activité saisie pour l'exemple est retirée.
        { faire: 'action', jouer: () => remettre() },
      ],
    },
    {
      chapitre: 'Réglages',
      qui: o.HELENE,
      cible: '#dimensionnement',
      titre: 'Le verdict du dimensionnement',
      texte: () => 'Avec vos chiffres, Solvéa estime l’effectif utile au comptoir, puis le compare aux contrats : les pharmaciens d’un côté, le reste du comptoir de l’autre.',
      jouer: () => {
        remettre();
        o.helene('officine');
      },
      gestes: [
        { faire: 'expliquer', sur: '#dim-comptoir', nom: 'Au comptoir', quoi: 'quatre repères : l’heure ordinaire, l’heure de pointe, le plancher et le plafond utile.', sert: 'Le plafond vient de vos postes de comptoir : au-delà, une personne de plus n’a pas où servir.' },
        { faire: 'expliquer', sur: '#dim-pharmaciens', nom: 'Pharmaciens', quoi: 'les temps plein de pharmaciens au contrat, face à ceux qu’il faut.', sert: 'Un pharmacien présent sur toute l’ouverture, congés et absences compris. Le verdict va de « Il en manque » à « Plus qu’il n’en faut ».' },
        { faire: 'expliquer', sur: '#dim-equipe', nom: 'Préparateurs et comptoir', quoi: 'la même comparaison pour le reste du comptoir.', sert: 'Chacun compte pour ce qu’il apporte : un préparateur pour 1, un étudiant pour 0,8, un apprenti ou un animateur pour 0,5.' },
        { faire: 'expliquer', sur: '#dim-ecarts', nom: 'Vos minimums au comptoir', quoi: 'les minimums de l’onglet « Comptoir » qui s’écartent du repère.', sert: 'Un minimum qui paraît bas, ou plus haut que vos postes ne permettent : à vous de juger.', facultatif: true },
        { faire: 'expliquer', sur: '#dimensionnement .dim-calcul > summary', nom: 'D’où vient ce calcul', quoi: 'toutes les hypothèses du calcul, écrites en clair.', sert: 'Temps par client, heure de pointe, travail hors comptoir, absences : rien n’est caché.' },
      ],
    },
    {
      chapitre: 'Réglages',
      qui: o.HELENE,
      cible: '#acc-modele',
      titre: 'Qui prépare le planning',
      texte: () => 'Dans « Planning », trois rubriques : qui prépare le planning, quand le publier, et vos postes types.',
      jouer: () => {
        remettre();
        horairesExemple();
        o.helene('officine');
      },
      gestes: [
        { faire: 'expliquer', sur: '#reglages-onglet-planning', nom: 'Planning', quoi: 'l’onglet de la préparation et de la publication du planning.' },
        { faire: 'expliquer', sur: avecTexte("[data-focus='modele'] label", 'Avec l’équipe'), nom: 'Avec l’équipe', quoi: 'chacun donne ses préférences pour le mois suivant, puis vous construisez.', sert: 'L’équipe a la carte « Mes préférences » dans « Mes demandes », et les propositions de planning en tiennent compte.' },
        { faire: 'expliquer', sur: avecTexte("[data-focus='modele'] label", 'Vous seul'), nom: 'Vous seul', quoi: 'vous construisez sans recueillir de préférences.', sert: 'L’équipe consulte le planning une fois publié. Vous pouvez changer d’avis : rien n’est effacé.' },
        { faire: 'expliquer', sur: '#acc-modele .qp-limite', nom: 'Préférences à donner avant le', quoi: 'le jour du mois précédent où l’équipe doit avoir donné ses préférences.', sert: 'Solvéa écrit à côté la date limite du mois prochain ; le tableau de bord compte les préférences reçues.', exemple: '20' },
        { faire: 'expliquer', sur: '#qp-effets', nom: 'Ce que ce choix change', quoi: 'ce que votre choix change, pour l’équipe et pour vous.', sert: 'Le texte suit le choix coché.' },
        { faire: 'cliquer', sur: avecTexte("[data-focus='modele'] label", 'Vous seul'), dit: 'Cliquez sur « Vous seul »', sert: 'La date limite disparaît, et le texte dessous change.' },
        { faire: 'pause', ms: 2200, dit: 'Pour l’équipe, plus de carte « Mes préférences »', sert: 'Pour vous, plus de date limite à attendre.' },
        { faire: 'cliquer', sur: avecTexte("[data-focus='modele'] label", 'Avec l’équipe'), dit: 'Revenez à « Avec l’équipe »', sert: 'C’est le choix de l’exemple : l’équipe donne ses préférences.' },
      ],
    },
    {
      chapitre: 'Réglages',
      qui: o.HELENE,
      cible: '#acc-publication',
      titre: 'La publication du planning',
      texte: () => 'Le planning se transmet à l’équipe un mois à la fois. Vous fixez l’échéance et le rappel ; Solvéa peut prendre le relais.',
      jouer: () => {
        remettre();
        o.helene('officine');
      },
      gestes: [
        { faire: 'expliquer', sur: '#acc-publication > summary', nom: 'Publication du planning, au mois', quoi: 'la rubrique de l’échéance de publication.', sert: 'Repliée, elle résume le délai, le rappel et le relais.' },
        { faire: 'expliquer', sur: '#pub-delai', nom: 'Jours avant le 1er du mois', quoi: 'combien de jours avant le début du mois le planning doit être publié.', sert: 'Solvéa en tire la date limite, rappelée sur le tableau de bord.', exemple: '14' },
        { faire: 'expliquer', sur: '#pub-rappel', nom: 'Jours de rappel', quoi: 'combien de jours avant cette échéance le rappel commence.', sert: 'À 0, il n’y a pas de rappel.', exemple: '7' },
        { faire: 'expliquer', sur: '#acc-publication .pub-exemple', nom: 'Pour le mois prochain', quoi: 'le calcul appliqué au mois prochain : début du rappel et date limite.', sert: 'Il se met à jour dès que vous changez un chiffre.' },
        { faire: 'expliquer', sur: champ('pub-relais'), nom: 'Passé l’échéance, laisser Solvéa préparer le planning', quoi: 'cochez pour que Solvéa prépare les semaines restées vides, si rien n’est fait à l’échéance.', sert: 'Il reprend pour chacun sa journée la plus fréquente sur vos dernières semaines publiées. Un planning commencé à la main n’est jamais touché, et rien n’est publié sans vous.' },
        { faire: 'expliquer', sur: '#acc-publication .of-note', nom: 'Sans serveur', quoi: 'un rappel : Solvéa fonctionne sur cet appareil.', sert: 'Le rappel et la préparation se font quand un titulaire ouvre l’application.' },
      ],
    },
    {
      chapitre: 'Réglages',
      qui: o.HELENE,
      cible: '#acc-postes',
      titre: 'Les postes types',
      texte: () => 'Vos horaires habituels. Ils servent à poser un poste d’un clic, et les propositions de planning ne posent que ces horaires-là.',
      jouer: () => {
        remettre();
        o.helene('officine');
      },
      gestes: [
        { faire: 'expliquer', sur: '#acc-postes > summary', nom: 'Postes types', quoi: 'la liste de vos postes types, un par ligne.', sert: 'Repliée, la rubrique les énumère. Chaque case d’une ligne se corrige sur place.' },
        { faire: 'expliquer', sur: '#acc-postes tbody tr:first-child .pt-nom', nom: 'Poste', quoi: 'le nom du poste type.', sert: 'Il apparaît dans la fenêtre d’un poste, pour le choisir d’un clic.', exemple: 'Ouverture' },
        { faire: 'expliquer', sur: '#acc-postes tbody tr:first-child select', nom: 'Couleur', quoi: 'la couleur de ses tuiles dans le planning.', sert: '« Automatique » suit l’horaire : jaune le matin, orange la journée, bleu la journée longue, violet l’après-midi. Une couleur choisie va aux postes qui ont exactement ces horaires.' },
        { faire: 'expliquer', sur: '[aria-label="Début du poste Ouverture"]', nom: 'Début', quoi: 'l’heure de prise de poste.', exemple: '8 h 30' },
        { faire: 'expliquer', sur: '[aria-label="Fin du poste Ouverture"]', nom: 'Fin', quoi: 'l’heure de fin du poste.', sert: 'Le travail effectif se recalcule aussitôt, à droite.', exemple: '16 h 30' },
        { faire: 'expliquer', sur: '[aria-label="Début de pause du poste Ouverture"]', nom: 'Début de pause', quoi: 'le début de la pause déjeuner.', sert: 'La pause coupe le poste : elle n’est pas comptée dans le travail effectif. Un poste sans pause affiche « Sans pause ».', exemple: '12 h 30' },
        { faire: 'expliquer', sur: '[aria-label="Fin de pause du poste Ouverture"]', nom: 'Fin de pause', quoi: 'la fin de la pause déjeuner.', exemple: '13 h 30' },
        { faire: 'expliquer', sur: '#acc-postes tbody tr:first-child td.small', nom: 'Jours', quoi: 'les jours où ce poste type est proposé.', sert: 'Les propositions de planning ne l’utilisent que ces jours-là. Ils se choisissent à la création du poste type.' },
        { faire: 'expliquer', sur: '#acc-postes tbody tr:first-child td.num', nom: 'Travail effectif', quoi: 'la durée travaillée, pause déduite, calculée par Solvéa.' },
        { faire: 'expliquer', sur: '[aria-label="Retirer le poste Ouverture"]', nom: 'Retirer', quoi: 'supprime ce poste type de la liste.', sert: 'Les postes déjà posés au planning ne changent pas.' },
      ],
    },
    {
      chapitre: 'Réglages',
      qui: o.HELENE,
      cible: '#acc-parametres',
      titre: 'Paramètres et coûts',
      texte: () => 'Le dernier onglet : la valeur du point, le plafond des préférences prioritaires, le chiffre d’affaires, l’affichage des coûts, et la remise à zéro.',
      jouer: () => {
        remettre();
        o.helene('officine');
      },
      gestes: [
        { faire: 'expliquer', sur: '#reglages-onglet-parametres', nom: 'Paramètres', quoi: 'l’onglet des paramètres de paie et de coûts.' },
        { faire: 'expliquer', sur: lib('Valeur du point conventionnel'), quoi: 'la valeur du point de la convention collective, en euros, reprise du barème en vigueur.', sert: 'Elle convertit en euros les indemnités de garde comptées en points. Tant qu’elle est vide, elles restent exprimées en points.' },
        { faire: 'expliquer', sur: lib('Demandes prioritaires par personne'), quoi: 'combien de préférences prioritaires chacun peut avoir en même temps.', sert: 'Une préférence prioritaire passe avant les autres. Le plafond est le même pour toute l’équipe ; chaque fiche montre où la personne en est.', exemple: '2' },
        { faire: 'expliquer', sur: lib('Chiffre d\'affaires annuel HT'), quoi: 'votre chiffre d’affaires annuel hors taxes, en euros.', sert: 'L’écran « Équipe » en tire le nombre de pharmaciens attendu, et vous prévient s’il en manque.', exemple: '2 900 000' },
        { faire: 'expliquer', sur: champ('couts-afficher'), nom: 'Afficher les coûts estimés', quoi: 'cochez pour voir des coûts estimés dans Solvéa.', sert: 'Un champ « Taux horaire brut » apparaît alors dans chaque fiche. Une personne sans taux n’est pas comptée. Ce n’est jamais un calcul de paie.' },
        { faire: 'expliquer', sur: '#acc-zero > summary', nom: 'Repartir de zéro', quoi: 'la rubrique qui efface tout ce qui est enregistré sur cet appareil.' },
        { faire: 'expliquer', sur: avecTexte('#acc-zero button', 'Réinitialiser'), nom: 'Réinitialiser', quoi: 'efface l’officine, l’équipe et les plannings, puis ramène à l’écran de création.', sert: 'Un second bouton demande de confirmer avant d’effacer.' },
      ],
    },

    // ---------------------------------------------------------------- 2. Postes types
    {
      chapitre: 'Postes types',
      qui: o.HELENE,
      cible: '#acc-postes',
      titre: 'Les horaires d’un poste type',
      texte: () => '« Ajouter un poste type », dans l’onglet « Planning », ouvre cette fenêtre. Un modèle de départ remplit tout ; chaque champ reste modifiable.',
      jouer: () => {
        remettre();
        o.helene('officine');
      },
      gestes: [
        { faire: 'cliquer', sur: avecTexte('#acc-postes button', 'Ajouter un poste type'), dit: 'Cliquez sur « Ajouter un poste type »', sert: 'La fenêtre s’ouvre, préremplie avec le modèle « Journée ».' },
        { faire: 'attendre', que: '.dialog #pt-modele' },
        { faire: 'expliquer', sur: lib('Partir de', '.dialog'), quoi: 'un modèle de départ : matin, après-midi, journée, journée longue, ou un poste à régler vous-même.', sert: 'Choisir un modèle remplit d’un coup le nom, les horaires, la pause et la couleur.' },
        { faire: 'expliquer', sur: lib('Nom du poste', '.dialog'), quoi: 'le nom sous lequel vous retrouverez ce poste.', sert: 'Il est obligatoire : sans lui, « Ajouter le poste type » reste grisé.', exemple: 'Renfort du midi' },
        { faire: 'expliquer', sur: lib('Début', '.dialog'), quoi: 'l’heure de prise de poste.', exemple: '8 h 30' },
        { faire: 'expliquer', sur: lib('Fin', '.dialog'), quoi: 'l’heure de fin du poste.', sert: 'Elle doit suivre le début : sinon la fenêtre le signale, et rien ne s’ajoute.', exemple: '16 h 30' },
        { faire: 'expliquer', sur: lib('Pause déjeuner', '.dialog'), quoi: 'la durée de la pause qui coupe le poste, de 30 minutes à 2 heures, ou sans pause.', sert: 'Elle n’est pas comptée dans le travail effectif.', exemple: '1 h' },
        { faire: 'expliquer', sur: lib('Pause à partir de', '.dialog'), quoi: 'l’heure où commence cette pause.', sert: 'La pause doit tenir dans le poste. Le champ disparaît pour un poste sans pause.', exemple: '12 h 30' },
        { faire: 'expliquer', sur: lib('Pauses courtes', '.dialog'), quoi: 'une pause de 10, 15 ou 20 minutes par demi-journée, ou aucune.', sert: 'Elle se place au milieu de chaque demi-journée d’au moins trois heures. Elle se lit sur le planning, sans changer le décompte des heures.' },
        FERMER,
      ],
    },
    {
      chapitre: 'Postes types',
      qui: o.HELENE,
      cible: '#acc-postes',
      titre: 'Les jours, la couleur, l’aperçu',
      texte: () => 'La suite de la fenêtre : les jours où le poste est proposé, sa couleur, et l’aperçu de sa tuile dans le planning.',
      jouer: () => {
        remettre();
        o.helene('officine');
      },
      gestes: [
        { faire: 'cliquer', sur: avecTexte('#acc-postes button', 'Ajouter un poste type'), dit: 'Cliquez sur « Ajouter un poste type »', sert: 'La fenêtre du poste type s’ouvre.' },
        { faire: 'attendre', que: '.dialog #pt-modele' },
        { faire: 'choisir', dans: '#pt-modele', valeur: 'longue', dit: 'Partez du modèle « Journée longue »', sert: 'Nom, horaires, pause et couleur changent d’un coup.' },
        { faire: 'expliquer', sur: lib('Jours', '.dialog'), quoi: 'les jours où ce poste est proposé : du lundi au vendredi, le samedi, du lundi au samedi, ou tous les jours.', sert: 'Les propositions de planning ne l’utilisent que ces jours-là.' },
        { faire: 'expliquer', sur: lib('Couleur', '.dialog'), quoi: 'la couleur des tuiles de ce poste dans le planning.', sert: '« Automatique » suit l’horaire : jaune le matin, orange la journée, bleu la journée longue, violet l’après-midi.' },
        { faire: 'expliquer', sur: '.dialog .pt-nuancier', nom: 'Le nuancier', quoi: 'les mêmes couleurs, à choisir d’un clic.' },
        { faire: 'cliquer', sur: '.dialog .pt-nuance.k-anis', dit: 'Touchez la pastille « Vert anis »', sert: 'La liste « Couleur » et l’aperçu suivent aussitôt.' },
        { faire: 'expliquer', sur: '.dialog .pt-apercu', nom: 'Aperçu dans le planning', quoi: 'la tuile telle qu’elle apparaîtra, avec le travail effectif et la pause.', sert: 'Si les horaires ne vont pas, l’aperçu écrit « Horaires à corriger ».' },
        { faire: 'expliquer', sur: o.VALIDER, nom: 'Ajouter le poste type', quoi: 'enregistre le poste type et l’ajoute à la liste des réglages.', sert: '« Annuler » referme la fenêtre sans rien garder. Ici, on n’ajoute rien.' },
        FERMER,
      ],
    },

    // ---------------------------------------------------------------- 3. Équipe
    {
      chapitre: 'Équipe',
      qui: o.HELENE,
      cible: '.content .split > :first-child',
      titre: 'La liste de l’équipe',
      texte: () => 'L’équipe se range par fonction ; à droite, la fiche de la personne choisie. En tête, le nombre de pharmaciens face à celui qu’exige votre activité.',
      jouer: () => equipe(null),
      gestes: [
        { faire: 'expliquer', sur: '.content .page-head .card', nom: 'Pharmaciens', quoi: 'les pharmaciens de l’équipe, hors titulaires, en équivalent temps plein, face au nombre attendu.', sert: 'Le nombre attendu vient du chiffre d’affaires des réglages : un pharmacien par tranche de 1,3 million d’euros.' },
        { faire: 'expliquer', sur: '.content .notice.warn', nom: 'Les alertes de l’équipe', quoi: 'ce qui ne va pas dans la composition de l’équipe.', sert: 'Par exemple, un contrat sous le minimum du temps partiel, ou trop peu d’heures de pharmacien pour l’activité.' },
        { faire: 'expliquer', sur: "[data-focus='ajouter-personne']", nom: 'Ajouter une personne', quoi: 'ouvre la fenêtre de création d’une personne.', sert: 'Elle reçoit aussitôt un identifiant et un mot de passe provisoire.' },
        { faire: 'expliquer', sur: '.content .poste-titre', nom: 'Les groupes', quoi: 'un groupe par fonction, avec le nombre de personnes.', sert: 'Titulaires, pharmaciens, préparateurs, animateurs, apprentis, étudiants : on ne les mélange pas.' },
        { faire: 'expliquer', sur: avecTexte('.content .g-item', 'Nicolas'), nom: 'Une personne', quoi: 'son nom, sa fonction et ses heures de contrat, dans la couleur de son profil.', sert: 'Un clic ouvre sa fiche à droite. « (temps partiel) » signale un contrat de moins de 35 heures.' },
        { faire: 'expliquer', sur: avecTexte('.content .eyebrow', 'Remplaçants habituels'), nom: 'Remplaçants habituels', quoi: 'les personnes extérieures à l’équipe, appelées en renfort.', sert: 'Elles sont proposées quand une absence laisse un poste à couvrir.' },
        { faire: 'expliquer', sur: "[data-focus='points-forts'] button", nom: 'Voir les statistiques de l’équipe', quoi: 'ouvre les statistiques : composition, compétences couvertes, points forts de chacun.' },
        { faire: 'cliquer', sur: avecTexte('.content .g-item', 'Nicolas'), dit: 'Cliquez sur la ligne de Nicolas', sert: 'Sa fiche s’ouvre à droite.' },
      ],
    },
    {
      chapitre: 'Équipe',
      qui: o.HELENE,
      cible: FICHE,
      titre: 'La fiche : poste et contrat',
      texte: () => 'La fiche se range en rubriques qui se replient. La première : la fonction, les heures et le contrat. Pour l’exemple, les coûts estimés sont affichés : le taux horaire apparaît.',
      jouer: () => equipe('p_camille', true),
      gestes: [
        { faire: 'expliquer', sur: avecTexte(`${FICHE} .card-head button`, 'Besoin ou absence'), nom: 'Besoin ou absence', quoi: 'enregistre pour cette personne un besoin régulier ou une absence.', sert: 'Saisi par vous, il est accepté d’emblée : une absence libère ses postes, à couvrir dans « Résoudre ».' },
        { faire: 'expliquer', sur: rubrique('Poste et contrat', FICHE), nom: 'Poste et contrat', quoi: 'la rubrique du métier et du contrat.', sert: 'Repliée, elle résume la fonction, le contrat et l’ancienneté.' },
        { faire: 'expliquer', sur: lib('Fonction', FICHE), quoi: 'le métier de la personne.', sert: 'Il fixe la couleur du profil, les compétences possibles et le contrôle « pharmacien présent ». « Pharmacien titulaire » sort la personne du décompte salarié.' },
        { faire: 'expliquer', sur: lib('Heures par semaine', FICHE), quoi: 'les heures du contrat, par semaine.', sert: 'Elles servent au compteur d’heures, aux propositions de planning et aux parts d’équité.', exemple: '35' },
        { faire: 'expliquer', sur: lib('Type de contrat', FICHE), quoi: 'la nature du contrat : CDI, CDD, apprentissage, professionnalisation, stage ou remplacement ponctuel.', sert: 'Il se lit dans la fiche et dans « Mon compte » ; les statistiques de l’équipe en font la répartition.' },
        { faire: 'expliquer', sur: lib('Entrée dans la pharmacie', FICHE), nom: 'Entrée dans la pharmacie', quoi: 'la date d’arrivée dans la pharmacie. Facultatif.', sert: 'Solvéa en tire l’ancienneté, écrite juste dessous et reprise dans les statistiques.', exemple: '13/01/2014' },
        { faire: 'expliquer', sur: lib('Taux horaire brut', FICHE), nom: 'Taux horaire brut (€)', quoi: 'le salaire horaire brut, en euros. Facultatif.', sert: 'Il ne sert qu’à estimer des coûts, et seuls les titulaires le voient. Il n’apparaît que si les coûts estimés sont affichés dans les réglages.', exemple: '15,80' },
        // Les coûts estimés redeviennent masqués, comme dans l’exemple.
        { faire: 'action', jouer: () => remettre() },
      ],
    },
    {
      chapitre: 'Équipe',
      qui: o.HELENE,
      cible: FICHE,
      titre: 'Compétences et diplômes',
      texte: () => 'Un clic suffit pour ajouter ou retirer une compétence. Les actes réservés aux pharmaciens sont montrés, verrouillés, aux autres métiers.',
      jouer: () => {
        equipe('p_camille');
        ficheExemple('p_camille');
      },
      gestes: [
        { faire: 'expliquer', sur: rubrique('Compétences et diplômes', FICHE), nom: 'Compétences et diplômes', quoi: 'les compétences et diplômes de la personne, par famille.', sert: 'À droite, le nombre de compétences cochées. Chacun peut aussi tenir les siennes à jour dans son compte : les titulaires en sont avertis.' },
        { faire: 'expliquer', sur: `${FICHE} .comp-famille[aria-label="Actes, diplômes et habilitations"]`, nom: 'Actes, diplômes et habilitations', quoi: 'vaccination, tests, entretiens, orthopédie, contention, préparations, gestes d’urgence.', sert: 'Un rendez-vous de vaccination, de test ou d’entretien confié à une personne sans la compétence est bloqué par les contrôles.' },
        { faire: 'expliquer', sur: `${FICHE} [data-competence="vaccination"]`, nom: 'Vaccination', quoi: 'une compétence : touchez-la pour la cocher ou la décocher.', sert: 'Cochée, elle se colore et porte une coche.' },
        { faire: 'expliquer', sur: `${FICHE} [data-competence="entretien"] > span:not(.sr)`, nom: 'Entretiens pharmaceutiques', quoi: 'un acte réservé aux pharmaciens, verrouillé pour un préparateur.', sert: 'Un cadenas le signale : il ne peut pas être coché.' },
        { faire: 'expliquer', sur: `${FICHE} .comp-regle`, nom: 'La raison du verrou', quoi: 'la règle, écrite sous les compétences.', sert: 'Un préparateur conseille et délivre au comptoir, sous le contrôle effectif d’un pharmacien présent.' },
        { faire: 'expliquer', sur: `${FICHE} .comp-famille[aria-label="Conseil"]`, nom: 'Conseil', quoi: 'les domaines de conseil : phytothérapie, dermocosmétique, puériculture, diabète, sevrage tabagique…', sert: 'Les statistiques de l’équipe montrent les compétences couvertes, et celles qui manquent.' },
        { faire: 'cliquer', sur: `${FICHE} [data-competence="dermo"]`, dit: 'Touchez « Dermatologie et dermocosmétique »', sert: 'La compétence est cochée, et le compteur de la rubrique monte.' },
        { faire: 'cliquer', sur: `${FICHE} [data-competence="dermo"]`, dit: 'Touchez-la de nouveau', sert: 'Elle est retirée : un second toucher annule le premier.' },
        { faire: 'expliquer', sur: `${FICHE} .comp-famille[aria-label="Organisation"]`, nom: 'Organisation', quoi: 'les tâches d’organisation : commandes, tiers payant, merchandising.' },
        { faire: 'expliquer', sur: avecTexte(`${FICHE} p.tiny`, 'rendez-vous'), nom: 'Rendez-vous', quoi: 'un rappel : un rendez-vous demande une personne formée en poste, et la salle libre.' },
      ],
    },
    {
      chapitre: 'Équipe',
      qui: o.HELENE,
      cible: FICHE,
      titre: 'Droits, suivi et connexion',
      texte: () => 'Qui peut gérer l’officine, ce que Solvéa a noté sur douze mois, et le compte de connexion de la personne.',
      jouer: () => equipe('p_camille'),
      gestes: [
        { faire: 'expliquer', sur: rubrique('Droits d’accès', FICHE), nom: 'Droits d’accès', quoi: 'ce que la personne peut faire dans Solvéa.' },
        { faire: 'expliquer', sur: champ('gestion-p_camille'), nom: 'Peut modifier les plannings, l’équipe, les gardes et les réglages', quoi: 'cochez pour ouvrir la gestion à cette personne.', sert: 'Cochée, la personne se connecte à l’espace responsable. Sinon, elle n’a que son espace : son planning, le planning publié et ses demandes. Seul le titulaire principal coche cette case.' },
        { faire: 'expliquer', sur: rubrique('Suivi sur 12 mois', FICHE), nom: 'Suivi sur 12 mois', quoi: 'les compteurs de présence des douze derniers mois.' },
        { faire: 'expliquer', sur: `${FICHE} .compteurs`, nom: 'Les compteurs', quoi: 'retards, départs anticipés, absences non prévues, congés, arrêts, formations et remplacements assurés.', sert: 'Un compteur se colore à partir de trois retards, ou de deux absences non prévues.' },
        { faire: 'expliquer', sur: avecTexte(`${FICHE} p.tiny`, 'Retards et départs'), nom: 'D’où viennent les retards', quoi: 'retards et départs se notent dans la vue d’une journée, depuis « Construire ».', sert: 'Des dates et des durées, jamais une raison.' },
        { faire: 'expliquer', sur: rubrique('Compte de connexion', FICHE), nom: 'Compte de connexion', quoi: 'l’identifiant de la personne et son mot de passe.' },
        { faire: 'expliquer', sur: dansRubrique('Compte de connexion', '.notice', FICHE), nom: 'Identifiant et mot de passe', quoi: 'l’identifiant de connexion, et le mot de passe provisoire tant que la personne ne l’a pas changé.', sert: 'Transmettez-le de vive voix : la personne le remplace dans « Mon compte ». Ensuite, personne d’autre ne peut le lire.' },
        { faire: 'expliquer', sur: avecTexte(`${FICHE} button`, 'Nouveau mot de passe provisoire'), nom: 'Nouveau mot de passe provisoire', quoi: 'crée un nouveau mot de passe provisoire, si la personne a oublié le sien.', sert: 'L’ancien ne fonctionne plus. Seul le titulaire principal a ce bouton.' },
      ],
    },
    {
      chapitre: 'Équipe',
      qui: o.HELENE,
      cible: FICHE,
      titre: 'Volontariat, besoins et absences',
      texte: () => 'Le volontariat, les besoins personnels et les absences à venir. D’abord la fiche de Léa, pharmacienne à temps partiel.',
      jouer: () => equipe('p_lea'),
      gestes: [
        { faire: 'expliquer', sur: rubrique('Volontariat', FICHE), nom: 'Volontariat', quoi: 'ce que la personne accepte de faire en plus de son contrat.' },
        { faire: 'expliquer', sur: lib('heures complémentaires', FICHE), nom: 'Volontaire pour des heures complémentaires', quoi: 'cochez si la personne, à temps partiel, accepte des heures en plus quand un collègue manque.', sert: 'Dans « Résoudre », Solvéa peut alors proposer d’allonger sa semaine pour couvrir une absence.' },
        { faire: 'expliquer', sur: lib('Volontaire pour les gardes', FICHE), nom: 'Volontaire pour les gardes', quoi: 'cochez si la personne se porte volontaire pour les gardes. Réservé aux pharmaciens.', sert: 'À charge égale, un volontaire passe en tête des candidats pour une garde. Le repos qui suit reste contrôlé.' },
        { faire: 'expliquer', sur: rubrique('Besoins personnels', FICHE), nom: 'Besoins personnels', quoi: 'les besoins réguliers reconnus : une indisponibilité, une préférence d’horaire.', sert: 'À droite, les préférences prioritaires utilisées, face au plafond des réglages.' },
        { faire: 'expliquer', sur: dansRubrique('Besoins personnels', '> .row', FICHE), nom: 'Un besoin', quoi: 'le besoin, ses dates et son niveau.', sert: 'La corbeille, à droite, le retire.' },
        { faire: 'expliquer', sur: avecTexte(`${FICHE} p.tiny`, 'Indisponibilité reconnue'), nom: 'Les trois niveaux', quoi: 'ce que veut dire chaque niveau.', sert: 'Une indisponibilité reconnue est impérative. Une préférence prioritaire passe avant les autres, dans la limite du plafond. Une simple préférence est suivie si possible.' },
        { faire: 'cliquer', sur: avecTexte('.content .g-item', 'Nicolas'), dit: 'Ouvrez la fiche de Nicolas', sert: 'Nicolas a demandé un congé, encore à approuver.' },
        { faire: 'expliquer', sur: dansRubrique('Absences à venir', '> .row', FICHE), nom: 'Absences à venir', quoi: 'chaque absence à venir et ses dates : ici, un congé demandé.', sert: '« Approuver » l’accepte d’un clic. Le refus se fait dans « Résoudre ».' },
        { faire: 'expliquer', sur: avecTexte(`${FICHE} button`, 'Retirer de l’équipe'), nom: 'Retirer de l’équipe', quoi: 'retire la personne de l’équipe.', sert: 'Ses postes, ses besoins et ses absences partent avec elle ; un second bouton demande confirmation. Le titulaire principal ne peut pas être retiré.' },
      ],
    },
    {
      chapitre: 'Équipe',
      qui: o.HELENE,
      cible: "[data-focus='marques']",
      titre: 'Les marques d’un animateur ou d’une animatrice',
      texte: () => 'Pour un animateur ou une animatrice, la fiche ajoute les marques présentées, et pour quelles familles de produits. Sarah les retrouve sur son accueil.',
      jouer: () => {
        equipe('p_sarah');
        ficheExemple('p_sarah');
      },
      gestes: [
        { faire: 'expliquer', sur: "[data-focus='marques'] > summary", nom: 'Marques présentées', quoi: 'la rubrique des marques animées, avec leur nombre.' },
        { faire: 'expliquer', sur: champ('mq-mq_1'), nom: 'Marque', quoi: 'le nom d’une marque présentée, modifiable ici.', exemple: 'Lumaderm' },
        { faire: 'expliquer', sur: "[data-focus='marques'] .mq .mq-types", nom: 'Familles de produits', quoi: 'les familles de produits pour lesquelles cette marque est présentée.', sert: 'Touchez une famille pour l’ajouter ou la retirer. Une marque sans famille n’apparaît pas encore sur l’accueil de l’animateur.' },
        { faire: 'expliquer', sur: '[aria-label="Retirer la marque Lumaderm"]', nom: 'Retirer la marque', quoi: 'retire cette marque de la fiche.', sert: 'Elle reste dans le répertoire de la pharmacie, proposée aux autres animateurs et animatrices.' },
        { faire: 'expliquer', sur: champ('mq-nom'), nom: 'Une marque absente du répertoire', quoi: 'le nom d’une marque nouvelle, tel qu’on le dit au comptoir.', sert: 'Les marques déjà connues de la pharmacie se proposent au-dessus, d’un clic.' },
        { faire: 'taper', dans: '#mq-nom', texte: 'NHCO', dit: 'Écrivez le nom d’une marque', sert: 'Le bouton « Ajouter la marque » s’active.' },
        { faire: 'expliquer', sur: '#mq-ajouter', nom: 'Ajouter la marque', quoi: 'ajoute la marque à la fiche et au répertoire de la pharmacie.', sert: 'Il reste grisé tant que le nom est vide, ou si la marque est déjà présentée. Ici, on n’ajoute rien.' },
        // Le nom saisi pour l'exemple est effacé.
        { faire: 'action', jouer: () => vider('mq-nom') },
      ],
    },
    {
      chapitre: 'Équipe',
      qui: o.HELENE,
      cible: "[data-focus='rayons']",
      titre: 'Les rayons d’un rayonniste',
      texte: () => 'Pour un rayonniste, la fiche ajoute les rayons confiés. Pour l’exemple, Camille rejoint l’équipe comme rayonniste, le temps de cette étape.',
      jouer: () => {
        equipe(RAYONNISTE.id);
        o.poser((x) => (x.personnes.some((p) => p.id === RAYONNISTE.id) ? x : { ...x, personnes: x.personnes.concat({ ...RAYONNISTE, rayons: [...(RAYONNISTE.rayons ?? [])] }) }));
        useUi.getState().ouvrirPersonne(RAYONNISTE.id);
      },
      gestes: [
        { faire: 'expliquer', sur: "[data-focus='rayons'] > summary", nom: 'Rayons confiés', quoi: 'la rubrique des rayons tenus par un rayonniste, avec leur nombre.' },
        { faire: 'expliquer', sur: "[data-focus='rayons'] .mq-types", nom: 'Familles de produits', quoi: 'les familles de produits dont la personne tient les rayons.', sert: 'Touchez une famille pour la confier ou la retirer. La personne les retrouve dans son espace.' },
        { faire: 'cliquer', sur: "[data-focus='rayons'] .mq-types button[aria-pressed='false']", dit: 'Touchez une famille de produits', sert: 'Elle est confiée : elle porte une coche, et le compteur de la rubrique monte.' },
        { faire: 'pause', ms: 1400 },
        // La personne d'exemple quitte l'équipe : l'exemple retrouve son équipe d'origine.
        { faire: 'action', jouer: () => remettre() },
      ],
    },
    {
      chapitre: 'Équipe',
      qui: o.HELENE,
      cible: '.content .split > :first-child',
      titre: 'Ajouter une personne',
      texte: () => 'L’essentiel suffit pour commencer : prénom, nom, fonction et heures. Compétences, besoins et absences se complètent ensuite dans la fiche.',
      jouer: () => equipe(null, true),
      gestes: [
        { faire: 'cliquer', sur: "[data-focus='ajouter-personne']", sert: 'La fenêtre « Ajouter une personne » s’ouvre.' },
        { faire: 'attendre', que: '.dialog #personne-prenom' },
        { faire: 'taper', dans: '#personne-prenom', texte: 'Camille', dit: 'Saisissez le prénom', sert: 'Il apparaît sur chaque ligne du planning et sert, avec le nom, à créer l’identifiant de connexion.' },
        { faire: 'taper', dans: '#personne-nom', texte: 'Roux', dit: 'Puis le nom de famille', sert: 'Prénom et nom sont obligatoires : sans eux, « Ajouter » reste grisé.' },
        { faire: 'expliquer', sur: champ('personne-fonction'), quoi: 'son métier : titulaire, pharmacien, préparateur, étudiant, apprenti, rayonniste ou animateur.', sert: 'La fonction fixe la couleur du profil et les compétences possibles. Pour un titulaire, la fenêtre rappelle qu’il est hors décompte salarié.' },
        { faire: 'expliquer', sur: champ('personne-heures'), quoi: 'les heures du contrat, par semaine.', sert: 'Elles servent au compteur d’heures et aux parts d’équité.', exemple: '35' },
        { faire: 'expliquer', sur: champ('personne-taux'), quoi: 'le salaire horaire brut, en euros. Facultatif.', sert: 'Il n’apparaît que si les coûts estimés sont affichés dans les réglages.', exemple: '15,20' },
        { faire: 'expliquer', sur: '.dialog label.check', nom: 'Remplaçant habituel, extérieur à l’équipe', quoi: 'cochez pour une personne extérieure qui vient en renfort.', sert: 'Elle n’a ni heures de contrat ni compte de connexion ; elle est proposée quand une absence laisse un poste à couvrir.' },
        { faire: 'expliquer', sur: o.VALIDER, nom: 'Ajouter', quoi: 'crée la personne et ouvre sa fiche.', sert: 'Elle reçoit un identifiant et un mot de passe provisoire, à lui transmettre. Ici, on n’ajoute personne.' },
        { faire: 'action', jouer: () => {
          document.querySelector<HTMLElement>('.dialog .dialog-fermer')?.click();
          remettre();
        } },
      ],
    },

    // ---------------------------------------------------------------- 4. Règles
    {
      chapitre: 'Règles',
      qui: o.HELENE,
      cible: '.page-regles .jr-barre',
      titre: 'Les filtres des règles',
      texte: () => 'Tout ce que Solvéa vérifie, rangé par question. Une règle obligatoire bloque ; une alerte vous prévient et vous laisse décider.',
      jouer: () => {
        remettre();
        o.helene('regles');
      },
      gestes: [
        { faire: 'expliquer', sur: '.content .rg-legende', nom: 'Obligatoire ou alerte', quoi: 'les deux natures de règle, avec leur pictogramme.', sert: 'Le cadenas : le planning ne peut pas l’enfreindre. Le curseur : Solvéa vous prévient, vous décidez.' },
        { faire: 'expliquer', sur: avecTexte('.content .jr-filtre', 'Toutes'), nom: 'Toutes', quoi: 'montre toutes les règles ; le chiffre dit combien.' },
        { faire: 'expliquer', sur: avecTexte('.content .jr-filtre', 'Obligatoires'), nom: 'Obligatoires', quoi: 'ne garde que les règles que le planning ne peut pas enfreindre.' },
        { faire: 'expliquer', sur: avecTexte('.content .jr-filtre', 'Réglables'), nom: 'Réglables', quoi: 'ne garde que les alertes et les règles qui ont un seuil.' },
        { faire: 'expliquer', sur: avecTexte('.content .jr-filtre', 'À faire valider'), nom: 'À faire valider', quoi: 'ne garde que les règles tirées de sources secondaires.', sert: 'Elles sont à faire relire par un avocat en droit social ou un expert-comptable.' },
        { faire: 'cliquer', sur: avecTexte('.content .jr-filtre', 'Obligatoires'), dit: 'Cliquez sur « Obligatoires »', sert: 'La liste ne garde que les règles au cadenas.' },
        { faire: 'cliquer', sur: avecTexte('.content .jr-filtre', 'Toutes'), dit: 'Revenez à « Toutes »', sert: 'Toutes les règles reviennent.' },
        { faire: 'expliquer', sur: '.content .rg-tete', nom: 'Les questions', quoi: 'une question, et les règles qui y répondent.', sert: 'Durées, repos, présence, délais, gardes, puis les choix de votre officine : dans l’ordre où l’on construit un planning.' },
        { faire: 'expliquer', sur: '.content .rg-avis', nom: 'Une aide, pas une garantie', quoi: 'le nombre de règles à faire valider par un spécialiste.', sert: 'Elles portent la mention « À faire valider » dans la liste.' },
      ],
    },
    {
      chapitre: 'Règles',
      qui: o.HELENE,
      cible: '.page-regles .rg-grille',
      titre: 'Une règle et son seuil',
      texte: () => 'Une règle tient en une ligne : son nom, son seuil, son état. Ouverte, elle dit ce qu’elle contrôle et d’où elle vient, et son seuil se règle.',
      jouer: () => {
        remettre();
        o.helene('regles');
      },
      gestes: [
        // Toutes les règles sont affichées : un filtre a pu rester choisi.
        { faire: 'action', jouer: () => avecTexte('.content .jr-filtre', 'Toutes')()?.click() },
        { faire: 'expliquer', sur: () => regle(PLAFOND)?.querySelector('summary'), nom: 'Plafond d’heures par semaine choisi par l’officine', quoi: 'une règle : son nom, son seuil, et la mention « Désactivée » ou « À faire valider » s’il y a lieu.', sert: 'Un clic sur la ligne la déplie.' },
        { faire: 'expliquer', sur: dansRegle(PLAFOND, '.rg-corps > p'), nom: 'Ce que la règle contrôle', quoi: 'la description de la règle.' },
        { faire: 'expliquer', sur: dansRegle(PLAFOND, '.rg-seuil'), nom: 'Seuil', quoi: 'la valeur que Solvéa contrôle, dans l’unité écrite à côté.', sert: 'Ici, au-delà de 42 heures dans la semaine, le planning le signale sans bloquer.', exemple: '42 h' },
        { faire: 'taper', dans: dansRegle(PLAFOND, '.rg-seuil input'), texte: '40', dit: 'Essayez un autre seuil', sert: 'Un bouton « Enregistrer » apparaît : rien ne change tant que vous ne cliquez pas.' },
        { faire: 'expliquer', sur: dansRegle(PLAFOND, '.rg-reglages .btn.primary'), nom: 'Enregistrer', quoi: 'enregistre le nouveau seuil.', sert: 'Le changement est noté au journal. Ici, on n’enregistre rien.' },
        { faire: 'taper', dans: dansRegle(PLAFOND, '.rg-seuil input'), texte: '42', dit: 'Remettez la valeur de départ', sert: 'Le bouton disparaît : rien n’a changé.' },
        { faire: 'expliquer', sur: dansRegle(PLAFOND, '.rg-reglages label.check'), nom: 'Me prévenir', quoi: 'décochez pour faire taire cette alerte.', sert: 'La règle reste dans la liste, marquée « Désactivée ». Elle se réactive d’un clic.' },
        { faire: 'expliquer', sur: dansRegle(PLAFOND, '.rg-source'), nom: 'La source', quoi: 'd’où vient la règle, sa date d’effet et sa version.', sert: 'Un texte de loi, la convention collective, ou un choix de votre officine, comme ici.' },
        { faire: 'expliquer', sur: dansRegle('Repos quotidien', '.rg-fixe'), nom: 'Toujours active', quoi: 'la marque d’une règle obligatoire, ici le repos quotidien.', sert: 'Elle ne se désactive pas : à la place de « Me prévenir », la fiche écrit « Toujours active ».' },
      ],
    },

    // ---------------------------------------------------------------- 5. Votre compte
    {
      chapitre: 'Votre compte',
      qui: o.HELENE,
      cible: '.page-compte .card',
      titre: 'Votre profil et vos compétences',
      texte: () => '« Mon compte » réunit votre profil, vos compétences, l’apparence et votre mot de passe. Chaque membre de l’équipe a le sien.',
      jouer: () => {
        remettre();
        o.helene('compte');
      },
      gestes: [
        { faire: 'expliquer', sur: '.page-compte section.card', nom: 'Votre profil', quoi: 'votre nom, votre rôle, votre espace, votre ancienneté et la pharmacie.', sert: 'Ces informations viennent de votre fiche, dans « Équipe ».' },
        { faire: 'expliquer', sur: avecTexte('.page-compte .pill', 'Espace'), nom: 'Espace responsable', quoi: 'l’espace où vous travaillez : responsable, pharmacien ou équipe.', sert: 'Il décide des écrans de votre menu.' },
        { faire: 'expliquer', sur: avecTexte('.page-compte section.card button', 'Se déconnecter'), nom: 'Se déconnecter', quoi: 'ferme votre session sur cet appareil.', sert: 'Pour revenir, il faut de nouveau votre identifiant et votre mot de passe.' },
        { faire: 'expliquer', sur: '#mes-competences .card-head', nom: 'Mes compétences et diplômes', quoi: 'vos propres compétences, que vous tenez à jour.', sert: 'Le même choix que dans les fiches de l’équipe. Quand un membre change les siennes, ses titulaires en sont avertis.' },
        { faire: 'expliquer', sur: '#mes-competences [data-competence="entretien"]', nom: 'Entretiens pharmaceutiques', quoi: 'un acte réservé aux pharmaciens : en tant que titulaire, vous pouvez le cocher.', sert: 'Pour un préparateur, il apparaît verrouillé.' },
      ],
    },
    {
      chapitre: 'Votre compte',
      qui: o.HELENE,
      cible: 'section[aria-labelledby="c-apparence"]',
      titre: 'Le mode d’affichage',
      texte: () => 'Clair, mixte ou sombre : les mêmes écrans, présentés autrement. Vos réglages d’apparence ne changent que votre espace.',
      jouer: () => {
        remettre();
        o.helene('compte');
      },
      gestes: [
        { faire: 'expliquer', sur: 'label[for="mode-clair"]', nom: 'Clair', quoi: 'tout l’écran est clair.', sert: 'Le plus lisible en plein jour.' },
        { faire: 'expliquer', sur: 'label[for="mode-mixte"]', nom: 'Mixte', quoi: 'le menu est foncé, le contenu reste clair.' },
        { faire: 'expliquer', sur: 'label[for="mode-sombre"]', nom: 'Sombre', quoi: 'tout l’écran est foncé.', sert: 'Repose les yeux le soir.' },
        { faire: 'expliquer', sur: 'label[for="mode-auto"]', nom: 'Comme l’appareil', quoi: 'suit le réglage de votre appareil : clair le jour, sombre la nuit.' },
        { faire: 'action', jouer: () => (modeAvant = prefsCaroline().mode) },
        { faire: 'cliquer', sur: () => document.querySelector<HTMLElement>(`label[for="mode-${modeAvant === 'sombre' ? 'mixte' : 'sombre'}"]`), dit: 'Essayez un autre mode', sert: 'L’écran change aussitôt, sans rien recharger.' },
        { faire: 'pause', ms: 1800, dit: 'L’apparence a changé', sert: 'Le menu à votre nom, en haut à droite, propose aussi Clair, Mixte et Sombre.' },
        { faire: 'cliquer', sur: () => document.querySelector<HTMLElement>(`label[for="mode-${modeAvant}"]`), dit: 'Revenez au mode de départ', sert: 'Le choix est gardé pour votre espace seulement.' },
      ],
    },
    {
      chapitre: 'Votre compte',
      qui: o.HELENE,
      cible: 'section[aria-labelledby="c-apparence"]',
      titre: 'Couleur, disposition, taille du texte',
      texte: () => 'La couleur de votre espace, la disposition de votre tableau de bord et la taille du texte. Le choix ne vaut que pour vous.',
      jouer: () => {
        remettre();
        o.helene('compte');
      },
      gestes: [
        { faire: 'expliquer', sur: '.page-compte .choix.themes', nom: 'Couleur du thème', quoi: 'la couleur de votre espace : le logo et les boutons la suivent.', sert: 'Chaque profil a la sienne, pour savoir d’un coup d’œil où l’on est. Seul le titulaire principal peut changer la sienne.' },
        { faire: 'expliquer', sur: 'label[for="disposition-comptoir"]', nom: 'Comptoir et décisions', quoi: 'l’équipe du jour à gauche, ce qui attend votre décision à droite.', sert: 'Dessous, le planning à préparer et votre agenda.' },
        { faire: 'expliquer', sur: 'label[for="disposition-classique"]', nom: 'Priorité d’abord', quoi: 'la chose à faire en premier et votre agenda en tête.', sert: 'Dessous, les décisions, puis l’équipe du jour. Les mêmes informations, placées autrement.' },
        { faire: 'expliquer', sur: 'label[for="texte-normal"]', nom: 'Normal', quoi: 'la taille de texte habituelle.' },
        { faire: 'expliquer', sur: 'label[for="texte-grand"]', nom: 'Grand', quoi: 'agrandit le texte de tous les écrans.', sert: 'Pratique pour lire de plus loin, au comptoir.' },
        { faire: 'action', jouer: () => (texteAvant = prefsCaroline().texte) },
        { faire: 'cliquer', sur: () => document.querySelector<HTMLElement>(`label[for="texte-${texteAvant === 'grand' ? 'normal' : 'grand'}"]`), dit: 'Essayez l’autre taille', sert: 'Tout le texte change de taille, aussitôt.' },
        { faire: 'pause', ms: 1500 },
        { faire: 'cliquer', sur: () => document.querySelector<HTMLElement>(`label[for="texte-${texteAvant}"]`), dit: 'Revenez à la taille de départ' },
      ],
    },
    {
      chapitre: 'Votre compte',
      qui: o.HELENE,
      cible: 'section[aria-labelledby="c-code"]',
      titre: 'Mot de passe et clé de secours',
      texte: () => 'Votre identifiant, votre mot de passe et, pour le titulaire principal, la clé de secours qui permet de le redéfinir.',
      jouer: () => {
        remettre();
        o.helene('compte');
      },
      gestes: [
        { faire: 'expliquer', sur: 'section[aria-labelledby="c-code"] .card-head .small', nom: 'Identifiant', quoi: 'l’identifiant avec lequel vous vous connectez.', sert: 'Le même pour toutes vos pharmacies.' },
        { faire: 'expliquer', sur: 'section[aria-labelledby="c-code"] .card-head .pill', nom: 'Mot de passe personnel', quoi: 'dit si votre mot de passe est provisoire, ou choisi par vous.', sert: 'Un mot de passe provisoire, donné par le titulaire principal, se remplace ici.' },
        { faire: 'taper', dans: '#code-actuel', texte: 'ancien-code', dit: 'Saisissez votre mot de passe actuel', sert: 'Il prouve que c’est bien vous. L’œil, à droite du champ, affiche ce que vous tapez.' },
        { faire: 'taper', dans: '#code-nouveau', texte: 'Tilleul-2026', dit: 'Puis le nouveau, de 6 caractères au moins', sert: 'Seule une empreinte est gardée, sur cet appareil : personne ne peut le relire.' },
        { faire: 'expliquer', sur: avecTexte('section[aria-labelledby="c-code"] button', 'Changer le mot de passe'), nom: 'Changer le mot de passe', quoi: 'enregistre le nouveau mot de passe.', sert: 'Il reste grisé tant qu’un des deux champs est vide. Si le mot de passe actuel ne correspond pas, Solvéa le dit. Ici, on ne change rien.' },
        // Les deux champs de l'exemple sont vidés.
        { faire: 'action', jouer: () => {
          vider('code-actuel');
          vider('code-nouveau');
        } },
        { faire: 'expliquer', sur: 'section[aria-labelledby="c-code"] .notice', nom: 'Clé de secours', quoi: 'la clé qui permet de redéfinir votre mot de passe si vous l’oubliez.', sert: 'Notez-la à l’abri : elle seule ouvre la remise à neuf du mot de passe, à la connexion.' },
        { faire: 'expliquer', sur: avecTexte('.page-compte button', 'Relancer le tutoriel'), nom: 'Relancer le tutoriel', quoi: 'relance le tutoriel en dix étapes des espaces de gestion.', sert: 'Il part du tableau de bord.' },
      ],
    },

    // ---------------------------------------------------------------- 6. Plusieurs pharmacies et le menu
    {
      chapitre: 'Plusieurs pharmacies et le menu',
      qui: o.HELENE,
      cible: '.side .officine-sel',
      titre: 'Le sélecteur de pharmacie',
      texte: () => 'Une même personne peut gérer plusieurs pharmacies. Chacune a son équipe, ses réglages et ses plannings ; on passe de l’une à l’autre dans la barre latérale.',
      jouer: () => {
        remettre();
        o.helene('tableau');
      },
      gestes: [
        { faire: 'expliquer', sur: '.side .officine-sel', nom: 'Pharmacie', quoi: 'la pharmacie affichée ; la liste montre les autres pharmacies où vous avez un compte.', sert: 'En choisir une autre change tout : équipe, réglages, plannings. Vous gardez le même identifiant.' },
        { faire: 'expliquer', sur: '#officine-choix', nom: '＋ Ajouter une pharmacie…', quoi: 'le dernier choix de la liste, réservé au titulaire principal.', sert: 'Il ouvre l’assistant de création d’une pharmacie, que l’on parcourt juste après.' },
        { faire: 'expliquer', sur: '.side .nav-groupe.ordre .nav-label', nom: 'Préparer, Planifier, Suivre, Bilan', quoi: 'les groupes du menu, dans l’ordre du travail.', sert: 'On prépare, on planifie, on suit, puis on fait le bilan. Un fil relie les quatre groupes.' },
        { faire: 'expliquer', sur: '.topbar .espace-badge', nom: 'Espace titulaire', quoi: 'l’étiquette de l’espace où vous travaillez : titulaire, titulaire secondaire, gestion, pharmacien, préparateur…', sert: 'Sa couleur et son pictogramme disent quels droits s’appliquent. Dans l’exemple, elle ouvre aussi le menu de démonstration, pour changer de profil.' },
        { faire: 'expliquer', sur: '.topbar .espace-officine', nom: 'Nom de la pharmacie', quoi: 'le nom de la pharmacie affichée, à côté de l’étiquette.', sert: 'Il vient des réglages, et change avec la pharmacie choisie.' },
        { faire: 'expliquer', sur: '.side .side-foot', nom: 'Enregistré sur cet appareil', quoi: 'l’heure du dernier enregistrement.', sert: 'Solvéa garde tout sur cet appareil, sans serveur : chaque changement s’enregistre aussitôt.' },
      ],
    },
    {
      chapitre: 'Plusieurs pharmacies et le menu',
      qui: o.HELENE,
      cible: '.accueil-form',
      titre: 'Ajouter une pharmacie',
      texte: () => '« ＋ Ajouter une pharmacie… » dans le sélecteur, ou « Ajouter une pharmacie » dans le menu à votre nom, ouvre cet assistant. Trois étapes ; rien n’est créé avant la dernière.',
      jouer: () => {
        remettre();
        o.helene('nouvelle');
      },
      gestes: [
        versEtape(0),
        versEtape(0),
        { faire: 'expliquer', sur: '.accueil-hero .parcours', nom: 'Les trois étapes', quoi: 'la pharmacie, l’équipe, la vérification.', sert: 'L’étape en cours est mise en avant ; chacune se valide avant la suivante.' },
        { faire: 'taper', dans: '#officine-nom', texte: NOUVELLE, dit: 'Donnez un nom à la nouvelle pharmacie', sert: 'C’est le seul champ obligatoire de cette étape.' },
        { faire: 'expliquer', sur: champ('officine-surface'), nom: 'Surface de l’officine', quoi: 'la surface de l’officine, en mètres carrés. Facultatif.', sert: 'Elle rejoint « L’officine en chiffres », dans les réglages, où elle se corrige.', exemple: '120' },
        { faire: 'expliquer', sur: champ('sem-debut'), nom: 'Ouverture', quoi: 'l’heure d’ouverture du lundi au vendredi.', sert: 'Les cinq jours reçoivent les mêmes horaires ; chacun se règle ensuite dans les réglages.', exemple: '8 h 30' },
        { faire: 'expliquer', sur: champ('sem-fin'), nom: 'Fermeture', quoi: 'l’heure de fermeture du lundi au vendredi.', sert: 'Elle doit suivre l’ouverture, sinon l’assistant le signale.', exemple: '19 h 30' },
      ],
    },
    {
      chapitre: 'Plusieurs pharmacies et le menu',
      qui: o.HELENE,
      cible: '.accueil-form',
      titre: 'Le midi et le samedi',
      texte: () => 'Une coupure le midi, si la pharmacie ferme pour le déjeuner, et les horaires du samedi. Le dimanche est fermé : les gardes se gèrent à part.',
      jouer: () => {
        remettre();
        o.helene('nouvelle');
      },
      gestes: [
        versEtape(0),
        versEtape(0),
        // La coupure part décochée : le clic suivant la montre.
        { faire: 'action', jouer: () => (document.querySelector<HTMLInputElement>('#coupure')?.checked ? document.querySelector<HTMLInputElement>('#coupure')?.click() : undefined) },
        { faire: 'cliquer', sur: champ('coupure'), dit: 'Cochez « La pharmacie ferme le midi »', sert: 'Deux horaires apparaissent : la fermeture du midi et la réouverture.' },
        { faire: 'expliquer', sur: champ('midi-debut'), nom: 'Fermeture du midi', quoi: 'l’heure où la pharmacie ferme pour le déjeuner.', sert: 'La coupure doit tenir entre l’ouverture et la fermeture.', exemple: '12 h 30' },
        { faire: 'expliquer', sur: champ('midi-fin'), nom: 'Réouverture', quoi: 'l’heure où elle rouvre l’après-midi.', exemple: '14 h' },
        { faire: 'expliquer', sur: champ('samedi-ouvert'), nom: 'La pharmacie ouvre le samedi', quoi: 'décochez si la pharmacie est fermée le samedi.', sert: 'Cochée, ses deux horaires se règlent juste dessous.' },
        { faire: 'expliquer', sur: champ('sam-debut'), nom: 'Ouverture le samedi', quoi: 'l’heure d’ouverture du samedi.', exemple: '9 h' },
        { faire: 'expliquer', sur: champ('sam-fin'), nom: 'Fermeture le samedi', quoi: 'l’heure de fermeture du samedi.', exemple: '19 h' },
        { faire: 'cliquer', sur: '.accueil-actions button[type="submit"]', dit: 'Cliquez sur « Continuer : l’équipe »', sert: 'L’assistant vérifie cette étape, puis passe à l’équipe.' },
      ],
    },
    {
      chapitre: 'Plusieurs pharmacies et le menu',
      qui: o.HELENE,
      cible: '.accueil-form',
      titre: 'Vous, le titulaire principal',
      texte: () => 'Deuxième étape : l’équipe de la nouvelle pharmacie. Vous en êtes le titulaire principal ; vos prénom, nom et heures sont repris.',
      jouer: () => {
        remettre();
        o.helene('nouvelle');
      },
      gestes: [
        versEtape(1),
        versEtape(1),
        { faire: 'expliquer', sur: groupe('Vous, le titulaire principal'), nom: 'Vous, le titulaire principal', quoi: 'votre ligne : vous serez aussi le titulaire principal de cette pharmacie.', sert: 'Vous y décidez en dernier ressort : les décisions des autres titulaires attendent votre accord.' },
        { faire: 'expliquer', sur: champ('tit-prenom'), nom: 'Prénom', quoi: 'votre prénom, déjà repris.', sert: 'Il est obligatoire, comme le nom.' },
        { faire: 'expliquer', sur: champ('tit-nom'), nom: 'Nom', quoi: 'votre nom, déjà repris.' },
        { faire: 'expliquer', sur: champ('tit-heures'), nom: 'Heures par semaine', quoi: 'vos heures de présence prévues dans cette pharmacie.', sert: 'Pour un titulaire, c’est un objectif, pas un contrat.', exemple: '42' },
        { faire: 'expliquer', sur: '.accueil-form .notice.info', nom: 'Même identifiant', quoi: 'vous gardez votre identifiant et votre mot de passe.', sert: 'Une seule connexion pour toutes vos pharmacies : le sélecteur passe de l’une à l’autre.' },
        { faire: 'expliquer', sur: groupe('Autres titulaires'), nom: 'Autres titulaires', quoi: 'vos associés, s’il y en a.', sert: 'Ils ont les mêmes écrans que vous ; chacune de leurs décisions attend votre accord.' },
        { faire: 'expliquer', sur: avecTexte('.accueil-form button', 'Ajouter un titulaire'), nom: 'Ajouter un titulaire', quoi: 'ajoute une ligne pour un associé.', sert: 'Le curseur va droit sur son prénom.' },
      ],
    },
    {
      chapitre: 'Plusieurs pharmacies et le menu',
      qui: o.HELENE,
      cible: '.accueil-form',
      titre: 'Les autres membres de l’équipe',
      texte: () => 'Un groupe par fonction, une ligne par personne. Une ligne laissée vide est ignorée ; vous pourrez ajouter des personnes plus tard.',
      jouer: () => {
        remettre();
        o.helene('nouvelle');
      },
      gestes: [
        versEtape(1),
        versEtape(1),
        { faire: 'expliquer', sur: groupe('Pharmaciens'), nom: 'Pharmaciens', quoi: 'les pharmaciens de l’équipe, une ligne chacun.', sert: 'Avec les titulaires, ils assurent la présence d’un pharmacien, pauses comprises.' },
        { faire: 'expliquer', sur: () => document.querySelector('[id^="adj-"][id$="-prenom"]')?.closest<HTMLElement>('label'), nom: 'Prénom et nom', quoi: 'le prénom et le nom de la personne, sur sa ligne.', sert: 'À moitié remplie, une ligne est signalée : complétez-la ou retirez-la.' },
        { faire: 'expliquer', sur: () => document.querySelector('[id^="adj-"][id$="-heures"]')?.closest<HTMLElement>('label'), nom: 'Heures par semaine', quoi: 'les heures de son contrat, de 1 à 48.', sert: 'Un temps partiel est comparé au prorata.', exemple: '35' },
        { faire: 'expliquer', sur: () => groupe('Pharmaciens')()?.parentElement?.querySelector<HTMLElement>('button[aria-label^="Retirer"]'), nom: 'Retirer', quoi: 'supprime la ligne.' },
        { faire: 'expliquer', sur: avecTexte('.accueil-form button', 'Ajouter un pharmacien'), nom: 'Ajouter un pharmacien', quoi: 'ajoute une ligne au groupe.' },
        { faire: 'expliquer', sur: groupe('Préparateurs'), nom: 'Préparateurs', quoi: 'les préparateurs, sur le même modèle : prénom, nom, heures.', sert: 'Deux lignes sont prêtes. Animateurs, apprentis, étudiants et rayonnistes ont chacun leur groupe, plus bas.' },
        { faire: 'expliquer', sur: groupe('Apprentis'), nom: 'Apprentis', quoi: 'les apprentis, avec les heures passées à la pharmacie.', sert: 'Les heures d’école ne comptent pas ici.' },
        { faire: 'cliquer', sur: '.accueil-actions button[type="submit"]', dit: 'Cliquez sur « Continuer : vérification »', sert: 'Les lignes vides sont ignorées ; l’assistant passe à la vérification.' },
      ],
    },
    {
      chapitre: 'Plusieurs pharmacies et le menu',
      qui: o.HELENE,
      cible: '.accueil-form',
      titre: 'La vérification',
      texte: () => 'Dernière étape : relire l’essentiel avant de créer. Rien n’est figé, tout se modifie ensuite dans l’application.',
      jouer: () => {
        remettre();
        o.helene('nouvelle');
      },
      gestes: [
        versEtape(2),
        versEtape(2),
        versEtape(2),
        { faire: 'expliquer', sur: 'section[aria-labelledby="recap-pharmacie"]', nom: 'La pharmacie', quoi: 'le nom et les horaires, jour par jour.', sert: 'Le dimanche reste fermé, hors gardes.' },
        { faire: 'expliquer', sur: avecTexte('section[aria-labelledby="recap-pharmacie"] button', 'Modifier'), nom: 'Modifier', quoi: 'revient à l’étape de la pharmacie, sans rien perdre.' },
        { faire: 'expliquer', sur: 'section[aria-labelledby="recap-equipe"]', nom: 'L’équipe', quoi: 'les personnes saisies, avec leur fonction et leurs heures.' },
        { faire: 'expliquer', sur: 'section[aria-labelledby="recap-equipe"] .notice', nom: 'Les pharmaciens', quoi: 'le nombre de pharmaciens, titulaires compris.', sert: 'Avec un seul, chacune de ses pauses laisserait l’ouverture sans pharmacien : l’assistant le signale.' },
        { faire: 'expliquer', sur: '.accueil-actions button[type="submit"]', nom: 'Ajouter cette pharmacie', quoi: 'crée la pharmacie et son équipe, avec un compte pour chacun.', sert: 'Chaque membre reçoit un identifiant et un mot de passe provisoire, et vous passez sur la nouvelle pharmacie. Ici, on ne la crée pas.' },
        { faire: 'expliquer', sur: () => boutonAccueil('Retour'), nom: 'Retour', quoi: 'revient à l’étape précédente.', sert: 'À la première étape, « Annuler » referme l’assistant sans rien créer.' },
      ],
    },
    {
      chapitre: 'Plusieurs pharmacies et le menu',
      qui: o.HELENE,
      cible: '.topbar-in',
      titre: 'Le menu à votre nom',
      texte: () => 'En haut à droite, votre nom ouvre un menu : votre compte, vos horaires, l’apparence, l’ajout d’une pharmacie et la déconnexion.',
      jouer: () => {
        remettre();
        o.helene('tableau');
      },
      gestes: [
        { faire: 'cliquer', sur: '.compte-btn', dit: 'Cliquez sur votre nom, en haut à droite', sert: 'Le menu du compte s’ouvre.' },
        { faire: 'expliquer', sur: '.topbar-in .menu .qui', nom: 'Votre nom', quoi: 'votre nom et l’étiquette de votre rôle.' },
        { faire: 'expliquer', sur: avecTexte('.topbar-in .menu button', 'Mon compte'), nom: 'Mon compte', quoi: 'ouvre « Mon compte » : profil, compétences, apparence, mot de passe.' },
        { faire: 'expliquer', sur: avecTexte('.topbar-in .menu button', 'Mes horaires'), nom: 'Mes horaires', quoi: 'votre propre planning, tel que chaque membre de l’équipe voit le sien.' },
        { faire: 'expliquer', sur: '.topbar-in .menu-apparence', nom: 'Apparence', quoi: 'trois présentations à choisir en un geste : Clair, Mixte ou Sombre.', sert: 'Le même choix que dans « Mon compte ».' },
        { faire: 'expliquer', sur: avecTexte('.topbar-in .menu button', 'Paramètres'), nom: 'Paramètres', quoi: 'ouvre « Mon compte » directement sur l’apparence.' },
        { faire: 'expliquer', sur: avecTexte('.topbar-in .menu button', 'Ajouter une pharmacie'), nom: 'Ajouter une pharmacie', quoi: 'ouvre l’assistant de création d’une pharmacie.', sert: 'Quand vous en avez plusieurs, « Changer de pharmacie » les liste juste au-dessus.' },
        { faire: 'expliquer', sur: avecTexte('.topbar-in .menu button', 'Se déconnecter'), nom: 'Se déconnecter', quoi: 'ferme votre session.', sert: 'Solvéa rappelle d’abord ce qui reste en cours.' },
        // Le menu est refermé.
        { faire: 'action', jouer: () => (document.querySelector('.topbar-in .menu') ? document.querySelector<HTMLElement>('.compte-btn')?.click() : undefined) },
      ],
    },
  ];
}
