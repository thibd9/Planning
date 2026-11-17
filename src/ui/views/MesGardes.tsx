import { AlertTriangle, CircleCheck, MoonStar, Plus, Printer, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MOIS, dayIndex, fmtDateLong, fmtDecimal, fmtDuree, fmtHHMM, fmtHeure, parseHHMM } from '../../domain/time';
import type { Garde } from '../../domain/types';
import { GARDE_LABEL } from '../../domain/types';
import { HEBERGE } from '../../env';
import { gardeDuree } from '../../engine/core';
import { delaiGarde, reposApresGarde, variablesGarde } from '../../engine/gardes';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { GARDE_ICONE } from '../icons';
import { Empty, Pill } from '../kit';

/** Mes gardes : celles qui me sont confiées, mes interventions à déclarer, mon récapitulatif mensuel. */
export function MesGardes({ personId }: { personId: string }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const person = data.personnes.find((p) => p.id === personId);
  const [mois, setMois] = useState(today.slice(0, 7));
  const gardes = useMemo(() => data.gardes.filter((g) => g.personId === personId).sort((a, b) => a.date.localeCompare(b.date)), [data.gardes, personId]);
  const aVenir = gardes.filter((g) => g.date >= today);
  const passees = gardes.filter((g) => g.date < today).reverse();
  const duMois = gardes.filter((g) => g.date.startsWith(mois));
  const lignes = duMois.flatMap((g) => variablesGarde(data, g).variables.filter((v) => v.mois === mois).map((v) => ({ g, v })));

  return (
    <div style={{ maxWidth: 1000 }}>
      <div className="page-head">
        <span className="page-ico c-lavande" aria-hidden="true">
          <MoonStar size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Mes gardes</div>
          <h1>
            Mes gardes et <span className="hl">astreintes</span>
          </h1>
          <p>Les gardes qui vous sont confiées, le repos qui les suit, vos interventions à déclarer et le récapitulatif du mois.</p>
        </div>
      </div>

      {!gardes.length ? (
        <Empty icon={<MoonStar size={30} />} title="Aucune garde ne vous est confiée">
          Les gardes que le responsable vous attribue apparaîtront ici, avec leur date de communication.
        </Empty>
      ) : (
        <div className="col" style={{ gap: 22 }}>
          {aVenir.length ? (
            <section className="col" style={{ gap: 10 }} aria-labelledby="g-avenir">
              <h2 id="g-avenir">À venir</h2>
              {aVenir.map((g) => (
                <CarteGarde key={g.id} garde={g} />
              ))}
            </section>
          ) : null}
          {passees.length ? (
            <section className="col" style={{ gap: 10 }} aria-labelledby="g-passees">
              <h2 id="g-passees">Passées</h2>
              {passees.slice(0, 6).map((g) => (
                <CarteGarde key={g.id} garde={g} />
              ))}
            </section>
          ) : null}

          <section className="card" aria-labelledby="g-recap">
            <div className="card-head">
              <div className="grow">
                <h2 id="g-recap" className="h3">Récapitulatif mensuel</h2>
                <div className="small soft">
                  {MOIS[Number(mois.slice(5)) - 1]} {mois.slice(0, 4)} · {duMois.length} garde{duMois.length > 1 ? 's' : ''}
                  {person && !person.salarie ? ' · titulaire, hors paie' : ''}
                </div>
              </div>
              <label className="row small no-print" htmlFor="recap-mois">
                <span className="soft">Mois</span>
                <input id="recap-mois" type="month" className="input" value={mois} onChange={(e) => setMois(e.target.value)} />
              </label>
              {!HEBERGE ? (
                <button type="button" className="btn sm no-print" onClick={() => window.print()}>
                  <Printer size={15} aria-hidden="true" /> Imprimer
                </button>
              ) : null}
            </div>
            {lignes.length ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="t" aria-label="Récapitulatif mensuel de mes gardes">
                  <thead>
                    <tr>
                      <th scope="col">Garde</th>
                      <th scope="col">Élément</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Quantité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map(({ g, v }) => (
                      <tr key={g.id + v.code}>
                        <td>{fmtDateLong(g.date).replace(/ \d{4}$/, '')}</td>
                        <td>{v.label}</td>
                        <td className="num" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <b>{fmtDecimal(v.quantite)}</b> {v.unite}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="card-body soft small">Aucun élément de paie ce mois-ci.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function CarteGarde({ garde }: { garde: Garde }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { ajouterIntervention, retirerIntervention } = useStore();
  const dire = useUi((s) => s.dire);
  const person = data.personnes.find((p) => p.id === garde.personId);
  const Icone = GARDE_ICONE[garde.type];
  const delai = delaiGarde(data, garde, person, today);
  const repos = reposApresGarde(data, garde);
  const duree = gardeDuree(garde);
  const [heure, setHeure] = useState(fmtHHMM((garde.start + 180) % 1440));
  const [min, setMin] = useState(20);
  const declarable = garde.type !== 'volets_ouverts' && dayIndex(garde.date) <= dayIndex(today) && !garde.valideLe;
  const id = `itv-${garde.id}`;
  return (
    <article className="card">
      <div className="card-head">
        <span className="ico night" aria-hidden="true">
          <Icone size={18} />
        </span>
        <div className="grow">
          <h3>{GARDE_LABEL[garde.type]}</h3>
          <div className="small soft">
            {fmtDateLong(garde.date)}, de {fmtHeure(garde.start)} à {fmtHeure(garde.end)}
            {garde.end <= garde.start ? ' le lendemain' : ''} · {fmtDuree(duree)}
          </div>
        </div>
        {garde.valideLe ? <Pill tone="ok">Validée pour la paie</Pill> : garde.date < today ? <Pill tone="warn">À valider par le responsable</Pill> : <Pill tone="nuit">À venir</Pill>}
      </div>
      <div className="card-body col">
        <div className={`notice ${delai.ok ? 'ok' : 'warn'} small`}>
          {delai.ok ? <CircleCheck size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />}
          <span>{delai.message}</span>
        </div>
        {repos ? <p className="small">{repos.texte}</p> : null}
        {garde.type !== 'volets_ouverts' ? (
          <div className="col" style={{ gap: 8 }}>
            <b className="small">{garde.type === 'astreinte' ? 'Interventions' : 'Dérangements'}</b>
            {garde.interventions.length ? (
              <ul className="chips">
                {garde.interventions.map((it) => (
                  <li key={it.id} className="pill miel">
                    {fmtHeure(garde.start + it.offset)} · {it.duree} min
                    {declarable ? (
                      <button type="button" className="btn ghost" style={{ padding: 0, width: 22, height: 22, minHeight: 0 }} aria-label={`Retirer l'intervention de ${fmtHeure(garde.start + it.offset)}`} onClick={() => retirerIntervention(garde.id, it.id)}>
                        <Trash2 size={12} />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small soft">{declarable ? 'Aucune intervention déclarée.' : 'Les interventions se déclarent après la garde.'}</p>
            )}
            {declarable ? (
              <div className="row wrap" style={{ alignItems: 'flex-end' }}>
                <label className="field" htmlFor={`${id}-h`}>
                  Heure
                  <input id={`${id}-h`} type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
                </label>
                <label className="field" htmlFor={`${id}-d`}>
                  Durée, trajet compris (min)
                  <input id={`${id}-d`} type="number" min={5} max={240} step={5} value={min} onChange={(e) => setMin(Number(e.target.value))} style={{ width: 160 }} />
                </label>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const h = parseHHMM(heure);
                    if (h === null) return;
                    const offset = (h - garde.start + 1440) % 1440;
                    if (offset >= duree) return dire('Cette heure est en dehors de la garde.');
                    ajouterIntervention(garde.id, offset, Math.max(5, min));
                    dire('Intervention déclarée.', true);
                  }}
                >
                  <Plus size={15} aria-hidden="true" /> Déclarer
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
