import { BookOpenCheck, CalendarRange, ListChecks, MoonStar, Scale, ScrollText, Settings2, Users, UserRound } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { fmtHeure } from './domain/time';
import { nomComplet } from './domain/types';
import { decisions } from './engine/decisions';
import { useStore } from './store/store';
import type { Vue } from './store/ui';
import { useUi } from './store/ui';
import { Logo } from './ui/kit';
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
  { vue: 'construire', label: 'Construire', question: 'Comment couvrir la semaine ?', icon: <CalendarRange size={18} />, groupe: 1 },
  { vue: 'gardes', label: 'Gardes', question: 'De la garde à la paie', icon: <MoonStar size={18} />, groupe: 1 },
  { vue: 'equipe', label: 'Équipe', question: 'Contrats, compétences, besoins', icon: <Users size={18} />, groupe: 2 },
  { vue: 'equite', label: 'Équité', question: 'Qui a fait quoi, au prorata', icon: <Scale size={18} />, groupe: 2 },
  { vue: 'regles', label: 'Règles', question: 'Sources et versions', icon: <BookOpenCheck size={18} />, groupe: 2 },
  { vue: 'journal', label: 'Journal et paie', question: 'Preuves et fiche navette', icon: <ScrollText size={18} />, groupe: 2 },
  { vue: 'officine', label: 'Officine', question: 'Horaires et postes types', icon: <Settings2 size={18} />, groupe: 2 },
];

export function App(): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const sauvegarde = useStore((s) => s.derniereSauvegarde);
  const undo = useStore((s) => s.undo);
  const { vue, aller, spectateur, setSpectateur, toast, taire } = useUi();
  const aDecider = useMemo(() => decisions(data, today).total, [data, today]);
  const salarie = spectateur !== 'responsable';

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(taire, 5200);
    return () => window.clearTimeout(t);
  }, [toast, taire]);

  const heure = new Date(sauvegarde);
  return (
    <div className="app">
      <nav className="side" aria-label="Navigation principale">
        <div className="brand">
          <span className="brand-mark">
            <Logo />
          </span>
          <div>
            <div className="brand-name">Relève</div>
            <div className="brand-sub">{data.officine.nom}</div>
          </div>
        </div>
        {salarie ? (
          <button type="button" className="nav-item on" aria-current="page">
            <UserRound size={18} />
            <span>
              Mon planning<span className="q">Quand est-ce que je travaille ?</span>
            </span>
          </button>
        ) : (
          <>
            <div className="nav-label">Au quotidien</div>
            {NAV.filter((n) => n.groupe === 1).map((n) => (
              <button key={n.vue} type="button" className={`nav-item${vue === n.vue ? ' on' : ''}`} onClick={() => aller(n.vue)} aria-current={vue === n.vue ? 'page' : undefined}>
                {n.icon}
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
            ))}
            <div className="nav-label">Référentiel</div>
            {NAV.filter((n) => n.groupe === 2).map((n) => (
              <button key={n.vue} type="button" className={`nav-item${vue === n.vue ? ' on' : ''}`} onClick={() => aller(n.vue)} aria-current={vue === n.vue ? 'page' : undefined}>
                {n.icon}
                <span>{n.label}</span>
              </button>
            ))}
          </>
        )}
        <div className="side-foot">
          Enregistré sur cet appareil
          <br />
          <b>Dernière sauvegarde à {fmtHeure(heure.getHours() * 60 + heure.getMinutes())}</b>
        </div>
      </nav>

      <div className="main">
        <header className="topbar no-print">
          <span className="small soft grow">
            {salarie ? 'Espace salarié : uniquement le planning publié, ses changements et ses propres demandes.' : 'Espace responsable'}
          </span>
          <label className="viewer">
            <span className="small soft">Voir en tant que</span>
            <select value={spectateur} onChange={(e) => setSpectateur(e.target.value)} aria-label="Changer d'espace">
              <option value="responsable">Responsable de l'officine</option>
              <optgroup label="Espace salarié">
                {data.personnes
                  .filter((p) => !p.externe)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {nomComplet(p)}
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>
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
