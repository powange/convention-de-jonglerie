import { expect, test } from '@nuxt/test-utils/playwright'

import {
  apiDelete,
  apiPost,
  enableVolunteers,
  loadState,
  updateVolunteerSettings,
} from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Le tableau des candidatures sur mobile : les détails saisis doivent être atteignables.
 *
 * Ces colonnes — personnes mineures, animaux, véhicule, compétences… — n'affichent qu'un « Oui »
 * suivi d'un petit « i ». Le texte que le bénévole a écrit vivait dans un `UTooltip`, qui ne
 * s'ouvre qu'au SURVOL. Sur un téléphone, où le survol n'existe pas, l'information était
 * purement inatteignable : le « i » ne réagissait à rien. Signalé depuis l'application.
 *
 * D'où un test qui s'exécute sur un vrai appareil tactile, sans souris : c'est la seule
 * configuration où le défaut se manifeste. Le même parcours en desktop resterait vert avec un
 * tooltip, et n'aurait donc rien prouvé.
 */
test.describe.serial('Tableau des candidatures — détails accessibles au toucher', () => {
  // Un téléphone : pas de souris, donc pas de survol possible.
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  test.describe.configure({ timeout: 120000 })

  const DETAIL_MINEURS = 'Deux enfants de 8 et 11 ans'

  test('préparer une candidature portant un détail', async ({ page }) => {
    const { editionId } = loadState()
    await enableVolunteers(page, editionId)
    await updateVolunteerSettings(page, editionId, {
      open: true,
      mode: 'INTERNAL',
      askMinors: true,
    })

    // Repartir d'une ardoise vierge : une candidature existante ferait échouer la création.
    await apiDelete(page, `${BASE}/api/editions/${editionId}/volunteers/applications`).catch(
      () => {}
    )

    const reponse = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/applications`,
      {
        data: {
          motivation: 'Candidature de test',
          phone: '+33612345678',
          nom: 'Mobile',
          prenom: 'Test',
          eventAvailability: true,
          arrivalDateTime: '2026-09-01_morning',
          departureDateTime: '2026-09-03_evening',
          hasMinors: true,
          minorsDetails: DETAIL_MINEURS,
        },
      }
    )
    expect(reponse.status(), `candidature refusée : ${await reponse.text()}`).toBe(200)
  })

  test('le détail est caché, puis révélé par un toucher', async ({ page, goto }) => {
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/gestion/volunteers/applications`, {
      waitUntil: 'hydration',
    })

    // Le déclencheur porte le texte en `aria-label` : atteignable au clavier comme au toucher,
    // là où l'ancien `cursor-help` n'annonçait rien.
    const declencheur = page.locator(`button[aria-label="${DETAIL_MINEURS}"]`).first()
    await expect(declencheur).toBeVisible({ timeout: 30000 })

    const detail = page.getByText(DETAIL_MINEURS, { exact: true }).last()
    await expect(detail).toBeHidden()

    await declencheur.scrollIntoViewIfNeeded()
    await declencheur.tap()

    // Le cœur du test : sans souris, seul un composant ouvrable au clic peut révéler ce texte.
    await expect(detail).toBeVisible({ timeout: 5000 })
  })

  test('nettoyer : retirer la candidature et refermer le recrutement', async ({ page }) => {
    const { editionId } = loadState()
    await apiDelete(page, `${BASE}/api/editions/${editionId}/volunteers/applications`).catch(
      () => {}
    )
    await updateVolunteerSettings(page, editionId, { open: false, askMinors: false })
  })
})
