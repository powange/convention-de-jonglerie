import { test as setup } from '@nuxt/test-utils/playwright'

import { authFile, credentialsFile } from '../../../playwright.config'
import { creerUnCompteE2E } from './creer-compte-e2e'

// Génère un email unique pour chaque exécution des tests
const timestamp = Date.now()

/**
 * Le compte E2E principal — celui de presque tous les tests authentifiés.
 *
 * Le parcours d'inscription lui-même vit dans `creer-compte-e2e.ts`, partagé avec le compte
 * dédié à la spec de la langue : voir son commentaire pour la raison de cette séparation.
 */
setup('create account and authenticate', async ({ page, goto }) => {
  await creerUnCompteE2E(
    page,
    goto,
    {
      email: `e2e-test-${timestamp}@example.com`,
      motDePasse: 'TestPass123!',
      pseudo: `E2ETest${timestamp}`,
    },
    { sessionFile: authFile, credentialsFile }
  )
})
