import { CalendarHeart, Check, ChevronLeft, ChevronRight, Eraser, HandHeart, Hourglass, Lock, Sparkles, Sun, Sunrise, Sunset, TreePalm } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { JOURS, JOURS_COURT, MOIS, dayIndex, fmtDateCourt, fmtDateLong, weekday, ferie } from '../../domain/time';
import type { ISODate, SouhaitChoix } from '../../domain/types';
import { SOUHAIT_LABEL, nomCourt } from '../../domain/types';
import { estAbsent, ouverture } from '../../engine/core';
import type { DemiJournee } from '../../engine/souhaits';
import { datesDuMois, effectifSouhaite, estCollaboratif, joursRestants, limiteSouhaits, moisACollecter, moisDecale, proposerSouhaits, reponses, souhaitDe } from '../../engine/souhaits';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Avatar, Empty, Pill } from '../kit';

const ICONE: Record<SouhaitChoix, JSX.Element> = {
  matin: <Sunrise size={15} aria-hidden="true" />,
  journee: <Sun size={15} aria-hidden="true" />,
  soir: <Sunset size={15} aria-hidden="true" />,
  repos: <TreePalm size={15} aria-hidden="true" />,
};
const CHOIX: SouhaitChoix[] = ['matin', 'journee', 'soir', 'repos'];
type Pinceau = SouhaitChoix | 'effacer';

const titreMois = (mois: string): string => {
  const [y, m] = mois.split('-').map(Number);
  return `${MOIS[m - 1].charAt(0).toUpperCase()}${MOIS[m - 1].slice(1)} ${y}`;
};

