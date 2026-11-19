import { AlarmClock, ArrowLeftRight, Bell, BookOpenCheck, Building2, CalendarClock, CalendarDays, CalendarRange, CheckCheck, ChevronDown, ChevronRight, CircleHelp, ClipboardCheck, Crown, FolderOpen, Gauge, GraduationCap, Hourglass, House, Inbox, LayoutDashboard, LifeBuoy, Lightbulb, ListChecks, LogOut, Medal, Menu, MessageSquare, Moon, MoonStar, Plus, Scale, ScrollText, Settings, Settings2, Store, Sun, TrendingUp, UserRound, Users, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Espace } from './domain/acces';
import { espaceDe, estResponsable, estSecondaire, memeIdentifiant, responsable } from './domain/acces';
import { fmtDateCourt, fmtHeure } from './domain/time';
import { nomComplet, nomCourt, QUALIFICATION_COURT } from './domain/types';
import { Documents } from './ui/views/Documents';
import { ListeAnnonces, annoncesDe } from './ui/components/Annonces';
import { DialogueDeconnexion } from './ui/components/Deconnexion';
import { decisions } from './engine/decisions';
import { useStore } from './store/store';
import type { Vue } from './store/ui';
import { ApercuImpression } from './ui/components/Impression';
import { DialogueSignaler } from './ui/components/Signaler';
import { prefsDe, themeDuProfil, useUi } from './store/ui';
import { EtiquetteRole, couleurDe, iconeDe } from './ui/icons';
import { Avatar, Logo, LogoNom } from './ui/kit';
import { DialogueJour } from './ui/components/Jour';
import { ChoixParcours, MenuTest, Parcours } from './ui/Parcours';
import { Tour } from './ui/Tour';
import { Accueil } from './ui/views/Accueil';
import { Compte } from './ui/views/Compte';
import { Connexion } from './ui/views/Connexion';
import { Construire } from './ui/views/Construire';
import { Equipe } from './ui/views/Equipe';
import { Equite } from './ui/views/Equite';
import { Gardes } from './ui/views/Gardes';
import { Journal } from './ui/views/Journal';
import { MesGardes } from './ui/views/MesGardes';
import { Messages } from './ui/views/Messages';
import { MonPlanning } from './ui/views/MonPlanning';
import { Aide } from './ui/views/Aide';
import { Officine } from './ui/views/Officine';
import { MesDemandes, MonSuivi } from './ui/views/MonEspace';
import { PlanningEquipe } from './ui/views/PlanningEquipe';
import { Heures } from './ui/views/Heures';
import { Assistant } from './ui/Assistant';
import { appliquerApparence } from './ui/components/Apparence';
import { PiedSupport } from './ui/components/Support';
import { aRegulariser } from './engine/heures';
import { autreDuRdv, rdvARepondre } from './engine/rdv';
import { URGENCE_LABEL } from './domain/types';
import { Regles } from './ui/views/Regles';
import { Resoudre } from './ui/views/Resoudre';
import { Tableau } from './ui/views/Tableau';
import { Espace as MonAccueil } from './ui/views/Espace';

interface Lien {
  vue: Vue;
  label: string;
  question: string;
  icon: JSX.Element;
  couleur: string;
  groupe: string;
}

