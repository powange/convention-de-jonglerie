import { createHash } from 'node:crypto'

import { z } from 'zod'

import { placesOccupees } from '../../../../utils/places-creneau'

import type { Prisma } from '#server/types/prisma'
import type { PrismaTransaction } from '#server/types/prisma-helpers'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { creneauxConcernes, empreinteDesAffectations } from '#server/utils/empreinte-affectations'
import { createLogger } from '#server/utils/logger'
import { userWithNameSelect } from '#server/utils/prisma-select-helpers'
import { createRateLimiter } from '#server/utils/rate-limiter'
import { validateEditionId } from '#server/utils/validation-helpers'
import {
  VolunteerScheduler,
  type Assignment,
  type SchedulingResult,
} from '#server/utils/volunteer-scheduler'
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
    assignments: { select: { userId: true; source: true } }
    // Un organisateur occupe une place comme un bénévole : le schéma le dit, et les deux
    // endpoints d'affectation manuelle le respectent déjà. Sans ce décompte, l'assignation
    // automatique était le seul chemin d'écriture à sur-remplir les créneaux qu'ils tiennent.
    _count: { select: { organizerAssignments: true } }
  }
}>

type Team = Prisma.VolunteerTeamGetPayload<object>

/**
 * Ce qu'une application a réellement écrit.
 *
 * L'endpoint ne rendait que l'identifiant du journal, et l'écran affichait « 0 affectation
 * effacée » — codé en dur, faute de connaître le chiffre. Un organisateur qui venait d'en effacer
 * cinquante lisait donc zéro, sur l'encart même qui lui propose d'annuler.
 */
interface BilanApplication {
  journalId: string
  creees: number
  effacees: number
}

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

/**
 * Pourquoi ce calcul reste SYNCHRONE, et ce qu'il faudrait pour en changer.
 *
 * La question s'est posée : fallait-il rendre un identifiant de tâche et faire interroger
 * l'avancement par le client ? Les mesures disent non, et c'est sur elles qu'on tranche.
 *
 * Avant l'indexation du planificateur — 4 min 42 pour 200 bénévoles et 300 créneaux —, la réponse
 * aurait été oui sans hésiter : aucun proxy ne laisse passer cela. Après :
 *
 * | Édition            | Durée du calcul |
 * | ------------------ | --------------- |
 * | 50 bénévoles × 60  | 0,5 s           |
 * | 100 × 150          | 1,9 s           |
 * | 200 × 300          | 7,8 s           |
 *
 * Sept secondes tiennent dans tous les délais de proxy usuels, et l'application ne recalcule plus
 * rien depuis qu'elle relit le plan conservé. L'asynchrone coûterait un modèle de tâche, un
 * endpoint d'avancement, une reprise après incident et un écran d'attente — pour un problème que
 * les mesures ne montrent plus.
 *
 * **Ce qui ferait rouvrir la question** : une édition qui dépasserait nettement 300 créneaux, ou
 * un ajout de contrainte qui remettrait du quadratique dans le score. Le test « coût du calcul »
 * de `volunteer-scheduler.test.ts` est là pour prévenir du second cas.
 */

/**
 * Le calcul est cher : il lit toutes les données bénévoles de l'édition et fait tourner un
 * algorithme dont le coût croît vite avec le nombre de créneaux. Un doigt resté sur le bouton
 * « Aperçu » suffisait à occuper le serveur.
 *
 * La clé est l'utilisateur ET l'édition, pas l'adresse IP : deux organisateurs derrière le même
 * réseau travaillent souvent ensemble, la veille de l'événement, et ne doivent pas se gêner.
 */
const limiteurCalcul = createRateLimiter({
  windowMs: 60 * 1000,
  max: import.meta.dev || process.env.E2E_TEST === 'true' ? 100 : 10,
  message: 'Trop de calculs demandés coup sur coup, patientez une minute',
  keyGenerator: (event) =>
    `auto-assign:${event.context.user?.id ?? 'anonyme'}:${event.context.params?.id ?? '?'}`,
})

