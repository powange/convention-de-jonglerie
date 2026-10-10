import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  ensureVolunteerToOrganizersConversation,
  ensureOrganizersGroupConversation,
} from '../../../../server/utils/messenger-helpers'

const prismaMock = (globalThis as any).prisma

/**
 * Les refus de la messagerie, et le 500 muet qu'ils rendaient — constat A3.
 *
 * ## ⚠️ LE DÉFAUT
 *
 * Cinq chemins de `messenger-helpers.ts` levaient un `throw new Error` nu. `wrapApiHandler` les
 * transforme en **500**, c'est-à-dire en panne : le bénévole qui cliquait « contacter les
 * organisateurs » sur une édition où personne ne gère les bénévoles voyait une erreur serveur, là
 * où la vraie réponse est « il n'y a personne à joindre ».
 *
 * ⚠️ La fiche d'audit en comptait **six** ; il y en avait **cinq** — l'un des numéros de ligne
 * qu'elle citait ne portait pas de `throw`, mais l'appel d'une fonction qui en lève un.
 *
 * ## ⚠️⚠️ CE QUI REND CES CAS NON CREUX
 *
 * On lit le **statut** porté par l'erreur, pas son message. C'est le statut qui décide de ce que
 * l'utilisateur voit : un 500 affiche « une erreur est survenue », un 404 ou un 409 affiche le
 * message qu'on a écrit. Un test qui vérifierait seulement « ça lève » serait vert avant comme
 * après — c'était déjà le cas.
 *
 * Le témoin est le chemin ORDINAIRE : il ne doit rien lever du tout, sinon un helper qui refuserait
 * systématiquement satisferait tous les cas ci-dessus et plus personne ne pourrait écrire.
 */
describe('les refus de la messagerie portent un statut', () => {
  const EDITION = 7
  const BENEVOLE = 42

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.edition.findUnique.mockResolvedValue({ conventionId: 3 })
    prismaMock.conventionOrganizer.findMany.mockResolvedValue([{ userId: 1 }])
    /*
     * ⚠️ `participants` EST LU, et son absence ne se voit pas dans le `select` : le chemin ordinaire
     * parcourt les participants existants pour y ajouter les organisateurs manquants. Une
     * conversation bouchée sans eux fait lever un `TypeError`, et le témoin échoue alors sur une
     * cause qui n'est pas la sienne.
     */
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: 'conv-existante',
      volunteerId: BENEVOLE,
      participants: [{ userId: 1 }],
    })
  })

  it('⚠️ 409 QUAND PERSONNE NE GÈRE LES BÉNÉVOLES', async () => {
    /*
     * LE CŒUR DU CONSTAT. Ce n'est pas une panne : c'est une édition où aucun organisateur n'a le
     * droit de gestion des bénévoles. Le 409 permet à l'écran de le dire — il affiche déjà les
     * erreurs qu'on lui rend.
     */
    prismaMock.conventionOrganizer.findMany.mockResolvedValue([])

    await expect(ensureVolunteerToOrganizersConversation(EDITION, BENEVOLE)).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('⚠️ 404 QUAND L’ÉDITION N’EXISTE PAS', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(null)

    await expect(ensureVolunteerToOrganizersConversation(EDITION, BENEVOLE)).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('409 aussi pour un groupe d’organisateurs vide', async () => {
    // Même raison, autre helper : une édition sans organisateur n'est pas une panne.
    prismaMock.editionOrganizer.findMany.mockResolvedValue([])

    await expect(ensureOrganizersGroupConversation(EDITION)).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('ne lève rien sur le chemin ordinaire', async () => {
    /*
     * LE TÉMOIN, et il est indispensable : un helper qui refuserait systématiquement satisferait les
     * trois cas ci-dessus, et plus aucun bénévole ne pourrait écrire aux organisateurs.
     */
    await expect(ensureVolunteerToOrganizersConversation(EDITION, BENEVOLE)).resolves.toBe(
      'conv-existante'
    )
  })
})
