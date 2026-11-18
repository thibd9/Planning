import { AlarmClock, ArrowLeftRight, ArrowRight, Building2, CalendarRange, Check, Handshake, Hourglass, MoonStar, ShieldCheck, UserMinus, UsersRound } from 'lucide-react';
import { useMemo } from 'react';
import { libelleRole, memeIdentifiant } from '../../domain/acces';
import { addDays, fmtDateCourt, fmtDateLong, fmtHeure, fmtSemaine, mondayOf, todayISO, totalDuree, weekDates } from '../../domain/time';
import type { AppData } from '../../domain/types';
import { nomCourt, MOTIF_RETARD_LABEL } from '../../domain/types';
import { ouverture, shiftsSemaine, trousPharmacien } from '../../engine/core';
import { arriveePrevue, retardsDuJour } from '../../engine/retard';
import { decisions } from '../../engine/decisions';
import { aRegulariser, semaineLibre } from '../../engine/heures';
import { estCollaboratif, moisDe, reponses } from '../../engine/souhaits';
import { validateWeek } from '../../engine/validate';
import { useStore } from '../../store/store';
import { ListeAnnonces, annoncesDe } from '../components/Annonces';
import { useUi } from '../../store/ui';
import { Avatar, Frise, Graduations, Pill } from '../kit';

/** Part des minutes d'ouverture d'une semaine où un pharmacien est planifié ; null si rien n'est posé. */
function couverture(data: AppData, monday: string): number | null {
  if (!shiftsSemaine(data, monday).length) return null;
  let total = 0;
  let sans = 0;
  for (const d of weekDates(monday)) {
    total += totalDuree(ouverture(data.officine, d));
    sans += totalDuree(trousPharmacien(data, d));
  }
  return total ? Math.round(((total - sans) / total) * 100) : null;
}

