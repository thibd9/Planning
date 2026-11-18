import { AlarmClock, ArrowLeftRight, CalendarCheck, CalendarHeart, CalendarOff, Check, Clock, Gauge, Inbox, MessageCircleReply, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { peutGerer } from '../../domain/acces';
import { addDays, dayIndex, fmtDateCourt, fmtDuree, fmtHeure, fmtSemaine, mondayOf } from '../../domain/time';
import type { ISODate, Shift } from '../../domain/types';
import { classeAbsence, estPharmacien, libelleAbsence } from '../../domain/types';
import { decrireBesoin } from '../../engine/core';
import type { CompteurCle } from '../../engine/equity';
import { COMPTEUR_LABEL, equite } from '../../engine/equity';
import { delaiRemplacement, peutDemanderRemplacement } from '../../engine/remplacement';
import { soldeHeures } from '../../engine/heures';
import { estCollaboratif, joursRestants, moisACollecter } from '../../engine/souhaits';
import { suiviDe } from '../../engine/suivi';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Compteurs } from '../components/Compteurs';
import { DialogueDemande } from '../components/Demande';
import { DialogueRemplacement } from '../components/Remplacer';
import { ABSENCE_ICONE } from '../icons';
import { Delai, PastilleUrgence, Pill } from '../kit';
import { STATUT_BESOIN } from './Equipe';
import { Ecart } from './Equite';
import { Souhaits } from './Souhaits';
import { usagePlafond } from './Resoudre';

