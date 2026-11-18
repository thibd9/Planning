import { CalendarCheck, CalendarClock, CalendarPlus, CalendarX, Check, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PROFILS } from '../../domain/profils';
import { JOURS, addDays, fmtHHMM, fmtHeure, fmtJourMois, parseHHMM, weekday } from '../../domain/time';
import type { AppData, ISODate, RendezVous } from '../../domain/types';
import { RDV_STATUT_LABEL, nomComplet, nomCourt } from '../../domain/types';
import { responsable } from '../../domain/acces';
import { autreDuRdv, avisRdv, proposerRdv, rdvAVenir } from '../../engine/rdv';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Dialog } from '../kit';

const jourLong = (date: ISODate): string => `${JOURS[weekday(date)]} ${fmtJourMois(date)}`;
export const quandRdv = (r: Pick<RendezVous, 'date' | 'start' | 'end'>): string => `${jourLong(r.date)}, ${fmtHeure(r.start)} – ${fmtHeure(r.end)}`;
const DUREES = [15, 30, 45, 60];
const AUTRE = 'Autre sujet';

/**
 * Demander un rendez-vous, ou proposer un autre horaire pour une demande reçue (`rdv`).
 * Le sujet vient du profil de la personne ; Solvéa propose des moments où les deux sont en poste.
 */
