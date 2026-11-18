import { Ban, BellRing, CalendarClock, Check, Coffee, HandHelping, Plus, Printer, Stethoscope, Sun, Sunset, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { peutGerer } from '../../domain/acces';
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
import { MISSION_LABEL, classeAbsence, libelleAbsence, nomCourt, nomGarde } from '../../domain/types';
import { minutesTravail } from '../../engine/core';
import { peutRemplacer } from '../../engine/remplacement';
import { imprimer } from '../../env';
import { IconeGarde } from '../icons';
import { RAISONS_DECLIN, texteDeclin } from '../../domain/refus';
import { DialogueRefus } from '../components/Refus';
import { useStore } from '../../store/store';
import { DialogueDemande } from '../components/Demande';
import { useUi } from '../../store/ui';
import { AvantApres, Pill, Seg, momentDe } from '../kit';
import { Calendrier } from '../components/Calendrier';
import { ProchainPoste } from '../components/ProchainPoste';
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
      <div className="hero tb-hero">
        <div className="tbh-texte">
          <div className="eyebrow">{fmtDateLong(today)}</div>
          <h1>Bonjour {person.prenom}</h1>
          <div className="row wrap" style={{ marginTop: 14 }}>
            <button type="button" className="btn primary no-print" onClick={() => setDemande(true)}>
              <Plus size={16} aria-hidden="true" /> {gere ? 'Poser une absence' : 'Faire une demande'}
            </button>
            <button type="button" className="btn no-print" onClick={() => imprimer(dire)}>
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
        <ProchainPoste postes={aVenir.filter((x) => !absences.some((a) => a.statut === 'approuvee' && a.from <= x.date && x.date <= a.to))} today={today} />
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
                      <div className="small soft">
                        {postes ? `Semaine ${isoWeek(monday)} · ${fmtDuree(total)} prévues · publié le ${fmtHorodatage(statut?.publishedAt ?? '')}` : 'Planning pas encore publié'}
                      </div>
                    </div>
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
                          <div key={date} className={`jour-h${date === today ? ' today' : ''}`}>
                            <div className="jh-date">
                              <button type="button" className="lien-jour cap1" onClick={() => voirJour(date)} title="Voir toute l’équipe ce jour-là">
                                {JOURS[weekday(date)]}
                                <span className="sr">, voir la journée</span>
                              </button>
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
                                </>
                              ) : (
                                <div className="jh-titre">
                                  <span className={`moment ${absence ? classeAbsence(absence.type) : 'repos'}`} aria-hidden="true">
                                    {absence ? <Ban size={17} /> : <Coffee size={17} />}
                                  </span>
                                  <b className="jh-heures" style={{ color: 'var(--ink-2)' }}>{absence ? libelleAbsence(absence) : 'Repos'}</b>
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
                    <div className="card-body soft">{gere ? 'Cette semaine n’est pas encore publiée : construisez-la, puis publiez-la.' : 'Votre responsable prépare encore cette semaine. Vous serez prévenu dès la publication.'}</div>
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
