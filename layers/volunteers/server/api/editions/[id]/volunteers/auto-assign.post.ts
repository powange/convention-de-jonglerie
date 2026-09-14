import { z } from 'zod'

import type { Prisma } from '#server/types/prisma'
import type { PrismaTransaction } from '#server/types/prisma-helpers'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { createLogger } from '#server/utils/logger'
import { userWithNameSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { VolunteerScheduler, type Assignment } from '#server/utils/volunteer-scheduler'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'
import {
  estEquipeHorsCharge,
  estHorsAssignationAutomatique,
} from '~~/shared/utils/benevoles-volants'

// Types pour les données récupérées de la base de données
type VolunteerWithTeamAssignments = Prisma.EditionVolunteerApplicationGetPayload<{
  include: {
    user: { select: typeof userWithNameSelect }
    teamAssignments: { include: { team: true } }
  }
}>

type TimeSlotWithAssignments = Prisma.VolunteerTimeSlotGetPayload<{
  include: {
    assignments: { include: { user: true } }
  }
}>

type Team = Prisma.VolunteerTeamGetPayload<object>

/**
 * Ce que le calcul a examiné, et donc ce qu'il saura reconstruire.
 *
 * Sert de borne à tout ce que l'application efface. Les filtres d'entrée écartent des créneaux,
 * des bénévoles et des équipes ; sans ce périmètre, les suppressions, elles, portaient sur
 * l'édition entière — elles détruisaient donc ce que le calcul ne repeuplerait jamais.
 */
interface PerimetreDuCalcul {
  /** Les créneaux soumis au planificateur. */
  creneaux: string[]
  /** Les candidatures en lice, et l'utilisateur derrière chacune. */
  candidatures: { applicationId: number; userId: number }[]
  /** Les équipes que le calcul peut pourvoir — ni volantes, ni autonomes. */
  equipes: string[]
}

/** Une affectation telle qu'elle était avant d'être effacée — de quoi la recréer à l'identique. */
interface EffacementAffectation {
  timeSlotId: string
  userId: number
  source: 'MANUAL' | 'AUTO'
  assignedById: number
  assignedAt: Date
}

/** Un rattachement d'équipe, sur le même principe. */
interface EffacementRattachement {
  applicationId: number
  teamId: string
  isLeader: boolean
  assignedAt: Date
}

const log = createLogger('ASSIGNATION-AUTO')

// Schéma de validation pour les contraintes
const constraintsSchema = z.object({
  maxHoursPerVolunteer: z.number().min(1).max(24).optional(),
  minHoursPerVolunteer: z.number().min(0).max(12).optional(),
  maxHoursPerDay: z.number().min(1).max(12).optional(),
  minHoursPerDay: z.number().min(0).max(8).optional(),
  balanceTeams: z.boolean().optional(),
  prioritizeExperience: z.boolean().optional(),
  respectStrictAvailability: z.boolean().optional(),
  respectStrictTeamPreferences: z.boolean().optional(),
  respectStrictAssignedTeams: z.boolean().optional(),
  preserverAccesSpectacles: z.boolean().optional(),
  respectStrictTimePreferences: z.boolean().optional(),
  allowOvertime: z.boolean().optional(),
  maxOvertimeHours: z.number().min(0).max(6).optional(),
  keepExistingAssignments: z.boolean().optional(),
  /**
   * Sort réservé aux affectations déjà en place :
   * - `replace-all`  : tout effacer avant de recalculer (comportement historique)
   * - `keep-all`     : ne rien effacer, ne combler que les places libres
   * - `keep-manual`  : effacer ce que l'algorithme avait posé, garder les choix humains
   *
   * L'ancien booléen reste accepté et se traduit dans ces modes, pour qu'un appel écrit
   * avant cette évolution continue de fonctionner.
   */
  existingAssignmentsMode: z.enum(['replace-all', 'keep-all', 'keep-manual']).optional(),
})

export default wrapApiHandler(
  async (event) => {
    // Vérification de l'authentification
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Étape 0bis : vérif d'existence sur l'Event (les permissions passent par le port organizer).
    // Les dates de l'événement séparent le montage de l'événement et l'événement du démontage :
    // le planificateur en a besoin pour classer chaque créneau sans se fier à son titre.
    const eventRecord = await prisma.event.findUnique({
      where: { id: editionId },
      select: { id: true, startDate: true, endDate: true },
    })

    if (!eventRecord) {
      throw createError({
        status: 404,
        statusText: 'Édition non trouvée',
      })
    }

    if (!(await useVolunteerPorts().organizers.canManage(editionId, user.id, event))) {
      throw createError({
        status: 403,
        statusText: 'Droits insuffisants pour gérer les bénévoles',
      })
    }

    // Lecture et validation du body
    const body = await readBody(event)
    const constraints = constraintsSchema.parse(body.constraints || {})

    // Récupération des données nécessaires
    const [volunteers, timeSlots, teams, spectacles] = await Promise.all([
      // Bénévoles acceptés
      prisma.editionVolunteerApplication.findMany({
        where: {
          eventId: editionId,
          status: 'ACCEPTED',
        },
        include: {
          user: {
            select: userWithNameSelect,
          },
          teamAssignments: {
            include: {
              team: true,
            },
          },
        },
      }),

      // Créneaux horaires
      prisma.volunteerTimeSlot.findMany({
        where: { eventId: editionId },
        include: {
          assignments: {
            include: {
              user: true,
            },
          },
        },
      }),

      // Équipes
      prisma.volunteerTeam.findMany({
        where: { eventId: editionId },
      }),

      // Programmation des spectacles : l'algorithme refuse de priver un bénévole du dernier
      // passage de l'un d'eux. Le layer ne connaît pas la notion de spectacle, d'où le port.
      useVolunteerPorts().artists.getShowSchedule(editionId),
    ])

    const mode =
      constraints.existingAssignmentsMode ??
      (constraints.keepExistingAssignments ? 'keep-all' : 'replace-all')

    /** Une affectation survit-elle au recalcul ? */
    const conservee = (assignment: { source?: string }) =>
      mode === 'keep-all' || (mode === 'keep-manual' && assignment.source !== 'AUTO')

    /**
     * Les volants ne sont pas planifiables, et c'est tout leur objet.
     *
     * Les laisser entrer ici leur attribuerait des créneaux pour atteindre le minimum d'heures
     * demandé à chacun — exactement l'inverse de ce qu'on attend d'eux. Le filtre est posé AVANT
     * tout le reste : un volant ne doit apparaître ni dans les candidats, ni dans les moyennes
     * que l'algorithme calcule pour équilibrer les charges.
     *
     * ⚠️ Seuls ceux qui ne sont QUE volants sortent. Un bénévole à la fois en cuisine et volant
     * reste à planifier pour sa cuisine. Voir `benevoles-volants`.
     */
    const benevolesPlanifiables = volunteers.filter(
      (volunteer: VolunteerWithTeamAssignments) =>
        !estHorsAssignationAutomatique(
          volunteer.teamAssignments.map((assignation) => assignation.team)
        )
    )

    // Les bénévoles dont une affectation subsiste occupent déjà leur place : les proposer à
    // nouveau les ferait compter deux fois.
    let availableVolunteers = benevolesPlanifiables
    if (mode !== 'replace-all') {
      const assignedVolunteerIds = new Set(
        timeSlots.flatMap((slot: TimeSlotWithAssignments) =>
          slot.assignments.filter(conservee).map((assignment) => assignment.user.id)
        )
      )
      availableVolunteers = benevolesPlanifiables.filter(
        (volunteer: VolunteerWithTeamAssignments) => !assignedVolunteerIds.has(volunteer.user.id)
      )
    }

    // Conversion des données pour l'algorithme
    const schedulerVolunteers = availableVolunteers.map(
      (volunteer: VolunteerWithTeamAssignments) => ({
        id: volunteer.id,
        user: volunteer.user,
        availability: JSON.stringify({
          setup: volunteer.setupAvailability || false,
          teardown: volunteer.teardownAvailability || false,
          event: volunteer.eventAvailability || false,
          timePreferences: volunteer.timePreferences || null,
        }),
        experience: volunteer.hasExperience
          ? volunteer.experienceDetails || 'Expérience confirmée'
          : '',
        motivation: volunteer.motivation || '',
        phone: volunteer.userSnapshotPhone,
        teamPreferences: volunteer.teamPreferences
          ? Array.isArray(volunteer.teamPreferences)
            ? volunteer.teamPreferences
            : []
          : [],
        // Les équipes où les organisateurs ont déjà placé ce bénévole, sous la même forme que
        // les préférences : des identifiants d'équipe, comparables au `teamId` d'un créneau.
        assignedTeams: volunteer.teamAssignments.map((assignation) => assignation.teamId),
      })
    )

    /**
     * Les créneaux d'une équipe volante ou autonome ne se remplissent pas tout seuls.
     *
     * L'une n'a personne à qui imposer des heures, l'autre s'organise elle-même : dans les deux
     * cas, l'assignation automatique n'a rien à y décider, et y placer des gens leur retirerait
     * la disponibilité ou l'autonomie qui justifie le réglage.
     */
    const equipesHorsCharge = new Set(
      teams.filter((equipe: Team) => estEquipeHorsCharge(equipe)).map((equipe: Team) => equipe.id)
    )

    const schedulerTimeSlots = timeSlots
      .filter(
        (slot: TimeSlotWithAssignments) => !slot.teamId || !equipesHorsCharge.has(slot.teamId)
      )
      .map((slot: TimeSlotWithAssignments) => ({
        id: slot.id.toString(),
        title: slot.title || 'Créneau sans titre',
        start: slot.startDateTime.toISOString(),
        end: slot.endDateTime.toISOString(),
        teamId: slot.teamId?.toString() || undefined,
        maxVolunteers: slot.maxVolunteers,
        // Seules les affectations qui survivent occupent une place
        assignedVolunteers: slot.assignments.filter(conservee).length,
        description: slot.description || undefined,
      }))

    /**
     * Ce que le calcul a réellement examiné — et donc, exactement, ce qu'il a le droit d'effacer.
     *
     * **La règle du fichier**, et elle tient en une phrase : ce que l'algorithme ne sait pas
     * reconstruire, il n'a pas à le détruire.
     *
     * Sans ces bornes, une relance en « tout effacer et recalculer » supprimait sur toute
     * l'édition alors que les filtres ci-dessus venaient d'en écarter une partie :
     *
     * - les créneaux des équipes volantes et autonomes étaient vidés, puis jamais repeuplés —
     *   le planificateur ne les avait pas vus ;
     * - les rattachements d'équipe posés à la main disparaissaient, et rien ne les reconstruit :
     *   ce sont des décisions humaines, dont le calcul se sert d'ailleurs pour scorer.
     *
     * Les identifiants viennent de requêtes déjà bornées à l'édition : inutile de redemander
     * `timeSlot: { eventId }` aux suppressions, qui n'y gagneraient qu'une jointure.
     */
    const perimetre = {
      creneaux: schedulerTimeSlots.map((slot) => slot.id),
      candidatures: availableVolunteers.map((volunteer: VolunteerWithTeamAssignments) => ({
        applicationId: volunteer.id,
        userId: volunteer.user.id,
      })),
      // Les équipes que le calcul peut pourvoir. Une équipe volante ou autonome n'en est pas :
      // ses créneaux sont écartés, donc aucun rattachement ne serait recréé chez elle.
      equipes: teams
        .filter((equipe: Team) => !equipesHorsCharge.has(equipe.id))
        .map((equipe: Team) => equipe.id),
    }

    const schedulerTeams = teams.map((team: Team) => ({
      id: team.id,
      name: team.name,
      color: team.color,
    }))

    // Exécution de l'algorithme
    const scheduler = new VolunteerScheduler(
      schedulerVolunteers,
      schedulerTimeSlots,
      schedulerTeams,
      constraints,
      {
        debut: eventRecord.startDate?.toISOString() ?? null,
        fin: eventRecord.endDate?.toISOString() ?? null,
      },
      spectacles
    )

    const result = scheduler.assignVolunteers()

    // Application des assignations en base de données si demandé
    let journalId: string | null = null
    if (body.applyAssignments === true) {
      journalId = await applyAssignments(
        editionId,
        result.assignments,
        user.id,
        mode,
        perimetre,
        constraints
      )
    }

    return createSuccessResponse({
      result,
      preview: body.applyAssignments !== true, // Indique si c'est un aperçu ou une application
      // L'identifiant du journal : c'est lui qui permet de proposer d'annuler ce calcul.
      journalId,
    })
  },
  { operationName: 'AutoAssignVolunteers' }
)

/**
 * Applique les assignations en base de données, et consigne de quoi les défaire.
 *
 * Rend l'identifiant du journal écrit : c'est lui que l'écran présentera pour proposer d'annuler.
 */
async function applyAssignments(
  editionId: number,
  // `Assignment[]`, la forme que produit le planificateur et que ces deux fonctions lisent
  // réellement (`slotId`, `volunteerId`). La déclaration annonçait `{ timeSlotId, userId }`,
  // des champs absents ici — le code fonctionnait, c'est le type qui décrivait autre chose.
  assignments: Assignment[],
  userId: number,
  mode: 'replace-all' | 'keep-all' | 'keep-manual',
  /** Ce que le calcul a examiné, et la borne de ce que les suppressions peuvent atteindre. */
  perimetre: PerimetreDuCalcul,
  /** Les réglages employés, consignés tels quels : la question qu'on se pose toujours en second. */
  contraintes: unknown
): Promise<string> {
  return await prisma.$transaction(async (tx) => {
    /**
     * Ce qui va disparaître est relevé AVANT de disparaître.
     *
     * C'est la seule fenêtre où l'état antérieur existe encore. Une fois le `deleteMany` passé,
     * plus rien ne dit ce qu'il y avait — et c'est précisément ce qui rendait une relance
     * malheureuse irrattrapable.
     */
    let affectationsEffacees: EffacementAffectation[] = []

    // 1. Effacer ce que le mode ne conserve pas, et seulement sur les créneaux que le calcul a
    //    examinés. En `keep-manual`, seules les affectations posées par un précédent calcul
    //    disparaissent : les choix humains restent.
    if (mode !== 'keep-all') {
      const cible = {
        timeSlotId: { in: perimetre.creneaux },
        ...(mode === 'keep-manual' ? { source: 'AUTO' as const } : {}),
      }

      affectationsEffacees = await tx.volunteerAssignment.findMany({
        where: cible,
        select: {
          timeSlotId: true,
          userId: true,
          source: true,
          assignedById: true,
          assignedAt: true,
        },
      })

      await tx.volunteerAssignment.deleteMany({ where: cible })
    }

    // 2. Créer les nouvelles assignations aux créneaux
    const affectationsCreees: { timeSlotId: string; userId: number }[] = []

    for (const assignment of assignments) {
      // Une affectation conservée peut déjà exister : la recréer violerait l'unicité
      if (mode !== 'replace-all') {
        const existing = await tx.volunteerAssignment.findFirst({
          where: {
            timeSlotId: assignment.slotId,
            userId: assignment.volunteerId,
          },
        })
        if (existing) continue // Passer si l'assignation existe déjà
      }

      await tx.volunteerAssignment.create({
        data: {
          timeSlotId: assignment.slotId,
          userId: assignment.volunteerId,
          assignedById: userId,
          assignedAt: new Date(),
          source: 'AUTO',
        },
      })

      affectationsCreees.push({
        timeSlotId: assignment.slotId,
        userId: assignment.volunteerId,
      })
    }

    // 3. Assigner les bénévoles aux équipes correspondantes
    const equipes = await assignVolunteersToTeams(tx, assignments, mode, perimetre)

    // 4. Consigner le calcul, et de quoi le défaire
    const journal = await tx.volunteerAutoAssignRun.create({
      data: {
        eventId: editionId,
        executedById: userId,
        mode,
        constraints: (contraintes ?? {}) as Prisma.InputJsonValue,
        deletedAssignments: affectationsEffacees as unknown as Prisma.InputJsonValue,
        createdAssignments: affectationsCreees as unknown as Prisma.InputJsonValue,
        deletedTeamLinks: equipes.effaces as unknown as Prisma.InputJsonValue,
        createdTeamLinks: equipes.crees as unknown as Prisma.InputJsonValue,
        createdCount: affectationsCreees.length,
        deletedCount: affectationsEffacees.length,
      },
      select: { id: true },
    })

    log.info('Assignation automatique appliquée', {
      edition: editionId,
      par: userId,
      mode,
      creees: affectationsCreees.length,
      effacees: affectationsEffacees.length,
      journal: journal.id,
    })

    return journal.id
  })
}

/**
 * Rattache les bénévoles aux équipes des créneaux qu'ils viennent de recevoir.
 *
 * Le rattachement à une équipe porte désormais son origine (`source`), comme l'affectation à un
 * créneau. C'est ce qui manquait : faute de pouvoir distinguer « l'organisateur a mis Alice en
 * cuisine » de « un calcul précédent l'y a mise », le mode « tout effacer » emportait les deux.
 */
async function assignVolunteersToTeams(
  tx: PrismaTransaction,
  // `Assignment[]`, la forme que produit le planificateur et que ces deux fonctions lisent
  // réellement (`slotId`, `volunteerId`). La déclaration annonçait `{ timeSlotId, userId }`,
  // des champs absents ici — le code fonctionnait, c'est le type qui décrivait autre chose.
  assignments: Assignment[],
  mode: 'replace-all' | 'keep-all' | 'keep-manual',
  perimetre: PerimetreDuCalcul
): Promise<{
  effaces: EffacementRattachement[]
  crees: { applicationId: number; teamId: string }[]
}> {
  // `volunteerId` est un identifiant d'utilisateur ; la table des rattachements, elle, référence
  // la CANDIDATURE. La correspondance est déjà connue du périmètre : la redemander à la base
  // coûtait une requête par bénévole, dans une transaction qui en compte déjà beaucoup.
  const candidatureDe = new Map(
    perimetre.candidatures.map(({ userId, applicationId }) => [userId, applicationId])
  )

  /**
   * En « tout effacer », retirer les rattachements qu'un calcul précédent avait posés — et
   * ceux-là seulement.
   *
   * Trois bornes, pour trois raisons distinctes :
   * - `source: AUTO` épargne les décisions humaines, que rien ne reconstruirait ;
   * - les candidatures soumises au calcul, car lui seul sait repeupler ce qu'il vide ;
   * - les équipes qu'il peut pourvoir, ce qui exclut les volantes et les autonomes : leurs
   *   créneaux sont écartés, donc aucun rattachement n'y serait recréé. Sortir un bénévole de
   *   son équipe volante le rendrait planifiable, soit exactement l'inverse du réglage.
   *
   * Une seule requête là où il y en avait une par bénévole — et surtout, l'ancienne ne visait
   * que les bénévoles ayant reçu un créneau d'équipe : deux bénévoles dans la même situation
   * s'en tiraient différemment selon ce que le calcul leur avait donné.
   */
  let effaces: EffacementRattachement[] = []

  if (mode === 'replace-all') {
    const cible = {
      applicationId: { in: perimetre.candidatures.map(({ applicationId }) => applicationId) },
      teamId: { in: perimetre.equipes },
      source: 'AUTO' as const,
    }

    // Relevé avant suppression : sans lui, l'annulation ne saurait pas quoi recréer.
    effaces = await tx.applicationTeamAssignment.findMany({
      where: cible,
      select: { applicationId: true, teamId: true, isLeader: true, assignedAt: true },
    })

    await tx.applicationTeamAssignment.deleteMany({ where: cible })
  }

  // Grouper les équipes par bénévole, puis écrire d'un coup.
  const equipesParBenevole = new Map<number, Set<string>>()

  for (const assignment of assignments) {
    if (!assignment.teamId) continue
    if (!equipesParBenevole.has(assignment.volunteerId)) {
      equipesParBenevole.set(assignment.volunteerId, new Set())
    }
    equipesParBenevole.get(assignment.volunteerId)!.add(assignment.teamId)
  }

  const aCreer: { applicationId: number; teamId: string; isLeader: boolean; source: 'AUTO' }[] = []

  for (const [volunteerId, teamIds] of equipesParBenevole) {
    const applicationId = candidatureDe.get(volunteerId)
    // Un bénévole hors du périmètre n'a pas pu recevoir de créneau : le cas ne devrait pas se
    // présenter, et on ne va certainement pas inventer un rattachement pour lui.
    if (!applicationId) continue

    for (const teamId of teamIds) {
      aCreer.push({ applicationId, teamId, isLeader: false, source: 'AUTO' })
    }
  }

  if (aCreer.length === 0) return { effaces, crees: [] }

  /**
   * Lesquels seront réellement créés ? `createMany` ne le dit pas, et l'annulation a besoin de
   * le savoir : retirer un rattachement qui préexistait détruirait une décision qu'on n'a pas
   * prise. D'où ce relevé — une requête, pas une par ligne.
   */
  const dejaLa = new Set(
    (
      await tx.applicationTeamAssignment.findMany({
        where: {
          applicationId: { in: aCreer.map((ligne) => ligne.applicationId) },
          teamId: { in: aCreer.map((ligne) => ligne.teamId) },
        },
        select: { applicationId: true, teamId: true },
      })
    ).map((ligne) => `${ligne.applicationId}:${ligne.teamId}`)
  )

  // `skipDuplicates` remplace le relevé ligne à ligne qui précédait. Il a la même conséquence,
  // et elle est voulue : un rattachement manuel que le calcul confirme n'est pas réécrit, donc
  // il garde son origine MANUAL et reste protégé de la prochaine relance.
  await tx.applicationTeamAssignment.createMany({ data: aCreer, skipDuplicates: true })

  return {
    effaces,
    crees: aCreer
      .filter((ligne) => !dejaLa.has(`${ligne.applicationId}:${ligne.teamId}`))
      .map(({ applicationId, teamId }) => ({ applicationId, teamId })),
  }
}
