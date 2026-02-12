import { z } from 'zod'

import { getSupportedLocalesCodes } from '~/utils/locales'

// Schémas de base réutilisables
export const emailSchema = z.string().email('Email invalide').min(1, 'Email requis')
export const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .regex(/(?=.*[A-Z])/, 'Le mot de passe doit contenir au moins une majuscule')
  .regex(/(?=.*\d)/, 'Le mot de passe doit contenir au moins un chiffre')
export const pseudoSchema = z
  .string()
  .min(3, 'Le pseudo doit contenir au moins 3 caractères')
  .max(50, 'Le pseudo ne peut pas dépasser 50 caractères')
export const nameSchema = z
  .string()
  .min(1, 'Ce champ est requis')
  .max(100, 'Ce champ ne peut pas dépasser 100 caractères')
export const phoneSchema = z
  .string()
  .nullable()
  .optional()
  .refine((val) => !val || /^\+?[0-9\s\-()]+$/.test(val), 'Numéro de téléphone invalide')
export const urlSchema = z.string().url('URL invalide').nullable().optional().or(z.literal(''))
// Schéma pour les dates - accepte ISO strict et datetime-local pour la transition
export const dateSchema = z
  .string()
  .min(1, 'Date requise')
  .refine((val) => {
    // Accepter les formats ISO stricts et datetime-local pendant la transition
    return !isNaN(Date.parse(val))
  }, 'Date invalide')

// Schéma pour les dates optionnelles (mises à jour)
export const optionalDateSchema = z
  .string()
  .optional()
  .refine((val) => !val || !isNaN(Date.parse(val)), 'Date invalide')

// Schémas d'authentification
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis'),
})

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  pseudo: pseudoSchema,
  prenom: z
    .string()
    .max(100, 'Ce champ ne peut pas dépasser 100 caractères')
    .optional()
    .or(z.literal('')),
  nom: z
    .string()
    .max(100, 'Ce champ ne peut pas dépasser 100 caractères')
    .optional()
    .or(z.literal('')),
  isVolunteer: z.boolean().optional().default(false),
  isArtist: z.boolean().optional().default(false),
  isOrganizer: z.boolean().optional().default(false),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional().or(z.literal('')), // Optionnel ou chaîne vide pour les utilisateurs OAuth
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  })

// Schémas de profil
export const updateProfileSchema = z.object({
  pseudo: pseudoSchema,
  // Champs rendus optionnels (peuvent être vides ou non fournis)
  prenom: z.string().max(100, 'Ce champ ne peut pas dépasser 100 caractères').optional(),
  nom: z.string().max(100, 'Ce champ ne peut pas dépasser 100 caractères').optional(),
  email: emailSchema,
  telephone: phoneSchema.optional(),
  profilePicture: z.string().nullable().optional(),
  preferredLanguage: z
    .string()
    .refine((val) => getSupportedLocalesCodes().includes(val as any), 'Langue non supportée')
    .optional(),
  isVolunteer: z.boolean().optional(),
  isArtist: z.boolean().optional(),
  isOrganizer: z.boolean().optional(),
})

export const categoriesUpdateSchema = z.object({
  isVolunteer: z.boolean(),
  isArtist: z.boolean(),
  isOrganizer: z.boolean(),
})

// Schémas de convention
export const conventionSchema = z.object({
  name: z
    .string()
    .min(3, 'Le nom doit contenir au moins 3 caractères')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  description: z
    .string()
    .max(5000, 'La description ne peut pas dépasser 5000 caractères')
    .nullable()
    .optional(),
  email: z.string().email('Email invalide').nullable().optional().or(z.literal('')),
  logo: z.string().nullable().optional(),
})

export const updateConventionSchema = conventionSchema.partial()

