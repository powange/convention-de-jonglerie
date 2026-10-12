import { test as setup } from '@nuxt/test-utils/playwright'

import { authFileLangue } from '../../../playwright.config'
import { creerUnCompteE2E } from './creer-compte-e2e'

const timestamp = Date.now()

/**
 * Un SECOND compte, pour la seule spec qui change la langue du profil — constat CI·4.
 *
 * ⚠️ `PUT /api/profile/update` remplace le profil entier. Partagé avec `profile.spec.ts`, le
 * compte principal voyait donc ses allergies effacées par le réglage de la langue, et
 * inversement — une mise à jour perdue, qui n'était tenue à distance que par un `workers: 1`
 * sur tout le projet. Deux comptes rendent les deux specs réellement indépendantes.
 *
 * 📍 Pas de fichier d'identifiants ici : ce compte ne se reconnecte jamais par le formulaire,
 * c'est l'affaire de `login.spec.ts`, qui emploie le compte principal.
 */
setup('create language account and authenticate', async ({ page, goto }) => {
  await creerUnCompteE2E(
    page,
    goto,
    {
      email: `e2e-langue-${timestamp}@example.com`,
      motDePasse: 'TestPass123!',
      pseudo: `E2ELangue${timestamp}`,
    },
    { sessionFile: authFileLangue }
  )
})
