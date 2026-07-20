import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEmailHash } from '#server/utils/email-hash'
import {
  getEditionWithPermissions,
  canManageArtists,
} from '#server/utils/permissions/edition-permissions'
import { generateVolunteerQrCodeToken } from '#server/utils/token-generator'
import { validateEditionId } from '#server/utils/validation-helpers'

// Un montant réel supérieur à son plafond rendrait l'artiste inéditable : le PUT
// rejette cet état sur toute mise à jour, même sans rapport avec les montants.
const maxCoversActual = (max: number | null | undefined, actual: number | null | undefined) =>
  actual == null || max == null || actual <= max

const artistSchema = z
  .object({
    userId: z.number().int().positive().optional(),
    email: z.string().email().optional(),
    prenom: z.string().min(1).optional(),
    nom: z.string().min(1).optional(),
    arrivalDateTime: z.string().optional().nullable(),
    departureDateTime: z.string().optional().nullable(),
    dietaryPreference: z.enum(['NONE', 'VEGETARIAN', 'VEGAN']).default('NONE'),
    allergies: z.string().optional().nullable(),
    allergySeverity: z.enum(['LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL']).optional().nullable(),
    payment: z.number().nonnegative().max(100000).optional().nullable(),
    paymentPaid: z.boolean().optional(),
    reimbursementMax: z.number().nonnegative().max(100000).optional().nullable(),
    reimbursementActual: z.number().nonnegative().max(100000).optional().nullable(),
    reimbursementActualPaid: z.boolean().optional(),
    consumablesMax: z.number().nonnegative().max(100000).optional().nullable(),
    consumablesActual: z.number().nonnegative().max(100000).optional().nullable(),
    consumablesActualPaid: z.boolean().optional(),
    accommodationAutonomous: z.boolean().optional(),
    accommodationType: z.enum(['TENT', 'VEHICLE', 'HOSTED', 'OTHER']).optional().nullable(),
    accommodationTypeOther: z.string().max(500).optional().nullable(),
    accommodationProposal: z.string().optional().nullable(),
    invoiceRequested: z.boolean().optional(),
    invoiceProvided: z.boolean().optional(),
    feeRequested: z.boolean().optional(),
    feeProvided: z.boolean().optional(),
    pickupRequired: z.boolean().optional(),
    pickupLocation: z.string().optional().nullable(),
    pickupResponsibleId: z.number().int().positive().optional().nullable(),
    dropoffRequired: z.boolean().optional(),
    dropoffLocation: z.string().optional().nullable(),
    dropoffResponsibleId: z.number().int().positive().optional().nullable(),
  })
  .refine((data) => maxCoversActual(data.reimbursementMax, data.reimbursementActual), {
    message: 'Le remboursement réel ne peut pas dépasser le maximum autorisé',
  })
  .refine((data) => maxCoversActual(data.consumablesMax, data.consumablesActual), {
    message: 'Le remboursement réel des consommables ne peut pas dépasser le maximum autorisé',
  })

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const edition = await getEditionWithPermissions(editionId, {
      userId: user.id,
    })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    if (!canManageArtists(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas autorisé à gérer les artistes de cette édition",
      })
    }

    const body = await readBody(event)
    const validatedData = artistSchema.parse(body)

    let targetUserId = validatedData.userId

    // Si pas d'userId fourni, créer un nouvel utilisateur
    if (!targetUserId) {
      const missing: string[] = []
      if (!validatedData.email) missing.push('email')
      if (!validatedData.prenom) missing.push('prénom')
      if (!validatedData.nom) missing.push('nom')
      if (missing.length > 0) {
        throw createError({
          status: 400,
          message: `Champs requis manquants pour créer un nouvel utilisateur : ${missing.join(', ')}`,
        })
      }

      // Vérifier si l'utilisateur existe déjà
      const existingUser = await prisma.user.findUnique({
        where: { email: validatedData.email },
      })

      if (existingUser) {
        targetUserId = existingUser.id
      } else {
        // Créer un nouvel utilisateur
        const newUser = await prisma.user.create({
          data: {
            email: validatedData.email,
            emailHash: getEmailHash(validatedData.email),
            prenom: validatedData.prenom,
            nom: validatedData.nom,
            pseudo: `${validatedData.prenom.toLowerCase()}_${validatedData.nom.toLowerCase()}_${Date.now()}`,
            isEmailVerified: false,
            authProvider: 'MANUAL', // Utilisateur créé manuellement
          },
        })
        targetUserId = newUser.id
      }
    }

    // Vérifier si l'artiste n'est pas déjà dans l'édition
    const existingArtist = await prisma.editionArtist.findUnique({
      where: {
        editionId_userId: {
          editionId,
          userId: targetUserId,
        },
      },
    })

    if (existingArtist) {
      throw createError({
        status: 400,
        message: 'Cet utilisateur est déjà artiste pour cette édition',
      })
    }

    // Générer un token unique
    let qrCodeToken = generateVolunteerQrCodeToken()
    let isUnique = false
    let attempts = 0
    const maxAttempts = 10

    while (!isUnique && attempts < maxAttempts) {
      const existingToken = await prisma.editionArtist.findUnique({
        where: { qrCodeToken },
      })

      if (!existingToken) {
        isUnique = true
      } else {
        qrCodeToken = generateVolunteerQrCodeToken()
        attempts++
      }
    }

    if (!isUnique) {
      throw createError({
        status: 500,
        message: 'Impossible de générer un token unique',
      })
    }

    // Créer l'artiste
    const artist = await prisma.editionArtist.create({
      data: {
        editionId,
        userId: targetUserId,
        qrCodeToken,
        arrivalDateTime: validatedData.arrivalDateTime,
        departureDateTime: validatedData.departureDateTime,
        dietaryPreference: validatedData.dietaryPreference,
        allergies: validatedData.allergies,
        allergySeverity: validatedData.allergySeverity,
        payment: validatedData.payment,
        paymentPaid: validatedData.paymentPaid ?? false,
        reimbursementMax: validatedData.reimbursementMax,
        reimbursementActual: validatedData.reimbursementActual,
        reimbursementActualPaid: validatedData.reimbursementActualPaid ?? false,
        consumablesMax: validatedData.consumablesMax,
        consumablesActual: validatedData.consumablesActual,
        consumablesActualPaid: validatedData.consumablesActualPaid ?? false,
        accommodationAutonomous: validatedData.accommodationAutonomous ?? false,
        accommodationType: validatedData.accommodationType,
        accommodationTypeOther: validatedData.accommodationTypeOther,
        accommodationProposal: validatedData.accommodationProposal,
        invoiceRequested: validatedData.invoiceRequested ?? false,
        invoiceProvided: validatedData.invoiceProvided ?? false,
        feeRequested: validatedData.feeRequested ?? false,
        feeProvided: validatedData.feeProvided ?? false,
        pickupRequired: validatedData.pickupRequired ?? false,
        pickupLocation: validatedData.pickupLocation,
        pickupResponsibleId: validatedData.pickupResponsibleId,
        dropoffRequired: validatedData.dropoffRequired ?? false,
        dropoffLocation: validatedData.dropoffLocation,
        dropoffResponsibleId: validatedData.dropoffResponsibleId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            prenom: true,
            nom: true,
            phone: true,
          },
        },
        shows: true,
      },
    })

    return createSuccessResponse({ artist })
  },
  { operationName: 'CreateArtist' }
)
