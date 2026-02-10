import { vi, beforeEach } from 'vitest'

// Mock centralisé de Prisma pour tests unitaires
const createModelMock = () => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  count: vi.fn(),
  groupBy: vi.fn(),
  upsert: vi.fn(),
  aggregate: vi.fn(),
})

export const prismaMock = {
  // Modèles d'authentification
  user: createModelMock(),
  passwordResetToken: createModelMock(),

  // Modèles principaux
  convention: createModelMock(),
  conventionOrganizer: createModelMock(),
  edition: createModelMock(),
  editionOrganizerPermission: createModelMock(),
  editionOrganizer: createModelMock(),
  editionPost: createModelMock(),
  editionPostComment: createModelMock(),
  organizerPermissionHistory: createModelMock(),
  editionVolunteerApplication: createModelMock(),
  editionVolunteerTeam: createModelMock(),
  volunteerTeam: createModelMock(),
  applicationTeamAssignment: createModelMock(),
  volunteerTimeSlot: createModelMock(),
  volunteerNotificationGroup: createModelMock(),
  volunteerNotificationConfirmation: createModelMock(),
  volunteerAssignment: createModelMock(),
  apiErrorLog: createModelMock(),
  notification: createModelMock(),
  fcmToken: createModelMock(),

  // Modèles objets trouvés
  lostFoundItem: createModelMock(),
  lostFoundComment: createModelMock(),

  // Modèles covoiturage
  carpoolOffer: createModelMock(),
  carpoolRequest: createModelMock(),
  carpoolBooking: createModelMock(),
  carpoolPassenger: createModelMock(),
  carpoolComment: createModelMock(),
  carpoolRequestComment: createModelMock(),

  // Modèles billetterie
  ticketingOrder: createModelMock(),
  ticketingOrderItem: createModelMock(),
  ticketingTier: createModelMock(),
  ticketingQuota: createModelMock(),
  ticketingOption: createModelMock(),
  ticketingReturnableItem: createModelMock(),
  externalTicketing: createModelMock(),

  // Modèles messagerie
  conversation: createModelMock(),
  conversationParticipant: createModelMock(),
  message: createModelMock(),

  // Modèles appel à spectacles
  editionShowCall: createModelMock(),
  showApplication: createModelMock(),

  // Modèles spectacles
  show: createModelMock(),
  showArtist: createModelMock(),
  showReturnableItem: createModelMock(),

  // Modèles carte (zones et marqueurs)
  editionZone: createModelMock(),
  editionMarker: createModelMock(),

  // Méthodes Prisma
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $executeRawUnsafe: vi.fn(),
}

// Reset automatique avant chaque test
beforeEach(() => {
  vi.clearAllMocks()
})

// Export de compatibilité
export const prisma = prismaMock
