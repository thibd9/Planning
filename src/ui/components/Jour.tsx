import { AlertTriangle, ChevronLeft, ChevronRight, CircleCheck, Clock3, Coffee, Moon, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { peutGerer } from '../../domain/acces';
import { addDays, fmtDateLong, fmtDuree, fmtHHMM, fmtHeure, mondayOf, parseHHMM } from '../../domain/time';
import type { EcartType, ISODate, Shift } from '../../domain/types';
import { ECART_LABEL, GARDE_LABEL, libelleAbsence, nomCourt } from '../../domain/types';
import { minutesTravail, ouverture, trousPharmacien } from '../../engine/core';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { EtiquetteRole } from '../icons';
import { Avatar, Dialog, Frise, Graduations, Pill } from '../kit';
import type { Echelle } from '../kit';

/**
 * Une journée, toute l'équipe : qui travaille, de quelle heure à quelle heure, quand tombe la pause.
 * Le responsable y règle les pauses déjeuner et y note un retard ; les autres la lisent, sur la version publiée.
 */
export function DialogueJour({ date: initiale, moi, onClose }: { date: ISODate; moi: string; onClose: () => void }): JSX.Element {
  const data = useStore((s) => s.data);
  const { saveShift, signalerEcart, retirerEcart } = useStore();
  const dire = useUi((s) => s.dire);
  const [date, setDate] = useState(initiale);
  const [ecartPour, setEcartPour] = useState<string | null>(null);
  const [ecartType, setEcartType] = useState<EcartType>('retard');
  const [ecartMinutes, setEcartMinutes] = useState(10);
  const gere = peutGerer(data, data.personnes.find((p) => p.id === moi));
  const semaine = data.semaines[mondayOf(date)];
  // Le responsable voit le planning de travail ; les autres, la version publiée seulement.
  const source: Shift[] = gere ? data.shifts : semaine?.statut === 'publie' ? (semaine.snapshot ?? []) : [];
  const absentes = data.absences.filter((a) => a.statut === 'approuvee' && a.from <= date && date <= a.to);
  const postes = source.filter((s) => s.date === date && !absentes.some((a) => a.personId === s.personId)).sort((a, b) => a.start - b.start);
  const plages = ouverture(data.officine, date);
  const echelle: Echelle = { start: Math.floor((Math.min(8 * 60, ...postes.map((s) => s.start), ...plages.map((p) => p.start)) - 30) / 60) * 60, end: Math.ceil((Math.max(20 * 60, ...postes.map((s) => s.end), ...plages.map((p) => p.end)) + 30) / 60) * 60 };
  const trous = gere && postes.length ? trousPharmacien(data, date) : [];
  const gardes = data.gardes.filter((g) => g.date === date && g.personId);
  const ecarts = (data.ecarts ?? []).filter((e) => e.date === date);
  const personne = (id: string | null): (typeof data.personnes)[number] | undefined => data.personnes.find((p) => p.id === id);
  const nomDe = (id: string | null): string => {
    const p = personne(id);
    return p ? nomCourt(p) : '—';
  };

  const reglerPause = (s: Shift, debut: string, fin: string): void => {
    const a = parseHHMM(debut);
    const b = parseHHMM(fin);
    if (a === null || b === null || a >= b || a <= s.start || b >= s.end) return dire('La pause doit tenir à l’intérieur du poste.');
    saveShift({ ...s, pauseStart: a, pauseEnd: b, origine: 'manuel' });
  };

  return (
    <Dialog
      size="wide"
      title={fmtDateLong(date).replace(/^./, (c) => c.toUpperCase())}
      subtitle={plages.length ? `Ouverture : ${plages.map((p) => `${fmtHeure(p.start)} – ${fmtHeure(p.end)}`).join(' et ')} · ${postes.length} poste${postes.length > 1 ? 's' : ''}` : 'Pharmacie fermée ce jour-là'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={() => setDate(addDays(date, -1))}>
            <ChevronLeft size={16} aria-hidden="true" /> Veille
          </button>
          <button type="button" className="btn" onClick={() => setDate(addDays(date, 1))}>
            Lendemain <ChevronRight size={16} aria-hidden="true" />
          </button>
          <span className="grow" />
          <button type="button" className="btn primary" onClick={onClose}>
            Fermer
          </button>
        </>
      }
    >
      {gere && postes.length ? (
        trous.length ? (
          <p className="notice danger small" role="status">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>
              <b>Aucun pharmacien</b> de {trous.map((t) => `${fmtHeure(t.start)} à ${fmtHeure(t.end)}`).join(', puis de ')}. Décalez une pause ou allongez un poste.
            </span>
          </p>
        ) : (
          <p className="notice ok small" role="status">
            <CircleCheck size={16} aria-hidden="true" /> <span>Un pharmacien est présent sur toute l’ouverture, pauses comprises.</span>
          </p>
        )
      ) : null}

      {!postes.length ? (
        <p className="soft">{gere || semaine?.statut === 'publie' ? 'Aucun poste ce jour-là.' : 'Le planning de cette semaine n’est pas encore publié.'}</p>
      ) : (
        <div className="jour-equipe">
          <div className="je-ligne regle" aria-hidden="true">
            <span />
            <Graduations echelle={echelle} />
          </div>
          {postes.map((s) => {
            const p = personne(s.personId);
            if (!p) return null;
            const pause = s.pauseStart !== undefined && s.pauseEnd !== undefined;
            const duJour = ecarts.filter((e) => e.personId === p.id);
            return (
              <div key={s.id} className={`je-ligne${p.id === moi ? ' moi' : ''}`}>
                <div className="je-qui">
                  <Avatar person={p} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <b>{nomCourt(p)}</b>
                    <div style={{ marginTop: 3 }}>
                      <EtiquetteRole person={p} />
                    </div>
                  </div>
                </div>
                <div className="je-corps">
                  <div className="row wrap" style={{ gap: '4px 12px' }}>
                    <b className="jh-heures num">
                      {fmtHeure(s.start)} – {fmtHeure(s.end)}
                    </b>
                    <span className="small soft">
                      {fmtDuree(minutesTravail(s))} de travail{pause ? ` · pause de ${fmtHeure(s.pauseStart as number)} à ${fmtHeure(s.pauseEnd as number)}` : ' · sans pause'}
                    </span>
                    {duJour.map((e) => (
                      <Pill key={e.id} tone="warn">
                        <Clock3 size={12} aria-hidden="true" /> {ECART_LABEL[e.type]}
                        {e.minutes ? ` · ${e.minutes} min` : ''}
                        {gere ? (
                          <button type="button" className="pill-x" onClick={() => retirerEcart(e.id)} aria-label={`Retirer : ${ECART_LABEL[e.type]} de ${nomCourt(p)}`}>
                            <Trash2 size={12} aria-hidden="true" />
                          </button>
                        ) : null}
                      </Pill>
                    ))}
                  </div>
                  <Frise shifts={[s]} echelle={echelle} />
                  {gere ? (
                    <div className="je-outils">
                      <span className="je-pause">
                        <Coffee size={15} aria-hidden="true" />
                        {pause ? (
                          <>
                            <label className="sr" htmlFor={`pause-de-${s.id}`}>
                              Début de la pause de {nomCourt(p)}
                            </label>
                            <input id={`pause-de-${s.id}`} type="time" step={900} className="input num" defaultValue={fmtHHMM(s.pauseStart as number)} key={`d${s.pauseStart}`} onBlur={(e) => e.target.value !== fmtHHMM(s.pauseStart as number) && reglerPause(s, e.target.value, fmtHHMM(s.pauseEnd as number))} />
                            <span aria-hidden="true">→</span>
                            <label className="sr" htmlFor={`pause-a-${s.id}`}>
                              Fin de la pause de {nomCourt(p)}
                            </label>
                            <input id={`pause-a-${s.id}`} type="time" step={900} className="input num" defaultValue={fmtHHMM(s.pauseEnd as number)} key={`f${s.pauseEnd}`} onBlur={(e) => e.target.value !== fmtHHMM(s.pauseEnd as number) && reglerPause(s, fmtHHMM(s.pauseStart as number), e.target.value)} />
                            <button type="button" className="btn sm ghost" onClick={() => saveShift({ ...s, pauseStart: undefined, pauseEnd: undefined, origine: 'manuel' })}>
                              Retirer
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn sm"
                            onClick={() => {
                              const milieu = Math.round((s.start + s.end) / 2 / 15) * 15;
                              const debut = Math.min(Math.max(milieu - 30, s.start + 60), s.end - 120);
                              saveShift({ ...s, pauseStart: debut, pauseEnd: debut + 60, origine: 'manuel' });
                            }}
                          >
                            Ajouter une pause
                          </button>
                        )}
                      </span>
                      {ecartPour === s.id ? (
                        <span className="je-ecart">
                          <label className="sr" htmlFor={`ecart-type-${s.id}`}>
                            Nature de l’écart
                          </label>
                          <select id={`ecart-type-${s.id}`} value={ecartType} onChange={(e) => setEcartType(e.target.value as EcartType)}>
                            {(Object.keys(ECART_LABEL) as EcartType[]).map((t) => (
                              <option key={t} value={t}>
                                {ECART_LABEL[t]}
                              </option>
                            ))}
                          </select>
                          {ecartType !== 'absence' ? (
                            <>
                              <label className="sr" htmlFor={`ecart-min-${s.id}`}>
                                Durée en minutes
                              </label>
                              <select id={`ecart-min-${s.id}`} value={ecartMinutes} onChange={(e) => setEcartMinutes(Number(e.target.value))}>
                                {[5, 10, 15, 20, 30, 45, 60, 90].map((m) => (
                                  <option key={m} value={m}>
                                    {m} min
                                  </option>
                                ))}
                              </select>
                            </>
                          ) : null}
                          <button
                            type="button"
                            className="btn sm primary"
                            onClick={() => {
                              signalerEcart({ personId: p.id, date, type: ecartType, minutes: ecartType === 'absence' ? undefined : ecartMinutes });
                              setEcartPour(null);
                              dire(`${ECART_LABEL[ecartType]} noté pour ${p.prenom}.`, true);
                            }}
                          >
                            Noter
                          </button>
                          <button type="button" className="btn sm ghost" onClick={() => setEcartPour(null)}>
                            Annuler
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="btn sm ghost" onClick={() => setEcartPour(s.id)}>
                          <Clock3 size={14} aria-hidden="true" /> Noter un retard
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {absentes.length || gardes.length ? (
        <div className="row wrap" style={{ gap: 8 }}>
          {absentes.map((a) => (
            <Pill key={a.id}>
              {nomDe(a.personId)} · {libelleAbsence(a)}
            </Pill>
          ))}
          {gardes.map((g) => (
            <Pill key={g.id} tone="nuit">
              <Moon size={12} aria-hidden="true" /> {GARDE_LABEL[g.type]} · {nomDe(g.personId)} · {fmtHHMM(g.start)} → {fmtHHMM(g.end)}
            </Pill>
          ))}
        </div>
      ) : null}
      {gere ? <p className="tiny muted">Une pause d’au moins 20 minutes est due dès 6 heures de travail dans la journée (Code du travail, art. L3121-16). Un retard noté ici alimente le suivi de la personne ; aucune raison n’est demandée.</p> : null}
    </Dialog>
  );
}
