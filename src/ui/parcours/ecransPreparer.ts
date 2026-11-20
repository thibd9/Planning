import type { Etape, OutilsVisite } from '../Parcours';

/**
 * « Écran par écran » : la mise en place, champ par champ. Un chapitre par écran ; dans chaque étape, Solvi montre
 * chaque champ (geste « expliquer ») : ce qu'on y met, à quoi il sert, avec un exemple quand c'est utile.
 */
export function ecransPreparer(o: OutilsVisite): Etape[] {
  o.buts({ 'Réglages': 'Le nom, les horaires, l’effectif attendu et la façon de préparer le planning.' });
  return [
    {
      chapitre: 'Réglages',
      qui: o.HELENE,
      cible: '.content',
      titre: 'Le nom de la pharmacie',
      texte: () => 'Les réglages décrivent votre pharmacie : son nom, ses horaires, l’effectif attendu, la façon de préparer le planning. Chaque champ se modifie librement.',
      jouer: () => o.helene('officine'),
      gestes: [
        {
          faire: 'expliquer',
          sur: o.parLibelle('Nom de la pharmacie', '.content'),
          quoi: 'le nom de votre officine, tel que vous voulez le lire.',
          sert: 'Il s’affiche en haut de l’écran et sur les plannings imprimés.',
          exemple: 'Grande Pharmacie de la Pinède',
        },
      ],
    },
  ];
}
