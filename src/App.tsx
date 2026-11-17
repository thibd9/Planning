import { BookOpenCheck, Building2, CalendarDays, CalendarRange, ChevronDown, CircleHelp, LayoutDashboard, ListChecks, LogOut, MessageSquare, MoonStar, Scale, ScrollText, Settings, Settings2, Store, UserRound, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Espace } from './domain/acces';
import { ESPACE_LABEL, espaceDe, estResponsable, memeIdentifiant } from './domain/acces';
import { fmtHeure } from './domain/time';
import { nomComplet, nomCourt } from './domain/types';
import { decisions } from './engine/decisions';
import { useStore } from './store/store';
import type { Vue } from './store/ui';
import { prefsDe, useUi } from './store/ui';
import { EtiquetteRole } from './ui/icons';
import { Avatar, Logo } from './ui/kit';
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
const GESTION: Lien[] = [
  { vue: 'tableau', label: 'Tableau de bord', question: 'L’officine en un coup d’œil', icon: <LayoutDashboard size={18} />, couleur: 'c-clair', groupe: 'Au quotidien' },
  { vue: 'resoudre', label: 'Résoudre', question: 'À décider aujourd’hui', icon: <ListChecks size={18} />, couleur: 'c-clair', groupe: 'Au quotidien' },
  { vue: 'construire', label: 'Construire', question: 'Le planning de la semaine', icon: <CalendarRange size={18} />, couleur: 'c-clair', groupe: 'Au quotidien' },
  { vue: 'gardes', label: 'Gardes', question: 'De la garde à la paie', icon: <MoonStar size={18} />, couleur: 'c-clair', groupe: 'Au quotidien' },
  MESSAGES,
  { vue: 'equipe', label: 'Équipe', question: 'Contrats, droits, besoins', icon: <Users size={18} />, couleur: 'c-clair', groupe: 'Référentiel' },
  { vue: 'equite', label: 'Équité', question: 'Qui a porté quoi', icon: <Scale size={18} />, couleur: 'c-clair', groupe: 'Référentiel' },
  { vue: 'regles', label: 'Règles', question: 'Sources et versions', icon: <BookOpenCheck size={18} />, couleur: 'c-clair', groupe: 'Référentiel' },
  { vue: 'journal', label: 'Journal et paie', question: 'Preuves, fiche navette', icon: <ScrollText size={18} />, couleur: 'c-clair', groupe: 'Référentiel' },
  { vue: 'officine', label: 'Officine', question: 'Horaires, postes types', icon: <Settings2 size={18} />, couleur: 'c-clair', groupe: 'Référentiel' },
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
  const { vue, aller, session, deconnecter, preferences, toast, taire, setTour } = useUi();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const moi = data.personnes.find((p) => !p.externe && memeIdentifiant(p.identifiant, session ?? ''));
  const espace = espaceDe(data, moi);
  const liens = NAV[espace];
  const vueActive = liens.some((l) => l.vue === vue) || HORS_MENU.includes(vue) ? vue : espace === 'responsable' ? 'tableau' : 'moi';
  const nonLus = moi ? data.messages.filter((m) => !m.luPar.includes(moi.id) && (m.a === 'equipe' || m.a === moi.id)).length : 0;
  // Les pharmacies de l'appareil où la personne connectée a un compte.
  const mesPharmacies = [{ id: officineId, nom: data.officine.nom }, ...Object.entries(autres).filter(([, d]) => d.personnes.some((p) => memeIdentifiant(p.identifiant, session ?? ''))).map(([id, d]) => ({ id, nom: d.officine.nom }))];
  const aDecider = useMemo(() => (espace === 'responsable' ? decisions(data, today).total : 0), [data, today, espace]);
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
  const titrePage = aCreer ? 'Créer mon officine' : !moi ? 'Connexion' : vueActive === 'compte' ? 'Mon compte' : vueActive === 'nouvelle' ? 'Ajouter une pharmacie' : (liens.find((l) => l.vue === vueActive)?.label ?? 'Relève');
  useEffect(() => {
    document.title = `${titrePage} · Relève`;
  }, [titrePage]);

  useEffect(() => {
    if (!menu) return;
    const fermer = (e: MouseEvent | KeyboardEvent): void => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', fermer);
    document.addEventListener('keydown', fermer);
    return () => {
      document.removeEventListener('mousedown', fermer);
      document.removeEventListener('keydown', fermer);
    };
  }, [menu]);

  if (aCreer) return <Accueil />;
  if (!moi) return <Connexion />;
  if (vueActive === 'nouvelle' && estResponsable(data, moi)) return <Accueil ajout={moi} onAnnuler={() => aller('tableau')} />;

  const heure = new Date(sauvegarde);
  const groupes = [...new Set(liens.map((l) => l.groupe))];

  return (
    <div className="app">
      <a className="skip" href="#contenu">
        Aller au contenu
      </a>
      <nav className="side" aria-label="Navigation principale">
        <div className="brand">
          <span className="brand-mark">
            <Logo />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="brand-name">Relève</div>
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
                  {(n.vue === 'resoudre' && aDecider) || (n.vue === 'messages' && nonLus) ? (
                    <span className="nav-badge">
                      {n.vue === 'resoudre' ? aDecider : nonLus}
                      <span className="sr">{n.vue === 'resoudre' ? ' décisions en attente' : ' messages non lus'}</span>
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
            {espace === 'responsable' ? (
              <button
                type="button"
                className="btn ghost sm"
                data-tour="aide"
                onClick={() => {
                  aller('tableau');
                  setTour(0);
                }}
              >
                <CircleHelp size={16} aria-hidden="true" /> Tutoriel
              </button>
            ) : null}
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
