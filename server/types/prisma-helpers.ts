import type { Prisma } from '@prisma/client'

/**
 * Type pour les transactions Prisma
 * Utilisé pour typer les paramètres de transaction dans les fonctions
 */
export type PrismaTransaction = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

/**
 * Type pour les extensions d'Edition avec les champs volunteers
 * Ces champs existent dans la base de données mais ne sont pas tous dans le type Prisma généré
 */
export interface EditionWithVolunteerSettings extends Prisma.EditionGetPayload<object> {
  volunteersMode: 'INTERNAL' | 'EXTERNAL'
  volunteersExternalUrl: string | null
  volunteersAskDiet: boolean
  volunteersAskAllergies: boolean
  volunteersAskTimePreferences: boolean
  volunteersAskTeamPreferences: boolean
  volunteersAskPets: boolean
  volunteersAskMinors: boolean
  volunteersAskVehicle: boolean
  volunteersAskCompanion: boolean
  volunteersAskAvoidList: boolean
  volunteersAskSkills: boolean
  volunteersAskExperience: boolean
  volunteersAskEmergencyContact: boolean
  volunteersSetupStartDate: Date | null
  volunteersTeardownEndDate: Date | null
  volunteersAskSetup: boolean
  volunteersAskTeardown: boolean
  volunteersUpdatedAt: Date | null
}

/**
 * Type pour les where clauses courantes
 */
export type UserWhereInput = Prisma.UserWhereInput
export type EditionWhereInput = Prisma.EditionWhereInput
export type ConventionWhereInput = Prisma.ConventionWhereInput
export type VolunteerApplicationWhereInput = Prisma.EditionVolunteerApplicationWhereInput
export type CarpoolOfferWhereInput = Prisma.CarpoolOfferWhereInput
export type VolunteerNotificationConfirmationWhereInput =
  Prisma.VolunteerNotificationConfirmationWhereInput

/**
 * Type pour les données de mise à jour courantes
 */
export type UserUpdateInput = Prisma.UserUpdateInput
export type EditionUpdateInput = Prisma.EditionUpdateInput
export type ConventionUpdateInput = Prisma.ConventionUpdateInput
export type OrganizerUpdateInput = Prisma.ConventionOrganizerUpdateInput
export type CarpoolOfferUpdateInput = Prisma.CarpoolOfferUpdateInput
export type VolunteerTeamUpdateInput = Prisma.VolunteerTeamUpdateInput
export type TicketingQuotaUpdateInput = Prisma.TicketingQuotaUpdateInput

/**
 * Type pour les erreurs avec code de statut HTTP
 */
export interface HttpError extends Error {
  statusCode: number
  data?: unknown
}

/**
 * Type guard pour vérifier si une erreur est une HttpError
 */
export function isHttpError(error: unknown): error is HttpError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as HttpError).statusCode === 'number'
  )
}

/**
 * Type guard pour vérifier si une erreur a une propriété issues (Zod)
 */
export function hasIssues(error: unknown): error is { issues: unknown[] } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'issues' in error &&
    Array.isArray((error as { issues: unknown[] }).issues)
  )
}

/**
 * Type pour les snapshots de permissions dans l'historique
 */
export interface OrganizerPermissionSnapshot {
  title?: string | null
  rights: {
    canEditConvention: boolean
    canDeleteConvention: boolean
    canManageOrganizers: boolean
    canAddEdition: boolean
    canEditAllEditions: boolean
    canDeleteAllEditions: boolean
    canManageVolunteers: boolean
  }
  perEdition?: Array<{
    editionId: number
    canEdit: boolean
    canDelete: boolean
    canManageVolunteers: boolean
  }>
}

/**
 * Type pour les snapshots de suppression de organisateur
 */
export interface OrganizerRemovalSnapshot {
  removed: boolean
  removedAt: string
  removedOrganizerId: number
  removedUserId: number
}

/**
 * Type pour les snapshots d'archivage de convention
 */
export interface ConventionArchiveSnapshot {
  isArchived: boolean
  archivedAt?: Date | null
}

/**
 * Type pour les organisateurs avec permissions par édition
 */
export type OrganizerWithPermissions = Prisma.ConventionOrganizerGetPayload<{
  include: {
    user: { select: { id: true; pseudo: true } }
    perEditionPermissions: true
  }
}>

/**
 * Type pour les assignations de bénévoles au planning
 */
export interface VolunteerAssignmentData {
  timeSlotId: string
  userId: number
  assignedById: number
}

/**
 * Type pour les bénévoles dans le scheduler
 */
export interface SchedulerVolunteer {
  id: number
  name: string
  preferences: {
    timePreferences?: unknown
    teamPreferences?: number[]
    avoidList?: string[]
  }
  constraints: {
    hasPets?: boolean
    hasMinors?: boolean
    hasVehicle?: boolean
    companionName?: string
  }
}

/**
 * Type pour les créneaux horaires dans le scheduler
 */
export interface SchedulerTimeSlot {
  id: string
  teamId: string | null
  startDateTime: Date
  endDateTime: Date
  maxVolunteers: number
  assignedVolunteers: number
}

/**
 * Type pour les équipes dans le scheduler
 */
export interface SchedulerTeam {
  id: string
  name: string
  maxVolunteers: number | null
  isRequired: boolean
}

/**
 * Type pour les résultats d'assignation automatique
 */
export interface AutoAssignmentResult {
  timeSlotId: string
  userId: number
}

/**
 * Type pour les bookings de covoiturage avec statut
 */
export interface CarpoolBookingWithStatus {
  id: number
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'
  requesterId: number
  seats: number
}

/**
 * Type pour les offres de covoiturage avec bookings
 */
export interface CarpoolOfferWithBookings {
  id: number
  userId: number
  availableSeats: number
  bookings: CarpoolBookingWithStatus[]
}
