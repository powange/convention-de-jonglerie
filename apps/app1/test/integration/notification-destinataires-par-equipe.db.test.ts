import { describe, it, expect } from 'vitest'

import { prismaTest } from '../setup-db'

/**
 * Le suivi d'une notification groupée aux bénévoles : par quoi on retrouve ses destinataires.
 *
 * ⚠️ RELEVÉ EN PRODUCTION le 30 septembre 2026, DOUZE fois sur une seule édition, par
 * `/check-error-logs`. `GET /api/editions/22/volunteers/notification/{id}/confirmations` répondait
 * 500 : l'organisateur ouvrait l'écran de suivi de sa notification et ne pouvait pas savoir qui
 * avait confirmé. Les douze occurrences en douze minutes disent qu'il a réessayé.
 *
 * LA CAUSE : le filtre portait sur `assignedTeams`, un champ JSON qui N'EXISTE PLUS sur
 * `EditionVolunteerApplication` — les équipes vivent dans la relation `teamAssignments` depuis le
 * passage aux `VolunteerTeam`. Prisma rejetait la requête ENTIÈRE
 * (`Unknown argument 'assignedTeams'`), pas seulement le champ. Le point d'API voisin qui ENVOIE
 * la notification avait été migré — il porte même le commentaire « utiliser la relation
 * teamAssignments au lieu du champ JSON assignedTeams » — mais celui qui relit ses destinataires
 * avait été oublié.
 *
 * ⚠️⚠️ POURQUOI UN TEST D'INTÉGRATION, ET PAS UN TEST D'ENDPOINT. Le mock central de Prisma ignore
 * le `where` : un test du handler aurait été VERT avec le champ mort, puisque rien n'aurait refusé
 * la sélection. C'est Prisma lui-même qui refuse, et seule une vraie requête le montre. Ce dépôt
 * connaît déjà exactement ce motif — voir `external-map-dependances.db.test.ts`, écrit pour une
 * relation `shows` qui n'avait jamais existé et cassait les deux requêtes d'un écran.
 */
describe.skipIf(!process.env.TEST_WITH_DB)('Destinataires d’une notification, par équipe', () => {
  it('le filtre par RELATION est accepté par Prisma', async () => {
    /*
     * 🔬 La forme retenue, et c'est celle de l'ENVOI à l'identique — pas une commodité : l'écran
     * compare les destinataires aux confirmations. Deux façons de répondre à « qui était visé ? »
     * donneraient un taux de confirmation faux, c'est-à-dire un défaut SILENCIEUX, là où celui-ci
     * au moins criait.
     */
    await expect(
      prismaTest.editionVolunteerApplication.findMany({
        take: 1,
        where: {
          status: 'ACCEPTED',
          teamAssignments: {
            some: {
              team: { name: { in: ["Check'in Gymnase"] } },
            },
          },
        },
      })
    ).resolves.toBeDefined()
  })

  it('le champ JSON `assignedTeams` n’existe sur AUCUN des deux modèles', async () => {
    /*
     * Verrouille la CAUSE plutôt que le seul symptôme : si un champ `assignedTeams` réapparaissait
     * un jour en base, ce test le signalerait et l'on saurait reconsidérer le filtre ci-dessus
     * plutôt que de découvrir l'écart par un 500 en production.
     *
     * 📍 `ApplicationTeamAssignment` est vérifié aussi : c'est là que la donnée a migré, et un
     * champ homonyme qui y apparaîtrait serait le piège suivant.
     */
    await expect(
      prismaTest.editionVolunteerApplication.findMany({
        take: 1,
        where: { assignedTeams: { array_contains: 'x' } } as never,
      })
    ).rejects.toThrow(/Unknown argument `assignedTeams`/)

    await expect(
      prismaTest.applicationTeamAssignment.findMany({
        take: 1,
        where: { assignedTeams: { array_contains: 'x' } } as never,
      })
    ).rejects.toThrow(/Unknown argument `assignedTeams`/)
  })

  it('le filtre « aucune équipe » reste valable, lui aussi', async () => {
    // L'écran des candidatures l'emploie (`teamAssignments: { none: {} }`) et il avait bien été
    // migré : on le fige pour que les deux formes de la relation restent éprouvées ensemble.
    await expect(
      prismaTest.editionVolunteerApplication.findMany({
        take: 1,
        where: { teamAssignments: { none: {} } },
      })
    ).resolves.toBeDefined()
  })
})
