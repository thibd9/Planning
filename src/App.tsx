import { ArrowLeftRight, Bell, BookOpenCheck, Building2, CalendarDays, CalendarRange, ChevronDown, CircleHelp, ClipboardCheck, Gauge, GraduationCap, Hourglass, Inbox, LayoutDashboard, ListChecks, LogOut, MessageSquare, Moon, MoonStar, Plus, Scale, ScrollText, Settings, Settings2, Store, Sun, UserRound, Users, FolderOpen } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Espace } from './domain/acces';
import { ESPACE_LABEL, espaceDe, estResponsable, estSecondaire, memeIdentifiant, responsable } from './domain/acces';
import { fmtDateCourt, fmtHeure } from './domain/time';
import { nomComplet, nomCourt } from './domain/types';
import { Documents } from './ui/views/Documents';
import { DialogueDeconnexion } from './ui/components/Deconnexion';
import { decisions } from './engine/decisions';
import { useStore } from './store/store';
import type { Vue } from './store/ui';
import { prefsDe, useUi } from './store/ui';
import { EtiquetteRole } from './ui/icons';
import { Avatar, Logo, LogoNom } from './ui/kit';
import { DialogueJour } from './ui/components/Jour';
import { BandeauTest, ChoixParcours, Parcours } from './ui/Parcours';
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
import { Officine } from './ui/views/Officine';
import { MesDemandes, MonSuivi } from './ui/views/MonEspace';
import { PlanningEquipe } from './ui/views/PlanningEquipe';
import { Heures } from './ui/views/Heures';
import { Assistant } from './ui/Assistant';
import { aRegulariser } from './engine/heures';
import { URGENCE_LABEL } from './domain/types';
import { Regles } from './ui/views/Regles';
import { Resoudre } from './ui/views/Resoudre';
import { Tableau } from './ui/views/Tableau';

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
const PERSO: Lien[] = [MOI, DEMANDES, SUIVI, DOCUMENTS];
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
];
const PLANNING: Lien = { vue: 'planning', label: 'Planning de l’équipe', question: 'La version publiée', icon: <CalendarRange size={18} />, couleur: 'c-clair', groupe: 'L’équipe' };
const MESGARDES: Lien = { vue: 'mesgardes', label: 'Mes gardes', question: 'Gardes et astreintes', icon: <MoonStar size={18} />, couleur: 'c-clair', groupe: 'Mon espace' };

/** Chaque rôle a sa propre navigation ; « Mon planning » est toujours en tête. Le compte est en haut à droite. */
const NAV: Record<Espace, Lien[]> = {
  responsable: GESTION,
  pharmacien: [...PERSO, MESGARDES, PLANNING, { ...MESSAGES, groupe: 'L’équipe' }],
  equipe: [...PERSO, PLANNING, { ...MESSAGES, groupe: 'L’équipe' }],
};
// Le titulaire garde ses propres horaires à portée, depuis le menu du compte.
const HORS_MENU: Vue[] = ['compte', 'nouvelle', 'moi', 'demandes'];

