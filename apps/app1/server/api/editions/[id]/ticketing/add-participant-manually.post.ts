import { createHash } from 'crypto'

import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { applyCustomName } from '#server/utils/editions/ticketing/tiers'
import { canAccessEditionDataOrAccessControl } from '#server/utils/permissions/edition-permissions'
import { schemaAdresseEmail } from '~~/shared/utils/adresse-email'

const itemSchema = z.object({
  tierId: z.number(),
  quantity: z.number().min(1),
  /**
   * Montant personnalisé, EN CENTIMES, pour un tarif à prix libre.
   *
   * ⚠️ `z.number()` seul acceptait n'importe quoi : un négatif (qui retirait de l'argent au total
   * de la commande), un décimal (`12.5` centime, que la base tronque sans rien dire), et un
   * montant pour un tarif à PRIX FIXE — où il écrasait silencieusement le prix affiché à la
   * personne au guichet.
   *
   * `int()` parce que l'unité est le centime : un « demi-centime » n'existe pas, et l'accepter
   * produit un total qui ne se recoupe avec aucun encaissement. `min(0)` parce qu'un billet ne
   * rapporte pas d'argent négatif ; zéro reste permis — un tarif à prix libre peut être offert.
   *
   * Les BORNES du tarif (`minAmount`/`maxAmount`), elles, sont vérifiées côté serveur plus bas :
   * elles dépendent du tarif visé, que le schéma ne connaît pas.
   */
  customAmount: z.number().int().min(0).optional(),
  customParticipants: z
    .array(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: schemaAdresseEmail,
        customFields: z
          .array(
            z.object({
              optionId: z.number().optional(), // ID de l'option (pour les billets créés manuellement)
              /**
               * L'identifiant interne du champ personnalisé.
               *
               * L'écran l'envoyait DÉJÀ ; ce schéma ne le déclarait pas, et zod retire en silence
               * les clés inconnues. L'instantané du billet ne gardait donc que le libellé, et
               * renommer le champ détachait le billet de ses quotas. Le déclarer suffit à le
               * conserver — il part ensuite tel quel dans `customFields`.
               */
              customFieldId: z.number().optional(),
              name: z.string(),
              answer: z.string(),
            })
          )
          .optional(),
      })
    )
    .optional(),
})