/** Tableau de bord du responsable : l'état de l'officine en un écran. */
export function Tableau({ personId }: { personId: string }): JSX.Element {
  const { data, autres, officineId, today, changerOfficine } = useStore();
  const { aller, setSemaine, session, setSujet, voirJour } = useUi();
  const moi = data.personnes.find((p) => p.id === personId);
  const lundi = mondayOf(today);
  const d = useMemo(() => decisions(data, today), [data, today]);
  const lireAnnonces = useStore((x) => x.lireAnnonces);
  // Les six dernières décisions annoncées, lues ou non.
  const recentes = annoncesDe(data, personId).slice(0, 6);
  const cetteSemaine = couverture(data, lundi);
  const heures = useMemo(() => aRegulariser(data, today).length, [data, today]);
  const suivante = addDays(lundi, 7);
  const etatSuivante = data.semaines[suivante]?.statut === 'publie' ? 'Publiée' : shiftsSemaine(data, suivante).length ? 'Brouillon' : 'À construire';
  const prochaineGarde = data.gardes.filter((g) => g.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const duJour = data.shifts.filter((s) => s.date === today).sort((a, b) => a.start - b.start);
  const retards = retardsDuJour(data, today);
  const absents = data.absences.filter((a) => a.statut === 'approuvee' && a.from <= today && today <= a.to);
  const pharmacies = [{ id: officineId, d: data }, ...Object.entries(autres).map(([id, x]) => ({ id, d: x }))].filter(({ d: x }) => x.personnes.some((p) => memeIdentifiant(p.identifiant, session ?? '')));

  // Les décisions, rangées par sujet : chaque ligne ouvre le bon onglet de « Résoudre ».
  const sujets: { cle: string; label: string; nombre: number; icone: JSX.Element }[] = [
    { cle: 'accords', label: 'Accords à donner', nombre: d.accords.length, icone: <Handshake size={18} /> },
    { cle: 'absences', label: 'Absences à couvrir', nombre: d.trous.length, icone: <UserMinus size={18} /> },
    { cle: 'remplacements', label: 'Remplacements', nombre: d.remplacements.length, icone: <ArrowLeftRight size={18} /> },
    { cle: 'demandes', label: 'Demandes de l’équipe', nombre: d.absences.length + d.besoins.length, icone: <Check size={18} /> },
    { cle: 'gardes', label: 'Gardes', nombre: d.gardesAAffecter.length + d.gardesRepos.length + d.gardesAbsence.length + d.gardesAValider.length, icone: <MoonStar size={18} /> },
    { cle: 'publications', label: 'Plannings à publier', nombre: d.publications.length, icone: <CalendarRange size={18} /> },
  ].filter((x) => x.nombre > 0);
  const ouvrir = (cle: string): void => {
    setSujet(cle);
    aller('resoudre');
  };
  const enPoste = [...new Map(duJour.map((s) => [s.personId, s])).values()];
  const ouvertAuj = ouverture(data.officine, today).length > 0;
  const presenceAuj = (() => {
    const total = totalDuree(ouverture(data.officine, today));
    return total ? Math.round(((total - totalDuree(trousPharmacien(data, today))) / total) * 100) : 0;
  })();

  // Le cycle d'une semaine : préférences, brouillon, contrôles, publication. On montre la première semaine à traiter.
  const cycle = useMemo(() => {
    const cible = semaineLibre(data, today);
    const postes = shiftsSemaine(data, cible).length;
    const bloquants = postes ? validateWeek(data, cible).filter((i) => i.gravite === 'bloquant').length : 0;
    const collaboratif = estCollaboratif(data.officine);
    const r = reponses(data, moisDe(addDays(cible, 3)));
    const recues = r.repondu.length;
    const attendues = recues + r.attendus.length;
    const voir = (): void => {
      setSemaine(cible);
      aller('construire');
    };
    const etapes: { nom: string; detail: string; etat: 'fait' | 'cours' | 'attente' }[] = [
      ...(collaboratif ? [{ nom: 'Préférences', detail: `${recues}/${attendues} reçues`, etat: recues >= attendues || postes ? ('fait' as const) : ('cours' as const) }] : []),
      { nom: 'Brouillon', detail: postes ? `${postes} postes` : 'À construire', etat: postes ? ('fait' as const) : ('attente' as const) },
      { nom: 'Contrôles', detail: !postes ? 'Après le brouillon' : bloquants ? `${bloquants} à corriger` : 'Tout est bon', etat: postes && !bloquants ? ('fait' as const) : ('attente' as const) },
      { nom: 'Publication', detail: 'À envoyer à l’équipe', etat: 'attente' as const },
    ];
    // L'étape en cours est la première qui n'est pas faite.
    const premiere = etapes.findIndex((e) => e.etat !== 'fait');
    if (premiere >= 0) etapes[premiere] = { ...etapes[premiere], etat: 'cours' };
    const bouton = !postes ? 'Construire' : bloquants ? 'Corriger' : 'Publier';
    return { semaine: cible, etapes, bouton, action: voir };
  }, [data, today, aller, setSemaine]);

  // Ce qui passe avant tout le reste : une seule chose, dite en clair, avec le bouton qui y mène.
  const priorite = ((): { ton: 'urgent' | 'attention' | 'calme' | 'ok'; icone: JSX.Element; titre: string; detail: string; bouton?: string; action?: () => void } => {
    const pluriel = (n: number, un: string, plusieurs: string): string => `${n} ${n > 1 ? plusieurs : un}`;
    if (d.trous.length) {
      const t = [...d.trous].sort((a, b) => a.shift.date.localeCompare(b.shift.date) || a.shift.start - b.shift.start)[0];
      const qui = data.personnes.find((x) => x.id === t.shift.personId);
      return { ton: 'urgent', icone: <UserMinus size={22} />, titre: `${pluriel(d.trous.length, 'poste', 'postes')} sans personne`, detail: `Le plus proche : celui ${qui ? `de ${nomCourt(qui)}` : 'd’un absent'}, ${fmtDateCourt(t.shift.date)} de ${fmtHeure(t.shift.start)} à ${fmtHeure(t.shift.end)}.`, bouton: 'Couvrir l’absence', action: () => ouvrir('absences') };
    }
    if (d.remplacements.length) {
      const r = [...d.remplacements].sort((a, b) => a.date.localeCompare(b.date))[0];
      const qui = data.personnes.find((x) => x.id === r.demandeur);
      return { ton: 'attention', icone: <ArrowLeftRight size={22} />, titre: `${pluriel(d.remplacements.length, 'demande', 'demandes')} de remplacement`, detail: `${qui ? nomCourt(qui) : 'Un collègue'} demande à être remplacé ${fmtDateCourt(r.date)}.`, bouton: 'Répondre', action: () => ouvrir('remplacements') };
    }
    if (d.accords.length) return { ton: 'attention', icone: <Handshake size={22} />, titre: `${pluriel(d.accords.length, 'accord', 'accords')} à donner`, detail: 'Un titulaire attend votre accord pour appliquer sa décision.', bouton: 'Donner mon accord', action: () => ouvrir('accords') };
    const demandes = d.absences.length + d.besoins.length;
    if (demandes) return { ton: 'attention', icone: <Check size={22} />, titre: `${pluriel(demandes, 'demande', 'demandes')} de l’équipe à trancher`, detail: 'Congés et horaires : chacun attend une réponse.', bouton: 'Répondre', action: () => ouvrir('demandes') };
    const gardes = d.gardesAAffecter.length + d.gardesRepos.length + d.gardesAbsence.length + d.gardesAValider.length;
    if (gardes) return { ton: 'attention', icone: <MoonStar size={22} />, titre: `${pluriel(gardes, 'garde', 'gardes')} à régler`, detail: 'À confier, à valider, ou un repos à prévoir.', bouton: 'Voir les gardes', action: () => ouvrir('gardes') };
    if (d.publications.length) return { ton: 'attention', icone: <CalendarRange size={22} />, titre: 'Un planning attend d’être publié', detail: `Semaine du ${fmtSemaine(d.publications[0].monday)} : l’équipe ne voit pas encore ses horaires.`, bouton: 'Publier', action: () => ouvrir('publications') };
    if (cycle.etapes.some((e) => e.etat !== 'fait')) return { ton: 'calme', icone: <CalendarRange size={22} />, titre: `Préparer la semaine du ${fmtSemaine(cycle.semaine)}`, detail: 'Rien d’urgent : c’est le bon moment pour avancer le prochain planning.', bouton: cycle.bouton, action: cycle.action };
    return { ton: 'ok', icone: <Check size={22} />, titre: 'Tout est à jour', detail: 'Absences couvertes, demandes arbitrées, plannings publiés.' };
  })();
  // L'équipe du jour, une ligne par personne, sur l'échelle des heures d'ouverture.
  const ouvertures = ouverture(data.officine, today);
  const echelle = ouvertures.length ? { start: Math.floor(ouvertures[0].start / 60) * 60, end: Math.ceil(ouvertures[ouvertures.length - 1].end / 60) * 60 } : { start: 8 * 60, end: 20 * 60 };
  const parPersonne = [...new Set(duJour.map((s) => s.personId))].map((id) => ({ p: data.personnes.find((x) => x.id === id), postes: duJour.filter((s) => s.personId === id) })).filter((x) => x.p);
  const maintenant = new Date().getHours() * 60 + new Date().getMinutes();
  const aiguille = today === todayISO() && maintenant > echelle.start && maintenant < echelle.end ? ((maintenant - echelle.start) / (echelle.end - echelle.start)) * 100 : null;

  return (
    <div className="tb">
      <header className="tb-entete">
        <div className="tbh-texte">
          <div className="eyebrow">{fmtDateLong(today)}</div>
          <h1>Bonjour {moi?.prenom}</h1>
        </div>
        <p className="tb-resume">
          <span>
            {d.total ? (
              <>
                <b>
                  {d.total} décision{d.total > 1 ? 's' : ''}
                </b>{' '}
                vous {d.total > 1 ? 'attendent' : 'attend'}. Commencez par la première, le reste suit dans l’ordre.
              </>
            ) : (
              <>
                <b>Rien n’attend votre décision.</b> Vous pouvez avancer le prochain planning.
              </>
            )}
          </span>
        </p>
      </header>

      <section className={`tb-priorite ${priorite.ton}`} aria-labelledby="tb-prio" data-focus="priorite">
        <span className="tb-prio-ico" aria-hidden="true">
          {priorite.icone}
        </span>
        <div className="grow">
          <div className="eyebrow">{priorite.ton === 'ok' ? 'Aujourd’hui' : 'À faire en premier'}</div>
          <h2 id="tb-prio">{priorite.titre}</h2>
          <p>{priorite.detail}</p>
        </div>
        {priorite.action && priorite.bouton ? (
          <button type="button" className="btn primary" onClick={priorite.action}>
            {priorite.bouton} <ArrowRight size={16} aria-hidden="true" />
          </button>
        ) : null}
      </section>

      <div className="tb-chiffres" aria-label="Repères">
        <button type="button" className="tb-chiffre tb-auj" onClick={() => voirJour(today)}>
          <span className="ico" aria-hidden="true"><UsersRound size={18} /></span>
          <span className="grow">
            <span className="l">L’équipe aujourd’hui</span>
            <span className="v">{ouvertAuj ? <><span className="num">{enPoste.length}</span> en poste</> : 'Fermée'}</span>
            <span className="d">{ouvertAuj ? `${absents.length ? `${absents.length} absent${absents.length > 1 ? 's' : ''}` : 'Aucun absent'} · pharmacien ${presenceAuj} %` : 'Pas d’ouverture aujourd’hui'}</span>
          </span>
        </button>
        <button type="button" className="tb-chiffre" onClick={() => { setSemaine(lundi); aller('construire'); }}>
          <span className="ico" aria-hidden="true"><ShieldCheck size={18} /></span>
          <span className="grow">
            <span className="l">Pharmacien présent</span>
            <span className="v num">{cetteSemaine === null ? '-' : `${cetteSemaine} %`}</span>
            <span className="d">cette semaine</span>
          </span>
        </button>
        <button type="button" className="tb-chiffre" onClick={() => { setSemaine(suivante); aller('construire'); }}>
          <span className="ico" aria-hidden="true"><CalendarRange size={18} /></span>
          <span className="grow">
            <span className="l">Semaine prochaine</span>
            <span className="v">{etatSuivante}</span>
            <span className="d">du {fmtSemaine(suivante)}</span>
          </span>
        </button>
        <button type="button" className="tb-chiffre" onClick={() => aller('heures')}>
          <span className="ico" aria-hidden="true"><Hourglass size={18} /></span>
          <span className="grow">
            <span className="l">Compteurs d’heures</span>
            <span className="v">{heures ? <><span className="num">{heures}</span> à régulariser</> : 'À jour'}</span>
            <span className="d">{heures ? 'heures en plus ou en moins' : 'chacun est à son contrat'}</span>
          </span>
        </button>
        <button type="button" className="tb-chiffre" onClick={() => aller('gardes')}>
          <span className="ico" aria-hidden="true"><MoonStar size={18} /></span>
          <span className="grow">
            <span className="l">Prochaine garde</span>
            <span className="v cap1">{prochaineGarde ? fmtDateCourt(prochaineGarde.date) : 'Aucune'}</span>
            <span className="d">{prochaineGarde ? (prochaineGarde.personId ? nomCourt(data.personnes.find((p) => p.id === prochaineGarde.personId) ?? data.personnes[0]) : 'À affecter') : 'rien de prévu'}</span>
          </span>
        </button>
      </div>

      <div className="tb-grille">
        <div className="tb-col">
          <section className="card tb-faire" aria-labelledby="tb-faire">
            <div className="card-head">
              <div className="grow">
                <div className="eyebrow">À décider</div>
                <h2 id="tb-faire">{d.total ? `${d.total} décision${d.total > 1 ? 's' : ''} à prendre` : 'Tout est à jour'}</h2>
              </div>
              {d.total ? (
                <button type="button" className="btn" onClick={() => aller('resoudre')}>
                  Tout voir <ArrowRight size={16} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            {sujets.length ? (
              <div className="tb-sujets">
                {sujets.map((x, i) => (
                  <button key={x.cle} type="button" className={`tb-sujet${i === 0 ? ' premier' : ''}`} onClick={() => ouvrir(x.cle)}>
                    <span className="ico" aria-hidden="true">{x.icone}</span>
                    <span className="grow">{x.label}</span>
                    <span className="compte num">{x.nombre}</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="card-body soft tb-ajour">
                <span className="tb-ajour-ico" aria-hidden="true">
                  <Check size={22} />
                </span>
                <span>Absences couvertes, demandes arbitrées, plannings publiés.</span>
              </p>
            )}
          </section>


          <section className="card cycle" aria-labelledby="tb-cycle" data-focus="cycle">
            <div className="cycle-tete">
              <div className="grow">
                <div className="eyebrow">Le prochain planning</div>
                <h2 id="tb-cycle">Semaine du {fmtSemaine(cycle.semaine)}</h2>
              </div>
              <button type="button" className="btn" onClick={cycle.action}>
                {cycle.bouton} <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
            <ol className="cycle-etapes">
              {cycle.etapes.map((e, i) => (
                <li key={e.nom} className={e.etat} aria-current={e.etat === 'cours' ? 'step' : undefined}>
                  <span className="cycle-pastille" aria-hidden="true">
                    {e.etat === 'fait' ? <Check size={15} /> : i + 1}
                  </span>
                  <span>
                    <b>{e.nom}</b>
                    <span className="small soft">{e.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section className="card tb-jour" aria-labelledby="tb-jour">
          <div className="card-head">
            <div className="grow">
              <div className="eyebrow">Aujourd’hui au comptoir</div>
              <h2 id="tb-jour">
                {enPoste.length ? `${enPoste.length} personne${enPoste.length > 1 ? 's' : ''} en poste` : 'Aucun poste planifié'}
                {absents.length ? ` · ${absents.length} absent${absents.length > 1 ? 's' : ''}` : ''}
              </h2>
            </div>
            <button type="button" className="btn" onClick={() => voirJour(today)}>
              Voir la journée <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
          {parPersonne.length ? (
            <div className="tbj">
              <div className="tbj-ligne tete" aria-hidden="true">
                <span />
                <Graduations echelle={echelle} />
              </div>
              {parPersonne.map(({ p, postes }) =>
                p ? (
                  <div key={p.id} className="tbj-ligne">
                    <span className="tbj-qui">
                      <Avatar person={p} />
                      <span style={{ minWidth: 0 }}>
                        <b>{nomCourt(p)}</b>
                        <span className="small soft">{libelleRole(data, p)}</span>
                        {retards
                          .filter((r) => r.personId === p.id)
                          .map((r) => (
                            <span key={r.id} className="tbj-retard" title={[r.motif ? MOTIF_RETARD_LABEL[r.motif] : '', r.note ?? ''].filter(Boolean).join(' : ') || undefined}>
                              <AlarmClock size={12} aria-hidden="true" /> Retard<span className="sr"> annoncé</span> · arrivée {fmtHeure(arriveePrevue(r))}
                            </span>
                          ))}
                      </span>
                    </span>
                    <span className="tbj-piste">
                      <Frise shifts={postes} echelle={echelle} />
                      {aiguille !== null ? <i className="tbj-aiguille" style={{ left: `${aiguille}%` }} aria-hidden="true" /> : null}
                      <span className="sr">{postes.map((s) => `${fmtHeure(s.start)} – ${fmtHeure(s.end)}`).join(', ')}</span>
                    </span>
                  </div>
                ) : null,
              )}
              {absents.length ? (
                <p className="tbj-absents">
                  <UserMinus size={15} aria-hidden="true" /> Absent{absents.length > 1 ? 's' : ''} :{' '}
                  {absents.map((a) => { const q = data.personnes.find((x) => x.id === a.personId); return q ? nomCourt(q) : ''; }).filter(Boolean).join(', ')}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="card-body soft">Construisez ou publiez la semaine pour voir ici l’équipe du jour.</p>
          )}
        </section>
      </div>

      {recentes.length ? (
        <section className="card tb-annonces" aria-labelledby="tb-annonces" data-focus="annonces" style={{ marginTop: 24 }}>
          <div className="card-head">
            <div className="grow">
              <div className="eyebrow">Déjà décidé</div>
              <h2 id="tb-annonces">Décisions récentes</h2>
              <div className="small soft">Ce qui a été décidé, et ce que cela change dans les plannings. Les personnes concernées sont prévenues.</div>
            </div>
            {recentes.some((a) => !a.luPar.includes(personId)) ? (
              <button type="button" className="btn sm" onClick={() => lireAnnonces(personId)}>
                Tout marquer comme lu
              </button>
            ) : null}
          </div>
          <ListeAnnonces data={data} annonces={recentes} moi={personId} onLu={(id) => lireAnnonces(personId, id)} />
        </section>
      ) : null}

      {pharmacies.length > 1 ? (
        <section className="card" aria-labelledby="tb-pharmacies" style={{ marginTop: 24 }}>
          <div className="card-head">
            <span className="ico" aria-hidden="true"><Building2 size={18} /></span>
            <h2 id="tb-pharmacies" className="h3 grow">Mes pharmacies</h2>
          </div>
          <div className="card-body col">
            {pharmacies.map(({ id, d: x }) => {
              const n = decisions(x, today).total;
              return (
                <div key={id} className="row wrap">
                  <div className="grow">
                    <b>{x.officine.nom}</b>
                    <div className="small soft">
                      {x.personnes.filter((p) => !p.externe).length} personnes · {n} décision{n > 1 ? 's' : ''}
                    </div>
                  </div>
                  {id === officineId ? <Pill tone="ok">Ouverte</Pill> : (
                    <button type="button" className="btn sm" onClick={() => changerOfficine(id)}>
                      Ouvrir
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