// Schémas d'édition
export const editionSchema = z
  .object({
    conventionId: z.number().int().positive('ID de convention requis'),
    name: z
      .string()
      .max(200, 'Le nom ne peut pas dépasser 200 caractères')
      .nullable()
      .optional()
      .refine((val) => !val || val.length >= 3, 'Le nom doit contenir au moins 3 caractères'),
    description: z
      .string()
      .max(5000, 'La description ne peut pas dépasser 5000 caractères')
      .nullable()
      .optional(),
    program: z
      .string()
      .max(10000, 'Le programme ne peut pas dépasser 10000 caractères')
      .nullable()
      .optional(),
    imageUrl: z.string().nullable().optional(),
    startDate: dateSchema,
    endDate: dateSchema,
    timezone: z.string().nullable().optional(),
    addressLine1: z
      .string()
      .min(1, 'Adresse ligne 1 requise')
      .max(200, "L'adresse ne peut pas dépasser 200 caractères"),
    addressLine2: z.string().nullable().optional(),
    postalCode: z
      .string()
      .min(1, 'Code postal requis')
      .max(20, 'Le code postal ne peut pas dépasser 20 caractères'),
    city: z
      .string()
      .min(1, 'Ville requise')
      .max(100, 'La ville ne peut pas dépasser 100 caractères'),
    region: z.string().nullable().optional(),
    country: z
      .string()
      .min(1, 'Pays requis')
      .max(100, 'Le pays ne peut pas dépasser 100 caractères'),
    ticketingUrl: urlSchema,
    officialWebsiteUrl: urlSchema,
    facebookUrl: urlSchema,
    instagramUrl: urlSchema,
    // Services booléens
    hasFoodTrucks: z.boolean().optional(),
    hasKidsZone: z.boolean().optional(),
    acceptsPets: z.boolean().optional(),
    hasTentCamping: z.boolean().optional(),
    hasTruckCamping: z.boolean().optional(),
    hasFamilyCamping: z.boolean().optional(),
    hasSleepingRoom: z.boolean().optional(),
    hasGym: z.boolean().optional(),
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
    workshopsEnabled: z.boolean().optional(),
    workshopLocationsFreeInput: z.boolean().optional(),
    hasCashPayment: z.boolean().optional(),
    hasCreditCardPayment: z.boolean().optional(),
    hasAfjTokenPayment: z.boolean().optional(),
    hasLongShow: z.boolean().optional(),
    hasATM: z.boolean().optional(),
  })
  .refine(
    (data) => {
      const startDate = new Date(data.startDate)
      const endDate = new Date(data.endDate)
      return startDate <= endDate
    },
    {
      message: 'La date de fin doit être postérieure à la date de début',
      path: ['endDate'],
    }
  )

export const updateEditionSchema = z
  .object({
    conventionId: z.number().int().positive('ID de convention requis').optional(),
    name: z
      .string()
      .max(200, 'Le nom ne peut pas dépasser 200 caractères')
      .nullable()
      .optional()
      .refine((val) => !val || val.length >= 3, 'Le nom doit contenir au moins 3 caractères'),
    description: z
      .string()
      .max(5000, 'La description ne peut pas dépasser 5000 caractères')
      .nullable()
      .optional(),
    program: z
      .string()
      .max(10000, 'Le programme ne peut pas dépasser 10000 caractères')
      .nullable()
      .optional(),
    imageUrl: z.string().nullable().optional(),
    startDate: optionalDateSchema,
    endDate: optionalDateSchema,
    timezone: z.string().nullable().optional(),
    addressLine1: z
      .string()
      .min(1, 'Adresse ligne 1 requise')
      .max(200, "L'adresse ne peut pas dépasser 200 caractères")
      .optional(),
    addressLine2: z.string().nullable().optional(),
    postalCode: z
      .string()
      .min(1, 'Code postal requis')
      .max(20, 'Le code postal ne peut pas dépasser 20 caractères')
      .optional(),
    city: z
      .string()
      .min(1, 'Ville requise')
      .max(100, 'La ville ne peut pas dépasser 100 caractères')
      .optional(),
    region: z.string().nullable().optional(),
    country: z
      .string()
      .min(1, 'Pays requis')
      .max(100, 'Le pays ne peut pas dépasser 100 caractères')
      .optional(),
    ticketingUrl: urlSchema,
    officialWebsiteUrl: urlSchema,
    facebookUrl: urlSchema,
    instagramUrl: urlSchema,
    // Services booléens
    hasFoodTrucks: z.boolean().optional(),
    hasKidsZone: z.boolean().optional(),
    acceptsPets: z.boolean().optional(),
    hasTentCamping: z.boolean().optional(),
    hasTruckCamping: z.boolean().optional(),
    hasFamilyCamping: z.boolean().optional(),
    hasSleepingRoom: z.boolean().optional(),
    hasGym: z.boolean().optional(),
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
    workshopsEnabled: z.boolean().optional(),
    workshopLocationsFreeInput: z.boolean().optional(),
    hasCashPayment: z.boolean().optional(),
    hasCreditCardPayment: z.boolean().optional(),
    hasAfjTokenPayment: z.boolean().optional(),
    hasLongShow: z.boolean().optional(),
    hasATM: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        const startDate = new Date(data.startDate)
        const endDate = new Date(data.endDate)
        return startDate <= endDate
      }
      return true
    },
    {
      message: 'La date de fin doit être postérieure à la date de début',
      path: ['endDate'],
    }
  )

