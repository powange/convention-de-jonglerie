import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, apiPut, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke fonctionnel des quotas & options de la billetterie (layer `ticketing`).
 *
 * Couvre le CRUD complet via l'API (round-trips POST → GET → PUT → GET → DELETE → GET) :
 *  - Quotas : pas de pré-requis (création directe).
 *  - Options : nécessitent une configuration de billetterie externe préexistante
 *    (`createOption` lève une 400 « Aucune configuration de billeterie externe trouvée »
 *    sinon). On crée donc une config HelloAsso minimale en amont, puis on la supprime au cleanup.
 *  - Lien tarif↔quota : création d'un tarif avec `quotaIds: [quotaId]` et vérification du
 *    join `TicketingTierQuota` exposé dans GET tiers (`tier.quotas[].quotaId`).
 *
 * Formes de réponse (toutes enveloppées par `createSuccessResponse(data)` → `{ success, data }`) :
 *  - POST/PUT quota → `data` EST le quota (pas `data.quota`).
 *  - GET quotas    → `data.quotas`.
 *  - POST/PUT option → `data.option`.
 *  - GET options   → `data.options`.
 *  - POST tier     → `data.tier`. GET tiers → `data.tiers`.
 * Extraction volontairement tolérante pour rester robuste aux variations d'enveloppe.
 */
