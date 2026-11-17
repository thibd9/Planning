import { AlertTriangle, CircleCheck, ClipboardPaste, Clock3, Info, MoonStar, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  JOURS,
  JOURS_COURT,
  MOIS,
  MOIS_COURT,
  addDays,
  dayIndex,
  fmtDateCourt,
  fmtDateLong,
  fmtDecimal,
  fmtDuree,
  fmtEuros,
  fmtHHMM,
  fmtHeure,
  fmtHorodatage,
  parseHHMM,
  weekday,
} from '../../domain/time';
import type { Garde, GardeType } from '../../domain/types';
import { GARDE_LABEL, estPharmacien, nomCourt } from '../../domain/types';
import { decrireShift, gardeDuree } from '../../engine/core';
import type { EtapeGarde } from '../../engine/gardes';
import { congesIncompatibles, delaiGarde, etapeGarde, parseCalendrierGardes, reposApresGarde, variablesGarde } from '../../engine/gardes';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Avatar, Dialog, Empty, Pill } from '../kit';

const ETAPES: { cle: EtapeGarde; label: string }[] = [
  { cle: 'prevue', label: 'Prévue' },
  { cle: 'affectee', label: 'Affectée' },
  { cle: 'realisee', label: 'Réalisée' },
  { cle: 'repos', label: 'Repos réglé' },
  { cle: 'validee', label: 'Validée pour la paie' },
];

