import { CalendarClock, ChevronLeft, ChevronRight, CircleCheck, MessageSquareText, Minus, Plus, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { JOURS, JOURS_COURT, addDays, fmtDuree, fmtHHMM, fmtHeure, fmtJourMois, fmtSemaine, mondayOf, parseHHMM, weekDates, weekday } from '../../domain/time';
import type { AppData, ISODate, Shift } from '../../domain/types';
import { nomCourt } from '../../domain/types';
import { estAbsent, minutesTravail, ouverture, sousEffectifs } from '../../engine/core';
import type { Solde } from '../../engine/heures';
import { semaineLibre } from '../../engine/heures';
import type { Creneau, Proposition, SensRegul } from '../../engine/rattrapage';
import { FORME_LABEL, controlerCreneau, proposerCreneaux } from '../../engine/rattrapage';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Dialog, momentDe } from '../kit';
import { Solvi } from '../Solvi';

const jourLong = (date: ISODate): string => `${JOURS[weekday(date)]} ${fmtJourMois(date)}`;
const signe = (min: number): string => `${min > 0 ? '+' : '−'}${fmtDuree(Math.abs(min))}`;
const meme = (a: Creneau | null, b: Creneau | null): boolean => !!a && !!b && a.date === b.date && a.start === b.start && a.end === b.end;
const postesDe = (data: Pick<AppData, 'shifts'>, personId: string, date: ISODate): Shift[] => data.shifts.filter((s) => s.personId === personId && s.date === date).sort((a, b) => a.start - b.start);

/**
 * Régulariser un compteur en gardant la main : combien d'heures, quel jour, quel horaire, et quel message part à la personne.
 * Le planning de la personne s'affiche semaine par semaine : on clique là où placer les heures.
 * Solvéa propose trois créneaux contrôlés ; le titulaire en retient un, place le sien, ou laisse la semaine à construire s'en charger.
 */
