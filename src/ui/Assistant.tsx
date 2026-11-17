import { ArrowRight, ChevronDown, GraduationCap, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Espace } from '../domain/acces';
import { estCollaboratif } from '../engine/souhaits';
import { useStore } from '../store/store';
import type { Vue } from '../store/ui';
import { useUi } from '../store/ui';
import { Logo } from './kit';

type Ui = ReturnType<typeof useUi.getState>;

interface Fiche {
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
const FICHES: Fiche[] = [
  { id: 'prochain', question: 'Où voir mon prochain poste ?', reponse: 'Il est écrit en grand en haut de « Mon planning », avec la pause et la durée. Dessous, votre semaine jour par jour, puis le calendrier du mois.', mots: 'horaires semaine quand travaille planning perso personnel calendrier', pour: TOUS, ecrans: ['moi'], bouton: 'Ouvrir mon planning', aller: (ui) => ui.aller('moi') },
  { id: 'equipe-planning', question: 'Voir le planning de toute l’équipe', reponse: 'Le planning global montre qui travaille quand. « Mes postes » ne garde que votre ligne ; « Toute l’équipe » la remet au complet.', mots: 'global collegues qui travaille mes postes filtre', pour: TOUS, ecrans: ['moi', 'planning', 'construire'], bouton: 'Ouvrir le planning global', aller: (ui, e) => { ui.setSeulementMoi(false); ui.aller(e === 'responsable' ? 'construire' : 'planning'); } },
  { id: 'difference', question: 'Souhait, demande : quelle différence ?', reponse: 'Un souhait dit ce que vous préférez pour le mois à venir : le planning s’en inspire, personne ne vous répond. Une demande (congé, horaire à tenir, remplacement) attend une réponse du titulaire.', mots: 'souhaits demandes comprendre onglets', pour: TOUS, ecrans: ['demandes'], bouton: 'Ouvrir mes demandes', aller: (ui) => ui.aller('demandes') },
  { id: 'souhaits', question: 'Poser mes souhaits du mois', reponse: 'Choisissez une forme (matin, journée, après-midi, repos) puis cliquez les jours. « M’assister » remplit le reste d’après vos habitudes. Aucune raison n’est demandée.', mots: 'preferences mois ideal assister matin apres-midi repos', pour: TOUS, ecrans: ['demandes', 'moi'], bouton: 'Poser mes souhaits', aller: versDemandes('souhaits') },
  { id: 'conge', question: 'Poser un congé ou une contrainte d’horaires', reponse: 'Dans « Mes demandes », onglet « Absences et horaires ». Un raccourci (garde d’enfant, pratique religieuse, cours du soir) remplit les horaires ; le motif n’est jamais enregistré.', mots: 'absence vacances formation finir tot commencer tard indisponible religion enfant', pour: TOUS, ecrans: ['demandes', 'moi'], bouton: 'Faire une demande', aller: (ui) => ui.agir('demandes', 'demande') },
  { id: 'remplacer', question: 'Me faire remplacer sur un poste', reponse: 'Onglet « Remplacements » : choisissez le poste et un niveau d’urgence (prévu, urgent, urgence médicale, avec justificatif possible). Votre titulaire répond, puis un collègue volontaire reprend le poste.', mots: 'remplacement urgent medical justificatif arret malade empeche ceder echanger', pour: TOUS, ecrans: ['demandes', 'moi'], bouton: 'Demander un remplacement', aller: versDemandes('remplacements') },
  { id: 'aider', question: 'Répondre à un appel ou aider un collègue', reponse: 'L’appel apparaît en tête de « Mon planning », avec votre rang dans le tour de rôle. « Je peux » ou « Je ne peux pas » : dire non ne change pas votre rang.', mots: 'volontaire depanner tour de role appel equipe je peux', pour: TOUS, ecrans: ['moi'], bouton: 'Voir les appels', aller: (ui) => ui.aller('moi') },
  { id: 'suivi', question: 'Voir mon compteur d’heures et mon suivi', reponse: '« Mon suivi » montre vos heures en plus ou en moins, ce qui a été noté sur douze mois et votre part des contraintes. Vous ne voyez que votre position.', mots: 'heures supplementaires compteur retards equite samedis', pour: TOUS, ecrans: ['suivi'], bouton: 'Ouvrir mon suivi', aller: (ui) => ui.aller('suivi') },
  { id: 'gardes-moi', question: 'Voir mes gardes', reponse: '« Mes gardes » liste vos gardes et astreintes, le repos qui suit et ce qui partira en paie.', mots: 'garde astreinte nuit dimanche repos', pour: ['pharmacien'], ecrans: ['mesgardes'], bouton: 'Ouvrir mes gardes', aller: (ui) => ui.aller('mesgardes') },
  { id: 'message', question: 'Écrire à l’équipe ou à une personne', reponse: 'Un fil pour toute l’équipe et des conversations privées. Pour une absence, préférez une demande : elle est suivie.', mots: 'messages messagerie contacter prevenir', pour: TOUS, ecrans: ['messages'], bouton: 'Ouvrir les messages', aller: (ui) => ui.aller('messages') },
  { id: 'compte', question: 'Changer la couleur, le mode sombre ou mon mot de passe', reponse: 'Dans « Mon compte » : dix couleurs, mode clair ou sombre, taille du texte, mot de passe.', mots: 'theme apparence sombre nuit taille texte code', pour: TOUS, ecrans: ['compte'], bouton: 'Ouvrir mon compte', aller: (ui) => ui.aller('compte') },

  { id: 'construire', question: 'Construire le planning d’une semaine', reponse: 'Dans « Construire », un « + » pose un poste à la main. « Proposer un planning » calcule trois propositions comparables : équité, souhaits, coût. Les règles impératives passent toujours d’abord.', mots: 'creer planning grille poste generer proposition automatique', pour: GESTION, ecrans: ['construire', 'tableau'], bouton: 'Ouvrir « Construire »', aller: (ui) => { ui.setPlanVue('semaine'); ui.aller('construire'); } },
  { id: 'publier', question: 'Publier un planning', reponse: 'Tant qu’il est en brouillon, vous seul le voyez. « Publier » relit les règles et les délais, puis l’envoie à l’équipe. Tout changement ultérieur est annoncé à la personne concernée.', mots: 'envoyer diffuser brouillon equipe voit', pour: GESTION, ecrans: ['construire'], bouton: 'Aller publier', aller: (ui) => { ui.setPlanVue('semaine'); ui.aller('construire'); } },
  { id: 'mois', question: 'Voir le mois entier et suivre les souhaits', reponse: 'Dans « Construire », passez sur « Mois » : objectif d’équipe par jour, heures de chacun face à son contrat, souhaits posés. « Corriger automatiquement » recalcule les semaines en brouillon.', mots: 'mensuel objectif equipe heures contrat corriger', pour: GESTION, ecrans: ['construire'], bouton: 'Ouvrir la vue mois', aller: (ui) => { ui.setPlanVue('mois'); ui.aller('construire'); } },
  { id: 'absence', question: 'Couvrir une absence imprévue', reponse: 'Dans « Résoudre », onglet « Absences ». « Demander à toute l’équipe » prévient en même temps tous ceux qui peuvent tenir le poste ; entre volontaires, il revient à celui qui a le moins dépanné. Sinon, comparez les options proposées.', mots: 'arret maladie malade absent absente trou manque personnel appel tour role injustice urgence couvrir', pour: GESTION, ecrans: ['resoudre', 'tableau'], bouton: 'Voir les absences', aller: versResoudre('absences') },
  { id: 'demande-remplacement', question: 'Répondre à une demande de remplacement', reponse: 'Les demandes sont triées par urgence : médicale, urgente, prévue. Vous répondez oui ou non ; si oui, l’équipe est prévenue, puis vous validez le volontaire. Les heures en plus sont annoncées.', mots: 'remplacement urgence accepter refuser volontaire valider justificatif', pour: GESTION, ecrans: ['resoudre', 'tableau'], bouton: 'Voir les remplacements', aller: versResoudre('remplacements') },
  { id: 'demandes-equipe', question: 'Répondre à un congé ou à une demande d’horaires', reponse: 'Onglet « Demandes » de « Résoudre ». Avant de répondre, vous voyez ce que l’absence découvre. Pour un horaire, vous choisissez son poids : reconnue, prioritaire ou simple préférence.', mots: 'approuver refuser conge vacances besoin contrainte', pour: GESTION, ecrans: ['resoudre'], bouton: 'Voir les demandes', aller: versResoudre('demandes') },
  { id: 'gardes', question: 'Ajouter ou répartir les gardes', reponse: 'Dans « Gardes » : ajoutez une garde, confiez-la et prévenez le pharmacien dans la foulée. « Répartir » propose un partage équitable. Le délai de 15 jours et le repos qui suit sont contrôlés.', mots: 'garde astreinte nuit dimanche affecter repartir', pour: GESTION, ecrans: ['gardes'], bouton: 'Ajouter une garde', aller: (ui) => ui.agir('gardes', 'garde') },
  { id: 'formation', question: 'Planifier une formation ou un inventaire', reponse: 'Depuis « Créer », en haut de l’écran : intitulé, dates, participants. Chacun est prévenu et son planning est mis à jour.', mots: 'formation inventaire stage participants', pour: GESTION, ecrans: ['equipe', 'construire'], bouton: 'Planifier une formation', aller: (ui) => ui.agir('equipe', 'formation') },
  { id: 'personne', question: 'Ajouter une personne ou changer son poste', reponse: 'Dans « Équipe » : titulaire, adjoint, préparateur, animateur, apprenti, étudiant, rayonniste. Chaque poste a sa couleur. La fiche porte le contrat, les compétences et le compte de connexion.', mots: 'embauche nouveau salarie animateur preparateur fiche competences diplome', pour: GESTION, ecrans: ['equipe'], bouton: 'Ajouter une personne', aller: (ui) => ui.agir('equipe', 'personne') },
  { id: 'mdp-equipe', question: 'Donner un mot de passe à un membre de l’équipe', reponse: 'Ouvrez sa fiche dans « Équipe », carte « Compte de connexion » : un mot de passe provisoire à lui transmettre, qu’il changera ensuite.', mots: 'mot de passe oublie identifiant connexion provisoire', pour: GESTION, ecrans: ['equipe'], bouton: 'Ouvrir l’équipe', aller: (ui) => ui.aller('equipe') },
  { id: 'heures', question: 'Régulariser les heures en plus ou en moins', reponse: '« Heures » compare ce qui a été publié au contrat de chacun. Payer, faire récupérer, faire rattraper ; ou « Régulariser automatiquement », qui résorbe les écarts sur la prochaine semaine à construire.', mots: 'heures supplementaires compteur recuperation payer solde', pour: GESTION, ecrans: ['heures', 'tableau'], bouton: 'Ouvrir les heures', aller: (ui) => ui.aller('heures') },
  { id: 'retard', question: 'Noter un retard ou régler une pause', reponse: 'Cliquez sur un jour, dans « Construire » ou sur le tableau de bord : la journée s’ouvre avec toute l’équipe. On y règle les pauses et on y note un retard en deux clics.', mots: 'retard depart anticipe pause dejeuner journee', pour: GESTION, ecrans: ['tableau', 'construire'], bouton: 'Ouvrir la journée', aller: (ui) => ui.voirJour(useStore.getState().today) },
  { id: 'reglages', question: 'Changer les horaires d’ouverture ou l’effectif attendu', reponse: 'Dans « Réglages » : horaires jour par jour, effectif minimal au comptoir, postes types, et le choix entre planning collaboratif et classique.', mots: 'ouverture fermeture seuil comptoir collaboratif classique modele', pour: GESTION, ecrans: ['officine'], bouton: 'Ouvrir les réglages', aller: (ui) => ui.aller('officine') },
  { id: 'regles', question: 'Voir ou régler les règles appliquées', reponse: 'Chaque contrôle vient d’une fiche, avec sa source. Vous réglez aussi vos seuils : plafond d’heures par semaine, samedis libres par mois, délai des remplacements.', mots: 'loi code du travail repos pause plafond samedis delai', pour: GESTION, ecrans: ['regles'], bouton: 'Ouvrir les règles', aller: (ui) => ui.aller('regles') },
  { id: 'paie', question: 'Préparer la paie du mois', reponse: '« Journal et paie » trace chaque décision et prépare la fiche navette : heures et variables du mois, à exporter pour le comptable.', mots: 'export navette comptable journal historique', pour: GESTION, ecrans: ['journal'], bouton: 'Ouvrir le journal', aller: (ui) => ui.aller('journal') },
  { id: 'equite', question: 'Vérifier que la charge est bien répartie', reponse: '« Équité » compare samedis, fermetures, gardes et dépannages à la part attendue de chacun, au prorata de son contrat.', mots: 'equite injustice samedis fermetures repartition charge', pour: GESTION, ecrans: ['equite'], bouton: 'Ouvrir l’équité', aller: (ui) => ui.aller('equite') },
  { id: 'accord', question: 'Donner mon accord à un autre titulaire', reponse: 'Les décisions d’un titulaire secondaire attendent l’accord du titulaire principal, dans « Résoudre », onglet « Accords à donner ».', mots: 'titulaire secondaire associe validation accord', pour: GESTION, ecrans: ['resoudre'], bouton: 'Voir les accords', aller: versResoudre('accords') },
  { id: 'pharmacie', question: 'Ajouter une autre pharmacie', reponse: 'Le titulaire principal ajoute autant de pharmacies qu’il veut. Le sélecteur, en haut du menu, passe de l’une à l’autre.', mots: 'plusieurs officines seconde pharmacie multi', pour: GESTION, bouton: 'Ajouter une pharmacie', aller: (ui) => ui.aller('nouvelle') },
];

const simple = (t: string): string => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, ' ');
const VIDES = new Set(['est', 'une', 'des', 'les', 'pour', 'que', 'qui', 'quoi', 'mon', 'mes', 'ma', 'sur', 'dans', 'avec', 'quelqu', 'comment', 'faire', 'veux', 'voudrais', 'peux', 'dois', 'faut', 'suis', 'sont', 'ont', 'demain', 'aujourd', 'hui', 'cette', 'ces', 'son', 'ses', 'pas', 'plus', 'tout', 'tous', 'ou', 'et', 'la', 'le', 'un', 'je', 'il', 'elle', 'on', 'du', 'de', 'au', 'aux', 'en', 'ne', 'se', 'ce', 'voir']);
const mots = (t: string): string[] => simple(t).split(/[^a-z0-9]+/).filter((m) => m.length >= 3 && !VIDES.has(m));
/** Deux mots se répondent s'ils partagent leur début : « remplacer » trouve « remplacement ». */
const proche = (a: string, b: string): boolean => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b.slice(0, Math.max(4, b.length - 3))) || b.startsWith(a.slice(0, Math.max(4, a.length - 3)))));

