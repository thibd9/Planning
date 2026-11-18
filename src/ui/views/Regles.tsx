import type { LucideIcon } from 'lucide-react';
import { BadgeCheck, BedDouble, BookOpenCheck, ChevronDown, Clock, FileWarning, Hourglass, Lock, MoonStar, SlidersHorizontal, Stethoscope, Users } from 'lucide-react';
import { useState } from 'react';
import { fmtDateCourt } from '../../domain/time';
import type { Regle, RegleFamille } from '../../domain/types';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';

/** Les règles sont rangées par question, dans l'ordre où on se les pose en construisant un planning. */
const QUESTIONS: { cle: RegleFamille; titre: string; phrase: string; icone: LucideIcon }[] = [
  { cle: 'duree', titre: 'Combien d’heures au maximum ?', phrase: 'Par jour, par semaine, et les pauses.', icone: Clock },
  { cle: 'repos', titre: 'Quel repos garantir ?', phrase: 'Entre deux journées, et chaque semaine.', icone: BedDouble },
  { cle: 'pharmacie', titre: 'Qui doit être présent ?', phrase: 'Un pharmacien, les bonnes compétences.', icone: Stethoscope },
  { cle: 'delai', titre: 'Combien de temps à l’avance prévenir ?', phrase: 'Avant de changer un planning ou de demander un remplacement.', icone: Hourglass },
  { cle: 'garde', titre: 'Et pour les gardes ?', phrase: 'Délais, repos après la garde, ce qui part en paie.', icone: MoonStar },
  { cle: 'equipe', titre: 'Les choix de votre officine', phrase: 'Vos propres seuils, pour protéger l’équipe.', icone: Users },
];
type Filtre = 'tout' | 'obligatoire' | 'reglable' | 'expert';
const garde = (r: Regle, f: Filtre): boolean => f === 'tout' || (f === 'obligatoire' && r.nature === 'imperative') || (f === 'reglable' && (r.nature === 'alerte' || r.valeur !== undefined)) || (f === 'expert' && r.verification === 'a_valider');

export function Regles(): JSX.Element {
  const regles = useStore((s) => s.data.regles);
  const [filtre, setFiltre] = useState<Filtre>('tout');
  const obligatoires = regles.filter((r) => r.nature === 'imperative').length;
  const aValider = regles.filter((r) => r.verification === 'a_valider').length;
  const filtres: { cle: Filtre; nom: string; n: number }[] = [
    { cle: 'tout', nom: 'Toutes', n: regles.length },
    { cle: 'obligatoire', nom: 'Obligatoires', n: obligatoires },
    { cle: 'reglable', nom: 'Réglables', n: regles.filter((r) => garde(r, 'reglable')).length },
    { cle: 'expert', nom: 'À faire valider', n: aValider },
  ];
  return (
    <div style={{ maxWidth: 1040 }}>
      <div className="page-head">
        <span className="page-ico" aria-hidden="true">
          <BookOpenCheck size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Règles</div>
          <h1>Ce que Solvéa vérifie pour vous</h1>
          <p>Rangées par question. Ouvrez une règle pour lire le détail ou régler son seuil.</p>
        </div>
      </div>
      <div className="rg-legende">
        <span>
          <i className="rg-etat obligatoire"><Lock size={13} aria-hidden="true" /></i>
          <b>Obligatoire</b> : le planning ne peut pas l’enfreindre.
        </span>
        <span>
          <i className="rg-etat alerte"><SlidersHorizontal size={13} aria-hidden="true" /></i>
          <b>Alerte</b> : Solvéa vous prévient, vous décidez.
        </span>
      </div>
      <div className="jr-barre">
        <div className="jr-filtres" role="group" aria-label="Filtrer les règles">
          {filtres.map((f) => (
            <button key={f.cle} type="button" className={`jr-filtre${filtre === f.cle ? ' on' : ''}`} aria-pressed={filtre === f.cle} onClick={() => setFiltre(f.cle)}>
              {f.nom} <span className="rg-nb num">{f.n}</span>
            </button>
          ))}
        </div>
      </div>
      {QUESTIONS.map((q) => {
        const liste = regles.filter((r) => r.famille === q.cle && garde(r, filtre));
        if (!liste.length) return null;
        return (
          <section key={q.cle} className="rg-groupe" aria-label={q.titre}>
            <div className="rg-tete">
              <span className="rg-pic" aria-hidden="true">
                <q.icone size={20} />
              </span>
              <div>
                <h2>{q.titre}</h2>
                <p>{q.phrase}</p>
              </div>
            </div>
            <div className="card rg-liste">
              {liste.map((r) => (
                <Fiche key={r.id} regle={r} />
              ))}
            </div>
          </section>
        );
      })}
      <div className="notice warn rg-avis">
        <FileWarning size={18} aria-hidden="true" />
        <div>
          <b>Une aide, pas une garantie.</b> {aValider} règle{aValider > 1 ? 's' : ''} sur {regles.length} {aValider > 1 ? 'sont' : 'est'} à faire valider par un avocat en droit social ou un expert-comptable : {aValider > 1 ? 'elles portent' : 'elle porte'} la mention « à faire valider ».
        </div>
      </div>
    </div>
  );
}