test.describe.serial('Module Billetterie — quotas & options', () => {
  let quotaId: number | null = null
  let optionId: number | null = null
  let tierId: number | null = null
  // Config de billetterie externe créée pour permettre la création d'options.
  let externalConfigCreated = false

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("activer la billetterie via l'API", async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { ticketingEnabled: true })
  })

  // ──────────────────────────────────────────────
  // Quotas : CRUD complet
  // ──────────────────────────────────────────────

  test('quotas : créer (POST) puis le retrouver dans GET', async ({ page }) => {
    const { editionId } = loadState()

    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/quotas`, {
      data: { title: 'Quota E2E', description: 'Quota de test E2E', quantity: 50 },
    })
    expect(response.ok()).toBe(true)
    const body = await response.json()
    // POST quota → `createSuccessResponse(quota)` : le quota est directement dans `data`.
    const quota = body.data?.quota ?? body.data ?? body
    quotaId = quota?.id
    expect(quotaId).toBeTruthy()
    expect(quota.title).toBe('Quota E2E')
    expect(quota.quantity).toBe(50)

    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/quotas`)
    expect(get.ok()).toBe(true)
    const getBody = await get.json()
    const quotas = getBody.data?.quotas ?? getBody.data ?? getBody.quotas ?? []
    expect(quotas.some((q: { id: number }) => q.id === quotaId)).toBe(true)
  })

  test('quotas : modifier (PUT) puis vérifier la persistance', async ({ page }) => {
    const { editionId } = loadState()
    if (!quotaId) throw new Error('quotaId manquant')

    const put = await apiPut(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/quotas/${quotaId}`,
      { data: { title: 'Quota E2E modifié', description: 'Maj E2E', quantity: 75 } }
    )
    expect(put.ok()).toBe(true)
    const putBody = await put.json()
    const updated = putBody.data?.quota ?? putBody.data ?? putBody
    expect(updated.title).toBe('Quota E2E modifié')
    expect(updated.quantity).toBe(75)

    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/quotas`)
    expect(get.ok()).toBe(true)
    const getBody = await get.json()
    const quotas = getBody.data?.quotas ?? getBody.data ?? getBody.quotas ?? []
    const found = quotas.find((q: { id: number }) => q.id === quotaId)
    expect(found).toBeTruthy()
    expect(found.title).toBe('Quota E2E modifié')
    expect(found.quantity).toBe(75)
  })

  // ──────────────────────────────────────────────
  // Options : nécessitent une config billetterie externe
  // ──────────────────────────────────────────────

  test('options : préparer une config billetterie externe (HelloAsso minimale)', async ({
    page,
  }) => {
    const { editionId } = loadState()

    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/external`, {
      data: {
        provider: 'HELLOASSO',
        helloAsso: {
          clientId: 'e2e-client-id',
          clientSecret: 'e2e-client-secret',
          organizationSlug: 'e2e-orga',
          formType: 'Event',
          formSlug: 'e2e-form',
        },
      },
    })
    expect(response.ok()).toBe(true)
    externalConfigCreated = true

    // GET confirme la présence de la config (pré-requis à la création d'options).
    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/external`)
    expect(get.ok()).toBe(true)
    const getBody = await get.json()
    const data = getBody.data ?? getBody
    expect(data.hasConfig).toBe(true)
  })

  test('options : créer (POST) puis la retrouver dans GET', async ({ page }) => {
    const { editionId } = loadState()

    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/options`, {
      data: {
        name: 'Option E2E',
        description: 'Option de test E2E',
        type: 'CHECKBOX',
        isRequired: false,
        price: 500,
      },
    })
    expect(response.ok()).toBe(true)
    const body = await response.json()
    // POST option → `createSuccessResponse({ option })`.
    const option = body.data?.option ?? body.data ?? body
    optionId = option?.id
    expect(optionId).toBeTruthy()
    expect(option.name).toBe('Option E2E')

    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/options`)
    expect(get.ok()).toBe(true)
    const getBody = await get.json()
    const options = getBody.data?.options ?? getBody.data ?? getBody.options ?? []
    expect(options.some((o: { id: number }) => o.id === optionId)).toBe(true)
  })

  test('options : modifier (PUT) puis vérifier la persistance', async ({ page }) => {
    const { editionId } = loadState()
    if (!optionId) throw new Error('optionId manquant')

    const put = await apiPut(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/options/${optionId}`,
      {
        data: {
          name: 'Option E2E modifiée',
          description: 'Maj E2E',
          type: 'CHECKBOX',
          isRequired: true,
          price: 750,
        },
      }
    )
    expect(put.ok()).toBe(true)
    const putBody = await put.json()
    const updated = putBody.data?.option ?? putBody.data ?? putBody
    expect(updated.name).toBe('Option E2E modifiée')

    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/options`)
    expect(get.ok()).toBe(true)
    const getBody = await get.json()
    const options = getBody.data?.options ?? getBody.data ?? getBody.options ?? []
    const found = options.find((o: { id: number }) => o.id === optionId)
    expect(found).toBeTruthy()
    expect(found.name).toBe('Option E2E modifiée')
    expect(found.isRequired).toBe(true)
  })

  // ──────────────────────────────────────────────
  // Bonus : lien tarif ↔ quota
  // ──────────────────────────────────────────────

  test('tarif ↔ quota : lier un quota à un tarif et vérifier le lien', async ({ page }) => {
    const { editionId } = loadState()
    if (!quotaId) throw new Error('quotaId manquant')

    // La création d'un tarif n'accepte plus `quotaIds` : les quotas se rattachent par leur
    // endpoint dédié, seul chemin d'écriture depuis que leur édition a sa propre page. Passer
    // par le POST les aurait silencieusement ignorés.
    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/tiers`, {
      data: { name: 'Tarif lié quota E2E', price: 2000 },
    })
    expect(response.ok()).toBe(true)
    const body = await response.json()
    const tier = body.data?.tier ?? body.data ?? body
    tierId = tier?.id
    expect(tierId).toBeTruthy()

    const association = await apiPut(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/tiers/${tierId}/quotas`,
      { data: { quotaIds: [quotaId] } }
    )
    expect(association.ok(), `association : ${await association.text()}`).toBe(true)

    // GET tiers → chaque tier inclut `quotas: [{ quotaId, quota: {…} }]` (join TicketingTierQuota).
    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/tiers`)
    expect(get.ok()).toBe(true)
    const getBody = await get.json()
    const tiers = getBody.data?.tiers ?? getBody.data ?? getBody.tiers ?? []
    const found = tiers.find((t: { id: number }) => t.id === tierId)
    expect(found).toBeTruthy()
    const quotaLinks: Array<{ quotaId?: number; quota?: { id: number } }> = found.quotas ?? []
    expect(quotaLinks.some((link) => link.quotaId === quotaId || link.quota?.id === quotaId)).toBe(
      true
    )
  })

  // ──────────────────────────────────────────────
  // Assertion UI légère
  // ──────────────────────────────────────────────

  /**
   * L'onglet des options rendait « _ctx.money is not a function » dans la console : le gabarit
   * appelait `money(...)` alors que `useEditionCurrency` n'était pas appelé dans ce composant.
   * Le prix d'une option suffisait à casser le rendu.
   *
   * Placé ICI et non plus bas : une option exige une configuration de billetterie externe, que le
   * nettoyage de ce bloc supprime. C'est le seul endroit du fichier où la fixture existe.
   */
  test('l’onglet des options s’affiche sans erreur de console', async ({ page, goto }) => {
    const { editionId } = loadState()

    const erreurs: string[] = []
    page.on('pageerror', (erreur) => erreurs.push(erreur.message))
    page.on('console', (message) => {
      if (message.type() === 'error') erreurs.push(message.text())
    })

    await goto(`/editions/${editionId}/gestion/ticketing/tiers#options`, {
      waitUntil: 'hydration',
    })
    // L'option créée plus haut porte un prix : c'est son affichage qui déclenchait l'appel fautif.
    await expect(page.getByText(/option e2e/i).first()).toBeVisible({ timeout: 15000 })

    expect(
      erreurs.filter((e) => /money is not a function/i.test(e)),
      'le rendu des options ne doit plus appeler une fonction absente'
    ).toEqual([])
  })

  /**
   * Une option créée À LA MAIN ne vient d'aucune billetterie externe.
   *
   * Elle est pourtant rattachée à la configuration externe — `createOption` l'exige — si bien que
   * déduire la provenance de ce rattachement affichait le logo HelloAsso sur une option qu'on
   * venait de saisir soi-même. Ce qui distingue, c'est `helloAssoOptionId`.
   */
  test('une option saisie à la main n’a pas de fournisseur', async ({ page }) => {
    const { editionId } = loadState()

    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/options`)
    expect(get.ok()).toBe(true)
    const options = (await get.json()).data?.options ?? []
    const nôtre = options.find((o: { id: number }) => o.id === optionId)

    expect(nôtre, 'l’option créée plus haut devrait être là').toBeTruthy()
    expect(nôtre.provider, 'une option saisie ici ne vient d’aucune billetterie externe').toBeNull()
  })

  test('UI : la page Tarifs et options est accessible', async ({ page, goto }) => {
    const { editionId } = loadState()

    // Re-navigue jusqu'à ce que le heading apparaisse (évite la flakiness d'hydratation).
    await expect(async () => {
      await goto(`/editions/${editionId}/gestion/ticketing/tiers`, { waitUntil: 'hydration' })
      // La partie stable du titre, et non son libellé complet : ce dernier vient d'une clé de
      // traduction et a déjà changé une fois, faisant tomber ce test.
      await expect(page.getByRole('heading', { name: /tarifs/i }).first()).toBeVisible({
        timeout: 5000,
      })
    }).toPass({ timeout: 40000, intervals: [2000, 3000, 5000] })
  })

  // ──────────────────────────────────────────────
  // Cleanup : DELETE des entités créées + désactivation
  // ──────────────────────────────────────────────

  test('nettoyage : supprimer tarif, option, quota et config externe', async ({ page }) => {
    const { editionId } = loadState()

    // Tarif lié (le supprimer avant le quota : le tarif référence le quota).
    if (tierId) {
      const del = await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/ticketing/tiers/${tierId}`
      )
      expect(del.ok()).toBe(true)
    }

    // Option → DELETE puis vérifier l'absence dans GET.
    if (optionId) {
      const del = await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/ticketing/options/${optionId}`
      )
      expect(del.ok()).toBe(true)

      const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/options`)
      expect(get.ok()).toBe(true)
      const getBody = await get.json()
      const options = getBody.data?.options ?? getBody.data ?? getBody.options ?? []
      expect(options.some((o: { id: number }) => o.id === optionId)).toBe(false)
    }

    // Quota → DELETE puis vérifier l'absence dans GET.
    if (quotaId) {
      const del = await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/ticketing/quotas/${quotaId}`
      )
      expect(del.ok()).toBe(true)

      const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/quotas`)
      expect(get.ok()).toBe(true)
      const getBody = await get.json()
      const quotas = getBody.data?.quotas ?? getBody.data ?? getBody.quotas ?? []
      expect(quotas.some((q: { id: number }) => q.id === quotaId)).toBe(false)
    }

    // Config billetterie externe → DELETE.
    if (externalConfigCreated) {
      const del = await apiDelete(page, `${BASE}/api/editions/${editionId}/ticketing/external`)
      expect(del.ok()).toBe(true)
    }

    await updateEdition(page, String(editionId), { ticketingEnabled: false })
  })
})

