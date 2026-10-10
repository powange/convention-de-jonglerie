import bcrypt from 'bcryptjs'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { getEmailHash } from '../../server/utils/email-hash'
import { prismaTest } from '../setup-db'

// Ce test nécessite TEST_WITH_DB=true + base lancée (script test:db)
// Chaîne: création convention & users -> ajout organisateur -> patch droits -> suppression -> vérification historique

/*
 * ⚠️ `skipIf` AJOUTÉ : ce fichier était le SEUL des onze suites d'intégration à ne pas porter la
 * garde, alors que son commentaire ci-dessus dit lui-même nécessiter une base. Sans elle, son
 * `beforeAll` tentait de créer un utilisateur et échouait sur « pool timeout » après vingt
 * secondes — un rouge local que la CI ne voit jamais, puisqu'elle fournit MySQL au job
 * `test (database)`.
 *
 * C'est le symétrique du défaut B2 : là une suite se sautait en silence et passait pour couverte,
 * ici une suite échoue bruyamment faute de dire qu'elle a besoin d'une base.
 */
describe.skipIf(!process.env.TEST_WITH_DB)(
  'Intégration organisateurs: add -> patch -> delete -> history',
  () => {
    let owner: any
    let organizerUser: any
    let actor: any
    let convention: any
    let organizerRecord: any

    beforeAll(async () => {
      const ts = Date.now()
      const ownerEmail = `owner-${ts}@ex.com`
      owner = await prismaTest.user.create({
        data: {
          email: ownerEmail,
          emailHash: getEmailHash(ownerEmail),
          password: await bcrypt.hash('x', 10),
          pseudo: `owner-${ts}`,
          nom: 'Own',
          prenom: 'Er',
          isEmailVerified: true,
        },
      })
      actor = owner // l'owner réalise les actions
      const organizerEmail = `collab-${ts}@ex.com`
      organizerUser = await prismaTest.user.create({
        data: {
          email: organizerEmail,
          emailHash: getEmailHash(organizerEmail),
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

      // Ajout organisateur (simulateur logique du endpoint / POST direct via Prisma + historique manuellement pour refléter comportement addConventionOrganizer)
      organizerRecord = await prismaTest.conventionOrganizer.create({
        data: {
          conventionId: convention.id,
          userId: organizerUser.id,
          addedById: actor.id,
          title: null,
          canEditConvention: false,
          canDeleteConvention: false,
          canManageOrganizers: false,
          canAddEdition: false,
          canEditAllEditions: false,
          canDeleteAllEditions: false,
        },
      })
      await prismaTest.organizerPermissionHistory.create({
        data: {
          conventionId: convention.id,
          targetUserId: organizerUser.id,
          actorId: actor.id,
          changeType: 'CREATED',
          after: {
            title: null,
            rights: {
              canEditConvention: false,
              canDeleteConvention: false,
              canManageOrganizers: false,
              canAddEdition: false,
              canEditAllEditions: false,
              canDeleteAllEditions: false,
            },
            perEdition: [],
          } as any,
        } as any,
      })
      // Patch droits (un global + perEdition) => enregistrer PER_EDITIONS_UPDATED
      const beforeSnapshot = { ...organizerRecord }
      await prismaTest.conventionOrganizer.update({
        where: { id: organizerRecord.id },
        data: { canEditConvention: true },
      })
      await prismaTest.organizerPermissionHistory.create({
        data: {
          conventionId: convention.id,
          targetUserId: organizerUser.id,
          actorId: actor.id,
          changeType: 'RIGHTS_UPDATED',
          before: {
            title: beforeSnapshot.title,
            rights: {
              canEditConvention: beforeSnapshot.canEditConvention,
              canDeleteConvention: beforeSnapshot.canDeleteConvention,
              canManageOrganizers: beforeSnapshot.canManageOrganizers,
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
              canManageOrganizers: false,
              canAddEdition: false,
              canEditAllEditions: false,
              canDeleteAllEditions: false,
            },
            perEdition: [],
          } as any,
        } as any,
      })
      // Suppression => entrée REMOVED
      await prismaTest.organizerPermissionHistory.create({
        data: {
          conventionId: convention.id,
          targetUserId: organizerUser.id,
          actorId: actor.id,
          changeType: 'REMOVED',
          before: {
            title: null,
            rights: {
              canEditConvention: true,
              canDeleteConvention: false,
              canManageOrganizers: false,
              canAddEdition: false,
              canEditAllEditions: false,
              canDeleteAllEditions: false,
            },
          } as any,
          after: { removed: true } as any,
        } as any,
      })
      await prismaTest.conventionOrganizer.delete({ where: { id: organizerRecord.id } })
    })

    it('chaîne cohérente dans history', async () => {
      const hist = await prismaTest.organizerPermissionHistory.findMany({
        where: { conventionId: convention.id, targetUserId: organizerUser.id },
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
  }
)