/** Où en est une demande : les étapes franchies sont cochées, la suivante est en cours. */
function Etapes({ etapes, faites, refus }: { etapes: string[]; faites: number; refus?: boolean }): JSX.Element {
  return (
    <ol className={`etapes${refus ? ' refus' : ''}`}>
      {etapes.map((e, i) => {
        const etat = i < faites ? 'fait' : i === faites ? (refus ? 'non' : 'cours') : 'apres';
        return (
          <li key={e} className={etat}>
            <i aria-hidden="true">{etat === 'fait' ? <Check size={11} strokeWidth={3.5} /> : etat === 'non' ? <X size={11} strokeWidth={3.5} /> : null}</i>
            <span>
              {e}
              <span className="sr">{etat === 'fait' ? ' : fait' : etat === 'cours' ? ' : en cours' : etat === 'non' ? ' : refusé' : ' : à venir'}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Mes demandes : absences, contraintes d'horaires et remplacements, au même endroit. */
export function MesDemandes({ personId }: { personId: string }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { cloreRemplacement, elargirDemande } = useStore();
  const { intention, setIntention, demandesOnglet, setDemandesOnglet, dire } = useUi();
  const [demande, setDemande] = useState(false);
  const [aRemplacer, setARemplacer] = useState<Shift | null>(null);
  useEffect(() => {
    if (intention === 'demande') {
      setDemande(true);
      setDemandesOnglet('absences');
      setIntention(null);
    }
  }, [intention, setIntention, setDemandesOnglet]);
  const gere = peutGerer(data, data.personnes.find((p) => p.id === personId));
  const delai = delaiRemplacement(data);
  const lundi = mondayOf(today);
  // On ne propose que des postes publiés : jamais un brouillon.
  const publies = (monday: ISODate): Shift[] => {
    const s = data.semaines[monday];
    return s?.statut === 'publie' ? (s.snapshot ?? []).filter((x) => x.personId === personId) : [];
  };
  const aVenir = [lundi, addDays(lundi, 7), addDays(lundi, 14)]
    .flatMap(publies)
    .filter((s) => s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const besoins = data.besoins.filter((b) => b.personId === personId && (!b.to || b.to >= today));
  const absences = data.absences.filter((a) => a.personId === personId && a.to >= today);
  const usage = usagePlafond(data, personId, today);
  const mesRemplacements = data.remplacements.filter((r) => r.statut === 'ouverte' && r.date >= today && r.demandeur === personId && !r.trouId);
  const enCours = (shiftId: string): boolean => mesRemplacements.some((r) => r.shiftId === shiftId);
  const collaboratif = estCollaboratif(data.officine);
  const moisCible = moisACollecter(data.officine, today);
  const souhaitsPoses = (data.souhaits ?? []).filter((x) => x.personId === personId && x.date.startsWith(moisCible)).length;
  const enAttente = absences.filter((a) => a.statut === 'demandee').length + besoins.filter((b) => b.decision === 'en_attente').length;
  const restants = joursRestants(data.officine, moisCible, today);
  // Trois choses possibles, trois cartes : ce que je préfère, ce que je demande, le poste que je cède.
  const choix: { cle: 'souhaits' | 'absences' | 'remplacements'; titre: string; phrase: string; reponse: string; etat: string; ton: string; teinte: string; icone: JSX.Element }[] = [
    ...(collaboratif
      ? [
          {
            cle: 'souhaits' as const,
            titre: 'Mes préférences',
            phrase: 'Ce qui m’arrange le mois prochain.',
            reponse: 'Pas de réponse à attendre',
            etat: restants < 0 ? 'Clos' : souhaitsPoses ? (restants === 0 ? 'Dernier jour' : `${restants} j pour modifier`) : restants === 0 ? 'À remplir aujourd’hui' : `À remplir · ${restants} j`,
            ton: restants < 0 ? 'neutral' : souhaitsPoses ? 'ok' : 'warn',
            teinte: 'v-pref',
            icone: <CalendarHeart size={22} />,
          },
        ]
      : []),
    {
      cle: 'absences' as const,
      titre: 'Absence ou horaire',
      phrase: 'Congé, formation, horaire à tenir.',
      reponse: gere ? 'Inscrit directement' : 'Votre titulaire répond',
      etat: enAttente ? `${enAttente} en attente` : absences.length + besoins.length ? `${absences.length + besoins.length} en cours` : 'Aucune',
      ton: enAttente ? 'warn' : 'neutral',
      teinte: 'v-abs',
      icone: <CalendarOff size={22} />,
    },
    {
      cle: 'remplacements' as const,
      titre: 'Me faire remplacer',
      phrase: 'Un poste publié que je ne peux pas tenir.',
      reponse: 'Titulaire, puis un collègue volontaire',
      etat: mesRemplacements.length ? `${mesRemplacements.length} en cours` : 'Aucune',
      ton: mesRemplacements.length ? 'warn' : 'neutral',
      teinte: 'v-rempl',
      icone: <ArrowLeftRight size={22} />,
    },
  ];
  const onglet = choix.some((o) => o.cle === demandesOnglet) ? (demandesOnglet as (typeof choix)[number]['cle']) : collaboratif && !souhaitsPoses && restants >= 0 ? 'souhaits' : 'absences';
  const urgents = aVenir.slice(0, 8).filter((x) => !peutDemanderRemplacement(data, x.date, today));
  const prevus = aVenir.slice(0, 8).filter((x) => peutDemanderRemplacement(data, x.date, today));

  const lignePoste = (x: Shift): JSX.Element => {
    const r = mesRemplacements.find((y) => y.shiftId === x.id);
    const possible = peutDemanderRemplacement(data, x.date, today);
    return (
      <div key={x.id} className={`dm${r ? ' actif' : ''}`}>
        <span className={`dm-pic ${possible ? 'info' : 'warn'}`} aria-hidden="true">
          <ArrowLeftRight size={18} />
        </span>
        <div className="dm-corps">
          <div className="dm-titre">
            <b className="cap1">{fmtDateCourt(x.date)}</b>
            <span className="num soft">
              {fmtHeure(x.start)} – {fmtHeure(x.end)}
            </span>
            <Delai date={x.date} today={today} />
            {r ? <PastilleUrgence urgence={r.urgence ?? 'prevu'} /> : null}
          </div>
          {r && r.destinataire ? (
            (() => {
              const c = data.personnes.find((p) => p.id === r.destinataire);
              const qui = c ? c.prenom : 'Votre collègue';
              const refuse = (r.indisponibles ?? []).includes(r.destinataire);
              const accepte = r.volontaires.includes(r.destinataire);
              return (
                <>
                  <Etapes etapes={[`Demandé à ${qui}`, `${qui} accepte`, 'Le titulaire valide']} faites={accepte ? 2 : 1} refus={refuse} />
                  <p className="dm-etat">
                    {refuse ? `${qui} ne peut pas. Vous pouvez demander à toute l’équipe.` : accepte ? `${qui} est d’accord. Il reste à votre titulaire de valider.` : `${qui} n’a pas encore répondu.`} Vous restez en poste tant que rien n’est validé.
                  </p>
                </>
              );
            })()
          ) : r ? (
            <>
              <Etapes etapes={['Demandé', 'Accord du titulaire', 'Un collègue reprend']} faites={r.accord === 'attente' ? 1 : r.volontaires.length ? 3 : 2} />
              <p className="dm-etat">
                {r.accord === 'attente' ? 'Votre titulaire n’a pas encore répondu.' : r.volontaires.length ? `${r.volontaires.length} volontaire${r.volontaires.length > 1 ? 's' : ''} : votre titulaire valide le remplacement.` : 'Accord donné. On attend un collègue volontaire.'}
                {r.justificatif ? ' Justificatif joint.' : ''} Vous restez en poste tant que rien n’est validé.
              </p>
            </>
          ) : null}
        </div>
        {r && r.destinataire && (r.indisponibles ?? []).includes(r.destinataire) ? (
          <button
            type="button"
            className="btn sm primary"
            onClick={() => {
              elargirDemande(r.id);
              dire('Demande ouverte à toute l’équipe.', true);
            }}
          >
            Demander à toute l’équipe
          </button>
        ) : null}
        {r ? (
          <button type="button" className="btn sm" onClick={() => cloreRemplacement(r.id, 'annulee')}>
            Annuler
          </button>
        ) : (
          <button type="button" className={`btn sm${possible ? ' primary' : ''}`} disabled={enCours(x.id)} onClick={() => setARemplacer(x)}>
            {possible ? 'Me faire remplacer' : 'Demande urgente'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="page-head">
        <span className="page-ico" aria-hidden="true">
          <Inbox size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Mon espace</div>
          <h1>
            Mes <span className="hl">demandes</span>
          </h1>
          <p>Choisissez ce que vous voulez faire. Jamais de raison à donner.</p>
        </div>
      </div>
      <div className="voies" role="tablist" aria-label="Mes demandes">
        {choix.map((o) => (
          <button key={o.cle} type="button" role="tab" id={`dem-${o.cle}`} aria-selected={onglet === o.cle} aria-controls="panneau-demandes" className={`voie ${o.teinte}${onglet === o.cle ? ' on' : ''}`} onClick={() => setDemandesOnglet(o.cle)}>
            <span className="voie-pic" aria-hidden="true">
              {o.icone}
            </span>
            <span className="voie-texte">
              <b>{o.titre}</b>
              <span>{o.phrase}</span>
            </span>
            <span className={`pill ${o.ton} voie-etat`}>{o.etat}</span>
            <span className="voie-reponse">
              <MessageCircleReply size={14} aria-hidden="true" /> {o.reponse}
            </span>
          </button>
        ))}
      </div>
      <div id="panneau-demandes" role="tabpanel" aria-labelledby={`dem-${onglet}`}>
        {onglet === 'souhaits' ? <Souhaits personId={personId} /> : null}
        {onglet === 'absences' ? (
          <div className="une">
            <div className="card">
              <div className="card-head">
                <div className="grow">
                  <h2 className="h3">{gere ? 'Mes absences et mes horaires' : 'Mes demandes d’absence et d’horaire'}</h2>
                  <div className="small soft">{gere ? 'Elles sont inscrites directement au planning.' : 'Chaque demande suit trois étapes. Vous êtes prévenu à chaque réponse.'}</div>
                </div>
                <button type="button" className="btn primary" onClick={() => setDemande(true)}>
                  <Plus size={16} aria-hidden="true" /> Nouvelle demande
                </button>
              </div>
              <div className="card-body col" style={{ gap: 12 }}>
                {!besoins.length && !absences.length ? (
                  <div className="dm-vide">
                    <CalendarOff size={22} aria-hidden="true" />
                    <span>{gere ? 'Rien de prévu.' : 'Aucune demande en cours.'}</span>
                  </div>
                ) : null}
                {absences.map((a) => {
                  const Icone = ABSENCE_ICONE[a.type];
                  const jours = dayIndex(a.to) - dayIndex(a.from) + 1;
                  return (
                    <div key={a.id} className="dm">
                      <span className={`dm-pic ${classeAbsence(a.type)}`} aria-hidden="true">
                        <Icone size={18} />
                      </span>
                      <div className="dm-corps">
                        <div className="dm-titre">
                          <b>{libelleAbsence(a)}</b>
                          <span className="soft">
                            {a.from === a.to ? `Le ${fmtDateCourt(a.from)}` : `Du ${fmtDateCourt(a.from)} au ${fmtDateCourt(a.to)}`} · {jours} jour{jours > 1 ? 's' : ''}
                          </span>
                          {a.from > today ? <Delai date={a.from} today={today} /> : null}
                        </div>
                        <Etapes etapes={['Envoyée', 'Réponse du titulaire', 'Au planning']} faites={a.statut === 'approuvee' ? 3 : 1} refus={a.statut === 'refusee'} />
                        <p className="dm-etat">{a.statut === 'approuvee' ? 'Acceptée : c’est inscrit au planning.' : a.statut === 'refusee' ? 'Refusée par votre titulaire.' : 'Votre titulaire n’a pas encore répondu.'}</p>
                      </div>
                      <Pill tone={a.statut === 'approuvee' ? 'ok' : a.statut === 'refusee' ? 'danger' : 'warn'}>{a.statut === 'approuvee' ? 'Acceptée' : a.statut === 'refusee' ? 'Refusée' : 'En attente'}</Pill>
                    </div>
                  );
                })}
                {besoins.map((b) => (
                  <div key={b.id} className="dm">
                    <span className="dm-pic horaire" aria-hidden="true">
                      <Clock size={18} />
                    </span>
                    <div className="dm-corps">
                      <div className="dm-titre">
                        <b>{decrireBesoin(b)}</b>
                        <span className="soft">Horaire à tenir</span>
                      </div>
                      <Etapes etapes={['Envoyée', 'Réponse du titulaire', 'Au planning']} faites={b.decision === 'acceptee' ? 3 : 1} refus={b.decision === 'refusee'} />
                      <p className="dm-etat">
                        {b.decision === 'acceptee'
                          ? b.statut === 'reconnue'
                            ? 'Acceptée : votre planning en tient compte à coup sûr.'
                            : b.statut === 'prioritaire'
                              ? 'Acceptée : servie avant les autres, sans être garantie.'
                              : 'Acceptée : suivie quand c’est possible.'
                          : b.decision === 'refusee'
                            ? 'Refusée par votre titulaire.'
                            : 'Votre titulaire n’a pas encore répondu.'}
                      </p>
                    </div>
                    {b.decision === 'acceptee' ? (
                      <Pill tone={STATUT_BESOIN[b.statut].tone}>{STATUT_BESOIN[b.statut].label}</Pill>
                    ) : (
                      <Pill tone={b.decision === 'refusee' ? 'danger' : 'warn'}>{b.decision === 'refusee' ? 'Refusée' : 'En attente'}</Pill>
                    )}
                  </div>
                ))}
                {!gere ? (
                  <p className="tiny muted">
                    Demandes prioritaires utilisées : <b>{usage.actifs} sur {usage.plafond}</b>. Même plafond pour toute l’équipe.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {onglet === 'remplacements' ? (
          <div className="une">
            <div className="card" data-focus="remplacer">
              <div className="card-head">
                <div className="grow">
                  <h2 className="h3">{gere ? 'Quel poste confier ?' : 'Quel poste ne pouvez-vous pas tenir ?'}</h2>
                  <div className="small soft">Seuls vos postes déjà publiés sont proposés.</div>
                </div>
              </div>
              <div className="card-body col" style={{ gap: 12 }}>
                {!aVenir.length ? (
                  <div className="dm-vide">
                    <ArrowLeftRight size={22} aria-hidden="true" />
                    <span>Aucun poste publié à venir.</span>
                  </div>
                ) : null}
                {urgents.length ? (
                  <>
                    <div className="dm-groupe warn">
                      <AlarmClock size={16} aria-hidden="true" />
                      <span>
                        <b>Dans moins de {delai} jours : demande urgente.</b> Seul un collègue volontaire peut reprendre le poste.
                      </span>
                    </div>
                    {urgents.map(lignePoste)}
                  </>
                ) : null}
                {prevus.length ? (
                  <>
                    <div className="dm-groupe info">
                      <CalendarCheck size={16} aria-hidden="true" />
                      <span>
                        <b>Dans {delai} jours ou plus : délai normal.</b> Votre titulaire a le temps de s’organiser.
                      </span>
                    </div>
                    {prevus.map(lignePoste)}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
      {demande ? <DialogueDemande personId={personId} espace={gere ? 'responsable' : 'salarie'} onClose={() => setDemande(false)} /> : null}
      {aRemplacer ? <DialogueRemplacement shift={aRemplacer} onClose={() => setARemplacer(null)} /> : null}
    </div>
  );
}

/** Mon suivi : ce qui a été noté sur douze mois, et ma part des contraintes de l'équipe. */
export function MonSuivi({ personId }: { personId: string }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const person = data.personnes.find((p) => p.id === personId);
  const lundi = mondayOf(today);
  const suivi = suiviDe(data, personId, today);
  const solde = useMemo(() => (person?.salarie ? soldeHeures(data, person, today) : null), [data, person, today]);
  const ligne = useMemo(() => equite(data, addDays(lundi, -56), addDays(lundi, 6)).find((l) => l.personId === personId), [data, lundi, personId]);
  const compteurs: CompteurCle[] = person && estPharmacien(person) ? ['samedis', 'fermetures', 'gardes', 'depannages', 'changementsTardifs'] : ['samedis', 'fermetures', 'depannages', 'changementsTardifs'];

  return (
    <div>
      <div className="page-head">
        <span className="page-ico" aria-hidden="true">
          <Gauge size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Mon suivi</div>
          <h1>
            Où j’en <span className="hl">suis</span>
          </h1>
          <p>Vos compteurs, et votre part des contraintes de l’équipe. Vous ne voyez que votre position : il n’existe aucun classement.</p>
        </div>
      </div>
      <div className="deux">
        {solde ? (
          <section className="card" data-focus="mon-compteur">
            <div className="card-head">
              <h2 className="h3 grow">Mon compteur d’heures</h2>
              <span className={`hc-solde num ${Math.abs(solde.solde) < 60 ? 'pile' : solde.solde > 0 ? 'plus' : 'moins'}`}>{Math.abs(solde.solde) < 60 ? 'À jour' : `${solde.solde > 0 ? '+' : '−'}${fmtDuree(Math.abs(solde.solde))}`}</span>
            </div>
            <div className="card-body">
              <p style={{ margin: 0 }}>
                {fmtDuree(solde.realise)} planifiées pour {fmtDuree(solde.contrat)} au contrat, sur les semaines publiées.
              </p>
              {solde.prevues.map((r) => (
                <p key={r.id} className="small soft" style={{ margin: '6px 0 0' }}>
                  {r.minutes < 0 ? 'Récupération' : 'Rattrapage'} de {fmtDuree(Math.abs(r.minutes))} prévu semaine du {fmtSemaine(r.semaine ?? '')}.
                </p>
              ))}
              <p className="tiny muted" style={{ marginTop: 12 }}>Un remplacement assuré s’ajoute ici aussitôt. Votre titulaire décide ensuite : paiement ou récupération.</p>
            </div>
          </section>
        ) : null}
          <section className="card">
            <div className="card-head">
              <h2 className="h3 grow">Mon suivi</h2>
              <span className="small soft">12 mois</span>
            </div>
            <div className="card-body">
              <Compteurs suivi={suivi} />
              <p className="tiny muted" style={{ marginTop: 12 }}>Ce que votre responsable a noté, et rien d’autre : des dates et des durées, jamais une raison.</p>
            </div>
          </section>

          {ligne ? (
            <section className="card">
              <div className="card-head">
                <h2 className="h3 grow">Ma part des contraintes</h2>
                <span className="small soft">8 semaines</span>
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
            </section>
          ) : null}
      </div>
    </div>
  );
}