/**
 * Les éditions dont un calcul est en cours d'application.
 *
 * Rien n'empêchait deux organisateurs d'appliquer en même temps : A efface, B efface, A écrit son
 * plan, B écrit le sien, et les deux se mélangent — chacun ayant lu des places occupées que
 * l'autre venait de changer.
 *
 * Un verrou en mémoire, et il faut savoir ce qu'il vaut : il protège un processus, pas une flotte.
 * Fermer vraiment demanderait un verrou en base, que Prisma n'exprime qu'en SQL brut — c'est le
 * même choix, et la même limite, que pour les affectations manuelles (`places-creneau.ts`). Le
 * `skipDuplicates` de l'écriture reste donc le dernier filet.
 */
const applicationsEnCours = new Set<number>()

// Schéma de validation pour les contraintes
const constraintsSchema = z.object({
  maxHoursPerVolunteer: z.number().min(1).max(24).optional(),
  minHoursPerVolunteer: z.number().min(0).max(12).optional(),
  maxHoursPerDay: z.number().min(1).max(12).optional(),
  minHoursPerDay: z.number().min(0).max(8).optional(),
  balanceTeams: z.boolean().optional(),
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

/** Combien de temps un plan calculé reste proposable. Au-delà, l'édition a probablement changé. */
const DUREE_DE_VIE_DU_PLAN_MS = 30 * 60 * 1000

/**
 * L'empreinte des données qui ont produit un plan.
 *
 * Elle ne cherche pas à décrire l'édition, seulement à changer dès que quelque chose change : un
 * créneau ajouté ou déplacé, une candidature acceptée, une affectation posée à la main. C'est
 * exactement ce qui invaliderait le plan montré à l'organisateur.
 */
function empreinteDesDonnees(entrees: {
  creneaux: {
    id: string
    startDateTime: Date
    endDateTime: Date
    maxVolunteers: number
    teamId: string | null
  }[]
  candidatures: { id: number }[]
  affectations: { timeSlotId: string; userId: number; source: string }[]
  organisateurs: number
  /**
   * Les équipes et leur statut.
   *
   * ⚠️ Elles n'y figuraient pas, et c'était un trou béant : le PÉRIMÈTRE du calcul — ce qu'il a le
   * droit d'effacer — dépend de ce statut, puisqu'une équipe volante ou autonome voit ses créneaux
   * écartés. Une équipe basculée en autonome entre l'aperçu et l'application ne changeait donc pas
   * l'empreinte ; le plan s'appliquait avec le périmètre de l'aperçu, et effaçait des créneaux que
   * le calcul ne sait plus repeupler.
   *
   * Autrement dit, la garde posée pour que le plan validé soit celui qui est écrit rouvrait le
   * tout premier bug corrigé sur ce module. Le `teamId` de chaque créneau est là pour la même
   * raison : déplacer un créneau vers une équipe autonome a exactement le même effet.
   */
  equipes: { id: string; isFloatingTeam: boolean; isAutonomousTeam: boolean }[]
}): string {
  const matiere = JSON.stringify({
    creneaux: entrees.creneaux
      .map(
        (c) =>
          `${c.id}:${c.startDateTime.getTime()}:${c.endDateTime.getTime()}:${c.maxVolunteers}:${c.teamId ?? ''}`
      )
      .sort(),
    candidatures: entrees.candidatures.map((c) => c.id).sort(),
    affectations: entrees.affectations.map((a) => `${a.timeSlotId}:${a.userId}:${a.source}`).sort(),
    organisateurs: entrees.organisateurs,
    equipes: entrees.equipes
      .map((e) => `${e.id}:${e.isFloatingTeam ? 1 : 0}:${e.isAutonomousTeam ? 1 : 0}`)
      .sort(),
  })

  return createHash('sha256').update(matiere).digest('hex')
}

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
      select: {
        id: true,
        startDate: true,
        endDate: true,
        // Le fuseau vit sur l'édition, pas sur l'événement. Toutes les heures du moteur s'y
        // lisent : sans lui, « 23 h 30 » se comprend dans le fuseau du conteneur, c'est-à-dire
        // UTC, et un créneau de soirée est compté sur le jour précédent.
        edition: { select: { timezone: true } },
      },
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

    await limiteurCalcul(event)

    // Lecture et validation du body
    const body = await readBody(event)

    /**
     * Applique-t-on un plan déjà calculé ?
     *
     * Connu dès ici, et c'est utile : dans ce cas le planificateur ne tourne pas, donc ni les
     * spectacles ni son indexation ne servent à quoi que ce soit. L'empreinte, elle, reste
     * calculée dans les deux cas — c'est elle qui protège l'application.
     */
    const appliqueUnPlanConserve =
      body.applyAssignments === true && typeof body.planId === 'string' && Boolean(body.planId)
    const constraints = constraintsSchema.parse(body.constraints || {})

    /**
     * Les réglages retenus deviennent ceux de l'édition.
     *
     * Enregistrés ici, et non par un bouton « enregistrer » : personne ne règle des contraintes
     * pour ensuite renoncer à les utiliser — lancer le calcul EST la validation. Un bouton de
     * plus n'aurait fait qu'ajouter l'oubli de cliquer dessus.
     *
     * Et enregistrés côté serveur plutôt que par un second appel du navigateur : c'est l'objet
     * déjà validé qui part en base, donc exactement celui qui a produit le résultat. Deux
     * requêtes auraient permis qu'elles divergent.
     *
     * Un échec n'interrompt pas le calcul : l'organisateur attend son planning, pas la
     * confirmation que ses curseurs ont été mémorisés.
     */
    memoriserLesReglages(editionId, constraints)

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
          // Seuls `userId` et `source` sont lus ici : charger l'objet User entier pour chaque
          // affectation de chaque créneau ne servait à rien.
          assignments: { select: { userId: true, source: true } },
          _count: { select: { organizerAssignments: true } },
        },
      }),

      // Équipes
      prisma.volunteerTeam.findMany({
        where: { eventId: editionId },
      }),

      // Programmation des spectacles : l'algorithme refuse de priver un bénévole du dernier
      // passage de l'un d'eux. Le layer ne connaît pas la notion de spectacle, d'où le port.
      // Le port n'est interrogé que si le calcul doit tourner : appliquer un plan conservé n'a
      // que faire de la programmation des spectacles.
      appliqueUnPlanConserve
        ? Promise.resolve([])
        : useVolunteerPorts().artists.getShowSchedule(editionId),
    ])

    /**
     * L'état des données au moment du calcul, réduit à une empreinte.
     *
     * Elle sera revérifiée au moment d'appliquer : si elle a bougé, c'est que quelqu'un a touché
     * au planning depuis l'aperçu, et le plan validé ne décrit plus l'édition.
     */
    const empreinte = empreinteDesDonnees({
      creneaux: timeSlots.map((slot: TimeSlotWithAssignments) => ({
        id: slot.id,
        startDateTime: slot.startDateTime,
        endDateTime: slot.endDateTime,
        maxVolunteers: slot.maxVolunteers,
        teamId: slot.teamId,
      })),
      candidatures: volunteers.map((volunteer: VolunteerWithTeamAssignments) => ({
        id: volunteer.id,
      })),
      affectations: timeSlots.flatMap((slot: TimeSlotWithAssignments) =>
        slot.assignments.map((assignment) => ({
          timeSlotId: slot.id,
          userId: assignment.userId,
          source: assignment.source,
        }))
      ),
      organisateurs: timeSlots.reduce(
        (total: number, slot: TimeSlotWithAssignments) => total + slot._count.organizerAssignments,
        0
      ),
      // Le statut d'équipe décide du périmètre : il doit peser dans l'empreinte comme le reste.
      equipes: teams.map((equipe: Team) => ({
        id: equipe.id,
        isFloatingTeam: equipe.isFloatingTeam,
        isAutonomousTeam: equipe.isAutonomousTeam,
      })),
    })

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

    /**
     * Les affectations que le calcul conserve, et qu'il doit donc prendre en compte.
     *
     * Elles étaient traitées par l'exclusion : tout bénévole ayant une affectation conservée
     * sortait du calcul. Un bénévole placé à la main sur un seul créneau de deux heures ne
     * recevait donc jamais les heures qui lui manquaient — et c'est précisément le cas courant,
     * l'organisateur posant quelques affectations avant de lancer le calcul pour compléter.
     *
     * Le vrai besoin était de partir de leur charge existante, pas de les écarter : ces
     * affectations pèsent dans leurs heures, occupent leur temps et ferment les spectacles
     * qu'elles recouvrent, sans jamais être remises en cause.
     */
    const affectationsConservees = timeSlots.flatMap((slot: TimeSlotWithAssignments) =>
      slot.assignments.filter(conservee).map((assignment) => ({
        volunteerId: assignment.userId,
        slotId: slot.id,
        start: slot.startDateTime.toISOString(),
        end: slot.endDateTime.toISOString(),
      }))
    )

    // Conversion des données pour l'algorithme
    const schedulerVolunteers = benevolesPlanifiables.map(
      (volunteer: VolunteerWithTeamAssignments) => ({
        user: volunteer.user,
        // Un objet, et non plus une chaîne JSON que le moteur désérialisait à chaque évaluation
        // de score. `timePreferences` est un `Json?` en base : on ne garde que ce qui est bien un
        // tableau, plutôt que de laisser le moteur s'en méfier à chaque lecture.
        availability: {
          setup: volunteer.setupAvailability || false,
          teardown: volunteer.teardownAvailability || false,
          event: volunteer.eventAvailability || false,
          timePreferences: Array.isArray(volunteer.timePreferences)
            ? (volunteer.timePreferences as string[])
            : null,
        },
        teamPreferences: volunteer.teamPreferences
          ? Array.isArray(volunteer.teamPreferences)
            ? volunteer.teamPreferences
            : []
          : [],
        // Les équipes où les organisateurs ont déjà placé ce bénévole, sous la même forme que
        // les préférences : des identifiants d'équipe, comparables au `teamId` d'un créneau.
        assignedTeams: volunteer.teamAssignments.map((assignation) => assignation.teamId),
        // Quand il arrive et quand il repart : le calcul ne lui proposera rien en dehors.
        arrivalDateTime: volunteer.arrivalDateTime,
        departureDateTime: volunteer.departureDateTime,
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
        /**
         * Les places occupées, tous titres confondus.
         *
         * Seules les affectations qui survivent comptent — et les organisateurs, qui occupent
         * une place comme un bénévole. Le décompte passe par `placesOccupees`, la règle que les
         * deux endpoints d'affectation manuelle appliquent déjà : la recopier ici une troisième
         * fois est exactement ce qui avait produit l'écart.
         */
        assignedVolunteers: placesOccupees({
          maxVolunteers: slot.maxVolunteers,
          _count: {
            assignments: slot.assignments.filter(conservee).length,
            organizerAssignments: slot._count.organizerAssignments,
          },
        }),
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
      candidatures: benevolesPlanifiables.map((volunteer: VolunteerWithTeamAssignments) => ({
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
      // L'effectif souhaité : un indicateur pour le moteur, pas un plafond.
      maxVolunteers: team.maxVolunteers,
    }))

    // Exécution de l'algorithme
    // Construit seulement quand il sert : son constructeur indexe tous les créneaux, calcule
    // toutes les durées, tous les jours locaux et toutes les fenêtres de présence.
    const scheduler = appliqueUnPlanConserve
      ? null
      : new VolunteerScheduler({
          volunteers: schedulerVolunteers,
          timeSlots: schedulerTimeSlots,
          teams: schedulerTeams,
          constraints,
          bornes: {
            debut: eventRecord.startDate?.toISOString() ?? null,
            fin: eventRecord.endDate?.toISOString() ?? null,
          },
          spectacles,
          affectationsExistantes: affectationsConservees,
          fuseau: eventRecord.edition?.timezone ?? null,
        })

    /**
     * Appliquer, c'est écrire le plan QU'ON A MONTRÉ — pas en recalculer un autre.
     *
     * Quand le client renvoie l'identifiant de l'aperçu qu'il a validé, c'est ce plan-là qui est
     * relu et écrit, après vérification que les données n'ont pas bougé. Sans identifiant, on
     * retombe sur l'ancien comportement : un appel écrit avant cette évolution continue de
     * fonctionner, et un script qui applique directement reste possible.
     *
     * ⚠️ Et dans ce cas, **l'algorithme n'est pas relancé**. Il l'était, pour produire une
     * réponse dont le contenu était aussitôt remplacé par le plan conservé : sur une édition de
     * deux cents bénévoles, cela faisait plusieurs secondes de calcul pour rien, à chaque
     * application.
     */
    let result: SchedulingResult | null = scheduler ? scheduler.assignVolunteers() : null

    let planRetenu = result?.assignments ?? []
    let perimetreRetenu = perimetre

    if (appliqueUnPlanConserve) {
      const plan = await prisma.volunteerAutoAssignPlan.findFirst({
        where: { id: body.planId, eventId: editionId },
      })

      if (!plan) {
        throw createError({
          status: 404,
          message: "Cet aperçu n'existe plus : relancez le calcul",
        })
      }

      if (plan.appliedAt) {
        throw createError({
          status: 409,
          message: 'Cet aperçu a déjà été appliqué',
        })
      }

      if (plan.expiresAt.getTime() < Date.now()) {
        throw createError({
          status: 409,
          message: 'Cet aperçu a trop vieilli : relancez le calcul pour voir l’état actuel',
        })
      }

      if (plan.fingerprint !== empreinte) {
        throw createError({
          status: 409,
          message:
            'Le planning a changé depuis cet aperçu : relancez le calcul avant de l’appliquer',
        })
      }

      planRetenu = plan.assignments as unknown as Assignment[]
      perimetreRetenu = plan.perimetre as unknown as PerimetreDuCalcul
      // Le résultat montré à l'organisateur, conservé avec le plan : la réponse le rend tel quel
      // plutôt que de le recalculer.
      result = (plan.resultat as unknown as typeof result) ?? null
    }

    if (!result) {
      // Un plan conservé avant l'ajout de `resultat`, ou une réponse vide : on rend au moins ce
      // qui a été écrit, plutôt que de relancer un calcul de plusieurs secondes pour l'affichage.
      result = {
        assignments: planRetenu,
        unassigned: { volunteers: [], slots: [] },
        stats: {
          totalAssignments: planRetenu.length,
          averageHoursPerVolunteer: 0,
          satisfactionRate: 0,
          balanceScore: 0,
        },
        warnings: [],
        recommendations: [],
        refus: { parBenevole: [], parCreneau: [] },
      }
    }

    // Application des assignations en base de données si demandé
    let bilan: BilanApplication | null = null
    if (body.applyAssignments === true) {
      if (applicationsEnCours.has(editionId)) {
        throw createError({
          status: 409,
          message: "Un calcul est déjà en cours d'application sur cette édition",
        })
      }

      applicationsEnCours.add(editionId)
      try {
        bilan = await applyAssignments(
          editionId,
          planRetenu,
          user.id,
          mode,
          perimetreRetenu,
          constraints
        )

        if (typeof body.planId === 'string' && body.planId) {
          await prisma.volunteerAutoAssignPlan.update({
            where: { id: body.planId },
            data: { appliedAt: new Date() },
          })
        }
      } finally {
        // `finally` et non après l'appel : une transaction qui échoue ne doit pas laisser
        // l'édition verrouillée jusqu'au prochain redémarrage.
        applicationsEnCours.delete(editionId)
      }
    }

    /**
     * Ce que l'application effacerait, montré AVANT de le faire.
     *
     * L'aperçu listait ce qui serait créé, les statistiques et les non-assignés — jamais ce qui
     * serait détruit. En mode « tout effacer », c'était pourtant l'information la plus importante
     * de l'écran, et la seule absente.
     *
     * Relevé uniquement pour l'aperçu : l'application, elle, consigne déjà ce qu'elle efface dans
     * son journal.
     */
    let suppressionsPrevues: {
      timeSlotId: string
      userId: number
      source: string
      pseudo: string | null
    }[] = []

    if (body.applyAssignments !== true && mode !== 'keep-all') {
      const aEffacer = await prisma.volunteerAssignment.findMany({
        where: {
          timeSlotId: { in: perimetre.creneaux },
          ...(mode === 'keep-manual' ? { source: 'AUTO' as const } : {}),
        },
        select: {
          timeSlotId: true,
          userId: true,
          source: true,
          user: { select: { pseudo: true } },
        },
      })

      suppressionsPrevues = aEffacer.map((affectation) => ({
        timeSlotId: affectation.timeSlotId,
        userId: affectation.userId,
        source: affectation.source,
        pseudo: affectation.user?.pseudo ?? null,
      }))
    }

    /**
     * Un aperçu se conserve, pour que l'application puisse écrire exactement ce qui a été montré.
     * L'identifiant revient au client, qui le renverra en appliquant.
     */
    let planId: string | null = null
    if (body.applyAssignments !== true) {
      await purgerLesApercusPerimes()

      const plan = await prisma.volunteerAutoAssignPlan.create({
        data: {
          eventId: editionId,
          createdById: user.id,
          expiresAt: new Date(Date.now() + DUREE_DE_VIE_DU_PLAN_MS),
          fingerprint: empreinte,
          mode,
          constraints: constraints as Prisma.InputJsonValue,
          assignments: result.assignments as unknown as Prisma.InputJsonValue,
          perimetre: perimetre as unknown as Prisma.InputJsonValue,
          resultat: result as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      })
      planId = plan.id
    }

    return createSuccessResponse({
      result,
      preview: body.applyAssignments !== true, // Indique si c'est un aperçu ou une application
      // L'identifiant du journal : c'est lui qui permet de proposer d'annuler ce calcul.
      journalId: bilan?.journalId ?? null,
      // Ce que l'application a réellement écrit — y compris ce qu'elle a effacé, que l'écran
      // annonçait jusqu'ici toujours à zéro.
      creees: bilan?.creees ?? 0,
      effacees: bilan?.effacees ?? 0,
      // L'identifiant de l'aperçu : à renvoyer pour appliquer exactement ce plan-ci.
      planId,
      // Ce que l'application effacerait : à montrer avant, pas à découvrir après.
      suppressionsPrevues,
    })
  },
  { operationName: 'AutoAssignVolunteers' }
)

/**
 * Applique les assignations en base de données, et consigne de quoi les défaire.
 *
 * Rend l'identifiant du journal écrit : c'est lui que l'écran présentera pour proposer d'annuler.
 */
/**
 * Conserve sur l'édition les réglages qui viennent de servir.
 *
 * Volontairement non attendu par l'appelant : c'est une commodité, pas une étape du calcul. Le
 * `catch` est donc obligatoire — une promesse rejetée sans gestionnaire fait tomber le processus
 * Node entier, ce qui transformerait un échec d'écriture bénin en panne de l'application.
 */
function memoriserLesReglages(editionId: number, contraintes: unknown): void {
  // `upsert` et non `update` : la ligne existe normalement, mais `update` lèverait une P2025 sur
  // une édition qui n'a jamais ouvert ses réglages bénévoles — et les contraintes n'y seraient
  // alors jamais conservées, silencieusement.
  prisma.eventVolunteerSettings
    .upsert({
      where: { eventId: editionId },
      update: {
        autoAssignConstraints: contraintes as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
      create: {
        eventId: editionId,
        autoAssignConstraints: contraintes as Prisma.InputJsonValue,
      },
    })
    .catch((error) => {
      log.warn('Réglages d’assignation non mémorisés', { edition: editionId, error })
    })
}

/**
 * Efface les aperçus qui ne servent plus à rien.
 *
 * Chaque aperçu conserve le plan, le périmètre et le résultat complet : sur une grosse édition,
 * plusieurs centaines de kilo-octets de JSON. Rien ne les effaçait, et un organisateur qui règle
 * ses contraintes en produit une dizaine avant d'en appliquer un seul. La table ne faisait que
 * grossir, pour des lignes qu'aucun code ne relira jamais.
 *
 * Passé `expiresAt`, l'endpoint refuse d'appliquer le plan — c'est donc la borne de son utilité,
 * appliqué ou non. Les lignes déjà appliquées sont emportées par la même vague trente minutes
 * plus tard, ce qui laisse à l'organisateur qui reclique le message précis (« déjà appliqué »)
 * plutôt qu'un « n'existe plus » approximatif.
 *
 * Toutes éditions confondues : l'index sur `expiresAt` rend la requête aussi peu coûteuse, et une
 * édition peu active n'a pas à attendre qu'on y relance un calcul pour être nettoyée.
 *
 * Un échec ici ne doit pas faire échouer le calcul : l'organisateur attend son aperçu, pas notre
 * ménage.
 */
async function purgerLesApercusPerimes(): Promise<void> {
  try {
    const { count } = await prisma.volunteerAutoAssignPlan.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })

    if (count > 0) {
      log.info('Aperçus d’assignation périmés effacés', { nombre: count })
    }
  } catch (error) {
    log.warn('Purge des aperçus d’assignation impossible', { error })
  }
}

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
): Promise<BilanApplication> {
  return await prisma.$transaction(
    async (tx) => {
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

      /**
       * 2. Créer les nouvelles affectations — en deux requêtes, pas en deux par affectation.
       *
       * Il y avait ici un `findFirst` puis un `create` PAR affectation. Sur une édition de deux
       * cents bénévoles, cela faisait des milliers d'allers-retours dans une transaction dont le
       * délai par défaut est de cinq secondes : l'échec était probable, et il survenait après la
       * suppression, donc après que l'organisateur avait validé.
       */
      const dejaEnPlace = new Set(
        mode === 'replace-all'
          ? []
          : (
              await tx.volunteerAssignment.findMany({
                where: {
                  timeSlotId: { in: assignments.map((assignment) => assignment.slotId) },
                  userId: { in: assignments.map((assignment) => assignment.volunteerId) },
                },
                select: { timeSlotId: true, userId: true },
              })
            ).map((ligne) => `${ligne.timeSlotId}:${ligne.userId}`)
      )

      const affectationsCreees = assignments
        .map((assignment) => ({
          timeSlotId: assignment.slotId,
          userId: assignment.volunteerId,
        }))
        .filter((ligne) => !dejaEnPlace.has(`${ligne.timeSlotId}:${ligne.userId}`))

      if (affectationsCreees.length > 0) {
        const pose = new Date()
        await tx.volunteerAssignment.createMany({
          data: affectationsCreees.map((ligne) => ({
            ...ligne,
            assignedById: userId,
            assignedAt: pose,
            source: 'AUTO' as const,
          })),
          // Un dernier filet : deux organisateurs qui appliquent en même temps liraient le même
          // état. Le verrou d'édition rend le cas très improbable, l'unicité le rend impossible.
          skipDuplicates: true,
        })
      }

      // 3. Assigner les bénévoles aux équipes correspondantes
      const equipes = await assignVolunteersToTeams(tx, assignments, mode, perimetre)

      /**
       * 4. Relever l'état laissé derrière soi, sur les seuls créneaux touchés.
       *
       * C'est cette empreinte que l'annulation comparera avant de défaire quoi que ce soit. Elle
       * est prise ici, dans la transaction, et pas après : entre le commit et une lecture
       * ultérieure, un organisateur peut déjà avoir posé une affectation, qui serait alors
       * consignée comme faisant partie du résultat du calcul.
       */
      const creneauxTouches = creneauxConcernes(affectationsCreees, affectationsEffacees)
      const etatApres = await tx.volunteerAssignment.findMany({
        where: { timeSlotId: { in: creneauxTouches } },
        select: { timeSlotId: true, userId: true, source: true },
      })

      // 5. Consigner le calcul, et de quoi le défaire
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
          empreinteApres: empreinteDesAffectations(etatApres),
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

      return {
        journalId: journal.id,
        creees: affectationsCreees.length,
        effacees: affectationsEffacees.length,
      }
    },
    /**
     * Le délai par défaut de Prisma est de cinq secondes, et rien ne le disait ici.
     *
     * Une application sur une grosse édition écrit des centaines de lignes : le N+1 supprimé
     * ci-dessus la ramène à une poignée de requêtes, mais une base chargée reste une base
     * chargée. Une minute laisse la place nécessaire sans transformer un blocage en attente
     * indéfinie — et l'échec, s'il survient, annule tout plutôt que de laisser un planning à
     * moitié écrit.
     */
    { timeout: 60_000, maxWait: 10_000 }
  )
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
