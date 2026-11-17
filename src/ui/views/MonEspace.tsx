import { ArrowLeftRight, CalendarHeart, CalendarOff, CircleCheck, Gauge, Inbox, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { peutGerer } from '../../domain/acces';
import { addDays, fmtDateCourt, fmtDuree, fmtHeure, fmtSemaine, mondayOf } from '../../domain/time';
import type { ISODate, Shift } from '../../domain/types';
import { URGENCE_LABEL, estPharmacien, libelleAbsence } from '../../domain/types';
import { decrireBesoin } from '../../engine/core';
import type { CompteurCle } from '../../engine/equity';
import { COMPTEUR_LABEL, equite } from '../../engine/equity';
import { delaiRemplacement, peutDemanderRemplacement } from '../../engine/remplacement';
import { soldeHeures } from '../../engine/heures';
import { estCollaboratif, moisACollecter } from '../../engine/souhaits';
import { suiviDe } from '../../engine/suivi';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Compteurs } from '../components/Compteurs';
import { DialogueDemande } from '../components/Demande';
import { DialogueRemplacement } from '../components/Remplacer';
import { Pill } from '../kit';
import { STATUT_BESOIN } from './Equipe';
import { Ecart } from './Equite';
import { Souhaits } from './Souhaits';
import { usagePlafond } from './Resoudre';

