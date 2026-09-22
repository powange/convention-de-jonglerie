import { DateTime } from 'luxon'
import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { syncEventMetadataFromEdition } from '#server/utils/event-sync'
import { downloadAndStoreImage } from '#server/utils/file-helpers'
import { fuseauUtilisable } from '~~/shared/utils/fuseau-edition'

/**
 * Vrai si la chaîne désigne une date qui EXISTE, et pas seulement qui a la bonne forme.
 *
 * L'expression régulière du schéma ne compte que des chiffres : `2026-13-45` la franchit. Elle
 * arrivait alors jusqu'à Prisma sous la forme d'un `Invalid Date`, et l'administrateur recevait une
 * erreur serveur opaque au lieu d'un message nommant le champ fautif.
 *
 * Le fuseau ne joue aucun rôle ici : une date lisible l'est dans tous les fuseaux.
 */
export function estUneDateReelle(dateString: string): boolean {
  return DateTime.fromISO(dateString, { zone: 'utc' }).isValid
}

/**
 * Convertit une date string en Date UTC en tenant compte du timezone.
 *
 * Si la date contient déjà un suffixe 'Z' ou un offset (+/-), elle est interprétée telle quelle.
 * Sinon, elle est interprétée comme une date locale dans le timezone spécifié.
 *
 * ⚠️ **Un fuseau annoncé mais inconnu fait LEVER**, il ne fait plus retomber sur UTC.
 *
 * L'ancienne version écrivait un `console.warn` puis enregistrait la date en UTC. C'était la règle
 * inverse de celle que ce dépôt s'est donnée dans `versInstant` : l'appelant croit tenir le fuseau
 * de la convention, et une date fausse en base survit longtemps là où un refus se voit tout de
 * suite. Un décalage de deux heures sur une date d'édition déplace la frontière des journées, donc
 * le découpage du programme et des créneaux.
 *
 * Un fuseau ABSENT reste un cas légitime et courant — le champ est facultatif, et douze éditions
 * sur quarante-trois n'en déclarent pas. Il retombe sur UTC, comme auparavant.
 *
 * Exportée pour être testable : c'est la fonction au cœur du calcul, et elle ne l'était pas.
 *
 * @param dateString - La date au format ISO (ex: "2025-07-15T14:00:00" ou "2025-07-15")
 * @param timezone - Le timezone IANA (ex: "Europe/Paris"). Si non fourni, UTC est utilisé.
 * @returns La date en UTC
 */
export function parseDateWithTimezone(dateString: string, timezone?: string | null): Date {
  // Si la date contient déjà un indicateur de timezone (Z ou +/-), l'utiliser directement
  if (dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)) {
    return new Date(dateString)
  }

  // Si un timezone est fourni, interpréter la date comme étant dans ce timezone
  if (timezone) {
    const dt = DateTime.fromISO(dateString, { zone: timezone })
    if (dt.isValid) {
      return dt.toJSDate()
    }
    throw createError({
      status: 400,
      message: `Fuseau horaire inconnu : "${timezone}". La date ne peut pas être ancrée.`,
    })
  }

  // Fallback: interpréter comme UTC
  // Ajouter 'Z' pour forcer l'interprétation UTC
  return new Date(dateString + (dateString.includes('T') ? 'Z' : 'T00:00:00Z'))
}

/**
 * Une date d'import : la bonne forme, ET une date qui existe.
 *
 * Les deux bornes partagent ce schéma plutôt que de recopier l'expression régulière : une règle
 * écrite deux fois finit toujours par diverger, et c'est le motif le plus constant des audits de
 * ce dépôt.
 */
const dateDImport = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/,
    'Format de date attendu : AAAA-MM-JJ'
  )
  .refine(estUneDateReelle, 'Cette date n’existe pas')

