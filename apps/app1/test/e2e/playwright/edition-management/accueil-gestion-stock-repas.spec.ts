import { expect, test } from '@nuxt/test-utils/playwright'

import { loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Trois pages que la barre latérale offrait et que l'accueil de gestion ne proposait pas.
 *
 * ⚠️ POURQUOI CE TEST EXISTE. C'est la DEUXIÈME fois que cette dérive est signalée — la première
 * avait donné `accueil-gestion-liens.spec.ts`, pour les échanges de créneaux. Les deux listes
 * sont écrites à la main, à deux endroits et dans deux syntaxes différentes : rien ne les relie.
 *
 * 📍 La parité des trois listes (barre, accueil, registre des modules) est désormais tenue par un
 * test unitaire, `parite-liens-gestion.test.ts`, qui coûte 4 ms et nomme l'écart. Celui-ci couvre
 * ce que le unitaire ne peut pas voir : que les cartes sont bel et bien RENDUES, avec leur
 * libellé traduit — une clé hors du domaine chargé s'afficherait brute, sans erreur.
 */
test('l’accueil de gestion mène aux emprunts, aux manquants et aux doublons de repas', async ({
  page,
}) => {
  const { editionId } = loadState()

  // Les deux sections n'existent que modules activés. L'édition E2E est partagée : on les laisse
  // allumés, comme le font les autres specs de stock et de repas.
  await updateEdition(page, String(editionId), { stockEnabled: true, mealsEnabled: true })

  await page.goto(`${BASE}/editions/${editionId}/gestion`, { waitUntil: 'domcontentloaded' })

  const attendus: [RegExp, string][] = [
    [/Emprunts/i, `/editions/${editionId}/gestion/stock/loans`],
    [/Ce qui manque/i, `/editions/${editionId}/gestion/stock/missing`],
    [/Doublons de repas/i, `/editions/${editionId}/gestion/meals/duplicates`],
  ]

  for (const [libelle, href] of attendus) {
    // Par IDENTITÉ — le libellé tel que l'organisateur le lit —, et on vérifie la destination :
    // une carte visible qui pointe ailleurs serait pire qu'une carte absente.
    const lien = page.getByRole('link', { name: libelle }).first()
    await expect(lien, `carte « ${libelle.source} »`).toBeVisible({ timeout: 20000 })
    await expect(lien).toHaveAttribute('href', href)
  }
})
