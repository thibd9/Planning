import { BatteryWarning, CircleCheck, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { addDays, fmtDateCourt, fmtDecimal, fmtSemaine, mondayOf } from '../../domain/time';
import type { Person } from '../../domain/types';
import { QUALIFICATION_COURT, nomCourt } from '../../domain/types';
import type { CompteurCle, LigneEquite } from '../../engine/equity';
import { COMPTEUR_CLES, COMPTEUR_LABEL, ecartEquite, equite, fatigue } from '../../engine/equity';
import { useStore } from '../../store/store';
import { Avatar, Seg } from '../kit';

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

/** Une question par compteur : on en regarde un à la fois. */
const QUESTIONS: Record<CompteurCle, string> = {
  samedis: 'Qui travaille le samedi ?',
  fermetures: 'Qui ferme le soir ?',
  gardes: 'Qui assure les gardes ?',
  depannages: 'Qui dépanne au pied levé ?',
  changementsTardifs: 'Qui absorbe les changements tardifs ?',
  souhaitsRefuses: 'À qui a-t-on refusé une demande ?',
};
/** En dessous d'une demi-unité d'écart, on considère la personne à l'équilibre. */
const SEUIL = 0.5;

export function Equite(): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const [semaines, setSemaines] = useState<'8' | '12' | '26'>('8');
  const [cle, setCle] = useState<CompteurCle>('samedis');
  const lundi = mondayOf(today);
  const from = addDays(lundi, -7 * Number(semaines));
  const to = addDays(lundi, 6);
  const lignes = useMemo(() => equite(data, from, to), [data, from, to]);
  const personne = (id: string): Person | undefined => data.personnes.find((x) => x.id === id);
  const ecart = (l: LigneEquite, c: CompteurCle): number | null => (l.attendu[c] === null ? null : l.reel[c] - (l.attendu[c] as number));
  // Vue d'ensemble : sur l'ensemble des compteurs, qui a porté nettement plus ou nettement moins que sa part.
  const bilan = lignes.map((l) => {
    const e = COMPTEUR_CLES.filter((c) => c !== 'souhaitsRefuses').map((c) => ecart(l, c)).filter((x): x is number => x !== null);
    const somme = e.reduce((t, x) => t + x, 0);
    return { id: l.personId, somme };
  });
  const plus = bilan.filter((b) => b.somme >= 1);
  const moins = bilan.filter((b) => b.somme <= -1);
  const equilibre = bilan.length - plus.length - moins.length;
  const noms = (l: { id: string }[]): string => l.map((b) => personne(b.id)?.prenom ?? '').filter(Boolean).join(', ');
  // Le compteur choisi : du plus chargé au moins chargé, les non concernés à part.
  const concernes = lignes.filter((l) => ecart(l, cle) !== null).sort((a, b) => (ecart(b, cle) as number) - (ecart(a, cle) as number));
  const horsChamp = lignes.filter((l) => ecart(l, cle) === null);
  const max = Math.max(1, ...concernes.map((l) => Math.abs(ecart(l, cle) as number)));
  const fatigues = lignes
    .map((l) => ({ p: personne(l.personId), f: fatigue(data, l.personId, lundi) }))
    .filter((x) => x.p && x.f.niveau !== 'faible');

  return (
    <div style={{ maxWidth: 1040 }}>
      <div className="page-head">
        <span className="page-ico" aria-hidden="true">
          <Scale size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Équité</div>
          <h1>
            La charge est-elle <span className="hl">bien répartie</span> ?
          </h1>
          <p>Chacun est comparé à sa part, selon son temps de travail. Jamais de note globale.</p>
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

      <div className="chiffres">
        <div className="chiffre">
          <span className="chiffre-pic ok" aria-hidden="true"><CircleCheck size={18} /></span>
          <b className="num">{equilibre}</b>
          <span>à l’équilibre</span>
        </div>
        <div className="chiffre">
          <span className={`chiffre-pic${plus.length ? ' warn' : ''}`} aria-hidden="true"><TrendingUp size={18} /></span>
          <b className="num">{plus.length}</b>
          <span>{plus.length ? `ont porté plus : ${noms(plus)}` : 'personne n’a porté nettement plus'}</span>
        </div>
        <div className="chiffre">
          <span className={`chiffre-pic${moins.length ? ' info' : ''}`} aria-hidden="true"><TrendingDown size={18} /></span>
          <b className="num">{moins.length}</b>
          <span>{moins.length ? `ont porté moins : ${noms(moins)}` : 'personne n’a porté nettement moins'}</span>
        </div>
      </div>

      <div className="jr-barre">
        <div className="jr-filtres" role="group" aria-label="Choisir ce qu’on compare">
          {COMPTEUR_CLES.map((c) => (
            <button key={c} type="button" className={`jr-filtre${cle === c ? ' on' : ''}`} aria-pressed={cle === c} onClick={() => setCle(c)}>
              {COMPTEUR_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      <section className="card" aria-label={QUESTIONS[cle]}>
        <div className="card-head">
          <div className="grow">
            <h2 className="h3">{QUESTIONS[cle]}</h2>
            <div className="small soft">
              Du {fmtDateCourt(from)} au {fmtDateCourt(to)}. La barre part du centre : à droite, plus que sa part ; à gauche, moins.
            </div>
          </div>
        </div>
        <ul className="eq-liste">
          {concernes.map((l) => {
            const p = personne(l.personId);
            if (!p) return null;
            const e = ecart(l, cle) as number;
            const etat = Math.abs(e) < SEUIL ? 'e-egal' : e > 0 ? 'e-plus' : 'e-moins';
            const w = Math.min(50, (Math.abs(e) / max) * 50);
            return (
              <li key={p.id} className={`eq-ligne ${etat}`}>
                <Avatar person={p} />
                <span className="eq-qui">
                  <b>{nomCourt(p)}</b>
                  <span className="small soft">
                    {QUALIFICATION_COURT[p.qualification]} · {p.heuresHebdo} h
                  </span>
                </span>
                <span className="eq-fait num">
                  <b>{l.reel[cle]}</b>
                  <span className="small soft"> pour {fmtDecimal(l.attendu[cle] as number, 1)} attendu</span>
                </span>
                <span className="eq-barre" aria-hidden="true">
                  <i style={e >= 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }} />
                </span>
                <span className="eq-mot">{etat === 'e-egal' ? 'À l’équilibre' : `${fmtDecimal(Math.abs(e), 1)} de ${e > 0 ? 'plus' : 'moins'}`}</span>
              </li>
            );
          })}
        </ul>
        {!concernes.length ? <div className="empty">Personne n’est concerné sur cette période.</div> : null}
        {horsChamp.length ? (
          <p className="eq-hors small soft">
            Non concernés : {horsChamp.map((l) => personne(l.personId)?.prenom).filter(Boolean).join(', ')}.
          </p>
        ) : null}
      </section>

      <section className="card pad eq-fatigue" aria-label="Fatigue cette semaine">
        <div className="row" style={{ gap: 12 }}>
          <span className={`chiffre-pic${fatigues.length ? ' warn' : ' ok'}`} aria-hidden="true">
            <BatteryWarning size={18} />
          </span>
          <div className="grow">
            <h2 className="h3">Fatigue, semaine du {fmtSemaine(lundi)}</h2>
            <div className="small soft">{fatigues.length ? 'À ménager dans le prochain planning.' : 'Personne n’est en fatigue modérée ou élevée.'}</div>
          </div>
        </div>
        {fatigues.map(({ p, f }) =>
          p ? (
            <div key={p.id} className="eq-fatigue-ligne">
              <Avatar person={p} />
              <b>{nomCourt(p)}</b>
              <span className={`pill ${f.niveau === 'élevée' ? 'danger' : 'warn'}`}>{f.niveau}</span>
              <span className="small soft grow">{f.facteurs.map((x) => x.label).join(' · ')}</span>
            </div>
          ) : null,
        )}
      </section>

      <details className="eq-plus">
        <summary>Comment c’est calculé</summary>
        <p>
          La part attendue de chacun tient compte de son temps de travail et des semaines réellement travaillées : un temps partiel n’est pas comparé à un temps plein, et une indisponibilité reconnue n’est jamais comptée contre la personne.
          Dispersion des samedis : <b className="num">{fmtDecimal(ecartEquite(lignes, 'samedis'), 2)}</b> ; des fermetures : <b className="num">{fmtDecimal(ecartEquite(lignes, 'fermetures'), 2)}</b> (plus c’est bas, plus c’est équilibré).
        </p>
      </details>
    </div>
  );
}
