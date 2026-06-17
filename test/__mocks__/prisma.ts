import { vi, beforeEach } from 'vitest'

// Mock centralisé de Prisma pour tests unitaires
const createModelMock = () => ({
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  findFirst: vi.fn(),
  findFirstOrThrow: vi.fn(),
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
  event: createModelMock(),
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
  volunteerMeal: createModelMock(),
  volunteerMealSelection: createModelMock(),
  volunteerMealHandoutItem: createModelMock(),
  editionVolunteerHandoutItem: createModelMock(),
  eventVolunteerSettings: createModelMock(),
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
  ticketingOrderItemMeal: createModelMock(),
  ticketingTier: createModelMock(),
  ticketingQuota: createModelMock(),
  ticketingOption: createModelMock(),
  ticketingHandoutItem: createModelMock(),
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
  showHandoutItem: createModelMock(),

  // Modèles artistes
  editionArtist: createModelMock(),
  artistMealSelection: createModelMock(),

  // Modèles carte (zones et marqueurs)
  editionZone: createModelMock(),
  editionMarker: createModelMock(),

  // Modèles tâches
  taskGroup: createModelMock(),
  task: createModelMock(),
  taskAssignment: createModelMock(),
  taskComment: createModelMock(),

  // Modèles stock matériel
  stockGroup: createModelMock(),
  stockItem: createModelMock(),
  stockReservation: createModelMock(),

  // Modèle FAQ
  faqEntry: createModelMock(),

  // Méthodes Prisma
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  // Implémentation par défaut : exécute le callback avec le mock comme client transactionnel
  // (forme interactive) ou résout le tableau d'opérations (forme séquentielle).
  $transaction: vi.fn((arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(prismaMock)
  ),
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