// Schéma de validation pour l'import (exporté pour les tests de régression de validation)
export const importSchema = z
  .object({
    /**
     * La convention d'accueil, quand on importe dans une convention qui EXISTE déjà.
     *
     * Le bloc `convention` devient alors inutile — c'est tout l'intérêt : l'IA n'a plus à deviner
     * le nom ni l'adresse d'une convention qu'on lui désigne. S'il est présent malgré tout (JSON
     * collé à la main, ou produit avant le choix), il est IGNORÉ et la réponse le signale. On ne
     * réécrit pas une convention existante depuis un import d'édition.
     */
    conventionId: z.number().int().positive().optional(),
    convention: z
      .object({
        name: z.string().min(1),
        /**
         * L'adresse de contact — et ABSENTE plutôt qu'inventée.
         *
         * C'est elle qui permet à un organisateur de revendiquer sa convention : le code de
         * revendication y est envoyé. Une adresse fabriquée depuis le nom de domaine la lui
         * retire — il ne reçoit jamais rien — ou la donne à qui contrôle cette boîte.
         *
         * Le schéma l'exigeait, alors que les prompts ordonnent (à juste titre) de laisser vide
         * quand on ne la trouve pas : un modèle obéissant produisait donc un JSON refusé, et le
         * seul chemin qui aboutissait était celui qui inventait. La colonne est nullable en base
         * depuis toujours, et la revendication sait déjà dire « pas d'email configuré ».
         */
        email: z.string().email().or(z.literal('')).nullable().optional(),
        description: z.string().nullable().optional(),
        logo: z.string().nullable().optional(),
      })
      .optional(),
    edition: z.object({
      // Nom d'édition facultatif : null/omis OU chaîne vide acceptés. Le handler convertit toute
      // valeur vide en null (`name || null`) et l'affichage retombe sur le nom de la convention
      // (getEditionDisplayName). Pas de min(1) ici, contrairement à convention.name (le fallback).
      name: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      startDate: dateDImport,
      endDate: dateDImport,
      addressLine1: z.string().min(1),
      addressLine2: z.string().nullable().optional(),
      city: z.string().min(1),
      region: z.string().nullable().optional(),
      // Fuseau horaire IANA (ex: "Europe/Paris"). Refusé ici s'il est inconnu, plutôt que de laisser
      // l'import retomber sur UTC en silence : c'est ce repli qui écrivait des dates fausses.
      timezone: z
        .string()
        .refine((tz) => fuseauUtilisable(tz) !== undefined, 'Fuseau horaire inconnu')
        .nullable()
        .optional(),
      country: z.string().min(1),
      postalCode: z.string().min(1),
      latitude: z.number().nullable().optional(),
      longitude: z.number().nullable().optional(),
      ticketingUrl: z.string().url().or(z.literal('')).nullable().optional(),
      facebookUrl: z.string().url().or(z.literal('')).nullable().optional(),
      instagramUrl: z.string().url().or(z.literal('')).nullable().optional(),
      officialWebsiteUrl: z.string().url().or(z.literal('')).nullable().optional(),
      jugglingEdgeUrl: z.string().url().or(z.literal('')).nullable().optional(),
      imageUrl: z.string().nullable().optional(),
      // Lien vers une page qui décrit le programme. Le programme lui-même se compose créneau par
      // créneau sur la frise, et non plus dans un bloc de texte.
      programUrl: z.string().url().or(z.literal('')).nullable().optional(),
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
      // Manquait au schéma alors qu'il existe en base et que l'IA le renseigne : zod n'étant pas
      // `strict`, la valeur était écartée SANS un mot, et l'édition créée sans son espace monocycle.
      hasUnicycleSpace: z.boolean().optional(),
      hasToilets: z.boolean().optional(),
      hasShowers: z.boolean().optional(),
      hasAccessibility: z.boolean().optional(),
      hasWorkshops: z.boolean().optional(),
      hasCashPayment: z.boolean().optional(),
      hasCreditCardPayment: z.boolean().optional(),
      hasAfjTokenPayment: z.boolean().optional(),
      hasATM: z.boolean().optional(),
      hasLongShow: z.boolean().optional(),
      status: z.enum(['PLANNED', 'PUBLISHED', 'OFFLINE', 'CANCELLED']).optional(),
      // Champs bénévoles
      volunteersOpen: z.boolean().optional(),
      volunteersDescription: z.string().nullable().optional(),
      volunteersExternalUrl: z.string().url().or(z.literal('')).nullable().optional(),
    }),
  })
  .refine((d) => d.conventionId !== undefined || d.convention !== undefined, {
    message:
      'Il faut choisir une convention d’accueil, ou fournir un bloc « convention » dans le JSON.',
  })

