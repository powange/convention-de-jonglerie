/**
 * Départager, après un scan, ce que CET appel a validé de ce qu'un autre avait déjà validé.
 *
 * La mise à jour du contrôle d'accès porte `entryValidated: false` dans son `where` : deux
 * scanners simultanés ne peuvent donc pas valider deux fois la même personne. C'est juste, et
 * c'était déjà le cas. Mais `updateMany` ne rend qu'un **compte** : le second agent recevait un
 * succès annonçant « 0 validé », sans rien qui distingue « un collègue m'a devancé » de « je
 * viens de le faire ». Aux deux portes d'une même convention, les deux croyaient avoir laissé
 * entrer la personne.
 *
 * Ce module répond à la question que le compte ne posait pas : **qui, et quand**.
 */

import type { TypeDeParticipant } from './journal-des-entrees'

/** Ce qu'une ligne d'entrée doit porter pour être départagée, quelle que soit sa table. */
export interface LigneDEntree {
  id: number
  entryValidated: boolean
  entryValidatedAt: Date | null
  entryValidatedBy: number | null
}

/** Une entrée qu'un autre avait déjà validée, telle que l'écran doit pouvoir la nommer. */
export interface EntreeDejaValidee {
  id: number
  at: Date | null
  by: { firstName: string | null; lastName: string | null } | null
}

export interface ConstatDeValidation {
  /** Les identifiants que cet appel a réellement fait passer — ce qui va au journal. */
  validees: number[]
  /** Celles qui l'étaient déjà, avec leur auteur quand il est connu. */
  dejaValidees: EntreeDejaValidee[]
}

/**
 * Les lignes sont relues **après** la mise à jour, et reconnues à l'horodatage exact que cet
 * appel a écrit.
 *
 * C'est ce qui rend le découpage exact plutôt qu'approximatif. Un relevé fait *avant* la mise à
 * jour dirait ce qu'on espérait valider, pas ce qui a bougé : entre les deux, un collègue peut
 * avoir scanné la même personne, et le journal aurait alors consigné une entrée que cet appel
 * n'a pas produite. L'horodatage, lui, nous appartient — d'où l'obligation de le fabriquer une
 * fois pour toutes et de le passer ici, plutôt que d'écrire `new Date()` dans le `data`.
 */
export async function departagerLesEntrees(options: {
  lignes: LigneDEntree[]
  horodatage: Date
  actorId: number
}): Promise<ConstatDeValidation> {
  const validees: number[] = []
  const restantes: LigneDEntree[] = []

  for (const ligne of options.lignes) {
    const estDeCetAppel =
      ligne.entryValidatedBy === options.actorId &&
      ligne.entryValidatedAt?.getTime() === options.horodatage.getTime()

    if (estDeCetAppel) validees.push(ligne.id)
    else if (ligne.entryValidated) restantes.push(ligne)
  }

  if (restantes.length === 0) return { validees, dejaValidees: [] }

  const idsAuteurs = [
    ...new Set(
      restantes
        .map((ligne) => ligne.entryValidatedBy)
        .filter((id): id is number => typeof id === 'number')
    ),
  ]

  // Une seule requête pour tous les auteurs : une commande peut porter dix billets validés par
  // des personnes différentes, et un `findUnique` par ligne coûterait dix allers-retours.
  const auteurs = idsAuteurs.length
    ? await prisma.user.findMany({
        where: { id: { in: idsAuteurs } },
        select: { id: true, prenom: true, nom: true },
      })
    : []
  const auteurParId = new Map(auteurs.map((u) => [u.id, u]))

  return {
    validees,
    dejaValidees: restantes.map((ligne) => {
      const auteur = ligne.entryValidatedBy ? auteurParId.get(ligne.entryValidatedBy) : undefined
      return {
        id: ligne.id,
        at: ligne.entryValidatedAt,
        by: auteur ? { firstName: auteur.prenom, lastName: auteur.nom } : null,
      }
    }),
  }
}

/** La forme rendue par les quatre branches de `validate-entry`, identique pour toutes. */
export interface ReponseDeValidation {
  validated: number
  type: TypeDeParticipant
  alreadyValidated: EntreeDejaValidee[]
}
