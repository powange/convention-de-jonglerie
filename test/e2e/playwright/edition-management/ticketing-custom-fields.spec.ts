import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, apiPut, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke fonctionnel des champs personnalisés de la billetterie (custom fields)
 * extraits dans `layers/ticketing`.
 *
 * Exerce le cycle de vie complet via l'API sur deux types de champ :
 *  - `TextInput` (champ texte simple, sans valeurs)
 *  - `ChoiceList` (liste de choix, avec un tableau de `values`)
 *
 * Parcours pour chaque type : activation de la feature → création (POST) →
 * présence dans la liste (GET) → modification (PUT) → vérification → suppression
 * (DELETE) → absence confirmée, suivi d'un nettoyage final.
 *
 * Endpoints couverts :
 *  - POST   /api/editions/:id/ticketing/custom-fields
 *  - GET    /api/editions/:id/ticketing/custom-fields
 *  - PUT    /api/editions/:id/ticketing/custom-fields/:customFieldId
 *  - DELETE /api/editions/:id/ticketing/custom-fields/:customFieldId
 *
 * Notes / hypothèses sur les contrats d'API (relus depuis les handlers) :
 *  - Les réponses utilisent `createSuccessResponse(...)` → `{ success, data, message? }`.
 *    Le POST/PUT renvoient le champ directement dans `body.data` (objet),
 *    le GET renvoie `body.data.customFields` (tableau).
 *    L'extraction reste tolérante (`body.data?.X ?? body.data ?? body`).
 *  - Le schéma zod du POST requiert `label` (string non vide) et `type`
 *    (enum `TextInput | YesNo | ChoiceList | FreeText`). `isRequired` a un défaut
 *    (`false`) au POST mais est requis au PUT. `values` est optionnel (utilisé
 *    par `ChoiceList`).
 *  - Le `type` d'un champ est VERROUILLÉ après création : le PUT renvoie 400 si
 *    on change le type. La modification porte donc sur `label` / `isRequired` /
 *    `values` en renvoyant le même `type`.
 */
