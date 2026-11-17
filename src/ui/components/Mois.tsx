import { CalendarHeart, ChevronLeft, ChevronRight, CircleCheck, Hourglass, Lock, Target } from 'lucide-react';
import { useMemo, useState } from 'react';
import { JOURS, MOIS, addDays, fmtDateCourt, mondayOf, weekday } from '../../domain/time';
import type { ISODate } from '../../domain/types';
import { SOUHAIT_LABEL, classeAbsence, nomCourt } from '../../domain/types';
import { ouverture } from '../../engine/core';
import { semainesDuMois } from '../../engine/payroll';
import type { Correction } from '../../engine/souhaits';
import { corrigerMois, estCollaboratif, heuresMois, joursRestants, limiteSouhaits, moisDe, moisDecale, objectifJour, reponses, souhaitDe, souhaitRespecte } from '../../engine/souhaits';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Avatar, BoutonAuto, Pill, momentDe } from '../kit';

const LETTRE: Record<string, string> = { matin: 'M', journee: 'J', milieu: 'J', soir: 'A', repos: 'R' };
const titreMois = (mois: string): string => {
  const [y, m] = mois.split('-').map(Number);
  return `${MOIS[m - 1].charAt(0).toUpperCase()}${MOIS[m - 1].slice(1)} ${y}`;
};
const heures = (min: number): string => `${Math.round(min / 60)}`;

