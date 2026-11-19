import { decrirePauses } from '../../engine/pauses';
import { ArrowRight, Ban, BellRing, CalendarClock, CalendarDays, Check, Coffee, HandHelping, Handshake, Plus, Printer, Stethoscope, Sun, Sunset, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { peutGerer } from '../../domain/acces';
import { JOURS, addDays, dayIndex, fmtDateCourt, fmtDuree, fmtHHMM, fmtHeure, fmtHorodatage, fmtJourMois, fmtSemaine, isoWeek, mondayOf, weekDates, weekday, ferie } from '../../domain/time';
import type { ISODate, Shift } from '../../domain/types';
import { MISSION_LABEL, classeAbsence, libelleAbsence, nomCourt, nomGarde } from '../../domain/types';
import { minutesTravail } from '../../engine/core';
import { autreDuRdv, rdvDe } from '../../engine/rdv';
import { peutRemplacer } from '../../engine/remplacement';
import { IconeGarde } from '../icons';
import { RAISONS_DECLIN, texteDeclin } from '../../domain/refus';
import { DialogueRefus } from '../components/Refus';
import { useStore } from '../../store/store';
import { DialogueDemande } from '../components/Demande';
import { useUi } from '../../store/ui';
import { AvantApres, Pill, Seg, momentDe, Ferie , MOMENT_LABEL } from '../kit';
import { Calendrier } from '../components/Calendrier';
import { ProchainPoste } from '../components/ProchainPoste';
import { PrevenirRetard } from '../components/Retard';
import { AppelRecu } from '../components/Appel';

export function MonPlanning({ personId }: { personId: string }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const lire = useStore((s) => s.lireNotification);
  const { seProposer, declinerAppel } = useStore();
  const [declin, setDeclin] = useState<string | null>(null);
  const dire = useUi((s) => s.dire);
  const [demande, setDemande] = useState(false);
  const { intention, setIntention, voirJour, aller, setSeulementMoi } = useUi();
  const gere = peutGerer(data, data.personnes.find((p) => p.id === personId));
  useEffect(() => {
    if (intention === 'demande') {
      setDemande(true);
      setIntention(null);
    }
    if (intention === 'calendrier' || intention === 'semaine') {
      setAffichage(intention);
      setIntention(null);
    }
  }, [intention, setIntention]);
  const [affichage, setAffichage] = useState<'semaine' | 'calendrier'>('semaine');
  const [mois, setMois] = useState(today.slice(0, 7));
  const person = data.personnes.find((p) => p.id === personId);
  const lundi = mondayOf(today);

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
  const changements = data.notifications.filter((n) => n.personId === personId && dayIndex(n.date) >= dayIndex(today) - 7);
  const nonLus = changements.filter((n) => !n.luLe);
  const absences = data.absences.filter((a) => a.personId === personId && a.to >= today);

  const ouvertes = data.remplacements.filter((r) => r.statut === 'ouverte' && r.date >= today);
  // Un appel à l'équipe s'adresse à tous ceux qui ont été prévenus ; une demande de remplacement, à ceux qui ont la qualification.
  // Une demande adressée à un collègue précis n'apparaît que chez lui, dès son envoi ; les autres, une fois acceptées par le titulaire.
  const aAider = person
    ? ouvertes.filter((r) => (r.trouId ? (r.sollicites ?? []).includes(personId) : r.destinataire ? r.destinataire === personId && !(r.indisponibles ?? []).includes(personId) : r.accord !== 'attente' && peutRemplacer(data, r, person)))
    : [];

  if (!person) return <div className="empty">Personne introuvable.</div>;

  return (
    <div className="me">
      {/* Une page comme les autres : l'accueil, avec le bonjour et la date, c'est le tableau de bord (ou « Mon espace »). */}
      <div className="page-head">
        <span className="page-ico" aria-hidden="true">
          <CalendarDays size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Mon planning</div>
          <h1>
            Quand est-ce que <span className="hl">je travaille</span> ?
          </h1>
          <p>Vos horaires publiés, semaine après semaine, avec vos pauses, vos gardes et vos rendez-vous.</p>
        </div>
        <div className="row wrap mp-actions">
            <button type="button" className="btn primary no-print" onClick={() => setDemande(true)}>
              <Plus size={16} aria-hidden="true" /> {gere ? 'Poser une absence' : 'Faire une demande'}
            </button>
            <button type="button" className="btn no-print" id="moi-imprimer" onClick={() => useUi.getState().ouvrirImpression({ periode: 'semaine', repere: today, moi: true })}>
              <Printer size={15} aria-hidden="true" /> Imprimer
            </button>
            <button
              type="button"
              className="btn no-print"
              onClick={() => {
                setSeulementMoi(false);
                aller(gere ? 'construire' : 'planning');
              }}
            >
              <Users size={15} aria-hidden="true" /> Planning de l’équipe
            </button>
            {nonLus.length ? (
              <Pill tone="miel">
                <BellRing size={13} aria-hidden="true" /> {nonLus.length} changement{nonLus.length > 1 ? 's' : ''} à lire
              </Pill>
            ) : null}
        </div>
      </div>
      <div className="mp-prochain">
        <ProchainPoste postes={aVenir.filter((x) => !absences.some((a) => a.statut === 'approuvee' && a.from <= x.date && x.date <= a.to))} today={today} action={<PrevenirRetard personId={personId} />} />
      </div>

      {aAider.length ? (
        <div className="card" data-focus="aider" style={{ marginTop: 18 }}>
          <div className="card-head">
            <span className="ico" aria-hidden="true">
              <HandHelping size={18} />
            </span>
            <div className="grow">
              <h2 className="h3">{aAider.some((r) => r.trouId) ? 'L’équipe a besoin d’un coup de main' : aAider.some((r) => r.destinataire === personId) ? 'Un collègue vous demande de le remplacer' : 'Un collègue cherche un remplaçant'}</h2>
              <div className="small soft">Vous proposer n’engage à rien tant que le responsable n’a pas validé.</div>
            </div>
          </div>
          {aAider.map((r) => {
            if (r.trouId) return <AppelRecu key={r.id} appel={r} personId={personId} />;
            if (declin === r.id) {
              const qui = data.personnes.find((p) => p.id === r.demandeur);
              return (
                <DialogueRefus
                  key={r.id}
                  titre="Répondre non"
                  quoi={`Remplacer ${qui ? nomCourt(qui) : 'un collègue'}, ${fmtDateCourt(r.date)}, ${fmtHeure(r.start)} – ${fmtHeure(r.end)}`}
                  raisons={RAISONS_DECLIN}
                  pour={qui?.prenom ?? 'votre collègue'}
                  apercu={(m) => `${texteDeclin(`${fmtDateCourt(r.date)}, ${fmtHeure(r.start)} – ${fmtHeure(r.end)}`, m)} Vous pouvez demander à toute l’équipe depuis « Mes demandes ».`}
                  bouton="Répondre non"
                  exemple="Par exemple : je peux un autre jour."
                  sansMessage={`${qui?.prenom ?? 'Votre collègue'} reçoit seulement votre réponse, sans raison.`}
                  onClose={() => setDeclin(null)}
                  onConfirmer={(motif) => {
                    declinerAppel(r.id, personId, motif);
                    dire(`C’est noté : ${qui ? qui.prenom : 'votre collègue'} est prévenu.`, true);
                  }}
                />
              );
            }
            const d = data.personnes.find((p) => p.id === r.demandeur);
            const propose = r.volontaires.includes(personId);
            const occupe = aVenir.some((s) => s.date === r.date && s.start < r.end && r.start < s.end);
            return (
              <div key={r.id} className="decision" style={{ alignItems: 'center' }}>
                <div className="grow">
                  <b className="cap1">{fmtDateCourt(r.date)}</b> · <span className="num">{fmtHeure(r.start)} – {fmtHeure(r.end)}</span>
                  <div className="small soft">
                    {r.destinataire === personId ? `${d ? d.prenom : 'Un collègue'} vous le demande, à vous. Le titulaire validera.` : `Demandé par ${d ? nomCourt(d) : 'un collègue'}`}
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
                  <>
                    {r.destinataire === personId ? (
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => setDeclin(r.id)}
                      >
                        Je ne peux pas
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn primary sm"
                      disabled={occupe}
                      onClick={() => {
                        seProposer(r.id, personId, true);
                        dire(r.destinataire === personId ? `Merci. ${d ? d.prenom : 'Votre collègue'} est prévenu ; le titulaire valide.` : 'Vous êtes volontaire. Le responsable valide le remplacement.', true);
                      }}
                    >
                      {r.destinataire === personId ? 'J’accepte' : 'Je me propose'}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {changements.length ? (
        <div className="card" data-focus="changements" style={{ marginTop: 18 }}>
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

      <div className="me-grid large">
        <div className="col" style={{ gap: 18 }}>
          <div className="row wrap">
            <h2 className="grow">{affichage === 'semaine' ? 'Mes semaines' : 'Mon calendrier'}</h2>
            <Seg<'semaine' | 'calendrier'>
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
            <Calendrier data={data} personId={personId} today={today} mois={mois} setMois={setMois} onJour={voirJour} />
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
                      <div className="small soft">{postes ? `Semaine ${isoWeek(monday)} · publié le ${fmtHorodatage(statut?.publishedAt ?? '')}` : 'Planning pas encore publié'}</div>
                    </div>
                    {postes ? (
                      <div className="jh-bilan">
                        <span>
                          <b className="num">{fmtDuree(total)}</b> prévues
                        </span>
                        <span>
                          <b className="num">{new Set(postes.filter((x) => !absentLe(x.date)).map((x) => x.date)).size}</b> jours
                        </span>
                      </div>
                    ) : null}
                  </div>
                  {postes ? (
                    <div className="jours-h">
                      {weekDates(monday).map((date) => {
                        const absence = absences.find((x) => x.statut === 'approuvee' && x.from <= date && date <= x.to);
                        // Un jour d'absence approuvée ne montre plus le poste prévu : il a été retiré.
                        const duJour = absence ? [] : postes.filter((x) => x.date === date).sort((x, y) => x.start - y.start);
                        const gardes = data.gardes.filter((g) => g.personId === personId && g.date === date);
                        const missions = absence ? [] : data.missions.filter((m) => m.personId === personId && m.date === date);
                        if (weekday(date) === 6 && !duJour.length && !gardes.length) return null;
                        const moment = duJour.length ? momentDe({ start: duJour[0].start, end: duJour[duJour.length - 1].end }) : null;
                        return (
                          <div key={date} className={`jour-h ${duJour.length ? `t-${moment}` : absence ? `t-${classeAbsence(absence.type)}` : 't-repos'}${date === today ? ' today' : ''}`}>
                            <div className="jh-date">
                              <button type="button" className="lien-jour" onClick={() => voirJour(date)} title="Voir toute l’équipe ce jour-là">
                                <span className="jh-num num">{Number(date.slice(8))}</span>
                                <span className="jh-jour">
                                  <b className="cap1">{JOURS[weekday(date)]}</b>
                                  <span className="small soft">{date === today ? 'Aujourd’hui' : fmtJourMois(date).replace(/^\d+\s*/, '')}</span>
                                </span>
                                <span className="sr">, voir la journée</span>
                              </button>
                            </div>
                            <Ferie date={date} />
                            <div className="jh-corps">
                              {duJour.length ? (
                                <>
                                  <div className="jh-titre">
                                    <div>
                                      {duJour.map((x) => (
                                        <div key={x.id}>
                                          <span className="jh-moment">
                                            {moment === 'soir' ? <Sunset size={13} aria-hidden="true" /> : <Sun size={13} aria-hidden="true" />} {MOMENT_LABEL[momentDe(x)]}
                                          </span>
                                          <b className="jh-heures num">
                                            {fmtHeure(x.start)} – {fmtHeure(x.end)}
                                          </b>
                                          <span className="jh-meta">
                                            <span>{fmtDuree(minutesTravail(x))} de travail</span>
                                            {decrirePauses(x).dejeuner ? <span>Pause déjeuner {decrirePauses(x).dejeuner}</span> : null}
                                            {decrirePauses(x).courtes ? (
                                              <span>
                                                Pause{(x.pauses?.length ?? 0) > 1 ? 's' : ''} courte{(x.pauses?.length ?? 0) > 1 ? 's' : ''} à {decrirePauses(x).courtes}
                                              </span>
                                            ) : null}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="jh-titre">
                                  <b className="jh-heures jh-sans">
                                    {absence ? <Ban size={15} aria-hidden="true" /> : <Coffee size={15} aria-hidden="true" />} {absence ? libelleAbsence(absence) : ferie(date) ? 'Jour férié' : 'Repos'}
                                  </b>
                                </div>
                              )}
                              {/* La journée d'un coup d'œil : le poste sur une frise de 7 h à 21 h, la pause en creux. */}
                              {duJour.length ? (
                                <span className="jh-frise" aria-hidden="true">
                                  {duJour.flatMap((x) =>
                                    (x.pauseStart !== undefined && x.pauseEnd !== undefined
                                      ? [
                                          { de: x.start, a: x.pauseStart },
                                          { de: x.pauseEnd, a: x.end },
                                        ]
                                      : [{ de: x.start, a: x.end }]
                                    ).map((seg, i) => <i key={`${x.id}-${i}`} style={{ left: `${Math.max(0, ((seg.de - 420) / 840) * 100)}%`, width: `${Math.max(2, ((seg.a - seg.de) / 840) * 100)}%` }} />),
                                  )}
                                </span>
                              ) : null}
                              {rdvDe(data, personId).filter((r) => r.date === date && (r.statut === 'fixe' || r.statut === 'propose')).map((r) => {
                                const autre = data.personnes.find((q) => q.id === autreDuRdv(r, personId));
                                return (
                                  <span key={r.id} className={`rdv-puce ${r.statut}`}>
                                    <Handshake size={13} aria-hidden="true" />
                                    <span>
                                      <b className="num">{fmtHeure(r.start)} – {fmtHeure(r.end)}</b> · Rendez-vous avec {autre ? nomCourt(autre) : ''}
                                      {r.statut === 'propose' ? ' (à confirmer)' : ''}
                                    </span>
                                  </span>
                                );
                              })}
                              {missions.length || gardes.length ? (
                                <div className="row wrap" style={{ gap: 8 }}>
                                  {missions.map((m) => (
                                    <Pill key={m.id} tone="miel">
                                      <Stethoscope size={12} aria-hidden="true" /> {MISSION_LABEL[m.type]} · {fmtHeure(m.start)}
                                    </Pill>
                                  ))}
                                  {gardes.map((g) => (
                                    <Pill key={g.id} tone="nuit">
                                      <IconeGarde garde={g} /> {nomGarde(g)} · {fmtHHMM(g.start)} → {fmtHHMM(g.end)}
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
                    <div className="jh-attente">
                      <CalendarClock size={26} aria-hidden="true" />
                      <span>{gere ? `La semaine du ${fmtSemaine(monday)} n’a pas de planning publié : personne n’y voit encore ses horaires.` : 'Votre responsable prépare encore cette semaine. Vous serez prévenu dès la publication.'}</span>
                      {gere ? (
                        <button
                          type="button"
                          className="btn"
                          data-construire={monday}
                          onClick={() => {
                            useUi.getState().setSemaine(monday);
                            aller('construire');
                          }}
                        >
                          Construire cette semaine <ArrowRight size={16} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

      </div>
      {demande ? <DialogueDemande personId={personId} espace={gere ? 'responsable' : 'salarie'} onClose={() => setDemande(false)} /> : null}
    </div>
  );
}