/** Une règle tient en une ligne : son nom, son seuil, son état. Le reste se déplie. */
function Fiche({ regle }: { regle: Regle }): JSX.Element {
  const maj = useStore((s) => s.majRegle);
  const dire = useUi((s) => s.dire);
  const [valeur, setValeur] = useState(String(regle.valeur ?? ''));
  const change = regle.valeur !== undefined && Number(valeur) !== regle.valeur && valeur !== '' && !Number.isNaN(Number(valeur));
  const imperative = regle.nature === 'imperative';
  return (
    <details className={`rg${regle.active ? '' : ' off'}`}>
      <summary>
        <span className={`rg-etat ${imperative ? 'obligatoire' : 'alerte'}`} aria-hidden="true">
          {imperative ? <Lock size={13} /> : <SlidersHorizontal size={13} />}
        </span>
        <span className="rg-titre">
          {regle.titre}
          <span className="sr">, {imperative ? 'obligatoire' : regle.active ? 'alerte active' : 'alerte désactivée'}</span>
        </span>
        {regle.valeur !== undefined ? (
          <span className="rg-valeur num">
            {regle.valeur} {regle.unite}
          </span>
        ) : null}
        {!regle.active ? <span className="rg-note">Désactivée</span> : regle.verification === 'a_valider' ? <span className="rg-note expert">À faire valider</span> : null}
        <ChevronDown size={18} className="rg-chevron" aria-hidden="true" />
      </summary>
      <div className="rg-corps">
        <p>{regle.description}</p>
        <div className="rg-reglages">
          {regle.valeur !== undefined ? (
            <label className="rg-seuil">
              <span>Seuil</span>
              <input type="number" value={valeur} step="any" onChange={(e) => setValeur(e.target.value)} className="num" aria-label={`Seuil de la règle ${regle.titre}`} />
              <span className="small soft">{regle.unite}</span>
            </label>
          ) : null}
          {change ? (
            <button
              type="button"
              className="btn sm primary"
              onClick={() => {
                maj(regle.id, { valeur: Number(valeur) });
                dire('Nouveau seuil enregistré, et noté au journal.', true);
              }}
            >
              Enregistrer
            </button>
          ) : null}
          {imperative ? (
            <span className="rg-fixe">
              <Lock size={13} aria-hidden="true" /> Toujours active
            </span>
          ) : (
            <label className="check">
              <input
                type="checkbox"
                checked={regle.active}
                onChange={(e) => {
                  maj(regle.id, { active: e.target.checked });
                  dire(e.target.checked ? 'Alerte réactivée.' : 'Alerte désactivée.', true);
                }}
              />
              Me prévenir
            </label>
          )}
        </div>
        <p className="rg-source">
          {regle.verification === 'verifie' ? (
            <span className="rg-lu">
              <BadgeCheck size={13} aria-hidden="true" /> Lue sur le texte
            </span>
          ) : null}
          {regle.source} · depuis le {fmtDateCourt(regle.dateEffet)} · version {regle.version}
        </p>
      </div>
    </details>
  );
}