const MOI: Lien = { vue: 'moi', label: 'Mon planning', question: 'Mes horaires', icon: <CalendarDays size={18} />, couleur: 'c-clair', groupe: 'Mon espace' };
const DEMANDES: Lien = { vue: 'demandes', label: 'Mes demandes', question: 'Préférences, absences, remplacements', icon: <Inbox size={18} />, couleur: 'c-clair', groupe: 'Mon espace' };
const SUIVI: Lien = { vue: 'suivi', label: 'Mon suivi', question: 'Compteurs et équité', icon: <Gauge size={18} />, couleur: 'c-clair', groupe: 'Mon espace' };
const DOCUMENTS: Lien = { vue: 'documents', label: 'Mes documents', question: 'Plannings, absences, fichiers', icon: <FolderOpen size={18} />, couleur: 'c-clair', groupe: 'Mon espace' };
const ACCUEIL: Lien = { vue: 'espace', label: 'Accueil', question: 'Mon métier, mes rendez-vous', icon: <House size={18} />, couleur: 'c-clair', groupe: 'Mon espace' };
const PERSO: Lien[] = [MOI, DEMANDES, SUIVI, DOCUMENTS];
const AIDE: Lien = { vue: 'aide', label: 'Aide et tutoriels', question: 'Comment faire, lexique', icon: <LifeBuoy size={18} />, couleur: 'c-clair', groupe: 'Besoin d’aide ?' };
const MESSAGES: Lien = { vue: 'messages', label: 'Messages', question: 'Équipe et privé', icon: <MessageSquare size={18} />, couleur: 'c-clair', groupe: 'Au quotidien' };
// Le titulaire suit son équipe : son menu suit l'ordre du travail. On prépare, on planifie, on suit, on fait le bilan.
const GESTION: Lien[] = [
  { vue: 'tableau', label: 'Tableau de bord', question: 'Vue d’ensemble', icon: <LayoutDashboard size={18} />, couleur: 'c-clair', groupe: '' },
  { vue: 'equipe', label: 'Équipe', question: 'Fiches et accès', icon: <Users size={18} />, couleur: 'c-clair', groupe: 'Préparer' },
  { vue: 'officine', label: 'Réglages', question: 'Horaires, seuils', icon: <Settings2 size={18} />, couleur: 'c-clair', groupe: 'Préparer' },
  { vue: 'regles', label: 'Règles', question: 'Textes appliqués', icon: <BookOpenCheck size={18} />, couleur: 'c-clair', groupe: 'Préparer' },
  { vue: 'construire', label: 'Construire', question: 'La semaine', icon: <CalendarRange size={18} />, couleur: 'c-clair', groupe: 'Planifier' },
  { vue: 'gardes', label: 'Gardes', question: 'Tours de garde', icon: <MoonStar size={18} />, couleur: 'c-clair', groupe: 'Planifier' },
  { vue: 'resoudre', label: 'Résoudre', question: 'À décider', icon: <ListChecks size={18} />, couleur: 'c-clair', groupe: 'Suivre' },
  { ...MESSAGES, groupe: 'Suivre' },
  { vue: 'heures', label: 'Heures', question: 'Compteurs à régulariser', icon: <Hourglass size={18} />, couleur: 'c-clair', groupe: 'Suivre' },
  { vue: 'equite', label: 'Équité', question: 'Qui a porté quoi', icon: <Scale size={18} />, couleur: 'c-clair', groupe: 'Bilan' },
  { vue: 'journal', label: 'Journal et paie', question: 'Historique, export', icon: <ScrollText size={18} />, couleur: 'c-clair', groupe: 'Bilan' },
  { ...DOCUMENTS, label: 'Documents', groupe: 'Bilan' },
  AIDE,
];
const PLANNING: Lien = { vue: 'planning', label: 'Planning de l’équipe', question: 'La version publiée', icon: <CalendarRange size={18} />, couleur: 'c-clair', groupe: 'L’équipe' };
const MESGARDES: Lien = { vue: 'mesgardes', label: 'Mes gardes', question: 'Gardes et astreintes', icon: <MoonStar size={18} />, couleur: 'c-clair', groupe: 'Mon espace' };

/** Chaque rôle a sa propre navigation ; « Mon planning » est toujours en tête. Le compte est en haut à droite. */
/** Les rubriques de la barre du bas, sur téléphone : quatre au plus par espace, avec un nom court. */
const RAPIDES: Record<Espace, { vue: Vue; court: string }[]> = {
  responsable: [
    { vue: 'tableau', court: 'Accueil' },
    { vue: 'construire', court: 'Planning' },
    { vue: 'resoudre', court: 'À décider' },
    { vue: 'messages', court: 'Messages' },
  ],
  pharmacien: [
    { vue: 'espace', court: 'Accueil' },
    { vue: 'moi', court: 'Planning' },
    { vue: 'demandes', court: 'Demandes' },
    { vue: 'messages', court: 'Messages' },
  ],
  equipe: [
    { vue: 'espace', court: 'Accueil' },
    { vue: 'moi', court: 'Planning' },
    { vue: 'demandes', court: 'Demandes' },
    { vue: 'messages', court: 'Messages' },
  ],
};

const NAV: Record<Espace, Lien[]> = {
  // Un titulaire a lui aussi un planning : « Mon planning » suit le tableau de bord.
  responsable: [GESTION[0], { ...MOI, groupe: GESTION[0].groupe, question: 'Mes horaires et mes rendez-vous' }, ...GESTION.slice(1)],
  pharmacien: [ACCUEIL, ...PERSO, MESGARDES, PLANNING, { ...MESSAGES, groupe: 'L’équipe' }, AIDE],
  equipe: [ACCUEIL, ...PERSO, PLANNING, { ...MESSAGES, groupe: 'L’équipe' }, AIDE],
};
// Le titulaire garde ses propres horaires à portée, depuis le menu du compte.
const HORS_MENU: Vue[] = ['compte', 'nouvelle', 'moi', 'demandes'];