/** Mes demandes : absences, contraintes d'horaires et remplacements, au même endroit. */
export function MesDemandes({ personId }: { personId: string }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { cloreRemplacement } = useStore();
  const { intention, setIntention, demandesOnglet, setDemandesOnglet } = useUi();
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
  // Trois onglets, trois natures : ce que je préfère, ce que je demande, ce que je cède.
  const onglets: { cle: 'souhaits' | 'absences' | 'remplacements'; label: string; intro: string; nombre: number; icone: JSX.Element }[] = [
    ...(collaboratif ? [{ cle: 'souhaits' as const, label: 'Souhaits du mois', intro: 'Ce que vous préférez pour le mois à venir. Le planning s’en inspire, sans réponse à attendre.', nombre: 0, icone: <CalendarHeart size={16} /> }] : []),
    { cle: 'absences' as const, label: gere ? 'Absences et horaires' : 'Absences et horaires', intro: gere ? 'Vos congés, vos formations et vos contraintes d’horaires.' : 'Un congé, une formation, un horaire à tenir : votre titulaire répond à chaque demande.', nombre: absences.filter((a) => a.statut === 'demandee').length + besoins.filter((b) => b.decision === 'en_attente').length, icone: <CalendarOff size={16} /> },
    { cle: 'remplacements' as const, label: 'Remplacements', intro: 'Un poste publié que vous ne pouvez pas tenir : un collègue volontaire le reprend, avec l’accord du titulaire.', nombre: mesRemplacements.length, icone: <ArrowLeftRight size={16} /> },
  ];
  const onglet = onglets.some((o) => o.cle === demandesOnglet) ? (demandesOnglet as (typeof onglets)[number]['cle']) : collaboratif && !souhaitsPoses ? 'souhaits' : 'absences';

  return (
    <div>
      <div className="page-head">
        <span className="page-ico" aria-hidden="true">
          <Inbox size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Mes demandes</div>
          <h1>
            Ce que je <span className="hl">souhaite</span>, ce que je demande
          </h1>
          <p>Souhaits du mois, absences, remplacements : tout au même endroit. Aucune raison n’est jamais demandée.</p>
        </div>
        <button type="button" className="btn primary no-print" onClick={() => setDemande(true)}>
          <Plus size={16} aria-hidden="true" /> {gere ? 'Poser une absence' : 'Faire une demande'}
        </button>
      </div>
      <div className="onglets" role="tablist" aria-label="Mes demandes">
        {onglets.map((o) => (
          <button key={o.cle} type="button" role="tab" id={`dem-${o.cle}`} aria-selected={onglet === o.cle} aria-controls="panneau-demandes" className={`onglet${onglet === o.cle ? ' on' : ''}`} onClick={() => setDemandesOnglet(o.cle)}>
            <span aria-hidden="true">{o.icone}</span>
            {o.label}
            {o.nombre ? (
              <span className="compte">
                {o.nombre}
                <span className="sr"> en cours</span>
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <div id="panneau-demandes" role="tabpanel" aria-labelledby={`dem-${onglet}`}>
        <p className="onglet-intro">{onglets.find((o) => o.cle === onglet)?.intro}</p>
        {onglet === 'souhaits' ? <Souhaits personId={personId} /> : null}
        {onglet === 'absences' ? (
          <div className="une">
          <div className="card">
            <div className="card-head">
              <h2 className="h3 grow">{gere ? 'Mes absences et contraintes' : 'Mes demandes'}</h2>
              <button type="button" className="btn sm" onClick={() => setDemande(true)}>
                <Plus size={14} /> Nouvelle
              </button>
            </div>
            <div className="card-body col" style={{ gap: 10 }}>
              {!besoins.length && !absences.length ? <p className="soft small">{gere ? 'Rien de prévu.' : 'Aucune demande en cours.'}</p> : null}
              {absences.map((a) => (
                <div key={a.id} className="row wrap">
                  <div className="grow">
                    <b>{libelleAbsence(a)}</b>
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
              {!gere ? (
                <div className="notice small">
                  <CircleCheck size={15} />
                  <div>
                    Souhaits prioritaires utilisés : <b>{usage.actifs} sur {usage.plafond}</b>, comme pour tous vos collègues. On ne vous demande jamais la raison d'une demande.
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          </div>
        ) : null}
        {onglet === 'remplacements' ? (
          <div className="une">
          <div className="card" data-focus="remplacer">
            <div className="card-head">
              <span className="ico" aria-hidden="true">
                <ArrowLeftRight size={18} />
              </span>
              <div className="grow">
                <h2 className="h3">{gere ? 'Confier un de mes postes' : 'Me faire remplacer'}</h2>
                <div className="small soft">À moins de {delai} jours, la demande est urgente.</div>
              </div>
            </div>
            <div className="card-body col" style={{ gap: 10 }}>
              {!aVenir.length ? <p className="soft small">Aucun poste publié à venir.</p> : null}
              {aVenir.slice(0, 8).map((s) => {
                const r = mesRemplacements.find((x) => x.shiftId === s.id);
                const possible = peutDemanderRemplacement(data, s.date, today);
                return (
                  <div key={s.id} className="row wrap">
                    <div className="grow" style={{ minWidth: 150 }}>
                      <b className="cap1">{fmtDateCourt(s.date)}</b>
                      <div className="small soft num">
                        {fmtHeure(s.start)} – {fmtHeure(s.end)}
                      </div>
                      {r ? (
                        <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
                          <Pill tone={r.urgence === 'medical' ? 'danger' : r.urgence === 'urgent' ? 'warn' : undefined}>{URGENCE_LABEL[r.urgence ?? 'prevu']}</Pill>
                          <span className="small soft">
                            {r.accord === 'attente' ? 'En attente de la réponse de votre titulaire' : r.volontaires.length ? `Acceptée · ${r.volontaires.length} volontaire${r.volontaires.length > 1 ? 's' : ''}` : 'Acceptée · en attente d’un volontaire'}
                            {r.justificatif ? ' · justificatif joint' : ''}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    {r ? (
                      <button type="button" className="btn sm" onClick={() => cloreRemplacement(r.id, 'annulee')}>
                        Annuler
                      </button>
                    ) : (
                      <button type="button" className={`btn sm${possible ? ' primary' : ''}`} disabled={enCours(s.id)} onClick={() => setARemplacer(s)}>
                        {possible ? 'Me faire remplacer' : 'Demande urgente'}
                      </button>
                    )}
                  </div>
                );
              })}
              <p className="tiny muted">{gere ? 'Un collègue se propose, puis la validation se fait dans « Résoudre ».' : 'Votre titulaire répond oui ou non, puis prévient l’équipe. Vous restez en poste tant que personne n’a repris.'}</p>
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
