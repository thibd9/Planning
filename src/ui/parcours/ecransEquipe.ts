import type { Etape, OutilsVisite } from '../Parcours';

/**
 * « Écran par écran » : l'espace d'un membre de l'équipe, champ par champ. Un chapitre par écran ; dans chaque étape,
 * Solvi montre chaque champ (geste « expliquer ») : ce qu'on y met, à quoi il sert, avec un exemple quand c'est utile.
 */
export function ecransEquipe(o: OutilsVisite): Etape[] {
  const NICOLAS = 'Nicolas · préparateur';
  return [
    {
      chapitre: 'Mes demandes',
      qui: NICOLAS,
      cible: '.content',
      titre: 'Trois façons de demander',
      texte: () => '« Mes demandes » réunit tout ce que vous pouvez demander à votre titulaire. Chaque carte ouvre un formulaire différent.',
      jouer: () => o.voirComme('nicolas.lesyndicaliste', 'demandes'),
      gestes: [
        { faire: 'expliquer', sur: o.nieme('.voie', 0), nom: 'Mes préférences', quoi: 'ce qui vous arrange pour le mois à venir : matin, journée, après-midi ou repos.', sert: 'Le planning s’en inspire ; personne n’a à vous répondre.' },
        { faire: 'expliquer', sur: o.nieme('.voie', 1), nom: 'Une absence ou un horaire', quoi: 'un congé, une absence ou un horaire à tenir.', sert: 'Votre titulaire l’accepte ou la refuse ; vous êtes prévenu de sa réponse.' },
        { faire: 'expliquer', sur: o.nieme('.voie', 2), nom: 'Me faire remplacer', quoi: 'un poste publié que vous ne pouvez pas tenir.', sert: 'Un collègue peut se proposer ; votre titulaire valide.' },
      ],
    },
  ];
}
