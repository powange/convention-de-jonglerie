/**
 * Les sections d'une fiche de participant portant plusieurs titres.
 *
 * ⚠️ UNE ERREUR DE MAILLE, ET C'EST TOUT L'OBJET DE CE MODULE. Un titre de BILLET désigne une
 * LIGNE de commande, alors que la section qui l'affiche montre la commande ENTIÈRE. Cinq billets
 * d'une même commande donnaient donc cinq sections montrant chacune les cinq : la commande répétée
 * cinq fois dans la fiche, sans erreur et sans que rien ne le signale.
 *
 * Les trois autres natures n'ont pas ce problème : une candidature de bénévole, une fiche
 * d'artiste et une place d'organisateur sont des objets entiers, un par section.
 */

/** Une section candidate, telle que la page la tire des résultats de recherche. */
export interface SectionDeFiche {
  type: 'ticket' | 'volunteer' | 'artist' | 'organizer'
  /** La commande dont relève cette section. Seuls les billets en ont une. */
  commande?: number
  /** Les lignes à cocher d'avance : celles qui appartiennent à la personne cherchée. */
  preselection?: number[]
}

/*
 * ⚠️ PAS d'`[autre: string]: unknown` ici, et le retirer ne perd RIEN.
 *
 * L'intention — « le reste, participant, remboursement…, voyage sans être regardé » — est juste,
 * mais une index signature ne l'exprime pas : elle l'EXIGE. TypeScript n'admet une interface
 * concrète comme satisfaisant une index signature que si celle-ci y est déclarée explicitement,
 * si bien que `TitreAffiche` — le type réel des sections de la page — était refusé :
 *
 *     Index signature for type 'string' is missing in type 'TitreAffiche & { commande?: number }'
 *
 * Or la contrainte est générique (`<T extends SectionDeFiche>`) : le reste voyage de toute façon,
 * puisque c'est `T` qui est rendu, pas `SectionDeFiche`. Le code marchait grâce à un
 * `as TitreAffiche[]` posé par l'appelant ; c'est ce cast qui a disparu.
 */

/**
 * Réunit les sections de billets qui relèvent d'une même commande.
 *
 * ⚠️ L'ORDRE D'ARRIVÉE EST CONSERVÉ, et la section retenue est la PREMIÈRE de sa commande. Les
 * suivantes n'apportent que leur ligne, qui rejoint la présélection : garder la dernière
 * reviendrait au même pour l'affichage, mais déplacerait la commande dans la fiche selon l'ordre
 * des résultats de recherche — l'écran changerait d'une recherche à l'autre sans raison visible.
 *
 * 📍 Une commande sans identifiant n'est pas regroupée : on ne réunit que ce dont on est sûr. Deux
 * sections `undefined` ne sont pas « la même commande », elles sont deux commandes qu'on ne sait
 * pas nommer.
 */
export function regrouperLesSectionsParCommande<T extends SectionDeFiche>(
  sections: T[]
): Omit<T, 'commande'>[] {
  const retenues: T[] = []
  const parCommande = new Map<number, T>()

  for (const section of sections) {
    const { commande } = section

    if (typeof commande === 'number') {
      const dejaLa = parCommande.get(commande)
      if (dejaLa) {
        // La ligne rejoint la section de SA commande plutôt que d'en ouvrir une nouvelle.
        dejaLa.preselection = [
          ...(dejaLa.preselection ?? []),
          ...(section.preselection ?? []),
        ].filter((id, rang, tout) => tout.indexOf(id) === rang)
        continue
      }
      parCommande.set(commande, section)
    }

    retenues.push(section)
  }

  // `commande` ne servait qu'au regroupement : la laisser passerait un attribut inconnu au
  // composant, que Vue poserait sur l'élément racine.
  return retenues.map(({ commande: _ignore, ...reste }) => reste)
}
