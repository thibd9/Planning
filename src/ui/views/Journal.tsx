import type { LucideIcon } from 'lucide-react';
import { BookOpenCheck, CalendarCheck, CalendarOff, ChevronLeft, ChevronRight, Clock, Copy, Download, Eye, FileSpreadsheet, HeartHandshake, Info, MoonStar, Pencil, ScrollText, Sparkles, TrendingUp, UserMinus, Users, Wrench } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { JOURS, MOIS, addDays, fmtDateLong, fmtDecimal, fmtHeure, weekday } from '../../domain/time';
import type { JournalEntry, JournalType } from '../../domain/types';
import { QUALIFICATION_COURT, nomComplet, nomCourt } from '../../domain/types';
import { ficheNavette, ficheNavetteCSV } from '../../engine/payroll';
import { moisDecale } from '../../engine/souhaits';
import { useStore } from '../../store/store';
import { HEBERGE } from '../../env';
import { AvantApres, Avatar, Dialog, Seg } from '../kit';

/** Chaque nature d'événement a son icône, son nom et sa couleur : on trie le journal d'un regard. */
const NATURES: Record<JournalType, { icone: LucideIcon; nom: string; pluriel: string; ton: string }> = {
  publication: { icone: CalendarCheck, nom: 'Publication', pluriel: 'Publications', ton: 'ok' },
  modification: { icone: Pencil, nom: 'Modification', pluriel: 'Modifications', ton: 'info' },
  absence: { icone: UserMinus, nom: 'Absence', pluriel: 'Absences', ton: 'warn' },
  besoin: { icone: HeartHandshake, nom: 'Besoin', pluriel: 'Besoins', ton: 'rose' },
  garde: { icone: MoonStar, nom: 'Garde', pluriel: 'Gardes', ton: 'nuit' },
  reparation: { icone: Wrench, nom: 'Correction', pluriel: 'Corrections', ton: 'info' },
  generation: { icone: Sparkles, nom: 'Proposition', pluriel: 'Propositions', ton: 'accent' },
  regle: { icone: BookOpenCheck, nom: 'Règle', pluriel: 'Règles', ton: 'neutre' },
};
const TON_ABSENCE: Record<string, string> = { Congé: 'conge', Arrêt: 'arret', Formation: 'formation' };

function telecharger(nom: string, contenu: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}

const jourLocal = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const heureLocale = (iso: string): string => {
  const d = new Date(iso);
  return fmtHeure(d.getHours() * 60 + d.getMinutes());
};
const heures = (n: number): string => `${fmtDecimal(n).replace(/,00$/, '').replace(/(,\d)0$/, '$1')} h`;
const majuscule = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

