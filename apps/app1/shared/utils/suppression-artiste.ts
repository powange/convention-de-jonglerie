/**
 * Ce qu'une suppression d'artiste laisse derrière elle, et ce qu'on peut proposer d'emporter avec.
 *
 * Supprimer un artiste efface ses liens vers les spectacles et les numéros — la base s'en charge en
 * cascade. Mais le NUMÉRO, lui, reste : une ligne du déroulé d'un cabaret que plus personne
 * n'interprète. Ce n'est pas un état incohérent, et rien ne casse : la feuille technique l'affiche
 * sans nom d'interprète, et ni le programme public ni la billetterie n'exposent les numéros. C'est
 * un trou visible des seuls organisateurs, qu'on peut vouloir garder le temps de remplacer
 * quelqu'un — d'où des cases à cocher, et non un nettoyage d'office.
 *
 * La règle vit ici pour être lue des DEUX côtés : l'écran s'en sert pour proposer les cases, le
 * point d'API pour vérifier ce qu'on lui demande d'emporter. Sans cela, il suffirait d'envoyer
 * l'identifiant d'un spectacle quelconque à la suppression d'un artiste pour le faire disparaître.
 */

/** Un lien entre un artiste et un spectacle, éventuellement via un numéro. */
export interface LienArtiste {
  artistId: number
  /** Renseigné seulement quand l'artiste participe via un numéro, donc dans un cabaret. */
  actId: number | null
}

/** Un numéro de cabaret et les liens qui le peuplent. */
export interface NumeroAvecLiens {
  id: number
  title: string
  showId: number
  liens: LienArtiste[]
}

/** Un spectacle, ses numéros, et les liens qui le rattachent directement à des artistes. */
export interface SpectacleAvecNumeros {
  id: number
  title: string
  numeros: NumeroAvecLiens[]
}

/** Un numéro que la suppression laisserait sans personne. */
export interface NumeroOrphelin {
  actId: number
  actTitle: string
  showId: number
  showTitle: string
  /** Le spectacle n'aurait plus aucun numéro une fois celui-ci retiré. */
  dernierDuSpectacle: boolean
}

/**
 * Les numéros dont cet artiste est le SEUL interprète.
 *
 * « Seul » se lit sur les liens du numéro, une fois écartés ceux de l'artiste qu'on supprime : s'il
 * n'en reste aucun, le numéro devient muet. Un numéro déjà vide avant la suppression n'est pas
 * retenu — on ne propose pas de nettoyer ce que cette suppression n'a pas causé.
 */
export function numerosOrphelinsApresSuppression(
  spectacles: readonly SpectacleAvecNumeros[],
  artistId: number
): NumeroOrphelin[] {
  const orphelins: NumeroOrphelin[] = []

  for (const spectacle of spectacles) {
    const videsApres = spectacle.numeros.filter(
      (numero) => !numero.liens.some((lien) => lien.artistId !== artistId)
    )
    const causesParLaSuppression = videsApres.filter((numero) =>
      numero.liens.some((lien) => lien.artistId === artistId)
    )

    for (const numero of causesParLaSuppression) {
      orphelins.push({
        actId: numero.id,
        actTitle: numero.title,
        showId: spectacle.id,
        showTitle: spectacle.title,
        /*
         * « Dernier » se juge sur les numéros qu'on RETIRE ensemble, et non un par un.
         *
         * Un artiste seul sur les trois numéros d'un cabaret les rend tous les trois orphelins :
         * aucun n'est « le dernier » pris isolément, alors que les cocher tous viderait bien le
         * spectacle. On compare donc au nombre de numéros qui resteraient peuplés.
         */
        dernierDuSpectacle: spectacle.numeros.length === videsApres.length,
      })
    }
  }

  return orphelins
}

/**
 * Les spectacles que la suppression viderait entièrement, si l'on emporte les numéros indiqués.
 *
 * Sert au point d'API : on lui donne ce que l'écran demande d'emporter, il en déduit ce qu'il a le
 * droit de supprimer. Un spectacle n'y figure que si TOUS ses numéros sont dans la liste.
 */
export function spectaclesVidesApresRetrait(
  spectacles: readonly SpectacleAvecNumeros[],
  numerosRetires: readonly number[]
): number[] {
  const retires = new Set(numerosRetires)
  return spectacles
    .filter(
      (spectacle) =>
        spectacle.numeros.length > 0 && spectacle.numeros.every((numero) => retires.has(numero.id))
    )
    .map((spectacle) => spectacle.id)
}