export function DialogueRendezVous({ de, avec, rdv, sujet: sujetVoulu, onClose }: { de: string; avec?: string; rdv?: RendezVous; sujet?: string; onClose: () => void }): JSX.Element | null {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const demander = useStore((s) => s.demanderRendezVous);
  const deplacer = useStore((s) => s.deplacerRendezVous);
  const dire = useUi((s) => s.dire);
  const moi = data.personnes.find((p) => p.id === de);
  const collegues = data.personnes.filter((p) => !p.externe && p.id !== de);
  const chef = responsable(data);
  const [qui, setQui] = useState(rdv ? autreDuRdv(rdv, de) : (avec ?? (chef && chef.id !== de ? chef.id : (collegues[0]?.id ?? ''))));
  const sujets = moi ? PROFILS[moi.qualification].sujets : [AUTRE];
  const [sujet, setSujet] = useState(sujetVoulu && sujets.includes(sujetVoulu) ? sujetVoulu : sujets[0]);
  const [libre, setLibre] = useState('');
  const [minutes, setMinutes] = useState(rdv ? Math.max(15, rdv.end - rdv.start) : 30);
  const [date, setDate] = useState<ISODate>(rdv?.date ?? '');
  const [debut, setDebut] = useState(rdv?.start ?? 14 * 60);
  const [note, setNote] = useState('');
  const propositions = useMemo(() => (qui ? proposerRdv(data, de, qui, minutes, today) : []), [data, de, qui, minutes, today]);
  // Tant qu'aucun jour n'est choisi, le premier moment proposé est retenu.
  const jour = date || propositions[0]?.date || addDays(today, 1);
  const depart = date ? debut : (propositions[0]?.start ?? debut);
  const moment = { date: jour, start: depart, end: depart + minutes };
  const autre = data.personnes.find((p) => p.id === qui);
  const avis = useMemo(() => avisRdv(data, { de, avec: qui, ...moment, id: rdv?.id }, today), [data, de, qui, moment.date, moment.start, moment.end, rdv?.id, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const objet = rdv ? rdv.sujet : sujet === AUTRE ? libre.trim() : sujet;
  if (!moi) return null;
  const pret = !!qui && !!objet && !avis.bloquants.length;
  const envoyer = (): void => {
    if (rdv) deplacer(rdv.id, de, moment);
    else demander({ de, avec: qui, sujet: objet, ...moment, note });
    dire(rdv ? `Autre horaire proposé à ${autre ? nomCourt(autre) : ''} : ${quandRdv(moment)}.` : `Demande de rendez-vous envoyée à ${autre ? nomCourt(autre) : ''} : ${quandRdv(moment)}.`, true);
    onClose();
  };
  return (
    <Dialog
      size="mid"
      title={rdv ? 'Proposer un autre horaire' : 'Demander un rendez-vous'}
      subtitle={rdv ? `« ${rdv.sujet} » avec ${autre ? nomCourt(autre) : ''}. Votre proposition remplace l’horaire demandé.` : 'La demande part dans la conversation. Une fois acceptée, le rendez-vous est fixé dans les deux agendas.'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn primary" id="rdv-envoyer" disabled={!pret} onClick={envoyer}>
            <CalendarPlus size={15} aria-hidden="true" /> {rdv ? 'Proposer cet horaire' : 'Envoyer la demande'}
          </button>
        </>
      }
    >
      {!rdv ? (
        <div className="champs">
          <label className="field" htmlFor="rdv-avec">
            Avec
            <select id="rdv-avec" value={qui} onChange={(e) => setQui(e.target.value)} data-autofocus>
              {collegues.map((p) => (
                <option key={p.id} value={p.id}>
                  {nomComplet(p)}
                </option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor="rdv-sujet">
            Sujet
            <select id="rdv-sujet" value={sujet} onChange={(e) => setSujet(e.target.value)}>
              {sujets.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      {!rdv && sujet === AUTRE ? (
        <label className="field" htmlFor="rdv-sujet-libre">
          Précisez le sujet
          <input id="rdv-sujet-libre" value={libre} onChange={(e) => setLibre(e.target.value)} maxLength={80} placeholder="En quelques mots" autoComplete="off" />
        </label>
      ) : null}

      <section className="rat-bloc" aria-labelledby="rdv-quand">
        <h3 id="rdv-quand">Quand ?</h3>
        {propositions.length ? (
          <div className="rdv-idees" role="group" aria-label="Moments proposés par Solvéa">
            <span className="rdv-idees-tete">
              <Sparkles size={14} aria-hidden="true" /> Solvéa propose, quand vous êtes tous les deux en poste
            </span>
            {propositions.map((c) => {
              const on = c.date === moment.date && c.start === moment.start;
              return (
                <button key={c.date} type="button" className={`comp${on ? ' on' : ''}`} aria-pressed={on} onClick={() => { setDate(c.date); setDebut(c.start); }}>
                  <span className="cap1">
                    {jourLong(c.date)} · {fmtHeure(c.start)}
                  </span>
                  {on ? <Check size={14} strokeWidth={3} className="comp-coche" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="small soft">Aucun moment commun en poste sur les trois prochaines semaines : choisissez le jour et l’heure.</p>
        )}
        <div className="champs rat-champs">
          <label className="field" htmlFor="rdv-date">
            Jour
            <input id="rdv-date" type="date" min={today} max={addDays(today, 120)} value={jour} onChange={(e) => { if (e.target.value) { setDate(e.target.value); setDebut(depart); } }} />
          </label>
          <label className="field" htmlFor="rdv-debut">
            À
            <input id="rdv-debut" type="time" step={900} value={fmtHHMM(depart)} onChange={(e) => { const v = parseHHMM(e.target.value); if (v !== null) { setDate(jour); setDebut(v); } }} />
          </label>
          <label className="field" htmlFor="rdv-duree">
            Durée
            <select id="rdv-duree" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {[...new Set([...DUREES, minutes])].sort((a, b) => a - b).map((m) => (
                <option key={m} value={m}>
                  {m === 60 ? '1 heure' : `${m} minutes`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={`rat-controle ${avis.bloquants.length ? 'ko' : avis.infos.length ? 'attention' : 'ok'}`} role="status" id="rdv-avis">
          {avis.bloquants.length ? <X size={17} aria-hidden="true" /> : <CalendarCheck size={17} aria-hidden="true" />}
          <div>
            <b className="cap1">{avis.bloquants.length ? 'Ce moment ne convient pas' : quandRdv(moment)}</b>
            {[...avis.bloquants, ...avis.infos].length ? (
              <ul>
                {[...avis.bloquants, ...avis.infos].map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </section>

      {!rdv ? (
        <label className="field" htmlFor="rdv-note">
          <span>
            Un mot pour {autre?.prenom ?? 'la personne'} <span className="soft">(facultatif)</span>
          </span>
          <textarea id="rdv-note" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ce que vous aimeriez aborder." />
        </label>
      ) : null}
    </Dialog>
  );
}

/** La carte d'un rendez-vous dans la conversation : son état du moment, et les réponses possibles pour qui doit répondre. */
export function CarteRendezVous({ rdv, moi }: { rdv: RendezVous; moi: string }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const repondre = useStore((s) => s.repondreRendezVous);
  const dire = useUi((s) => s.dire);
  const [deplace, setDeplace] = useState(false);
  const concerne = rdv.de === moi || rdv.avec === moi;
  const aMoi = concerne && rdv.statut === 'propose' && rdv.attend === moi;
  const autre = data.personnes.find((p) => p.id === autreDuRdv(rdv, moi));
  const passe = rdv.date < today;
  const empeche = aMoi ? avisRdv(data, rdv, today).bloquants : [];
  const Icone = rdv.statut === 'fixe' ? CalendarCheck : rdv.statut === 'propose' ? CalendarClock : CalendarX;
  return (
    <div className={`rdv-carte ${rdv.statut}`} data-rdv={rdv.id}>
      <span className="rdv-ico" aria-hidden="true">
        <Icone size={18} />
      </span>
      <div className="grow">
        <div className="rdv-etat">{rdv.statut === 'propose' && !aMoi && concerne ? `En attente de la réponse de ${autre?.prenom ?? ''}` : RDV_STATUT_LABEL[rdv.statut]}</div>
        <b>{rdv.sujet}</b>
        <div className="rdv-quand cap1">{quandRdv(rdv)}</div>
        {empeche.length ? <p className="tiny rdv-empeche">{empeche[0]} Proposez un autre horaire.</p> : null}
        {concerne && !passe && (rdv.statut === 'propose' || rdv.statut === 'fixe') ? (
          <div className="rdv-actions">
            {aMoi ? (
              <>
                <button type="button" className="btn primary sm" disabled={empeche.length > 0} onClick={() => { repondre(rdv.id, moi, 'accepter'); dire(`Rendez-vous fixé : ${quandRdv(rdv)}. Il est dans votre agenda.`, true); }}>
                  <Check size={14} aria-hidden="true" /> Accepter
                </button>
                <button type="button" className="btn sm" onClick={() => setDeplace(true)}>
                  Proposer un autre horaire
                </button>
                <button type="button" className="btn sm" onClick={() => repondre(rdv.id, moi, 'decliner')}>
                  Décliner
                </button>
              </>
            ) : (
              <>
                {rdv.statut === 'fixe' ? (
                  <button type="button" className="btn sm" onClick={() => setDeplace(true)}>
                    Déplacer
                  </button>
                ) : null}
                <button type="button" className="btn sm" onClick={() => repondre(rdv.id, moi, 'annuler')}>
                  Annuler le rendez-vous
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
      {deplace ? <DialogueRendezVous de={moi} rdv={rdv} onClose={() => setDeplace(false)} /> : null}
    </div>
  );
}

/** Les rendez-vous à venir d'une personne : fixés, ou en attente de réponse. Sert à l'espace de chacun et au tableau de bord. */
export function ProchainsRendezVous({ data, personId, today, onOuvrir }: { data: AppData; personId: string; today: ISODate; onOuvrir: (autre: string) => void }): JSX.Element | null {
  const liste = rdvAVenir(data, personId, today).slice(0, 4);
  if (!liste.length) return null;
  return (
    <ul className="rdv-liste">
      {liste.map((r) => {
        const autre = data.personnes.find((p) => p.id === autreDuRdv(r, personId));
        const aMoi = r.statut === 'propose' && r.attend === personId;
        return (
          <li key={r.id}>
            <button type="button" className={`rdv-ligne ${r.statut}`} onClick={() => onOuvrir(autreDuRdv(r, personId))}>
              <span className="rdv-ico" aria-hidden="true">
                {r.statut === 'fixe' ? <CalendarCheck size={17} /> : <CalendarClock size={17} />}
              </span>
              <span className="grow">
                <b className="cap1">{quandRdv(r)}</b>
                <span className="small soft">
                  {r.sujet} · avec {autre ? nomCourt(autre) : ''}
                </span>
              </span>
              <span className={`rat-tag${r.statut === 'fixe' ? ' ok' : aMoi ? ' warn' : ''}`}>{r.statut === 'fixe' ? 'Fixé' : aMoi ? 'À vous de répondre' : 'En attente'}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
