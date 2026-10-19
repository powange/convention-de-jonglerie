import { describe, it, expect, vi, beforeEach } from 'vitest'

import favoriteHandler from '../../../server/api/editions/[id]/favorite.post'
import favoritesHandler from '../../../server/api/editions/favorites.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

// Mock du handler favoris

/*
 * Les deux points d'API des favoris : y ajouter/retirer une édition, et lister les favoris.
 *
 * ⚠️ TREIZE CAS ONT ÉTÉ RETIRÉS DE CE FICHIER le 19 octobre 2026, et c'est le fait à retenir.
 *
 * Il en comptait dix-neuf, dont treize qui ne traversaient AUCUN code du dépôt : ils
 * construisaient des objets sur place et vérifiaient ce qu'ils venaient d'écrire. L'un appelait
 * `Array.prototype.filter` et constatait qu'il avait filtré, un autre mettait une valeur dans une
 * `Map` et la relisait, un troisième fabriquait une chaîne CSV à la main pour la comparer à
 * elle-même. Le plus net configurait le bouchon Prisma, APPELAIT LE BOUCHON, et vérifiait qu'il
 * avait rendu ce qu'on venait de lui dire de rendre.
 *
 * Deux d'entre eux décrivaient même des fonctionnalités QUI N'EXISTENT PAS — un export CSV des
 * favoris et une limite du nombre de favoris —, ce qui est pire qu'un test inutile : cela laisse
 * croire à du code qui n'a jamais été écrit.
 *
 * Pendant ce temps, `favorites.get.ts` et `favorites.vue` n'étaient couverts par rien. L'illusion
 * de couverture était donc double : treize cas verts quoi que fasse l'application, et deux
 * surfaces réelles sans un seul test. Le bloc « Lister les favoris » ci-dessous ferme la première
 * des deux ; la page reste à couvrir.
 */
describe('Système de favoris', () => {
  const mockUser = {
    id: 1,
    email: 'user@example.com',
    pseudo: 'testuser',
    favoriteEditions: [],
  }

  const mockEdition = {
    id: 1,
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-03'),
    city: 'Paris',
    conventionId: 1,
    createdBy: 1,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('API - Ajouter/Retirer des favoris', () => {
    it('devrait rejeter si utilisateur non authentifié', async () => {
      const mockEvent = {
        context: {
          user: null,
          params: { id: '1' },
        },
      }

      await expect(favoriteHandler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter si ID édition invalide', async () => {
      const mockEvent = {
        context: {
          user: mockUser,
          params: { id: 'invalid' },
        },
      }

      await expect(favoriteHandler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait ajouter une édition aux favoris', async () => {
      const userWithoutFavorites = {
        ...mockUser,
        favoriteEditions: [],
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.user.findUnique.mockResolvedValue(userWithoutFavorites)
      prismaMock.user.update.mockResolvedValue({
        ...userWithoutFavorites,
        favoriteEditions: [mockEdition],
      })

      const mockEvent = {
        context: {
          user: mockUser,
          params: { id: '1' },
        },
      }

      const result = await favoriteHandler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        message: 'Edition added to favorites',
        data: { isFavorited: true },
      })

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          favoriteEditions: {
            connect: { id: 1 },
          },
        },
      })
    })

    it('devrait retirer une édition des favoris', async () => {
      const userWithFavorites = {
        ...mockUser,
        favoriteEditions: [mockEdition],
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.user.findUnique.mockResolvedValue(userWithFavorites)
      prismaMock.user.update.mockResolvedValue({
        ...userWithFavorites,
        favoriteEditions: [],
      })

      const mockEvent = {
        context: {
          user: mockUser,
          params: { id: '1' },
        },
      }

      const result = await favoriteHandler(mockEvent as any)

      expect(result).toEqual({
        success: true,
        message: 'Edition removed from favorites',
        data: { isFavorited: false },
      })

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          favoriteEditions: {
            disconnect: { id: 1 },
          },
        },
      })
    })

    it('devrait rejeter si utilisateur non trouvé', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)

      const mockEvent = {
        context: {
          user: mockUser,
          params: { id: '1' },
        },
      }

      await expect(favoriteHandler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait gérer les erreurs de base de données', async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error('Database error'))

      const mockEvent = {
        context: {
          user: mockUser,
          params: { id: '1' },
        },
      }

      await expect(favoriteHandler(mockEvent as any)).rejects.toThrow()
    })
  })

  /*
   * `GET /api/editions/favorites` — la liste des favoris, qui n'avait AUCUN test.
   *
   * Le fichier en comptait pourtant dix-neuf : treize ne traversaient aucun code du dépôt, et
   * deux d'entre eux décrivaient même des fonctionnalités qui n'existent pas (un export CSV des
   * favoris, une limite du nombre de favoris). Pendant ce temps, ce point d'API et la page
   * `favorites.vue` n'étaient couverts par rien. C'est l'illusion de couverture qu'on retire ici.
   */
  describe('API - Lister les favoris', () => {
    /** Ce que le `select` du gestionnaire ramène : des identifiants, et rien d'autre. */
    const compteAvecFavoris = { favoriteEditions: [{ id: 3 }, { id: 7 }] }

    const evenement = { context: { user: mockUser } }

    it('rend les identifiants des éditions favorites', async () => {
      prismaMock.user.findUnique.mockResolvedValue(compteAvecFavoris)

      const resultat = await favoritesHandler(evenement as any)

      expect(resultat).toEqual({ success: true, data: { favoriteIds: [3, 7] } })
    })

    it('rend une liste VIDE quand la personne n’a aucun favori', async () => {
      /*
       * Et non `null` ou une absence de champ : la page s'en sert pour décider de l'état de chaque
       * bouton, et un `undefined` y ferait disparaître l'état au lieu de le montrer éteint.
       */
      prismaMock.user.findUnique.mockResolvedValue({ favoriteEditions: [] })

      const resultat = await favoritesHandler(evenement as any)

      expect(resultat).toEqual({ success: true, data: { favoriteIds: [] } })
    })

    it('⚠️ ne demande à la base QUE les identifiants', async () => {
      /*
       * La page n'a besoin que de cela. Élargir ce `select` ramènerait chaque édition entière —
       * son affiche, son adresse, ses relations — à chaque chargement de page, pour n'en lire que
       * l'`id`. Le cas fixe donc la forme de la requête, pas seulement sa réponse.
       */
      prismaMock.user.findUnique.mockResolvedValue(compteAvecFavoris)

      await favoritesHandler(evenement as any)

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        select: { favoriteEditions: { select: { id: true } } },
      })
    })

    it('répond 404 quand le compte n’existe plus en base', async () => {
      /*
       * Branche atteignable malgré le middleware d'authentification : la suppression peut survenir
       * ENTRE son contrôle et cette lecture. Mieux vaut un 404 explicite qu'une liste vide, qui
       * se lirait « aucun favori » et ferait croire à une perte de données.
       */
      prismaMock.user.findUnique.mockResolvedValue(null)

      await expect(favoritesHandler(evenement as any)).rejects.toMatchObject({ statusCode: 404 })
    })

    it('le témoin : rien n’est rendu sans avoir interrogé la base', async () => {
      // Sans ce cas, les précédents seraient satisfaits par un gestionnaire qui rendrait une
      // constante sans jamais lire la base — le bouchon serait alors inutile et muet.
      prismaMock.user.findUnique.mockResolvedValue(compteAvecFavoris)

      await favoritesHandler(evenement as any)

      expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1)
    })
  })
})
