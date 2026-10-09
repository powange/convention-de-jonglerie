import { describe, it, expect, beforeEach, vi } from 'vitest'

import supprimerSurOffre from '../../../../../../../layers/carpool/server/api/carpool-offers/[id]/comments/[commentId].delete'
import supprimerSurDemande from '../../../../../../../layers/carpool/server/api/carpool-requests/[id]/comments/[commentId].delete'

const prismaMock = (globalThis as any).prisma

/**
 * Retirer son propre commentaire de covoiturage.
 *
 * ## ⚠️ LE DÉFAUT : UNE FONCTION ÉCRITE, TESTÉE, ET BRANCHÉE NULLE PART
 *
 * `deleteCommentForEntity` existait — garde d'auteur comprise, 403 pour un tiers, 404 pour un
 * commentaire inconnu — et **n'avait aucun appelant**. Les quatre points d'API du module étaient
 * deux `.get` et deux `.post` : un commentaire posté par erreur était **définitif pour son
 * auteur**.
 *
 * 📍 C'est le **second** cas du même motif dans ce seul constat — `commentSchema` était lui aussi
 * écrit, testé et branché nulle part. Du code qui porte sa logique ET ses tests sans être atteint
 * donne la couverture d'une fonctionnalité sans la fonctionnalité.
 *
 * ## Les deux formes sont éprouvées
 *
 * L'offre et la demande passent par la même fonction partagée, mais par des MODÈLES Prisma
 * différents (`carpoolComment` et `carpoolRequestComment`). Un seul des deux testé laisserait
 * passer une faute de modèle dans l'autre.
 */
describe('DELETE un commentaire de covoiturage', () => {
  const MOI = { id: 7, pseudo: 'Auteur', isGlobalAdmin: false }

  /**
   * ⚠️ `null` ET NON `undefined` POUR L'ABSENCE DE SESSION.
   *
   * Un paramètre par défaut s'applique à `undefined` — **y compris passé explicitement**. Écrire
   * `evenement(undefined)` reprenait donc `MOI`, et le cas « visiteur anonyme » exerçait en réalité
   * un utilisateur connecté : la suppression réussissait, et le test se plaignait d'une promesse
   * résolue au lieu d'un refus. Le défaut était dans le test, pas dans la garde.
   */
  const evenement = (utilisateur: unknown = MOI) => ({
    context: { user: utilisateur, params: { id: '1', commentId: '42' } },
    node: { req: { url: '/api/carpool-offers/1/comments/42', headers: {}, method: 'DELETE' } },
  })

  for (const [forme, handler, modele] of [
    ['offre', supprimerSurOffre, 'carpoolComment'],
    ['demande', supprimerSurDemande, 'carpoolRequestComment'],
  ] as const) {
    describe(forme, () => {
      beforeEach(() => {
        vi.clearAllMocks()
        prismaMock[modele].findUnique.mockResolvedValue({ userId: MOI.id })
        prismaMock[modele].delete.mockResolvedValue({ id: 42 })
      })

      it('supprime le commentaire de son auteur', async () => {
        const resultat: any = await handler(evenement() as any)
        expect(resultat.data.success).toBe(true)
        expect(prismaMock[modele].delete).toHaveBeenCalledWith({ where: { id: 42 } })
      })

      it('refuse en 403 le commentaire de quelqu’un d’autre', async () => {
        prismaMock[modele].findUnique.mockResolvedValue({ userId: 99 })

        await expect(handler(evenement() as any)).rejects.toMatchObject({ statusCode: 403 })
        expect(prismaMock[modele].delete).not.toHaveBeenCalled()
      })

      it('refuse en 401 un visiteur anonyme', async () => {
        await expect(handler(evenement(null) as any)).rejects.toMatchObject({
          statusCode: 401,
        })
        expect(prismaMock[modele].findUnique).not.toHaveBeenCalled()
      })

      it('refuse en 404 un commentaire inconnu', async () => {
        prismaMock[modele].findUnique.mockResolvedValue(null)
        await expect(handler(evenement() as any)).rejects.toMatchObject({ statusCode: 404 })
      })

      it(`emploie le modèle ${modele}`, async () => {
        /*
         * ⚠️ L'ASSERTION QUI SÉPARE LES DEUX FORMES. Elles partagent la fonction, mais pas le
         * modèle Prisma. Sans ce cas, une faute de modèle — la demande écrivant dans la table de
         * l'offre — passerait : le mock répond pour n'importe quel modèle, et les quatre cas
         * ci-dessus resteraient verts.
         */
        await handler(evenement() as any)
        expect(prismaMock[modele].delete).toHaveBeenCalled()
      })
    })
  }
})
