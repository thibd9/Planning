import type { LucideIcon } from 'lucide-react';
import { ArrowRight, BookA, CalendarCog, CalendarDays, ChartNoAxesColumn, GraduationCap, Layers, LifeBuoy, ListChecks, MessageSquareMore, Play, Rocket, Search, Star, UsersRound, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Espace } from '../../domain/acces';
import { estCollaboratif } from '../../engine/souhaits';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import type { Fiche } from '../bot';
import { fichesPour, simple } from '../bot';
import { LEXIQUE } from '../lexique';
import { ChoixRythme, lancerTutoriel, tutorielDe } from '../Parcours';
import { Onglets } from '../components/Onglets';
import { BlocSupport, ContactsSupport } from '../components/Support';
import { NomSolvi, Solvi } from '../Solvi';

/** Un identifiant d'onglet à partir du titre d'un thème. */
const cleDe = (titre: string): string => titre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Les fiches rangées par thème, dans l'ordre du travail. */
const THEMES: { titre: string; icone: LucideIcon; ids: string[] }[] = [
  { titre: 'Mon planning', icone: CalendarDays, ids: ['accueil', 'prochain', 'equipe-planning', 'gardes-moi', 'suivi', 'imprimer'] },
  { titre: 'Mes demandes', icone: Star, ids: ['difference', 'souhaits', 'conge', 'remplacer', 'retard-prevenir', 'aider'] },
  { titre: 'Au quotidien', icone: Layers, ids: ['tableau', 'semaine-vide', 'creer', 'signaler', 'echeance', 'repercussion'] },
  { titre: 'Préparer', icone: CalendarCog, ids: ['personne', 'contrat', 'marques', 'mdp-equipe', 'reglages', 'qui-prepare', 'postes-types', 'officine-chiffres', 'dimensionnement', 'feries', 'regles', 'pharmacie'] },
  { titre: 'Construire et publier', icone: Rocket, ids: ['construire', 'repos', 'remise-a-zero', 'propositions', 'pauses', 'controles', 'preferences-equipe', 'mois', 'retard', 'publier', 'formation', 'gardes'] },
  { titre: 'Absences et remplacements', icone: UsersRound, ids: ['absence', 'accident', 'demande-remplacement', 'dernier-recours', 'demandes-equipe', 'accord', 'decisions'] },
  { titre: 'Suivre et faire le bilan', icone: ChartNoAxesColumn, ids: ['heures', 'equite', 'points-forts', 'paie', 'historique', 'documents'] },
  { titre: 'Messages et support', icone: MessageSquareMore, ids: ['message', 'rendez-vous', 'compte', 'mes-competences', 'support'] },
];


