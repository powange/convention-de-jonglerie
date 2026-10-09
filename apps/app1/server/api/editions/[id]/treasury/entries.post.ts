import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import {
  assertCodeBelongsToEdition,
  assertPersonneRattacheeALEdition,
  assertTarifsRattachables,
  avanceNormalisee,
  dateDuRemboursement,
} from '#server/utils/treasury-guards'
import { deplacerJustificatif } from '#server/utils/treasury-receipt-files'
import { validateEditionId } from '#server/utils/validation-helpers'
import { toCents } from '~~/shared/utils/money'

/**
 * Le montant arrive en unité courante, comme partout dans les formulaires, et repart en centimes.
 * Toujours positif : c'est `kind` qui décide s'il s'ajoute aux charges ou aux produits.
 */
const bodySchema = z
  .object({
    kind: z.enum(['EXPENSE', 'INCOME']),
    title: z.string().min(1).max(150),
    description: z.string().max(2000).nullable().optional(),
    /*
     * ⚠️ `optional()`, LÀ OÙ C'ÉTAIT REQUIS. Une ligne qui tire son montant de tarifs n'en a aucun
     * à saisir : le formulaire n'envoie alors pas le champ du tout, et un schéma qui l'exige
     * refusait la création en 400 — sans trace dans les journaux, un 400 étant une erreur
     * ATTENDUE, donc non journalisée. Trois essais pour le trouver.
     *
     * Le `superRefine` ci-dessous rétablit l'exigence d'un montant strictement positif pour les
     * lignes saisies à la main : sans lui, on pourrait créer une charge à zéro par mégarde.
     */
    amount: z.number().min(0).max(10_000_000).optional(),
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
    /**
     * Les tarifs dont la ligne tire son montant. Vide ou absent = montant saisi à la main.
     *
     * Réservé aux produits : la garde le refuse sur une charge.
     */
    tierIds: z.array(z.number().int().positive()).max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.tierIds?.length && !(data.amount !== undefined && data.amount > 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'Le montant est requis sans tarif rattaché',
      })
    }
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
    await assertTarifsRattachables(editionId, data.kind, data.tierIds)
    /*
     * ⚠️ AVANT la normalisation, et sur la valeur REÇUE. `avanceNormalisee` efface l'identifiant
     * sur un produit : garder la garde après elle laisserait passer sans contrôle une charge
     * requalifiée en produit puis reconvertie, et surtout ne dirait rien au client qui s'est
     * trompé de personne — son choix serait simplement ignoré.
     */
    await assertPersonneRattacheeALEdition(editionId, data.advancedById)

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
        /*
         * Zéro quand des tarifs sont rattachés, et c'est délibéré : le montant est RECALCULÉ à
         * chaque lecture depuis les commandes. Y figer une valeur à la création la ferait cesser
         * de suivre les ventes, sans que rien ne le dise.
         */
        amount: data.tierIds?.length ? 0 : toCents(data.amount!)!,
        codeId: data.codeId ?? null,
        imageUrl,
        isForecast: data.isForecast ?? false,
        operationDate: dateDOperation(data.operationDate),
        ...avance,
        // Pas d'état d'avant à la création : une ligne saisie « déjà remboursée » est datée du
        // jour de la saisie. La règle est partagée avec les deux autres points d'écriture.
        ...dateDuRemboursement(undefined, avance.reimbursed),
        ...(data.tierIds?.length
          ? { tiers: { create: data.tierIds.map((tierId) => ({ tierId })) } }
          : {}),
      },
      select: { id: true },
    })

    return createSuccessResponse({ id: entry.id })
  },
  { operationName: 'CreateTreasuryEntry' }
)