export default wrapApiHandler(
  async (event) => {
    // Vérifier que l'utilisateur est un admin
    await requireGlobalAdminWithDbCheck(event)

    // Récupérer et valider les données
    const body = await readBody(event)
    const validatedData = importSchema.parse(body)

    /**
     * Le bloc `convention` du JSON ne sert plus à rien dès qu'une convention d'accueil est
     * désignée. On le signale plutôt que de le laisser croire utilisé : quelqu'un a pu y saisir
     * un nom, et découvrir après coup qu'il n'a servi à rien est pire que de l'apprendre tout de
     * suite.
     */
    const blocConventionIgnore =
      validatedData.conventionId !== undefined && validatedData.convention !== undefined

    // Les LECTURES d'abord, hors transaction : elles ne modifient rien, et les tenir dedans
    // garderait un verrou pendant qu'on interroge la base pour rien.
    /**
     * L'adresse, normalisée une fois : `''` et l'absence valent `null`.
     *
     * Le distinguo compte pour la recherche : un `undefined` passé à Prisma RETIRE le critère au
     * lieu de chercher « sans adresse », et rattacherait l'édition à n'importe quelle convention
     * homonyme.
     */
    const emailDeConvention = validatedData.convention?.email || null

    const existingConvention = validatedData.conventionId
      ? await prisma.convention.findUnique({ where: { id: validatedData.conventionId } })
      : await prisma.convention.findFirst({
          where: {
            name: validatedData.convention!.name,
            email: emailDeConvention,
          },
        })

    // Une convention d'accueil désignée mais introuvable est une erreur de l'appelant, pas une
    // invitation à en créer une : on refuse plutôt que d'inventer une convention homonyme.
    if (validatedData.conventionId && !existingConvention) {
      throw createError({
        status: 404,
        message: `Convention introuvable : ${validatedData.conventionId}`,
      })
    }

    // Parser les dates avec le timezone
    const timezone = validatedData.edition.timezone
    const startDate = parseDateWithTimezone(validatedData.edition.startDate, timezone)
    const endDate = parseDateWithTimezone(validatedData.edition.endDate, timezone)

    console.log(
      `[ADMIN IMPORT] Dates parsées: start=${startDate.toISOString()}, end=${endDate.toISOString()}, timezone=${timezone || 'UTC'}`
    )

    // Vérifier qu'une édition avec les mêmes dates n'existe pas déjà pour cette convention.
    // Inutile quand la convention est nouvelle : elle n'a encore aucune édition.
    if (existingConvention) {
      const existingEdition = await prisma.edition.findFirst({
        where: {
          conventionId: existingConvention.id,
          startDate,
          endDate,
          city: validatedData.edition.city,
        },
      })

      if (existingEdition) {
        throw createError({
          status: 400,
          message: 'Une édition existe déjà pour cette convention avec ces dates et cette ville',
        })
      }
    }

    /**
     * Les ÉCRITURES ensuite, d'un seul bloc.
     *
     * Elles étaient quatre à s'enchaîner sans filet — la convention, l'ancre `Event`, l'édition,
     * ses réglages bénévoles — et une étape refusée laissait les précédentes derrière elle : une
     * ancre que plus rien ne référence, ou une édition PUBLIÉE dont le module bénévoles n'a pas de
     * configuration.
     *
     * Le téléchargement de l'affiche reste DEHORS, et c'est délibéré : c'est un appel réseau, et
     * tenir un verrou de base pendant plusieurs secondes coûterait plus cher que ce qu'il protège.
     * Son échec laisse l'édition sans image, ce qui est le comportement voulu et déjà signalé.
     */
    const { convention, edition } = await prisma.$transaction(async (tx) => {
      // Créer la convention si elle n'existe pas (sans authorId pour qu'elle soit orpheline).
      // Le `!` tient au refine du schéma : sans `conventionId`, le bloc `convention` est exigé.
      const convention =
        existingConvention ??
        (await tx.convention.create({
          data: {
            name: validatedData.convention!.name,
            email: emailDeConvention,
            description: validatedData.convention!.description,
            logo: validatedData.convention!.logo,
            // Pas d'authorId - convention orpheline
          },
        }))

      // Ancre Event (l'édition partage son id : invariant Edition.id == eventId)
      const eventAnchor = await tx.event.create({ data: {} })

      // Créer l'édition (sans creatorId pour qu'elle soit orpheline)
      // D'abord sans l'image pour avoir l'ID
      const edition = await tx.edition.create({
        data: {
          id: eventAnchor.id,
          eventId: eventAnchor.id,
          conventionId: convention.id,
          name: validatedData.edition.name || null,
          description: validatedData.edition.description,
          programUrl: validatedData.edition.programUrl || null,
          startDate,
          endDate,
          addressLine1: validatedData.edition.addressLine1,
          addressLine2: validatedData.edition.addressLine2,
          city: validatedData.edition.city,
          region: validatedData.edition.region,
          timezone: validatedData.edition.timezone,
          country: validatedData.edition.country,
          postalCode: validatedData.edition.postalCode,
          latitude: validatedData.edition.latitude,
          longitude: validatedData.edition.longitude,
          ticketingUrl: validatedData.edition.ticketingUrl || null,
          facebookUrl: validatedData.edition.facebookUrl || null,
          instagramUrl: validatedData.edition.instagramUrl || null,
          officialWebsiteUrl: validatedData.edition.officialWebsiteUrl || null,
          jugglingEdgeUrl: validatedData.edition.jugglingEdgeUrl || null,
          // imageUrl sera mis à jour après téléchargement
          imageUrl: null,
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
          hasUnicycleSpace: validatedData.edition.hasUnicycleSpace ?? false,
          hasToilets: validatedData.edition.hasToilets ?? false,
          hasShowers: validatedData.edition.hasShowers ?? false,
          hasAccessibility: validatedData.edition.hasAccessibility ?? false,
          hasWorkshops: validatedData.edition.hasWorkshops ?? false,
          hasCashPayment: validatedData.edition.hasCashPayment ?? false,
          hasCreditCardPayment: validatedData.edition.hasCreditCardPayment ?? false,
          hasAfjTokenPayment: validatedData.edition.hasAfjTokenPayment ?? false,
          hasATM: validatedData.edition.hasATM ?? false,
          hasLongShow: validatedData.edition.hasLongShow ?? false,
          status: validatedData.edition.status ?? 'PUBLISHED', // Par défaut PUBLISHED car une édition importée est publiée
          // Pas de creatorId - édition orpheline
        },
      })

      // Étape 0bis : config bénévole portée par EventVolunteerSettings
      await tx.eventVolunteerSettings.create({
        data: {
          eventId: eventAnchor.id,
          open: validatedData.edition.volunteersOpen ?? false,
          description: validatedData.edition.volunteersDescription ?? null,
          externalUrl: validatedData.edition.volunteersExternalUrl || null,
        },
      })
      // Renseigner les métadonnées génériques de l'Event (name/dates/status) depuis l'édition
      await syncEventMetadataFromEdition(edition.id, tx)

      return { convention, edition }
    })

    // Si une URL d'image est fournie, télécharger et stocker l'image
    let imageDownloadResult: { success: boolean; filename: string | null; error?: string } | null =
      null
    if (validatedData.edition.imageUrl) {
      console.log(
        `[ADMIN IMPORT] Téléchargement de l'affiche depuis: ${validatedData.edition.imageUrl}`
      )

      imageDownloadResult = await downloadAndStoreImage(
        validatedData.edition.imageUrl,
        edition.id,
        'editions',
        true // verbose
      )

      if (imageDownloadResult.success && imageDownloadResult.filename) {
        // Mettre à jour l'édition avec le nom du fichier local
        await prisma.edition.update({
          where: { id: edition.id },
          data: { imageUrl: imageDownloadResult.filename },
        })
        console.log(
          `[ADMIN IMPORT] Affiche téléchargée et stockée: ${imageDownloadResult.filename}`
        )
      } else {
        console.warn(
          `[ADMIN IMPORT] Échec du téléchargement de l'affiche: ${imageDownloadResult.error}`
        )
      }
    }

    // Logger l'import pour audit
    console.log(
      `[ADMIN IMPORT] Convention "${convention.name}" (ID: ${convention.id}) et édition "${edition.name}" (ID: ${edition.id}) importées avec succès`
    )

    return createSuccessResponse(
      {
        conventionId: convention.id,
        editionId: edition.id,
        imageDownloaded: imageDownloadResult?.success ?? false,
        imageError: imageDownloadResult?.error,
        // Pour que l'écran puisse dire que le bloc `convention` du JSON n'a pas servi.
        conventionBlockIgnored: blocConventionIgnore,
      },
      'Import réussi'
    )
  },
  { operationName: 'ImportEdition' }
)