/** Aide : toutes les fonctions répertoriées, une recherche, un tutoriel pour chaque tâche et le lexique. */
export function Aide({ espace }: { espace: Espace }): JSX.Element {
  const collaboratif = useStore((s) => estCollaboratif(s.data.officine));
  const ui = useUi();
  const [recherche, setRecherche] = useState('');
  const [onglet, setOnglet] = useState<'taches' | 'lexique'>('taches');
  const fiches = useMemo(() => fichesPour(espace, collaboratif), [espace, collaboratif]);
  const mots = simple(recherche).split(/\s+/).filter((m) => m.length > 1);
  const trouve = (texte: string): boolean => mots.every((m) => simple(texte).includes(m));
  const fichesVues = fiches.filter((f) => trouve(`${f.question} ${f.reponse} ${f.mots}`));
  const termes = LEXIQUE.filter((t) => (espace === 'responsable' || !t.gestion) && trouve(`${t.mot} ${t.sens}`));
  // Le titulaire lit d'abord la gestion ; ses propres horaires viennent ensuite.
  const themes = espace === 'responsable' ? [...THEMES.slice(2), ...THEMES.slice(0, 2)] : [...THEMES.slice(0, 2), ...THEMES.slice(2)];
  const groupes = themes.map((t) => ({ titre: t.titre, icone: t.icone, fiches: t.ids.map((id) => fichesVues.find((f) => f.id === id)).filter((f): f is Fiche => !!f) }))
    .concat([{ titre: 'Autres', icone: ListChecks, fiches: fichesVues.filter((f) => !THEMES.some((t) => t.ids.includes(f.id))) }])
    .filter((g) => g.fiches.length);
  // Une recherche qui ne trouve que dans l'autre onglet y mène toute seule.
  const vu = mots.length && onglet === 'taches' && !fichesVues.length && termes.length ? 'lexique' : mots.length && onglet === 'lexique' && !termes.length && fichesVues.length ? 'taches' : onglet;

  /** Un thème et ses fiches. */
  const theme = (g: { titre: string; fiches: Fiche[] }): JSX.Element => (
    <section key={g.titre} className="ad-groupe">
      <h2 className="ad-theme">{g.titre}</h2>
      <ul className="ad-fiches">
        {g.fiches.map((f) => {
          const tuto = tutorielDe(f.id, espace);
          const n = tuto ? tuto.a - tuto.de + 1 : 0;
          return (
            <li key={f.id} className="ad-fiche" data-fiche={f.id}>
              <h3 id={`ad-q-${f.id}`}>{f.question}</h3>
              <p>{f.reponse}</p>
              <div className="ad-actions">
                {tuto ? (
                  <button type="button" className="btn sm primary" onClick={() => lancerTutoriel(tuto)} aria-describedby={`ad-q-${f.id}`}>
                    <Play size={14} aria-hidden="true" /> Voir le tutoriel
                    <span className="ad-duree">{n > 1 ? `${n} étapes` : '1 étape'}</span>
                  </button>
                ) : null}
                <button type="button" className="btn sm" onClick={() => f.aller(ui, espace)} aria-describedby={`ad-q-${f.id}`}>
                  {f.bouton} <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );

  return (
    <div className="page page-aide">
      <div className="page-head">
        <span className="page-ico" aria-hidden="true">
          <LifeBuoy size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Aide</div>
          <h1>
            Comment <span className="hl">faire</span> ?
          </h1>
          <p>Cherchez une tâche : la réponse en deux lignes, le bouton qui y mène et un tutoriel qui vous la montre.</p>
        </div>
      </div>

      <div className="ad-recherche">
        <Search size={19} aria-hidden="true" />
        <input id="aide-recherche" type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Exemple : publier, congé, garde, heures…" aria-label="Chercher dans l’aide" autoComplete="off" />
        {recherche ? (
          <button type="button" className="btn ghost icon sm" onClick={() => setRecherche('')} aria-label="Effacer la recherche">
            <X size={16} />
          </button>
        ) : null}
      </div>

      {/* Le rythme des tutoriels se choisit ici, avant d'en lancer un. */}
      <ChoixRythme />
      <div className="jr-barre">
        <div className="jr-filtres" role="tablist" aria-label="Aide">
          <button type="button" role="tab" aria-selected={vu === 'taches'} className={`jr-filtre${vu === 'taches' ? ' on' : ''}`} onClick={() => setOnglet('taches')}>
            <span aria-hidden="true"><ListChecks size={15} /></span> Comment faire <span className="rg-nb num">{fichesVues.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={vu === 'lexique'} className={`jr-filtre${vu === 'lexique' ? ' on' : ''}`} onClick={() => setOnglet('lexique')}>
            <span aria-hidden="true"><BookA size={15} /></span> Lexique <span className="rg-nb num">{termes.length}</span>
          </button>
        </div>
      </div>

      {vu === 'taches' ? (
        groupes.length ? (
          mots.length ? (
            groupes.map((g) => theme(g))
          ) : (
            // Sans recherche, un onglet par thème : on ne lit qu'une famille de fiches à la fois.
            <Onglets id="aide-themes" label="Thèmes de l’aide" onglets={groupes.map((g) => ({ cle: cleDe(g.titre), titre: g.titre, icone: g.icone, note: g.fiches.length, contenu: theme(g) }))} />
          )
        ) : (
          <div className="card empty ad-vide" id="ad-vide">
            <Solvi size={72} humeur="intrigue" vivant />
            <span>
              <b>Rien ne correspond à « {recherche} ».</b> Essayez un autre mot, demandez à Solvi, ou appelez le support.
            </span>
            <span className="ad-vide-actions">
              <button type="button" className="btn sm" onClick={() => ui.ouvrirAssistant(true)}>
                Demander à Solvi
              </button>
              <ContactsSupport petit />
            </span>
          </div>
        )
      ) : termes.length ? (
        <dl className="card lex">
          {termes.map((t) => (
            <div key={t.mot} className="lex-terme">
              <dt>{t.mot}</dt>
              <dd>{t.sens}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="card empty ad-vide" id="lex-vide">
          <Solvi size={72} humeur="intrigue" vivant />
          <span>
            <b>Aucun terme ne correspond à « {recherche} ».</b> Le support vous l’expliquera.
          </span>
          <span className="ad-vide-actions">
            <ContactsSupport petit />
          </span>
        </div>
      )}

      <div className="ad-pied">
        <button type="button" className="ad-autre" onClick={() => ui.ouvrirTutoriels(true)}>
          <span className="ad-autre-pic" aria-hidden="true">
            <GraduationCap size={20} />
          </span>
          <span className="grow">
            <b>La visite guidée complète</b>
            <span className="small soft">Toutes les fonctions, dans l’ordre du menu, sur une pharmacie d’exemple.</span>
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        <button type="button" className="ad-autre" onClick={() => ui.ouvrirAssistant(true)}>
          <span className="ad-autre-pic solvi-case" aria-hidden="true">
            <Solvi size={34} calme humeur="heureux" />
          </span>
          <span className="grow">
            <b>
              Demander à <NomSolvi />
            </b>
            <span className="small soft">Posez votre question avec vos mots : il répond d’après votre planning.</span>
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
      <BlocSupport />
    </div>
  );
}
