import bcrypt from 'bcryptjs'

import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { getEmailHash } from '#server/utils/email-hash'

export default wrapApiHandler(
  async (event) => {
    // Protection : bloqué en production réelle (NUXT_ENV absent)
    // Autorisé en dev (pas de NUXT_ENV) et release/staging (NUXT_ENV='release'/'staging')
    const nuxtEnv = process.env.NUXT_ENV
    if (process.env.NODE_ENV === 'production' && !nuxtEnv) {
      throw createError({
        status: 403,
        message: "L'anonymisation n'est pas disponible en production",
      })
    }

    // Vérifier les permissions super admin
    const adminUser = await requireGlobalAdminWithDbCheck(event)

    // Préparer le hash bcrypt commun une seule fois
    const commonPasswordHash = await bcrypt.hash('password123', 10)

    // Transaction atomique
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Récupérer tous les utilisateurs NON super-admin
        const usersToAnonymize = await tx.user.findMany({
          where: { isGlobalAdmin: false },
          select: { id: true },
        })
        const userIds = usersToAnonymize.map((u) => u.id)

        // 2. Anonymiser les utilisateurs (boucle nécessaire : contraintes @unique sur email/pseudo)
        for (let i = 0; i < userIds.length; i++) {
          const idx = i + 1
          const fakeEmail = `user_${idx}@example.com`

          await tx.user.update({
            where: { id: userIds[i] },
            data: {
              email: fakeEmail,
              emailHash: getEmailHash(fakeEmail),
              pseudo: `Utilisateur_${idx}`,
              nom: `Nom_${idx}`,
              prenom: `Prenom_${idx}`,
              password: commonPasswordHash,
              phone: null,
              profilePicture: null,
            },
          })
        }

        // 3. Anonymiser les candidatures bénévoles (updateMany : pas de contrainte unique)
        const volunteerResult = await tx.editionVolunteerApplication.updateMany({
          where: { userId: { in: userIds } },
          data: {
            userSnapshotPhone: null,
            motivation: 'Motivation anonymisée',
            allergies: null,
            petsDetails: null,
            minorsDetails: null,
            vehicleDetails: null,
            companionName: null,
            avoidList: null,
            skills: null,
            experienceDetails: null,
            emergencyContactName: null,
            emergencyContactPhone: null,
          },
        })

        // 4. Anonymiser les candidatures artistes (boucle pour artistName distinct)
        const showApplications = await tx.showApplication.findMany({
          where: { userId: { in: userIds } },
          select: { id: true },
        })

        for (let i = 0; i < showApplications.length; i++) {
          await tx.showApplication.update({
            where: { id: showApplications[i].id },
            data: {
              artistName: `Artiste_${i + 1}`,
              artistBio: null,
              portfolioUrl: null,
              videoUrl: null,
              socialLinks: null,
              showDescription: 'Description anonymisée',
              technicalNeeds: null,
              accommodationNotes: null,
              departureCity: null,
            },
          })
        }

        // Nullifier le champ JSON additionalPerformers via raw SQL
        // (Prisma.DbNull non importable dans le build Nitro de production)
        if (showApplications.length > 0) {
          const placeholders = showApplications.map(() => '?').join(',')
          await tx.$executeRawUnsafe(
            `UPDATE ShowApplication SET additionalPerformers = NULL WHERE id IN (${placeholders})`,
            ...showApplications.map((s) => s.id)
          )
        }

        return {
          usersAnonymized: userIds.length,
          volunteerApplicationsAnonymized: volunteerResult.count,
          showApplicationsAnonymized: showApplications.length,
        }
      },
      { timeout: 60000 }
    )

    console.log(
      `[ADMIN] Anonymisation exécutée par ${adminUser.pseudo} (${adminUser.email}): ` +
        `${result.usersAnonymized} users, ${result.volunteerApplicationsAnonymized} volunteer apps, ` +
        `${result.showApplicationsAnonymized} show apps`
    )

    return createSuccessResponse(result, 'Anonymisation terminée avec succès')
  },
  { operationName: 'AnonymizeUsers' }
)
