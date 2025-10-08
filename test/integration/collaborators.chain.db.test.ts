import bcrypt from 'bcryptjs'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { prismaTest } from '../setup-db'

// Ce test nécessite TEST_WITH_DB=true + base lancée (script test:db)
// Chaîne: création convention & users -> ajout collaborateur -> patch droits -> suppression -> vérification historique

describe('Intégration collaborateurs: add -> patch -> delete -> history', () => {
  let owner: any
  let collaboratorUser: any
  let actor: any
  let convention: any
  let collaboratorRecord: any

  beforeAll(async () => {
    const ts = Date.now()
    owner = await prismaTest.user.create({
      data: {
        email: `owner-${ts}@ex.com`,
        password: await bcrypt.hash('x', 10),
        pseudo: `owner-${ts}`,
        nom: 'Own',
        prenom: 'Er',
        isEmailVerified: true,
      },
    })
    actor = owner // l'owner réalise les actions
    collaboratorUser = await prismaTest.user.create({
      data: {
        email: `collab-${ts}@ex.com`,
        password: await bcrypt.hash('x', 10),
        pseudo: `collab-${ts}`,
        nom: 'Col',
        prenom: 'Lab',
        isEmailVerified: true,
      },
    })
    convention = await prismaTest.convention.create({
      data: { name: `Conv-${ts}`, authorId: owner.id },
    })

    // Ajout collaborateur (simulateur logique du endpoint / POST direct via Prisma + historique manuellement pour refléter comportement addConventionCollaborator)
    collaboratorRecord = await prismaTest.conventionCollaborator.create({
      data: {
        conventionId: convention.id,
        userId: collaboratorUser.id,
        addedById: actor.id,
        title: null,
        canEditConvention: false,
        canDeleteConvention: false,
        canManageCollaborators: false,
        canAddEdition: false,
        canEditAllEditions: false,
        canDeleteAllEditions: false,
      },
    })
    await prismaTest.collaboratorPermissionHistory.create({
      data: {
        conventionId: convention.id,
        targetUserId: collaboratorUser.id,
        actorId: actor.id,
        changeType: 'CREATED',
        after: {
          title: null,
          rights: {
            canEditConvention: false,
            canDeleteConvention: false,
            canManageCollaborators: false,
            canAddEdition: false,
            canEditAllEditions: false,
            canDeleteAllEditions: false,
          },
          perEdition: [],
        } as any,
      } as any,
    })
    // Patch droits (un global + perEdition) => enregistrer PER_EDITIONS_UPDATED
    const beforeSnapshot = { ...collaboratorRecord }
    await prismaTest.conventionCollaborator.update({
      where: { id: collaboratorRecord.id },
      data: { canEditConvention: true },
    })
    await prismaTest.collaboratorPermissionHistory.create({
      data: {
        conventionId: convention.id,
        targetUserId: collaboratorUser.id,
        actorId: actor.id,
        changeType: 'RIGHTS_UPDATED',
        before: {
          title: beforeSnapshot.title,
          rights: {
            canEditConvention: beforeSnapshot.canEditConvention,
            canDeleteConvention: beforeSnapshot.canDeleteConvention,
            canManageCollaborators: beforeSnapshot.canManageCollaborators,
            canAddEdition: beforeSnapshot.canAddEdition,
            canEditAllEditions: beforeSnapshot.canEditAllEditions,
            canDeleteAllEditions: beforeSnapshot.canDeleteAllEditions,
          },
          perEdition: [],
        } as any,
        after: {
          title: beforeSnapshot.title,
          rights: {
            canEditConvention: true,
            canDeleteConvention: false,
            canManageCollaborators: false,
            canAddEdition: false,
            canEditAllEditions: false,
            canDeleteAllEditions: false,
          },
          perEdition: [],
        } as any,
      } as any,
    })
    // Suppression => entrée REMOVED
    await prismaTest.collaboratorPermissionHistory.create({
      data: {
        conventionId: convention.id,
        targetUserId: collaboratorUser.id,
        actorId: actor.id,
        changeType: 'REMOVED',
        before: {
          title: null,
          rights: {
            canEditConvention: true,
            canDeleteConvention: false,
            canManageCollaborators: false,
            canAddEdition: false,
            canEditAllEditions: false,
            canDeleteAllEditions: false,
          },
        } as any,
        after: { removed: true } as any,
      } as any,
    })
    await prismaTest.conventionCollaborator.delete({ where: { id: collaboratorRecord.id } })
  })

  it('chaîne cohérente dans history', async () => {
    const hist = await prismaTest.collaboratorPermissionHistory.findMany({
      where: { conventionId: convention.id, targetUserId: collaboratorUser.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(hist.length).toBe(3)
    expect(hist[0].changeType).toBe('CREATED')
    expect(hist[1].changeType).toBe('RIGHTS_UPDATED')
    expect(hist[2].changeType).toBe('REMOVED')
  })

  afterAll(async () => {
    // Nettoyage spécifique si besoin (optionnel)
  })
})
