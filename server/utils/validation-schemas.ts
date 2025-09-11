import { z } from 'zod'

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
export const dateSchema = z.string().refine((val) => !isNaN(Date.parse(val)), 'Date invalide')

// Schémas d'authentification
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis'),
})

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  pseudo: pseudoSchema,
  prenom: nameSchema,
  nom: nameSchema,
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
      .optional()
      .refine((val) => !val || val.length >= 3, 'Le nom doit contenir au moins 3 caractères'),
    description: z
      .string()
      .max(5000, 'La description ne peut pas dépasser 5000 caractères')
      .optional(),
    imageUrl: z.string().nullable().optional(),
    startDate: dateSchema,
    endDate: dateSchema,
    addressLine1: z
      .string()
      .min(1, 'Adresse ligne 1 requise')
      .max(200, "L'adresse ne peut pas dépasser 200 caractères"),
    addressLine2: z.string().optional(),
    postalCode: z
      .string()
      .min(1, 'Code postal requis')
      .max(20, 'Le code postal ne peut pas dépasser 20 caractères'),
    city: z
      .string()
      .min(1, 'Ville requise')
      .max(100, 'La ville ne peut pas dépasser 100 caractères'),
    region: z.string().optional(),
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
    imageUrl: z.string().nullable().optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
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

// Schémas de covoiturage
export const carpoolOfferSchema = z.object({
  locationCity: z
    .string()
    .min(1, 'Ville requise')
    .max(100, 'La ville ne peut pas dépasser 100 caractères'),
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
  direction: z.enum(['TO_EVENT', 'FROM_EVENT'], {
    required_error: 'Direction requise',
    invalid_type_error: 'Direction invalide',
  }),
  description: z.string().max(500, 'La description ne peut pas dépasser 500 caractères').optional(),
  phoneNumber: phoneSchema,
})

export const carpoolRequestSchema = z.object({
  locationCity: z
    .string()
    .min(1, 'Ville requise')
    .max(100, 'La ville ne peut pas dépasser 100 caractères'),
  tripDate: dateSchema,
  seatsNeeded: z.coerce
    .number()
    .int()
    .min(1, 'Au moins 1 personne')
    .max(8, 'Maximum 8 personnes')
    .default(1),
  direction: z.enum(['TO_EVENT', 'FROM_EVENT'], {
    required_error: 'Direction requise',
    invalid_type_error: 'Direction invalide',
  }),
  description: z.string().max(500, 'La description ne peut pas dépasser 500 caractères').optional(),
  phoneNumber: phoneSchema,
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

// Schémas de collaborateurs (nouveau modèle droits granulaire)
export const collaboratorRightsSchema = z
  .object({
    editConvention: z.boolean().optional(),
    deleteConvention: z.boolean().optional(),
    manageCollaborators: z.boolean().optional(),
    manageVolunteers: z.boolean().optional(),
    addEdition: z.boolean().optional(),
    editAllEditions: z.boolean().optional(),
    deleteAllEditions: z.boolean().optional(),
  })
  .partial()

export const addCollaboratorSchema = z.object({
  userIdentifier: z.string().min(1, 'Pseudo ou email requis'),
})

export const updateCollaboratorRightsSchema = z.object({
  rights: collaboratorRightsSchema.optional(),
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
  const formattedErrors = error.errors.reduce(
    (acc, err) => {
      const path = err.path.join('.')
      acc[path] = err.message
      return acc
    },
    {} as Record<string, string>
  )

  throw createError({
    statusCode: 400,
    statusMessage: 'Données invalides',
    data: {
      errors: formattedErrors,
      message: 'Veuillez corriger les erreurs de saisie',
    },
  })
}
