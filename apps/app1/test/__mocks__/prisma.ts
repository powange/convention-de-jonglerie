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
  // Demande de revendication d'une convention par code à six chiffres.
  conventionClaimRequest: createModelMock(),
  event: createModelMock(),
  edition: createModelMock(),
  editionOrganizerPermission: createModelMock(),
  editionOrganizer: createModelMock(),
  editionOrganizerQuota: createModelMock(),
  editionVolunteerQuota: createModelMock(),
  editionArtistQuota: createModelMock(),
  editionPost: createModelMock(),
  // Frise du programme. Son absence rendait `program.get.ts` intestable — le handler échouait au
  // premier `findMany` sur un modèle inexistant du mock, ce qui explique qu'il n'avait aucun test.
  editionProgramItem: createModelMock(),
  editionPostComment: createModelMock(),
  organizerPermissionHistory: createModelMock(),
  editionVolunteerApplication: createModelMock(),
  editionVolunteerTeam: createModelMock(),
  volunteerTeam: createModelMock(),
  applicationTeamAssignment: createModelMock(),
  volunteerTimeSlot: createModelMock(),
  // Échanges de créneaux entre bénévoles. Son absence expliquait qu'AUCUN des quatre points d'API
  // d'échange n'ait de test : le handler échouait au premier accès sur un modèle inexistant du
  // mock, avant qu'aucune assertion ne s'exécute.
  volunteerSwapRequest: createModelMock(),
  volunteerNotificationGroup: createModelMock(),
  artistNotificationGroup: createModelMock(),
  artistNotificationConfirmation: createModelMock(),
  volunteerNotificationConfirmation: createModelMock(),
  volunteerAssignment: createModelMock(),
  volunteerAutoAssignRun: createModelMock(),
  volunteerAutoAssignPlan: createModelMock(),
  volunteerMeal: createModelMock(),
  volunteerMealSelection: createModelMock(),
  volunteerMealHandoutItem: createModelMock(),
  editionVolunteerHandoutItem: createModelMock(),
  editionArtistHandoutItem: createModelMock(),
  editionOrganizerHandoutItem: createModelMock(),
  eventVolunteerSettings: createModelMock(),
  // Trésorerie : lignes saisies à la main, codes d'imputation et leurs liaisons par source.
  treasuryEntry: createModelMock(),
  treasuryCode: createModelMock(),
  treasurySourceCode: createModelMock(),
  apiErrorLog: createModelMock(),
  feedback: createModelMock(),
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
  ticketingOrderItemOption: createModelMock(),
  ticketingOrderItemMeal: createModelMock(),
  ticketingTier: createModelMock(),
  ticketingQuota: createModelMock(),
  ticketingOption: createModelMock(),
  ticketingHandoutItem: createModelMock(),
  ticketingTierHandoutItem: createModelMock(),
  ticketingOptionHandoutItem: createModelMock(),
  // Les tables de liaison des quotas : un quota se rattache à un tarif, à une option ou à un
  // champ personnalisé, et chacune a son endpoint dédié — seule voie d'écriture depuis que les
  // quotas ont leur propre page.
  ticketingTierQuota: createModelMock(),
  ticketingOptionQuota: createModelMock(),
  ticketingTierCustomField: createModelMock(),
  ticketingTierCustomFieldQuota: createModelMock(),
  ticketingCounter: createModelMock(),
  // Journal des mouvements d'entrée : écrit par validate-entry et invalidate-entry.
  entryValidationLog: createModelMock(),
  externalTicketing: createModelMock(),
  // Configurations de prestataires : leurs secrets sont chiffrés en base, et les endpoints qui les
  // lisent sont ceux qu'il faut le plus tester.
  helloAssoConfig: createModelMock(),
  infomaniakConfig: createModelMock(),
  sumupConfig: createModelMock(),

  // Modèles messagerie
  conversation: createModelMock(),
  conversationParticipant: createModelMock(),
  message: createModelMock(),

  // Modèles appel à spectacles
  editionShowCall: createModelMock(),
  showApplication: createModelMock(),

  // Modèles spectacles
  show: createModelMock(),
  showAct: createModelMock(),
  showPerformance: createModelMock(),
  showArtist: createModelMock(),
  showHandoutItem: createModelMock(),
  organizerTeamAssignment: createModelMock(),
  organizerSlotAssignment: createModelMock(),
  artistHandoutItem: createModelMock(),

  // Modèles artistes
  editionArtist: createModelMock(),
  artistMealSelection: createModelMock(),

  // Repas des organisateurs
  organizerMealSelection: createModelMock(),

  // Modèles carte (zones et marqueurs)
  editionZone: createModelMock(),
  editionMarker: createModelMock(),

  // Modèles tâches
  taskGroup: createModelMock(),
  task: createModelMock(),
  taskAssignment: createModelMock(),
  taskComment: createModelMock(),
  taskChecklistItem: createModelMock(),
  taskTag: createModelMock(),
  taskTagAssignment: createModelMock(),

  // Modèles stock matériel
  stockGroup: createModelMock(),
  stockItem: createModelMock(),
  stockReservation: createModelMock(),
  stockShoppingList: createModelMock(),
  stockShoppingListItem: createModelMock(),

  // Modèle FAQ
  faqEntry: createModelMock(),

  // Modèles ateliers
  workshop: createModelMock(),
  workshopLocation: createModelMock(),
  workshopFavorite: createModelMock(),

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
  /*
   * ⚠️ `$queryRawUnsafe` MANQUAIT, et une méthode absente de ce mock ne rend pas `undefined` : elle
   * fait lever « n'est pas une fonction » au premier appel, AVANT toute assertion. Le code qui s'en
   * sert devient alors intestable, ce qui se lit à tort comme une absence de tests.
   *
   * C'est la quatrième fois de la journée que ce harnais bloque un test de cette façon — après
   * `editionProgramItem`, `volunteerSwapRequest` et les auto-imports. Quand un point d'API n'a
   * aucun test, regarder d'abord ce fichier.
   *
   * Rend un tableau vide par défaut : c'est la forme d'un `SELECT` sans résultat, celle qui ne
   * fait rien faire au code appelant.
   */
  $queryRawUnsafe: vi.fn(async () => [] as unknown[]),
}

// Reset automatique avant chaque test
beforeEach(() => {
  vi.clearAllMocks()
})

// Export de compatibilité
export const prisma = prismaMock
