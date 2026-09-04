import { expect, test } from '@nuxt/test-utils/playwright'

import {
  apiDelete,
  apiPatch,
  apiPost,
  disableVolunteers,
  enableVolunteers,
  getEditionStatus,
  getInvitationTokenFromLogs,
  loadState,
  loginWith,
  setEditionStatus,
} from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Rendu mobile de l'échange de créneaux entre bénévoles.
 *
 * Mesuré sur des pages REMPLIES. Une première version de ce parcours mesurait deux écrans vides
 * — « vous n'avez aucun créneau », « aucun échange en attente » — et passait sans rien prouver :
 * le débordement se produit dans les lignes chargées, un pseudo, deux créneaux datés et deux
 * boutons, pas dans la coquille.
 *
 * D'où les deux vraies sessions de bénévoles : produire une proposition puis un accord est le
 * seul moyen d'obtenir les trois états qui comptent.
 */
const LARGEUR = 375
const MDP = 'SwapMobile123!'

test.use({ viewport: { width: LARGEUR, height: 812 } })

type Page = import('@playwright/test').Page

/**
 * Deux mesures, dont une seule est démontrée.
 *
 * — Le débordement de la PAGE est éprouvé : un conteneur élargi à 900 px le fait échouer.
 * — Le contenu ROGNÉ dans un conteneur qui le masque ne l'est PAS : je n'ai pas réussi à le
 *   faire déclencher par une sonde, sans identifier si c'est un angle mort de la mesure ou un
 *   artefact de la sonde. Il est conservé parce qu'il ne coûte rien et peut attraper quelque
 *   chose ; il ne prouve rien à lui seul. C'est pourtant ce cas-là qui a produit les défauts
 *   signalés cette semaine — des noms coupés à une lettre dans une carte.
 *
 * Cherche le contenu rogné, et pas seulement la page qui déborde.
 *
 * `document.documentElement.scrollWidth` ne suffit pas ici : une carte en `overflow-hidden`
 * absorbe le dépassement, la page ne bouge pas, et le texte est coupé sans que rien ne le
 * signale. Éprouvé — un bloc de 900 px de large passait la mesure précédente sans broncher.
 *
 * On regarde donc chaque élément : son contenu tient-il dans sa propre boîte ? Les conteneurs
 * qui défilent volontairement (`overflow-x: auto|scroll`) sont exclus, leur dépassement est voulu.
 */
let compteur = 0
async function verifier(page: Page, contexte: string) {
  compteur += 1
  // Laisse la page se poser : les listes arrivent par `useFetch`, et mesurer un écran encore
  // en chargement ne dirait rien de sa mise en page.
  await page.waitForTimeout(1500)
  await page.screenshot({
    path:
      '/tmp/claude-1000/-home-powange-projects-convention-de-jonglerie/ec64cc3e-3602-4801-a44c-3d566d88eedf/scratchpad/captures/' +
      compteur +
      '.png',
    fullPage: true,
  })
  const coupables = await page.evaluate(() => {
    const trouves: string[] = []
    // Restreint au contenu de la page : l'en-tête et le pied de page sont communs à toute
    // l'application, et leurs défauts éventuels ne relèvent pas de cette fonctionnalité.
    const titre = document.querySelector('h1')
    const zone = titre?.closest('div')?.parentElement ?? document.body

    for (const el of zone.querySelectorAll('*')) {
      if (el.closest('header, footer, nav')) continue
      const r = el.getBoundingClientRect()
      if (r.width < 20 || r.height < 8) continue

      const style = getComputedStyle(el)
      if (style.overflowX === 'auto' || style.overflowX === 'scroll') continue
      // Le texte tronqué à l'ellipse est un choix explicite, pas un accident.
      if (style.textOverflow === 'ellipsis') continue

      const depassement = el.scrollWidth - el.clientWidth
      if (depassement <= 1) continue

      const classes = typeof el.className === 'string' ? el.className.slice(0, 80) : ''
      const nom = el.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 40)
      trouves.push(
        `<${el.tagName.toLowerCase()} "${nom}" class="${classes}"> ` +
          `contenu ${el.scrollWidth}px dans ${el.clientWidth}px`
      )
      if (trouves.length >= 5) break
    }
    return trouves
  })

  expect(
    coupables,
    `${contexte} : du contenu est rogné en ${LARGEUR} px.\n  - ${coupables.join('\n  - ')}`
  ).toEqual([])

  // Les deux mesures sont nécessaires, et aucune ne remplace l'autre : selon qu'un ancêtre rogne
  // ou non, un élément trop large se traduit soit par du contenu coupé, soit par une page qui
  // glisse de côté. Vérifié — une sonde de 900 px n'était vue que par la seconde.
  const largeurPage = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(largeurPage, `${contexte} : la page déborde en ${LARGEUR} px`).toBeLessThanOrEqual(
    LARGEUR + 1
  )
}

