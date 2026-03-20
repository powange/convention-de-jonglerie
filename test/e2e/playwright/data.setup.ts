import fs from 'node:fs'
import path from 'node:path'

import { test as setup } from '@nuxt/test-utils/playwright'

import { conventionStateFile } from '../../../playwright.config'

const timestamp = Date.now()
const CONVENTION_NAME = `E2E Convention ${timestamp}`

/**
 * Crée une convention et une édition via l'API pour les tests qui en ont besoin.
 * Plus rapide et fiable que de passer par l'UI.
 */
setup('create convention and edition via API', async ({ page }) => {
  // page.request utilise les cookies du storageState automatiquement

  // Créer la convention via l'API
  const conventionResponse = await page.request.post('http://localhost:3000/api/conventions', {
    data: { name: CONVENTION_NAME },
  })

  if (!conventionResponse.ok()) {
    throw new Error(
      `Création convention échouée (${conventionResponse.status()}): ${await conventionResponse.text()}`
    )
  }

  const conventionBody = await conventionResponse.json()
  const conventionId = conventionBody.data?.id || conventionBody.id

  // Créer l'édition via l'API (dates futures, adresse minimale)
  const startDate = new Date()
  startDate.setDate(startDate.getDate() + 7)
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 9)

  const editionResponse = await page.request.post('http://localhost:3000/api/editions', {
    data: {
      conventionId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      addressLine1: '123 Rue du Cirque',
      postalCode: '75001',
      city: 'Paris',
      country: 'France',
    },
  })

  if (!editionResponse.ok()) {
    throw new Error(
      `Création édition échouée (${editionResponse.status()}): ${await editionResponse.text()}`
    )
  }

  const editionBody = await editionResponse.json()
  const editionId = editionBody.data?.id || editionBody.id

  // Sauvegarder l'état pour les tests
  fs.mkdirSync(path.dirname(conventionStateFile), { recursive: true })
  fs.writeFileSync(
    conventionStateFile,
    JSON.stringify({
      conventionId: conventionId.toString(),
      editionId: editionId.toString(),
      name: CONVENTION_NAME,
    })
  )
})
