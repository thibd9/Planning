import { Plus, RotateCcw, Settings2, Store, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { JOURS, fmtDuree, fmtHHMM, parseHHMM, uid } from '../../domain/time';
import type { Interval, PosteType } from '../../domain/types';
import { minutesTravail } from '../../engine/core';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';

function Heure({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }): JSX.Element {
  return (
    <input
      type="time"
      step={900}
      className="input num"
      aria-label={label}
      value={fmtHHMM(value)}
      onChange={(e) => {
        const v = parseHHMM(e.target.value);
        if (v !== null) onChange(v);
      }}
      style={{ padding: '5px 7px', width: 124 }}
    />
  );
}

export function Officine(): JSX.Element {
  const officine = useStore((s) => s.data.officine);
  const { majOfficine, reinitialiser } = useStore();
  const [confirmation, setConfirmation] = useState(false);
  const dire = useUi((s) => s.dire);
  const setPoste = (id: string, patch: Partial<PosteType>): void => {
    majOfficine({ postes: officine.postes.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  };

  return (
    <div style={{ maxWidth: 1080 }}>
      <div className="page-head">
        <span className="page-ico c-gris" aria-hidden="true">
          <Settings2 size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Officine</div>
          <h1>{officine.nom || 'Mon officine'}</h1>
          <p>Horaires d'ouverture, effectif attendu et postes types. Ces réglages sont des choix d'organisation : ils se modifient librement.</p>
        </div>
      </div>

      <div className="card pad row wrap" style={{ marginBottom: 20, alignItems: 'flex-end' }}>
        <span className="ico grad" style={{ alignSelf: 'center' }}>
          <Store size={18} />
        </span>
        <label className="field grow" style={{ minWidth: 240 }}>
          Nom de la pharmacie
          <input id="officine-nom" value={officine.nom} onChange={(e) => majOfficine({ nom: e.target.value })} placeholder="Pharmacie du Marché" />
        </label>
      </div>

      <div className="split" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        <div className="card">
          <div className="card-head">
            <h2 className="h3">Horaires d'ouverture</h2>
          </div>
          <table className="t" aria-label="Horaires d’ouverture par jour">
            <tbody>
              {JOURS.map((j, i) => {
                const plages = officine.horaires[i];
                const setPlages = (p: Interval[]): void => majOfficine({ horaires: officine.horaires.map((h, k) => (k === i ? p : h)) });
                return (
                  <tr key={j}>
                    <th scope="row" style={{ textTransform: 'capitalize', fontWeight: 650, fontSize: 14.5, letterSpacing: 0, color: 'var(--ink)', borderBottom: '1px solid var(--line)' }}>
                      {j}
                    </th>
                    <td>
                      {plages.length ? (
                        <div className="col" style={{ gap: 6 }}>
                          {plages.map((h, k) => (
                            <div key={k} className="row" style={{ gap: 6 }}>
                              <Heure label={`${k === 0 ? 'Ouverture' : 'Réouverture'} le ${j}`} value={h.start} onChange={(v) => setPlages(plages.map((x, n) => (n === k ? { ...x, start: v } : x)))} />
                              <span className="muted" aria-hidden="true">→</span>
                              <Heure label={`${k === plages.length - 1 ? 'Fermeture' : 'Fermeture du midi'} le ${j}`} value={h.end} onChange={(v) => setPlages(plages.map((x, n) => (n === k ? { ...x, end: v } : x)))} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="muted">Fermé</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row wrap" style={{ justifyContent: 'flex-end', gap: 4 }}>
                        {plages.length === 1 && plages[0].end - plages[0].start > 240 ? (
                          <button
                            type="button"
                            className="btn sm ghost"
                            aria-label={`Coupure le midi : ${j}`}
                            onClick={() => setPlages([{ start: plages[0].start, end: Math.max(plages[0].start + 60, Math.min(750, plages[0].end - 120)) }, { start: Math.max(plages[0].start + 120, Math.min(840, plages[0].end - 60)), end: plages[0].end }])}
                          >
                            Coupure le midi
                          </button>
                        ) : null}
                        {plages.length === 2 ? (
                          <button type="button" className="btn sm ghost" aria-label={`Sans coupure : ${j}`} onClick={() => setPlages([{ start: plages[0].start, end: plages[1].end }])}>
                            Sans coupure
                          </button>
                        ) : null}
                        <button type="button" className="btn sm ghost" aria-label={plages.length ? `Fermer ce jour : ${j}` : `Ouvrir : ${j}`} onClick={() => setPlages(plages.length ? [] : [{ start: 9 * 60, end: 19 * 60 }])}>
                          {plages.length ? 'Fermer ce jour' : 'Ouvrir'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="card-body" style={{ borderTop: '1px solid var(--line)' }}>
            <label className="check">
              <input type="checkbox" checked={officine.fermeJoursFeries} onChange={(e) => majOfficine({ fermeJoursFeries: e.target.checked })} />
              Officine fermée les jours fériés (hors gardes)
            </label>
          </div>
        </div>

        <div className="col" style={{ gap: 18 }}>
          <div className="card">
            <div className="card-head">
              <h2 className="h3">Effectif attendu au comptoir</h2>
            </div>
            <table className="t">
              <thead>
                <tr>
                  <th scope="col">Jours</th>
                  <th scope="col">Tranche</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Minimum</th>
                </tr>
              </thead>
              <tbody>
                {officine.effectifs.map((e, i) => (
                  <tr key={i}>
                    <td style={{ textTransform: 'capitalize' }}>{e.jours.length === 5 && e.jours[0] === 0 ? 'Lundi à vendredi' : e.jours.map((j) => JOURS[j]).join(', ')}</td>
                    <td className="num">
                      {fmtHHMM(e.start)} → {fmtHHMM(e.end)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        min={0}
                        max={12}
                        className="input num"
                        aria-label="Effectif minimal"
                        value={e.minEquipe}
                        onChange={(ev) => majOfficine({ effectifs: officine.effectifs.map((x, k) => (k === i ? { ...x, minEquipe: Number(ev.target.value) } : x)) })}
                        style={{ width: 70, textAlign: 'right', padding: '5px 7px' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="card-body tiny muted" style={{ borderTop: '1px solid var(--line)' }}>
              La présence d'un pharmacien sur chaque minute d'ouverture est contrôlée à part : elle ne dépend pas de ces seuils.
            </div>
          </div>

          <div className="card pad col">
            <h2 className="h3">Paramètres</h2>
            <div className="row wrap" style={{ alignItems: 'flex-end' }}>
              <label className="field">
                Valeur du point conventionnel (€)
                <input type="number" step="0.001" min={0} placeholder="à saisir" value={officine.valeurPoint ?? ''} onChange={(e) => majOfficine({ valeurPoint: e.target.value === '' ? null : Number(e.target.value) })} style={{ width: 170 }} />
              </label>
              <label className="field">
                Souhaits prioritaires par personne
                <input type="number" min={0} max={6} value={officine.plafondPrioritaires} onChange={(e) => majOfficine({ plafondPrioritaires: Number(e.target.value) })} style={{ width: 170 }} />
              </label>
              <label className="field">
                Chiffre d'affaires annuel HT (€)
                <input type="number" step={10000} min={0} value={officine.caAnnuelHT ?? ''} onChange={(e) => majOfficine({ caAnnuelHT: e.target.value === '' ? null : Number(e.target.value) })} style={{ width: 190 }} />
              </label>
            </div>
            <p className="tiny muted">
              La valeur du point n'est pas préremplie : reprenez-la dans le barème en vigueur. Tant qu'elle est vide, les indemnités de sujétion sont exprimées en points.
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18, overflowX: 'auto' }}>
        <div className="card-head">
          <div className="grow">
            <h2 className="h3">Postes types</h2>
            <span className="small soft">Utilisés par les propositions de planning et la saisie rapide</span>
          </div>
          <button
            type="button"
            className="btn sm"
            onClick={() =>
              majOfficine({
                postes: officine.postes.concat({ id: uid('poste'), label: 'Nouveau poste', start: 9 * 60, end: 17 * 60, pauseStart: 12 * 60 + 30, pauseEnd: 13 * 60 + 30, jours: [0, 1, 2, 3, 4] }),
              })
            }
          >
            <Plus size={14} /> Ajouter un poste type
          </button>
        </div>
        <table className="t" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th scope="col">Poste</th>
              <th scope="col">Horaires</th>
              <th scope="col">Pause</th>
              <th scope="col">Jours</th>
              <th scope="col" style={{ textAlign: 'right' }}>Travail effectif</th>
              <td />
            </tr>
          </thead>
          <tbody>
            {officine.postes.map((p) => (
              <tr key={p.id}>
                <td>
                  <input className="input" aria-label="Nom du poste" value={p.label} onChange={(e) => setPoste(p.id, { label: e.target.value })} style={{ fontWeight: 650, width: 170, padding: '6px 9px' }} />
                </td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <Heure label={`Début du poste ${p.label}`} value={p.start} onChange={(v) => setPoste(p.id, { start: v })} />
                    <span className="muted">→</span>
                    <Heure label={`Fin du poste ${p.label}`} value={p.end} onChange={(v) => setPoste(p.id, { end: v })} />
                  </div>
                </td>
                <td>
                  {p.pauseStart !== undefined && p.pauseEnd !== undefined ? (
                    <div className="row" style={{ gap: 6 }}>
                      <Heure label={`Début de pause du poste ${p.label}`} value={p.pauseStart} onChange={(v) => setPoste(p.id, { pauseStart: v })} />
                      <span className="muted">→</span>
                      <Heure label={`Fin de pause du poste ${p.label}`} value={p.pauseEnd} onChange={(v) => setPoste(p.id, { pauseEnd: v })} />
                    </div>
                  ) : (
                    <span className="muted">Sans pause</span>
                  )}
                </td>
                <td className="small" style={{ textTransform: 'capitalize' }}>{p.jours.length === 5 && p.jours[0] === 0 ? 'Lundi à vendredi' : p.jours.map((j) => JOURS[j]).join(', ')}</td>
                <td className="num" style={{ textAlign: 'right' }}>{fmtDuree(minutesTravail(p))}</td>
                <td style={{ textAlign: 'right', width: 48 }}>
                  <button type="button" className="btn ghost icon" aria-label={`Retirer le poste ${p.label}`} onClick={() => majOfficine({ postes: officine.postes.filter((x) => x.id !== p.id) })}>
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card pad row wrap" style={{ marginTop: 18 }}>
        <div className="grow">
          <h2 className="h3">Repartir de zéro</h2>
          <p className="soft small" style={{ marginTop: 3 }}>
            Réinitialiser efface l’officine, l’équipe et les plannings enregistrés sur cet appareil, et ramène à l’écran de création.
          </p>
        </div>
        {confirmation ? (
          <div className="row wrap">
            <span className="small">Tout effacer et revenir à l’écran de création ?</span>
            <button type="button" className="btn" onClick={() => setConfirmation(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                reinitialiser();
                setConfirmation(false);
                dire('Application remise à zéro.');
              }}
            >
              <RotateCcw size={15} /> Oui, réinitialiser
            </button>
          </div>
        ) : (
          <button type="button" className="btn danger" onClick={() => setConfirmation(true)}>
            <RotateCcw size={15} /> Réinitialiser
          </button>
        )}
      </div>
    </div>
  );
}
