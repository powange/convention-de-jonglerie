import { execSync } from 'node:child_process'

import bcrypt from 'bcryptjs'
import { describe, it, expect, beforeAll } from 'vitest'

import { prismaTest } from '../setup-db'

// Test d'intégration de la migration des droits collaborateurs
// Nécessite TEST_WITH_DB=true et une base de test prête

describe.skipIf(!process.env.TEST_WITH_DB)('Migration droits collaborateurs (script)', () => {
  let adminUser: any
  let moderatorUser: any
  let convention: any

  beforeAll(async () => {
    const ts = Date.now()
    adminUser = await prismaTest.user.create({
      data: {
        email: `admin-mig-${ts}@ex.com`,
        password: await bcrypt.hash('X', 10),
        pseudo: `admin-mig-${ts}`,
        nom: 'A',
        prenom: 'B',
        isEmailVerified: true,
      },
    })
    moderatorUser = await prismaTest.user.create({
      data: {
        email: `mod-mig-${ts}@ex.com`,
        password: await bcrypt.hash('X', 10),
        pseudo: `mod-mig-${ts}`,
        nom: 'C',
        prenom: 'D',
        isEmailVerified: true,
      },
    })
    convention = await prismaTest.convention.create({
      data: { name: 'Conv Mig', authorId: adminUser.id },
    })
    // Collaborateur ADMINISTRATOR sans droits booléens
    await prismaTest.conventionCollaborator.create({
      data: {
        conventionId: convention.id,
        userId: adminUser.id,
        role: 'ADMINISTRATOR',
        addedById: adminUser.id,
      },
    })
    // Collaborateur MODERATOR
    await prismaTest.conventionCollaborator.create({
      data: {
        conventionId: convention.id,
        userId: moderatorUser.id,
        role: 'MODERATOR',
        addedById: adminUser.id,
      },
    })
  })

  it('applique les droits et crée historique', async () => {
    // Dry-run: ne change rien
    const dryOut = execSync('npx tsx scripts/migrate-collaborator-rights.ts --dry', {
      encoding: 'utf8',
    })
    expect(dryOut).toContain('Plan')

    // Exécution réelle (forcer confirmation avec --yes)
    const realOut = execSync('npx tsx scripts/migrate-collaborator-rights.ts --yes', {
      encoding: 'utf8',
    })
    expect(realOut).toContain('Collaborateurs ajustés')

    const collaborators = await prismaTest.conventionCollaborator.findMany({
      where: { conventionId: convention.id },
      orderBy: { id: 'asc' },
    })
    const admin = collaborators.find((c) => c.userId === adminUser.id)!
    const mod = collaborators.find((c) => c.userId === moderatorUser.id)!

    // Admin doit avoir tous les droits
    expect(admin.canEditConvention).toBe(true)
    expect(admin.canDeleteConvention).toBe(true)
    expect(admin.canManageCollaborators).toBe(true)
    expect(admin.canAddEdition).toBe(true)
    expect(admin.canEditAllEditions).toBe(true)
    expect(admin.canDeleteAllEditions).toBe(true)

    // Moderator: addEdition + editAllEditions
    expect(mod.canAddEdition).toBe(true)
    expect(mod.canEditAllEditions).toBe(true)
    expect(mod.canManageCollaborators).toBe(false)
    expect(mod.canDeleteConvention).toBe(false)

    // Historique créé
    const history = await prismaTest.collaboratorPermissionHistory.findMany({
      where: { conventionId: convention.id },
    })
    expect(history.length).toBeGreaterThanOrEqual(2)
    expect(history.every((h) => h.changeType === 'CREATED')).toBe(true)
  })
})
