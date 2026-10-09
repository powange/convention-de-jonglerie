import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'

import { NotificationHelpers, safeNotify } from './notification-service'
import prisma from './prisma'
import { carpoolUserSelect } from './prisma-select-helpers'
import { sanitizeUserContent } from './validation-helpers'

import type { H3Event } from 'h3'

import { isHttpError } from '#server/types/api'
import { commentSchema } from '#server/utils/validation-schemas'

export type CommentEntityType = 'carpoolOffer' | 'carpoolRequest'

export interface CommentConfig {
  entityType: CommentEntityType
  entityIdField: string
  includeQuery?: any
}

export async function getCommentsForEntity(event: H3Event, config: CommentConfig) {
  try {
    // Récupérer l'ID depuis les params et le parser en nombre
    const rawId = (event.context as any)?.params?.id
    if (!rawId) {
      throw createError({ status: 400, message: 'ID manquant' })
    }

    const parsedId = parseInt(rawId)
    if (isNaN(parsedId)) {
      const msg =
        config.entityType === 'carpoolOffer'
          ? "ID de l'offre invalide"
          : 'ID de la demande invalide'
      throw createError({ status: 400, message: msg })
    }

    // Construire la requête where dynamiquement (avec ID numérique)
    const whereClause: any = {}
    whereClause[config.entityIdField] = parsedId

    // Choisir le bon modèle Prisma selon le type d'entité
    const modelName =
      config.entityType === 'carpoolOffer' ? 'carpoolComment' : 'carpoolRequestComment'
    const model: any = (prisma as any)[modelName]

    // Récupérer les commentaires
    const comments = await model.findMany({
      where: whereClause,
      include: {
        user: {
          select: carpoolUserSelect,
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // emailHash est déjà présent via le select
    return comments
  } catch (error: unknown) {
    console.error(
      `Erreur lors de la récupération des commentaires pour ${config.entityType}:`,
      error
    )

    if (isHttpError(error)) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Erreur serveur',
      cause: error,
    })
  }
}

/**
 * Prévient l'auteur de l'offre ou de la demande, et les autres personnes qui y ont commenté.
 *
 * ⚠️ POURQUOI CETTE FONCTION EXISTE. Le libellé du réglage promettait déjà ces notifications —
 * « Soyez notifié des réservations ET MESSAGES de covoiturage » — et rien ne les envoyait. Une
 * promesse non tenue est pire qu'une absence : on cesse de venir regarder, en croyant qu'on serait
 * prévenu.
 *
 * Qui est prévenu, et pourquoi ces trois règles :
 *
 * 1. **l'auteur de l'offre ou de la demande**, parce que c'est à lui qu'on s'adresse en commentant ;
 * 2. **les autres personnes ayant déjà commenté**, parce qu'un fil de commentaires est une
 *    conversation : celui qui a posé une question doit savoir qu'on y répond, même si l'annonce
 *    n'est pas la sienne ;
 * 3. **jamais celui qui vient d'écrire**, et le dédoublonnage compte ici : l'auteur de l'annonce
 *    est le plus souvent aussi un commentateur, et sans `Set` il recevrait deux notifications pour
 *    le même message.
 *
 * ⚠️ Les envois passent par `safeNotify` et n'interrompent jamais la création : un commentaire
 * enregistré puis perdu parce qu'une notification a échoué serait un défaut bien plus grave que
 * l'absence de notification.
 */
async function prevenirLesInteresses(contexte: {
  typeEntite: 'carpoolOffer' | 'carpoolRequest'
  entiteId: number
  champEntite: string
  modele: any
  auteurDeLEntite: number | null | undefined
  editionId: number | null
  auteurDuCommentaire: number | undefined
  nomDeLAuteur: string
}): Promise<void> {
  const { auteurDuCommentaire } = contexte
  if (!auteurDuCommentaire) return

  const aPrevenir = new Set<number>()

  if (contexte.auteurDeLEntite && contexte.auteurDeLEntite !== auteurDuCommentaire) {
    aPrevenir.add(contexte.auteurDeLEntite)
  }

  // Les autres commentateurs. `distinct` côté base plutôt qu'en mémoire : un fil de vingt
  // commentaires écrits par trois personnes ne doit pas ramener vingt lignes.
  const commentateurs: { userId: number | null }[] = await contexte.modele.findMany({
    where: { [contexte.champEntite]: contexte.entiteId },
    select: { userId: true },
    distinct: ['userId'],
  })

  for (const { userId } of commentateurs) {
    if (userId && userId !== auteurDuCommentaire) aPrevenir.add(userId)
  }

  if (aPrevenir.size === 0) return

  const type = contexte.typeEntite === 'carpoolOffer' ? 'offer' : 'request'
  await Promise.all(
    [...aPrevenir].map((userId) =>
      safeNotify(
        () =>
          NotificationHelpers.carpoolCommentReceived(
            userId,
            contexte.nomDeLAuteur,
            type,
            contexte.entiteId,
            contexte.editionId
          ),
        'covoiturage commentaire'
      )
    )
  )
}

export async function createCommentForEntity(
  event: H3Event,
  config: CommentConfig & { requireAuth?: boolean }
) {
  try {
    // Vérification de l'authentification si requise
    if (config.requireAuth && !event.context.user) {
      throw createError({
        status: 401,
        message: 'Authentification requise',
      })
    }

    const rawId = getRouterParam(event, 'id')
    if (!rawId) {
      throw createError({ status: 400, message: 'ID manquant' })
    }

    const parsedId = parseInt(rawId)
    if (isNaN(parsedId)) {
      throw createError({ status: 400, message: 'ID manquant' })
    }

    // Vérifier que la ressource parente existe
    const parentModelName = config.entityType === 'carpoolOffer' ? 'carpoolOffer' : 'carpoolRequest'
    const parentModel: any = (prisma as any)[parentModelName]
    // `userId` et `editionId` en plus de l'existence : ils servent à prévenir l'auteur et à
    // construire l'URL de la notification, et les redemander ensuite ferait une requête de plus.
    const parentExists = await parentModel.findUnique({
      where: { id: parsedId },
      select: { id: true, userId: true, editionId: true },
    })

    if (!parentExists) {
      const errorMsg =
        config.entityType === 'carpoolOffer'
          ? 'Offre de covoiturage non trouvée'
          : 'Demande de covoiturage non trouvée'
      throw createError({ status: 404, message: errorMsg })
    }

    /*
     * ⚠️ `commentSchema` ÉTAIT ÉCRIT, TESTÉ, ET BRANCHÉ NULLE PART.
     *
     * Il borne le contenu à 1 000 caractères depuis toujours, et ses deux seules autres occurrences
     * du dépôt étaient dans son propre fichier de tests. Le handler lisait `body.content` à la
     * main, avec deux conséquences :
     *
     * - **aucune borne de longueur.** La colonne est un `TEXT` : on pouvait y déposer 64 Ko, que
     *   chaque chargement de la liste retransportait ensuite ;
     * - **un corps absent levait un `TypeError`**. `!body.content` sur `body === null` n'est pas une
     *   validation, c'est un accès à une propriété de `null` — converti en **500**, là où une
     *   requête mal formée mérite un 400.
     *
     * 📍 Deuxième occurrence de ce motif dans le dépôt — après le constat A7 de `serveur-transverse`
     * — et le carnet le note : « deux occurrences font une habitude ». Un schéma qu'on écrit sans le
     * brancher donne la couverture d'une règle sans la règle.
     *
     * `?? {}` sur le corps : `readBody` rend `null` ou `undefined` pour un corps vide, et c'est à
     * zod de le refuser avec son message, pas au moteur JavaScript de lever.
     */
    const { content } = commentSchema.parse((await readBody(event)) ?? {})

    // Construire les données du commentaire dynamiquement
    const commentData: any = {
      content: sanitizeUserContent(content),
      userId: event.context.user?.id,
    }
    commentData[config.entityIdField] = parsedId

    // Créer le commentaire
    const modelName =
      config.entityType === 'carpoolOffer' ? 'carpoolComment' : 'carpoolRequestComment'
    const model: any = (prisma as any)[modelName]

    const comment = await model.create({
      data: commentData,
      include: {
        user: {
          select: carpoolUserSelect,
        },
      },
    })

    await prevenirLesInteresses({
      typeEntite: config.entityType,
      entiteId: parsedId,
      champEntite: config.entityIdField,
      modele: model,
      auteurDeLEntite: parentExists.userId,
      editionId: parentExists.editionId ?? null,
      auteurDuCommentaire: event.context.user?.id,
      nomDeLAuteur: comment.user?.pseudo ?? comment.user?.prenom ?? 'Quelqu’un',
    })

    return comment
  } catch (error: unknown) {
    /*
     * ⚠️ UNE ERREUR DE SAISIE N'EST PAS UNE ERREUR SERVEUR.
     *
     * `commentSchema.parse` lève une `ZodError`, et ce `catch` l'aurait convertie en **500** avec
     * le message « Erreur lors de la création du commentaire ». Brancher le schéma sans ce relais
     * aurait donc DÉPLACÉ le défaut au lieu de le refermer : un commentaire de 1 001 caractères
     * serait passé d'« accepté en silence » à « panne serveur », et c'est le serveur qu'on serait
     * allé regarder.
     *
     * `wrapApiHandler` — qui enveloppe les deux points d'API appelants — sait déjà en faire un
     * **400** via `handleValidationError`, en rendant au passage le champ fautif et son message.
     * La laisser remonter intacte est donc le seul geste juste ; la recopier ici en ferait une
     * seconde version à faire vieillir en parallèle.
     *
     * Et on ne journalise pas : une saisie trop longue n'est pas un incident d'exploitation.
     */
    if (error instanceof z.ZodError) throw error

    console.error(`Erreur lors de la création du commentaire pour ${config.entityType}:`, error)

    if (isHttpError(error)) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Erreur lors de la création du commentaire',
      cause: error,
    })
  }
}

