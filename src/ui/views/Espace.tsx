import { ArrowLeftRight, ArrowRight, Award, BellRing, BookOpen, CalendarClock, CalendarDays, CalendarPlus, GraduationCap, Inbox, MessageSquare, MoonStar, Tags } from 'lucide-react';
import { useState } from 'react';
import { responsable } from '../../domain/acces';
import { PROFILS, TYPE_PRODUIT_LABEL, marquesParType } from '../../domain/profils';
import { JOURS, dayIndex, fmtDateCourt, fmtDateLong, fmtDuree, fmtHHMM, fmtHeure, fmtJourMois, mondayOf, weekday } from '../../domain/time';
import type { ISODate, Person, Shift } from '../../domain/types';
import { COMPETENCE_LABEL, nomCourt, nomGarde } from '../../domain/types';
import { decrireBesoin, minutesSemaine } from '../../engine/core';
import { contratSemaine } from '../../engine/heures';
import { autreDuRdv, rdvARepondre } from '../../engine/rdv';
import { peutRemplacer } from '../../engine/remplacement';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { ListeAnnonces, annoncesDe } from '../components/Annonces';
import { DialogueDemande } from '../components/Demande';
import { ProchainPoste } from '../components/ProchainPoste';
import { BanniereAccueil } from '../components/Banniere';
import { PrevenirRetard } from '../components/Retard';
import { DialogueRendezVous, ProchainsRendezVous } from '../components/RendezVous';

const jourLong = (date: ISODate): string => `${JOURS[weekday(date)]} ${fmtJourMois(date)}`;

/**
 * L'accueil de chaque profil : le prochain poste, ce qui est propre au métier (marques d'un animateur,
 * rayons d'un rayonniste, études d'un étudiant, alternance d'un apprenti, compétences, gardes),
 * les rendez-vous et les raccourcis du quotidien.
 */
