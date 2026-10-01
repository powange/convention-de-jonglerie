import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, loadState } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Les dates d'une édition sont saisies et relues dans le fuseau de la CONVENTION.
 *
 * ⚠️ CE QUI N'ALLAIT PAS. Le formulaire de création et cet écran de gestion construisaient
 * `new Date(année, mois, jour, heures, minutes)` — une heure du fuseau de la MACHINE — avant d'en
 * faire un instant UTC. Un organisateur français qui créait une édition à Montréal enregistrait
 * donc un instant décalé de six heures, et le champ « fuseau horaire » rempli dans le MÊME
 * formulaire n'y changeait rien. La relecture souffrait du défaut inverse : `getHours()` lit dans
 * le fuseau de la machine, si bien qu'ouvrir cet écran depuis un autre pays affichait une autre
 * heure que celle saisie — et un simple enregistrement la gravait.
 *
 * ⚠️⚠️ POURQUOI UNE SPÉCIFICATION DE BOUT EN BOUT. `versInstant` et `versChampLocal` sont éprouvés
 * par 27 cas unitaires, et `~/utils/horloge-edition` par 14 de plus ; ce qui n'était couvert par
 * RIEN, c'est leur BRANCHEMENT dans la page — et un fuseau ne se prouve pas sans un navigateur qui
 * en annonce un autre. `timezoneId` le fournit.
 *
 * 📍 UNE ÉDITION DÉDIÉE, créée et supprimée ici. L'édition partagée par les autres lots porte des
 * dates relatives dont dépendent les spécifications de planning, de créneaux et de repas : les
 * déplacer, même le temps d'un test, les ferait tomber. Ce dépôt a déjà payé ce genre
 * d'interférence avec une équipe de bénévoles laissée derrière.
 */

/** 1ᵉʳ août 2026, 23 h à Paris (UTC+2 en août) — soit le 2 août 09 h à Auckland (UTC+12). */
const DEBUT = '2026-08-01T21:00:00.000Z'
const FIN = '2026-08-03T21:00:00.000Z'

test.use({ timezoneId: 'Pacific/Auckland' })

test.describe.serial('Dates d’une édition et fuseau de la convention', () => {
  let editionId = ''

  test('créer une édition dédiée, à Europe/Paris', async ({ page }) => {
    const { conventionId } = loadState()

    const reponse = await apiPost(page, `${BASE}/api/editions`, {
      data: {
        conventionId: Number(conventionId),
        name: 'E2E Fuseau édition',
        startDate: DEBUT,
        endDate: FIN,
        timezone: 'Europe/Paris',
        addressLine1: '1 rue du Fuseau',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      },
    })
    expect(reponse.ok(), await reponse.text()).toBe(true)

    const corps = await reponse.json()
    editionId = String(corps.data?.id ?? corps.id)
    expect(editionId).toBeTruthy()
  })

  test('🔬 l’écran de gestion affiche le JOUR et l’HEURE de la convention', async ({
    page,
    goto,
  }) => {
    await goto(`/editions/${editionId}/gestion/general-info`, { waitUntil: 'hydration' })

    /*
     * L'assertion qui porte le point. Le navigateur est à Auckland, où cet instant tombe le 2 août
     * à 9 h : avant le correctif, le bouton de date affichait « 02/08/2026 » et le champ d'heure
     * 09:00. Il doit afficher le 1er août, jour vécu sur place.
     */
    await expect(page.getByRole('button', { name: /01\/08\/2026|1 août 2026/i })).toBeVisible({
      timeout: 15000,
    })

    // Et le 2 août ne doit pas apparaître comme date de DÉBUT : une assertion positive seule
    // resterait verte si la page affichait les deux.
    await expect(page.getByRole('button', { name: /02\/08\/2026/ })).toHaveCount(0)
  })

  test('annonce le fuseau employé', async ({ page, goto }) => {
    await goto(`/editions/${editionId}/gestion/general-info`, { waitUntil: 'hydration' })

    // Sans cette mention, l'organisateur n'a aucun moyen de savoir dans quel fuseau il saisit — et
    // c'est l'ambiguïté qui a produit le défaut, pas seulement la conversion.
    await expect(page.getByText(/Europe\/Paris/).first()).toBeVisible({ timeout: 15000 })
  })

  test('🔬 enregistrer un AUTRE champ ne déplace pas les dates', async ({ page, goto }) => {
    /*
     * ⚠️ L'INVARIANT LE PLUS IMPORTANT DE CE LOT, et celui que le correctif aurait pu casser.
     * L'ancien code lisait ET écrivait dans le fuseau de la machine : incohérent avec le lieu, mais
     * STABLE en aller-retour. Si la nouvelle lecture s'ancrait sur la convention et l'écriture
     * ailleurs, chaque ouverture-enregistrement décalerait les dates de plusieurs heures — une
     * dégradation silencieuse, et cumulative, bien pire que le défaut d'origine.
     */
    await goto(`/editions/${editionId}/gestion/general-info`, { waitUntil: 'hydration' })

    const champNom = page.locator('input[type="text"]').first()
    await expect(champNom).toBeVisible({ timeout: 15000 })
    await champNom.fill('E2E Fuseau édition renommée')

    await page
      .getByRole('button', { name: /enregistrer/i })
      .first()
      .click()
    await page.waitForTimeout(2500)

    const reponse = await page.request.get(`${BASE}/api/editions/${editionId}`)
    const edition = await reponse.json()

    expect(edition.name).toBe('E2E Fuseau édition renommée')
    expect(new Date(edition.startDate).toISOString()).toBe(DEBUT)
    expect(new Date(edition.endDate).toISOString()).toBe(FIN)
  })

  /**
   * Nettoyage en `afterAll` et non en dernier `test()` : dans un `describe.serial`, un échec en
   * cours de route saute les tests suivants, donc le nettoyage — et l'édition resterait sur la
   * convention partagée, où elle ferait échouer tout ce qui compte ses éditions.
   *
   * Le contexte est rouvert avec la session de l'organisateur : `browser.newPage()` nu n'en a
   * aucune, et la suppression répondrait 401 sans qu'on le voie.
   */
  test.afterAll(async ({ browser }) => {
    if (!editionId) return
    const context = await browser.newContext({
      storageState: new URL('../../../../test-results/.auth/user.json', import.meta.url).pathname,
    })
    const page = await context.newPage()
    try {
      const reponse = await apiDelete(page, `${BASE}/api/editions/${editionId}`)
      if (!reponse.ok()) {
        // Un nettoyage qui ne nettoie pas doit se voir : enveloppé dans un `catch` muet, l'échec
        // passait inaperçu et la donnée restait sur la convention partagée.
        console.warn('[nettoyage] suppression de l’édition échouée :', await reponse.text())
      }
    } finally {
      await context.close()
    }
  })
})
