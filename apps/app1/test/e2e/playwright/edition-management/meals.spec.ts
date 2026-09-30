import { expect, test } from '@nuxt/test-utils/playwright'

import { loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke des repas (extraits en `layers/meals`). Le catalogue des repas est dérivé (généré depuis la
 * planif bénévoles), pas créé directement → on vérifie l'activation, le chargement de la page de
 * configuration et la réponse de l'API liste.
 */
test.describe.serial('Module Repas', () => {
  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("activer les repas via l'API", async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { mealsEnabled: true })
  })

  test('la page de configuration des repas se charge', async ({ page, goto }) => {
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/gestion/meals`, { waitUntil: 'hydration' })
    await expect(
      page.getByRole('heading', { name: /configuration des repas/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  /**
   * La page « Liste des repas » se REND, et sans erreur de console.
   *
   * Ce test existe parce qu'elle a été cassée sans que rien ne le signale : un appel à
   * `getParticipantTypeConfig` sorti du composable qui le fournit faisait échouer le `setup`
   * entier, donc toutes les liaisons du gabarit d'un coup.
   *
   * Ni le lint, ni le typage, ni une requête HTTP ne le voyaient. La requête surtout : cette page
   * est rendue CÔTÉ CLIENT derrière l'authentification, si bien qu'un `curl` reçoit la coquille
   * de l'application — huit kilo-octets et un titre vide — et un franc 200. Seul un navigateur
   * authentifié exécute le composant.
   */
  test('la liste des repas se rend sans erreur', async ({ page, goto }) => {
    const { editionId } = loadState()

    /**
     * On guette les exceptions NON RATTRAPÉES, pas les messages de console.
     *
     * C'est exactement la forme qu'avait le défaut : une `ReferenceError` dans le `setup`, qui
     * emporte toutes les liaisons du gabarit. La console, elle, porte du bruit qui ne dit rien
     * de la santé de la page — une connexion WebSocket d'outillage refusée, des avertissements
     * de composants — et un test qui échoue sur du bruit finit par être ignoré.
     */
    const exceptions: string[] = []
    page.on('pageerror', (erreur) => exceptions.push(String(erreur)))

    await goto(`/editions/${editionId}/gestion/meals/list`, { waitUntil: 'hydration' })

    // Un élément du contenu, pas seulement le gabarit de page : c'est ce qui distingue « la page
    // s'affiche » de « la route existe ».
    await expect(page.getByRole('heading', { name: /repas/i }).first()).toBeVisible({
      timeout: 15000,
    })

    expect(exceptions, `exceptions : ${exceptions.join(' | ')}`).toEqual([])
  })

  test('GET meals répond', async ({ page }) => {
    const { editionId } = loadState()
    const response = await page.request.get(`${BASE}/api/editions/${editionId}/meals`)
    expect(response.ok()).toBe(true)
  })

  /**
   * Désactiver un repas demande confirmation, et renoncer ne change RIEN.
   *
   * ⚠️ CE QUE CE GESTE DÉTRUIT : le serveur fait un `deleteMany` sur toutes les réponses des
   * bénévoles pour ce repas. C'est sans retour — et réactiver le repas ne les restaure pas, il
   * réinscrit chaque bénévole éligible comme ACCEPTANT, y compris ceux qui avaient refusé.
   *
   * Le commutateur enregistrait immédiatement, sans rien demander.
   *
   * ⚠️ POURQUOI UNE SPEC PLAYWRIGHT ET NON UN TEST DE COMPOSANT : c'est une PAGE de gestion, qui
   * demande une dizaine de points d'API au montage et n'est rendue que côté client, derrière
   * l'authentification. Un `curl` y reçoit la coquille de l'application et un franc 200 — seul un
   * navigateur authentifié exécute la garde.
   *
   * 🔬 CE QUE LE TEST MESURE est le RENONCEMENT, pas la confirmation. Vérifier que confirmer
   * supprime bien reviendrait à détruire des données pour prouver qu'on sait les détruire ; ce qui
   * compte, c'est que le commutateur REVIENNE à sa place et que rien ne soit parti.
   */
  test('désactiver un repas demande confirmation, et renoncer ne change rien', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/gestion/meals`, { waitUntil: 'hydration' })

    /*
     * 📍 `getByRole('switch')`, comme les autres specs de ce dossier. Une première version
     * cherchait `button[role="switch"]` : elle n'en trouvait AUCUN et le test se SAUTAIT, donc
     * passait au vert en ne prouvant rien. Un test sauté ressemble à de la couverture.
     */
    await page.waitForSelector('[role="switch"]', { timeout: 10000 })
    const commutateurs = page.getByRole('switch')
    expect(
      await commutateurs.count(),
      'aucun repas à désactiver sur cette édition'
    ).toBeGreaterThan(0)

    // Un repas ACTIF : c'est le seul cas où la garde doit se déclencher.
    const actif = commutateurs.first()
    await expect(actif).toHaveAttribute('aria-checked', 'true')

    /*
     * On surveille la requête d'enregistrement : la garde ne vaut que si RIEN ne part avant la
     * confirmation. Un test qui n'observerait que la modale resterait vert si l'enregistrement
     * partait quand même en arrière-plan.
     */
    let enregistrementParti = false
    page.on('request', (requete) => {
      if (requete.method() === 'PUT' && requete.url().includes('/volunteers/meals')) {
        enregistrementParti = true
      }
    })

    await actif.click()

    // La modale s'ouvre, et elle dit ce qui va être détruit — pas seulement « Êtes-vous sûr ? ».
    const modale = page.getByRole('dialog')
    await expect(modale).toBeVisible({ timeout: 5000 })
    await expect(modale).toContainText(/définitive/i)

    // Renoncer.
    await modale.getByRole('button', { name: /annuler/i }).click()
    await expect(modale).toBeHidden({ timeout: 5000 })

    // Rien n'est parti, et le commutateur est revenu à sa place.
    expect(enregistrementParti, 'un enregistrement est parti malgré le renoncement').toBe(false)
    await expect(actif).toHaveAttribute('aria-checked', 'true')
  })

  test('nettoyage : désactiver les repas', async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { mealsEnabled: false })
  })
})
