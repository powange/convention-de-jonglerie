import { execSync } from 'node:child_process'

import bcrypt from 'bcryptjs'
import { describe, it, expect, beforeAll } from 'vitest'

import { getEmailHash } from '../../server/utils/email-hash'
import { prismaTest } from '../setup-db'

// Test d'intégration de la migration des droits organisateurs
// Nécessite TEST_WITH_DB=true et une base de test prête

// LEGACY: ce test vérifiait la migration depuis l'ancien champ `role` (ADMINISTRATOR / MODERATOR)
// Le champ a été supprimé du modèle `ConventionOrganizer`. On ignore désormais ce scénario.
// Si une migration rétro-compatible est encore nécessaire sur une base existante pré-migration,
// exécuter manuellement `npx tsx scripts/migrate-organizer-rights.ts --dry` puis `--yes` hors tests.
describe.skip('Migration droits organisateurs (script) - ignoré (champ role supprimé)', () => {
  let adminUser: any
  let moderatorUser: any
  let convention: any

  beforeAll(async () => {
    const ts = Date.now()
    const adminEmail = `admin-mig-${ts}@ex.com`
    adminUser = await prismaTest.user.create({
      data: {
        email: adminEmail,
        emailHash: getEmailHash(adminEmail),
        password: await bcrypt.hash('X', 10),
        pseudo: `admin-mig-${ts}`,
        nom: 'A',
        prenom: 'B',
        isEmailVerified: true,
      },
    })
    const moderatorEmail = `mod-mig-${ts}@ex.com`
    moderatorUser = await prismaTest.user.create({
      data: {
        email: moderatorEmail,
        emailHash: getEmailHash(moderatorEmail),
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
    // Organisateur ADMINISTRATOR sans droits booléens
    await prismaTest.conventionOrganizer.create({
      data: {
        conventionId: convention.id,
        userId: adminUser.id,
        // role supprimé
        addedById: adminUser.id,
      },
    })
    // Organisateur MODERATOR
    await prismaTest.conventionOrganizer.create({
      data: {
        conventionId: convention.id,
        userId: moderatorUser.id,
        // role supprimé
        addedById: adminUser.id,
      },
    })
  })

  it('applique les droits et crée historique', async () => {
    // Dry-run: ne change rien
    const dryOut = execSync('npx tsx scripts/migrate-organizer-rights.ts --dry', {
      encoding: 'utf8',
    })
    expect(dryOut).toContain('Plan')

    // Exécution réelle (forcer confirmation avec --yes)
    const realOut = execSync('npx tsx scripts/migrate-organizer-rights.ts --yes', {
      encoding: 'utf8',
    })
    expect(realOut).toContain('Organisateurs ajustés')

    const organizers = await prismaTest.conventionOrganizer.findMany({
      where: { conventionId: convention.id },
      orderBy: { id: 'asc' },
    })
    const admin = organizers.find((c) => c.userId === adminUser.id)!
    const mod = organizers.find((c) => c.userId === moderatorUser.id)!

    // Admin doit avoir tous les droits
    expect(admin.canEditConvention).toBe(true)
    expect(admin.canDeleteConvention).toBe(true)
    expect(admin.canManageOrganizers).toBe(true)
    expect(admin.canAddEdition).toBe(true)
    expect(admin.canEditAllEditions).toBe(true)
    expect(admin.canDeleteAllEditions).toBe(true)

    // Moderator: addEdition + editAllEditions
    expect(mod.canAddEdition).toBe(true)
    expect(mod.canEditAllEditions).toBe(true)
    expect(mod.canManageOrganizers).toBe(false)
    expect(mod.canDeleteConvention).toBe(false)

    // Historique créé
    const history = await prismaTest.organizerPermissionHistory.findMany({
      where: { conventionId: convention.id },
    })
    expect(history.length).toBeGreaterThanOrEqual(2)
    expect(history.every((h) => h.changeType === 'CREATED')).toBe(true)
  })
})
