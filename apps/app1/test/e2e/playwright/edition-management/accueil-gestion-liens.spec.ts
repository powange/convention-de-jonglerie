import { expect, test } from '@nuxt/test-utils/playwright'

import { enableVolunteers, loadState, updateVolunteerSettings } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Les échanges de créneaux étaient atteignables par le menu latéral, mais pas depuis l'accueil de
 * la gestion — où l'on va pourtant naturellement chercher ce qu'une édition permet de faire. Une
 * fonctionnalité livrée sans son entrée sur cette page passe inaperçue : d'où ce test, qui ne
 * vérifie pas la page d'échange elle-même mais le chemin qui y mène.
 */
test('l’accueil de gestion mène aux échanges de créneaux', async ({ page }) => {
  const { editionId } = loadState()

  // Le bloc bénévoles n'apparaît qu'avec le bénévolat activé, en mode interne.
  await enableVolunteers(page, editionId)
  await updateVolunteerSettings(page, editionId, { mode: 'INTERNAL' })

  await page.goto(`${BASE}/editions/${editionId}/gestion`, { waitUntil: 'domcontentloaded' })

  const lien = page.getByRole('link', { name: /Échanges de créneaux/i })
  await expect(lien).toBeVisible({ timeout: 20000 })
  await expect(lien).toHaveAttribute('href', `/editions/${editionId}/gestion/volunteers/swaps`)
})
