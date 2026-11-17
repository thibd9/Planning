import { MessageSquare, Send, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { fmtHorodatage } from '../../domain/time';
import { nomComplet, nomCourt } from '../../domain/types';
import { useStore } from '../../store/store';
import { EtiquetteRole } from '../icons';
import { Avatar, Pill } from '../kit';

/** Messagerie interne : un fil pour toute l'équipe, et un fil privé avec chaque collègue. */
export function Messages({ personId }: { personId: string }): JSX.Element {
  const { data, envoyerMessage, lireFil } = useStore();
  const [fil, setFil] = useState('equipe');
  const [texte, setTexte] = useState('');
  const bas = useRef<HTMLDivElement>(null);
  const collegues = data.personnes.filter((p) => !p.externe && p.id !== personId);
  const duFil = (f: string) => data.messages.filter((m) => (f === 'equipe' ? m.a === 'equipe' : (m.de === f && m.a === personId) || (m.de === personId && m.a === f)));
  const nonLus = (f: string): number => duFil(f).filter((m) => !m.luPar.includes(personId)).length;
  const messages = duFil(fil).sort((a, b) => a.at.localeCompare(b.at));
  const autre = data.personnes.find((p) => p.id === fil);

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
          <p>Pour une absence ou un horaire, préférez une demande depuis « Mon planning » : elle est suivie et tracée. Les messages restent sur cet appareil.</p>
        </div>
      </div>
      <div className="split">
        <div className="col" style={{ gap: 8 }} role="group" aria-label="Conversations">
          <button type="button" className={`g-item${fil === 'equipe' ? ' on' : ''}`} aria-pressed={fil === 'equipe'} onClick={() => setFil('equipe')}>
            <span className="ico" aria-hidden="true"><Users size={18} /></span>
            <span className="grow">
              <b>Toute l’équipe</b>
              <span className="small soft" style={{ display: 'block' }}>Visible par tous</span>
            </span>
            {nonLus('equipe') ? <Pill tone="iris">{nonLus('equipe')}<span className="sr"> non lus</span></Pill> : null}
          </button>
          {collegues.map((p) => (
            <button key={p.id} type="button" className={`g-item${fil === p.id ? ' on' : ''}`} aria-pressed={fil === p.id} onClick={() => setFil(p.id)}>
              <Avatar person={p} />
              <span className="grow">
                <b>{nomComplet(p)}</b>
                <span style={{ display: 'block', marginTop: 3 }}>
                  <EtiquetteRole person={p} />
                </span>
              </span>
              {nonLus(p.id) ? <Pill tone="iris">{nonLus(p.id)}<span className="sr"> non lus</span></Pill> : null}
            </button>
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
                return (
                  <div key={m.id} className={`bulle${m.de === personId ? ' moi' : ''}`}>
                    {m.de !== personId ? <span className="qui">{de ? nomCourt(de) : ''}</span> : <span className="sr">Vous : </span>}
                    {m.texte}
                    <span className="quand">{fmtHorodatage(m.at)}</span>
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
    </div>
  );
}
