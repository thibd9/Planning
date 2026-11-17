import { BadgeCheck, BookOpenCheck, FileWarning, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { fmtDateCourt } from '../../domain/time';
import type { Regle, RegleFamille } from '../../domain/types';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Pill } from '../kit';

const FAMILLES: { cle: RegleFamille; titre: string }[] = [
  { cle: 'pharmacie', titre: 'Exercice de la pharmacie' },
  { cle: 'duree', titre: 'Durée du travail' },
  { cle: 'repos', titre: 'Repos' },
  { cle: 'garde', titre: 'Gardes et astreintes' },
  { cle: 'delai', titre: 'Délais de prévenance' },
  { cle: 'equipe', titre: 'Organisation de l’officine' },
];

export function Regles(): JSX.Element {
  const regles = useStore((s) => s.data.regles);
  const aValider = regles.filter((r) => r.verification === 'a_valider').length;
  return (
    <div style={{ maxWidth: 1040 }}>
      <div className="page-head">
        <span className="page-ico" aria-hidden="true">
          <BookOpenCheck size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Règles</div>
          <h1>Ce que le moteur contrôle, et d'où ça vient</h1>
          <p>Chaque règle est une fiche : source, date d'effet, version. Modifier une valeur crée une nouvelle version, inscrite au journal.</p>
        </div>
      </div>
      <div className="notice warn" style={{ marginBottom: 16 }}>
        <FileWarning size={18} />
        <div>
          <b>Aide à la conformité, pas une garantie.</b> {aValider} fiche{aValider > 1 ? 's' : ''} sur {regles.length} repose{aValider > 1 ? 'nt' : ''} sur une source secondaire et porte{aValider > 1 ? 'nt' : ''} la mention « à valider ». Faites-les relire par un avocat en droit social ou un spécialiste de la paie officinale avant de vous y fier. Les montants des indemnités de garde ne sont pas renseignés : ils sont à reprendre dans le barème de votre syndicat.
        </div>
      </div>
      {FAMILLES.map((f) => {
        const liste = regles.filter((r) => r.famille === f.cle);
        if (!liste.length) return null;
        return (
          <div key={f.cle} style={{ marginBottom: 18 }}>
            <h2 style={{ marginBottom: 10 }}>{f.titre}</h2>
            <div className="card">
              {liste.map((r) => (
                <Fiche key={r.id} regle={r} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Fiche({ regle }: { regle: Regle }): JSX.Element {
  const maj = useStore((s) => s.majRegle);
  const dire = useUi((s) => s.dire);
  const [valeur, setValeur] = useState(String(regle.valeur ?? ''));
  const change = regle.valeur !== undefined && Number(valeur) !== regle.valeur && valeur !== '' && !Number.isNaN(Number(valeur));
  return (
    <div className="rule">
      <div>
        <div className="row wrap" style={{ gap: 8 }}>
          <h3>{regle.titre}</h3>
          <Pill tone={regle.nature === 'imperative' ? 'danger' : 'warn'}>{regle.nature === 'imperative' ? 'Impérative' : 'Alerte'}</Pill>
          {regle.verification === 'verifie' ? (
            <Pill tone="ok">
              <BadgeCheck size={12} /> Lue sur le texte
            </Pill>
          ) : (
            <Pill tone="outline">À valider par un expert</Pill>
          )}
          {!regle.active ? <Pill>Désactivée</Pill> : null}
        </div>
        <p className="soft" style={{ marginTop: 5 }}>{regle.description}</p>
        <div className="src">
          Source : {regle.source} · en vigueur depuis le {fmtDateCourt(regle.dateEffet)} · version {regle.version}
        </div>
      </div>
      <div className="col" style={{ alignItems: 'flex-end', gap: 8, minWidth: 190 }}>
        {regle.valeur !== undefined ? (
          <label className="field" style={{ alignItems: 'flex-end' }}>
            <span className="sr">Valeur de la règle {regle.titre}</span>
            <div className="row" style={{ gap: 6 }}>
              <input type="number" value={valeur} step="any" onChange={(e) => setValeur(e.target.value)} style={{ width: 110, textAlign: 'right' }} className="num" />
              <span className="small soft" style={{ minWidth: 54 }}>{regle.unite}</span>
            </div>
          </label>
        ) : null}
        {change ? (
          <button
            type="button"
            className="btn sm primary"
            onClick={() => {
              maj(regle.id, { valeur: Number(valeur) });
              dire('Nouvelle version de la règle enregistrée au journal.', true);
            }}
          >
            Enregistrer la nouvelle version
          </button>
        ) : null}
        {regle.nature === 'alerte' ? (
          <label className="check small">
            <input
              type="checkbox"
              checked={regle.active}
              onChange={(e) => {
                maj(regle.id, { active: e.target.checked });
                dire(e.target.checked ? 'Alerte réactivée.' : 'Alerte désactivée.', true);
              }}
            />
            Alerte active
          </label>
        ) : (
          <span className="tiny muted row" style={{ gap: 5 }}>
            <ShieldCheck size={13} /> Ne peut pas être désactivée
          </span>
        )}
      </div>
    </div>
  );
}
