/*
 * `createError` est importé EXPLICITEMENT de `h3` et non pris dans l'auto-import de Nitro : ce
 * module est éprouvé par le projet de tests `unit`, où cet auto-import n'existe pas. Sans cela,
 * les deux cas de refus échouaient sur « createError is not defined » — une erreur qui ressemble
 * à un défaut du test alors qu'elle vient du module.
 */
import { createError } from 'h3'

import type { Prisma } from '#server/types/prisma'

type ClientPrisma = Prisma.TransactionClient | typeof prisma

/**
 * « Ces identifiants appartiennent-ils bien à cette édition ? »
 *
 * ⚠️ CE QUI MANQUAIT, et pourquoi ça ne se voyait pas. La composition d'un spectacle écrivait les
 * `artistIds` reçus sans vérifier leur édition. Un identifiant d'`EditionArtist` appartenant à une
 * AUTRE convention était donc lié au spectacle — et cet artiste apparaissait ensuite dans la
 * billetterie de cette édition, dans son espace artiste, dans ses feuilles de repas.
 *
 * Rien ne le signalait : l'artiste existe, il a un nom, il a des spectacles. Il n'est simplement
 * pas de cette édition. Le même raisonnement vaut pour les zones et les repères de carte d'une
 * représentation.
 *
 * ⚠️ L'ÉCRITURE EST AUTORISÉE PAR LE DROIT SUR L'ÉDITION, pas par l'appartenance des données.
 * C'est ce qui rend l'oubli exploitable : quelqu'un qui gère légitimement l'édition 42 pouvait y
 * rattacher les artistes de l'édition 17, sans aucun droit sur celle-ci.
 *
 * Le message nomme la CATÉGORIE et non l'identifiant : « Artiste inconnu dans cette édition » dit
 * à l'écran ce qu'il doit corriger, sans confirmer à un appelant malveillant qu'un identifiant
 * existe ailleurs.
 */

/** Vérifie que tous les artistes reçus appartiennent à l'édition. */
export async function verifierArtistesDeLEdition(
  client: ClientPrisma,
  editionId: number,
  artistIds: number[]
): Promise<void> {
  const ids = [...new Set(artistIds)]
  if (ids.length === 0) return

  const trouves = await client.editionArtist.findMany({
    where: { id: { in: ids }, editionId },
    select: { id: true },
  })

  if (trouves.length !== ids.length) {
    throw createError({ status: 400, message: 'Artiste inconnu dans cette édition' })
  }
}

/** Vérifie qu'une zone appartient à l'édition. `null` et `undefined` sont des absences. */
export async function verifierZoneDeLEdition(
  client: ClientPrisma,
  editionId: number,
  zoneId: number | null | undefined
): Promise<void> {
  if (!zoneId) return

  const zone = await client.editionZone.findFirst({
    where: { id: zoneId, editionId },
    select: { id: true },
  })

  if (!zone) {
    throw createError({ status: 400, message: 'Zone inconnue dans cette édition' })
  }
}

/** Vérifie qu'un repère de carte appartient à l'édition. */
export async function verifierRepereDeLEdition(
  client: ClientPrisma,
  editionId: number,
  markerId: number | null | undefined
): Promise<void> {
  if (!markerId) return

  const repere = await client.editionMarker.findFirst({
    where: { id: markerId, editionId },
    select: { id: true },
  })

  if (!repere) {
    throw createError({ status: 400, message: 'Repère inconnu dans cette édition' })
  }
}

/**
 * L'édition d'un spectacle, ou une erreur.
 *
 * Les deux fonctions de recomposition ne reçoivent qu'un `showId` : c'est ici qu'on remonte à
 * l'édition, une seule fois, plutôt que de changer leur signature — leurs appelants sont
 * nombreux, et leur faire porter un `editionId` qu'ils devraient eux-mêmes aller chercher
 * déplacerait seulement le risque d'oubli.
 */
export async function editionDuSpectacle(client: ClientPrisma, showId: number): Promise<number> {
  const show = await client.show.findUnique({
    where: { id: showId },
    select: { editionId: true },
  })

  if (!show) {
    throw createError({ status: 404, message: 'Spectacle introuvable' })
  }

  return show.editionId
}