/** Les fiches qui répondent à une question tapée : un mot du titre compte triple, un mot-clé double. */
function chercher(fiches: Fiche[], question: string): Fiche[] {
  const demandes = mots(question);
  if (!demandes.length) return [];
  return fiches
    .map((f) => {
      const titre = mots(f.question);
      const cles = mots(f.mots);
      const texte = mots(f.reponse);
      const score = demandes.reduce((t, m) => t + (titre.some((x) => proche(x, m)) ? 3 : cles.some((x) => proche(x, m)) ? 2 : texte.some((x) => proche(x, m)) ? 1 : 0), 0);
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.f.pour.length - b.f.pour.length)
    .slice(0, 5)
    .map((x) => x.f);
}

/** Assistant d'aide : un bouton au logo de Solvéa, des réponses choisies selon le rôle et l'écran, et le chemin pour y aller. */
export function Assistant({ espace, prenom }: { espace: Espace; prenom: string }): JSX.Element | null {
  const ui = useUi();
  const { assistant, ouvrirAssistant, vue, parcours, tour, assistantEnVisite } = ui;
  const collaboratif = estCollaboratif(useStore((s) => s.data.officine));
  const [question, setQuestion] = useState('');
  const [ouverte, setOuverte] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);

  const fiches = useMemo(() => FICHES.filter((f) => f.pour.includes(espace) && (collaboratif || (f.id !== 'souhaits' && f.id !== 'difference'))), [espace, collaboratif]);
  const resultats = useMemo(() => chercher(fiches, question), [fiches, question]);
  const ici = useMemo(() => fiches.filter((f) => f.ecrans?.includes(vue)).slice(0, 4), [fiches, vue]);
  const liste = question.trim() ? resultats : ici.length ? ici : fiches.slice(0, 4);

  useEffect(() => {
    if (!assistant) return;
    champ.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        ouvrirAssistant(false);
        bouton.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [assistant, ouvrirAssistant]);
  useEffect(() => setOuverte(null), [question, vue]);

  // Pendant un tutoriel, la place est à la visite : l'assistant reste disponible s'il est ouvert par elle.
  if (tour !== null || (parcours !== null && !assistant && !assistantEnVisite)) return null;
  return (
    <div className="aide no-print">
      {assistant ? (
        <section className="aide-panneau" role="dialog" aria-label="Assistant Solvéa">
          <div className="aide-tete">
            <span className="aide-logo" aria-hidden="true">
              <Logo size={30} />
            </span>
            <div className="grow">
              <h2>Assistant Solvéa</h2>
              <p>Bonjour {prenom}. Que voulez-vous faire ?</p>
            </div>
            <button type="button" className="dialog-fermer" onClick={() => ouvrirAssistant(false)} aria-label="Fermer l’assistant">
              <X size={18} />
            </button>
          </div>
          <div className="aide-corps">
            <label className="aide-champ" htmlFor="aide-question">
              <Search size={17} aria-hidden="true" />
              <span className="sr">Votre question</span>
              <input ref={champ} id="aide-question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Par exemple : me faire remplacer" autoComplete="off" />
            </label>
            <h3 className="aide-titre">{question.trim() ? (resultats.length ? 'Ce que j’ai trouvé' : 'Je n’ai rien trouvé') : ici.length ? 'Sur cet écran' : 'Pour commencer'}</h3>
            {question.trim() && !resultats.length ? <p className="small soft">Essayez avec d’autres mots : congé, garde, publier, heures, remplacement…</p> : null}
            <ul className="aide-liste" aria-live="polite">
              {liste.map((f) => (
                <li key={f.id} className={ouverte === f.id ? 'on' : ''}>
                  <button type="button" className="aide-question" aria-expanded={ouverte === f.id} onClick={() => setOuverte(ouverte === f.id ? null : f.id)}>
                    <span className="grow">{f.question}</span>
                    <ChevronDown size={16} className="chev" aria-hidden="true" />
                  </button>
                  {ouverte === f.id ? (
                    <div className="aide-reponse">
                      <p>{f.reponse}</p>
                      <button
                        type="button"
                        className="btn primary sm"
                        onClick={() => {
                          f.aller(useUi.getState(), espace);
                          ouvrirAssistant(false);
                        }}
                      >
                        {f.bouton} <ArrowRight size={15} aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          <div className="aide-pied">
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                ouvrirAssistant(false);
                ui.ouvrirTutoriels(true);
              }}
            >
              <GraduationCap size={15} aria-hidden="true" /> Visites guidées
            </button>
            <span className="tiny muted">Aide intégrée : rien n’est envoyé hors de cet appareil.</span>
          </div>
        </section>
      ) : null}
      {(
        <button ref={bouton} type="button" className={`aide-fab${assistant ? ' on' : ''}`} onClick={() => ouvrirAssistant(!assistant)} aria-expanded={assistant} data-focus="assistant" title="Assistant Solvéa">
          <Logo size={30} />
          <span className="aide-mot">Aide</span>
          <span className="sr">, assistant Solvéa</span>
        </button>
      )}
    </div>
  );
}