export async function deleteCommentForEntity(
  event: H3Event,
  config: CommentConfig & { requireAuth?: boolean }
) {
  try {
    // Vérification de l'authentification
    if (config.requireAuth && !event.context.user) {
      throw createError({
        status: 401,
        message: 'Authentification requise',
      })
    }

    const commentIdRaw = getRouterParam(event, 'commentId')
    if (!commentIdRaw) {
      throw createError({ status: 400, message: 'ID du commentaire manquant' })
    }

    const commentId = parseInt(commentIdRaw)
    if (isNaN(commentId)) {
      throw createError({ status: 400, message: 'ID du commentaire manquant' })
    }

    // Utiliser le bon modèle Prisma selon le type d'entité
    const modelName =
      config.entityType === 'carpoolOffer' ? 'carpoolComment' : 'carpoolRequestComment'
    const model: any = (prisma as any)[modelName]

    // Vérifier que le commentaire existe et appartient à l'utilisateur
    const comment = await model.findUnique({
      where: { id: commentId },
      select: { userId: true },
    })

    if (!comment) {
      throw createError({
        status: 404,
        message: 'Commentaire non trouvé',
      })
    }

    if (comment.userId !== event.context.user?.id) {
      throw createError({
        status: 403,
        message: 'Vous ne pouvez supprimer que vos propres commentaires',
      })
    }

    // Supprimer le commentaire
    await model.delete({ where: { id: commentId } })

    return {
      success: true,
      message: 'Commentaire supprimé avec succès',
    }
  } catch (error: unknown) {
    console.error(`Erreur lors de la suppression du commentaire:`, error)

    if (isHttpError(error)) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Erreur lors de la suppression du commentaire',
      cause: error,
    })
  }
}