// Schémas de covoiturage - Champs communs
const carpoolLocationCitySchema = z
  .string()
  .min(1, 'Ville requise')
  .max(100, 'La ville ne peut pas dépasser 100 caractères')

const carpoolDirectionSchema = z.enum(['TO_EVENT', 'FROM_EVENT'], {
  message: 'Direction invalide',
})

const carpoolDescriptionSchema = z
  .string()
  .max(500, 'La description ne peut pas dépasser 500 caractères')
  .optional()

export const carpoolOfferSchema = z.object({
  locationCity: carpoolLocationCitySchema,
  locationAddress: z
    .string()
    .min(1, 'Adresse requise')
    .max(200, "L'adresse ne peut pas dépasser 200 caractères"),
  tripDate: dateSchema,
  availableSeats: z.coerce
    .number()
    .int()
    .min(1, 'Au moins 1 place disponible')
    .max(8, 'Maximum 8 places'),
  direction: carpoolDirectionSchema,
  description: carpoolDescriptionSchema,
  phoneNumber: phoneSchema,
})

export const carpoolRequestSchema = z.object({
  locationCity: carpoolLocationCitySchema,
  tripDate: dateSchema,
  seatsNeeded: z.coerce
    .number()
    .int()
    .min(1, 'Au moins 1 personne')
    .max(8, 'Maximum 8 personnes')
    .default(1),
  direction: carpoolDirectionSchema,
  description: carpoolDescriptionSchema,
  phoneNumber: phoneSchema,
})

// Schémas de mise à jour de covoiturage
export const updateCarpoolOfferSchema = z.object({
  tripDate: z.string().optional(),
  locationCity: z.string().min(1, 'La ville de départ est requise').optional(),
  locationAddress: z.string().min(1, "L'adresse de départ est requise").optional(),
  availableSeats: z
    .number()
    .int()
    .min(1, 'Au moins 1 place disponible')
    .max(8, 'Maximum 8 places')
    .optional(),
  description: z.string().max(500, 'Description trop longue (500 caractères max)').optional(),
  phoneNumber: z.string().max(20, 'Numéro de téléphone trop long').optional().nullable(),
  smokingAllowed: z.boolean().optional(),
  petsAllowed: z.boolean().optional(),
  musicAllowed: z.boolean().optional(),
})

export const updateCarpoolRequestSchema = z.object({
  tripDate: z.string().optional(),
  locationCity: z.string().min(1, 'La ville de départ est requise').optional(),
  seatsNeeded: z
    .number()
    .int()
    .min(1, 'Au moins 1 place nécessaire')
    .max(8, 'Maximum 8 places')
    .optional(),
  description: z.string().max(500, 'Description trop longue (500 caractères max)').optional(),
  phoneNumber: z.string().max(20, 'Numéro de téléphone trop long').optional().nullable(),
})

// Schémas de commentaires
export const commentSchema = z.object({
  content: z
    .string()
    .min(1, 'Le commentaire ne peut pas être vide')
    .max(1000, 'Le commentaire ne peut pas dépasser 1000 caractères'),
})

// Schémas de posts et commentaires d'édition
export const editionPostSchema = z.object({
  content: z
    .string()
    .min(1, 'Le contenu ne peut pas être vide')
    .max(2000, 'Le contenu ne peut pas dépasser 2000 caractères'),
})

export const editionPostCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Le commentaire ne peut pas être vide')
    .max(1000, 'Le commentaire ne peut pas dépasser 1000 caractères'),
})

// Schémas de organisateurs (nouveau modèle droits granulaire)
export const organizerRightsSchema = z
  .object({
    editConvention: z.boolean().optional(),
    deleteConvention: z.boolean().optional(),
    manageOrganizers: z.boolean().optional(),
    manageVolunteers: z.boolean().optional(),
    addEdition: z.boolean().optional(),
    editAllEditions: z.boolean().optional(),
    deleteAllEditions: z.boolean().optional(),
  })
  .partial()

export const addOrganizerschema = z.object({
  userIdentifier: z.string().min(1, 'Pseudo ou email requis'),
})