/** Mes souhaits du mois : une forme d'horaire par jour, et l'effectif que l'équipe annonce en face. */
export function Souhaits({ personId }: { personId: string }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { poserSouhait, poserSouhaits } = useStore();
  const dire = useUi((s) => s.dire);
  const person = data.personnes.find((p) => p.id === personId);
  const [mois, setMois] = useState(() => moisACollecter(data.officine, today));
  const [pinceau, setPinceau] = useState<Pinceau>('journee');
  const [choisi, setChoisi] = useState<ISODate | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  const dates = useMemo(() => datesDuMois(mois), [mois]);
  const restants = joursRestants(data.officine, mois, today);
  const clos = restants < 0;
  const limite = limiteSouhaits(data.officine, mois);
  const ouverts = dates.filter((d) => ouverture(data.officine, d).length > 0 && !estAbsent(data, personId, d));
  const remplis = ouverts.filter((d) => souhaitDe(data, personId, d)).length;
  const equipe = reponses(data, mois);

  useEffect(() => {
    if (!enregistre) return;
    const t = window.setTimeout(() => setEnregistre(false), 1800);
    return () => window.clearTimeout(t);
  }, [enregistre]);

  if (!person) return <div className="empty">Personne introuvable.</div>;
  if (!estCollaboratif(data.officine)) {
    return (
      <Empty icon={<CalendarHeart size={30} />} title="Le planning est construit par le responsable">
        Cette pharmacie n’utilise pas la collecte des préférences. Pour une contrainte d’horaires, passez par « Mon planning ».
      </Empty>
    );
  }

  const poser = (date: ISODate, choix: SouhaitChoix | null): void => {
    poserSouhait(personId, date, choix);
    setEnregistre(true);
  };
  const cliquer = (date: ISODate): void => {
    setChoisi(date);
    if (clos) return;
    const actuel = souhaitDe(data, personId, date);
    if (pinceau === 'effacer') {
      if (actuel) poser(date, null);
    } else poser(date, actuel === pinceau ? null : pinceau);
  };
  const assister = (): void => {
    const liste = proposerSouhaits(data, person, mois, today);
    if (!liste.length) return dire('Tous vos jours sont déjà remplis.');
    poserSouhaits(liste);
    setEnregistre(true);
    dire(`${liste.length} jour${liste.length > 1 ? 's' : ''} rempli${liste.length > 1 ? 's' : ''} d’après vos habitudes. Corrigez ce qui ne convient pas.`);
  };

  const decalage = weekday(dates[0]);
  const jourChoisi = choisi && choisi.startsWith(mois) ? choisi : null;
  const effectif = jourChoisi ? effectifSouhaite(data, jourChoisi) : null;
  const monChoix = jourChoisi ? souhaitDe(data, personId, jourChoisi) : undefined;
  const nom = (id: string): string => {
    const p = data.personnes.find((x) => x.id === id);
    return p ? nomCourt(p) : '';
  };
  /** Venir combler un manque : on étend le souhait existant plutôt que de l'écraser. */
  const combler = (date: ISODate, demi: 'matin' | 'soir'): void => {
    const actuel = souhaitDe(data, personId, date);
    poser(date, actuel && actuel !== 'repos' && actuel !== demi ? 'journee' : demi);
    dire('Merci. Toute l’équipe voit que ce créneau est couvert.');
  };
  const manque = (d: DemiJournee): number => Math.max(0, d.requis - d.present);

  return (
    <div className="souhaits">
      <div className="sh-grille">
        <section className="card sh-cal" aria-label={`Préférences de ${titreMois(mois)}`}>
          <div className="sh-barre">
            <div className="week-nav">
              <button type="button" className="btn ghost icon" onClick={() => setMois(moisDecale(mois, -1))} aria-label="Mois précédent">
                <ChevronLeft size={18} />
              </button>
              <button type="button" className="btn ghost icon" onClick={() => setMois(moisDecale(mois, 1))} aria-label="Mois suivant">
                <ChevronRight size={18} />
              </button>
              <div className="label" aria-live="polite">
                {titreMois(mois)}
                <small>
                  {remplis} jour{remplis > 1 ? 's' : ''} sur {ouverts.length} rempli{remplis > 1 ? 's' : ''}
                </small>
              </div>
            </div>
            {clos ? (
              <Pill tone="neutral">
                <Lock size={13} aria-hidden="true" /> Collecte close le {fmtDateCourt(limite)}
              </Pill>
            ) : (
              <Pill tone={restants <= 3 ? 'warn' : 'ok'}>
                <Hourglass size={13} aria-hidden="true" /> {restants === 0 ? 'Dernier jour' : `${restants} jour${restants > 1 ? 's' : ''} restant${restants > 1 ? 's' : ''}`}
              </Pill>
            )}
            <button type="button" className="btn magic sm" onClick={assister} disabled={clos || remplis === ouverts.length} data-focus="assister">
              <Sparkles size={15} aria-hidden="true" /> M’assister
            </button>
            <span className={`sh-ok${enregistre ? ' on' : ''}`} role="status">
              {enregistre ? (
                <>
                  <Check size={14} aria-hidden="true" /> Choix enregistré
                </>
              ) : null}
            </span>
            <div className="sh-palette" role="group" aria-label="Forme à poser en cliquant sur un jour">
              <span className="sh-palette-mot">Je préfère</span>
              {CHOIX.map((c) => (
                <button key={c} type="button" className={`sh-choix ${c}${pinceau === c ? ' on' : ''}`} aria-pressed={pinceau === c} onClick={() => setPinceau(c)} disabled={clos}>
                  {ICONE[c]} {SOUHAIT_LABEL[c]}
                </button>
              ))}
              <button type="button" className={`sh-choix effacer${pinceau === 'effacer' ? ' on' : ''}`} aria-pressed={pinceau === 'effacer'} onClick={() => setPinceau('effacer')} disabled={clos}>
                <Eraser size={15} aria-hidden="true" /> Effacer
              </button>
            </div>
          </div>
          <div className="sh-mois" role="grid" aria-label={`Jours de ${titreMois(mois)}`}>
            <div role="row" className="sh-rang tete">
              {JOURS_COURT.map((j) => (
                <span key={j} role="columnheader" className="cap1">
                  {j}
                </span>
              ))}
            </div>
            <div role="row" className="sh-rang">
              {Array.from({ length: decalage }, (_, i) => (
                <span key={`v${i}`} role="gridcell" className="sh-vide" />
              ))}
              {dates.map((date) => {
                const ferme = ouverture(data.officine, date).length === 0;
                const absent = !ferme && estAbsent(data, personId, date);
                const choix = souhaitDe(data, personId, date);
                const e = ferme ? null : effectifSouhaite(data, date);
                const court = e ? manque(e.matin) + manque(e.soir) > 0 && equipe.repondu.length > 0 : false;
                const n = Number(date.slice(8));
                if (ferme || absent) {
                  return (
                    <span key={date} role="gridcell" className="sh-jour off">
                      <span className="n num">{n}</span>
                      <span className="small">{ferme ? (ferie(date) ? `Férié · ${ferie(date)}` : 'Fermé') : 'Absent'}</span>
                    </span>
                  );
                }
                return (
                  <span key={date} role="gridcell">
                    <button type="button" className={`sh-jour${choix ? ` ${choix}` : ''}${jourChoisi === date ? ' sel' : ''}`} onClick={() => cliquer(date)} aria-pressed={jourChoisi === date}>
                      <span className="n num">{n}</span>
                      <span className="c">{choix ? <>{ICONE[choix]} <span className="t">{SOUHAIT_LABEL[choix]}</span></> : <span className="t vide">À remplir</span>}</span>
                      {court ? <i className="sh-aider" title="L’équipe annoncée ne suffit pas ce jour-là" /> : null}
                      {/* Le nom lu reprend d'abord ce qui est écrit, puis le précise. */}
                      <span className="sr">
                        , {JOURS[weekday(date)]}
                      </span>
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
          <p className="sh-legende small soft"><i className="sh-aider" /> L’équipe annoncée ne suffit pas encore ce jour-là : touchez le jour pour voir qui vient, et aider si vous le voulez.</p>
        </section>

        <aside className="col" style={{ gap: 18 }}>
          <section className="card pad sh-detail" aria-live="polite" data-focus="jour-souhait">
            {jourChoisi && effectif ? (
              <>
                <div className="eyebrow">Le jour choisi</div>
                <h2 className="h3 cap1">{fmtDateLong(jourChoisi).replace(/ \d{4}$/, '')}</h2>
                <p className="small soft" style={{ margin: '4px 0 14px' }}>
                  Votre préférence : <b>{monChoix ? SOUHAIT_LABEL[monChoix] : 'aucune'}</b>
                </p>
                {(['matin', 'soir'] as const).map((demi) => {
                  const d = effectif[demi];
                  const m = manque(d);
                  const jyVais = d.qui.includes(personId);
                  return (
                    <div key={demi} className={`sh-demi${m ? ' court' : ''}`}>
                      <div className="row" style={{ gap: 8 }}>
                        {ICONE[demi]}
                        <b className="grow">{demi === 'matin' ? 'Matin' : 'Après-midi'}</b>
                        <span className="num sh-compte">
                          {d.present}/{d.requis}
                        </span>
                      </div>
                      {d.qui.length ? (
                        <div className="sh-qui">
                          {d.qui.map((id) => {
                            const p = data.personnes.find((x) => x.id === id);
                            return p ? <Avatar key={id} person={p} /> : null;
                          })}
                          <span className="small soft">{d.qui.map(nom).join(', ')}</span>
                        </div>
                      ) : (
                        <p className="small soft" style={{ margin: '6px 0 0' }}>Personne ne s’est encore positionné.</p>
                      )}
                      {m && !clos ? (
                        <div className="sh-appel">
                          <span className="small">
                            Il manque {m} personne{m > 1 ? 's' : ''}.
                          </span>
                          {jyVais ? (
                            <Pill tone="ok">
                              <Check size={13} aria-hidden="true" /> Vous y êtes
                            </Pill>
                          ) : (
                            <button type="button" className="btn sm primary" onClick={() => combler(jourChoisi, demi)}>
                              <HandHeart size={14} aria-hidden="true" /> Je peux venir
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                <div className="eyebrow">Comment faire</div>
                <h2 className="h3">Deux gestes</h2>
                <ol className="sh-aide">
                  <li>Choisissez ce que vous préférez : matin, journée, après-midi ou repos.</li>
                  <li>Touchez les jours concernés.</li>
                </ol>
                <p className="small soft" style={{ margin: '10px 0 0' }}>« M’assister » remplit le reste d’après vos habitudes. Ce ne sont que des préférences : rien à justifier.</p>
              </>
            )}
          </section>

          <section className="card pad">
            <div className="eyebrow">L’équipe</div>
            <h2 className="h3">
              {equipe.repondu.length} sur {equipe.repondu.length + equipe.attendus.length} ont répondu
            </h2>
            <div className="sh-progres" aria-hidden="true">
              <i style={{ width: `${(equipe.repondu.length / Math.max(1, equipe.repondu.length + equipe.attendus.length)) * 100}%` }} />
            </div>
            <p className="small soft" style={{ margin: '10px 0 0' }}>
              {clos ? `Collecte close le ${fmtDateCourt(limite)}.` : `Jusqu’au ${fmtDateCourt(limite)} inclus${dayIndex(limite) - dayIndex(today) <= 3 ? ' : c’est bientôt' : ''}.`} Chacun voit l’effectif annoncé, jamais les raisons.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