const bodySchema = z.object({
  // Informations de l'acheteur (payeur)
  payerFirstName: z.string().min(1),
  payerLastName: z.string().min(1),
  payerEmail: schemaAdresseEmail,
  // Liste des tarifs sélectionnés avec quantités et participants personnalisés
  items: z.array(itemSchema).min(1),
  // Type de paiement (cash, card, check) ou null si non payé
  paymentMethod: z.enum(['cash', 'card', 'check']).nullable().default(null),
  // Numéro de chèque (uniquement si paymentMethod = 'check')
  checkNumber: z.string().optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions (gestionnaires OU bénévoles en créneau actif de contrôle d'accès :
    // c'est à l'entrée qu'on inscrit un arrivant et qu'on regarde si un tarif est complet)
    const allowed = await canAccessEditionDataOrAccessControl(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer la billeterie',
      })

    const body = bodySchema.parse(await readBody(event))

    try {
      // Vérifier que l'édition existe
      const edition = await prisma.edition.findUnique({
        where: { id: editionId },
        select: {
          id: true,
          name: true,
          convention: {
            select: {
              name: true,
            },
          },
        },
      })

      if (!edition) {
        throw createError({
          status: 404,
          message: 'Edition introuvable',
        })
      }

      // Récupérer les tarifs demandés (externes et manuels)
      const tierIds = body.items.map((item) => item.tierId)
      const uniqueTierIds = [...new Set(tierIds)]
      const tiers = await prisma.ticketingTier.findMany({
        where: {
          id: { in: uniqueTierIds },
          editionId: editionId,
        },
        select: {
          id: true,
          name: true,
          customName: true,
          price: true,
          /*
           * Les bornes du prix libre. Sans elles, `customAmount` était accepté pour TOUT tarif et
           * sans limite : on pouvait enregistrer 1 centime sur une entrée à 20 €, ou 1 € sur un
           * tarif à prix libre dont le minimum est 5 €. Le guichet affiche pourtant le prix du
           * tarif, et c'est `order.amount` que lisent les totaux par moyen de paiement.
           */
          minAmount: true,
          maxAmount: true,
        },
      })

      if (tiers.length !== uniqueTierIds.length) {
        throw createError({
          status: 400,
          message: 'Certains tarifs sont invalides',
        })
      }

      // Appliquer le nom personnalisé
      const tiersWithCustomName = tiers.map(applyCustomName)

      // Créer un map des tarifs pour un accès rapide
      const tierMap = new Map(tiersWithCustomName.map((tier) => [tier.id, tier]))

      /*
       * Les options cochées, chargées UNE fois — avec leur prix et leurs repas.
       *
       * Elles étaient relues une par une à l'intérieur de la double boucle de création, et leur prix
       * n'était jamais lu : chaque ligne d'option partait à `amount: 0`. L'écran, lui, affiche et
       * fait payer un total qui les inclut. Une entrée à 20 € avec un tee-shirt à 15 € était donc
       * encaissée 35 € et enregistrée 20 € — et les totaux par moyen de paiement lisent
       * `order.amount`. Le même défaut avait été corrigé pour l'import HelloAsso (« 291 € de
       * bouteilles encaissés sans apparaître »), pas pour la saisie sur place.
       *
       * Les précharger sert aussi à composer le montant de la commande AVANT de la créer : elle est
       * écrite avant ses lignes, et son total devait donc déjà connaître les options.
       */
      const idsOptionsChoisies = [
        ...new Set(
          body.items.flatMap((item) =>
            (item.customParticipants || []).flatMap((participant) =>
              (participant.customFields || [])
                .filter((champ) => champ.optionId)
                .map((champ) => champ.optionId as number)
            )
          )
        ),
      ]
      const optionsChoisies = idsOptionsChoisies.length
        ? await prisma.ticketingOption.findMany({
            /*
             * ⚠️ BORNÉ À L'ÉDITION. La requête ne filtrait que sur l'identifiant : un `optionId`
             * appartenant à une AUTRE édition était chargé, son prix entrait dans le total, et son
             * association était écrite sur le billet. Rien ne le signalait — l'option existe, elle
             * a un prix, elle a des repas ; elle n'est simplement pas de cette édition.
             *
             * Conséquences concrètes : un repas d'une autre convention se retrouvait dû, et les
             * quotas de l'édition comptaient une option qui ne leur appartient pas.
             */
            where: { id: { in: idsOptionsChoisies }, editionId },
            include: { meals: { include: { meal: true } } },
          })
        : []

      /*
       * Et on REFUSE, plutôt que d'ignorer : la même règle que pour les tarifs juste au-dessus.
       * Ignorer en silence donnerait une commande au total plus faible que ce que le guichet a
       * affiché, sans que personne ne sache pourquoi — le pire des deux mondes, puisque
       * l'encaissement, lui, a bien eu lieu.
       */
      if (optionsChoisies.length !== idsOptionsChoisies.length) {
        throw createError({
          status: 400,
          message: 'Certaines options sont invalides',
        })
      }

      const optionParId = new Map(optionsChoisies.map((option) => [option.id, option]))

      /** Le prix d'une option, en centimes. `null` en base veut dire « gratuite ». */
      const prixDeLOption = (optionId: number) => optionParId.get(optionId)?.price ?? 0

      /**
       * Le prix retenu pour une ligne, en centimes.
       *
       * ⚠️ `customAmount` N'EST RETENU QUE SUR UN TARIF À PRIX LIBRE. Le code écrivait
       * `item.customAmount ?? tier?.price`, donc un montant personnalisé écrasait le prix de
       * N'IMPORTE QUEL tarif — y compris une entrée à prix fixe. Le guichet affiche pourtant le
       * prix du tarif, et c'est `order.amount` que lisent les totaux par moyen de paiement : on
       * encaissait 20 € et on enregistrait ce que le client avait envoyé.
       *
       * La règle du prix libre est celle de `isFreePrice` (`layers/ticketing/app/utils/ticketing`) :
       * `minAmount` ou `maxAmount` non nul. Elle n'est pas recopiée en important cet util — il vit
       * dans un layer côté APPLICATION, hors de portée du serveur — mais la condition est
       * identique, et le commentaire le dit pour que les deux se retrouvent.
       *
       * Hors des bornes, on REFUSE. Accepter 1 € sur un tarif dont le minimum est 5 € créerait un
       * billet valide à un prix que la billetterie n'autorise pas, et que rien ne rattraperait.
       */
      const prixDeLaLigne = (item: (typeof body.items)[number]) => {
        const tier = tierMap.get(item.tierId)
        const prixFixe = tier?.price ?? 0

        if (item.customAmount === undefined) return prixFixe

        const prixLibre = tier?.minAmount != null || tier?.maxAmount != null
        // Tarif à prix FIXE : le montant envoyé est ignoré, sans erreur — l'écran peut l'envoyer
        // par habitude, et refuser la commande pour cela bloquerait un guichet sans raison.
        if (!prixLibre) return prixFixe

        const min = tier?.minAmount ?? 0
        const max = tier?.maxAmount ?? Number.POSITIVE_INFINITY
        if (item.customAmount < min || item.customAmount > max) {
          throw createError({
            status: 400,
            // Lisible à l'écran : `AddParticipantModal.vue` affiche ce message tel quel.
            message: `Le montant saisi pour « ${tier?.name ?? 'ce tarif'} » doit être compris entre ${(min / 100).toFixed(2)} € et ${max === Number.POSITIVE_INFINITY ? '∞' : (max / 100).toFixed(2) + ' €'}`,
          })
        }

        return item.customAmount
      }

      // Calculer le montant total
      const totalAmount = body.items.reduce((sum, item) => {
        const itemPrice = prixDeLaLigne(item)

        /*
         * Les options sont portées par CHAQUE participant, pas par la ligne : deux billets d'un même
         * tarif peuvent avoir des options différentes. On ne peut donc pas multiplier par la
         * quantité — il faut additionner participant par participant, exactement comme la boucle de
         * création le fera.
         */
        const participants = item.customParticipants || []
        let optionsDeLaLigne = 0
        for (let rang = 0; rang < item.quantity; rang++) {
          for (const champ of participants[rang]?.customFields || []) {
            if (champ.optionId) optionsDeLaLigne += prixDeLOption(champ.optionId as number)
          }
        }

        return sum + itemPrice * item.quantity + optionsDeLaLigne
      }, 0)

      // Créer la date de commande
      const orderDate = new Date()

      // Générer le QR code unique basé sur email + date
      const hashInput = `${body.payerEmail}-${orderDate.toISOString()}`
      const hash = createHash('sha256').update(hashInput).digest('hex').substring(0, 16)
      const qrCode = `onsite-${hash}`

      // Créer la commande
      const order = await prisma.ticketingOrder.create({
        data: {
          editionId: editionId,
          externalTicketingId: null,
          helloAssoOrderId: null,
          payerFirstName: body.payerFirstName,
          payerLastName: body.payerLastName,
          payerEmail: body.payerEmail,
          amount: totalAmount,
          status: body.paymentMethod ? 'Onsite' : 'Pending',
          paymentMethod: body.paymentMethod,
          checkNumber: body.checkNumber || null,
          orderDate,
        },
      })

      // Créer les items de commande
      const orderItems = []
      for (const item of body.items) {
        const tier = tierMap.get(item.tierId)!
        const customParticipants = item.customParticipants || []
        /*
         * ⚠️ LE MÊME CALCUL QUE POUR LE TOTAL, par la même fonction. Les deux endroits écrivaient
         * `item.customAmount ?? tier.price` chacun de leur côté : appliquer la nouvelle règle à un
         * seul aurait fait diverger le total de la commande et le prix de ses lignes — un écart
         * qui ne lève aucune erreur, et que seul un rapprochement comptable révèle.
         *
         * C'est exactement le défaut qui s'est déjà produit dans ce fichier, quand les options
         * entraient dans le total sans entrer dans les lignes.
         */
        const itemPrice = prixDeLaLigne(item)

        // Créer un item pour chaque quantité
        for (let i = 0; i < item.quantity; i++) {
          const participant = customParticipants[i] || {
            firstName: body.payerFirstName,
            lastName: body.payerLastName,
            email: body.payerEmail,
            customFields: undefined,
          }

          // Séparer les options des vrais customFields
          const allCustomFields = participant.customFields || []
          const optionFields = allCustomFields.filter((field) => field.optionId)
          const realCustomFields = allCustomFields.filter((field) => !field.optionId)

          const orderItem = await prisma.ticketingOrderItem.create({
            data: {
              orderId: order.id,
              helloAssoItemId: null,
              tierId: tier.id,
              firstName: participant.firstName,
              lastName: participant.lastName,
              email: participant.email,
              name: tier.name,
              type: 'Registration',
              amount: itemPrice,
              state: body.paymentMethod ? 'Processed' : 'Pending',
              qrCode, // Même QR code pour tous les items de la commande
              entryValidated: false,
              customFields: realCustomFields.length > 0 ? realCustomFields : null,
            },
          })

          // Créer les associations d'options et les accès repas
          if (optionFields.length > 0) {
            for (const optionField of optionFields) {
              // L'option vient de la lecture unique faite plus haut : la relire ici faisait une
              // requête par option et par participant, et son prix restait pourtant ignoré.
              const option = optionParId.get(optionField.optionId as number)

              if (option) {
                // Créer l'association orderItem <-> option
                await prisma.ticketingOrderItemOption.create({
                  data: {
                    orderItemId: orderItem.id,
                    optionId: option.id,
                    // Le prix réellement encaissé, et non zéro : c'est lui que totalise
                    // `montantTotalDeLaLigne` et que retrouvent les totaux par moyen de paiement.
                    amount: option.price ?? 0,
                    customFields: null,
                  },
                })

                // Créer les accès repas si l'option donne accès à des repas
                if (option.meals && option.meals.length > 0) {
                  for (const mealRelation of option.meals) {
                    await prisma.ticketingOrderItemMeal.create({
                      data: {
                        orderItemId: orderItem.id,
                        mealId: mealRelation.mealId,
                      },
                    })
                  }
                }
              }
            }
          }

          orderItems.push(orderItem)
        }
      }

      // Retourner le QR code pour redirection
      return createSuccessResponse({
        qrCode,
        order: {
          id: order.id,
          payerFirstName: order.payerFirstName,
          payerLastName: order.payerLastName,
          payerEmail: order.payerEmail,
          amount: order.amount,
          itemCount: orderItems.length,
        },
      })
    } catch (error: unknown) {
      console.error("Erreur lors de l'ajout manuel du participant:", error)
      throw error
    }
  },
  { operationName: 'POST ticketing add-participant-manually' }
)
