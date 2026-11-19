export interface Terme {
  mot: string;
  sens: string;
  /** Réservé à l'espace responsable. */
  gestion?: boolean;
}
/** Le vocabulaire de Solvéa, par ordre alphabétique. */
export const LEXIQUE: Terme[] = [
  { mot: 'Absence à couvrir', sens: 'Un poste resté vide parce que la personne prévue est absente. Il apparaît dans « Résoudre » jusqu’à ce qu’il soit réglé.', gestion: true },
  { mot: 'Accident du travail', sens: 'Accident survenu à la pharmacie, en mission ou sur le trajet. Il se signale tout de suite ; l’employeur le déclare à la caisse d’assurance maladie dans les 48 heures, dimanches et jours fériés non comptés. Solvéa garde les faits et rappelle le délai.' },
  { mot: 'Accord', sens: 'Feu vert du titulaire principal à une décision proposée par un autre titulaire. Rien n’est appliqué avant.', gestion: true },
  { mot: 'Annonce de décision', sens: 'Message envoyé sous la cloche aux personnes concernées et aux titulaires dès qu’une décision est prise, avec ce qu’elle change dans les plannings.' },
  { mot: 'Appel à l’équipe', sens: 'Message envoyé en même temps à tous ceux qui peuvent tenir un poste à couvrir. Chacun répond « Je peux » ou « Je ne peux pas ».' },
  { mot: 'Astreinte', sens: 'Garde tenue à domicile : le pharmacien reste joignable et se déplace si on l’appelle. Seul le temps d’intervention compte comme du travail.' },
  { mot: 'Brouillon', sens: 'Planning en cours de construction. Seuls ceux qui le préparent le voient ; l’équipe ne voit que ce qui est publié.' },
  { mot: 'Changement tardif', sens: 'Modification publiée moins de sept jours avant la date concernée. Elle est comptée dans l’équité.' },
  { mot: 'Compteur d’heures', sens: 'Écart entre les heures publiées et les heures du contrat. L’objectif : le moins d’heures en plus possible.' },
  { mot: 'Contrôles', sens: 'Vérifications faites sur un planning : repos, pauses, durée, pharmacien présent, effectif. Les points bloquants sont à régler avant de publier.', gestion: true },
  { mot: 'Demande', sens: 'Congé, contrainte d’horaires ou remplacement : elle attend une réponse du titulaire, qui est annoncée à la personne.' },
  { mot: 'Dépannage', sens: 'Poste repris au pied levé pour couvrir une absence ou remplacer un collègue. Il compte dans le tour de rôle.' },
  { mot: 'Échéance du mois', sens: 'Dernier jour pour publier le planning du mois suivant. Un rappel la précède ; une fois dépassée, Solvéa peut préparer les semaines vides d’après vos habitudes, sans rien publier.', gestion: true },
  { mot: 'Équité', sens: 'Comparaison des samedis, fermetures, gardes et dépannages de chacun avec sa part attendue, au prorata de son contrat.' },
  { mot: 'Fiche navette', sens: 'Récapitulatif mensuel des heures et des variables de paie, à transmettre au comptable.', gestion: true },
  { mot: 'Garde', sens: 'Service assuré par un pharmacien en dehors des heures d’ouverture : de nuit, de jour (dimanche ou férié) ou sur 24 h. Un repos la suit.' },
  { mot: 'Garde à volets fermés', sens: 'Garde pendant laquelle la pharmacie est fermée au public : le pharmacien sert à la demande, au guichet de garde.' },
  { mot: 'Garde à volets ouverts', sens: 'Garde pendant laquelle la pharmacie reste ouverte au public, comme un jour ordinaire.' },
  { mot: 'Indisponibilité reconnue', sens: 'Contrainte d’horaires acceptée comme impérative : les plannings la respectent toujours.' },
  { mot: 'Jour férié', sens: 'Marqué dans la grille, le mois et les calendriers. La liste des douze prochains mois est dans « Réglages ».' },
  { mot: 'Justificatif', sens: 'Document joint à une demande urgente ou à une absence. Seuls les titulaires et la personne concernée le voient ; il est rangé dans « Documents ».' },
  { mot: 'Motif', sens: 'Catégorie donnée pour une demande de remplacement (santé, famille, administratif…). Visible des seuls titulaires.' },
  { mot: 'Points forts', sens: 'Ce qui a été noté de positif sur douze mois : ponctualité, dépannages, réponses aux appels. Ni note ni classement ; les arrêts et congés ne comptent jamais.' },
  { mot: 'Poste type', sens: 'Horaire modèle (matin, journée, fermeture…) avec sa couleur, pour poser un poste en un clic.', gestion: true },
  { mot: 'Préférence', sens: 'Ce qui vous convient pour le mois à venir. Le planning s’en inspire ; personne n’a à y répondre.' },
  { mot: 'Préférence prioritaire', sens: 'Contrainte d’horaires acceptée comme importante : suivie autant que possible, avec le même plafond pour tous.' },
  { mot: 'Publié', sens: 'Planning envoyé à l’équipe. Tout changement ultérieur est annoncé à la personne concernée.' },
  { mot: 'Régularisation', sens: 'Façon de solder un compteur d’heures : payer, faire récupérer ou faire rattraper.', gestion: true },
  { mot: 'Titulaire principal', sens: 'Le titulaire qui a créé la pharmacie. Il donne son accord aux décisions des autres titulaires.' },
  { mot: 'Tour de rôle', sens: 'Ordre dans lequel un dépannage est proposé : il revient d’abord à celui qui a le moins dépanné sur trois mois.' },
];