export function Regulariser({ solde, sens, onClose }: { solde: Solde; sens: SensRegul; onClose: () => void }): JSX.Element | null {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const planifier = useStore((s) => s.planifierRegularisation);
  const dire = useUi((s) => s.dire);
  const p = data.personnes.find((x) => x.id === solde.personId);
  const du = Math.abs(solde.solde);
  const plafond = Math.max(30, Math.min(600, Math.floor(du / 30) * 30));
  const [minutes, setMinutes] = useState(Math.min(plafond, 240));
  const propositions = useMemo(() => proposerCreneaux(data, solde.personId, minutes, sens, today), [data, solde.personId, minutes, sens, today]);
  // « auto » : Solvéa choisit, le créneau suit sa meilleure proposition. Sinon le titulaire a placé le sien ; `null` = sans date précise.
  const [auto, setAuto] = useState(true);
  const [creneau, setCreneau] = useState<Creneau | null>(null);
  const [lundi, setLundi] = useState<ISODate>(mondayOf(addDays(today, 1)));
  const [prevenir, setPrevenir] = useState(true);
  const [texte, setTexte] = useState('');
  const [ecrit, setEcrit] = useState(false);
  const semaine = semaineLibre(data, today);

  useEffect(() => {
    if (auto) setCreneau(propositions[0] ? { date: propositions[0].date, start: propositions[0].start, end: propositions[0].end } : null);
  }, [auto, propositions]);
  // Le planning montre toujours la semaine du créneau retenu.
  useEffect(() => {
    if (creneau) setLundi(mondayOf(creneau.date));
  }, [creneau?.date]); // eslint-disable-line react-hooks/exhaustive-deps

  const controle = useMemo(() => (creneau ? controlerCreneau(data, solde.personId, creneau, sens, today) : null), [data, solde.personId, creneau, sens, today]);
  const effectif = creneau && controle ? controle.minutes : minutes;
  const trop = !!creneau && effectif > du + 29;
  const bloquants = controle ? [...controle.bloquants, ...(trop ? [`Ce créneau dépasse le solde à régulariser (${fmtDuree(du)}).`] : [])] : [];
  const bloque = bloquants.length > 0 || (!!creneau && effectif < 30);

  const prenom = p?.prenom ?? '';
  const verbe = sens === 'rattrapage' ? 'rattraper' : 'récupérer';
  const modele = useMemo(() => {
    const tete = `Bonjour ${prenom}, votre compteur d’heures est à ${signe(solde.solde)}.`;
    if (!creneau || !controle) return `${tete} Je prévois ${fmtDuree(minutes)} ${sens === 'rattrapage' ? 'de plus' : 'de moins'} pour vous sur la semaine du ${fmtSemaine(semaine)} : vous verrez vos horaires à la publication du planning.`;
    const quand = `le ${jourLong(creneau.date)}`;
    const quoi =
      controle.forme === 'repos'
        ? `${quand}, vous êtes en repos au lieu de travailler de ${fmtHeure(creneau.start)} à ${fmtHeure(creneau.end)}`
        : controle.forme === 'partir_tot'
          ? `${quand}, vous terminez à ${fmtHeure(creneau.start)}`
          : controle.forme === 'arriver_tard'
            ? `${quand}, vous commencez à ${fmtHeure(creneau.end)}`
            : `${quand}, de ${fmtHeure(creneau.start)} à ${fmtHeure(creneau.end)}`;
    return `${tete} Je vous propose de ${verbe} ${fmtDuree(effectif)} : ${quoi}. ${controle.publie && controle.tardif ? 'C’est à moins de sept jours : il me faut votre accord.' : 'Dites-moi si cela vous convient.'}`;
  }, [prenom, solde.solde, creneau, controle, effectif, minutes, semaine, sens, verbe]);
  useEffect(() => {
    if (!ecrit) setTexte(modele);
  }, [modele, ecrit]);

  if (!p) return null;
  const reste = du - effectif;
  const choisir = (c: Creneau | null): void => {
    setAuto(false);
    setCreneau(c);
  };
  /** Un clic dans le planning : le créneau se colle au poste voisin, s'arrête à la fermeture ou au poste suivant. */
  const placer = (date: ISODate, t: number): void => {
    const postes = postesDe(data, p.id, date);
    if (sens === 'rattrapage') {
      const o = ouverture(data.officine, date).find((x) => x.start <= t && t < x.end);
      if (!o) return;
      const colle = postes.find((s) => t >= s.end && t - s.end < 30);
      const start = colle ? colle.end : t;
      const suivant = postes.find((s) => s.start > start);
      choisir({ date, start, end: Math.min(start + minutes, o.end, suivant ? suivant.start : 1440) });
      return;
    }
    const s = postes.find((x) => x.start <= t && t < x.end);
    if (!s) return;
    if (minutesTravail(s) <= minutes) choisir({ date, start: s.start, end: s.end });
    else if (t < (s.start + s.end) / 2) choisir({ date, start: s.start, end: s.start + minutes });
    else choisir({ date, start: s.end - minutes, end: s.end });
  };
  /** La durée change : Solvéa recalcule ses propositions ; un créneau placé à la main garde son point d'ancrage. */
  const changerMinutes = (m: number): void => {
    const borne = Math.max(30, Math.min(plafond, m));
    setMinutes(borne);
    if (auto || !creneau) return;
    const finDePoste = sens === 'recuperation' && postesDe(data, p.id, creneau.date).some((s) => s.end === creneau.end && s.start !== creneau.start);
    setCreneau(finDePoste ? { ...creneau, start: creneau.end - borne } : { ...creneau, end: creneau.start + borne });
  };
  const saisir = (patch: Partial<Creneau>): void => {
    const base = creneau ?? { date: addDays(today, 1), start: 540, end: 540 + minutes };
    const c = { ...base, ...patch };
    choisir(c);
    if (c.end > c.start) setMinutes(Math.max(30, Math.min(plafond, Math.round((c.end - c.start) / 30) * 30)));
  };
  const valider = (): void => {
    planifier({ personId: p.id, sens, minutes: effectif, creneau: creneau ?? undefined, semaine: creneau ? undefined : semaine, message: prevenir ? texte.trim() || modele : undefined });
    dire(`${nomCourt(p)} : ${fmtDuree(effectif)} à ${verbe}${creneau ? `, ${jourLong(creneau.date)} de ${fmtHeure(creneau.start)} à ${fmtHeure(creneau.end)}` : `, semaine du ${fmtSemaine(semaine)}`}${prevenir ? '. Message envoyé.' : '.'}`, true);
    onClose();
  };
  const premier = mondayOf(addDays(today, 1));
  const dernier = addDays(premier, 7 * 11);
  const etatSemaine = data.semaines[lundi]?.statut === 'publie' ? 'Planning communiqué' : data.shifts.some((s) => mondayOf(s.date) === lundi) ? 'Brouillon' : 'Pas encore construite';

  return (
    <Dialog
      size="wide"
      title={`Faire ${verbe} des heures à ${nomCourt(p)}`}
      subtitle={`Compteur : ${signe(solde.solde)}. Cliquez dans son planning pour placer les heures, ou gardez la proposition de Solvéa.`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn primary" id="rat-valider" disabled={bloque} onClick={valider}>
            <CalendarClock size={15} aria-hidden="true" /> {prevenir ? `Planifier et prévenir ${prenom}` : 'Planifier'}
          </button>
        </>
      }
    >
      <div className="rat-grille">
        <div className="rat-col">
          <section className="rat-bloc" aria-labelledby="rat-combien">
            <h3 id="rat-combien">Combien d’heures ?</h3>
            <div className="rat-duree">
              <div className="rat-pas" role="group" aria-label="Durée">
                <button type="button" className="btn icon" aria-label="Une demi-heure de moins" disabled={minutes <= 30} onClick={() => changerMinutes(minutes - 30)}>
                  <Minus size={16} />
                </button>
                <output className="num" id="rat-minutes" aria-live="polite">
                  {fmtDuree(minutes)}
                </output>
                <button type="button" className="btn icon" aria-label="Une demi-heure de plus" disabled={minutes >= plafond} onClick={() => changerMinutes(minutes + 30)}>
                  <Plus size={16} />
                </button>
              </div>
              {plafond > 60 ? (
                <button type="button" className="btn sm" onClick={() => changerMinutes(plafond)} disabled={minutes === plafond}>
                  Tout : {fmtDuree(plafond)}
                </button>
              ) : null}
              <span className="small soft">{reste >= 30 ? `Il restera ${signe(Math.sign(solde.solde) * reste)} au compteur.` : 'Le compteur revient à jour.'}</span>
            </div>
          </section>

          <section className="rat-bloc" aria-labelledby="rat-ou">
            <div className="rat-pl-tete">
              <h3 id="rat-ou">Où et quand ? Le planning de {prenom}</h3>
              <div className="rat-pl-nav">
                <button type="button" className="btn icon sm" aria-label="Semaine précédente" disabled={lundi <= premier} onClick={() => setLundi(addDays(lundi, -7))}>
                  <ChevronLeft size={16} />
                </button>
                <span className="rat-pl-semaine" aria-live="polite">
                  <b>Semaine du {fmtSemaine(lundi)}</b>
                  <span className="small soft">{etatSemaine}</span>
                </span>
                <button type="button" className="btn icon sm" aria-label="Semaine suivante" disabled={lundi >= dernier} onClick={() => setLundi(addDays(lundi, 7))}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <Planning data={data} personId={p.id} sens={sens} today={today} lundi={lundi} creneau={creneau} refuse={bloque} minutes={effectif} propositions={propositions} onPlacer={placer} />
            <p className="small soft rat-aide">
              {sens === 'rattrapage' ? 'Cliquez sur une plage libre : le créneau se colle au poste voisin et s’arrête à la fermeture.' : 'Cliquez au début ou à la fin d’un poste pour y retirer les heures.'} Au clavier, utilisez les champs ci-dessous.
            </p>
            <div className="champs rat-champs">
              <label className="field" htmlFor="rat-date">
                Jour
                <input id="rat-date" type="date" min={addDays(today, 1)} max={addDays(dernier, 6)} value={creneau?.date ?? ''} onChange={(e) => e.target.value && saisir({ date: e.target.value })} />
              </label>
              <label className="field" htmlFor="rat-debut">
                De
                <input id="rat-debut" type="time" step={900} value={creneau ? fmtHHMM(creneau.start) : ''} onChange={(e) => { const v = parseHHMM(e.target.value); if (v !== null) saisir({ start: v }); }} />
              </label>
              <label className="field" htmlFor="rat-fin">
                À
                <input id="rat-fin" type="time" step={900} value={creneau ? fmtHHMM(creneau.end) : ''} onChange={(e) => { const v = parseHHMM(e.target.value); if (v !== null) saisir({ end: v }); }} />
              </label>
            </div>
          </section>
        </div>

        <div className="rat-col">
          <section className="rat-bloc" aria-labelledby="rat-propose">
            <div className="rat-solvi">
              <Solvi size={34} calme humeur={propositions.length ? 'confiant' : 'reflechi'} />
              <div className="grow">
                <h3 id="rat-propose">Solvéa propose</h3>
                <span className="small soft">{propositions.length ? 'Sans règle enfreinte, sur les quatre prochaines semaines.' : 'Aucun créneau sans règle enfreinte dans les plannings déjà posés.'}</span>
              </div>
              {propositions.length ? (
                <button type="button" className="btn sm" id="rat-auto" aria-pressed={auto} onClick={() => setAuto(true)}>
                  <Sparkles size={14} aria-hidden="true" /> Laisser Solvéa choisir
                </button>
              ) : null}
            </div>
            <div className="rat-choix">
              {propositions.map((c, i) => (
                <button key={`${c.date}-${c.start}`} type="button" className={`rat-carte${meme(creneau, c) ? ' on' : ''}`} aria-pressed={meme(creneau, c)} onClick={() => choisir({ date: c.date, start: c.start, end: c.end })}>
                  <b className="cap1">
                    {jourLong(c.date)} · {fmtHeure(c.start)} → {fmtHeure(c.end)}
                  </b>
                  <span className="rat-tags">
                    {i === 0 ? <span className="rat-tag conseille">Conseillé</span> : null}
                    <span className="rat-tag">{fmtDuree(c.controle.minutes)}</span>
                    {c.controle.forme ? <span className="rat-tag">{FORME_LABEL[c.controle.forme]}</span> : null}
                    {c.controle.atouts.map((a) => (
                      <span key={a} className="rat-tag ok">
                        {a}
                      </span>
                    ))}
                    {c.controle.publie ? <span className="rat-tag warn">{c.controle.tardif ? 'Moins de 7 jours : accord à obtenir' : 'Planning déjà communiqué'}</span> : null}
                  </span>
                </button>
              ))}
              <button type="button" id="rat-sans-date" className={`rat-carte${!creneau ? ' on' : ''}`} aria-pressed={!creneau} onClick={() => choisir(null)}>
                <b>Sans date précise, semaine du {fmtSemaine(semaine)}</b>
                <span className="small soft">Solvéa {sens === 'rattrapage' ? 'ajoute ces heures à' : 'retire ces heures de'} son objectif quand vous construirez cette semaine.</span>
              </button>
            </div>
            {controle && creneau ? (
              <div className={`rat-controle ${bloquants.length ? 'ko' : controle.alertes.length ? 'attention' : 'ok'}`} role="status" id="rat-controle">
                {bloquants.length || controle.alertes.length ? <TriangleAlert size={17} aria-hidden="true" /> : <CircleCheck size={17} aria-hidden="true" />}
                <div>
                  <b className="cap1">
                    {bloquants.length
                      ? 'Ce créneau ne peut pas être retenu'
                      : `${jourLong(creneau.date)}, ${fmtHeure(creneau.start)} → ${fmtHeure(creneau.end)} : ${fmtDuree(controle.minutes)} ${sens === 'rattrapage' ? 'en plus' : 'en moins'}, aucune règle enfreinte`}
                  </b>
                  {[...bloquants, ...controle.alertes].length ? (
                    <ul>
                      {[...bloquants, ...controle.alertes].map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>

          <section className="rat-bloc" aria-labelledby="rat-message">
            <h3 id="rat-message">Le message</h3>
            <label className="check ligne" htmlFor="rat-prevenir">
              <input id="rat-prevenir" type="checkbox" checked={prevenir} onChange={(e) => setPrevenir(e.target.checked)} />
              <span>
                Prévenir {prenom} par message
                <span className="soft small" style={{ display: 'block' }}>Il arrive dans ses messages, en plus de l’annonce sous sa cloche.</span>
              </span>
            </label>
            {prevenir ? (
              <label className="field" htmlFor="rat-texte">
                <span className="rat-texte-tete">
                  <MessageSquareText size={14} aria-hidden="true" /> Ce que {prenom} recevra
                  {ecrit ? (
                    <button type="button" className="btn ghost sm" onClick={() => setEcrit(false)}>
                      Revenir au texte proposé
                    </button>
                  ) : null}
                </span>
                <textarea id="rat-texte" rows={5} maxLength={600} value={texte} onChange={(e) => { setTexte(e.target.value); setEcrit(true); }} />
              </label>
            ) : (
              <p className="small soft">{prenom} verra seulement l’annonce du changement sous sa cloche.</p>
            )}
          </section>
        </div>
      </div>
    </Dialog>
  );
}

/** Une semaine de la personne, jour par jour, à l'échelle des heures d'ouverture : ses postes, les manques au comptoir, les créneaux proposés et celui qui est retenu. */
function Planning({
  data,
  personId,
  sens,
  today,
  lundi,
  creneau,
  refuse,
  minutes,
  propositions,
  onPlacer,
}: {
  data: AppData;
  personId: string;
  sens: SensRegul;
  today: ISODate;
  lundi: ISODate;
  creneau: Creneau | null;
  refuse: boolean;
  minutes: number;
  propositions: Proposition[];
  onPlacer: (date: ISODate, t: number) => void;
}): JSX.Element {
  const jours = weekDates(lundi).map((date) => ({ date, ouvert: ouverture(data.officine, date), postes: postesDe(data, personId, date), absent: estAbsent(data, personId, date) }));
  const bornes = jours.flatMap((j) => j.ouvert);
  const e = { start: Math.floor(Math.min(...bornes.map((o) => o.start), 8 * 60) / 60) * 60, end: Math.ceil(Math.max(...bornes.map((o) => o.end), 19 * 60) / 60) * 60 };
  const pos = (m: number): string => `${Math.max(0, Math.min(100, ((m - e.start) / (e.end - e.start)) * 100))}%`;
  const larg = (a: number, b: number): string => `${Math.max(0, ((Math.min(b, e.end) - Math.max(a, e.start)) / (e.end - e.start)) * 100)}%`;
  const heures: number[] = [];
  for (let h = e.start; h <= e.end; h += 120) heures.push(h);
  return (
    <div className={`rat-pl ${sens}`} role="group" aria-label={`Planning de la semaine du ${fmtSemaine(lundi)}`} data-focus="rat-planning">
      <div className="rat-pl-ligne tete" aria-hidden="true">
        <span />
        <span className="rat-pl-piste">
          {heures.map((h) => (
            <i key={h} className="rat-pl-heure" style={{ left: pos(h) }}>
              {fmtHeure(h)}
            </i>
          ))}
        </span>
      </div>
      {jours.map((j) => {
        const passe = j.date <= today;
        const libre = !passe && !j.absent && j.ouvert.length > 0;
        const manques = sens === 'rattrapage' && libre ? sousEffectifs(data, j.date) : [];
        const cases: number[] = [];
        if (libre) for (const o of j.ouvert) for (let t = o.start; t < o.end; t += 30) if (sens === 'rattrapage' ? !j.postes.some((s) => s.start < t + 30 && t < s.end) : j.postes.some((s) => s.start <= t && t < s.end)) cases.push(t);
        const total = j.postes.reduce((t, s) => t + minutesTravail(s), 0);
        return (
          <div key={j.date} className={`rat-pl-ligne${passe ? ' passe' : ''}${creneau?.date === j.date ? ' vise' : ''}`}>
            <span className="rat-pl-jour">
              <b className="cap1">
                {JOURS_COURT[weekday(j.date)]} {Number(j.date.slice(8))}
              </b>
              <span>{!j.ouvert.length ? 'Fermé' : j.absent ? 'Absent' : passe ? (j.date === today ? 'Aujourd’hui' : 'Passé') : total ? fmtDuree(total) : 'Repos'}</span>
            </span>
            <span className="rat-pl-piste">
              {heures.map((h) => (
                <i key={h} className="rat-pl-trait" style={{ left: pos(h) }} aria-hidden="true" />
              ))}
              {j.ouvert.map((o) => (
                <i key={o.start} className="rat-pl-ouvert" style={{ left: pos(o.start), width: larg(o.start, o.end) }} aria-hidden="true" />
              ))}
              {manques.map((m) => (
                <i key={m.start} className="rat-pl-manque" style={{ left: pos(m.start), width: larg(m.start, m.end) }} title={`Manque au comptoir de ${fmtHeure(m.start)} à ${fmtHeure(m.end)}`} aria-hidden="true" />
              ))}
              {j.postes.map((s) => (
                <span key={s.id} className={`rat-pl-poste ${momentDe(s)}`} style={{ left: pos(s.start), width: larg(s.start, s.end) }} aria-hidden="true">
                  <em>
                    {fmtHeure(s.start)} – {fmtHeure(s.end)}
                  </em>
                  {s.pauseStart !== undefined && s.pauseEnd !== undefined ? <i className="pause" style={{ left: `${((s.pauseStart - s.start) / (s.end - s.start)) * 100}%`, width: `${((s.pauseEnd - s.pauseStart) / (s.end - s.start)) * 100}%` }} /> : null}
                </span>
              ))}
              {cases.map((t) => (
                <button key={t} type="button" tabIndex={-1} className="rat-pl-case" style={{ left: pos(t), width: larg(t, t + 30) }} aria-label={`${jourLong(j.date)}, ${fmtHeure(t)}`} title={`${jourLong(j.date)}, ${fmtHeure(t)}`} onClick={() => onPlacer(j.date, t)} />
              ))}
              {propositions
                .filter((c) => c.date === j.date && !meme(creneau, c))
                .map((c) => (
                  <i key={c.start} className="rat-pl-propose" style={{ left: pos(c.start), width: larg(c.start, c.end) }} aria-hidden="true" />
                ))}
              {creneau?.date === j.date && creneau.end > creneau.start ? (
                <span className={`rat-pl-choisi${refuse ? ' ko' : ''}`} style={{ left: pos(creneau.start), width: larg(creneau.start, creneau.end) }} aria-hidden="true">
                  {sens === 'rattrapage' ? '+' : '−'}
                  {fmtDuree(minutes || creneau.end - creneau.start)}
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
      <div className="rat-pl-legende" aria-hidden="true">
        <span>
          <i className="l-poste" /> Poste prévu
        </span>
        <span>
          <i className="l-choisi" /> {sens === 'rattrapage' ? 'Heures ajoutées' : 'Heures retirées'}
        </span>
        <span>
          <i className="l-propose" /> Proposé par Solvéa
        </span>
        {sens === 'rattrapage' ? (
          <span>
            <i className="l-manque" /> Manque au comptoir
          </span>
        ) : null}
      </div>
    </div>
  );
}