export function App(): JSX.Element {
  const { data, autres, officineId, changerOfficine } = useStore();
  const today = useStore((s) => s.today);
  const sauvegarde = useStore((s) => s.derniereSauvegarde);
  const undo = useStore((s) => s.undo);
  const { vue, aller, agir, setSujet, viserDemande, session, deconnecter, preferences, toast, taire, parcours, jour, voirJour, dire, setPreferences } = useUi();
  const [menu, setMenu] = useState(false);
  /** La déconnexion passe par un point d'étape : ce qui reste en cours est rappelé avant de partir. */
  const [quitter, setQuitter] = useState(false);
  // Une fenêtre de saisie ouverte : le navigateur demande confirmation avant de fermer l'onglet.
  useEffect(() => {
    const garder = (e: BeforeUnloadEvent): void => {
      if (document.querySelector('.dialog')) e.preventDefault();
    };
    window.addEventListener('beforeunload', garder);
    return () => window.removeEventListener('beforeunload', garder);
  }, []);
  // Sans session, l'application s'ouvre sur la connexion ; la création d'une pharmacie se lance depuis là.
  const [creation, setCreation] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const outilsRef = useRef<HTMLDivElement>(null);
  const [panneau, setPanneau] = useState<'creer' | 'alertes' | null>(null);
  const [menuTest, setMenuTest] = useState(false);
  const fermerMenuTest = useCallback(() => setMenuTest(false), []);
  // Le haut de la page se détache en douceur dès que le contenu défile dessous.
  const [defile, setDefile] = useState(false);
  useEffect(() => {
    const el = document.getElementById('contenu');
    if (!el) return;
    const suivre = (): void => setDefile(el.scrollTop > 6);
    suivre();
    el.addEventListener('scroll', suivre, { passive: true });
    return () => el.removeEventListener('scroll', suivre);
  }, [vue, session]);
  /** Sur téléphone, toutes les rubriques s'ouvrent dans un volet ; la barre du bas garde les quatre plus utiles. */
  const [volet, setVolet] = useState(false);
  /** Signaler un retard ou une absence : à portée depuis tous les écrans. */
  const [signaler, setSignaler] = useState(false);
  // Changer d'écran ramène en haut : on n'arrive pas au milieu d'une page parce que la précédente était déroulée.
  useEffect(() => {
    document.getElementById('contenu')?.scrollTo({ top: 0 });
  }, [vue]);
  const signalement = useUi((s) => s.signalement);
  const impression = useUi((s) => s.impression);
  const moi = data.personnes.find((p) => !p.externe && memeIdentifiant(p.identifiant, session ?? ''));
  const espace = espaceDe(data, moi);
  // Sans collecte des préférences (modèle classique), l'entrée disparaît du menu.
  const liens = NAV[espace];
  const vueActive = liens.some((l) => l.vue === vue) || HORS_MENU.includes(vue) ? vue : espace === 'responsable' ? 'tableau' : 'espace';
  const aLire = moi ? data.notifications.filter((n) => n.personId === moi.id && !n.luLe).length : 0;
  const nonLus = moi ? data.messages.filter((m) => !m.luPar.includes(moi.id) && (m.a === 'equipe' || m.a === moi.id)).length : 0;
  // Les pharmacies de l'appareil où la personne connectée a un compte.
  const mesPharmacies = [{ id: officineId, nom: data.officine.nom }, ...Object.entries(autres).filter(([, d]) => d.personnes.some((p) => memeIdentifiant(p.identifiant, session ?? ''))).map(([id, d]) => ({ id, nom: d.officine.nom }))];
  const secondaire = estSecondaire(data, moi);
  const chef = responsable(data);
  // Un titulaire secondaire ne compte pas ses propres propositions parmi ce qu'il doit décider.
  const aDecider = useMemo(() => (espace === 'responsable' ? decisions(data, today).total - (secondaire ? (data.accords ?? []).length : 0) : 0), [data, today, espace, secondaire]);
  const setActeur = useStore((s) => s.setActeur);
  useEffect(() => {
    setActeur(moi?.id ?? null);
  }, [moi?.id, setActeur]);
  // Une décision d'un titulaire secondaire part en attente : on le lui dit, à la place du message habituel.
  const nbAccords = (data.accords ?? []).filter((a) => a.auteur === moi?.id).length;
  const avantAccords = useRef(nbAccords);
  useEffect(() => {
    if (secondaire && nbAccords > avantAccords.current) {
      const t = window.setTimeout(() => dire(`Envoyé à ${chef?.prenom ?? 'la titulaire principale'} pour accord. Rien n’est appliqué avant.`), 40);
      avantAccords.current = nbAccords;
      return () => window.clearTimeout(t);
    }
    avantAccords.current = nbAccords;
    return undefined;
  }, [nbAccords, secondaire, chef?.prenom, dire]);
  // Ce qui attend la personne connectée, rassemblé sous la cloche de la barre du haut.
  const aAider = moi ? data.remplacements.filter((r) => r.statut === 'ouverte' && r.date >= today && r.demandeur !== moi.id && r.accord !== 'attente' && !r.volontaires.includes(moi.id) && (!r.trouId || ((r.sollicites ?? []).includes(moi.id) && !(r.indisponibles ?? []).includes(moi.id)))).length : 0;
  // Chaque demande de remplacement a sa ligne : un clic mène droit à elle, la plus urgente en tête.
  const demandes = useMemo(() => (espace === 'responsable' ? decisions(data, today).remplacements : []), [data, today, espace]);
  const compteurs = useMemo(() => (espace === 'responsable' ? aRegulariser(data, today) : []), [data, today, espace]);
  // Les heures en plus sont signalées à part : l'objectif est d'en avoir le moins possible.
  const heuresEnPlus = compteurs.filter((x) => x.solde > 0).length;
  const heuresARegler = compteurs.length - heuresEnPlus;
  // Les décisions prises depuis ma dernière visite, avec ce qu'elles changent dans les plannings.
  const rdvAttente = moi ? rdvARepondre(data, moi.id, today) : [];
  const viserFil = useUi((s) => s.viserFil);
  const annonces = annoncesDe(data, moi?.id, true);
  const lireAnnonces = useStore((s) => s.lireAnnonces);
  const IconeRole = secondaire ? Medal : estResponsable(data, moi) ? Crown : iconeDe(moi);
  const alertes: { cle: string; vue: Vue; texte: string; nombre: number; icone: JSX.Element; avant?: () => void }[] = [
    ...demandes.map((r) => {
      const p = data.personnes.find((x) => x.id === r.demandeur);
      const etat = r.accord === 'attente' ? 'demande un remplacement' : r.volontaires.length ? 'a un volontaire à confirmer' : 'attend un volontaire';
      return {
        cle: r.id,
        vue: 'resoudre' as Vue,
        texte: `${URGENCE_LABEL[r.urgence ?? 'prevu']} · ${p ? nomCourt(p) : 'Un collègue'} ${etat}`,
        nombre: 1,
        icone: <ArrowLeftRight size={17} aria-hidden="true" />,
        avant: () => {
          setSujet('remplacements');
          viserDemande(r.id);
        },
      };
    }),
    ...(aDecider - demandes.length > 0 ? [{ cle: 'decisions', vue: 'resoudre' as Vue, texte: `Autre${aDecider - demandes.length > 1 ? 's' : ''} décision${aDecider - demandes.length > 1 ? 's' : ''} à prendre`, nombre: aDecider - demandes.length, icone: <ListChecks size={17} aria-hidden="true" /> }] : []),
    ...(heuresEnPlus ? [{ cle: 'heures-plus', vue: 'heures' as Vue, texte: `Personne${heuresEnPlus > 1 ? 's' : ''} en heures supplémentaires`, nombre: heuresEnPlus, icone: <TrendingUp size={17} aria-hidden="true" /> }] : []),
    ...(heuresARegler ? [{ cle: 'heures', vue: 'heures' as Vue, texte: `Compteur${heuresARegler > 1 ? 's' : ''} d’heures en dessous du contrat`, nombre: heuresARegler, icone: <Hourglass size={17} aria-hidden="true" /> }] : []),
    ...(rdvAttente.length ? [{ cle: 'rdv', vue: 'messages' as Vue, texte: `Demande${rdvAttente.length > 1 ? 's' : ''} de rendez-vous à laquelle répondre`, nombre: rdvAttente.length, icone: <CalendarClock size={17} aria-hidden="true" />, avant: () => viserFil(autreDuRdv(rdvAttente[0], moi?.id ?? '')) }] : []),
    ...(aLire ? [{ cle: 'lire', vue: 'moi' as Vue, texte: `Changement${aLire > 1 ? 's' : ''} de mon planning à lire`, nombre: aLire, icone: <CalendarDays size={17} aria-hidden="true" /> }] : []),
    ...(espace !== 'responsable' && aAider ? [{ cle: 'aider', vue: 'moi' as Vue, texte: 'Collègue qui cherche un remplaçant', nombre: aAider, icone: <Users size={17} aria-hidden="true" /> }] : []),
  ];
  // Tant que ni le nom ni l'équipe ne sont saisis, l'application s'ouvre sur l'écran de création.
  const aCreer = !data.officine.nom.trim() && !data.personnes.length;
  // Sans choix de sa part, chacun voit Solvéa dans la couleur de son profil.
  const prefs = prefsDe(preferences, session, themeDuProfil(data, moi));
  const sombre = prefs.mode === 'sombre' || (prefs.mode === 'auto' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    if (!toast) return;
    // Un message qui propose d'aller voir reste un peu plus longtemps.
    const t = window.setTimeout(taire, toast.suite ? 9000 : 5200);
    return () => window.clearTimeout(t);
  }, [toast, taire]);

  // Thème et taille du texte de la personne connectée ; réglages par défaut hors connexion.
  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    document.documentElement.dataset.texte = prefs.texte;
  }, [prefs.theme, prefs.texte]);
  // Mode clair ou sombre ; « auto » suit le réglage de l'appareil, et son changement en direct.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const appliquer = (): void => appliquerApparence(prefs.mode, media.matches);
    appliquer();
    media.addEventListener('change', appliquer);
    return () => media.removeEventListener('change', appliquer);
  }, [prefs.mode]);

  // Le titre de la page suit l'écran affiché : il est annoncé à chaque changement de vue.
  const titrePage = !moi ? (creation ? 'Créer mon officine' : 'Connexion') : vueActive === 'compte' ? 'Mon compte' : vueActive === 'nouvelle' ? 'Ajouter une pharmacie' : (liens.find((l) => l.vue === vueActive)?.label ?? 'Relève');
  useEffect(() => {
    document.title = `${titrePage} · Solvéa`;
  }, [titrePage]);

  // Une fois connecté, l'écran de création est refermé : la déconnexion ramène à la connexion.
  useEffect(() => {
    if (moi) setCreation(false);
  }, [moi]);

  useEffect(() => {
    if (!menu && !panneau) return;
    const fermer = (e: MouseEvent | KeyboardEvent): void => {
      const dehors = (r: HTMLDivElement | null): boolean => !r?.contains(e.target as Node);
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : dehors(menuRef.current) && dehors(outilsRef.current)) {
        setMenu(false);
        setPanneau(null);
      } else if (!(e instanceof KeyboardEvent)) {
        // Un clic dans l'un des deux groupes referme l'autre.
        if (!dehors(menuRef.current)) setPanneau(null);
        else setMenu(false);
      }
    };
    document.addEventListener('mousedown', fermer);
    document.addEventListener('keydown', fermer);
    return () => {
      document.removeEventListener('mousedown', fermer);
      document.removeEventListener('keydown', fermer);
    };
  }, [menu, panneau]);

  if (!moi) return creation ? <Accueil garder={!aCreer} onAnnuler={() => setCreation(false)} /> : <Connexion onCreer={() => setCreation(true)} />;
  if (vueActive === 'nouvelle' && estResponsable(data, moi)) {
    return (
      <>
        <Accueil ajout={moi} onAnnuler={() => aller('tableau')} />
        <Parcours />
      </>
    );
  }

  const heure = new Date(sauvegarde);
  const groupes = [...new Set(liens.map((l) => l.groupe))];
  // Les rubriques du titulaire se suivent dans l'ordre du travail : on prépare, on planifie, on suit, on fait le bilan.
  const ordre = espace === 'responsable' ? ['Préparer', 'Planifier', 'Suivre', 'Bilan'].filter((g) => groupes.includes(g)) : [];

  return (
    <div className={`app${parcours !== null && data.demo ? ' en-parcours' : ''}`}>
      <a className="skip" href="#contenu">
        Aller au contenu
      </a>
      {volet ? <div className="side-voile no-print" onClick={() => setVolet(false)} aria-hidden="true" /> : null}
      <nav className={`side${volet ? ' ouvert' : ''}`} id="menu-rubriques" aria-label="Navigation principale" onKeyDown={(e) => e.key === 'Escape' && setVolet(false)}>
        <div className="side-tete">
          <b>Toutes les rubriques</b>
          <button type="button" className="btn ghost icon" onClick={() => setVolet(false)} aria-label="Fermer le menu">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="brand">
          <span className="brand-mark">
            <Logo />
          </span>
          <div className="brand-name">
            <LogoNom />
          </div>
        </div>
        {mesPharmacies.length > 1 || estResponsable(data, moi) ? (
          <div className="officine-sel">
            <label className="nav-label" htmlFor="officine-choix" style={{ padding: '0 4px' }}>
              Pharmacie
            </label>
            <select
              id="officine-choix"
              value={officineId}
              onChange={(e) => {
                if (e.target.value === '+') aller('nouvelle');
                else changerOfficine(e.target.value);
              }}
            >
              {mesPharmacies.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nom}
                </option>
              ))}
              {estResponsable(data, moi) ? <option value="+">＋ Ajouter une pharmacie…</option> : null}
            </select>
          </div>
        ) : null}
        {groupes.filter((g) => g !== AIDE.groupe).map((g) => (
          <div key={g || 'tete'} className={`nav-groupe${ordre.includes(g) ? ` ordre${ordre.indexOf(g) === ordre.length - 1 ? ' fin' : ''}` : ''}`}>
            {g ? (
              <div className="nav-label">
                {/* Pas de numéro : un fil relie les rubriques dans l'ordre du travail, et une flèche dit « puis ». */}
                {ordre.includes(g) ? (
                  <span className={`nav-etape${ordre.indexOf(g) === 0 ? ' debut' : ''}`} aria-hidden="true">
                    {ordre.indexOf(g) > 0 ? <ChevronDown size={13} strokeWidth={2.6} /> : null}
                  </span>
                ) : null}
                {g}
                {ordre.includes(g) ? <span className="sr">, étape {ordre.indexOf(g) + 1} sur {ordre.length}</span> : null}
              </div>
            ) : null}
            {liens
              .filter((l) => l.groupe === g)
              .map((n) => (
                <button key={n.vue} type="button" data-tour={`nav-${n.vue}`} className={`nav-item${vueActive === n.vue ? ' on' : ''}`} onClick={() => { aller(n.vue); setVolet(false); }} aria-current={vueActive === n.vue ? 'page' : undefined}>
                  <span className={`ni ${n.couleur}`} aria-hidden="true">
                    {n.icon}
                  </span>
                  <span>
                    {n.label}
                    <span className="q">{n.question}</span>
                  </span>
                  {(n.vue === 'resoudre' && aDecider) || (n.vue === 'messages' && nonLus) || (n.vue === 'moi' && aLire) ? (
                    <span className="nav-badge">
                      {n.vue === 'resoudre' ? aDecider : n.vue === 'messages' ? nonLus : aLire}
                      <span className="sr">{n.vue === 'resoudre' ? ' décisions en attente' : n.vue === 'messages' ? ' messages non lus' : ' changements à lire'}</span>
                    </span>
                  ) : null}
                </button>
              ))}
          </div>
        ))}
        {liens.some((l) => l.vue === 'aide') ? (
          <button type="button" data-tour="nav-aide" className={`nav-item nav-aide${vueActive === 'aide' ? ' on' : ''}`} onClick={() => { aller('aide'); setVolet(false); }} aria-current={vueActive === 'aide' ? 'page' : undefined}>
            <span className="ni" aria-hidden="true">
              <Lightbulb size={20} />
            </span>
            <span className="grow">
              <b>Besoin d’aide ?</b>
              <span className="nav-aide-sous">Aide, tutoriels et lexique</span>
            </span>
            <ChevronRight size={16} aria-hidden="true" className="nav-aide-fleche" />
          </button>
        ) : null}
        <div className="side-foot">
          <i aria-hidden="true" />
          <span>Enregistré sur cet appareil à {fmtHeure(heure.getHours() * 60 + heure.getMinutes())}</span>
        </div>
      </nav>

      {/* Téléphone : les quatre rubriques les plus utiles sous le pouce, et « Menu » pour toutes les autres. */}
      <nav className="tabbar no-print" aria-label="Navigation rapide">
        {RAPIDES[espace]
          .map((r) => ({ ...r, lien: liens.find((l) => l.vue === r.vue) }))
          .filter((r) => r.lien)
          .map((r) => {
            const n = r.vue === 'resoudre' ? aDecider : r.vue === 'messages' ? nonLus : r.vue === 'moi' ? aLire : 0;
            return (
              <button key={r.vue} type="button" className={`tab${vueActive === r.vue ? ' on' : ''}`} data-tab={r.vue} onClick={() => { aller(r.vue); setVolet(false); }} aria-current={vueActive === r.vue ? 'page' : undefined}>
                <span className="ni" aria-hidden="true">
                  {r.lien?.icon}
                </span>
                <span className="tab-lib">{r.court}</span>
                {n ? (
                  <span className="nav-badge">
                    {n}
                    <span className="sr">{r.vue === 'resoudre' ? ' décisions en attente' : r.vue === 'messages' ? ' messages non lus' : ' changements à lire'}</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        <button type="button" className={`tab burger${volet ? ' on' : ''}`} aria-label="Ouvrir le menu" aria-expanded={volet} aria-controls="menu-rubriques" onClick={() => setVolet((x) => !x)}>
          <span className="ni" aria-hidden="true">
            <Menu size={18} />
          </span>
          <span className="tab-lib">Menu</span>
        </button>
      </nav>

      {impression && moi ? <ApercuImpression moi={moi} gestion={espace === 'responsable'} /> : null}
      {(signaler || signalement) && moi ? (
        <DialogueSignaler
          moi={moi}
          quoi={signalement === 'retard' || signalement === 'absence' ? signalement : undefined}
          onClose={() => {
            setSignaler(false);
            useUi.getState().signaler(null);
          }}
        />
      ) : null}
      <div className={`main${defile ? ' defile' : ''}`}>
        <header className="topbar no-print" aria-label="Barre d’outils">
          <div className="topbar-in">
            <span className="espace-qui grow">
              {data.demo ? (
                // Dans l'environnement de test, l'étiquette de l'espace ouvre le menu : profil, tutoriels, remise à neuf.
                <span className="bt-ancre">
                  <button type="button" className={`espace-badge bouton ${couleurDe(moi)}`} id="bt-ouvrir" aria-haspopup="dialog" aria-expanded={menuTest} title="Environnement de test : changer de profil, tutoriels, réinitialiser" onClick={() => setMenuTest((x) => !x)}>
                    <IconeRole size={16} aria-hidden="true" />
                    <span className="esp">{secondaire ? 'Espace titulaire secondaire' : estResponsable(data, moi) ? 'Espace titulaire' : espace === 'responsable' ? 'Espace gestion' : `Espace ${QUALIFICATION_COURT[moi.qualification].toLowerCase()}`}</span>
                    <span className="sr">, environnement de test : changer de profil</span>
                    <ChevronDown size={15} aria-hidden="true" className="bt-chevron" />
                  </button>
                  {menuTest ? <MenuTest moi={moi.id} onClose={fermerMenuTest} /> : null}
                </span>
              ) : (
                <span className={`espace-badge ${couleurDe(moi)}`} title={secondaire ? `Vos décisions attendent l’accord de ${chef?.prenom ?? 'la titulaire principale'}` : undefined}>
                  <IconeRole size={16} aria-hidden="true" />
                  <span className="esp">{secondaire ? 'Espace titulaire secondaire' : estResponsable(data, moi) ? 'Espace titulaire' : espace === 'responsable' ? 'Espace gestion' : `Espace ${QUALIFICATION_COURT[moi.qualification].toLowerCase()}`}</span>
                </span>
              )}
              <span className="small soft espace-officine">{data.officine.nom || 'Mon officine'}</span>
            </span>
            <span className="top-date cap1" aria-hidden="true">
              <CalendarDays size={15} /> {fmtDateCourt(today)}
            </span>
            <div className="outils" ref={outilsRef}>
              {espace === 'responsable' ? (
                <div style={{ position: 'relative' }}>
                  <button type="button" className="btn sm primary top-creer" aria-haspopup="true" aria-expanded={panneau === 'creer'} onClick={() => setPanneau((x) => (x === 'creer' ? null : 'creer'))}>
                    <Plus size={16} aria-hidden="true" /> <span className="lib">Créer</span>
                    <span className="sr">, ouvrir le menu de création</span>
                  </button>
                  {panneau === 'creer' ? (
                    <div className="menu">
                      <div className="titre-menu">Créer</div>
                      <button type="button" onClick={() => { setPanneau(null); aller('construire'); }}>
                        <CalendarRange size={17} aria-hidden="true" /> Un planning
                      </button>
                      <button type="button" onClick={() => { setPanneau(null); agir('gardes', 'garde'); }}>
                        <MoonStar size={17} aria-hidden="true" /> Une garde
                      </button>
                      <button type="button" onClick={() => { setPanneau(null); agir('equipe', 'formation'); }}>
                        <GraduationCap size={17} aria-hidden="true" /> Une formation
                      </button>
                      <button type="button" onClick={() => { setPanneau(null); agir('equipe', 'inventaire'); }}>
                        <ClipboardCheck size={17} aria-hidden="true" /> Un inventaire
                      </button>
                      <button type="button" onClick={() => { setPanneau(null); agir('equipe', 'personne'); }}>
                        <Users size={17} aria-hidden="true" /> Une personne
                      </button>
                      <button type="button" onClick={() => { setPanneau(null); agir('moi', 'demande'); }}>
                        <CalendarDays size={17} aria-hidden="true" /> Mon absence
                      </button>
                      <button type="button" onClick={() => { setPanneau(null); aller('messages'); }}>
                        <MessageSquare size={17} aria-hidden="true" /> Un message
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <button type="button" className="btn sm primary top-creer" aria-label="Faire une demande" onClick={() => agir('moi', 'demande')}>
                  <Plus size={16} aria-hidden="true" /> <span className="lib">Faire une demande</span>
                </button>
              )}
              <button type="button" className="btn sm top-signaler" id="top-signaler" onClick={() => setSignaler(true)} title="Signaler un retard ou une absence, pour vous ou pour quelqu’un d’autre">
                <AlarmClock size={16} aria-hidden="true" /> <span className="lib">Retard ou absence</span>
                <span className="sr">, signaler</span>
              </button>
              <div style={{ position: 'relative' }}>
                <button type="button" className="btn ghost icon top-ico" aria-haspopup="true" aria-expanded={panneau === 'alertes'} onClick={() => setPanneau((x) => (x === 'alertes' ? null : 'alertes'))}>
                  <Bell size={18} aria-hidden="true" />
                  {alertes.length + annonces.length ? <span className="pastille-n">{alertes.reduce((t, a) => t + a.nombre, 0) + annonces.length}</span> : null}
                  <span className="sr">{alertes.length + annonces.length ? ' notifications, ouvrir la liste' : 'Aucune notification'}</span>
                </button>
                {panneau === 'alertes' ? (
                  <div className="menu cloche" style={{ minWidth: 300 }}>
                    {annonces.length ? (
                      <>
                        <div className="titre-menu">Décidé récemment</div>
                        <ListeAnnonces data={data} annonces={annonces.slice(0, 4)} moi={moi.id} onLu={(id) => lireAnnonces(moi.id, id)} />
                        <button type="button" className="annonce-tout" onClick={() => lireAnnonces(moi.id)}>
                          <CheckCheck size={15} aria-hidden="true" /> {annonces.length > 4 ? `Tout marquer comme lu (${annonces.length})` : 'Tout marquer comme lu'}
                        </button>
                      </>
                    ) : null}
                    {alertes.length || !annonces.length ? <div className="titre-menu">À voir</div> : null}
                    {alertes.length ? (
                      alertes.map((a) => (
                        <button key={a.cle} type="button" onClick={() => { setPanneau(null); a.avant?.(); aller(a.vue); }}>
                          {a.icone}
                          <span className="grow">{a.texte}</span>
                          <span className="nav-badge" aria-hidden="true">{a.nombre}</span>
                        </button>
                      ))
                    ) : !annonces.length ? (
                      <p className="small soft" style={{ padding: '8px 14px 12px' }}>Vous êtes à jour : rien à lire, rien à décider.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <button type="button" className="btn ghost icon top-ico" onClick={() => aller('messages')} aria-label={nonLus ? `Messages, ${nonLus} non lu${nonLus > 1 ? 's' : ''}` : 'Messages'}>
                <MessageSquare size={18} aria-hidden="true" />
                {nonLus ? <span className="pastille-n" aria-hidden="true">{nonLus}</span> : null}
              </button>
              <button type="button" className="btn ghost icon top-ico" data-tour="aide" aria-label="Aide et tutoriels" title="Aide et tutoriels" aria-current={vueActive === 'aide' ? 'page' : undefined} onClick={() => aller('aide')}>
                <CircleHelp size={18} aria-hidden="true" />
              </button>
            </div>
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button type="button" className="compte-btn" data-tour="compte" aria-haspopup="true" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                <Avatar person={moi} />
                <span className="nomc">{nomCourt(moi)}</span>
                <span className="sr">, ouvrir le menu du compte</span>
                <ChevronDown size={15} aria-hidden="true" />
              </button>
              {menu ? (
                <div className="menu">
                  <div className="qui">
                    <b>{nomComplet(moi)}</b>
                    <div style={{ marginTop: 6 }}>
                      <EtiquetteRole person={moi} />
                    </div>
                  </div>
                  <button type="button" onClick={() => { setMenu(false); aller('compte'); }}>
                    <UserRound size={17} aria-hidden="true" /> Mon compte
                  </button>
                  {espace === 'responsable' ? (
                    <button type="button" onClick={() => { setMenu(false); aller('moi'); }}>
                      <CalendarDays size={17} aria-hidden="true" /> Mes horaires
                      {aLire ? <span className="nav-badge" aria-hidden="true">{aLire}</span> : null}
                    </button>
                  ) : null}
                  {/* L'apparence se change d'ici, en un geste : clair, mixte (menu foncé) ou sombre. */}
                  <div className="menu-apparence" role="group" aria-label="Apparence">
                    <span className="menu-apparence-nom">
                      {sombre ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />} Apparence
                    </span>
                    <span className="seg petit">
                      {(['clair', 'mixte', 'sombre'] as const).map((m) => (
                        <button key={m} type="button" id={`apparence-${m}`} className={(m === 'sombre' ? sombre : !sombre && (prefs.mode === 'mixte') === (m === 'mixte')) ? 'on' : ''} aria-pressed={m === 'sombre' ? sombre : !sombre && (prefs.mode === 'mixte') === (m === 'mixte')} onClick={() => setPreferences(session ?? '', { mode: m })}>
                          {m === 'clair' ? 'Clair' : m === 'mixte' ? 'Mixte' : 'Sombre'}
                        </button>
                      ))}
                    </span>
                  </div>
                  <button type="button" onClick={() => { setMenu(false); aller('compte'); window.setTimeout(() => document.getElementById('c-apparence')?.scrollIntoView({ block: 'start' }), 60); }}>
                    <Settings size={17} aria-hidden="true" /> Paramètres
                  </button>
                  {mesPharmacies.length > 1 ? (
                    <>
                      <div className="titre-menu">Changer de pharmacie</div>
                      {mesPharmacies.filter((o) => o.id !== officineId).map((o) => (
                        <button key={o.id} type="button" onClick={() => { setMenu(false); changerOfficine(o.id); }}>
                          <Store size={17} aria-hidden="true" /> {o.nom}
                        </button>
                      ))}
                    </>
                  ) : null}
                  {estResponsable(data, moi) ? (
                    <button type="button" onClick={() => { setMenu(false); aller('nouvelle'); }}>
                      <Building2 size={17} aria-hidden="true" /> Ajouter une pharmacie
                    </button>
                  ) : null}
                  <button type="button" onClick={() => { setMenu(false); setQuitter(true); }}>
                    <LogOut size={17} aria-hidden="true" /> Se déconnecter
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="content" id="contenu" tabIndex={0}>
          {vueActive === 'espace' ? (
            <MonAccueil personId={moi.id} />
          ) : vueActive === 'moi' ? (
            <MonPlanning personId={moi.id} />
          ) : vueActive === 'demandes' ? (
            <MesDemandes personId={moi.id} />
          ) : vueActive === 'suivi' ? (
            <MonSuivi personId={moi.id} />
          ) : vueActive === 'planning' ? (
            <PlanningEquipe personId={moi.id} />
          ) : vueActive === 'mesgardes' ? (
            <MesGardes personId={moi.id} />
          ) : vueActive === 'compte' ? (
            <Compte personId={moi.id} />
          ) : vueActive === 'tableau' ? (
            <Tableau personId={moi.id} />
          ) : vueActive === 'messages' ? (
            <Messages personId={moi.id} />
          ) : vueActive === 'construire' ? (
            <Construire />
          ) : vueActive === 'resoudre' ? (
            <Resoudre />
          ) : vueActive === 'gardes' ? (
            <Gardes />
          ) : vueActive === 'equipe' ? (
            <Equipe />
          ) : vueActive === 'heures' ? (
            <Heures />
          ) : vueActive === 'equite' ? (
            <Equite />
          ) : vueActive === 'regles' ? (
            <Regles />
          ) : vueActive === 'aide' ? (
            <Aide espace={espace} />
          ) : vueActive === 'documents' ? (
            <Documents personId={moi.id} espace={espace} />
          ) : vueActive === 'journal' ? (
            <Journal />
          ) : (
            <Officine />
          )}
          <PiedSupport />
        </main>
      </div>

      <Assistant espace={espace} prenom={moi.prenom} personId={moi.id} />
      {quitter ? (
        <DialogueDeconnexion
          data={data}
          today={today}
          moi={moi}
          espace={espace}
          onRester={() => setQuitter(false)}
          onPartir={() => {
            setQuitter(false);
            deconnecter();
          }}
          onVoir={(v, sujet) => {
            setQuitter(false);
            if (sujet) setSujet(sujet);
            aller(v);
          }}
        />
      ) : null}
      <Tour />
      <Parcours />
      <ChoixParcours />
      {jour ? <DialogueJour date={jour} moi={moi.id} onClose={() => voirJour(null)} /> : null}
      {toast ? (
        <div className="toast" role="status">
          {toast.message}
          {toast.suite ? (
            <button
              type="button"
              className="toast-suite"
              onClick={() => {
                const { faire } = toast.suite!;
                taire();
                faire();
              }}
            >
              {toast.suite.label}
            </button>
          ) : null}
          {toast.annulable ? (
            <button
              type="button"
              onClick={() => {
                undo();
                taire();
              }}
            >
              Annuler
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
