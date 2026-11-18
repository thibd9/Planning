import { Check, DoorClosed, DoorOpen, Plus, RotateCcw, Settings2, Store, Trash2, UserRound, Users, Utensils, UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';
import { JOURS, MOIS, fmtDateCourt, fmtDuree, fmtHHMM, parseHHMM, fmtDateLong, joursFeries } from '../../domain/time';
import type { CouleurPoste, Interval, PosteType } from '../../domain/types';
import { COULEUR_POSTE_LABEL } from '../../domain/types';
import { minutesTravail } from '../../engine/core';
import { estCollaboratif, limiteSouhaits, moisDe, moisDecale } from '../../engine/souhaits';
import { COULEURS_POSTE, DialoguePosteType, classePoste } from '../components/PosteTypeDialogue';
import { useStore } from '../../store/store';
import { SEMAINES_DE_REFERENCE, etatPublication, reglagePublication } from '../../engine/echeance';
import { useUi } from '../../store/ui';

function Heure({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }): JSX.Element {
  return (
    <input
      type="time"
      step={900}
      className="input num"
      aria-label={label}
      value={fmtHHMM(value)}
      onChange={(e) => {
        const v = parseHHMM(e.target.value);
        if (v !== null) onChange(v);
      }}
      style={{ padding: '5px 8px', width: 112 }}
    />
  );
}

export function Officine(): JSX.Element {
  const officine = useStore((s) => s.data.officine);
  const { majOfficine, reinitialiser } = useStore();
  const collaboratif = estCollaboratif(useStore((s) => s.data.officine));
  const donnees = useStore((s) => s.data);
  const aujourdhui = useStore((s) => s.today);
  const pub = reglagePublication(donnees.officine);
  const etatPub = etatPublication(donnees, aujourdhui);
  const [confirmation, setConfirmation] = useState(false);
  const [nouveauPoste, setNouveauPoste] = useState(false);
  const today = useStore((s) => s.today);
  const moisSuivant = moisDecale(moisDe(today), 1);
  // Les jours fériés des douze prochains mois.
  const feries = [Number(today.slice(0, 4)), Number(today.slice(0, 4)) + 1].flatMap((y) => [...joursFeries(y).entries()]).filter(([d]) => d >= today && d < `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`).sort((a, b) => a[0].localeCompare(b[0]));
  const dire = useUi((s) => s.dire);
  const setPoste = (id: string, patch: Partial<PosteType>): void => {
    majOfficine({ postes: officine.postes.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  };

  return (
    <div className="page page-officine">
      <div className="page-head">
        <span className="page-ico" aria-hidden="true">
          <Settings2 size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Officine</div>
          <h1>{officine.nom || 'Mon officine'}</h1>
          <p>Horaires d'ouverture, effectif attendu et postes types. Ces réglages sont des choix d'organisation : ils se modifient librement.</p>
        </div>
      </div>

      <div className="card pad row wrap" style={{ marginBottom: 20, alignItems: 'flex-end' }}>
        <span className="ico grad" style={{ alignSelf: 'center' }}>
          <Store size={18} />
        </span>
        <label className="field grow" style={{ minWidth: 240 }}>
          Nom de la pharmacie
          <input id="officine-nom" value={officine.nom} onChange={(e) => majOfficine({ nom: e.target.value })} placeholder="Pharmacie du Marché" />
        </label>
      </div>

      <div className="split egal">
        <div className="col" style={{ gap: 18 }}>
          <div className="card horaires">
            <div className="card-head">
              <h2 className="h3">Horaires d'ouverture</h2>
            </div>
            <div role="list" aria-label="Horaires d’ouverture par jour">
                {JOURS.map((j, i) => {
                  const plages = officine.horaires[i];
                  const setPlages = (p: Interval[]): void => majOfficine({ horaires: officine.horaires.map((h, k) => (k === i ? p : h)) });
                  return (
                    <div key={j} className="jour-ligne" role="listitem">
                      <div className="jl-nom cap1">{j}</div>
                      <div className="jl-heures">
                        {plages.length ? (
                          <div className="jl-plages">
                            {plages.map((h, k) => (
                              <div key={k} className="row" style={{ gap: 6 }}>
                                <Heure label={`${k === 0 ? 'Ouverture' : 'Réouverture'} le ${j}`} value={h.start} onChange={(v) => setPlages(plages.map((x, n) => (n === k ? { ...x, start: v } : x)))} />
                                <span className="muted" aria-hidden="true">→</span>
                                <Heure label={`${k === plages.length - 1 ? 'Fermeture' : 'Fermeture du midi'} le ${j}`} value={h.end} onChange={(v) => setPlages(plages.map((x, n) => (n === k ? { ...x, end: v } : x)))} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="muted">Fermé</span>
                        )}
                      </div>
                      <div className="jl-actions">
                          {plages.length === 1 && plages[0].end - plages[0].start > 240 ? (
                            <button
                              type="button"
                              className="btn icon sm jl-outil"
                              data-bulle="Ajouter une coupure le midi"
                              aria-label={`Coupure le midi : ${j}`}
                              onClick={() => setPlages([{ start: plages[0].start, end: Math.max(plages[0].start + 60, Math.min(750, plages[0].end - 120)) }, { start: Math.max(plages[0].start + 120, Math.min(840, plages[0].end - 60)), end: plages[0].end }])}
                            >
                              <Utensils size={17} aria-hidden="true" />
                            </button>
                          ) : null}
                          {plages.length === 2 ? (
                            <button type="button" className="btn icon sm jl-outil" data-bulle="Retirer la coupure du midi" aria-label={`Sans coupure : ${j}`} onClick={() => setPlages([{ start: plages[0].start, end: plages[1].end }])}>
                              <UtensilsCrossed size={17} aria-hidden="true" />
                            </button>
                          ) : null}
                          <button type="button" className="btn icon sm jl-outil" data-bulle={plages.length ? 'Fermer la pharmacie ce jour-là' : 'Ouvrir la pharmacie ce jour-là'} aria-label={plages.length ? `Fermer ce jour : ${j}` : `Ouvrir : ${j}`} onClick={() => setPlages(plages.length ? [] : [{ start: 9 * 60, end: 19 * 60 }])}>
                            {plages.length ? <DoorClosed size={17} aria-hidden="true" /> : <DoorOpen size={17} aria-hidden="true" />}
                          </button>
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="card-body" style={{ borderTop: '1px solid var(--line)' }}>
              <label className="check">
                <input type="checkbox" checked={officine.fermeJoursFeries} onChange={(e) => majOfficine({ fermeJoursFeries: e.target.checked })} />
                Officine fermée les jours fériés (hors gardes)
              </label>
            </div>
          </div>
          <div className="card pad col">
            <h2 className="h3">Paramètres</h2>
            <div className="champs">
              <label className="field">
                Valeur du point conventionnel (€)
                <input type="number" step="0.001" min={0} placeholder="à saisir" value={officine.valeurPoint ?? ''} onChange={(e) => majOfficine({ valeurPoint: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
              <label className="field">
                Demandes prioritaires par personne
                <input type="number" min={0} max={6} value={officine.plafondPrioritaires} onChange={(e) => majOfficine({ plafondPrioritaires: Number(e.target.value) })} />
              </label>
              <label className="field">
                Chiffre d'affaires annuel HT (€)
                <input type="number" step={10000} min={0} value={officine.caAnnuelHT ?? ''} onChange={(e) => majOfficine({ caAnnuelHT: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
            </div>
            <label className="check couts-option">
              <input type="checkbox" id="couts-afficher" checked={!!officine.couts} onChange={(e) => majOfficine({ couts: e.target.checked })} />
              <span>
                <b>Afficher les coûts estimés</b>
                <span className="small soft" style={{ display: 'block' }}>
                  Solvéa ne connaît pas vos salaires : sans cette option, aucun montant n’est affiché. Si vous la cochez, un champ « Taux horaire brut », facultatif, apparaît dans la fiche de chaque personne. Les coûts affichés
                  multiplient alors les heures planifiées par ce taux ; une personne sans taux n’est pas comptée. Ce n’est jamais un calcul de paie.
                </span>
              </span>
            </label>
            <p className="tiny muted">
              La valeur du point n'est pas préremplie : reprenez-la dans le barème en vigueur. Tant qu'elle est vide, les indemnités de sujétion sont exprimées en points.
            </p>
          </div>
        </div>

        <div className="col" style={{ gap: 18 }}>
          <div className="card">
            <div className="card-head">
              <div className="grow">
                <h2 className="h3">Combien de personnes au comptoir ?</h2>
                <div className="small soft">Le minimum à tenir, selon le jour et l’heure. En dessous, le planning vous prévient.</div>
              </div>
            </div>
            <table className="t">
              <thead>
                <tr>
                  <th scope="col">Jours</th>
                  <th scope="col">Horaire</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Personnes au minimum</th>
                </tr>
              </thead>
              <tbody>
                {officine.effectifs.map((e, i) => (
                  <tr key={i}>
                    <td className="cap1">{e.jours.length === 5 && e.jours[0] === 0 ? 'Lundi à vendredi' : e.jours.map((j) => JOURS[j]).join(', ')}</td>
                    <td className="num">
                      {fmtHHMM(e.start)} → {fmtHHMM(e.end)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="eff-min">
                      <input
                        type="number"
                        min={0}
                        max={12}
                        className="input num"
                        aria-label={`Nombre minimum de personnes, ${e.jours.length === 5 && e.jours[0] === 0 ? 'lundi à vendredi' : e.jours.map((j) => JOURS[j]).join(', ')}, de ${fmtHHMM(e.start)} à ${fmtHHMM(e.end)}`}
                        value={e.minEquipe}
                        onChange={(ev) => majOfficine({ effectifs: officine.effectifs.map((x, k) => (k === i ? { ...x, minEquipe: Number(ev.target.value) } : x)) })}
                        style={{ width: 70, textAlign: 'right', padding: '5px 7px' }}
                      />
                      <span className="small soft" aria-hidden="true">{e.minEquipe > 1 ? 'personnes' : 'personne'}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="card-body tiny muted" style={{ borderTop: '1px solid var(--line)' }}>
              Un pharmacien doit être présent à chaque minute d’ouverture : c’est contrôlé à part, quel que soit ce minimum.
            </div>
          </div>

          <div className="card pad col" data-focus="publication">
            <h2 className="h3">Publication du planning, au mois</h2>
            <div className="pub-regles">
              <span>Le planning d’un mois est transmis à l’équipe au plus tard</span>
              <label className="sr" htmlFor="pub-delai">
                Nombre de jours avant le 1er du mois
              </label>
              <input id="pub-delai" type="number" className="num" min={1} max={45} value={pub.delai} onChange={(e) => majOfficine({ publication: { ...pub, delai: Math.max(1, Math.min(45, Number(e.target.value) || 1)) } })} />
              <span>jours avant le 1er.</span>
            </div>
            <div className="pub-regles">
              <span>Solvéa vous le rappelle</span>
              <label className="sr" htmlFor="pub-rappel">
                Nombre de jours de rappel avant l’échéance
              </label>
              <input id="pub-rappel" type="number" className="num" min={0} max={30} value={pub.rappel} onChange={(e) => majOfficine({ publication: { ...pub, rappel: Math.max(0, Math.min(30, Number(e.target.value) || 0)) } })} />
              <span>jours avant cette échéance, sur le tableau de bord.</span>
            </div>
            <p className="pub-exemple" role="status">
              Pour {MOIS[Number(etatPub.mois.slice(5)) - 1]} : rappel à partir du {fmtDateCourt(etatPub.rappelLe)}, à publier au plus tard le {fmtDateCourt(etatPub.echeance)}.
            </p>
            <label className="check">
              <input type="checkbox" id="pub-relais" checked={pub.relais} onChange={(e) => majOfficine({ publication: { ...pub, relais: e.target.checked } })} />
              <span>
                <b>Passé l’échéance, laisser Solvéa préparer le planning</b>
                <span className="small soft" style={{ display: 'block' }}>
                  Si rien n’est fait à l’échéance, Solvéa prépare en brouillon les semaines restées vides, d’après vos habitudes : pour chaque personne et chaque jour, sa journée la plus fréquente sur vos {SEMAINES_DE_REFERENCE}{' '}
                  dernières semaines publiées. Un planning que vous avez commencé à la main passe toujours avant : il n’est jamais touché. Rien n’est publié sans vous : vous relisez, corrigez, puis publiez.
                </span>
              </span>
            </label>
            <p className="tiny muted">Solvéa fonctionne sur cet appareil, sans serveur : le rappel et la préparation se font à l’ouverture de l’application par un titulaire.</p>
          </div>

          <div className="card pad col" data-focus="modele">
            <h2 className="h3">Qui prépare le planning ?</h2>
            <fieldset className="qui-prepare">
              <legend className="sr">Façon de construire le planning</legend>
              <label className={collaboratif ? 'on' : ''}>
                <input type="radio" name="modele" checked={collaboratif} onChange={() => majOfficine({ modele: 'collaboratif' })} />
                <span className="qp-pic" aria-hidden="true">
                  <Users size={22} />
                </span>
                <span className="qp-texte">
                  <b>Avec l’équipe</b>
                  <span>Chacun dit ce qui l’arrange pour le mois suivant, puis vous construisez.</span>
                </span>
                <span className="qp-coche" aria-hidden="true">
                  <Check size={15} strokeWidth={3} />
                </span>
              </label>
              <label className={collaboratif ? '' : 'on'}>
                <input type="radio" name="modele" checked={!collaboratif} onChange={() => majOfficine({ modele: 'classique' })} />
                <span className="qp-pic" aria-hidden="true">
                  <UserRound size={22} />
                </span>
                <span className="qp-texte">
                  <b>Vous seul</b>
                  <span>Vous construisez sans recueillir de préférences ; l’équipe consulte le planning publié.</span>
                </span>
                <span className="qp-coche" aria-hidden="true">
                  <Check size={15} strokeWidth={3} />
                </span>
              </label>
            </fieldset>
            {collaboratif ? (
              <div className="qp-limite">
                <label htmlFor="souhaits-limite">Préférences à donner avant le</label>
                <select id="souhaits-limite" value={officine.souhaitsLimite ?? 20} onChange={(e) => majOfficine({ souhaitsLimite: Number(e.target.value) })}>
                  {Array.from({ length: 28 }, (_, k) => k + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span>du mois précédent</span>
                <span className="qp-exemple">
                  Pour {MOIS[Number(moisSuivant.slice(5)) - 1]} : jusqu’au {fmtDateCourt(limiteSouhaits(officine, moisSuivant))}
                </span>
              </div>
            ) : null}
            <div className="qp-effets" id="qp-effets" role="status">
              <h3>Ce que ce choix change dans l’application</h3>
              <div className="qp-effets-cols">
                <div>
                  <span className="eyebrow">Pour l’équipe</span>
                  {collaboratif ? (
                    <ul>
                      <li>« Mes demandes » propose la carte « Mes préférences » : chacun y indique, jour par jour, s’il préfère le matin, la journée, l’après-midi ou un repos.</li>
                      <li>Les préférences du mois suivant se donnent jusqu’à la date limite ci-dessus.</li>
                    </ul>
                  ) : (
                    <ul>
                      <li>La carte « Mes préférences » disparaît de « Mes demandes ».</li>
                      <li>L’équipe consulte le planning publié, sans donner d’avis avant.</li>
                    </ul>
                  )}
                </div>
                <div>
                  <span className="eyebrow">Pour vous</span>
                  {collaboratif ? (
                    <ul>
                      <li>Le tableau de bord compte les préférences reçues avant de construire.</li>
                      <li>La vue « Mois » les affiche, personne par personne.</li>
                      <li>« Proposer un planning » en tient compte, et l’une des trois propositions les suit en priorité.</li>
                    </ul>
                  ) : (
                    <ul>
                      <li>Vous construisez quand vous voulez, sans date limite à attendre.</li>
                      <li>Le tableau de bord n’a plus d’étape « Préférences » ; la vue « Mois » ne les affiche plus.</li>
                      <li>« Proposer un planning » s’appuie sur les contrats, les règles, l’équité et les contraintes saisies dans les fiches, sans préférences du mois.</li>
                    </ul>
                  )}
                </div>
              </div>
              <p className="tiny muted">
                Dans les deux cas : les règles et le nombre minimum de personnes passent avant tout, les demandes d’absence, d’horaires et de remplacement restent ouvertes à l’équipe, et vous seul publiez. Vous pouvez changer d’avis à tout
                moment : rien n’est effacé.
              </p>
            </div>
          </div>

        </div>
      </div>

      <div className="card pad col" style={{ marginTop: 18 }} data-focus="support">
        <div>
          <h2 className="h3">Support</h2>
          <p className="soft small" style={{ margin: '3px 0 0' }}>Quand Solvi ne sait pas répondre, il propose de joindre cette personne. Laissez vide : il renverra vers vous.</p>
        </div>
        <div className="champs">
          <label className="field" htmlFor="support-nom">
            Nom du contact
            <input id="support-nom" value={officine.support?.nom ?? ''} onChange={(e) => majOfficine({ support: { ...officine.support, nom: e.target.value } })} placeholder="Support Solvéa" autoComplete="off" />
          </label>
          <label className="field" htmlFor="support-email">
            Adresse électronique
            <input id="support-email" type="email" value={officine.support?.email ?? ''} onChange={(e) => majOfficine({ support: { ...officine.support, email: e.target.value } })} placeholder="support@exemple.fr" autoComplete="off" />
          </label>
          <label className="field" htmlFor="support-telephone">
            Téléphone
            <input id="support-telephone" type="tel" value={officine.support?.telephone ?? ''} onChange={(e) => majOfficine({ support: { ...officine.support, telephone: e.target.value } })} placeholder="01 23 45 67 89" autoComplete="off" />
          </label>
        </div>
      </div>

      <div className="card pad col" style={{ marginTop: 18 }}>
        <div className="row wrap">
          <div className="grow">
            <h2 className="h3">Jours fériés</h2>
            <p className="small soft" style={{ margin: '3px 0 0' }}>
              {officine.fermeJoursFeries ? 'L’officine est fermée ces jours-là, hors gardes : aucun poste n’y est proposé.' : 'L’officine reste ouverte ces jours-là : ils sont signalés dans les plannings.'}
            </p>
          </div>
          <span className={`pill ${officine.fermeJoursFeries ? 'neutral' : 'warn'}`}>{officine.fermeJoursFeries ? 'Fermée les jours fériés' : 'Ouverte les jours fériés'}</span>
        </div>
        <ul className="feries">
          {feries.map(([date, nom]) => (
            <li key={date}>
              <b>{nom}</b>
              <span className="cap1">{fmtDateLong(date).replace(/ \d{4}$/, '')}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ marginTop: 18, overflowX: 'auto' }}>
        <div className="card-head">
          <div className="grow">
            <h2 className="h3">Postes types</h2>
            <span className="small soft">Vos horaires habituels, chacun avec sa couleur. Ils servent à la saisie rapide et aux propositions de planning.</span>
          </div>
          <button type="button" className="btn primary sm" onClick={() => setNouveauPoste(true)}>
            <Plus size={14} /> Ajouter un poste type
          </button>
        </div>
        <table className="t pt-table">
          <thead>
            <tr>
              <th scope="col">Poste</th>
              <th scope="col">Couleur</th>
              <th scope="col">Horaires</th>
              <th scope="col">Pause</th>
              <th scope="col">Jours</th>
              <th scope="col" style={{ textAlign: 'right' }}>Travail effectif</th>
              <td />
            </tr>
          </thead>
          <tbody>
            {officine.postes.map((p) => (
              <tr key={p.id}>
                <td>
                  <input className="input pt-nom" aria-label="Nom du poste" value={p.label} onChange={(e) => setPoste(p.id, { label: e.target.value })} />
                </td>
                <td>
                  <span className="pt-couleur">
                    <i className={`pt-pastille ${classePoste(p)}`} aria-hidden="true" />
                    <select aria-label={`Couleur du poste ${p.label}`} value={p.couleur ?? ''} onChange={(e) => setPoste(p.id, { couleur: (e.target.value || undefined) as CouleurPoste | undefined })}>
                      <option value="">Automatique</option>
                      {COULEURS_POSTE.map((c) => (
                        <option key={c} value={c}>
                          {COULEUR_POSTE_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </span>
                </td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <Heure label={`Début du poste ${p.label}`} value={p.start} onChange={(v) => setPoste(p.id, { start: v })} />
                    <span className="muted">→</span>
                    <Heure label={`Fin du poste ${p.label}`} value={p.end} onChange={(v) => setPoste(p.id, { end: v })} />
                  </div>
                </td>
                <td>
                  {p.pauseStart !== undefined && p.pauseEnd !== undefined ? (
                    <div className="row" style={{ gap: 6 }}>
                      <Heure label={`Début de pause du poste ${p.label}`} value={p.pauseStart} onChange={(v) => setPoste(p.id, { pauseStart: v })} />
                      <span className="muted">→</span>
                      <Heure label={`Fin de pause du poste ${p.label}`} value={p.pauseEnd} onChange={(v) => setPoste(p.id, { pauseEnd: v })} />
                    </div>
                  ) : (
                    <span className="muted">Sans pause</span>
                  )}
                </td>
                <td className="small cap1">{p.jours.length === 5 && p.jours[0] === 0 ? 'Lundi à vendredi' : p.jours.map((j) => JOURS[j]).join(', ')}</td>
                <td className="num" style={{ textAlign: 'right' }}>{fmtDuree(minutesTravail(p))}</td>
                <td style={{ textAlign: 'right', width: 48 }}>
                  <button type="button" className="btn ghost icon" aria-label={`Retirer le poste ${p.label}`} onClick={() => majOfficine({ postes: officine.postes.filter((x) => x.id !== p.id) })}>
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card pad row wrap" style={{ marginTop: 18 }}>
        <div className="grow">
          <h2 className="h3">Repartir de zéro</h2>
          <p className="soft small" style={{ marginTop: 3 }}>
            Réinitialiser efface l’officine, l’équipe et les plannings enregistrés sur cet appareil, et ramène à l’écran de création.
          </p>
        </div>
        {confirmation ? (
          <div className="row wrap">
            <span className="small">Tout effacer et revenir à l’écran de création ?</span>
            <button type="button" className="btn" onClick={() => setConfirmation(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                reinitialiser();
                setConfirmation(false);
                dire('Application remise à zéro.');
              }}
            >
              <RotateCcw size={15} /> Oui, réinitialiser
            </button>
          </div>
        ) : (
          <button type="button" className="btn danger" onClick={() => setConfirmation(true)}>
            <RotateCcw size={15} /> Réinitialiser
          </button>
        )}
      </div>
      {nouveauPoste ? <DialoguePosteType onClose={() => setNouveauPoste(false)} onAjouter={(p) => { majOfficine({ postes: officine.postes.concat(p) }); dire(`Poste type « ${p.label} » ajouté.`, true); }} /> : null}
    </div>
  );
}
