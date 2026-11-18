import { BellDot, CalendarPlus, MessageSquare, Send, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtDateCourt, fmtHeure, fmtHorodatage } from '../../domain/time';
import { nomComplet, nomCourt } from '../../domain/types';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { CarteRendezVous, DialogueRendezVous } from '../components/RendezVous';
import { Avatar } from '../kit';

/** Messagerie interne : un fil pour toute l'équipe, et un fil privé avec chaque collègue. */
export function Messages({ personId }: { personId: string }): JSX.Element {
  const { data, envoyerMessage, lireFil } = useStore();
  const today = useStore((st) => st.today);
  const collegues = data.personnes.filter((p) => !p.externe && p.id !== personId);
  const duFil = (f: string) => data.messages.filter((m) => (f === 'equipe' ? m.a === 'equipe' : (m.de === f && m.a === personId) || (m.de === personId && m.a === f)));
  const nonLus = (f: string): number => duFil(f).filter((m) => !m.luPar.includes(personId)).length;
  const dernier = (f: string) => duFil(f).sort((a, b) => b.at.localeCompare(a.at))[0];
  // On arrive sur la conversation qui a du nouveau, pas sur une conversation déjà lue.
  const { filVise, viserFil } = useUi();
  const [fil, setFil] = useState(() => (filVise && collegues.some((p) => p.id === filVise) ? filVise : (['equipe', ...collegues.map((p) => p.id)].find((f) => nonLus(f) > 0) ?? 'equipe')));
  const [rdv, setRdv] = useState(false);
  useEffect(() => {
    if (filVise) viserFil(null);
  }, [filVise, viserFil]);
  const [texte, setTexte] = useState('');
  /** Les messages qui étaient non lus à l'ouverture de la conversation : ils restent marqués « nouveau » tant qu'on y est. */
  const [nouveaux, setNouveaux] = useState<string[]>([]);
  const bas = useRef<HTMLDivElement>(null);
  const messages = duFil(fil).sort((a, b) => a.at.localeCompare(b.at));
  const autre = data.personnes.find((p) => p.id === fil);
  const totalNonLus = ['equipe', ...collegues.map((p) => p.id)].reduce((t, f) => t + (f === fil ? 0 : nonLus(f)), 0);
  /** Les conversations, celles qui ont du nouveau d'abord, puis la plus récente en tête. */
  const fils = useMemo(
    () =>
      [{ id: 'equipe', person: undefined as (typeof collegues)[number] | undefined }, ...collegues.map((p) => ({ id: p.id, person: p }))]
        .map((f) => ({ ...f, n: f.id === fil ? 0 : nonLus(f.id), der: dernier(f.id) }))
        .sort((a, b) => Number(b.n > 0) - Number(a.n > 0) || (b.der?.at ?? '').localeCompare(a.der?.at ?? '')),
    [data.messages, data.personnes, fil, personId],
  );
  const quand = (iso: string): string => {
    const d = new Date(iso);
    const jour = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return jour === today ? fmtHeure(d.getHours() * 60 + d.getMinutes()) : fmtDateCourt(jour).replace(/ \d{4}$/, '');
  };

  useEffect(() => {
    setNouveaux(duFil(fil).filter((m) => !m.luPar.includes(personId) && m.de !== personId).map((m) => m.id));
  }, [fil]);
  useEffect(() => {
    lireFil(personId, fil);
    bas.current?.scrollIntoView({ block: 'nearest' });
  }, [fil, messages.length, personId, lireFil]);

  return (
    <div>
      <div className="page-head">
        <span className="page-ico" aria-hidden="true">
          <MessageSquare size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Messages</div>
          <h1>
            Échanger avec <span className="hl">l’équipe</span>
          </h1>
          <p>Pour une absence ou un horaire, préférez une demande : elle est suivie. Les messages restent sur cet appareil.</p>
        </div>
        <button type="button" className="btn primary" id="rdv-demander" onClick={() => setRdv(true)}>
          <CalendarPlus size={16} aria-hidden="true" /> Demander un rendez-vous
        </button>
        {totalNonLus ? (
          <span className="msg-alerte" role="status">
            <BellDot size={17} aria-hidden="true" /> {totalNonLus} message{totalNonLus > 1 ? 's' : ''} non lu{totalNonLus > 1 ? 's' : ''}
          </span>
        ) : null}
      </div>
      <div className="split">
        <div className="col msg-fils" style={{ gap: 8 }} role="group" aria-label="Conversations">
          {fils.map((f, i) => (
            <div key={f.id} style={{ display: 'contents' }}>
              {i === 0 && f.n ? <div className="msg-rubrique nouveau">Non lus</div> : null}
              {i > 0 && !f.n && fils[i - 1].n ? <div className="msg-rubrique">Conversations</div> : null}
              <button type="button" className={`g-item msg-fil${fil === f.id ? ' on' : ''}${f.n ? ' non-lu' : ''}`} aria-pressed={fil === f.id} onClick={() => setFil(f.id)}>
                {f.person ? <Avatar person={f.person} /> : <span className="ico" aria-hidden="true"><Users size={18} /></span>}
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="msg-ligne">
                    <b>{f.person ? nomComplet(f.person) : 'Toute l’équipe'}</b>
                    {f.der ? <span className="msg-heure num">{quand(f.der.at)}</span> : null}
                  </span>
                  <span className="msg-apercu">{f.der ? `${f.der.de === personId ? 'Vous : ' : ''}${f.der.texte}` : f.person ? 'Aucun message' : 'Visible par tous'}</span>
                </span>
                {f.n ? (
                  <span className="msg-pastille num">
                    {f.n}
                    <span className="sr"> non lu{f.n > 1 ? 's' : ''}</span>
                  </span>
                ) : null}
              </button>
            </div>
          ))}
        </div>
        <section className="card" aria-label={fil === 'equipe' ? 'Fil de toute l’équipe' : `Conversation avec ${autre ? nomComplet(autre) : ''}`}>
          <div className="card-head">
            <h2 className="h3">{fil === 'equipe' ? 'Toute l’équipe' : autre ? nomComplet(autre) : ''}</h2>
          </div>
          <div className="fil" role="log" aria-live="polite">
            {messages.length ? (
              messages.map((m) => {
                const de = data.personnes.find((p) => p.id === m.de);
                const neuf = nouveaux.includes(m.id);
                return (
                  <div key={m.id} style={{ display: 'contents' }}>
                  {neuf && nouveaux[0] === m.id ? <div className="msg-separateur">Nouveau{nouveaux.length > 1 ? 'x messages' : ' message'}</div> : null}
                  <div className={`bulle${m.de === personId ? ' moi' : ''}${neuf ? ' nouveau' : ''}`}>
                    {m.de !== personId ? <span className="qui">{de ? nomCourt(de) : ''}</span> : <span className="sr">Vous : </span>}
                    {m.texte}
                    <span className="quand">{fmtHorodatage(m.at)}</span>
                  </div>
                  {m.rdvId && (data.rendezVous ?? []).some((r) => r.id === m.rdvId) ? <CarteRendezVous rdv={(data.rendezVous ?? []).find((r) => r.id === m.rdvId)!} moi={personId} /> : null}
                  </div>
                );
              })
            ) : (
              <p className="soft small">Aucun message pour l’instant. Écrivez le premier.</p>
            )}
            <div ref={bas} />
          </div>
          <form
            className="card-body row"
            style={{ borderTop: '1px solid var(--line)', alignItems: 'flex-end' }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!texte.trim()) return;
              envoyerMessage(personId, fil, texte);
              setTexte('');
            }}
          >
            <label className="field grow" htmlFor="msg-texte">
              Votre message
              <textarea id="msg-texte" rows={2} value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={1000} />
            </label>
            <button type="submit" className="btn primary" disabled={!texte.trim()}>
              <Send size={16} aria-hidden="true" /> Envoyer
            </button>
          </form>
        </section>
      </div>
      {rdv ? <DialogueRendezVous de={personId} avec={fil === 'equipe' ? undefined : fil} onClose={() => setRdv(false)} /> : null}
    </div>
  );
}
