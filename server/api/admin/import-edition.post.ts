import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

// Schéma de validation pour l'import
const importSchema = z.object({
  convention: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    description: z.string().nullable().optional(),
    logo: z.string().nullable().optional(),
  }),
  edition: z.object({
    name: z.string().min(1).nullable().optional(),
    description: z.string().nullable().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/),
    addressLine1: z.string().min(1),
    addressLine2: z.string().nullable().optional(),
    city: z.string().min(1),
    region: z.string().nullable().optional(),
    country: z.string().min(1),
    postalCode: z.string().min(1),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    ticketingUrl: z.string().url().or(z.literal('')).nullable().optional(),
    facebookUrl: z.string().url().or(z.literal('')).nullable().optional(),
    instagramUrl: z.string().url().or(z.literal('')).nullable().optional(),
    officialWebsiteUrl: z.string().url().or(z.literal('')).nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    // Caractéristiques booléennes
    hasFoodTrucks: z.boolean().optional(),
    hasKidsZone: z.boolean().optional(),
    acceptsPets: z.boolean().optional(),
    hasTentCamping: z.boolean().optional(),
    hasTruckCamping: z.boolean().optional(),
    hasGym: z.boolean().optional(),
    hasFamilyCamping: z.boolean().optional(),
    hasSleepingRoom: z.boolean().optional(),
    hasFireSpace: z.boolean().optional(),
    hasGala: z.boolean().optional(),
    hasOpenStage: z.boolean().optional(),
    hasConcert: z.boolean().optional(),
    hasCantine: z.boolean().optional(),
    hasAerialSpace: z.boolean().optional(),
    hasSlacklineSpace: z.boolean().optional(),
    hasToilets: z.boolean().optional(),
    hasShowers: z.boolean().optional(),
    hasAccessibility: z.boolean().optional(),
    hasWorkshops: z.boolean().optional(),
    hasCashPayment: z.boolean().optional(),
    hasCreditCardPayment: z.boolean().optional(),
    hasAfjTokenPayment: z.boolean().optional(),
    hasATM: z.boolean().optional(),
    hasLongShow: z.boolean().optional(),
    isOnline: z.boolean().optional(),
    // Champs bénévoles
    volunteersOpen: z.boolean().optional(),
    volunteersDescription: z.string().nullable().optional(),
    volunteersExternalUrl: z.string().url().or(z.literal('')).nullable().optional(),
  }),
})

export default wrapApiHandler(
  async (event) => {
    // Vérifier que l'utilisateur est un admin
    await requireGlobalAdminWithDbCheck(event)

    // Récupérer et valider les données
    const body = await readBody(event)
    const validatedData = importSchema.parse(body)

    // Vérifier si une convention avec le même nom et email existe déjà
    const existingConvention = await prisma.convention.findFirst({
      where: {
        name: validatedData.convention.name,
        email: validatedData.convention.email,
      },
    })

    let convention = existingConvention

    // Créer la convention si elle n'existe pas (sans authorId pour qu'elle soit orpheline)
    if (!convention) {
      convention = await prisma.convention.create({
        data: {
          name: validatedData.convention.name,
          email: validatedData.convention.email,
          description: validatedData.convention.description,
          logo: validatedData.convention.logo,
          // Pas d'authorId - convention orpheline
        },
      })
    }

    // Vérifier qu'une édition avec les mêmes dates n'existe pas déjà pour cette convention
    const existingEdition = await prisma.edition.findFirst({
      where: {
        conventionId: convention.id,
        startDate: new Date(validatedData.edition.startDate),
        endDate: new Date(validatedData.edition.endDate),
        city: validatedData.edition.city,
      },
    })

    if (existingEdition) {
      throw createError({
        statusCode: 400,
        message: 'Une édition existe déjà pour cette convention avec ces dates et cette ville',
      })
    }

    // Créer l'édition (sans creatorId pour qu'elle soit orpheline)
    const edition = await prisma.edition.create({
      data: {
        conventionId: convention.id,
        name: validatedData.edition.name || null,
        description: validatedData.edition.description,
        startDate: new Date(validatedData.edition.startDate),
        endDate: new Date(validatedData.edition.endDate),
        addressLine1: validatedData.edition.addressLine1,
        addressLine2: validatedData.edition.addressLine2,
        city: validatedData.edition.city,
        region: validatedData.edition.region,
        country: validatedData.edition.country,
        postalCode: validatedData.edition.postalCode,
        latitude: validatedData.edition.latitude,
        longitude: validatedData.edition.longitude,
        ticketingUrl: validatedData.edition.ticketingUrl || null,
        facebookUrl: validatedData.edition.facebookUrl || null,
        instagramUrl: validatedData.edition.instagramUrl || null,
        officialWebsiteUrl: validatedData.edition.officialWebsiteUrl || null,
        imageUrl: validatedData.edition.imageUrl,
        // Caractéristiques
        hasFoodTrucks: validatedData.edition.hasFoodTrucks ?? false,
        hasKidsZone: validatedData.edition.hasKidsZone ?? false,
        acceptsPets: validatedData.edition.acceptsPets ?? false,
        hasTentCamping: validatedData.edition.hasTentCamping ?? false,
        hasTruckCamping: validatedData.edition.hasTruckCamping ?? false,
        hasGym: validatedData.edition.hasGym ?? false,
        hasFamilyCamping: validatedData.edition.hasFamilyCamping ?? false,
        hasSleepingRoom: validatedData.edition.hasSleepingRoom ?? false,
        hasFireSpace: validatedData.edition.hasFireSpace ?? false,
        hasGala: validatedData.edition.hasGala ?? false,
        hasOpenStage: validatedData.edition.hasOpenStage ?? false,
        hasConcert: validatedData.edition.hasConcert ?? false,
        hasCantine: validatedData.edition.hasCantine ?? false,
        hasAerialSpace: validatedData.edition.hasAerialSpace ?? false,
        hasSlacklineSpace: validatedData.edition.hasSlacklineSpace ?? false,
        hasToilets: validatedData.edition.hasToilets ?? false,
        hasShowers: validatedData.edition.hasShowers ?? false,
        hasAccessibility: validatedData.edition.hasAccessibility ?? false,
        hasWorkshops: validatedData.edition.hasWorkshops ?? false,
        hasCashPayment: validatedData.edition.hasCashPayment ?? false,
        hasCreditCardPayment: validatedData.edition.hasCreditCardPayment ?? false,
        hasAfjTokenPayment: validatedData.edition.hasAfjTokenPayment ?? false,
        hasATM: validatedData.edition.hasATM ?? false,
        hasLongShow: validatedData.edition.hasLongShow ?? false,
        isOnline: validatedData.edition.isOnline ?? false,
        // Champs bénévoles
        volunteersOpen: validatedData.edition.volunteersOpen ?? false,
        volunteersDescription: validatedData.edition.volunteersDescription,
        volunteersExternalUrl: validatedData.edition.volunteersExternalUrl || null,
        // Pas de creatorId - édition orpheline
      },
    })

    // Logger l'import pour audit
    console.log(
      `[ADMIN IMPORT] Convention "${convention.name}" (ID: ${convention.id}) et édition "${edition.name}" (ID: ${edition.id}) importées avec succès`
    )

    return {
      success: true,
      conventionId: convention.id,
      editionId: edition.id,
      message: 'Import réussi',
    }
  },
  { operationName: 'ImportEdition' }
)
