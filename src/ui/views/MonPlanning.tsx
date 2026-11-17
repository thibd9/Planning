import { Ban, BellRing, CalendarClock, Check, CircleCheck, Moon, Plus, Stethoscope } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  JOURS,
  addDays,
  dayIndex,
  fmtDateCourt,
  fmtDateLong,
  fmtDuree,
  fmtHHMM,
  fmtHeure,
  fmtHorodatage,
  fmtJourMois,
  fmtSemaine,
  isoWeek,
  mondayOf,
  weekDates,
  weekday,
} from '../../domain/time';
import type { ISODate, Shift } from '../../domain/types';
import { ABSENCE_LABEL, GARDE_LABEL, MISSION_LABEL, estPharmacien } from '../../domain/types';
import { decrireBesoin, decrireShift, minutesTravail } from '../../engine/core';
import type { CompteurCle } from '../../engine/equity';
import { COMPTEUR_LABEL, equite } from '../../engine/equity';
import { useStore } from '../../store/store';
import { DialogueDemande } from '../components/Demande';
import { AvantApres, Pill, Track, roleDe } from '../kit';
import { echelleOfficine } from './Construire';
import { STATUT_BESOIN } from './Equipe';
import { Ecart } from './Equite';
import { usagePlafond } from './Resoudre';