export function Gardes(): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { gardeId, ouvrirGarde } = useUi();
  const [importer, setImporter] = useState(false);
  const [ajout, setAjout] = useState(false);
  const gardes = useMemo(() => data.gardes.slice().sort((a, b) => a.date.localeCompare(b.date)), [data.gardes]);
  const prochaine = gardes.find((g) => g.date >= today) ?? gardes[gardes.length - 1];
  const courante = gardes.find((g) => g.id === gardeId) ?? prochaine;
  const annee = today.slice(0, 4);
  const pharmaciens = data.personnes.filter((p) => estPharmacien(p) && !p.externe);
  const compte = (id: string): number => data.gardes.filter((g) => g.personId === id && g.date.startsWith(annee)).length;

  return (
    <div>
      <div className="page-head">
        <span className="page-ico">
          <MoonStar size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Gardes</div>
          <h1>De la garde à la paie</h1>
          <p>
            Le calendrier de garde est fixé hors de l'officine. Importez vos obligations, puis suivez chaque garde : affectation, interventions, repos à protéger, variables pour le comptable.
          </p>
        </div>
        <div className="row wrap">
          <button type="button" className="btn" onClick={() => setImporter(true)}>
            <ClipboardPaste size={15} /> Importer un calendrier
          </button>
          <button type="button" className="btn primary" onClick={() => setAjout(true)}>
            <Plus size={15} /> Ajouter une garde
          </button>
        </div>
      </div>

      {!gardes.length ? (
        <Empty
          icon={<MoonStar size={30} />}
          title="Aucune garde au calendrier"
          action={
            <button type="button" className="btn primary" onClick={() => setAjout(true)}>
              <Plus size={15} /> Ajouter une garde
            </button>
          }
        >
          Ajoutez vos gardes une à une, ou collez le calendrier reçu du syndicat ou de l’ARS. Relève suit ensuite chaque garde jusqu’aux variables de paie.
        </Empty>
      ) : (
        <>
        <div className="card pad" style={{ marginBottom: 18 }}>
          <div className="row wrap" style={{ gap: 18 }}>
            <div>
              <div className="eyebrow">Répartition {annee}</div>
              <div className="small soft">Gardes et astreintes par pharmacien</div>
            </div>
            {pharmaciens.map((p) => (
              <div key={p.id} className="row" style={{ gap: 8 }}>
                <Avatar person={p} />
                <div>
                  <b>{nomCourt(p)}</b>
                  <div className="small soft num">
                    {compte(p.id)} garde{compte(p.id) > 1 ? 's' : ''}
                    {!p.salarie ? ' · titulaire' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="split">
          <div className="col" style={{ gap: 8 }} role="list" aria-label="Calendrier des gardes">
            {gardes.map((g) => {
              const p = data.personnes.find((x) => x.id === g.personId);
              const [, m, j] = g.date.split('-').map(Number);
              const etape = etapeGarde(data, g, today);
              return (
                <button key={g.id} type="button" role="listitem" className={`g-item${courante?.id === g.id ? ' on' : ''}`} onClick={() => ouvrirGarde(g.id)} style={{ opacity: g.date < today && g.valideLe ? 0.65 : 1 }}>
                  <span className="g-date">
                    <b>{j}</b>
                    <span>{MOIS_COURT[m - 1]}</span>
                  </span>
                  <span className="grow">
                    <b>{GARDE_LABEL[g.type]}</b>
                    <span className="small soft" style={{ display: 'block' }}>
                      {JOURS_COURT[weekday(g.date)]} {fmtHHMM(g.start)} → {fmtHHMM(g.end)} · {p ? nomCourt(p) : 'à affecter'}
                    </span>
                  </span>
                  <Pill tone={etape === 'prevue' ? 'warn' : etape === 'validee' ? 'ok' : etape === 'realisee' ? 'danger' : 'nuit'}>{ETAPES.find((e) => e.cle === etape)?.label}</Pill>
                </button>
              );
            })}

          </div>
          {courante ? <DetailGarde key={courante.id} garde={courante} /> : null}
        </div>
        </>
      )}
      {importer ? <DialogueImport onClose={() => setImporter(false)} /> : null}
      {ajout ? <DialogueGarde onClose={() => setAjout(false)} /> : null}
    </div>
  );
}

function DetailGarde({ garde }: { garde: Garde }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { affecterGarde, majGarde, ajouterIntervention, retirerIntervention, corrigerRepos, validerGarde, supprimerGarde } = useStore();
  const { dire, ouvrirGarde } = useUi();
  const person = data.personnes.find((p) => p.id === garde.personId);
  const etape = etapeGarde(data, garde, today);
  const rang = ETAPES.findIndex((e) => e.cle === etape);
  const calcul = useMemo(() => variablesGarde(data, garde), [data, garde]);
  const repos = useMemo(() => reposApresGarde(data, garde), [data, garde]);
  const delai = delaiGarde(data, garde, person, today);
  const incompatible = congesIncompatibles(data, garde);
  const pharmaciens = data.personnes.filter((p) => estPharmacien(p) && !p.externe);
  const annee = garde.date.slice(0, 4);
  const [heureItv, setHeureItv] = useState(fmtHHMM((garde.start + 180) % 1440));
  const [dureeItv, setDureeItv] = useState(20);
  const duree = gardeDuree(garde);
  const passee = garde.date < today;
  const total = calcul.variables.reduce((t, v) => t + (v.montant ?? 0), 0);

  return (
    <div className="card">
      <div className="card-head">
        <div className="grow">
          <h2>{GARDE_LABEL[garde.type]}</h2>
          <div className="soft small" style={{ marginTop: 3 }}>
            {fmtDateLong(garde.date)}, de {fmtHeure(garde.start)} à {fmtHeure(garde.end)}
            {garde.end <= garde.start ? ' le lendemain' : ''} · {fmtDuree(calcul.dureeReelle)}
          </div>
        </div>
        <button
          type="button"
          className="btn ghost icon"
          aria-label="Supprimer cette garde"
          title="Supprimer cette garde"
          onClick={() => {
            supprimerGarde(garde.id);
            ouvrirGarde(null);
            dire('Garde supprimée.', true);
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="card-body col" style={{ gap: 20 }}>
        <div className="stepper" aria-label={`Étape actuelle : ${ETAPES[rang].label}`}>
          {ETAPES.map((e, i) => (
            <div key={e.cle} className={`step${i < rang || etape === 'validee' ? ' done' : i === rang ? ' now' : ''}`}>
              {e.label}
            </div>
          ))}
        </div>

        <div className="nightline" aria-hidden="true">
          {calcul.segments.map((s, i) => {
            const avant = calcul.segments.slice(0, i).reduce((t, x) => t + x.minutes, 0);
            return (
              <span key={s.date}>
                {i > 0 ? <span className="seg-l" style={{ left: `${(avant / calcul.dureeReelle) * 100}%` }} /> : null}
                <span className="lab" style={{ left: `${(avant / calcul.dureeReelle) * 100}%` }}>
                  {s.libelleJour === 'dimanche' ? 'dimanche' : s.libelleJour === 'jour ouvrable' ? JOURS_COURT[weekday(s.date)] : `${JOURS_COURT[weekday(s.date)]} · ${s.libelleJour}`} · {fmtDuree(s.minutes)}
                </span>
              </span>
            );
          })}
          {garde.interventions.map((it) => (
            <span key={it.id} className="itv" style={{ left: `${(it.offset / duree) * 100}%`, width: `${(it.duree / duree) * 100}%` }} />
          ))}
        </div>
        {calcul.notes.filter((n) => n.includes('Changement')).map((n) => (
          <div key={n} className="notice info">
            <Clock3 size={16} /> {n}
          </div>
        ))}

        {/* 1. Affectation */}
        <section className="col" style={{ gap: 9 }}>
          <h3>1 · Qui assure la garde ?</h3>
          <div className="row wrap">
            {pharmaciens.map((p) => {
              const n = data.gardes.filter((g) => g.personId === p.id && g.date.startsWith(annee)).length;
              const on = garde.personId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`g-item${on ? ' on' : ''}`}
                  style={{ width: 'auto', padding: '8px 12px' }}
                  aria-pressed={on}
                  onClick={() => {
                    affecterGarde(garde.id, on ? null : p.id, !!garde.exceptionnel);
                    dire(on ? 'Affectation retirée.' : `Garde confiée à ${nomCourt(p)}.`, true);
                  }}
                >
                  <Avatar person={p} />
                  <span>
                    <b>{nomCourt(p)}</b>
                    <span className="small soft" style={{ display: 'block' }}>
                      {n} garde{n > 1 ? 's' : ''} en {annee}
                      {p.volontaireGardes ? ' · volontaire' : ''}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {person ? (
            <div className={`notice ${delai.ok ? 'ok' : 'danger'}`}>
              {delai.ok ? <CircleCheck size={16} /> : <AlertTriangle size={16} />}
              <div>
                {delai.message}
                {garde.communiqueLe ? <span className="soft"> Communiquée le {fmtHorodatage(garde.communiqueLe)}.</span> : null}
                {!delai.ok && !garde.exceptionnel ? (
                  <label className="check small" style={{ marginTop: 6 }}>
                    <input type="checkbox" checked={!!garde.exceptionnel} onChange={(e) => majGarde(garde.id, { exceptionnel: e.target.checked })} />
                    Circonstances exceptionnelles (délai ramené à 2 jours ouvrables)
                  </label>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="notice warn">
              <AlertTriangle size={16} />
              <div>
                Garde à affecter. Pour respecter les 15 jours de prévenance, communiquez-la au plus tard le {fmtDateCourt(addDays(garde.date, -15))}
                {dayIndex(addDays(garde.date, -15)) < dayIndex(today) ? ' : ce délai est déjà dépassé' : ''}.
              </div>
            </div>
          )}
          {incompatible ? (
            <div className="notice danger">
              <AlertTriangle size={16} /> {person ? nomCourt(person) : 'Cette personne'} a une absence approuvée ou demandée sur cette période. Choisissez une autre personne ou refusez le congé.
            </div>
          ) : null}
        </section>

        {/* 2. Interventions */}
        {person ? (
          <section className="col" style={{ gap: 9 }}>
            <h3>2 · {garde.type === 'astreinte' ? 'Interventions pendant l’astreinte' : garde.type === 'volets_fermes' ? 'Dérangements (service sur appel)' : 'Déroulement'}</h3>
            {garde.type === 'volets_ouverts' ? (
              <p className="soft small">Volets ouverts : l'officine est librement accessible, toute la durée est du travail effectif. Aucune intervention à déclarer.</p>
            ) : (
              <>
                {garde.interventions.length ? (
                  <div className="row wrap">
                    {garde.interventions.map((it) => (
                      <Pill key={it.id} tone="miel">
                        {fmtHeure(garde.start + it.offset)} · {it.duree} min
                        <button type="button" className="btn ghost" style={{ padding: 0, width: 18, height: 18 }} aria-label="Retirer cette intervention" onClick={() => retirerIntervention(garde.id, it.id)}>
                          <Trash2 size={12} />
                        </button>
                      </Pill>
                    ))}
                  </div>
                ) : (
                  <p className="soft small">{passee ? 'Aucune intervention déclarée.' : 'Les interventions se déclarent après la garde.'}</p>
                )}
                <div className="row wrap" style={{ alignItems: 'flex-end' }}>
                  <label className="field">
                    Heure
                    <input type="time" value={heureItv} onChange={(e) => setHeureItv(e.target.value)} />
                  </label>
                  <label className="field">
                    Durée, trajet compris (min)
                    <input type="number" min={5} max={240} step={5} value={dureeItv} onChange={(e) => setDureeItv(Number(e.target.value))} style={{ width: 150 }} />
                  </label>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const h = parseHHMM(heureItv);
                      if (h === null) return;
                      const offset = (h - garde.start + 1440) % 1440;
                      if (offset >= duree) {
                        dire('Cette heure est en dehors de la garde.');
                        return;
                      }
                      ajouterIntervention(garde.id, offset, Math.max(5, dureeItv));
                      dire('Intervention déclarée.', true);
                    }}
                  >
                    <Plus size={15} /> Déclarer
                  </button>
                </div>
              </>
            )}
          </section>
        ) : null}

        {/* 3. Repos */}
        {person ? (
          <section className="col" style={{ gap: 9 }}>
            <h3>3 · Conséquences sur le repos</h3>
            {!person.salarie ? (
              <p className="soft small">Garde assurée par le titulaire : les règles de repos des salariés ne s'appliquent pas. Pensez tout de même à votre propre récupération.</p>
            ) : repos ? (
              <>
                <div className={`notice ${repos.conflits.length ? 'danger' : 'ok'}`}>
                  {repos.conflits.length ? <AlertTriangle size={16} /> : <CircleCheck size={16} />}
                  <div>
                    {repos.texte}
                    {repos.conflits.length ? ` ${repos.conflits.length} poste${repos.conflits.length > 1 ? 's empiètent' : ' empiète'} sur ce repos.` : ' Aucun poste planifié n’empiète sur ce repos.'}
                  </div>
                </div>
                {repos.conflits.map((c) => (
                  <div key={c.shift.id} className="row wrap small">
                    <Pill tone="danger">
                      {JOURS[weekday(c.shift.date)]} · {decrireShift(c.shift)}
                    </Pill>
                    <span className="soft">{c.position === 'pendant' ? 'chevauche la garde' : `${fmtDuree(c.manque)} de repos manquantes ${c.position === 'avant' ? 'avant' : 'après'} la garde`}</span>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => {
                        corrigerRepos(garde.id, c.shift.id);
                        dire('Poste corrigé. La couverture de ce jour est à revérifier dans « Construire ».', true);
                      }}
                    >
                      Corriger le poste
                    </button>
                  </div>
                ))}
                {calcul.reposCompensateur ? (
                  <div className="notice info">
                    <Info size={16} /> Repos compensateur de {fmtDuree(calcul.reposCompensateur)} à positionner (garde un dimanche ou un jour férié).
                  </div>
                ) : null}
              </>
            ) : null}
          </section>
        ) : null}

        {/* 4. Variables */}
        {person ? (
          <section className="col" style={{ gap: 9 }}>
            <h3>4 · Variables pour le comptable</h3>
            {calcul.variables.length ? (
              <table className="t">
                <thead>
                  <tr>
                    <th>Variable</th>
                    <th>Mois</th>
                    <th style={{ textAlign: 'right' }}>Quantité</th>
                    <th style={{ textAlign: 'right' }}>Montant estimé</th>
                  </tr>
                </thead>
                <tbody>
                  {calcul.variables.map((v) => (
                    <tr key={v.code + v.mois}>
                      <td>
                        {v.label}
                        <div className="tiny muted">{data.regles.find((r) => r.id === v.regle)?.source}</div>
                      </td>
                      <td className="num">{MOIS[Number(v.mois.slice(5)) - 1]}</td>
                      <td className="num" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <b>{fmtDecimal(v.quantite)}</b> {v.unite}
                      </td>
                      <td className="num" style={{ textAlign: 'right' }}>{v.montant !== null ? fmtEuros(v.montant) : <span className="muted">à valoriser</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {calcul.notes.filter((n) => !n.includes('Changement')).map((n) => (
              <div key={n} className="small soft">
                · {n}
              </div>
            ))}
            {calcul.variables.length ? (
              <div className="row wrap">
                <span className="small soft grow">
                  {total > 0 ? `Total valorisable à ce stade : ${fmtEuros(total)} (taux horaire indicatif). ` : ''}
                  Quantités calculées d'après l'accord du 23 mars 2000 ; à faire relire par votre cabinet comptable.
                </span>
                {garde.valideLe ? (
                  <Pill tone="ok">
                    <CircleCheck size={13} /> Validée le {fmtHorodatage(garde.valideLe)}
                  </Pill>
                ) : (
                  <button
                    type="button"
                    className="btn primary"
                    disabled={!passee}
                    title={passee ? undefined : 'La validation se fait après la garde'}
                    onClick={() => {
                      validerGarde(garde.id);
                      dire('Variables validées : elles figurent dans la fiche navette.');
                    }}
                  >
                    Valider pour le comptable
                  </button>
                )}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function DialogueImport({ onClose }: { onClose: () => void }): JSX.Element {
  const ajouter = useStore((s) => s.ajouterGardes);
  const dire = useUi((s) => s.dire);
  const [texte, setTexte] = useState('');
  const [type, setType] = useState<GardeType>('volets_fermes');
  const lu = useMemo(() => parseCalendrierGardes(texte), [texte]);
  return (
    <Dialog
      size="mid"
      title="Importer le calendrier de garde"
      subtitle="Collez les lignes reçues du syndicat ou de l'ARS, une garde par ligne : date ; début ; fin ; type."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!lu.gardes.length}
            onClick={() => {
              ajouter(lu.gardes.map((g) => (/(ouvert|ferm|astreinte)/i.test(texte) ? g : { ...g, type })));
              dire(`${lu.gardes.length} garde${lu.gardes.length > 1 ? 's' : ''} ajoutée${lu.gardes.length > 1 ? 's' : ''}. Reste à les affecter.`, true);
              onClose();
            }}
          >
            Ajouter {lu.gardes.length || ''} garde{lu.gardes.length > 1 ? 's' : ''}
          </button>
        </>
      }
    >
      <label className="field">
        Lignes à importer
        <textarea
          rows={6}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder={'14/02/2027;19:30;08:30;volets fermés\n07/03/2027;09:00;19:00;volets ouverts'}
          data-autofocus
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
        />
      </label>
      <label className="field" style={{ maxWidth: 280 }}>
        Type si la ligne ne le précise pas
        <select value={type} onChange={(e) => setType(e.target.value as GardeType)}>
          {(Object.keys(GARDE_LABEL) as GardeType[]).map((t) => (
            <option key={t} value={t}>
              {GARDE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      {lu.gardes.length ? (
        <div className="notice ok">
          <CircleCheck size={16} />
          <div>
            {lu.gardes.length} garde{lu.gardes.length > 1 ? 's' : ''} reconnue{lu.gardes.length > 1 ? 's' : ''} :{' '}
            {lu.gardes
              .slice(0, 4)
              .map((g) => `${fmtDateCourt(g.date)} ${fmtHHMM(g.start)}→${fmtHHMM(g.end)}`)
              .join(' · ')}
            {lu.gardes.length > 4 ? ' …' : ''}
          </div>
        </div>
      ) : null}
      {lu.erreurs.map((e) => (
        <div key={e} className="notice warn">
          <AlertTriangle size={16} /> {e}
        </div>
      ))}
    </Dialog>
  );
}

function DialogueGarde({ onClose }: { onClose: () => void }): JSX.Element {
  const ajouter = useStore((s) => s.ajouterGardes);
  const today = useStore((s) => s.today);
  const dire = useUi((s) => s.dire);
  const [date, setDate] = useState(addDays(today, 21));
  const [debut, setDebut] = useState('19:30');
  const [fin, setFin] = useState('08:30');
  const [type, setType] = useState<GardeType>('volets_fermes');
  const d = parseHHMM(debut);
  const f = parseHHMM(fin);
  const pret = !!date && d !== null && f !== null && d !== f;
  return (
    <Dialog
      title="Ajouter une garde"
      subtitle="Le calendrier de garde est fixé hors de l’officine : saisissez ici l’obligation, vous l’affecterez ensuite."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!pret}
            onClick={() => {
              ajouter([{ date, start: d as number, end: f as number, type, personId: null, interventions: [] }]);
              dire('Garde ajoutée. Reste à l’affecter.', true);
              onClose();
            }}
          >
            <Plus size={15} /> Ajouter
          </button>
        </>
      }
    >
      <label className="field">
        Type
        <select id="garde-type" value={type} onChange={(e) => setType(e.target.value as GardeType)} data-autofocus>
          {(Object.keys(GARDE_LABEL) as GardeType[]).map((t) => (
            <option key={t} value={t}>
              {GARDE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <div className="row wrap" style={{ alignItems: 'flex-end' }}>
        <label className="field">
          Date de début
          <input id="garde-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          Début
          <input id="garde-debut" type="time" value={debut} onChange={(e) => setDebut(e.target.value)} />
        </label>
        <label className="field">
          Fin
          <input id="garde-fin" type="time" value={fin} onChange={(e) => setFin(e.target.value)} />
        </label>
      </div>
      {d !== null && f !== null && f <= d ? <div className="notice info small">La garde se termine le lendemain à {fmtHeure(f)}.</div> : null}
      {dayIndex(date) - dayIndex(today) < 15 ? (
        <div className="notice warn small">Cette garde commence dans moins de 15 jours : si elle est confiée à un salarié, son accord sera à recueillir.</div>
      ) : null}
    </Dialog>
  );
}
