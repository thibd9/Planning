import { Info, Scale } from 'lucide-react';
import { useMemo, useState } from 'react';
import { addDays, fmtDateCourt, fmtDecimal, fmtSemaine, mondayOf } from '../../domain/time';
import { QUALIFICATION_COURT, nomCourt } from '../../domain/types';
import type { CompteurCle, LigneEquite } from '../../engine/equity';
import { COMPTEUR_CLES, COMPTEUR_LABEL, ecartEquite, equite, fatigue } from '../../engine/equity';
import { useStore } from '../../store/store';
import { Avatar, Pill, Seg } from '../kit';

/** Barre d'écart centrée : à droite, la personne a fait plus que sa part attendue ; à gauche, moins. */
export function Ecart({ ligne, cle, max }: { ligne: LigneEquite; cle: CompteurCle; max: number }): JSX.Element {
  const attendu = ligne.attendu[cle];
  const reel = ligne.reel[cle];
  if (attendu === null) {
    return (
      <span className="eq-cell num">
        <b>{reel}</b>
        {cle === 'gardes' || cle === 'samedis' ? <span className="muted small">non concerné</span> : null}
      </span>
    );
  }
  const e = reel - attendu;
  const w = Math.min(50, (Math.abs(e) / Math.max(1, max)) * 50);
  return (
    <span className="eq-cell num" title={`Réalisé : ${reel} · part attendue au prorata : ${fmtDecimal(attendu, 1)}`}>
      <b style={{ minWidth: 18 }}>{reel}</b>
      <span className="div-bar" aria-hidden="true">
        <i className={e >= 0 ? 'plus' : 'minus'} style={e >= 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }} />
      </span>
      <span className="small muted">
        {Math.abs(e) < 0.25 ? 'à l’équilibre' : `${e > 0 ? '+' : '−'} ${fmtDecimal(Math.abs(e), 1)}`}
      </span>
    </span>
  );
}

export function Equite(): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const [semaines, setSemaines] = useState<'8' | '12' | '26'>('8');
  const lundi = mondayOf(today);
  const from = addDays(lundi, -7 * Number(semaines));
  const to = addDays(lundi, 6);
  const lignes = useMemo(() => equite(data, from, to), [data, from, to]);
  const max = (cle: CompteurCle): number => Math.max(1, ...lignes.filter((l) => l.attendu[cle] !== null).map((l) => Math.abs(l.reel[cle] - (l.attendu[cle] as number))));

  return (
    <div>
      <div className="page-head">
        <span className="page-ico" aria-hidden="true">
          <Scale size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Équité</div>
          <h1>Qui a porté quoi</h1>
          <p>
            Plusieurs compteurs lisibles, jamais une note globale. Chaque personne est comparée à sa part attendue, calculée au prorata de son temps de travail et des semaines réellement travaillées.
          </p>
        </div>
        <Seg
          label="Période"
          value={semaines}
          onChange={setSemaines}
          options={[
            { value: '8', label: '8 semaines' },
            { value: '12', label: '12 semaines' },
            { value: '26', label: '6 mois' },
          ]}
        />
      </div>

      <div className="card" style={{ overflowX: 'auto' }} tabIndex={0} role="region" aria-label="Compteurs d’équité, tableau défilant">
        <table className="t" aria-label="Compteurs d’équité par personne" style={{ minWidth: 980 }}>
          <thead>
            <tr>
              <th scope="col">Du {fmtDateCourt(from)} au {fmtDateCourt(to)}</th>
              {COMPTEUR_CLES.map((c) => (
                <th scope="col" key={c}>{COMPTEUR_LABEL[c]}</th>
              ))}
              <th scope="col">Fatigue · semaine en cours</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const p = data.personnes.find((x) => x.id === l.personId);
              if (!p) return null;
              const f = fatigue(data, p.id, lundi);
              return (
                <tr key={p.id}>
                  <td>
                    <div className="row">
                      <Avatar person={p} />
                      <div>
                        <b>{nomCourt(p)}</b>
                        <div className="small soft">
                          {QUALIFICATION_COURT[p.qualification]} · {p.heuresHebdo} h
                        </div>
                      </div>
                    </div>
                  </td>
                  {COMPTEUR_CLES.map((c) => (
                    <td key={c}>
                      <Ecart ligne={l} cle={c} max={max(c)} />
                    </td>
                  ))}
                  <td>
                    <Pill tone={f.niveau === 'élevée' ? 'danger' : f.niveau === 'modérée' ? 'warn' : 'ok'}>{f.niveau}</Pill>
                    {f.facteurs.length ? <div className="tiny muted" style={{ marginTop: 3, maxWidth: 220 }}>{f.facteurs.map((x) => x.label).join(' · ')}</div> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="row wrap" style={{ marginTop: 14, gap: 14 }}>
        <div className="card pad grow" style={{ minWidth: 280 }}>
          <div className="eyebrow">Dispersion des samedis</div>
          <div className="row" style={{ alignItems: 'baseline', marginTop: 4 }}>
            <b className="num" style={{ fontSize: 26, letterSpacing: '-0.03em' }}>{fmtDecimal(ecartEquite(lignes, 'samedis'), 2)}</b>
            <span className="soft small">écart type entre réalisé et part attendue</span>
          </div>
        </div>
        <div className="card pad grow" style={{ minWidth: 280 }}>
          <div className="eyebrow">Dispersion des fermetures</div>
          <div className="row" style={{ alignItems: 'baseline', marginTop: 4 }}>
            <b className="num" style={{ fontSize: 26, letterSpacing: '-0.03em' }}>{fmtDecimal(ecartEquite(lignes, 'fermetures'), 2)}</b>
            <span className="soft small">plus c'est bas, plus c'est équilibré</span>
          </div>
        </div>
      </div>

      <div className="notice info" style={{ marginTop: 14 }}>
        <Info size={16} />
        <div>
          <b>Comment lire ce tableau.</b> La barre part du centre : à droite (orange), la personne a fait plus que sa part ; à gauche (bleu), moins. Un temps partiel n'est pas comparé à un temps plein. Une indisponibilité reconnue sur tous les samedis retire la personne du partage des samedis, sans pénalité. Aucun classement n'est montré à l'équipe : chacun ne voit que sa propre position, dans son espace. Période affichée : {fmtSemaine(from)} → {fmtSemaine(lundi)}.
        </div>
      </div>
    </div>
  );
}
