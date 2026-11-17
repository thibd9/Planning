import { BookOpenCheck, CalendarRange, CircleHelp, ListChecks, MoonStar, Scale, ScrollText, Settings2, UserRound, Users } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { fmtHeure } from './domain/time';
import { nomComplet } from './domain/types';
import { decisions } from './engine/decisions';
import { useStore } from './store/store';
import type { Vue } from './store/ui';
import { useUi } from './store/ui';
import { Logo } from './ui/kit';
import { Tour } from './ui/Tour';
import { Accueil } from './ui/views/Accueil';
import { Construire } from './ui/views/Construire';
import { Equipe } from './ui/views/Equipe';
import { Equite } from './ui/views/Equite';
import { Gardes } from './ui/views/Gardes';
import { Journal } from './ui/views/Journal';
import { MonPlanning } from './ui/views/MonPlanning';
import { Officine } from './ui/views/Officine';
import { Regles } from './ui/views/Regles';
import { Resoudre } from './ui/views/Resoudre';

const NAV: { vue: Vue; label: string; question: string; icon: JSX.Element; groupe: 1 | 2 }[] = [
  { vue: 'resoudre', label: 'Résoudre', question: 'À décider aujourd’hui', icon: <ListChecks size={18} />, groupe: 1 },
  { vue: 'construire', label: 'Construire', question: 'Le planning de la semaine', icon: <CalendarRange size={18} />, groupe: 1 },
  { vue: 'gardes', label: 'Gardes', question: 'De la garde à la paie', icon: <MoonStar size={18} />, groupe: 1 },
  { vue: 'equipe', label: 'Équipe', question: 'Contrats et besoins', icon: <Users size={18} />, groupe: 2 },
  { vue: 'equite', label: 'Équité', question: 'Qui a porté quoi', icon: <Scale size={18} />, groupe: 2 },
  { vue: 'regles', label: 'Règles', question: 'Sources et versions', icon: <BookOpenCheck size={18} />, groupe: 2 },
  { vue: 'journal', label: 'Journal et paie', question: 'Preuves, fiche navette', icon: <ScrollText size={18} />, groupe: 2 },
  { vue: 'officine', label: 'Officine', question: 'Horaires, postes types', icon: <Settings2 size={18} />, groupe: 2 },
];

export function App(): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const sauvegarde = useStore((s) => s.derniereSauvegarde);
  const undo = useStore((s) => s.undo);
  const { vue, aller, spectateur, setSpectateur, toast, taire, setTour } = useUi();
  const aDecider = useMemo(() => decisions(data, today).total, [data, today]);
  const salarie = spectateur !== 'responsable' && data.personnes.some((p) => p.id === spectateur);
  // Tant que ni le nom ni l'équipe ne sont saisis, l'application s'ouvre sur l'écran de création.
  const aCreer = !data.officine.nom.trim() && !data.personnes.length;

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(taire, 5200);
    return () => window.clearTimeout(t);
  }, [toast, taire]);

  if (aCreer) return <Accueil />;

  const heure = new Date(sauvegarde);
  const lien = (n: (typeof NAV)[number]): JSX.Element => (
    <button key={n.vue} type="button" data-tour={`nav-${n.vue}`} className={`nav-item${vue === n.vue ? ' on' : ''}`} onClick={() => aller(n.vue)} aria-current={vue === n.vue ? 'page' : undefined}>
      <span className="ni">{n.icon}</span>
      <span>
        {n.label}
        <span className="q">{n.question}</span>
      </span>
      {n.vue === 'resoudre' && aDecider ? (
        <span className="nav-badge" aria-label={`${aDecider} décisions en attente`}>
          {aDecider}
        </span>
      ) : null}
    </button>
  );

  return (
    <div className="app">
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
        {salarie ? (
          <button type="button" className="nav-item on" aria-current="page">
            <span className="ni">
              <UserRound size={18} />
            </span>
            <span>
              Mon planning<span className="q">Quand est-ce que je travaille ?</span>
            </span>
          </button>
        ) : (
          <>
            <div className="nav-label">Au quotidien</div>
            {NAV.filter((n) => n.groupe === 1).map(lien)}
            <div className="nav-label">Référentiel</div>
            {NAV.filter((n) => n.groupe === 2).map(lien)}
          </>
        )}
        <div className="side-foot">
          <i />
          <span>Enregistré sur cet appareil à {fmtHeure(heure.getHours() * 60 + heure.getMinutes())}</span>
        </div>
      </nav>

      <div className="main">
        <header className="topbar no-print">
          <div className="topbar-in">
            <span className="small soft grow">
              {salarie ? 'Espace salarié : le planning publié, ses changements et ses propres demandes.' : `Espace responsable · ${data.officine.nom || 'Mon officine'}`}
            </span>
            <button type="button" className="btn ghost sm" data-tour="aide" onClick={() => setTour(0)}>
              <CircleHelp size={16} /> Tutoriel
            </button>
            <label className="viewer" data-tour="viewer">
              <span className="small soft">Voir en tant que</span>
              <select value={salarie ? spectateur : 'responsable'} onChange={(e) => setSpectateur(e.target.value)} aria-label="Changer d'espace">
                <option value="responsable">Responsable</option>
                {data.personnes.some((p) => !p.externe) ? (
                  <optgroup label="Espace salarié">
                    {data.personnes
                      .filter((p) => !p.externe)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {nomComplet(p)}
                        </option>
                      ))}
                  </optgroup>
                ) : null}
              </select>
            </label>
          </div>
        </header>
        <main className="content" id="contenu">
          {salarie ? (
            <MonPlanning personId={spectateur} />
          ) : vue === 'construire' ? (
            <Construire />
          ) : vue === 'resoudre' ? (
            <Resoudre />
          ) : vue === 'gardes' ? (
            <Gardes />
          ) : vue === 'equipe' ? (
            <Equipe />
          ) : vue === 'equite' ? (
            <Equite />
          ) : vue === 'regles' ? (
            <Regles />
          ) : vue === 'journal' ? (
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
