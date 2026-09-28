import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { assertCodeBelongsToEdition, avanceNormalisee } from '#server/utils/treasury-guards'
import { deplacerJustificatif } from '#server/utils/treasury-receipt-files'
import { validateEditionId } from '#server/utils/validation-helpers'
import { toCents } from '~~/shared/utils/money'

/**
 * Le montant arrive en unité courante, comme partout dans les formulaires, et repart en centimes.
 * Toujours positif : c'est `kind` qui décide s'il s'ajoute aux charges ou aux produits.
 */
const bodySchema = z.object({
  kind: z.enum(['EXPENSE', 'INCOME']),
  title: z.string().min(1).max(150),
  description: z.string().max(2000).nullable().optional(),
  amount: z.number().positive().max(10_000_000),
  codeId: z.number().int().positive().nullable().optional(),
  /** Chemin rendu par `/api/files/treasury`, jamais une URL choisie par le client. */
  imageUrl: z.string().max(500).nullable().optional(),
  isForecast: z.boolean().optional(),
  /**
   * La date de l'opération, en `AAAA-MM-JJ`.
   *
   * Une date CIVILE, pas un instant : c'est ce que porte un ticket de caisse, et le 12 juin doit
   * rester le 12 juin quel que soit le fuseau du lecteur. La chaîne est convertie en date UTC à
   * l'écriture, comme le fait déjà `EditionMeal.date`.
   */
  operationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  advancedById: z.number().int().positive().nullable().optional(),
  advancedByName: z.string().max(150).nullable().optional(),
  reimbursed: z.boolean().optional(),
})

/** POST /api/editions/:id/treasury/entries — ajoute une ligne saisie à la main. */
/**
 * La date d'opération telle que Prisma l'attend, ou `null`.
 *
 * Le `Z` est explicite à dessein, mais il ne corrige rien aujourd'hui : une chaîne de forme DATE
 * SEULE (`2026-06-12`) est déjà interprétée en UTC par la spécification. C'est la forme
 * date-heure SANS décalage (`2026-06-12T00:00:00`) qui serait lue en heure locale, et glisserait
 * d'un jour à l'ouest de Greenwich.
 *
 * L'écrire en toutes lettres protège donc d'un changement à venir — élargir le format accepté par
 * le schéma suffirait à faire basculer l'interprétation, sans que rien ne le signale.
 */
const dateDOperation = (valeur: string | null | undefined): Date | null =>
  valeur ? new Date(`${valeur}T00:00:00.000Z`) : null

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    const data = bodySchema.parse(await readBody(event))
    await assertCodeBelongsToEdition(editionId, data.codeId)

    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true, conventionId: true },
    })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition introuvable' })
    }

    const imageUrl = await deplacerJustificatif(data.imageUrl, edition)

    const avance = avanceNormalisee(data)

    const entry = await prisma.treasuryEntry.create({
      data: {
        editionId,
        kind: data.kind,
        title: data.title,
        description: data.description ?? null,
        amount: toCents(data.amount)!,
        codeId: data.codeId ?? null,
        imageUrl,
        isForecast: data.isForecast ?? false,
        operationDate: dateDOperation(data.operationDate),
        ...avance,
      },
      select: { id: true },
    })

    return createSuccessResponse({ id: entry.id })
  },
  { operationName: 'CreateTreasuryEntry' }
)