export function MonPlanning({ personId }: { personId: string }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const lire = useStore((s) => s.lireNotification);
  const [demande, setDemande] = useState(false);
  const person = data.personnes.find((p) => p.id === personId);
  const lundi = mondayOf(today);
  const echelle = echelleOfficine(data);

  // L'espace salarié ne montre que la version publiée : jamais un brouillon.
  const publies = (monday: ISODate): Shift[] | null => {
    const s = data.semaines[monday];
    return s?.statut === 'publie' ? (s.snapshot ?? []).filter((x) => x.personId === personId) : null;
  };
  const semaines = [lundi, addDays(lundi, 7), addDays(lundi, 14)];
  const aVenir = semaines
    .flatMap((m) => publies(m) ?? [])
    .filter((s) => s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const prochain = aVenir[0];
  const changements = data.notifications.filter((n) => n.personId === personId && dayIndex(n.date) >= dayIndex(today) - 7);
  const nonLus = changements.filter((n) => !n.luLe);
  const besoins = data.besoins.filter((b) => b.personId === personId && (!b.to || b.to >= today));
  const absences = data.absences.filter((a) => a.personId === personId && a.to >= today);
  const usage = usagePlafond(data, personId, today);
  const ligne = useMemo(() => equite(data, addDays(lundi, -56), addDays(lundi, 6)).find((l) => l.personId === personId), [data, lundi, personId]);
  const compteurs: CompteurCle[] = person && estPharmacien(person) ? ['samedis', 'fermetures', 'gardes', 'changementsTardifs'] : ['samedis', 'fermetures', 'changementsTardifs'];

  if (!person) return <div className="empty">Personne introuvable.</div>;
  const quand = (date: ISODate): string => (date === today ? 'Aujourd’hui' : date === addDays(today, 1) ? 'Demain' : fmtDateLong(date).replace(/ \d{4}$/, ''));

  return (
    <div className="me">
      <div className="hero">
        <div className="eyebrow">Mon planning · {fmtDateLong(today)}</div>
        <h1>Bonjour {person.prenom}</h1>
        {prochain ? (
          <p style={{ fontSize: 17 }}>
            Prochain poste : <b>{quand(prochain.date).toLowerCase()}</b>, {decrireShift(prochain)}.
          </p>
        ) : (
          <p style={{ fontSize: 17 }}>Aucun poste publié à venir pour l'instant.</p>
        )}
        <div className="row wrap" style={{ marginTop: 14, position: 'relative', zIndex: 1 }}>
          <button type="button" className="btn" onClick={() => setDemande(true)}>
            <Plus size={15} /> Faire une demande
          </button>
          {nonLus.length ? (
            <Pill tone="miel">
              <BellRing size={13} /> {nonLus.length} changement{nonLus.length > 1 ? 's' : ''} à lire
            </Pill>
          ) : (
            <span className="small soft">Aucun changement en attente de lecture.</span>
          )}
        </div>
      </div>

      {changements.length ? (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-head">
            <BellRing size={18} />
            <h2 className="h3 grow">Ce qui a changé</h2>
          </div>
          {changements.map((n) => (
            <div key={n.id} className="decision" style={{ alignItems: 'center' }}>
              <div className="grow">
                <b style={{ textTransform: 'capitalize' }}>{fmtDateCourt(n.date)}</b>
                <div style={{ marginTop: 2 }}>
                  <AvantApres avant={n.avant} apres={n.apres} />
                </div>
                <div className="small soft" style={{ marginTop: 2 }}>
                  Modifié le {fmtHorodatage(n.at)}
                  {n.tardif ? ' · prévenu moins de 7 jours avant' : ''}
                </div>
              </div>
              {n.luLe ? (
                <Pill tone="ok">
                  <Check size={13} /> Vu le {fmtJourMois(n.luLe.slice(0, 10))}
                </Pill>
              ) : (
                <button type="button" className="btn primary sm" onClick={() => lire(n.id)}>
                  J'ai vu ce changement
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <div className="me-grid">
        <div className="col" style={{ gap: 18 }}>
          {semaines.slice(0, 2).map((monday) => {
            const postes = publies(monday);
            const total = (postes ?? []).reduce((t, s) => t + minutesTravail(s), 0);
            const statut = data.semaines[monday];
            return (
              <div key={monday} className="card">
                <div className="card-head">
                  <CalendarClock size={18} />
                  <div className="grow">
                    <h2 className="h3">
                      {monday === lundi ? 'Cette semaine' : 'Semaine prochaine'} · {fmtSemaine(monday)}
                    </h2>
                    <div className="small soft">
                      {postes ? `Semaine ${isoWeek(monday)} · ${fmtDuree(total)} prévues · publié le ${fmtHorodatage(statut?.publishedAt ?? '')}` : 'Planning pas encore publié'}
                    </div>
                  </div>
                </div>
                {postes ? (
                  <div className="day-list">
                    {weekDates(monday).map((date) => {
                      const duJour = postes.filter((s) => s.date === date).sort((a, b) => a.start - b.start);
                      const absence = absences.find((a) => a.statut === 'approuvee' && a.from <= date && date <= a.to);
                      const gardes = data.gardes.filter((g) => g.personId === personId && g.date === date);
                      const missions = data.missions.filter((m) => m.personId === personId && m.date === date);
                      if (weekday(date) === 6 && !duJour.length && !gardes.length) return null;
                      return (
                        <div key={date} className={`day-row${date === today ? ' today' : ''}`}>
                          <div>
                            <div className="dn">{JOURS[weekday(date)]}</div>
                            <div className="small soft">{fmtJourMois(date)}</div>
                          </div>
                          <div className="col" style={{ gap: 5 }}>
                            {duJour.length ? <Track shifts={duJour} echelle={echelle} role={roleDe(person)} missions={missions} /> : null}
                            <div className="row wrap" style={{ gap: 8 }}>
                              {absence ? (
                                <Pill>
                                  <Ban size={12} /> {ABSENCE_LABEL[absence.type]}
                                </Pill>
                              ) : duJour.length ? (
                                duJour.map((s) => (
                                  <b key={s.id} className="num">
                                    {decrireShift(s)}
                                  </b>
                                ))
                              ) : (
                                <span className="muted">Repos</span>
                              )}
                              {missions.map((m) => (
                                <Pill key={m.id} tone="miel">
                                  <Stethoscope size={12} /> {MISSION_LABEL[m.type]} · {fmtHeure(m.start)}
                                </Pill>
                              ))}
                              {gardes.map((g) => (
                                <Pill key={g.id} tone="nuit">
                                  <Moon size={12} /> {GARDE_LABEL[g.type]} · {fmtHHMM(g.start)} → {fmtHHMM(g.end)}
                                </Pill>
                              ))}
                            </div>
                          </div>
                          <span className="small soft num">{duJour.length ? fmtDuree(duJour.reduce((t, s) => t + minutesTravail(s), 0)) : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="card-body soft">Votre responsable prépare encore cette semaine. Vous serez prévenu dès la publication.</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="col" style={{ gap: 18 }}>
          <div className="card">
            <div className="card-head">
              <h2 className="h3 grow">Mes demandes</h2>
              <button type="button" className="btn sm" onClick={() => setDemande(true)}>
                <Plus size={14} /> Nouvelle
              </button>
            </div>
            <div className="card-body col" style={{ gap: 10 }}>
              {!besoins.length && !absences.length ? <p className="soft small">Aucune demande en cours.</p> : null}
              {absences.map((a) => (
                <div key={a.id} className="row wrap">
                  <div className="grow">
                    <b>{ABSENCE_LABEL[a.type]}</b>
                    <div className="small soft">
                      Du {fmtDateCourt(a.from)} au {fmtDateCourt(a.to)}
                    </div>
                  </div>
                  <Pill tone={a.statut === 'approuvee' ? 'ok' : a.statut === 'refusee' ? 'danger' : 'warn'}>{a.statut === 'approuvee' ? 'Approuvée' : a.statut === 'refusee' ? 'Refusée' : 'En attente'}</Pill>
                </div>
              ))}
              {besoins.map((b) => (
                <div key={b.id} className="row wrap">
                  <div className="grow" style={{ minWidth: 180 }}>
                    <b>{decrireBesoin(b)}</b>
                    <div className="small soft">
                      {b.decision === 'acceptee'
                        ? b.statut === 'reconnue'
                          ? 'Votre planning en tient compte à coup sûr.'
                          : b.statut === 'prioritaire'
                            ? 'Servie avant les autres souhaits, sans être garantie.'
                            : 'Un souhait : satisfait quand c’est possible.'
                        : b.decision === 'refusee'
                          ? 'Demande refusée par votre responsable.'
                          : 'En attente de la décision de votre responsable.'}
                    </div>
                  </div>
                  {b.decision === 'acceptee' ? (
                    <Pill tone={STATUT_BESOIN[b.statut].tone}>{STATUT_BESOIN[b.statut].label}</Pill>
                  ) : (
                    <Pill tone={b.decision === 'refusee' ? 'danger' : 'warn'}>{b.decision === 'refusee' ? 'Refusée' : 'En attente'}</Pill>
                  )}
                </div>
              ))}
              <div className="notice small">
                <CircleCheck size={15} />
                <div>
                  Souhaits prioritaires utilisés : <b>{usage.actifs} sur {usage.plafond}</b>, comme pour tous vos collègues. On ne vous demande jamais la raison d'une demande.
                </div>
              </div>
            </div>
          </div>

          {ligne ? (
            <div className="card">
              <div className="card-head">
                <h2 className="h3 grow">Ma part des contraintes</h2>
                <span className="small soft">8 dernières semaines</span>
              </div>
              <div className="card-body col" style={{ gap: 12 }}>
                {compteurs.map((c) => (
                  <div key={c}>
                    <div className="small soft" style={{ marginBottom: 3 }}>{COMPTEUR_LABEL[c]}</div>
                    <Ecart ligne={ligne} cle={c} max={3} />
                  </div>
                ))}
                <p className="tiny muted">
                  Comparé à votre part attendue, au prorata de votre temps de travail. Vous ne voyez que votre position : il n'existe aucun classement de l'équipe.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {demande ? <DialogueDemande personId={personId} espace="salarie" onClose={() => setDemande(false)} /> : null}
    </div>
  );
}