export function Journal(): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const [onglet, setOnglet] = useState<'journal' | 'paie'>('journal');
  const [mois, setMois] = useState(today.slice(0, 7));
  const [filtre, setFiltre] = useState<JournalType | 'tout'>('tout');
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

  // Le journal, rangé par jour, du plus récent au plus ancien.
  const natures = (Object.keys(NATURES) as JournalType[]).filter((t) => data.journal.some((e) => e.type === t));
  const jours = useMemo(() => {
    const m = new Map<string, JournalEntry[]>();
    for (const e of data.journal) {
      if (filtre !== 'tout' && e.type !== filtre) continue;
      const j = jourLocal(e.at);
      m.set(j, (m.get(j) ?? []).concat(e));
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [data.journal, filtre]);
  const titreJour = (j: string): string => (j === today ? 'Aujourd’hui' : j === addDays(today, -1) ? 'Hier' : majuscule(fmtDateLong(j)));

  // La fiche navette : les totaux du mois, puis une ligne par salarié.
  const total = lignes.reduce(
    (t, l) => ({
      prevues: t.prevues + l.heuresMois,
      supp: t.supp + l.supp25 + l.supp50,
      compl: t.compl + l.complementaires,
      absences: t.absences + Object.values(l.joursAbsence).reduce((a, b) => a + b, 0),
    }),
    { prevues: 0, supp: 0, compl: 0, absences: 0 },
  );
  const titreMois = `${majuscule(MOIS[Number(mois.slice(5)) - 1])} ${mois.slice(0, 4)}`;

  return (
    <div className="page page-journal">
      <div className="page-head">
        <span className="page-ico" aria-hidden="true">
          <ScrollText size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Journal et paie</div>
          <h1>{onglet === 'journal' ? 'Dossier de preuve' : 'Fiche navette'}</h1>
          <p>{onglet === 'journal' ? 'Tout ce qui a été publié, modifié ou décidé, avec la date et l’heure.' : 'Les heures prévues du mois, à transmettre au cabinet comptable.'}</p>
        </div>
        <Seg label="Vue" value={onglet} onChange={setOnglet} options={[{ value: 'journal', label: 'Journal' }, { value: 'paie', label: 'Fiche navette' }]} />
      </div>

      {onglet === 'journal' ? (
        <>
          <div className="chiffres">
            <div className="chiffre">
              <span className="chiffre-pic" aria-hidden="true"><ScrollText size={18} /></span>
              <b className="num">{data.journal.length}</b>
              <span>événement{data.journal.length > 1 ? 's' : ''} enregistré{data.journal.length > 1 ? 's' : ''}</span>
            </div>
            <div className="chiffre">
              <span className="chiffre-pic ok" aria-hidden="true"><CalendarCheck size={18} /></span>
              <b className="num">{data.journal.filter((e) => e.type === 'publication').length}</b>
              <span>planning{data.journal.filter((e) => e.type === 'publication').length > 1 ? 's' : ''} publié{data.journal.filter((e) => e.type === 'publication').length > 1 ? 's' : ''}</span>
            </div>
            <div className="chiffre">
              <span className="chiffre-pic info" aria-hidden="true"><Eye size={18} /></span>
              <b className="num">
                {lus}/{data.notifications.length}
              </b>
              <span>changement{data.notifications.length > 1 ? 's' : ''} lu{lus > 1 ? 's' : ''} par l’équipe</span>
            </div>
          </div>
          <div className="jr-barre">
            <div className="jr-filtres" role="group" aria-label="Filtrer le journal">
              <button type="button" className={`jr-filtre${filtre === 'tout' ? ' on' : ''}`} aria-pressed={filtre === 'tout'} onClick={() => setFiltre('tout')}>
                Tout
              </button>
              {natures.map((t) => {
                const N = NATURES[t];
                return (
                  <button key={t} type="button" className={`jr-filtre${filtre === t ? ' on' : ''}`} aria-pressed={filtre === t} onClick={() => setFiltre(t)}>
                    <N.icone size={15} aria-hidden="true" /> {N.pluriel}
                  </button>
                );
              })}
            </div>
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
          {jours.map(([jour, entrees]) => (
            <section key={jour} className="jr-jour">
              <h2 className="jr-date">
                {titreJour(jour)}
                {jour === today || jour === addDays(today, -1) ? <span>{fmtDateLong(jour)}</span> : null}
              </h2>
              <div className="card jr-liste">
                {entrees.map((e) => {
                  const N = NATURES[e.type];
                  return (
                    <article key={e.id} className={`jr t-${N.ton}`}>
                      <span className="jr-heure num">{heureLocale(e.at)}</span>
                      <span className="jr-pic" aria-hidden="true">
                        <N.icone size={17} />
                      </span>
                      <div className="jr-corps">
                        <span className="jr-nature">{N.nom}</span>
                        <h3>{e.titre}</h3>
                        {e.detail ? <p>{e.detail}</p> : null}
                        {e.changements?.length ? (
                          <ul className="jr-changements">
                            {e.changements.map((c, i) => (
                              <li key={i}>
                                <b>{nom(c.personId)}</b>
                                <span className="soft">{JOURS[weekday(c.date)]}</span>
                                <AvantApres avant={c.avant} apres={c.apres} />
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {e.accords?.length ? (
                          <p className="jr-accords">
                            <b>Accords recueillis :</b> {e.accords.join(' ')}
                          </p>
                        ) : null}
                        {e.regles?.length ? (
                          <details className="jr-regles">
                            <summary>
                              <BookOpenCheck size={14} aria-hidden="true" /> {e.regles.length} règles appliquées
                            </summary>
                            <p>{e.regles.join(' · ')}</p>
                          </details>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
          {!jours.length ? <div className="card empty">Aucun événement pour l’instant.</div> : null}
        </>
      ) : (
        <>
          <div className="nv-barre">
            <div className="week-nav">
              <button type="button" className="btn ghost icon" onClick={() => setMois(moisDecale(mois, -1))} aria-label="Mois précédent">
                <ChevronLeft size={18} />
              </button>
              <button type="button" className="btn ghost icon" onClick={() => setMois(moisDecale(mois, 1))} aria-label="Mois suivant">
                <ChevronRight size={18} />
              </button>
              <div className="label" aria-live="polite">
                {titreMois}
              </div>
            </div>
            <button type="button" className="btn primary right" onClick={() => exporter(`fiche-navette-${mois}.csv`, ficheNavetteCSV(data, mois), 'text/csv;charset=utf-8')}>
              <FileSpreadsheet size={15} /> Exporter pour le comptable
            </button>
          </div>
          <div className="chiffres">
            <div className="chiffre">
              <span className="chiffre-pic" aria-hidden="true"><Users size={18} /></span>
              <b className="num">{lignes.length}</b>
              <span>salarié{lignes.length > 1 ? 's' : ''}</span>
            </div>
            <div className="chiffre">
              <span className="chiffre-pic info" aria-hidden="true"><Clock size={18} /></span>
              <b className="num">{heures(total.prevues)}</b>
              <span>prévues au planning</span>
            </div>
            <div className="chiffre">
              <span className={`chiffre-pic${total.supp + total.compl ? ' warn' : ''}`} aria-hidden="true"><TrendingUp size={18} /></span>
              <b className="num">{heures(total.supp + total.compl)}</b>
              <span>en plus des contrats</span>
            </div>
            <div className="chiffre">
              <span className="chiffre-pic ok" aria-hidden="true"><CalendarOff size={18} /></span>
              <b className="num">{total.absences} j</b>
              <span>d’absence</span>
            </div>
          </div>
          <div className="notice nv-avis">
            <Info size={17} aria-hidden="true" />
            <span>
              <b>Heures prévues, pas pointées.</b> À rapprocher des heures réellement faites avant la paie.
            </span>
          </div>
          <div className="card nv-carte" tabIndex={0} role="region" aria-label="Fiche navette, tableau à faire défiler">
            <table className="t nv" aria-label={`Fiche navette de ${titreMois}`}>
              <thead>
                <tr>
                  <th scope="col">Salarié</th>
                  <th scope="col" className="droite">Prévues</th>
                  <th scope="col" className="droite">En plus</th>
                  <th scope="col">Absences</th>
                  <th scope="col">Gardes</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.person.id}>
                    <th scope="row">
                      <span className="nv-qui">
                        <Avatar person={l.person} />
                        <span>
                          <b>{nomComplet(l.person)}</b>
                          <span className="small soft">
                            {QUALIFICATION_COURT[l.person.qualification]} · {l.person.heuresHebdo} h par semaine
                          </span>
                        </span>
                      </span>
                    </th>
                    <td className="droite">
                      <b className="nv-heures num">{heures(l.heuresMois)}</b>
                    </td>
                    <td className="droite">
                      <span className="nv-plus">
                        {l.complementaires ? <span className="nv-puce compl">{heures(l.complementaires)} compl.</span> : null}
                        {l.supp25 ? <span className="nv-puce s25">{heures(l.supp25)} à 25 %</span> : null}
                        {l.supp50 ? <span className="nv-puce s50">{heures(l.supp50)} à 50 %</span> : null}
                        {!l.complementaires && !l.supp25 && !l.supp50 ? <span className="nv-rien" role="img" aria-label="Aucune" /> : null}
                      </span>
                    </td>
                    <td>
                      <span className="nv-plus gauche">
                        {Object.entries(l.joursAbsence).map(([k, v]) => (
                          <span key={k} className={`nv-puce ${TON_ABSENCE[k] ?? 'autre'}`}>
                            {k} · {v} j
                          </span>
                        ))}
                        {!Object.keys(l.joursAbsence).length ? <span className="nv-rien" role="img" aria-label="Aucune" /> : null}
                      </span>
                    </td>
                    <td>
                      {l.variablesGarde.length ? (
                        <ul className="nv-gardes">
                          {l.variablesGarde.map((v) => {
                            const [titre, precision] = v.label.split(/ \((.*)\)$/);
                            return (
                              <li key={v.code}>
                                <b className="num">
                                  {fmtDecimal(v.quantite).replace(/,00$/, '')} {v.unite}
                                </b>
                                <span>
                                  {titre}
                                  {precision ? <span className="small soft"> · {precision}</span> : null}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <span className="nv-rien" role="img" aria-label="Aucune" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {lignes.length ? (
                <tfoot>
                  <tr>
                    <th scope="row">Total du mois</th>
                    <td className="droite">
                      <b className="nv-heures num">{heures(total.prevues)}</b>
                    </td>
                    <td className="droite">
                      <b className="num">{heures(total.supp + total.compl)}</b>
                    </td>
                    <td>
                      <b className="num">{total.absences} j</b>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              ) : null}
            </table>
            {!lignes.length ? <div className="empty">Aucun salarié dans l’équipe pour l’instant.</div> : null}
          </div>
          <p className="tiny muted" style={{ marginTop: 12 }}>
            Titulaires et remplaçants facturés n’y figurent pas. Une semaine à cheval sur deux mois compte sur le mois de son lundi pour les heures supplémentaires : à confirmer avec votre cabinet.
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
