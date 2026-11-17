import { Ban, ChevronLeft, ChevronRight, Moon, Sun, Sunset } from 'lucide-react';
import { JOURS, MOIS, addDays, fmtDateLong, fmtDuree, fmtHHMM, fmtHeure, mondayOf, weekday } from '../../domain/time';
import type { AppData, ISODate } from '../../domain/types';
import { GARDE_LABEL, classeAbsence, libelleAbsence } from '../../domain/types';
import { minutesTravail } from '../../engine/core';
import { MOMENT_LABEL, momentDe } from '../kit';

const cle = (annee: number, mois: number): string => `${annee}-${String(mois).padStart(2, '0')}`;

/**
 * Calendrier mensuel d'une personne : chaque jour porte ses horaires en clair, dans la couleur
 * du moment de la journée. Seules les semaines publiées sont montrées, comme partout dans son espace.
 */
export function Calendrier({ data, personId, today, mois, setMois }: { data: AppData; personId: string; today: ISODate; mois: string; setMois: (m: string) => void }): JSX.Element {
  const [annee, m] = mois.split('-').map(Number);
  const premier = `${mois}-01`;
  const debut = mondayOf(premier);
  // Six semaines au plus couvrent n'importe quel mois ; on s'arrête dès que le mois est passé.
  const semaines: ISODate[][] = [];
  for (let w = 0; w < 6; w++) {
    const lundi = addDays(debut, 7 * w);
    if (w > 0 && lundi.slice(0, 7) !== mois) break;
    semaines.push([0, 1, 2, 3, 4, 5, 6].map((j) => addDays(lundi, j)));
  }
  const publies = (date: ISODate): boolean => data.semaines[mondayOf(date)]?.statut === 'publie';
  const postesDu = (date: ISODate): AppData['shifts'] => (data.semaines[mondayOf(date)]?.snapshot ?? []).filter((s) => s.personId === personId && s.date === date).sort((a, b) => a.start - b.start);
  const aller = (delta: number): void => {
    const d = new Date(Date.UTC(annee, m - 1 + delta, 1));
    setMois(cle(d.getUTCFullYear(), d.getUTCMonth() + 1));
  };
  const titre = `${MOIS[m - 1]} ${annee}`;
  const absentLe = (date: ISODate): boolean => data.absences.some((a) => a.personId === personId && a.statut === 'approuvee' && a.from <= date && date <= a.to);
  // Le mois en deux chiffres : jours travaillés et heures prévues, sur les semaines publiées.
  const duMois = semaines.flat().filter((d) => d.slice(0, 7) === mois && publies(d) && !absentLe(d));
  const joursTravailles = duMois.filter((d) => postesDu(d).length).length;
  const minutesMois = duMois.reduce((t, d) => t + postesDu(d).reduce((u, x) => u + minutesTravail(x), 0), 0);

  return (
    <div className="card">
      <div className="card-head">
        <div className="grow">
          <h3 style={{ fontSize: 17 }} className="cap1" aria-live="polite">
            {titre}
          </h3>
          <div className="small soft">{joursTravailles ? `${joursTravailles} jour${joursTravailles > 1 ? 's' : ''} travaillé${joursTravailles > 1 ? 's' : ''} · ${fmtDuree(minutesMois)} prévues` : 'Aucun horaire publié ce mois-ci pour l’instant.'}</div>
        </div>
        <button type="button" className="btn sm" onClick={() => setMois(today.slice(0, 7))} disabled={mois === today.slice(0, 7)}>
          Aujourd’hui
        </button>
        <button type="button" className="btn icon sm" onClick={() => aller(-1)} aria-label="Mois précédent">
          <ChevronLeft size={17} aria-hidden="true" />
        </button>
        <button type="button" className="btn icon sm" onClick={() => aller(1)} aria-label="Mois suivant">
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="cal-scroll">
        <table className="cal" aria-label={`Mon planning de ${titre}`}>
          <colgroup>
            <col span={6} />
            <col className="col-dim" />
          </colgroup>
          <thead>
            <tr>
              {JOURS.map((j) => (
                <th key={j} scope="col">
                  <span className="cal-jl">{j}</span>
                  <span className="cal-jc" aria-hidden="true">{j.slice(0, 3)}.</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {semaines.map((jours) => (
              <tr key={jours[0]}>
                {jours.map((date) => {
                  const hors = date.slice(0, 7) !== mois;
                  const absence = data.absences.find((a) => a.personId === personId && a.statut === 'approuvee' && a.from <= date && date <= a.to);
                  const postes = absence || !publies(date) ? [] : postesDu(date);
                  const gardes = data.gardes.filter((g) => g.personId === personId && g.date === date);
                  return (
                    <td key={date} className={`${hors ? 'hors' : ''}${date === today ? ' auj' : ''}${weekday(date) === 6 ? ' dim' : ''}`}>
                      <div className="cal-case">
                      <span className="cal-n num">
                        <span className="n">{Number(date.slice(8))}</span>
                        <span className="sr"> {fmtDateLong(date)}{date === today ? ', aujourd’hui' : ''}</span>
                      </span>
                      {hors ? null : (
                        <>
                          {postes.map((s) => {
                            const moment = momentDe(s);
                            return (
                              <span key={s.id} className={`cal-poste ${moment}`}>
                                <span className="cp-haut">
                                  {moment === 'soir' ? <Sunset size={14} aria-hidden="true" /> : <Sun size={14} aria-hidden="true" />}
                                  <span className="cp-nom">{MOMENT_LABEL[moment]}</span>
                                </span>
                                <b className="cp-h">
                                  <span>{fmtHeure(s.start)}</span>
                                  <span className="cp-sep" aria-hidden="true"> – </span>
                                  <span className="sr"> à </span>
                                  <span>{fmtHeure(s.end)}</span>
                                </b>
                                <span className="cp-d">{fmtDuree(minutesTravail(s))} de travail</span>
                              </span>
                            );
                          })}
                          {absence ? (
                            <span className={`cal-poste ${classeAbsence(absence.type)}`}>
                              <span className="cp-haut">
                                <Ban size={14} aria-hidden="true" />
                                <span className="cp-nom">{libelleAbsence(absence)}</span>
                              </span>
                            </span>
                          ) : null}
                          {gardes.map((g) => (
                            <span key={g.id} className="cal-poste garde">
                              <span className="cp-haut">
                                <Moon size={14} aria-hidden="true" />
                                <span className="cp-nom">{GARDE_LABEL[g.type]}</span>
                              </span>
                              <b className="cp-h">
                                <span>{fmtHHMM(g.start)}</span>
                                <span className="cp-sep" aria-hidden="true"> → </span>
                                <span className="sr"> à </span>
                                <span>{fmtHHMM(g.end)}</span>
                              </b>
                            </span>
                          ))}
                          {!postes.length && !absence && !gardes.length && publies(date) && weekday(date) !== 6 ? <span className="cal-vide">Repos</span> : null}
                        </>
                      )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="legend">
        <li><i className="matin" /> Matin</li>
        <li><i className="milieu" /> Journée</li>
        <li><i className="journee" /> Journée longue</li>
        <li><i className="soir" /> Soir</li>
        <li><i className="garde" /> Garde</li>
        <li><i className="conge" /> Congé</li>
        <li><i className="arret" /> Arrêt</li>
        <li><i className="formation" /> Formation</li>
        <li className="soft">Une case vide : semaine pas encore publiée.</li>
      </ul>
    </div>
  );
}