export function App(): JSX.Element {
  const { data, autres, officineId, changerOfficine } = useStore();
  const today = useStore((s) => s.today);
  const sauvegarde = useStore((s) => s.derniereSauvegarde);
  const undo = useStore((s) => s.undo);
  const { vue, aller, agir, setSujet, viserDemande, session, deconnecter, preferences, toast, taire, setTour, parcours, jour, voirJour, dire, setPreferences } = useUi();
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
  const moi = data.personnes.find((p) => !p.externe && memeIdentifiant(p.identifiant, session ?? ''));
  const espace = espaceDe(data, moi);
  // Sans collecte des préférences (modèle classique), l'entrée disparaît du menu.
  const liens = NAV[espace];
  const vueActive = liens.some((l) => l.vue === vue) || HORS_MENU.includes(vue) ? vue : espace === 'responsable' ? 'tableau' : 'moi';
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
  const heuresARegler = useMemo(() => (espace === 'responsable' ? aRegulariser(data, today).length : 0), [data, today, espace]);
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
    ...(heuresARegler ? [{ cle: 'heures', vue: 'heures' as Vue, texte: `Compteur${heuresARegler > 1 ? 's' : ''} d’heures à régulariser`, nombre: heuresARegler, icone: <Hourglass size={17} aria-hidden="true" /> }] : []),
    ...(aLire ? [{ cle: 'lire', vue: 'moi' as Vue, texte: `Changement${aLire > 1 ? 's' : ''} de mon planning à lire`, nombre: aLire, icone: <CalendarDays size={17} aria-hidden="true" /> }] : []),
    ...(espace !== 'responsable' && aAider ? [{ cle: 'aider', vue: 'moi' as Vue, texte: 'Collègue qui cherche un remplaçant', nombre: aAider, icone: <Users size={17} aria-hidden="true" /> }] : []),
  ];
  // Tant que ni le nom ni l'équipe ne sont saisis, l'application s'ouvre sur l'écran de création.
  const aCreer = !data.officine.nom.trim() && !data.personnes.length;
  const prefs = prefsDe(preferences, session);
  const sombre = prefs.mode === 'sombre' || (prefs.mode === 'auto' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(taire, 5200);
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
    const appliquer = (): void => {
      document.documentElement.dataset.mode = prefs.mode === 'auto' ? (media.matches ? 'sombre' : 'clair') : prefs.mode;
    };
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

  return (
    <div className={`app${parcours !== null && data.demo ? ' en-parcours' : ''}`}>
      <a className="skip" href="#contenu">
        Aller au contenu
      </a>
      <nav className="side" aria-label="Navigation principale">
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
        {groupes.map((g) => (
          <div key={g || 'tete'} style={{ display: 'contents' }}>
            {g ? (
              <div className="nav-label">
                {espace === 'responsable' ? (
                  <span className="nav-etape" aria-hidden="true">
                    {groupes.filter(Boolean).indexOf(g) + 1}
                  </span>
                ) : null}
                {g}
              </div>
            ) : null}
            {liens
              .filter((l) => l.groupe === g)
              .map((n) => (
                <button key={n.vue} type="button" data-tour={`nav-${n.vue}`} className={`nav-item${vueActive === n.vue ? ' on' : ''}`} onClick={() => aller(n.vue)} aria-current={vueActive === n.vue ? 'page' : undefined}>
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
        <div className="side-foot">
          <i aria-hidden="true" />
          <span>Enregistré sur cet appareil à {fmtHeure(heure.getHours() * 60 + heure.getMinutes())}</span>
        </div>
      </nav>

      <div className="main">
        <header className="topbar no-print" aria-label="Barre d’outils">
          <div className="topbar-in">
            <span className="small soft grow">
              <span className="esp">{secondaire ? `Titulaire secondaire · décisions soumises à l’accord de ${chef?.prenom ?? 'la titulaire principale'}` : ESPACE_LABEL[espace]} · </span>
              {data.officine.nom || 'Mon officine'}
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
              <div style={{ position: 'relative' }}>
                <button type="button" className="btn ghost icon top-ico" aria-haspopup="true" aria-expanded={panneau === 'alertes'} onClick={() => setPanneau((x) => (x === 'alertes' ? null : 'alertes'))}>
                  <Bell size={18} aria-hidden="true" />
                  {alertes.length ? <span className="pastille-n">{alertes.reduce((t, a) => t + a.nombre, 0)}</span> : null}
                  <span className="sr">{alertes.length ? ' notifications, ouvrir la liste' : 'Aucune notification'}</span>
                </button>
                {panneau === 'alertes' ? (
                  <div className="menu" style={{ minWidth: 300 }}>
                    <div className="titre-menu">À voir</div>
                    {alertes.length ? (
                      alertes.map((a) => (
                        <button key={a.cle} type="button" onClick={() => { setPanneau(null); a.avant?.(); aller(a.vue); }}>
                          {a.icone}
                          <span className="grow">{a.texte}</span>
                          <span className="nav-badge" aria-hidden="true">{a.nombre}</span>
                        </button>
                      ))
                    ) : (
                      <p className="small soft" style={{ padding: '8px 14px 12px' }}>Vous êtes à jour : rien à lire, rien à décider.</p>
                    )}
                  </div>
                ) : null}
              </div>
              <button type="button" className="btn ghost icon top-ico" onClick={() => aller('messages')} aria-label={nonLus ? `Messages, ${nonLus} non lu${nonLus > 1 ? 's' : ''}` : 'Messages'}>
                <MessageSquare size={18} aria-hidden="true" />
                {nonLus ? <span className="pastille-n" aria-hidden="true">{nonLus}</span> : null}
              </button>
              {espace === 'responsable' ? (
                <button
                  type="button"
                  className="btn ghost icon top-ico"
                  data-tour="aide"
                  aria-label="Tutoriel"
                  title="Tutoriel"
                  onClick={() => {
                    aller('tableau');
                    setTour(0);
                  }}
                >
                  <CircleHelp size={18} aria-hidden="true" />
                </button>
              ) : null}
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
                  <button type="button" role="switch" aria-checked={sombre} onClick={() => setPreferences(session ?? '', { mode: sombre ? 'clair' : 'sombre' })}>
                    {sombre ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />} Mode sombre
                    <span className={`bascule${sombre ? ' on' : ''}`} aria-hidden="true" />
                  </button>
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
        {data.demo ? <BandeauTest moi={moi.id} /> : null}
        <main className="content" id="contenu" tabIndex={0}>
          {vueActive === 'moi' ? (
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
          ) : vueActive === 'documents' ? (
            <Documents personId={moi.id} espace={espace} />
          ) : vueActive === 'journal' ? (
            <Journal />
          ) : (
            <Officine />
          )}
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
