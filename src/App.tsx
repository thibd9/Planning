import { Bell, BookOpenCheck, Building2, CalendarDays, GraduationCap, CalendarRange, ChevronDown, CircleHelp, LayoutDashboard, ListChecks, LogOut, MessageSquare, MoonStar, Scale, Plus, ScrollText, Settings, Settings2, Store, UserRound, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Espace } from './domain/acces';
import { ESPACE_LABEL, espaceDe, estResponsable, memeIdentifiant } from './domain/acces';
import { fmtDateCourt, fmtHeure } from './domain/time';
import { nomComplet, nomCourt } from './domain/types';
import { decisions } from './engine/decisions';
import { useStore } from './store/store';
import type { Vue } from './store/ui';
import { prefsDe, useUi } from './store/ui';
import { EtiquetteRole } from './ui/icons';
import { Avatar, Logo, LogoNom } from './ui/kit';
import { BandeauTest, Parcours } from './ui/Parcours';
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
import { PlanningEquipe } from './ui/views/PlanningEquipe';
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

const MOI: Lien = { vue: 'moi', label: 'Mon planning', question: 'Mes horaires, mes demandes', icon: <CalendarDays size={18} />, couleur: 'c-clair', groupe: '' };
const MESSAGES: Lien = { vue: 'messages', label: 'Messages', question: 'Échanger avec l’équipe', icon: <MessageSquare size={18} />, couleur: 'c-clair', groupe: 'Au quotidien' };
// Trois groupes : ce qu'on regarde chaque jour, ce qui fabrique le planning, ce qui décrit la pharmacie.
const GESTION: Lien[] = [
  { vue: 'tableau', label: 'Tableau de bord', question: 'Vue d’ensemble du jour', icon: <LayoutDashboard size={18} />, couleur: 'c-clair', groupe: 'Au quotidien' },
  { vue: 'resoudre', label: 'Résoudre', question: 'À décider aujourd’hui', icon: <ListChecks size={18} />, couleur: 'c-clair', groupe: 'Au quotidien' },
  MESSAGES,
  { vue: 'construire', label: 'Construire', question: 'Le planning de la semaine', icon: <CalendarRange size={18} />, couleur: 'c-clair', groupe: 'Plannings' },
  { vue: 'gardes', label: 'Gardes', question: 'Affecter, prévenir, payer', icon: <MoonStar size={18} />, couleur: 'c-clair', groupe: 'Plannings' },
  { vue: 'equite', label: 'Équité', question: 'Qui a porté quoi', icon: <Scale size={18} />, couleur: 'c-clair', groupe: 'Plannings' },
  { vue: 'equipe', label: 'Équipe', question: 'Contrats, droits, besoins', icon: <Users size={18} />, couleur: 'c-clair', groupe: 'Ma pharmacie' },
  { vue: 'officine', label: 'Réglages', question: 'Horaires, postes types', icon: <Settings2 size={18} />, couleur: 'c-clair', groupe: 'Ma pharmacie' },
  { vue: 'regles', label: 'Règles', question: 'Sources et versions', icon: <BookOpenCheck size={18} />, couleur: 'c-clair', groupe: 'Ma pharmacie' },
  { vue: 'journal', label: 'Journal et paie', question: 'Preuves, fiche navette', icon: <ScrollText size={18} />, couleur: 'c-clair', groupe: 'Ma pharmacie' },
];
const PLANNING: Lien = { vue: 'planning', label: 'Planning de l’équipe', question: 'La version publiée', icon: <CalendarRange size={18} />, couleur: 'c-clair', groupe: 'Au quotidien' };
const MESGARDES: Lien = { vue: 'mesgardes', label: 'Mes gardes', question: 'Gardes et astreintes', icon: <MoonStar size={18} />, couleur: 'c-clair', groupe: 'Au quotidien' };

/** Chaque rôle a sa propre navigation ; « Mon planning » est toujours en tête. Le compte est en haut à droite. */
const NAV: Record<Espace, Lien[]> = {
  responsable: [MOI, ...GESTION],
  pharmacien: [MOI, PLANNING, MESGARDES, MESSAGES],
  equipe: [MOI, PLANNING, MESSAGES],
};
const HORS_MENU: Vue[] = ['compte', 'nouvelle'];

