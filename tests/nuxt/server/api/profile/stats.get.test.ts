import { describe, it, expect, beforeEach } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'
import {
  createTestUser,
  createTestConvention,
  createTestEdition,
} from '../../../../helpers/database'
import { prisma } from '../../../server/utils/prisma'

describe('/api/profile/stats.get', async () => {
  await setup()

  beforeEach(async () => {
    // Nettoyer les données de test
    await prisma.user.deleteMany()
    await prisma.convention.deleteMany()
    await prisma.edition.deleteMany()
  })

  it('doit retourner les statistiques du profil utilisateur', async () => {
    // Créer un utilisateur de test
    const testUser = await createTestUser({
      email: 'stats-user@test.com',
      pseudo: 'StatsUser',
    })

    // Créer une convention pour cet utilisateur
    const convention = await createTestConvention({
      name: 'Convention Test',
      authorId: testUser.id,
    })

    // Créer plusieurs éditions pour cette convention
    const edition1 = await createTestEdition({
      name: 'Edition 1',
      conventionId: convention.id,
      creatorId: testUser.id,
      startDate: '2024-12-01',
      endDate: '2024-12-03',
      addressLine1: '123 Test Street',
      city: 'Test City',
      country: 'Test Country',
      postalCode: '12345',
    })

    const edition2 = await createTestEdition({
      name: 'Edition 2',
      conventionId: convention.id,
      creatorId: testUser.id,
      startDate: '2024-12-15',
      endDate: '2024-12-17',
      addressLine1: '456 Test Avenue',
      city: 'Test City',
      country: 'Test Country',
      postalCode: '12345',
    })

    // Créer d'autres utilisateurs qui vont mettre en favoris
    const user2 = await createTestUser({
      email: 'user2@test.com',
      pseudo: 'User2',
    })

    const user3 = await createTestUser({
      email: 'user3@test.com',
      pseudo: 'User3',
    })

    // Ajouter des favoris sur les éditions
    await prisma.user.update({
      where: { id: user2.id },
      data: {
        favoriteEditions: {
          connect: [{ id: edition1.id }, { id: edition2.id }],
        },
      },
    })

    await prisma.user.update({
      where: { id: user3.id },
      data: {
        favoriteEditions: {
          connect: [{ id: edition1.id }],
        },
      },
    })

    // L'utilisateur principal met aussi une édition en favoris (d'un autre utilisateur)
    const otherConvention = await createTestConvention({
      name: 'Other Convention',
      authorId: user2.id,
    })

    const otherEdition = await createTestEdition({
      name: 'Other Edition',
      conventionId: otherConvention.id,
      creatorId: user2.id,
      startDate: '2024-12-20',
      endDate: '2024-12-22',
      addressLine1: '789 Other Street',
      city: 'Other City',
      country: 'Other Country',
      postalCode: '67890',
    })

    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        favoriteEditions: {
          connect: [{ id: otherEdition.id }],
        },
      },
    })

    // Faire la requête à l'API avec l'utilisateur connecté
    const response = await $fetch('/api/profile/stats', {
      headers: {
        cookie: `nuxt-session=${Buffer.from(JSON.stringify({ user: { id: testUser.id } })).toString('base64')}`,
      },
    })

    // Vérifier les statistiques
    expect(response).toMatchObject({
      conventionsCreated: 1, // L'utilisateur a créé 1 convention
      editionsFavorited: 1, // L'utilisateur a mis 1 édition en favoris
      favoritesReceived: 3, // Ses éditions ont reçu 3 favoris au total (2 + 1)
    })
  })

  it('doit retourner des statistiques vides pour un nouvel utilisateur', async () => {
    // Créer un utilisateur sans aucune activité
    const testUser = await createTestUser({
      email: 'new-user@test.com',
      pseudo: 'NewUser',
    })

    const response = await $fetch('/api/profile/stats', {
      headers: {
        cookie: `nuxt-session=${Buffer.from(JSON.stringify({ user: { id: testUser.id } })).toString('base64')}`,
      },
    })

    expect(response).toMatchObject({
      conventionsCreated: 0,
      editionsFavorited: 0,
      favoritesReceived: 0,
    })
  })

  it('doit exiger une authentification', async () => {
    await expect($fetch('/api/profile/stats')).rejects.toThrow('401')
  })
})