test.describe.serial('Échange de créneaux — rendu mobile', () => {
  test.describe.configure({ timeout: 240000 })

  const SUFFIXE = Date.now()
  /** Mention libre que le second bénévole renseigne : l'organisateur doit la voir en validant. */
  const A_EVITER = 'Éviter de me placer avec Marie B. — différend en cours'
  const EMAIL_A = `swap-a-${SUFFIXE}@example.test`
  const EMAIL_B = `swap-b-${SUFFIXE}@example.test`

  let equipeId = ''
  /** Statut d'origine, restitué au nettoyage : les specs partagent une seule édition. */
  let statutInitial: string | null = null
  const creneaux: string[] = []
  const jetons: Record<string, string> = {}

  test('préparer l’équipe, les créneaux et les deux bénévoles', async ({ page }) => {
    const { editionId } = loadState()
    await enableVolunteers(page, String(editionId))
    // Hors ligne, l'édition n'est pas lisible par un simple bénévole et la page reste vide —
    // comme toutes les pages bénévoles, qui la conditionnent à `v-if="edition"`.
    statutInitial = await getEditionStatus(page, String(editionId))
    await setEditionStatus(page, String(editionId), 'PUBLISHED')

    const equipe = await apiPost(page, `${BASE}/api/editions/${editionId}/volunteer-teams`, {
      data: { name: `Échanges ${SUFFIXE}`, color: '#8855FF' },
    })
    expect(equipe.ok(), await equipe.text()).toBe(true)
    const c = await equipe.json()
    equipeId = (c.data?.team ?? c.data ?? c)?.id
    expect(equipeId).toBeTruthy()

    // Dans la période de l'édition : le serveur le vérifie.
    const infos = await page.request.get(`${BASE}/api/editions/${editionId}`)
    const corpsEdition = await infos.json()
    const ed = corpsEdition?.data ?? corpsEdition
    /**
     * Ancré sur le plus TARDIF entre le début de l'édition et l'instant présent : les créneaux
     * doivent tomber dans la période de l'édition — le serveur le vérifie — mais aussi dans le
     * futur, sinon `my-assignments` les écarte et le bénévole se retrouve sans rien à échanger.
     *
     * L'édition partagée par les parcours a une date de début dans le PASSÉ, ce qui rendait ce
     * fichier dépendant du moment où il s'exécutait.
     */
    const debut = Math.max(new Date(ed?.startDate).getTime(), Date.now() + 30 * 60 * 1000)
    expect(
      Number.isFinite(debut),
      `dates d'édition illisibles : ${JSON.stringify(corpsEdition).slice(0, 150)}`
    ).toBe(true)
    // Les créneaux les plus tardifs tombent à +9 h : ils doivent rester dans la période.
    expect(
      debut + 9 * 3600000,
      "la période de l'édition est trop courte pour y loger deux créneaux à venir"
    ).toBeLessThan(new Date(ed?.endDate).getTime())

    for (const [decalage, titre] of [
      [1, 'Accueil du matin'],
      [7, 'Buvette du soir — un intitulé volontairement long pour éprouver la mise en page'],
    ] as const) {
      const r = await apiPost(page, `${BASE}/api/editions/${editionId}/volunteer-time-slots`, {
        data: {
          title: titre,
          teamId: equipeId,
          startDateTime: new Date(debut + decalage * 3600000).toISOString(),
          endDateTime: new Date(debut + (decalage + 2) * 3600000).toISOString(),
          maxVolunteers: 1,
        },
      })
      expect(r.ok(), await r.text()).toBe(true)
      const corps = await r.json()
      creneaux.push((corps.data?.timeSlots ?? corps.timeSlots ?? [])[0]?.id)
    }
    expect(creneaux.filter(Boolean)).toHaveLength(2)

    /**
     * Le jeton d'invitation se lit dans le journal du serveur, et le helper rend le DERNIER
     * trouvé dans les 200 dernières lignes. Sur une exécution complète, le journal est chargé :
     * les deux bénévoles pouvaient recevoir le même jeton, donc devenir le même compte — et la
     * liste des candidats se vidait, puisqu'on n'échange pas avec soi-même.
     *
     * On exige donc un jeton DIFFÉRENT du précédent, la valeur de départ étant relevée avant
     * toute création pour ne pas hériter d'un jeton laissé par un autre parcours.
     */
    let dernierJeton = ''
    try {
      dernierJeton = getInvitationTokenFromLogs()
    } catch {
      // Aucun jeton dans le journal : tant mieux, il n'y a rien dont on puisse hériter.
    }

    // Deux bénévoles, chacun sur un créneau, tous deux dans l'équipe.
    for (const [index, email] of [EMAIL_A, EMAIL_B].entries()) {
      const creation = await apiPost(
        page,
        `${BASE}/api/editions/${editionId}/volunteers/create-user-and-add`,
        { data: { email, prenom: `Benevole${index}`, nom: 'Echange' } }
      )
      expect(creation.ok(), await creation.text()).toBe(true)
      const donnees = (await creation.json()).data

      await expect(async () => {
        const jeton = getInvitationTokenFromLogs()
        expect(jeton, 'jeton inchangé : celui du bénévole précédent').not.toBe(dernierJeton)
        jetons[email] = jeton
        dernierJeton = jeton
      }).toPass({ timeout: 20000, intervals: [500] })

      await apiPatch(
        page,
        `${BASE}/api/editions/${editionId}/volunteers/applications/${donnees.application.id}/teams`,
        { data: { teams: [equipeId] } }
      )
      await apiPost(
        page,
        `${BASE}/api/editions/${editionId}/volunteer-time-slots/${creneaux[index]}/assignments`,
        { data: { userId: donnees.user.id } }
      )
    }
  })

  /** Active un compte invité, puis s'y connecte. Rend la page prête à naviguer. */
  async function sessionBenevole(browser: import('@playwright/test').Browser, email: string) {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: { width: LARGEUR, height: 812 },
    })
    const page = await context.newPage()

    await page.goto(`${BASE}/auth/invitation?token=${jetons[email]}`, {
      waitUntil: 'domcontentloaded',
    })
    const mdp = page.locator('input[type="password"]')
    await expect(mdp.first()).toBeVisible({ timeout: 15000 })
    await mdp.first().fill(MDP)
    if ((await mdp.count()) >= 2) await mdp.nth(1).fill(MDP)
    await page.getByRole('button', { name: /activer mon compte/i }).click()
    await expect(page.getByText(/compte activé/i).first()).toBeVisible({ timeout: 15000 })

    /**
     * L'activation ouvre normalement la session, mais pas toujours assez vite : se fier à la
     * présence du formulaire de connexion rendait l'étape dépendante d'un timing, et la CI
     * arrivait sur une page protégée en anonyme — donc redirigée, sans le titre attendu.
     *
     * On vise donc directement la page protégée : si elle nous renvoie vers la connexion, on se
     * connecte et on y revient. Le test qui suit peut alors compter sur une session ouverte.
     */
    const { editionId } = loadState()
    const cible = `${BASE}/editions/${editionId}/volunteers/swaps`

    await page.goto(cible, { waitUntil: 'domcontentloaded' })
    if (page.url().includes('/login')) {
      await loginWith(page, email, MDP)
      await page.goto(cible, { waitUntil: 'domcontentloaded' })
    }

    // Une redirection persistante signifie que la session n'est pas ouverte : le dire ici plutôt
    // que de laisser échouer une assertion d'affichage sur un symptôme lointain.
    expect(page.url(), `session non ouverte pour ${email}`).not.toContain('/login')

    return { context, page }
  }

  test('le premier bénévole propose — page remplie', async ({ browser }) => {
    const { editionId } = loadState()
    const { context, page } = await sessionBenevole(browser, EMAIL_A)

    await expect(
      page.getByRole('heading', { name: /échanger un créneau/i }),
      `page inattendue : ${page.url()}`
    ).toBeVisible({ timeout: 30000 })
    // Preuve que la page n'est pas vide : son créneau est bien proposé au choix.
    // Le sélecteur doit porter un créneau, pas son texte d'invite : sans quoi la page est
    // ouverte mais inutilisable, ce qui est exactement le défaut trouvé à l'inspection visuelle.
    await expect(page.getByRole('button', { name: /le créneau que vous cédez/i })).not.toHaveText(
      /choisir un créneau/i
    )

    await verifier(page, 'La page d’échange, côté demandeur')

    // Capture de la modale de choix, pour l'inspection visuelle.
    await page.getByRole('button', { name: /le créneau que vous souhaitez/i }).click()
    await page.waitForTimeout(1200)
    await page.waitForTimeout(900)
    await page.screenshot({
      path: '/tmp/claude-1000/-home-powange-projects-convention-de-jonglerie/ec64cc3e-3602-4801-a44c-3d566d88eedf/scratchpad/captures/modale.png',
      fullPage: true,
    })
    await page.keyboard.press('Escape')

    // Proposer l'échange par l'API : ce parcours mesure le rendu, pas le formulaire.
    const mesCreneaux = await page.request.get(
      `${BASE}/api/editions/${editionId}/volunteers/my-assignments`
    )
    const mienne = ((await mesCreneaux.json())?.data?.assignments ?? [])[0]
    const candidats = await page.request.get(
      `${BASE}/api/editions/${editionId}/volunteers/swaps/candidates?assignmentId=${mienne.id}`
    )
    const cible = ((await candidats.json())?.data?.candidates ?? [])[0]
    expect(cible, 'aucun candidat : la règle de chevauchement écarte tout').toBeTruthy()

    const creation = await apiPost(page, `${BASE}/api/editions/${editionId}/volunteers/swaps`, {
      data: { offeredAssignmentId: mienne.id, wantedAssignmentId: cible.assignmentId },
    })
    expect(creation.ok(), await creation.text()).toBe(true)

    // La page porte maintenant une proposition envoyée : c'est cette ligne qui peut déborder.
    await page.reload({ waitUntil: 'load' })
    await expect(page.getByText(/en attente de l.autre bénévole/i).first()).toBeVisible({
      timeout: 15000,
    })
    // L'équipe doit se lire sur chaque créneau : « Toilettes sèches » seul ne dit pas de quelle
    // équipe il s'agit, et un même intitulé peut exister dans plusieurs. On vise la ligne de la
    // proposition, repérée par son statut, et non le sélecteur au-dessus, qui l'affichait déjà.
    const proposition = page
      .locator('li')
      .filter({ has: page.getByText(/en attente de l.autre bénévole/i) })
      .first()
    await expect(
      proposition.getByText(`Échanges ${SUFFIXE}`).first(),
      'le nom de l’équipe devrait apparaître sur les créneaux proposés'
    ).toBeVisible()

    // « Retirer » doit se voir comme un bouton : c'était un libellé fantôme, sans fond, sur une
    // action qui annule un accord en cours. On mesure ce qui est rendu, pas la classe demandée.
    const retirer = proposition.getByRole('button', { name: /retirer/i }).first()
    const fond = await retirer.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(fond, 'le bouton « Retirer » devrait avoir un fond visible').not.toMatch(
      /rgba\(0, 0, 0, 0\)|transparent/
    )

    // Et il demande confirmation avant d'agir.
    await retirer.click()
    const confirmation = page.getByRole('dialog').filter({ hasText: /retirer cette demande/i })
    await expect(
      confirmation,
      'un clic sur « Retirer » devrait demander confirmation'
    ).toBeVisible()

    // Renoncer ne retire rien : la proposition doit survivre, les tests suivants s'appuient
    // dessus — et un utilisateur qui ferme la modale s'attend au même résultat.
    await confirmation
      .getByRole('button', { name: /annuler/i })
      .first()
      .click()
    await expect(confirmation).toBeHidden()
    await expect(page.getByText(/en attente de l.autre bénévole/i).first()).toBeVisible()

    await verifier(page, 'La page d’échange avec une proposition envoyée')

    await context.close()
  })

  test('le second accepte — page remplie côté destinataire', async ({ browser }) => {
    const { editionId } = loadState()
    const { context, page } = await sessionBenevole(browser, EMAIL_B)

    await page.goto(`${BASE}/editions/${editionId}/volunteers/swaps`, { waitUntil: 'load' })
    // Le champ « personnes à éviter » de SA candidature : il n'a de valeur que confronté au
    // planning, et c'est l'écran de validation qui fait cette confrontation.
    const sienne = await page.request.get(
      `${BASE}/api/editions/${editionId}/volunteers/my-application`
    )
    // Cet endpoint rend la candidature telle quelle, sans enveloppe `{ success, data }`.
    const corpsCandidature = await sienne.json()
    const candidature = corpsCandidature?.data ?? corpsCandidature
    expect(candidature?.id, 'candidature du bénévole introuvable').toBeTruthy()
    const maj = await apiPatch(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/applications/${candidature.id}`,
      { data: { avoidList: A_EVITER } }
    )
    expect(maj.ok(), await maj.text()).toBe(true)

    const recue = page.getByText(/en attente de l.autre bénévole/i).first()
    await expect(recue).toBeVisible({ timeout: 20000 })

    await verifier(page, 'La page d’échange avec une proposition reçue')

    await page
      .getByRole('button', { name: /^accepter$/i })
      .first()
      .click()
    await expect(page.getByText(/en attente d.un organisateur/i).first()).toBeVisible({
      timeout: 20000,
    })

    await context.close()
  })

  test('la file de validation, avec une demande à trancher', async ({ page, goto }) => {
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/gestion/volunteers/swaps`, { waitUntil: 'hydration' })
    await expect(page.getByRole('heading', { name: /échanges de créneaux/i })).toBeVisible({
      timeout: 20000,
    })
    // Preuve que la file n'est pas vide.
    await expect(page.getByText(/aucun échange en attente/i)).toHaveCount(0)

    // La mention doit remonter jusqu'ici : c'est tout l'objet de la demande. Sans elle, deux
    // bénévoles de bonne foi peuvent créer un conflit que ni l'un ni l'autre ne voit.
    await expect(page.getByText(A_EVITER, { exact: false })).toBeVisible({ timeout: 15000 })

    await verifier(page, 'La file de validation des échanges')
  })

  /**
   * Nettoyage en `afterAll` et non en dernier `test()` : dans un `describe.serial`, un échec en
   * cours de route saute les tests suivants — donc le nettoyage. L'équipe créée ici est alors
   * restée sur l'édition partagée et a fait tomber `volunteer-teams`, qui la veut vide.
   * Constaté sur une exécution complète, jamais en lançant ce fichier seul.
   */
  test.afterAll(async ({ browser }) => {
    const { editionId } = loadState()
    const context = await browser.newContext({
      // La session de l'organisateur, écrite par le projet `setup`.
      storageState: new URL('../../../../test-results/.auth/user.json', import.meta.url).pathname,
    })
    const page = await context.newPage()

    // `apiDelete` et non `page.request.delete` : le helper porte l'en-tête CSRF, sans lequel le
    // serveur répond 403. Enveloppé dans un `catch` muet, l'échec passait inaperçu et l'équipe
    // restait sur l'édition partagée. Les erreurs sont donc journalisées : un nettoyage qui ne
    // nettoie pas doit se voir.
    const supprimer = async (url: string) => {
      const reponse = await apiDelete(page, url)
      if (!reponse.ok()) console.warn('[nettoyage] échec sur', url, await reponse.text())
    }

    for (const id of creneaux) {
      if (id) await supprimer(`${BASE}/api/editions/${editionId}/volunteer-time-slots/${id}`)
    }
    if (equipeId) await supprimer(`${BASE}/api/editions/${editionId}/volunteer-teams/${equipeId}`)
    if (statutInitial) {
      await setEditionStatus(page, String(editionId), statutInitial as 'OFFLINE').catch(() => {})
    }
    await disableVolunteers(page, String(editionId)).catch(() => {})
    await context.close()
  })
})