test.describe.serial('Module Billetterie — champs personnalisés', () => {
  // IDs créés, conservés pour le nettoyage final (sécurité si un test échoue en cours de route).
  let textFieldId: number | null = null
  let choiceFieldId: number | null = null

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("activer la billetterie via l'API", async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { ticketingEnabled: true })
  })

  // ──────────────────────────────────────────────
  // Type 1 : TextInput (champ texte simple)
  // ──────────────────────────────────────────────

  test('TextInput : créer un champ personnalisé via API', async ({ page }) => {
    const { editionId } = loadState()

    const response = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/custom-fields`,
      {
        data: {
          label: 'Régime alimentaire E2E',
          type: 'TextInput',
          isRequired: false,
        },
      }
    )
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const field = body.data?.customField ?? body.data ?? body
    textFieldId = field?.id ?? null
    expect(textFieldId).toBeTruthy()
    expect(field.label).toBe('Régime alimentaire E2E')
    expect(field.type).toBe('TextInput')
    expect(field.isRequired).toBe(false)
  })

  test('TextInput : le champ apparaît dans GET custom-fields', async ({ page }) => {
    const { editionId } = loadState()
    if (!textFieldId) throw new Error('textFieldId manquant')

    const response = await page.request.get(
      `${BASE}/api/editions/${editionId}/ticketing/custom-fields`
    )
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const fields = body.data?.customFields ?? body.customFields ?? []
    const found = fields.find((f: { id: number }) => f.id === textFieldId)
    expect(found).toBeTruthy()
    expect(found.label).toBe('Régime alimentaire E2E')
    expect(found.type).toBe('TextInput')
  })

  test('TextInput : modifier le champ (PUT) puis vérifier la persistance', async ({ page }) => {
    const { editionId } = loadState()
    if (!textFieldId) throw new Error('textFieldId manquant')

    // Le `type` est verrouillé après création : on renvoie le même type et on
    // modifie `label` + `isRequired` (passe à true).
    const put = await apiPut(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/custom-fields/${textFieldId}`,
      {
        data: {
          label: 'Régime alimentaire E2E (modifié)',
          type: 'TextInput',
          isRequired: true,
        },
      }
    )
    expect(put.ok()).toBe(true)

    const putBody = await put.json()
    const updated = putBody.data?.customField ?? putBody.data ?? putBody
    expect(updated.label).toBe('Régime alimentaire E2E (modifié)')
    expect(updated.isRequired).toBe(true)

    // Relecture via GET pour confirmer la persistance.
    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/custom-fields`)
    expect(get.ok()).toBe(true)
    const body = await get.json()
    const fields = body.data?.customFields ?? body.customFields ?? []
    const found = fields.find((f: { id: number }) => f.id === textFieldId)
    expect(found).toBeTruthy()
    expect(found.label).toBe('Régime alimentaire E2E (modifié)')
    expect(found.isRequired).toBe(true)
  })

  test('TextInput : supprimer le champ (DELETE) puis vérifier son absence', async ({ page }) => {
    const { editionId } = loadState()
    if (!textFieldId) throw new Error('textFieldId manquant')

    const del = await apiDelete(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/custom-fields/${textFieldId}`
    )
    expect(del.ok()).toBe(true)

    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/custom-fields`)
    expect(get.ok()).toBe(true)
    const body = await get.json()
    const fields = body.data?.customFields ?? body.customFields ?? []
    expect(fields.some((f: { id: number }) => f.id === textFieldId)).toBe(false)

    // Champ bien supprimé : on neutralise l'id pour le cleanup final.
    textFieldId = null
  })

  // ──────────────────────────────────────────────
  // Type 2 : ChoiceList (liste de choix avec `values`)
  // ──────────────────────────────────────────────

  test('ChoiceList : créer un champ avec des valeurs via API', async ({ page }) => {
    const { editionId } = loadState()

    const response = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/custom-fields`,
      {
        data: {
          label: 'Taille de t-shirt E2E',
          type: 'ChoiceList',
          isRequired: true,
          values: ['S', 'M', 'L'],
        },
      }
    )
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const field = body.data?.customField ?? body.data ?? body
    choiceFieldId = field?.id ?? null
    expect(choiceFieldId).toBeTruthy()
    expect(field.label).toBe('Taille de t-shirt E2E')
    expect(field.type).toBe('ChoiceList')
    expect(field.isRequired).toBe(true)
    expect(field.values).toEqual(['S', 'M', 'L'])
  })

  test('ChoiceList : le champ apparaît dans GET custom-fields', async ({ page }) => {
    const { editionId } = loadState()
    if (!choiceFieldId) throw new Error('choiceFieldId manquant')

    const response = await page.request.get(
      `${BASE}/api/editions/${editionId}/ticketing/custom-fields`
    )
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const fields = body.data?.customFields ?? body.customFields ?? []
    const found = fields.find((f: { id: number }) => f.id === choiceFieldId)
    expect(found).toBeTruthy()
    expect(found.type).toBe('ChoiceList')
    expect(found.values).toEqual(['S', 'M', 'L'])
  })

  test('ChoiceList : modifier les valeurs (PUT) puis vérifier la persistance', async ({ page }) => {
    const { editionId } = loadState()
    if (!choiceFieldId) throw new Error('choiceFieldId manquant')

    // Même type (verrouillé), on retire 'L' et on ajoute 'XL'.
    const put = await apiPut(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/custom-fields/${choiceFieldId}`,
      {
        data: {
          label: 'Taille de t-shirt E2E (modifié)',
          type: 'ChoiceList',
          isRequired: false,
          values: ['S', 'M', 'XL'],
        },
      }
    )
    expect(put.ok()).toBe(true)

    const putBody = await put.json()
    const updated = putBody.data?.customField ?? putBody.data ?? putBody
    expect(updated.label).toBe('Taille de t-shirt E2E (modifié)')
    expect(updated.isRequired).toBe(false)
    expect(updated.values).toEqual(['S', 'M', 'XL'])

    // Relecture via GET pour confirmer la persistance.
    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/custom-fields`)
    expect(get.ok()).toBe(true)
    const body = await get.json()
    const fields = body.data?.customFields ?? body.customFields ?? []
    const found = fields.find((f: { id: number }) => f.id === choiceFieldId)
    expect(found).toBeTruthy()
    expect(found.label).toBe('Taille de t-shirt E2E (modifié)')
    expect(found.values).toEqual(['S', 'M', 'XL'])
  })

  test('ChoiceList : supprimer le champ (DELETE) puis vérifier son absence', async ({ page }) => {
    const { editionId } = loadState()
    if (!choiceFieldId) throw new Error('choiceFieldId manquant')

    const del = await apiDelete(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/custom-fields/${choiceFieldId}`
    )
    expect(del.ok()).toBe(true)

    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/custom-fields`)
    expect(get.ok()).toBe(true)
    const body = await get.json()
    const fields = body.data?.customFields ?? body.customFields ?? []
    expect(fields.some((f: { id: number }) => f.id === choiceFieldId)).toBe(false)

    choiceFieldId = null
  })

  // ──────────────────────────────────────────────
  // Nettoyage final
  // ──────────────────────────────────────────────

  test('nettoyage : supprimer les champs restants et désactiver la billetterie', async ({
    page,
  }) => {
    const { editionId } = loadState()

    // Filet de sécurité : supprime les champs qui n'auraient pas été nettoyés
    // (si un test de suppression a échoué en amont).
    for (const id of [textFieldId, choiceFieldId]) {
      if (id) {
        await apiDelete(
          page,
          `${BASE}/api/editions/${editionId}/ticketing/custom-fields/${id}`
        ).catch(() => {})
      }
    }
    textFieldId = null
    choiceFieldId = null

    await updateEdition(page, String(editionId), { ticketingEnabled: false })
  })
})
