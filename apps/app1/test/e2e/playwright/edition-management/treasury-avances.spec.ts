import { expect, test } from '@nuxt/test-utils/playwright'

import { apiPost, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Avances remboursables : la carte « À rembourser » et son détail par personne.
 *
 * Demandé par les organisateurs : une dépense avancée de sa poche est réglée du point de vue du
 * fournisseur, mais l'association doit ce montant à la personne. Cette dette n'apparaissait dans
 * aucun total, et sans agrégat le montant global ne se lisait nulle part.
 *
 * Le parcours passe par l'interface plutôt que par l'API : le calcul est déjà couvert par des
 * tests unitaires, ce qui reste à prouver c'est que la carte affiche la bonne somme et que son
 * clic ouvre bien le détail.
 */
test.describe.serial('Trésorerie — avances à rembourser', () => {
  test.describe.configure({ timeout: 120000 })

  const MONTANT_A = 4200 // 42,00 €
  const MONTANT_B = 1800 // 18,00 €
  const creees: number[] = []
  let pseudo = ''

  test('prépare deux dépenses avancées par le compte courant', async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { treasuryEnabled: true })

    // Passe par le point dédié : il liste les personnes de l'édition, et vérifie au passage que
    // l'organisateur courant y figure — c'est lui qui avancera les dépenses.
    const candidats = await page.request.get(
      `${BASE}/api/editions/${editionId}/treasury/advance-candidates`
    )
    const corps = await candidats.json()
    const utilisateur = (corps?.data?.users ?? corps?.users ?? [])[0]
    expect(
      utilisateur?.id,
      `aucun candidat à l'avance : ${JSON.stringify(corps).slice(0, 200)}`
    ).toBeTruthy()
    pseudo = utilisateur.pseudo

    for (const montant of [MONTANT_A, MONTANT_B]) {
      const r = await apiPost(page, `${BASE}/api/editions/${editionId}/treasury/entries`, {
        data: {
          kind: 'EXPENSE',
          title: `Avance E2E ${montant}`,
          amount: montant / 100,
          advancedById: utilisateur.id,
        },
      })
      expect(r.ok(), await r.text()).toBe(true)
      creees.push(((await r.json())?.data ?? {}).id)
    }
  })

  test('la carte affiche la somme due, et son clic détaille par personne', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/gestion/treasury`, { waitUntil: 'hydration' })
    await expect(page.getByRole('heading', { name: 'Trésorerie' })).toBeVisible({ timeout: 20000 })

    // 42 + 18 = 60 € dus à la même personne.
    const carte = page.locator('div').filter({ hasText: /^À rembourser/ }).last()
    await expect(carte).toContainText('60', { timeout: 15000 })

    await carte.click()

    const modale = page.getByRole('dialog')
    await expect(modale).toBeVisible({ timeout: 10000 })
    await expect(modale).toContainText(pseudo)
    await expect(modale).toContainText('60')
  })

  test('le bouton « Remboursé » solde les avances de la personne en une fois', async ({ page }) => {
    // La modale est encore ouverte : le test précédent l'a laissée ainsi, et chaque `test()`
    // repart d'une page neuve — on la rouvre donc.
    const { editionId } = loadState()
    await page.goto(`${BASE}/editions/${editionId}/gestion/treasury`)
    await expect(page.getByRole('heading', { name: 'Trésorerie' })).toBeVisible({ timeout: 20000 })

    const carte = page.locator('div').filter({ hasText: /^À rembourser/ }).last()
    await expect(carte).toContainText('60', { timeout: 15000 })
    await carte.click()

    const modale = page.getByRole('dialog')
    await modale.getByRole('button', { name: 'Remboursé' }).first().click()

    // Les DEUX lignes doivent être soldées d'un coup, pas seulement la première : la carte
    // retombe à zéro et la modale se referme d'elle-même.
    await expect(modale).toBeHidden({ timeout: 15000 })
    await expect(carte).toContainText('0', { timeout: 15000 })
    await expect(carte).not.toContainText('60')
  })

  test('nettoyer : retirer les lignes créées', async ({ page }) => {
    const { editionId } = loadState()
    for (const id of creees) {
      if (!id) continue
      await page.request
        .delete(`${BASE}/api/editions/${editionId}/treasury/entries/${id}`)
        .catch(() => {})
    }
    await updateEdition(page, String(editionId), { treasuryEnabled: false })
  })
})