export function App(): JSX.Element {
  const { data, autres, officineId, changerOfficine } = useStore();
  const today = useStore((s) => s.today);
  const sauvegarde = useStore((s) => s.derniereSauvegarde);
  const undo = useStore((s) => s.undo);
  const { vue, aller, agir, session, deconnecter, preferences, toast, taire, setTour, parcours } = useUi();
  const [menu, setMenu] = useState(false);
  // Sans session, l'application s'ouvre sur la connexion ; la création d'une pharmacie se lance depuis là.
  const [creation, setCreation] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const outilsRef = useRef<HTMLDivElement>(null);
  const [panneau, setPanneau] = useState<'creer' | 'alertes' | null>(null);
  const moi = data.personnes.find((p) => !p.externe && memeIdentifiant(p.identifiant, session ?? ''));
  const espace = espaceDe(data, moi);
  const liens = NAV[espace];
  const vueActive = liens.some((l) => l.vue === vue) || HORS_MENU.includes(vue) ? vue : espace === 'responsable' ? 'tableau' : 'moi';
  const aLire = moi ? data.notifications.filter((n) => n.personId === moi.id && !n.luLe).length : 0;
  const nonLus = moi ? data.messages.filter((m) => !m.luPar.includes(moi.id) && (m.a === 'equipe' || m.a === moi.id)).length : 0;
  // Les pharmacies de l'appareil où la personne connectée a un compte.
  const mesPharmacies = [{ id: officineId, nom: data.officine.nom }, ...Object.entries(autres).filter(([, d]) => d.personnes.some((p) => memeIdentifiant(p.identifiant, session ?? ''))).map(([id, d]) => ({ id, nom: d.officine.nom }))];
  const aDecider = useMemo(() => (espace === 'responsable' ? decisions(data, today).total : 0), [data, today, espace]);
  // Ce qui attend la personne connectée, rassemblé sous la cloche de la barre du haut.
  const aAider = moi ? data.remplacements.filter((r) => r.statut === 'ouverte' && r.date >= today && r.demandeur !== moi.id && !r.volontaires.includes(moi.id)).length : 0;
  const alertes: { vue: Vue; texte: string; nombre: number; icone: JSX.Element }[] = [
    ...(aDecider ? [{ vue: 'resoudre' as Vue, texte: `Décision${aDecider > 1 ? 's' : ''} à prendre`, nombre: aDecider, icone: <ListChecks size={17} aria-hidden="true" /> }] : []),
    ...(aLire ? [{ vue: 'moi' as Vue, texte: `Changement${aLire > 1 ? 's' : ''} de mon planning à lire`, nombre: aLire, icone: <CalendarDays size={17} aria-hidden="true" /> }] : []),
    ...(espace !== 'responsable' && aAider ? [{ vue: 'moi' as Vue, texte: 'Collègue qui cherche un remplaçant', nombre: aAider, icone: <Users size={17} aria-hidden="true" /> }] : []),
  ];
  // Tant que ni le nom ni l'équipe ne sont saisis, l'application s'ouvre sur l'écran de création.
  const aCreer = !data.officine.nom.trim() && !data.personnes.length;
  const prefs = prefsDe(preferences, session);

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
  if (vueActive === 'nouvelle' && estResponsable(data, moi)) return <Accueil ajout={moi} onAnnuler={() => aller('tableau')} />;

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
          <div style={{ minWidth: 0 }}>
            <div className="brand-name">
              <LogoNom />
            </div>
            <div className="brand-sub">{data.officine.nom || 'Mon officine'}</div>
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
            {g ? <div className="nav-label">{g}</div> : null}
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
              <span className="esp">{ESPACE_LABEL[espace]} · </span>
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
                        <CalendarRange size={17} aria-hidden="true" /> Un planning de semaine
                      </button>
                      <button type="button" onClick={() => { setPanneau(null); agir('gardes', 'garde'); }}>
                        <MoonStar size={17} aria-hidden="true" /> Une garde
                      </button>
                      <button type="button" onClick={() => { setPanneau(null); agir('equipe', 'formation'); }}>
                        <GraduationCap size={17} aria-hidden="true" /> Une formation
                      </button>
                      <button type="button" onClick={() => { setPanneau(null); agir('equipe', 'personne'); }}>
                        <Users size={17} aria-hidden="true" /> Une personne dans l’équipe
                      </button>
                      <button type="button" onClick={() => { setPanneau(null); agir('moi', 'demande'); }}>
                        <CalendarDays size={17} aria-hidden="true" /> Une absence ou une demande pour moi
                      </button>
                      <button type="button" onClick={() => { setPanneau(null); aller('messages'); }}>
                        <MessageSquare size={17} aria-hidden="true" /> Un message à l’équipe
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <button type="button" className="btn sm primary top-creer" onClick={() => agir('moi', 'demande')}>
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
                        <button key={a.vue} type="button" onClick={() => { setPanneau(null); aller(a.vue); }}>
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
                  <button type="button" onClick={() => { setMenu(false); deconnecter(); }}>
                    <LogOut size={17} aria-hidden="true" /> Se déconnecter
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        {data.demo ? <BandeauTest moi={moi.id} /> : null}
        <main className="content" id="contenu" tabIndex={-1}>
          {vueActive === 'moi' ? (
            <MonPlanning personId={moi.id} />
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
          ) : vueActive === 'equite' ? (
            <Equite />
          ) : vueActive === 'regles' ? (
            <Regles />
          ) : vueActive === 'journal' ? (
            <Journal />
          ) : (
            <Officine />
          )}
        </main>
      </div>

      <Tour />
      <Parcours />
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