/** Le mois d'un coup d'œil : objectifs d'équipe par jour, heures de chacun face au contrat, souhaits suivis. */
export function VueMois({ moiId }: { moiId?: string }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const appliquer = useStore((s) => s.appliquerCorrection);
  const { semaine, setSemaine, setPlanVue, voirJour, dire, seulementMoi } = useUi();
  const [mois, setMois] = useState(() => moisDe(addDays(semaine, 3)));
  const [calcul, setCalcul] = useState(false);
  const [bilan, setBilan] = useState<Correction | null>(null);

  const lundis = useMemo(() => semainesDuMois(mois), [mois]);
  const dates = useMemo(() => lundis.flatMap((l) => Array.from({ length: 7 }, (_, i) => addDays(l, i))), [lundis]);
  const collaboratif = estCollaboratif(data.officine);
  const equipe = reponses(data, mois);
  const restants = joursRestants(data.officine, mois, today);
  const personnes = data.personnes.filter((p) => !p.externe && (!seulementMoi || p.id === moiId));
  const brouillons = lundis.filter((l) => data.semaines[l]?.statut !== 'publie' && addDays(l, 6) >= today);
  const objectifs = useMemo(() => new Map(dates.map((d) => [d, objectifJour(data, d)])), [data, dates]);
  const parCase = useMemo(() => {
    const m = new Map<string, typeof data.shifts>();
    for (const s of data.shifts) {
      if (s.date < dates[0] || s.date > dates[dates.length - 1]) continue;
      const k = `${s.personId}|${s.date}`;
      m.set(k, (m.get(k) ?? []).concat(s));
    }
    return m;
  }, [data.shifts, dates]);

  const corriger = (): void => {
    setCalcul(true);
    // Le calcul prend une à deux secondes : on laisse l'écran afficher l'attente avant de le lancer.
    window.setTimeout(() => {
      const c = corrigerMois(useStore.getState().data, mois);
      appliquer(mois, c);
      setBilan(c);
      setCalcul(false);
      dire('Mois recalculé en brouillon. Rien n’est publié.', true);
    }, 60);
  };
  const ouvrirSemaine = (date: ISODate): void => {
    setSemaine(mondayOf(date));
    setPlanVue('semaine');
  };

  return (
    <div className="plan mois">
      <div className="plan-bar">
        <div className="week-nav">
          <button type="button" className="btn ghost icon" onClick={() => { setMois(moisDecale(mois, -1)); setBilan(null); }} aria-label="Mois précédent">
            <ChevronLeft size={18} />
          </button>
          <button type="button" className="btn ghost icon" onClick={() => { setMois(moisDecale(mois, 1)); setBilan(null); }} aria-label="Mois suivant">
            <ChevronRight size={18} />
          </button>
          <div className="label" aria-live="polite">
            {titreMois(mois)}
            <small>
              {lundis.length} semaines · {brouillons.length ? `${brouillons.length} en brouillon` : 'tout est publié'}
            </small>
          </div>
        </div>
        {collaboratif ? (
          <>
            <span className="mo-reponses" data-aide={equipe.attendus.length ? `Pas encore de souhaits : ${equipe.attendus.map((id) => nomCourt(data.personnes.find((p) => p.id === id)!)).join(', ')}` : 'Toute l’équipe a répondu'}>
              <CalendarHeart size={16} aria-hidden="true" />
              <span>
                <b className="num">
                  {equipe.repondu.length}/{equipe.repondu.length + equipe.attendus.length}
                </b>{' '}
                ont posé leurs souhaits
                <span className="sh-progres" aria-hidden="true">
                  <i style={{ width: `${(equipe.repondu.length / Math.max(1, equipe.repondu.length + equipe.attendus.length)) * 100}%` }} />
                </span>
              </span>
            </span>
            {restants >= 0 ? (
              <Pill tone={restants <= 3 ? 'warn' : 'ok'}>
                <Hourglass size={13} aria-hidden="true" /> {restants === 0 ? 'Dernier jour' : `${restants} j restants`}
              </Pill>
            ) : (
              <Pill tone="neutral">
                <Lock size={13} aria-hidden="true" /> Souhaits clos le {fmtDateCourt(limiteSouhaits(data.officine, mois))}
              </Pill>
            )}
          </>
        ) : null}
        <div className="right row wrap no-print" style={{ gap: 8 }}>
          <BoutonAuto onClick={corriger} disabled={calcul || !brouillons.length} occupe={calcul} focus="corriger" title={brouillons.length ? 'Recalcule les semaines en brouillon en suivant les souhaits. Calcul fait sur cet appareil.' : 'Toutes les semaines du mois sont publiées'}>
            {calcul ? 'Calcul en cours…' : 'Corriger automatiquement'}
          </BoutonAuto>
        </div>
      </div>

      {bilan ? (
        <div className="notice ok mo-bilan" role="status">
          <CircleCheck size={18} aria-hidden="true" />
          <div>
            <b>Planning corrigé</b>
            <div>
              {bilan.souhaitsTotal ? `${Math.round((bilan.souhaitsSuivis / bilan.souhaitsTotal) * 100)} % des souhaits suivis, soit ${bilan.ecartsParPersonne.toFixed(1).replace('.', ',')} écart par personne en moyenne. ` : ''}
              {bilan.corrigees.length} semaine{bilan.corrigees.length > 1 ? 's' : ''} recalculée{bilan.corrigees.length > 1 ? 's' : ''} en brouillon
              {bilan.publiees.length ? `, ${bilan.publiees.length} déjà publiée${bilan.publiees.length > 1 ? 's' : ''} laissée${bilan.publiees.length > 1 ? 's' : ''} telle${bilan.publiees.length > 1 ? 's' : ''} quelle${bilan.publiees.length > 1 ? 's' : ''}` : ''}.
              {bilan.bloquants ? ` ${bilan.bloquants} point${bilan.bloquants > 1 ? 's' : ''} bloquant${bilan.bloquants > 1 ? 's' : ''} à regarder semaine par semaine.` : ' Aucune règle impérative n’est enfreinte.'}
            </div>
          </div>
        </div>
      ) : null}

      <div className="plan-scroll" data-tour="grille" data-focus="mois">
        <table className="mo" aria-label={`Planning de ${titreMois(mois)}`}>
          <thead>
            <tr>
              <th scope="col" className="mo-qui">Équipe</th>
              {dates.map((d) => {
                const ferme = ouverture(data.officine, d).length === 0;
                return (
                  <th key={d} scope="col" className={`${d.startsWith(mois) ? '' : 'hors '}${ferme ? 'ferme ' : ''}${d === today ? 'auj ' : ''}${weekday(d) === 0 ? 'lundi' : ''}`}>
                    <button type="button" className="mo-jour" onClick={() => voirJour(d)} title="Voir la journée">
                      <span>{JOURS[weekday(d)].charAt(0).toUpperCase()}</span>
                      <b className="num">{Number(d.slice(8))}</b>
                      <span className="sr">, {JOURS[weekday(d)]} : voir la journée</span>
                    </button>
                  </th>
                );
              })}
            </tr>
            <tr className="mo-objectif">
              <th scope="row" className="mo-qui">
                <span className="row" style={{ gap: 8 }}>
                  <Target size={16} aria-hidden="true" /> Objectif d’équipe
                </span>
              </th>
              {dates.map((d) => {
                const o = objectifs.get(d);
                const vide = !data.shifts.some((s) => s.date === d);
                return (
                  <td key={d} className={`${d.startsWith(mois) ? '' : 'hors '}${weekday(d) === 0 ? 'lundi' : ''}`}>
                    {o && !vide ? (
                      <span className={`mo-obj num ${o.present >= o.requis ? 'ok' : 'ko'}`} title={o.present >= o.requis ? 'Effectif atteint toute la journée' : `Au moment le plus tendu : ${o.present} au comptoir pour ${o.requis} attendus`}>
                        {o.present}/{o.requis}
                      </span>
                    ) : (
                      <span className="mo-obj vide" aria-hidden="true">·</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {personnes.map((p) => {
              const h = heuresMois(data, p, mois);
              const delta = Math.round((h.minutes - h.cible) / 60);
              return (
                <tr key={p.id}>
                  <th scope="row" className="mo-qui">
                    <span className="mo-personne">
                      <Avatar person={p} />
                      <span className="grow" style={{ minWidth: 0 }}>
                        <b>{nomCourt(p)}</b>
                        <span className="mo-heures num">
                          {heures(h.minutes)}/{heures(h.cible)} h
                          {delta ? <i className={delta < 0 ? 'moins' : 'plus'}>{delta > 0 ? '+' : '−'}{Math.abs(delta)} h</i> : <i className="pile">pile</i>}
                          <span className="soft">{Math.round((p.heuresHebdo / 35) * 100)} %</span>
                        </span>
                      </span>
                    </span>
                  </th>
                  {dates.map((d) => {
                    const postes = parCase.get(`${p.id}|${d}`) ?? [];
                    const absence = data.absences.find((a) => a.personId === p.id && a.statut === 'approuvee' && a.from <= d && d <= a.to);
                    const choix = souhaitDe(data, p.id, d);
                    const cls = `${d.startsWith(mois) ? '' : 'hors '}${weekday(d) === 0 ? 'lundi ' : ''}`;
                    if (absence) {
                      return (
                        <td key={d} className={cls}>
                          <span className={`mo-c abs ${classeAbsence(absence.type)}`} title="Absence approuvée" />
                        </td>
                      );
                    }
                    if (postes.length) {
                      const m = momentDe(postes[0]);
                      const suivi = choix ? souhaitRespecte({ personId: p.id, date: d, choix }, postes) : true;
                      return (
                        <td key={d} className={cls}>
                          <button type="button" className={`mo-c ${m}${suivi ? '' : ' ecart'}`} onClick={() => ouvrirSemaine(d)} aria-label={`${nomCourt(p)}, ${JOURS[weekday(d)]} ${Number(d.slice(8))} : ${m === 'soir' ? 'après-midi' : m === 'matin' ? 'matin' : 'journée'}${choix && !suivi ? `, souhait non suivi (${SOUHAIT_LABEL[choix]})` : ''}. Ouvrir la semaine`}>
                            {LETTRE[m]}
                          </button>
                        </td>
                      );
                    }
                    return (
                      <td key={d} className={cls}>
                        {choix && collaboratif ? <span className={`mo-c souhait ${choix}`} title={`Souhait : ${SOUHAIT_LABEL[choix]}`}>{LETTRE[choix]}</span> : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mo-legende small soft">
        <span><i className="mo-c matin">M</i> Matin</span>
        <span><i className="mo-c journee">J</i> Journée</span>
        <span><i className="mo-c soir">A</i> Après-midi</span>
        {collaboratif ? <span><i className="mo-c souhait repos">R</i> Souhait posé, pas encore de poste</span> : null}
        {collaboratif ? <span><i className="mo-c journee ecart">J</i> Poste différent du souhait</span> : null}
        <span><i className="mo-c abs conge" /> Absence</span>
      </div>
    </div>
  );
}