export const updateOrganizerRightsSchema = z.object({
  rights: organizerRightsSchema.optional(),
  title: z.string().max(100).optional().nullable(),
})

// Fonction utilitaire pour sanitiser les données avant validation
export function sanitizeData(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) {
    return data
  }

  const sanitized = { ...(data as Record<string, unknown>) }

  // Trim des chaînes de caractères
  Object.keys(sanitized).forEach((key) => {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = (sanitized[key] as string).trim()
      // Conversion en minuscules pour les emails
      if (key === 'email') {
        sanitized[key] = (sanitized[key] as string).toLowerCase()
      }
    }
  })

  return sanitized
}

// Fonction utilitaire pour valider et nettoyer les données
export function validateAndSanitize<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const sanitizedData = sanitizeData(data)
  return schema.parse(sanitizedData)
}

// Fonction pour gérer les erreurs de validation Zod
export function handleValidationError(error: z.ZodError) {
  const formattedErrors = (error.issues || []).reduce(
    (acc, err) => {
      const path = err.path.join('.')
      acc[path] = err.message
      return acc
    },
    {} as Record<string, string>
  )

  throw createError({
    status: 400,
    message: 'Données invalides',
    data: {
      errors: formattedErrors,
      message: 'Veuillez corriger les erreurs de saisie',
    },
  })
}

// Schémas de workshop
// Schéma de base sans refinements (pour permettre .partial() avec Zod v4)
const workshopBaseSchema = z.object({
  title: z
    .string()
    .min(3, 'Le titre doit contenir au moins 3 caractères')
    .max(200, 'Le titre ne peut pas dépasser 200 caractères'),
  description: z
    .string()
    .max(5000, 'La description ne peut pas dépasser 5000 caractères')
    .nullable()
    .optional(),
  startDateTime: dateSchema,
  endDateTime: dateSchema,
  maxParticipants: z
    .number()
    .int('Le nombre maximum de participants doit être un entier')
    .positive('Le nombre maximum de participants doit être positif')
    .nullable()
    .optional(),
  locationId: z
    .number()
    .int('ID de lieu invalide')
    .positive('ID de lieu invalide')
    .nullable()
    .optional(),
  locationName: z
    .string()
    .min(1, 'Le nom du lieu est requis')
    .max(100, 'Le nom du lieu ne peut pas dépasser 100 caractères')
    .nullable()
    .optional(),
  editionStartDate: dateSchema.optional(), // Pour la validation
  editionEndDate: dateSchema.optional(), // Pour la validation
})

// Schéma complet avec refinements pour la création
export const workshopSchema = workshopBaseSchema
  .refine((data) => new Date(data.endDateTime) > new Date(data.startDateTime), {
    message: 'La date de fin doit être après la date de début',
    path: ['endDateTime'],
  })
  .refine(
    (data) => {
      // Si les dates d'édition sont fournies, vérifier que le workshop est pendant l'édition
      if (data.editionStartDate && data.editionEndDate) {
        const workshopStart = new Date(data.startDateTime)
        const workshopEnd = new Date(data.endDateTime)
        const editionStart = new Date(data.editionStartDate)
        const editionEnd = new Date(data.editionEndDate)

        return workshopStart >= editionStart && workshopEnd <= editionEnd
      }
      return true
    },
    {
      message: "Le workshop doit se dérouler pendant les dates de l'édition",
      path: ['startDateTime'],
    }
  )

// Schéma partiel pour les mises à jour (sans refinements car Zod v4 ne supporte pas .partial() avec refinements)
export const updateWorkshopSchema = workshopBaseSchema.partial()

// ========== APPEL À SPECTACLES ==========

// Schéma de configuration de l'appel à spectacles
export const showCallSettingsSchema = z.object({
  isOpen: z.boolean(),
  mode: z.enum(['INTERNAL', 'EXTERNAL'], {
    message: 'Mode invalide',
  }),
  externalUrl: urlSchema,
  description: z
    .string()
    .max(5000, 'La description ne peut pas dépasser 5000 caractères')
    .nullable()
    .optional(),
  deadline: optionalDateSchema.nullable(),
  askPortfolioUrl: z.boolean().optional().default(true),
  askVideoUrl: z.boolean().optional().default(true),
  askTechnicalNeeds: z.boolean().optional().default(true),
  askAccommodation: z.boolean().optional().default(false),
  askDepartureCity: z.boolean().optional().default(false),
})

