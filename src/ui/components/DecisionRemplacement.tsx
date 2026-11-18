import { Check, MessageSquareText, Paperclip, UserCheck, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RAISONS_REFUS, motifRefus, texteRefus } from '../../domain/refus';
import { addDays, fmtDateCourt, fmtDuree, fmtHeure, mondayOf } from '../../domain/time';
import { MOTIF_REMPLACEMENT_LABEL, nomCourt } from '../../domain/types';
import type { Remplacement } from '../../domain/types';
import { tourRemplacement } from '../../engine/appel';
import { minutesSemaine, sousEffectifs, trousPharmacienExpliques } from '../../engine/core';
import { cibleSemaine } from '../../engine/heures';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Avatar, Delai, Dialog, PastilleUrgence } from '../kit';

type Choix = 'equipe' | 'confier' | 'refuser';

/**
 * Décider d'une demande de remplacement. La fenêtre réunit ce qu'il faut pour trancher : la demande et sa raison,
 * qui peut reprendre le poste, ce qui se passe au comptoir s'il n'est pas repris. Puis trois décisions possibles,
 * avec le message que la personne recevra.
 */
export function DecisionRemplacement({ remplacement: r, onClose }: { remplacement: Remplacement; onClose: () => void }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { deciderDemande, validerRemplacement } = useStore();
  const dire = useUi((s) => s.dire);
  const demandeur = data.personnes.find((p) => p.id === r.demandeur);
  const prenom = demandeur?.prenom ?? 'la personne';
  const quand = `${fmtDateCourt(r.date)}, ${fmtHeure(r.start)} – ${fmtHeure(r.end)}`;
  const urgence = r.urgence ?? 'prevu';
  const tour = useMemo(() => tourRemplacement(data, r, today), [data, r, today]);
  const peuvent = tour.filter((c) => c.ok);
  const nePeuvent = tour.filter((c) => !c.ok);
  const deja = data.remplacements.filter((x) => x.demandeur === r.demandeur && !x.trouId && x.date >= addDays(today, -90) && x.statut !== 'annulee').length;
  /** Ce que le poste ajouterait à la semaine du remplaçant, face à son contrat. */
  const enPlus = (id: string): string => {
    const p = data.personnes.find((x) => x.id === id);
    if (!p || !p.salarie) return '';
    const monday = mondayOf(r.date);
    const ecart = minutesSemaine(data, id, monday) + (r.end - r.start) - cibleSemaine(data, p, monday);
    return ecart > 0 ? `+${fmtDuree(ecart)} sur son contrat` : 'dans ses heures';
  };
  // Le comptoir ce jour-là si personne ne reprend le poste : c'est ce qu'on accepte de risquer en disant oui.
  const sans = useMemo(() => {
    const allege = { ...data, shifts: data.shifts.filter((s) => !(s.personId === r.demandeur && s.date === r.date && s.start < r.end && r.start < s.end)) };
    // Les plages sont ramenées aux heures du poste, et celles qui se suivent n'en font qu'une.
    const dansLePoste = (l: { start: number; end: number }[]): { start: number; end: number }[] => {
      const out: { start: number; end: number }[] = [];
      for (const t of l.filter((x) => x.start < r.end && r.start < x.end).sort((a, b) => a.start - b.start)) {
        const plage = { start: Math.max(t.start, r.start), end: Math.min(t.end, r.end) };
        const dernier = out[out.length - 1];
        if (dernier && plage.start <= dernier.end) dernier.end = Math.max(dernier.end, plage.end);
        else out.push(plage);
      }
      return out;
    };
    return { pharmacien: dansLePoste(trousPharmacienExpliques(allege, r.date).trous), effectif: dansLePoste(sousEffectifs(allege, r.date)) };
  }, [data, r]);
  const [choix, setChoix] = useState<Choix | null>(null);
  const [remplacant, setRemplacant] = useState(peuvent[0]?.personId ?? '');
  const [raison, setRaison] = useState('');
  const [mot, setMot] = useState('');
  const motif = motifRefus(raison, mot);
  const confie = data.personnes.find((p) => p.id === remplacant);
  const message =
    choix === 'refuser'
      ? texteRefus(`de remplacement du ${quand}`, motif, 'Vous restez en poste.')
      : choix === 'confier' && confie
        ? `Votre demande de remplacement du ${quand} est acceptée : ${nomCourt(confie)} reprend votre poste.`
        : choix === 'equipe'
          ? `Votre demande de remplacement du ${quand} est acceptée. L’équipe disponible est prévenue ; tant qu’un remplaçant n’est pas validé, le poste reste le vôtre.`
          : '';
  /** « de 12 h 30 à 13 h 30 et de 16 h 30 à 19 h 30 ». */
  const plages = (l: { start: number; end: number }[]): string => {
    const t = l.map((x) => `de ${fmtHeure(x.start)} à ${fmtHeure(x.end)}`);
    return t.length <= 1 ? (t[0] ?? '') : `${t.slice(0, -1).join(', ')} et ${t[t.length - 1]}`;
  };
  const pret = choix === 'equipe' || choix === 'refuser' || (choix === 'confier' && !!confie);
  const confirmer = (): void => {
    if (choix === 'refuser') {
      deciderDemande(r.id, false, motif);
      dire(`Demande de ${prenom} refusée : ${demandeur ? 'il ou elle' : 'la personne'} reçoit votre message.`, true);
    } else if (choix === 'confier' && confie) {
      deciderDemande(r.id, true);
      validerRemplacement(r.id, confie.id);
      dire(`Remplacement décidé : ${nomCourt(confie)} reprend le poste de ${prenom}. Les deux sont prévenus.`, true);
    } else {
      deciderDemande(r.id, true);
      dire(`Demande de ${prenom} acceptée : ${peuvent.length} personne${peuvent.length > 1 ? 's' : ''} prévenue${peuvent.length > 1 ? 's' : ''}.`, true);
    }
    onClose();
  };
  const options: { cle: Choix; titre: string; phrase: string; Icone: typeof Users; off?: boolean }[] = [
    {
      cle: 'equipe',
      titre: 'Accepter et prévenir l’équipe',
      phrase: peuvent.length > 1 ? `${peuvent.length} personnes peuvent reprendre le poste : elles sont prévenues ensemble. Vous validerez le volontaire.` : peuvent.length ? 'Une personne peut reprendre le poste : elle est prévenue. Vous validerez si elle se propose.' : 'Personne ne peut reprendre ce poste sans enfreindre une règle : l’appel resterait sans réponse.',
      Icone: Users,
      off: !peuvent.length,
    },
    { cle: 'confier', titre: 'Accepter et confier le poste', phrase: peuvent.length ? 'Vous choisissez tout de suite qui reprend le poste, si vous vous êtes déjà mis d’accord.' : 'Aucun collègue ne peut le reprendre en l’état.', Icone: UserCheck, off: !peuvent.length },
    { cle: 'refuser', titre: 'Refuser', phrase: `Le poste reste celui de ${prenom}, qui reçoit votre raison.`, Icone: X },
  ];
  return (
    <Dialog
      size="mid"
      title={`Décider : remplacement de ${demandeur ? nomCourt(demandeur) : 'la personne'}`}
      subtitle={`Poste du ${quand}.`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Plus tard
          </button>
          <button type="button" className={`btn ${choix === 'refuser' ? 'danger' : 'primary'}`} id="dr-confirmer" disabled={!pret} onClick={confirmer}>
            {choix === 'refuser' ? <X size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
            {choix === 'refuser' ? `Refuser et prévenir ${prenom}` : choix === 'confier' && confie ? `Confier le poste à ${confie.prenom}` : choix === 'equipe' ? 'Accepter et prévenir l’équipe' : 'Choisissez une décision'}
          </button>
        </>
      }
    >
      <div className="dr">
        <section className="dr-bloc" aria-labelledby="dr-demande">
          <h3 id="dr-demande">La demande</h3>
          <div className="dr-demande">
            <Avatar person={demandeur} />
            <div className="grow">
              <div className="row wrap" style={{ gap: 8, marginBottom: 6 }}>
                <PastilleUrgence urgence={urgence} />
                <Delai date={r.date} today={today} />
              </div>
              <dl className="dr-faits">
                <dt>Motif</dt>
                <dd>
                  {r.motif ? MOTIF_REMPLACEMENT_LABEL[r.motif] : 'Non précisé'}
                  {r.precision ? ` : « ${r.precision} »` : ''}
                </dd>
                <dt>Sur trois mois</dt>
                <dd>{deja <= 1 ? 'C’est sa première demande de remplacement.' : `C’est sa ${deja}e demande de remplacement.`}</dd>
                {r.justificatif ? (
                  <>
                    <dt>Justificatif</dt>
                    <dd>
                      {r.justificatif.data ? (
                        <a className="piece-lien" href={r.justificatif.data} download={r.justificatif.nom}>
                          <Paperclip size={13} aria-hidden="true" /> {r.justificatif.nom}
                        </a>
                      ) : (
                        'Rangé dans « Documents ».'
                      )}
                    </dd>
                  </>
                ) : null}
              </dl>
            </div>
          </div>
        </section>

        <section className="dr-bloc" aria-labelledby="dr-qui">
          <h3 id="dr-qui">Qui peut reprendre ce poste</h3>
          {peuvent.length ? (
            <ul className="dr-candidats" id="dr-candidats">
              {peuvent.map((c) => {
                const p = data.personnes.find((x) => x.id === c.personId);
                return (
                  <li key={c.personId}>
                    <Avatar person={p} />
                    <span className="grow">
                      <b>{p ? nomCourt(p) : '-'}</b>
                      <span className="small soft">
                        Règles respectées · {enPlus(c.personId)} · {c.depannages ? `${c.depannages} dépannage${c.depannages > 1 ? 's' : ''} sur 3 mois` : 'aucun dépannage sur 3 mois'}
                      </span>
                    </span>
                    {c.rang === 1 ? <span className="dr-rang">À son tour</span> : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="dr-alerte">Personne ne peut reprendre ce poste sans enfreindre une règle (repos, durée de travail, présence d’un pharmacien).</p>
          )}
          {nePeuvent.length ? (
            <p className="small soft" style={{ margin: 0 }}>
              {nePeuvent.length} autre{nePeuvent.length > 1 ? 's ne peuvent' : ' ne peut'} pas :{' '}
              {nePeuvent
                .slice(0, 3)
                .map((c) => {
                  const p = data.personnes.find((x) => x.id === c.personId);
                  return `${p ? p.prenom : '-'} (${(c.raisons[0] ?? 'indisponible').replace(/\.$/, '').toLowerCase()})`;
                })
                .join(', ')}
              {nePeuvent.length > 3 ? '…' : '.'}
            </p>
          ) : null}
        </section>

        <section className="dr-bloc" aria-labelledby="dr-sans">
          <h3 id="dr-sans">Si personne ne le reprend</h3>
          {sans.pharmacien.length || sans.effectif.length ? (
            <ul className="dr-risques" id="dr-risques">
              {sans.pharmacien.length ? (
                <li className="bad">
                  Sans {prenom}, la pharmacie serait ouverte sans pharmacien {plages(sans.pharmacien)}.
                </li>
              ) : null}
              {sans.effectif.length ? (
                <li>
                  Sans {prenom}, le comptoir serait sous l’effectif attendu {plages(sans.effectif)}.
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="dr-ok">Même sans {prenom}, un pharmacien est présent et l’effectif attendu est atteint.</p>
          )}
          <p className="small soft" style={{ margin: 0 }}>Dans tous les cas, le poste reste le sien tant qu’un remplaçant n’est pas validé.</p>
        </section>

        <fieldset className="dr-bloc dr-decision">
          <legend>Votre décision</legend>
          <div className="dr-choix">
            {options.map(({ cle, titre, phrase, Icone, off }) => (
              <label key={cle} className={`fo-carte dr-carte${choix === cle ? ' on' : ''}${off ? ' off' : ''}${cle === 'refuser' ? ' non' : ''}`} htmlFor={`dr-${cle}`}>
                <input id={`dr-${cle}`} type="radio" name="dr-decision" checked={choix === cle} disabled={off} onChange={() => setChoix(cle)} />
                <span className="fo-ico" aria-hidden="true">
                  <Icone size={20} />
                </span>
                <span className="fo-texte">
                  <b>{titre}</b>
                  <span>{phrase}</span>
                </span>
                <span className="fo-coche" aria-hidden="true">
                  <Check size={14} strokeWidth={3} />
                </span>
              </label>
            ))}
          </div>
          {choix === 'confier' ? (
            <label className="field" htmlFor="dr-remplacant">
              Qui reprend le poste ?
              <select id="dr-remplacant" value={remplacant} onChange={(e) => setRemplacant(e.target.value)}>
                {peuvent.map((c) => {
                  const p = data.personnes.find((x) => x.id === c.personId);
                  return (
                    <option key={c.personId} value={c.personId}>
                      {p ? nomCourt(p) : '-'} ({enPlus(c.personId)})
                    </option>
                  );
                })}
              </select>
            </label>
          ) : null}
          {choix === 'refuser' ? (
            <>
              <label className="field" htmlFor="dr-raison">
                Raison du refus
                <select id="dr-raison" value={raison} onChange={(e) => setRaison(e.target.value)}>
                  <option value="">Ne pas préciser</option>
                  {RAISONS_REFUS.remplacement.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" htmlFor="dr-mot">
                <span>
                  Un mot pour {prenom} <span className="oblig">facultatif</span>
                </span>
                <textarea id="dr-mot" rows={3} maxLength={240} value={mot} onChange={(e) => setMot(e.target.value)} placeholder="Par exemple : un autre jour de la semaine serait possible." />
              </label>
            </>
          ) : null}
          {message ? (
            <div className="refus-apercu" aria-live="polite" id="dr-message">
              <span className="refus-apercu-tete">
                <MessageSquareText size={14} aria-hidden="true" /> Ce que {prenom} recevra
              </span>
              <p>{message}</p>
            </div>
          ) : null}
        </fieldset>
      </div>
    </Dialog>
  );
}
