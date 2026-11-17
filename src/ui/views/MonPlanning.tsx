import { ArrowLeftRight, Ban, BellRing, CalendarClock, Check, CircleCheck, Coffee, HandHelping, Moon, Plus, Printer, Stethoscope, Sun, Sunset } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import { ABSENCE_LABEL, GARDE_LABEL, MISSION_LABEL, estPharmacien, nomCourt } from '../../domain/types';
import { decrireBesoin, decrireShift, minutesTravail } from '../../engine/core';
import type { CompteurCle } from '../../engine/equity';
import { peutRemplacer } from '../../engine/remplacement';
import { COMPTEUR_LABEL, equite } from '../../engine/equity';
import { HEBERGE } from '../../env';
import { useStore } from '../../store/store';
import { DialogueDemande } from '../components/Demande';
import { useUi } from '../../store/ui';
import { AvantApres, Frise, Graduations, Pill, Seg, momentDe } from '../kit';
import { Calendrier } from '../components/Calendrier';
import { echelleOfficine } from './Construire';
import { STATUT_BESOIN } from './Equipe';
import { Ecart } from './Equite';
import { usagePlafond } from './Resoudre';

export function MonPlanning({ personId }: { personId: string }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const lire = useStore((s) => s.lireNotification);
  const { demanderRemplacement, seProposer, cloreRemplacement } = useStore();
  const dire = useUi((s) => s.dire);
  const [demande, setDemande] = useState(false);
  const { intention, setIntention } = useUi();
  useEffect(() => {
    if (intention === 'demande') {
      setDemande(true);
      setIntention(null);
    }
  }, [intention, setIntention]);
  const [affichage, setAffichage] = useState<'semaine' | 'calendrier'>('semaine');
  const [mois, setMois] = useState(today.slice(0, 7));
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

  // Lecture rapide : aujourd'hui, demain, puis le prochain jour travaillé.
  const jourDe = (date: ISODate): Shift[] => aVenir.filter((s) => s.date === date);
  const demain = addDays(today, 1);
  const ensuite = aVenir.find((s) => s.date > demain)?.date;
  const rapides: { titre: string; date: ISODate }[] = [
    { titre: 'Aujourd’hui', date: today },
    { titre: 'Demain', date: demain },
    ...(ensuite ? [{ titre: 'Ensuite', date: ensuite }] : []),
  ];
  const ouvertes = data.remplacements.filter((r) => r.statut === 'ouverte' && r.date >= today);
  const mesRemplacements = ouvertes.filter((r) => r.demandeur === personId);
  const aAider = person ? ouvertes.filter((r) => peutRemplacer(data, r, person)) : [];
  const enCours = (shiftId: string): boolean => mesRemplacements.some((r) => r.shiftId === shiftId);

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
          {!HEBERGE ? (
            <button type="button" className="btn no-print" onClick={() => window.print()}>
              <Printer size={15} aria-hidden="true" /> Imprimer mon planning
            </button>
          ) : null}
          <button type="button" className="btn primary no-print" onClick={() => setDemande(true)}>
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

      <section aria-label="Mes horaires en un coup d’œil" className="bientot" style={{ marginTop: 18 }}>
        {rapides.map(({ titre, date }) => {
          const postes = jourDe(date);
          const absence = absences.find((a) => a.statut === 'approuvee' && a.from <= date && date <= a.to);
          const garde = data.gardes.find((g) => g.personId === personId && g.date === date);
          return (
            <div key={titre} className={`jour${date === today ? ' auj' : ''}`}>
              <span className={`moment ${absence ? (absence.type === 'conge' ? 'conge' : 'arret') : postes.length ? momentDe({ start: postes[0].start, end: postes[postes.length - 1].end }) : 'repos'}`} aria-hidden="true" style={{ float: 'right' }}>
                {absence ? <Ban size={17} /> : !postes.length ? <Coffee size={17} /> : momentDe({ start: postes[0].start, end: postes[postes.length - 1].end }) === 'soir' ? <Sunset size={17} /> : <Sun size={17} />}
              </span>
              <div className="eyebrow">{titre}</div>
              <div className="small soft cap1">{fmtDateCourt(date)}</div>
              <div className="h num">{absence ? ABSENCE_LABEL[absence.type] : postes.length ? postes.map((s) => `${fmtHeure(s.start)} – ${fmtHeure(s.end)}`).join(' · ') : 'Repos'}</div>
              <div className="small soft">
                {postes.length ? `${fmtDuree(postes.reduce((t, s) => t + minutesTravail(s), 0))} de travail` : absence ? 'Absence approuvée' : 'Aucun poste publié'}
                {postes[0]?.pauseStart != null && postes[0]?.pauseEnd != null ? ` · pause ${fmtHeure(postes[0].pauseStart)} – ${fmtHeure(postes[0].pauseEnd)}` : ''}
              </div>
              {garde ? (
                <div style={{ marginTop: 8 }}>
                  <Pill tone="nuit">
                    <Moon size={12} aria-hidden="true" /> {GARDE_LABEL[garde.type]} · {fmtHHMM(garde.start)} → {fmtHHMM(garde.end)}
                  </Pill>
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      {aAider.length ? (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-head">
            <span className="ico" aria-hidden="true">
              <HandHelping size={18} />
            </span>
            <div className="grow">
              <h2 className="h3">Un collègue cherche un remplaçant</h2>
              <div className="small soft">Vous proposer n’engage à rien tant que le responsable n’a pas validé.</div>
            </div>
          </div>
          {aAider.map((r) => {
            const d = data.personnes.find((p) => p.id === r.demandeur);
            const propose = r.volontaires.includes(personId);
            const occupe = aVenir.some((s) => s.date === r.date && s.start < r.end && r.start < s.end);
            return (
              <div key={r.id} className="decision" style={{ alignItems: 'center' }}>
                <div className="grow">
                  <b className="cap1">{fmtDateCourt(r.date)}</b> · <span className="num">{fmtHeure(r.start)} – {fmtHeure(r.end)}</span>
                  <div className="small soft">
                    Demandé par {d ? nomCourt(d) : 'un collègue'}
                    {occupe ? ' · vous travaillez déjà sur cet horaire' : ''}
                  </div>
                </div>
                {propose ? (
                  <>
                    <Pill tone="ok">
                      <Check size={13} aria-hidden="true" /> Vous êtes volontaire
                    </Pill>
                    <button type="button" className="btn sm" onClick={() => seProposer(r.id, personId, false)}>
                      Retirer
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn primary sm"
                    disabled={occupe}
                    onClick={() => {
                      seProposer(r.id, personId, true);
                      dire('Vous êtes volontaire. Le responsable valide le remplacement.', true);
                    }}
                  >
                    Je me propose
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {changements.length ? (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-head">
            <BellRing size={18} />
            <h2 className="h3 grow">Ce qui a changé</h2>
          </div>
          {changements.map((n) => (
            <div key={n.id} className="decision" style={{ alignItems: 'center' }}>
              <div className="grow">
                <b className="cap1">{fmtDateCourt(n.date)}</b>
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
          <div className="row wrap">
            <h2 className="grow">{affichage === 'semaine' ? 'Mes semaines' : 'Mon calendrier'}</h2>
            <Seg
              label="Affichage du planning"
              value={affichage}
              onChange={setAffichage}
              options={[
                { value: 'semaine', label: 'Semaine' },
                { value: 'calendrier', label: 'Calendrier' },
              ]}
            />
          </div>

          {affichage === 'calendrier' ? (
            <Calendrier data={data} personId={personId} today={today} mois={mois} setMois={setMois} />
          ) : (
            semaines.slice(0, 2).map((monday) => {
              const postes = publies(monday);
              const absentLe = (date: ISODate): boolean => absences.some((x) => x.statut === 'approuvee' && x.from <= date && date <= x.to);
              const total = (postes ?? []).filter((x) => !absentLe(x.date)).reduce((t, x) => t + minutesTravail(x), 0);
              const statut = data.semaines[monday];
              return (
                <div key={monday} className="card">
                  <div className="card-head">
                    <CalendarClock size={18} aria-hidden="true" />
                    <div className="grow">
                      <h3 style={{ fontSize: 17 }}>
                        {monday === lundi ? 'Cette semaine' : 'Semaine prochaine'} · {fmtSemaine(monday)}
                      </h3>
                      <div className="small soft">
                        {postes ? `Semaine ${isoWeek(monday)} · ${fmtDuree(total)} prévues · publié le ${fmtHorodatage(statut?.publishedAt ?? '')}` : 'Planning pas encore publié'}
                      </div>
                    </div>
                  </div>
                  {postes ? (
                    <div className="jours-h">
                      <div className="jour-h regle" aria-hidden="true">
                        <span />
                        <Graduations echelle={echelle} />
                      </div>
                      {weekDates(monday).map((date) => {
                        const absence = absences.find((x) => x.statut === 'approuvee' && x.from <= date && date <= x.to);
                        // Un jour d'absence approuvée ne montre plus le poste prévu : il a été retiré.
                        const duJour = absence ? [] : postes.filter((x) => x.date === date).sort((x, y) => x.start - y.start);
                        const gardes = data.gardes.filter((g) => g.personId === personId && g.date === date);
                        const missions = absence ? [] : data.missions.filter((m) => m.personId === personId && m.date === date);
                        if (weekday(date) === 6 && !duJour.length && !gardes.length) return null;
                        const moment = duJour.length ? momentDe({ start: duJour[0].start, end: duJour[duJour.length - 1].end }) : null;
                        return (
                          <div key={date} className={`jour-h${date === today ? ' today' : ''}`}>
                            <div className="jh-date">
                              <b className="cap1">{JOURS[weekday(date)]}</b>
                              <span className="small soft">
                                {fmtJourMois(date)}
                                {date === today ? ' · aujourd’hui' : ''}
                              </span>
                            </div>
                            <div className="jh-corps">
                              {duJour.length ? (
                                <>
                                  <div className="jh-titre">
                                    <span className={`moment ${moment}`} aria-hidden="true">
                                      {moment === 'soir' ? <Sunset size={17} /> : <Sun size={17} />}
                                    </span>
                                    <div>
                                      {duJour.map((x) => (
                                        <div key={x.id}>
                                          <b className="jh-heures num">
                                            {fmtHeure(x.start)} – {fmtHeure(x.end)}
                                          </b>
                                          <span className="small soft">
                                            {' '}
                                            {fmtDuree(minutesTravail(x))} de travail
                                            {x.pauseStart !== undefined && x.pauseEnd !== undefined ? ` · pause de ${fmtHeure(x.pauseStart)} à ${fmtHeure(x.pauseEnd)}` : ''}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <Frise shifts={duJour} echelle={echelle} missions={missions} />
                                </>
                              ) : (
                                <div className="jh-titre">
                                  <span className={`moment ${absence ? (absence.type === 'conge' ? 'conge' : 'arret') : 'repos'}`} aria-hidden="true">
                                    {absence ? <Ban size={17} /> : <Coffee size={17} />}
                                  </span>
                                  <b className="jh-heures" style={{ color: 'var(--ink-2)' }}>{absence ? ABSENCE_LABEL[absence.type] : 'Repos'}</b>
                                </div>
                              )}
                              {missions.length || gardes.length ? (
                                <div className="row wrap" style={{ gap: 8 }}>
                                  {missions.map((m) => (
                                    <Pill key={m.id} tone="miel">
                                      <Stethoscope size={12} aria-hidden="true" /> {MISSION_LABEL[m.type]} · {fmtHeure(m.start)}
                                    </Pill>
                                  ))}
                                  {gardes.map((g) => (
                                    <Pill key={g.id} tone="nuit">
                                      <Moon size={12} aria-hidden="true" /> {GARDE_LABEL[g.type]} · {fmtHHMM(g.start)} → {fmtHHMM(g.end)}
                                    </Pill>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="card-body soft">Votre responsable prépare encore cette semaine. Vous serez prévenu dès la publication.</div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="col" style={{ gap: 18 }}>
          <div className="card">
            <div className="card-head">
              <span className="ico" aria-hidden="true">
                <ArrowLeftRight size={18} />
              </span>
              <div className="grow">
                <h2 className="h3">Me faire remplacer</h2>
                <div className="small soft">Sur un poste publié à venir.</div>
              </div>
            </div>
            <div className="card-body col" style={{ gap: 10 }}>
              {!aVenir.length ? <p className="soft small">Aucun poste publié à venir.</p> : null}
              {aVenir.slice(0, 6).map((s) => {
                const r = mesRemplacements.find((x) => x.shiftId === s.id);
                return (
                  <div key={s.id} className="row wrap">
                    <div className="grow" style={{ minWidth: 150 }}>
                      <b className="cap1">{fmtDateCourt(s.date)}</b>
                      <div className="small soft num">
                        {fmtHeure(s.start)} – {fmtHeure(s.end)}
                        {r ? ` · ${r.volontaires.length ? `${r.volontaires.length} volontaire${r.volontaires.length > 1 ? 's' : ''}` : 'en attente d’un volontaire'}` : ''}
                      </div>
                    </div>
                    {r ? (
                      <button type="button" className="btn sm" onClick={() => cloreRemplacement(r.id, 'annulee')}>
                        Annuler la demande
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn sm"
                        disabled={enCours(s.id)}
                        onClick={() => {
                          demanderRemplacement(s);
                          dire('Demande de remplacement envoyée à l’équipe et au responsable.', true);
                        }}
                      >
                        Demander un remplacement
                      </button>
                    )}
                  </div>
                );
              })}
              <p className="tiny muted">Vous restez en poste tant qu’un collègue ne s’est pas proposé et que le responsable n’a pas validé. Aucune raison n’est demandée.</p>
            </div>
          </div>

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
