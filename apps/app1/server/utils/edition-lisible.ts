import type { H3Event } from 'h3'

import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { editionVisiblePubliquement } from '~~/shared/utils/visibilite-edition'

/** Ce qu'il faut savoir d'une édition pour décider si un visiteur peut la lire. */
export type EditionDontOnVerifieLaVisibilite = {
  status: string
  /**
   * Le créateur et l'auteur de la convention, UNIQUEMENT pour reconnaître une édition orpheline.
   *
   * Les droits, eux, sont décidés par `canAccessEditionData`. Ces deux champs ne servent qu'au cas
   * particulier ci-dessous, et les omettre le désactive simplement.
   */
  creatorId?: number | null
  conventionAuthorId?: number | null
}

/**
 * Cette édition est-elle lisible de qui demande, ou faut-il répondre 404 ?
 *
 * ⚠️ POURQUOI UNE GARDE PARTAGÉE, ET NON UN SIXIÈME CONTRÔLE ÉCRIT SUR PLACE. La règle « une
 * édition `OFFLINE` ne se lit qu'en coulisses » était déjà recopiée à six endroits, et
 * `shared/utils/visibilite-edition.ts` porte le récit de ce que la septième copie a coûté : la
 * route publique des tarifs, écrite sans les autres sous les yeux, livrait les prix d'une édition
 * cachée à qui connaissait son numéro. Ce fichier-ci est la moitié SERVEUR de cette règle — celle
 * qui, en plus du statut, sait interroger les droits.
 *
 * ⚠️ 404 ET NON 403, comme la fiche d'une édition et le programme : distinguer les deux dirait à
 * un visiteur qu'il EXISTE quelque chose à voir derrière ce numéro, ce qui n'est pas son affaire.
 *
 * ⚠️ L'ÉDITION ORPHELINE est traitée comme publique — c'est le comportement de la fiche
 * (`editions/[id]/index.get.ts`), conservé tel quel. Une édition importée que personne n'a
 * revendiquée n'a ni créateur ni auteur de convention : personne ne pourrait donc jamais la lire,
 * et la cacher à tout le monde reviendrait à la perdre. Ne lui passer aucun des deux champs
 * désactive ce cas.
 *
 * @param event - la requête, pour la session et le mode admin
 * @param editionId - l'édition demandée
 * @param edition - son statut, et les deux champs du cas orphelin
 */
/*
 * ⚠️ `H3Event` ET NON une forme structurelle du genre `{ context?: { user?: { id: number } } }`.
 *
 * C'est ce qui était écrit, et ça ne peut PAS fonctionner — pour une raison qui mérite d'être
 * notée, parce qu'elle n'est pas intuitive. Un type cible dont TOUTES les propriétés sont
 * optionnelles est un « type faible » aux yeux de TypeScript, et il exige alors que la source
 * partage au moins un nom de propriété. Or `H3EventContext` déclare `params`, `matchedRoute`,
 * `sessions` et `clientAddress` — jamais `user` —, si bien que le contrôle échouait malgré son
 * `extends Record<string, any>` :
 *
 *     Types of property 'context' are incompatible.
 *       Type 'H3EventContext' has no properties in common with type '{ user?: { id: number } }'.
 *
 * Six points d'API passaient donc un vrai `event` à une signature qui ne pouvait pas l'accepter.
 * L'intention — « je ne lis que `context.user` » — était bonne, mais elle n'est pas exprimable
 * ainsi ; les autres utils de ce dossier typent `H3Event`, et c'est l'idiome à suivre.
 */
export async function assurerEditionLisible(
  event: H3Event,
  editionId: number,
  edition: EditionDontOnVerifieLaVisibilite
): Promise<void> {
  if (editionVisiblePubliquement(edition.status)) return

  // Une édition que personne ne détient : voir le commentaire ci-dessus.
  const orpheline =
    edition.creatorId !== undefined &&
    edition.conventionAuthorId !== undefined &&
    !edition.creatorId &&
    !edition.conventionAuthorId
  if (orpheline) return

  const user = event.context?.user
  const faitPartieDeLOrganisation = user
    ? await canAccessEditionData(editionId, user.id, event)
    : false
  if (faitPartieDeLOrganisation) return

  throw createError({ status: 404, message: 'Édition non trouvée' })
}
