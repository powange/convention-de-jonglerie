import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import {
  assertCodeBelongsToEdition,
  assertTarifsRattachables,
  avanceNormalisee,
} from '#server/utils/treasury-guards'
import { deplacerJustificatif, supprimerJustificatif } from '#server/utils/treasury-receipt-files'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'
import { toCents } from '~~/shared/utils/money'

const bodySchema = z.object({
  kind: z.enum(['EXPENSE', 'INCOME']).optional(),
  title: z.string().min(1).max(150).optional(),
  description: z.string().max(2000).nullable().optional(),
  amount: z.number().positive().max(10_000_000).optional(),
  /**
   * Les tarifs rattachés, remplacés en bloc.
   *
   * ⚠️ `[]` N'EST PAS `undefined` ici : le tableau vide DÉTACHE tous les tarifs et rend la ligne à
   * la saisie manuelle, alors que l'absence du champ ne touche à rien. C'est ce qui permet de
   * repasser un produit calculé en produit saisi.
   */
  tierIds: z.array(z.number().int().positive()).max(200).optional(),
  codeId: z.number().int().positive().nullable().optional(),
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

/** PUT /api/editions/:id/treasury/entries/:entryId — modifie une ligne saisie à la main. */
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
    const entryId = validateResourceId(event, 'entryId', 'ligne')

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    // Le filtre sur `editionId` évite qu'une ligne appartenant à une autre édition ne soit
    // modifiée depuis celle-ci : le droit est vérifié sur l'édition de l'URL, pas sur la ligne.
    const existing = await prisma.treasuryEntry.findFirst({
      where: { id: entryId, editionId },
      select: {
        id: true,
        imageUrl: true,
        kind: true,
        advancedById: true,
        reimbursed: true,
        edition: { select: { id: true, conventionId: true } },
      },
    })
    if (!existing) {
      throw createError({ status: 404, message: 'Ligne introuvable' })
    }

    const data = bodySchema.parse(await readBody(event))
    await assertCodeBelongsToEdition(editionId, data.codeId)

    /*
     * ⚠️ APRÈS la lecture du corps, et ce n'est pas un détail de style : placée au-dessus — juste
     * après la lecture de `existing` — cette garde lisait `data` avant sa déclaration. Zone morte
     * temporelle, et la requête échouait sur « Cannot access 'data' before initialization » dès
     * qu'on enregistrait une modification. Signalé par l'utilisateur.
     *
     * 📍 Le `kind` EFFECTIF, et non celui du corps : une requête qui ne change que les tarifs
     * n'envoie pas `kind`, et lire `data.kind` seul laisserait passer un rattachement sur une
     * charge. `entryId` exempte la ligne de ses propres tarifs.
     */
    /*
     * ⚠️ LA NATURE NE CHANGE PAS. « Le produit est un produit et restera un produit » — décidé avec
     * l'utilisateur le 06/10/2026, et refusé ici plutôt qu'au seul niveau de l'écran : une règle
     * qui ne tient qu'à l'interface se contourne par n'importe quel autre client.
     *
     * 📍 On REFUSE au lieu d'ignorer. Zod retirerait silencieusement un `kind` non déclaré, et le
     * client croirait avoir changé la nature d'une ligne qui n'a pas bougé. Le formulaire renvoie
     * la nature inchangée, donc ce refus ne le gêne jamais.
     */
    if (data.kind !== undefined && data.kind !== existing.kind) {
      throw createError({
        status: 400,
        message: "La nature d'une ligne ne se modifie pas : supprimez-la et ressaisissez-la",
      })
    }

    await assertTarifsRattachables(editionId, existing.kind, data.tierIds, entryId)

    // Le justificatif change : déplacer le nouveau depuis `temp/` avant d'écrire, pour ne pas
    // enregistrer une référence vers un fichier qui n'a pas bougé.
    const nouveauJustificatif =
      data.imageUrl !== undefined
        ? await deplacerJustificatif(data.imageUrl, existing.edition)
        : undefined

    // Recalculé à partir de l'état EFFECTIF après mise à jour, et non de la seule saisie : passer
    // une dépense en recette doit effacer l'avance, même si le client ne l'a pas renvoyée.
    const avance = avanceNormalisee({
      kind: data.kind ?? existing.kind,
      advancedById: data.advancedById !== undefined ? data.advancedById : existing.advancedById,
      reimbursed: data.reimbursed !== undefined ? data.reimbursed : existing.reimbursed,
    })

    await prisma.treasuryEntry.update({
      where: { id: entryId },
      data: {
        // `kind` n'est PAS écrit : le refus ci-dessus garantit qu'il est identique, et l'omettre
        // ici rend la règle visible à la lecture de l'`update`.
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        /*
         * Le montant : zéro dès que des tarifs sont rattachés, puisqu'il est alors recalculé à
         * chaque lecture. Sans cette remise à zéro, détacher les tarifs plus tard ferait
         * RÉAPPARAÎTRE le montant saisi avant le rattachement — un chiffre d'une autre époque,
         * parfaitement plausible.
         */
        ...(data.tierIds?.length
          ? { amount: 0 }
          : data.amount !== undefined && { amount: toCents(data.amount)! }),
        // Remplacement EN BLOC : `[]` détache tout, l'absence du champ ne touche à rien.
        ...(data.tierIds !== undefined && {
          tiers: {
            deleteMany: {},
            ...(data.tierIds.length ? { create: data.tierIds.map((tierId) => ({ tierId })) } : {}),
          },
        }),
        ...(data.codeId !== undefined && { codeId: data.codeId }),
        // `null` explicite = justificatif retiré ; absent = laissé tel quel.
        ...(nouveauJustificatif !== undefined && { imageUrl: nouveauJustificatif }),
        ...(data.isForecast !== undefined && { isForecast: data.isForecast }),
        // `undefined` = champ non envoyé, on n'y touche pas ; `null` = date effacée.
        ...(data.operationDate !== undefined && {
          operationDate: dateDOperation(data.operationDate),
        }),
        ...avance,
      },
    })

    // L'ancien justificatif ne part qu'une fois la base à jour, et seulement s'il a vraiment
    // changé : réenregistrer une entrée sans toucher à sa photo ne doit rien effacer.
    if (
      nouveauJustificatif !== undefined &&
      existing.imageUrl &&
      nouveauJustificatif !== existing.imageUrl
    ) {
      await supprimerJustificatif(existing.imageUrl, existing.edition)
    }

    return createSuccessResponse({ updated: entryId })
  },
  { operationName: 'UpdateTreasuryEntry' }
)
