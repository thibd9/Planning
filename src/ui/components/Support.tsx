import { LifeBuoy, Mail, Phone } from 'lucide-react';
import { SUPPORT, SUPPORT_MAIL, SUPPORT_TEL } from '../../domain/support';

/** Les deux façons de joindre le support : appeler, écrire. */
export function ContactsSupport({ petit }: { petit?: boolean }): JSX.Element {
  return (
    <span className="sup-contacts">
      <a className={`btn${petit ? ' sm' : ''}`} href={SUPPORT_TEL}>
        <Phone size={petit ? 14 : 16} aria-hidden="true" /> <span className="num">{SUPPORT.telephone}</span>
      </a>
      <a className={`btn${petit ? ' sm' : ''}`} href={SUPPORT_MAIL}>
        <Mail size={petit ? 14 : 16} aria-hidden="true" /> {SUPPORT.email}
      </a>
    </span>
  );
}

/** Le pied de page : le support est toujours à portée, sur chaque écran. */
export function PiedSupport(): JSX.Element {
  return (
    <footer className="pied-support no-print" aria-label="Support">
      <LifeBuoy size={15} aria-hidden="true" />
      <span>Une question sans réponse ? {SUPPORT.nom} :</span>
      <a href={SUPPORT_TEL} className="num">
        {SUPPORT.telephone}
      </a>
      <span aria-hidden="true">·</span>
      <a href={SUPPORT_MAIL}>{SUPPORT.email}</a>
    </footer>
  );
}

/** Le bloc « Contacter le support » de la page d'aide. */
export function BlocSupport({ titre = 'Contacter le support', phrase }: { titre?: string; phrase?: string }): JSX.Element {
  return (
    <section className="card sup-bloc" aria-labelledby="sup-titre" id="aide-support">
      <LifeBuoy size={22} aria-hidden="true" className="sup-ico" />
      <div className="grow">
        <h2 className="h3" id="sup-titre">
          {titre}
        </h2>
        <p className="small soft">{phrase ?? 'Ni l’aide, ni le lexique, ni Solvi ne répondent à votre question ? Une personne vous répond.'}</p>
        {SUPPORT.provisoire ? <p className="tiny muted">Coordonnées provisoires, le temps que le support ouvre.</p> : null}
      </div>
      <ContactsSupport />
    </section>
  );
}