export function Espace({ personId }: { personId: string }): JSX.Element | null {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const lireAnnonces = useStore((s) => s.lireAnnonces);
  const { aller, viserFil } = useUi();
  const [rdv, setRdv] = useState<string | null>(null);
  const [demande, setDemande] = useState(false);
  const p = data.personnes.find((x) => x.id === personId);
  if (!p) return null;
  const profil = PROFILS[p.qualification];
  const chef = responsable(data);
  const publiee = (date: ISODate): boolean => data.semaines[mondayOf(date)]?.statut === 'publie';
  const absent = (date: ISODate): boolean => data.absences.some((a) => a.personId === personId && a.statut === 'approuvee' && a.from <= date && date <= a.to);
  const aVenir = data.shifts.filter((s) => s.personId === personId && s.date >= today && publiee(s.date) && !absent(s.date)).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const lundi = mondayOf(today);
  const planifie = publiee(today) ? minutesSemaine(data, personId, lundi) : 0;
  const contrat = contratSemaine(data, p, lundi);
  const rdvAttente = rdvARepondre(data, personId, today);
  const aRepondre = rdvAttente.length;
  // Ce qui attend la personne : une demande de rendez-vous, un collègue à dépanner, un changement de planning à lire.
  const aAider = data.remplacements.filter(
    (r) => r.statut === 'ouverte' && r.date >= today && r.demandeur !== personId && !r.volontaires.includes(personId) && (r.trouId ? (r.sollicites ?? []).includes(personId) : r.destinataire ? r.destinataire === personId && !(r.indisponibles ?? []).includes(personId) : r.accord !== 'attente' && peutRemplacer(data, r, p)),
  );
  const aLire = data.notifications.filter((n) => n.personId === personId && !n.luLe && dayIndex(n.date) >= dayIndex(today) - 7);
  const annonces = annoncesDe(data, personId).slice(0, 3);
  const ecrire = (id: string): void => {
    viserFil(id);
    aller('messages');
  };
  const priorite = ((): { ton: 'attention' | 'calme'; icone: JSX.Element; titre: string; detail: string; bouton: string; action: () => void } | null => {
    if (aAider.length) {
      // Une demande adressée à moi passe avant celles ouvertes à toute l'équipe.
      const r = [...aAider].sort((a, b) => Number(b.destinataire === personId) - Number(a.destinataire === personId) || a.date.localeCompare(b.date))[0];
      const qui = data.personnes.find((x) => x.id === r.demandeur);
      return {
        ton: 'attention',
        icone: <ArrowLeftRight size={22} />,
        titre: r.trouId ? 'L’équipe a besoin d’un coup de main' : r.destinataire === personId ? `${qui ? qui.prenom : 'Un collègue'} vous demande de le remplacer` : 'Un collègue cherche un remplaçant',
        detail: `${fmtDateCourt(r.date)}, de ${fmtHeure(r.start)} à ${fmtHeure(r.end)}. Vous répondez oui ou non, sans obligation.`,
        bouton: 'Voir la demande',
        action: () => aller('moi'),
      };
    }
    if (rdvAttente.length) {
      const r = rdvAttente[0];
      const qui = data.personnes.find((x) => x.id === autreDuRdv(r, personId));
      return { ton: 'attention', icone: <CalendarClock size={22} />, titre: `${qui ? qui.prenom : 'Un collègue'} vous propose un rendez-vous`, detail: `${r.sujet} : ${jourLong(r.date)}, de ${fmtHeure(r.start)} à ${fmtHeure(r.end)}.`, bouton: 'Répondre', action: () => ecrire(autreDuRdv(r, personId)) };
    }
    if (aLire.length) return { ton: 'calme', icone: <BellRing size={22} />, titre: `${aLire.length} changement${aLire.length > 1 ? 's' : ''} de votre planning à lire`, detail: 'Un de vos horaires a été modifié : l’avant et l’après sont dans « Mon planning ».', bouton: 'Lire', action: () => aller('moi') };
    return null;
  })();
  return (
    <div className="page page-espace">
      <BanniereAccueil
        personne={p}
        date={fmtDateLong(today)}
        role={`${profil.espace} · ${data.officine.nom || 'Ma pharmacie'}`}
        resume={
          <>
            <span>
            {aRepondre ? (
              <>
                <b>
                  {aRepondre} demande{aRepondre > 1 ? 's' : ''} de rendez-vous
                </b>{' '}
                attend{aRepondre > 1 ? 'ent' : ''} votre réponse.
              </>
            ) : aVenir.length ? (
              <>
                Votre semaine : <b>{fmtDuree(planifie)}</b> planifiées pour {fmtDuree(contrat)} au contrat.
              </>
            ) : (
              <>Le prochain planning n’est pas encore publié.</>
            )}
          </span>
          </>
        }
      />
      <p className="esp-phrase">{profil.phrase}</p>

      {priorite ? (
        <section className={`tb-priorite ${priorite.ton}`} aria-labelledby="esp-prio" data-focus="priorite" style={{ marginBottom: 20 }}>
          <span className="tb-prio-ico" aria-hidden="true">
            {priorite.icone}
          </span>
          <div className="grow">
            <div className="eyebrow">À faire en premier</div>
            <h2 id="esp-prio">{priorite.titre}</h2>
            <p>{priorite.detail}</p>
          </div>
          <button type="button" className="btn primary" onClick={priorite.action}>
            {priorite.bouton} <ArrowRight size={16} aria-hidden="true" />
          </button>
        </section>
      ) : null}

      <ProchainPoste postes={aVenir} today={today} action={<PrevenirRetard personId={personId} />} />

      <div className="esp-grille">
        <section className="card esp-metier" aria-labelledby="esp-metier" data-focus="mon-metier">
          <Metier p={p} aVenir={aVenir} onRdv={setRdv} onDemande={() => setDemande(true)} />
        </section>

        <div className="tb-col">
          <section className="card" aria-labelledby="esp-rdv" data-focus="mes-rdv">
            <div className="card-head">
              <div className="grow">
                <div className="eyebrow">Mon agenda</div>
                <h2 id="esp-rdv" className="h3">Mes rendez-vous</h2>
              </div>
              <button type="button" className="btn primary sm" id="esp-rdv-demander" onClick={() => setRdv('')}>
                <CalendarPlus size={15} aria-hidden="true" /> Demander un rendez-vous
              </button>
            </div>
            <div className="card-body">
              {ProchainsRendezVous({ data, personId, today, onOuvrir: ecrire }) ?? <p className="soft small" style={{ margin: 0 }}>Aucun rendez-vous à venir. Une demande acceptée se fixe ici et dans « Mon planning ».</p>}
            </div>
          </section>

          <section className="card" aria-labelledby="esp-raccourcis">
            <div className="card-head">
              <h2 id="esp-raccourcis" className="h3">Mes raccourcis</h2>
            </div>
            <div className="esp-raccourcis">
              <button type="button" className="tb-sujet" onClick={() => aller('moi')}>
                <span className="ico" aria-hidden="true"><CalendarDays size={18} /></span>
                <span className="grow">Voir mon planning</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              <button type="button" className="tb-sujet" onClick={() => aller('demandes')}>
                <span className="ico" aria-hidden="true"><Inbox size={18} /></span>
                <span className="grow">Demander une absence ou un horaire</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              {chef && chef.id !== personId ? (
                <button type="button" className="tb-sujet" onClick={() => ecrire(chef.id)}>
                  <span className="ico" aria-hidden="true"><MessageSquare size={18} /></span>
                  <span className="grow">Écrire à {nomCourt(chef)}</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      {annonces.length ? (
        <section className="card" aria-labelledby="esp-annonces" style={{ marginTop: 20 }}>
          <div className="card-head">
            <div className="grow">
              <div className="eyebrow">Ce qui a changé</div>
              <h2 id="esp-annonces" className="h3">Décisions qui me concernent</h2>
            </div>
          </div>
          <ListeAnnonces data={data} annonces={annonces} moi={personId} onLu={(id) => lireAnnonces(personId, id)} />
        </section>
      ) : null}

      {rdv !== null ? <DialogueRendezVous de={personId} sujet={rdv || undefined} onClose={() => setRdv(null)} /> : null}
      {demande ? <DialogueDemande personId={personId} espace="salarie" onClose={() => setDemande(false)} /> : null}
    </div>
  );
}

/** Ce qui est propre au métier de la personne. */
function Metier({ p, aVenir, onRdv, onDemande }: { p: Person; aVenir: Shift[]; onRdv: (sujet: string) => void; onDemande: () => void }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const tete = (icone: JSX.Element, sur: string, titre: string): JSX.Element => (
    <div className="card-head">
      <span className="ico" aria-hidden="true">{icone}</span>
      <div className="grow">
        <div className="eyebrow">{sur}</div>
        <h2 id="esp-metier" className="h3">{titre}</h2>
      </div>
    </div>
  );
  const jours = (titre: string): JSX.Element | null =>
    aVenir.length ? (
      <div className="esp-sous">
        <h3>{titre}</h3>
        <ul className="esp-jours">
          {aVenir.slice(0, 4).map((s) => (
            <li key={s.id}>
              <b className="cap1">{jourLong(s.date)}</b>
              <span className="num">
                {fmtHeure(s.start)} – {fmtHeure(s.end)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    ) : null;
  const competences = p.competences.length ? (
    <div className="esp-sous">
      <h3>Mes compétences</h3>
      <div className="esp-puces">
        {p.competences.map((c) => (
          <span key={c} className="rat-tag ok">{COMPETENCE_LABEL[c]}</span>
        ))}
      </div>
    </div>
  ) : null;
  const reconnus = data.besoins.filter((b) => b.personId === p.id && b.statut === 'reconnue');
  const etudes = (titre: string, bouton: string): JSX.Element => (
    <div className="esp-sous">
      <h3>{titre}</h3>
      {reconnus.length ? (
        <ul className="esp-jours">
          {reconnus.slice(0, 4).map((b) => (
            <li key={b.id}>
              <b className="cap1">{decrireBesoin(b)}</b>
              <span>pris en compte dans le planning</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="soft small">Rien de signalé pour l’instant : votre titulaire construit le planning sans cette contrainte.</p>
      )}
      <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={onDemande}>
        <GraduationCap size={15} aria-hidden="true" /> {bouton}
      </button>
    </div>
  );
  if (p.qualification === 'animateur') {
    const groupes = marquesParType(p);
    return (
      <>
        {tete(<Tags size={18} />, 'Mon métier', 'Les marques que je présente')}
        <div className="card-body esp-corps">
          {groupes.length ? (
            <ul className="esp-marques">
              {groupes.map((g) => (
                <li key={g.type}>
                  <span className="esp-type">{TYPE_PRODUIT_LABEL[g.type]}</span>
                  <span className="esp-puces">
                    {g.marques.map((m) => (
                      <span key={m} className="esp-marque">{m}</span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="soft small">Votre titulaire n’a pas encore choisi vos marques. Elles apparaîtront ici, par famille de produits.</p>
          )}
          {jours('Mes prochains jours d’animation')}
          <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => onRdv('Bilan d’animation')}>
            <CalendarPlus size={15} aria-hidden="true" /> Demander un bilan d’animation
          </button>
        </div>
      </>
    );
  }
  if (p.qualification === 'rayonniste') {
    return (
      <>
        {tete(<Tags size={18} />, 'Mon métier', 'Les rayons qui me sont confiés')}
        <div className="card-body esp-corps">
          {(p.rayons ?? []).length ? (
            <div className="esp-puces">
              {(p.rayons ?? []).map((t) => (
                <span key={t} className="esp-marque">{TYPE_PRODUIT_LABEL[t]}</span>
              ))}
            </div>
          ) : (
            <p className="soft small">Votre titulaire n’a pas encore choisi vos rayons. Ils apparaîtront ici.</p>
          )}
          {jours('Mes prochains postes')}
          <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => onRdv('Mes rayons et les commandes')}>
            <CalendarPlus size={15} aria-hidden="true" /> Faire un point sur mes rayons
          </button>
        </div>
      </>
    );
  }
  if (p.qualification === 'etudiant') {
    return (
      <>
        {tete(<BookOpen size={18} />, 'Mon métier', 'Mes études et mes horaires')}
        <div className="card-body esp-corps">
          {etudes('Cours et examens signalés', 'Signaler un cours ou un examen')}
          {jours('Mes prochains postes')}
        </div>
      </>
    );
  }
  if (p.qualification === 'apprenti') {
    return (
      <>
        {tete(<GraduationCap size={18} />, 'Mon métier', 'Mon alternance')}
        <div className="card-body esp-corps">
          {etudes('Jours d’école signalés', 'Signaler mes jours d’école')}
          {jours('Mes prochains jours en officine')}
          <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => onRdv('Point avec mon tuteur')}>
            <CalendarPlus size={15} aria-hidden="true" /> Demander un point avec mon tuteur
          </button>
        </div>
      </>
    );
  }
  if (p.qualification === 'adjoint') {
    const gardes = data.gardes.filter((g) => g.personId === p.id && g.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
    return (
      <>
        {tete(<MoonStar size={18} />, 'Mon métier', 'Mes gardes et mes missions')}
        <div className="card-body esp-corps">
          <div className="esp-sous">
            <h3>Mes prochaines gardes</h3>
            {gardes.length ? (
              <ul className="esp-jours">
                {gardes.map((g) => (
                  <li key={g.id}>
                    <b className="cap1">{jourLong(g.date)}</b>
                    <span className="num">
                      {nomGarde(g)} · {fmtHHMM(g.start)} → {fmtHHMM(g.end)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="soft small">Aucune garde ne vous est confiée pour l’instant.</p>
            )}
          </div>
          {competences}
          {jours('Mes prochains postes')}
        </div>
      </>
    );
  }
  return (
    <>
      {tete(<Award size={18} />, 'Mon métier', 'Mes compétences et mes postes')}
      <div className="card-body esp-corps">
        {competences ?? <p className="soft small">Aucune compétence particulière n’est notée sur votre fiche. Parlez-en à votre titulaire.</p>}
        {jours('Mes prochains postes')}
        <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => onRdv('Formation ou compétence')}>
          <CalendarPlus size={15} aria-hidden="true" /> Parler d’une formation
        </button>
      </div>
    </>
  );
}
