import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { validateEditionId } from '@@/server/utils/validation-helpers'

interface CustomFieldAnswer {
  name: string
  answer: string
}

interface DistinctCustomField {
  name: string
  values: string[]
}

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })

    // Récupérer tous les items de commandes avec customFields non null
    const items = await prisma.ticketingOrderItem.findMany({
      where: {
        order: {
          editionId,
        },
        customFields: {
          not: null,
        },
      },
      select: {
        customFields: true,
      },
    })

    // Extraire les champs distincts et leurs valeurs
    const fieldsMap = new Map<string, Set<string>>()

    for (const item of items) {
      if (!item.customFields || !Array.isArray(item.customFields)) continue

      for (const field of item.customFields as CustomFieldAnswer[]) {
        if (!field.name || !field.answer) continue

        const answer = String(field.answer).trim()
        if (!answer) continue

        if (!fieldsMap.has(field.name)) {
          fieldsMap.set(field.name, new Set())
        }
        fieldsMap.get(field.name)!.add(answer)
      }
    }

    // Convertir en format de réponse
    const result: DistinctCustomField[] = []
    for (const [name, valuesSet] of fieldsMap) {
      result.push({
        name,
        values: Array.from(valuesSet).sort((a, b) => a.localeCompare(b, 'fr')),
      })
    }

    // Trier par nom de champ
    result.sort((a, b) => a.name.localeCompare(b.name, 'fr'))

    return result
  },
  { operationName: 'GET ticketing custom fields distinct values' }
)