/**
 * La page dédiée aux quotas, et l'association des quotas à un tarif.
 *
 * Le point sensible est l'endpoint : le PUT générique du tarif réécrit `mealIds` sans condition
 * et exige le nom et le prix. N'y envoyer que les quotas effacerait les repas du tarif. D'où un
 * endpoint dédié — et ce test vérifie précisément que les repas survivent.
 */
test.describe.serial('Module Billetterie — quotas associés à un tarif', () => {
  let quotaDeTest: number | null = null
  let champDeTest: number | null = null
  let tarifDeTest: number | null = null

  test('préparer un quota et un tarif', async ({ page }) => {
    const { editionId } = loadState()

    const quota = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/quotas`, {
      data: { title: 'Jauge E2E association', quantity: 30 },
    })
    expect(quota.ok(), `création du quota : ${await quota.text()}`).toBe(true)
    quotaDeTest = ((await quota.json()).data?.quota ?? (await quota.json()).data)?.id
    expect(quotaDeTest).toBeTruthy()

    const tarif = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/tiers`, {
      data: { name: 'Tarif E2E association', price: 1500, position: 0, isActive: true },
    })
    expect(tarif.ok(), `création du tarif : ${await tarif.text()}`).toBe(true)
    tarifDeTest = (await tarif.json()).data?.tier?.id
    expect(tarifDeTest).toBeTruthy()
  })

  test('la page quotas affiche le quota créé', async ({ page, goto }) => {
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/gestion/ticketing/quotas`, { waitUntil: 'hydration' })

    await expect(page.getByTitle('Jauge E2E association')).toBeVisible({ timeout: 15000 })
  })

  test('associer un quota au tarif par l’endpoint dédié', async ({ page }) => {
    const { editionId } = loadState()

    const reponse = await apiPut(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/tiers/${tarifDeTest}/quotas`,
      { data: { quotaIds: [quotaDeTest] } }
    )
    expect(reponse.ok(), `association : ${await reponse.text()}`).toBe(true)

    // Le tarif porte bien le quota.
    const tiers = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/tiers`)
    const liste = (await tiers.json()).data?.tiers ?? []
    const tarif = liste.find((t: { id: number }) => t.id === tarifDeTest)
    expect(tarif?.quotas?.map((q: any) => q.quota.id)).toContain(quotaDeTest)
  })

  test('refuse un quota d’une autre édition', async ({ page }) => {
    const { editionId } = loadState()

    const reponse = await apiPut(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/tiers/${tarifDeTest}/quotas`,
      { data: { quotaIds: [999999] } }
    )

    expect(reponse.status()).toBe(400)
  })

  /**
   * Le piège que ce lot devait éviter.
   *
   * La fenêtre d'édition d'un tarif n'envoie plus `quotaIds` depuis que les quotas se règlent
   * ailleurs. Tant que le schéma mettait cette clé par défaut à `[]`, enregistrer un simple
   * changement de prix effaçait tous les quotas du tarif — sans rien afficher.
   */
  test('modifier un tarif sans envoyer les quotas ne les efface pas', async ({ page }) => {
    const { editionId } = loadState()

    const modification = await apiPut(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/tiers/${tarifDeTest}`,
      { data: { name: 'Tarif E2E association', price: 2000, position: 0, isActive: true } }
    )
    expect(modification.ok(), `modification du tarif : ${await modification.text()}`).toBe(true)

    const tiers = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/tiers`)
    const liste = (await tiers.json()).data?.tiers ?? []
    const tarif = liste.find((t: { id: number }) => t.id === tarifDeTest)

    expect(tarif?.price, 'le prix devrait avoir changé').toBe(2000)
    expect(
      tarif?.quotas?.map((q: any) => q.quota.id),
      'les quotas devraient avoir survécu à la modification du tarif'
    ).toContain(quotaDeTest)
  })

  test('détacher le quota le retire du tarif', async ({ page }) => {
    const { editionId } = loadState()

    const reponse = await apiPut(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/tiers/${tarifDeTest}/quotas`,
      { data: { quotaIds: [] } }
    )
    expect(reponse.ok()).toBe(true)

    const tiers = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/tiers`)
    const liste = (await tiers.json()).data?.tiers ?? []
    const tarif = liste.find((t: { id: number }) => t.id === tarifDeTest)
    expect(tarif?.quotas ?? []).toHaveLength(0)
  })

  /**
   * Les champs personnalisés : l'association y porte un CHOIX de réponse en plus du quota, et le
   * même quota peut donc y figurer deux fois. L'unicité en base porte sur le triplet
   * (champ, quota, choix) — dédoublonner sur le seul quota en perdrait une.
   */
  test('associe un quota à un champ personnalisé, par réponse', async ({ page }) => {
    const { editionId } = loadState()

    const champ = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/custom-fields`, {
      data: { label: 'Champ E2E quotas', type: 'ChoiceList', values: ['Oui', 'Non'] },
    })
    expect(champ.ok(), `création du champ : ${await champ.text()}`).toBe(true)
    const corpsChamp = await champ.json()
    champDeTest = (corpsChamp.data?.customField ?? corpsChamp.data)?.id
    expect(champDeTest).toBeTruthy()

    // Le MÊME quota, sur deux réponses différentes : c'est ce que le triplet permet.
    const reponse = await apiPut(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/custom-fields/${champDeTest}/quotas`,
      {
        data: {
          quotas: [
            { quotaId: quotaDeTest, choiceValue: 'Oui' },
            { quotaId: quotaDeTest, choiceValue: 'Non' },
          ],
        },
      }
    )
    expect(reponse.ok(), `association : ${await reponse.text()}`).toBe(true)
    expect((await reponse.json()).data.quotas).toHaveLength(2)

    const get = await page.request.get(`${BASE}/api/editions/${editionId}/ticketing/custom-fields`)
    const champs = (await get.json()).data?.customFields ?? []
    const nôtre = champs.find((c: { id: number }) => c.id === champDeTest)
    expect(nôtre?.quotas?.map((q: any) => q.choiceValue).sort()).toEqual(['Non', 'Oui'])
  })

  test('refuse un quota d’une autre édition sur un champ personnalisé', async ({ page }) => {
    const { editionId } = loadState()

    const reponse = await apiPut(
      page,
      `${BASE}/api/editions/${editionId}/ticketing/custom-fields/${champDeTest}/quotas`,
      { data: { quotas: [{ quotaId: 999999, choiceValue: null }] } }
    )

    expect(reponse.status()).toBe(400)
  })

  test('nettoyage', async ({ page }) => {
    const { editionId } = loadState()
    if (champDeTest) {
      await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/ticketing/custom-fields/${champDeTest}`
      )
    }
    if (tarifDeTest) {
      await apiDelete(page, `${BASE}/api/editions/${editionId}/ticketing/tiers/${tarifDeTest}`)
    }
    if (quotaDeTest) {
      await apiDelete(page, `${BASE}/api/editions/${editionId}/ticketing/quotas/${quotaDeTest}`)
    }
  })
})