// Schéma de candidature de spectacle
export const showApplicationSchema = z
  .object({
    // Informations personnelles (obligatoires, mises à jour dans le profil)
    lastName: z
      .string()
      .min(2, 'Le nom doit contenir au moins 2 caractères')
      .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
    firstName: z
      .string()
      .min(2, 'Le prénom doit contenir au moins 2 caractères')
      .max(100, 'Le prénom ne peut pas dépasser 100 caractères'),
    phone: z
      .string()
      .min(6, 'Le numéro de téléphone doit contenir au moins 6 caractères')
      .max(20, 'Le numéro de téléphone ne peut pas dépasser 20 caractères'),

    // Infos artiste
    artistName: z
      .string()
      .min(2, 'Le nom de scène doit contenir au moins 2 caractères')
      .max(100, 'Le nom de scène ne peut pas dépasser 100 caractères'),
    artistBio: z
      .string()
      .max(3000, 'La biographie ne peut pas dépasser 3000 caractères')
      .nullable()
      .optional(),
    portfolioUrl: urlSchema,
    videoUrl: urlSchema,
    socialLinks: z
      .string()
      .max(2000, 'Les liens réseaux sociaux ne peuvent pas dépasser 2000 caractères')
      .nullable()
      .optional(),

    // Infos spectacle proposé
    showTitle: z
      .string()
      .min(3, 'Le titre du spectacle doit contenir au moins 3 caractères')
      .max(200, 'Le titre du spectacle ne peut pas dépasser 200 caractères'),
    showDescription: z
      .string()
      .min(20, 'La description doit contenir au moins 20 caractères')
      .max(5000, 'La description ne peut pas dépasser 5000 caractères'),
    showDuration: z.coerce
      .number()
      .int('La durée doit être un nombre entier')
      .min(1, 'La durée doit être au moins 1 minute')
      .max(180, 'La durée ne peut pas dépasser 180 minutes'),
    showCategory: z
      .string()
      .max(100, 'La catégorie ne peut pas dépasser 100 caractères')
      .nullable()
      .optional(),
    technicalNeeds: z
      .string()
      .max(3000, 'Les besoins techniques ne peuvent pas dépasser 3000 caractères')
      .nullable()
      .optional(),
    // Personnes supplémentaires dans le spectacle
    additionalPerformersCount: z.coerce
      .number()
      .int('Le nombre doit être un entier')
      .min(0, 'Le nombre ne peut pas être négatif')
      .max(50, 'Le nombre ne peut pas dépasser 50'),
    additionalPerformers: z
      .array(
        z.object({
          lastName: z
            .string()
            .min(2, 'Le nom doit contenir au moins 2 caractères')
            .max(100, 'Le nom ne peut pas dépasser 100 caractères'),
          firstName: z
            .string()
            .min(2, 'Le prénom doit contenir au moins 2 caractères')
            .max(100, 'Le prénom ne peut pas dépasser 100 caractères'),
          email: z.string().email('Email invalide'),
          phone: z
            .string()
            .min(6, 'Le numéro de téléphone doit contenir au moins 6 caractères')
            .max(20, 'Le numéro de téléphone ne peut pas dépasser 20 caractères'),
        })
      )
      .optional()
      .default([]),

    // Logistique
    accommodationNeeded: z.boolean().optional().default(false),
    accommodationNotes: z
      .string()
      .max(1000, "Les notes d'hébergement ne peuvent pas dépasser 1000 caractères")
      .nullable()
      .optional(),
    departureCity: z
      .string()
      .max(100, 'La ville de départ ne peut pas dépasser 100 caractères')
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      // Vérifier que le nombre de personnes supplémentaires correspond au tableau
      const count = data.additionalPerformersCount || 0
      const performers = data.additionalPerformers || []
      return performers.length === count
    },
    {
      message: 'Le nombre de personnes supplémentaires doit correspondre aux informations fournies',
      path: ['additionalPerformers'],
    }
  )

// Schéma pour la mise à jour d'une candidature (statut, notes, spectacle associé)
export const showApplicationStatusSchema = z.object({
  status: z
    .enum(['PENDING', 'ACCEPTED', 'REJECTED'], {
      message: 'Statut invalide',
    })
    .optional(),
  organizerNotes: z
    .string()
    .max(3000, 'Les notes ne peuvent pas dépasser 3000 caractères')
    .nullable()
    .optional(),
  showId: z.number().int().positive().nullable().optional(),
})
