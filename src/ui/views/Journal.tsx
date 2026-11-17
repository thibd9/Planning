import { BookOpenCheck, CalendarCheck, Copy, Download, FileSpreadsheet, HeartHandshake, MoonStar, Pencil, ScrollText, Sparkles, UserMinus, Wrench } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { JOURS, MOIS, fmtDecimal, fmtHorodatage, weekday } from '../../domain/time';
import type { JournalType } from '../../domain/types';
import { QUALIFICATION_COURT, nomComplet, nomCourt } from '../../domain/types';
import { ficheNavette, ficheNavetteCSV } from '../../engine/payroll';
import { useStore } from '../../store/store';
import { HEBERGE } from '../../env';
import { AvantApres, Dialog, Pill, Seg } from '../kit';

const ICONES: Record<JournalType, JSX.Element> = {
  publication: <CalendarCheck size={16} />,
  modification: <Pencil size={16} />,
  absence: <UserMinus size={16} />,
  besoin: <HeartHandshake size={16} />,
  garde: <MoonStar size={16} />,
  reparation: <Wrench size={16} />,
  generation: <Sparkles size={16} />,
  regle: <BookOpenCheck size={16} />,
};

function telecharger(nom: string, contenu: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}

export function Journal(): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const [onglet, setOnglet] = useState<'journal' | 'paie'>('journal');
  const [mois, setMois] = useState(today.slice(0, 7));
  const [apercu, setApercu] = useState<{ nom: string; contenu: string } | null>(null);
  const [copie, setCopie] = useState(false);
  const zone = useRef<HTMLTextAreaElement>(null);
  /** Télécharge le fichier, ou l'affiche à copier quand la page hébergée bloque les téléchargements. */
  const exporter = (nomFichier: string, contenu: string, type: string): void => {
    if (!HEBERGE) return telecharger(nomFichier, contenu, type);
    setCopie(false);
    setApercu({ nom: nomFichier, contenu: contenu.replace(/^\uFEFF/, '') });
  };
  const lignes = useMemo(() => ficheNavette(data, mois), [data, mois]);
  const nom = (id: string): string => {
    const p = data.personnes.find((x) => x.id === id);
    return p ? nomCourt(p) : '—';
  };
  const lus = data.notifications.filter((n) => n.luLe).length;

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="page-head">
        <span className="page-ico">
          <ScrollText size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Journal et paie</div>
          <h1>{onglet === 'journal' ? 'Dossier de preuve' : 'Fiche navette'}</h1>
          <p>
            {onglet === 'journal'
              ? 'Publications horodatées, délais de prévenance, accords recueillis, versions des règles appliquées : tout ce qu’il faut montrer en cas de contrôle ou de litige.'
              : 'Heures prévues et variables de garde du mois, prêtes à transmettre au cabinet comptable. Ce n’est pas un calcul de paie.'}
          </p>
        </div>
        <Seg label="Vue" value={onglet} onChange={setOnglet} options={[{ value: 'journal', label: 'Journal' }, { value: 'paie', label: 'Fiche navette' }]} />
      </div>

      {onglet === 'journal' ? (
        <>
          <div className="row wrap" style={{ marginBottom: 12 }}>
            <Pill>{data.journal.length} événement{data.journal.length > 1 ? 's' : ''}</Pill>
            <Pill>
              {lus} accusé{lus > 1 ? 's' : ''} de lecture sur {data.notifications.length} changement{data.notifications.length > 1 ? 's' : ''} notifié{data.notifications.length > 1 ? 's' : ''}
            </Pill>
            <button
              type="button"
              className="btn right"
              onClick={() =>
                exporter(
                  `dossier-de-preuve-${today}.json`,
                  JSON.stringify({ officine: data.officine.nom, exporteLe: new Date().toISOString(), regles: data.regles, journal: data.journal, accusesDeLecture: data.notifications }, null, 2),
                  'application/json',
                )
              }
            >
              <Download size={15} /> Exporter le dossier
            </button>
          </div>
          <div className="card timeline">
            {data.journal.map((e) => (
              <div key={e.id} className="tl">
                <span className="ico">{ICONES[e.type]}</span>
                <div>
                  <div className="row wrap" style={{ gap: 8 }}>
                    <b>{e.titre}</b>
                    <span className="small muted">{fmtHorodatage(e.at)}</span>
                  </div>
                  {e.detail ? <div className="soft small" style={{ marginTop: 2 }}>{e.detail}</div> : null}
                  {e.changements?.length ? (
                    <div className="col small" style={{ gap: 3, marginTop: 6 }}>
                      {e.changements.map((c, i) => (
                        <div key={i} className="row" style={{ gap: 10 }}>
                          <b style={{ minWidth: 140 }}>
                            {nom(c.personId)} · {JOURS[weekday(c.date)]}
                          </b>
                          <AvantApres avant={c.avant} apres={c.apres} />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {e.accords?.length ? (
                    <div className="small" style={{ marginTop: 6 }}>
                      <b>Accords recueillis :</b> {e.accords.join(' ')}
                    </div>
                  ) : null}
                  {e.regles?.length ? (
                    <details className="tiny muted" style={{ marginTop: 5 }}>
                      <summary style={{ cursor: 'pointer' }}>{e.regles.length} règles en vigueur à cet instant</summary>
                      {e.regles.join(' · ')}
                    </details>
                  ) : null}
                </div>
              </div>
            ))}
            {!data.journal.length ? <div className="empty">Aucun événement pour l'instant.</div> : null}
          </div>
        </>
      ) : (
        <>
          <div className="row wrap" style={{ marginBottom: 12 }}>
            <label className="row small">
              <span className="soft">Mois</span>
              <input type="month" className="input" value={mois} onChange={(e) => setMois(e.target.value)} />
            </label>
            <Pill tone="warn">Heures prévues, non pointées</Pill>
            <button type="button" className="btn primary right" onClick={() => exporter(`fiche-navette-${mois}.csv`, ficheNavetteCSV(data, mois), 'text/csv;charset=utf-8')}>
              <FileSpreadsheet size={15} /> Exporter pour le comptable
            </button>
          </div>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="t" aria-label="Fiche navette du mois" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th scope="col">Salarié · {MOIS[Number(mois.slice(5)) - 1]} {mois.slice(0, 4)}</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Heures prévues</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Compl.</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Supp. 25 %</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Supp. 50 %</th>
                  <th scope="col">Absences</th>
                  <th scope="col">Variables de garde</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.person.id}>
                    <td>
                      <b>{nomComplet(l.person)}</b>
                      <div className="small soft">
                        {QUALIFICATION_COURT[l.person.qualification]} · {l.person.heuresHebdo} h
                      </div>
                    </td>
                    <td className="num" style={{ textAlign: 'right' }}>{fmtDecimal(l.heuresMois)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{l.complementaires ? fmtDecimal(l.complementaires) : '—'}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{l.supp25 ? fmtDecimal(l.supp25) : '—'}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{l.supp50 ? fmtDecimal(l.supp50) : '—'}</td>
                    <td className="small">{Object.entries(l.joursAbsence).map(([k, v]) => `${k} : ${v} j`).join(', ') || '—'}</td>
                    <td className="small">
                      {l.variablesGarde.length
                        ? l.variablesGarde.map((v) => (
                            <div key={v.code}>
                              <b className="num">{fmtDecimal(v.quantite)}</b> {v.unite} · {v.label}
                            </div>
                          ))
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted" style={{ marginTop: 10 }}>
            Le titulaire et les remplaçants facturés ne figurent pas dans la fiche. Les semaines à cheval sur deux mois sont décomptées sur le mois de leur lundi pour les heures supplémentaires : convention à confirmer avec votre cabinet.
          </p>
        </>
      )}
      {apercu ? (
        <Dialog
          size="mid"
          title={apercu.nom}
          subtitle="Cette page hébergée ne peut pas enregistrer de fichier sur votre appareil : copiez le contenu, puis collez-le dans un fichier ou un tableur."
          onClose={() => setApercu(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setApercu(null)}>
                Fermer
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  const selectionner = (): void => {
                    zone.current?.focus();
                    zone.current?.select();
                  };
                  if (!navigator.clipboard) return selectionner();
                  navigator.clipboard.writeText(apercu.contenu).then(() => setCopie(true), selectionner);
                }}
              >
                <Copy size={15} /> {copie ? 'Copié' : 'Copier le contenu'}
              </button>
            </>
          }
        >
          <label className="field">
            Contenu du fichier
            <textarea id="export-contenu" ref={zone} readOnly value={apercu.contenu} rows={14} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5, whiteSpace: 'pre' }} />
          </label>
        </Dialog>
      ) : null}
    </div>
  );
}
