import { expect, test } from '@nuxt/test-utils/playwright'

/**
 * Un lien direct s'ouvre dans la langue du visiteur, pas en anglais.
 *
 * ⚠️ CE QUE CE FICHIER PROUVE, ET CE QU'IL A DÉMENTI. On le croyait cassé : la détection était
 * configurée en `redirectOn: 'root'`, censé ne la faire jouer que sur « / ». Un lien direct vers
 * une page profonde — celui qu'on reçoit par message, par courriel, depuis un réseau social, et
 * qui est le chemin d'arrivée LE PLUS FRÉQUENT — aurait donc dû s'ouvrir en anglais pour un
 * visiteur francophone sans cookie, `defaultLocale` valant `en`.
 *
 * MESURE FAITE : ce n'est pas le cas, et ça ne l'a jamais été. Avec `redirectOn: 'root'`
 * effectivement rechargé, cette même page répond « Politique de confidentialité » en
 * `Accept-Language: fr` et « Privacy Policy » en `en`. Avec `strategy: 'no_prefix'` il n'y a
 * aucune redirection à restreindre : la locale est choisie au rendu, à chaque requête.
 *
 * Ce fichier ne verrouille donc pas une correction — il verrouille un comportement que RIEN ne
 * testait, et dont on a failli « corriger » l'absence de défaut. Le réglage `redirectOn: 'all'`
 * qui l'accompagne est une précaution documentaire, pas ce qui fait tenir le comportement.
 *
 * ⚠️ POURQUOI CE TEST EXIGE UN CONTEXTE NEUF. Le cookie `i18n_redirected` mémorise la langue au
 * premier passage. Rejoué dans un contexte qui a déjà visité le site, le test lirait ce cookie et
 * passerait quelle que soit la valeur de `redirectOn` — un faux vert parfait. D'où l'état stocké
 * vidé pour tout le fichier, ET un contexte de navigateur créé pour chaque cas.
 */

// Ce dossier tourne sans authentification ; on force en plus l'absence de tout état stocké.
test.use({ storageState: { cookies: [], origins: [] } })

/*
 * ⚠️ LE CHOIX DE LA PAGE EST LA MOITIÉ DU TEST. Il faut une page PUBLIQUE, PROFONDE (donc pas « / »,
 * où l'ancien réglage fonctionnait déjà et où le test ne prouverait rien), et dont le titre diffère
 * franchement d'une langue à l'autre.
 *
 * `/privacy-policy` réunit les trois : accessible sans session, hors de la racine, et son titre est
 * rendu par un `h1` dans les treize langues. Ma première version visait `/editions` — qui N'EXISTE
 * PAS comme page (seuls `/editions/add` et `/editions/:id` existent) : le test aurait mesuré un
 * 404, et son échec aurait été mis au compte du réglage i18n.
 */
const CHEMIN_PROFOND = '/privacy-policy'
const TITRE_FRANCAIS = /politique de confidentialité/i
const TITRE_ANGLAIS = /privacy policy/i

test.describe('détection de la langue du navigateur', () => {
  test('un premier accès à une page profonde s’affiche en français', async ({ browser }) => {
    /*
     * Le cœur du lot. Une page profonde est atteinte DIRECTEMENT, sans passer par l'accueil et
     * sans cookie. Avec `redirectOn: 'root'`, elle s'affichait en anglais.
     */
    const contexte = await browser.newContext({
      locale: 'fr-FR',
      extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
    })
    const page = await contexte.newPage()

    await page.goto(CHEMIN_PROFOND, { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: TITRE_FRANCAIS, level: 1 })).toBeVisible({
      timeout: 20000,
    })
    await expect(page.getByRole('heading', { name: TITRE_ANGLAIS, level: 1 })).toHaveCount(0)

    await contexte.close()
  })

  test('le cookie i18n_redirected est posé au passage', async ({ browser }) => {
    /*
     * La mémorisation fait partie du correctif : sans cookie, la détection rejouerait à chaque
     * navigation — et écraserait un choix fait à la main dans le sélecteur de langue.
     */
    const contexte = await browser.newContext({
      locale: 'fr-FR',
      extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
    })
    const page = await contexte.newPage()

    await page.goto(CHEMIN_PROFOND, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: TITRE_FRANCAIS, level: 1 })).toBeVisible({
      timeout: 20000,
    })

    const cookies = await contexte.cookies()
    const i18n = cookies.find((c) => c.name === 'i18n_redirected')

    expect(i18n, 'le cookie de langue doit être posé').toBeTruthy()
    expect(i18n?.value).toBe('fr')

    await contexte.close()
  })

  test('un navigateur anglophone reste en anglais', async ({ browser }) => {
    /*
     * Le témoin négatif, sans lequel le premier test ne prouverait rien : il pourrait passer parce
     * que le français est servi à TOUT LE MONDE. Ici la même page, demandée en anglais, doit
     * répondre en anglais.
     */
    const contexte = await browser.newContext({
      locale: 'en-US',
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    })
    const page = await contexte.newPage()

    await page.goto(CHEMIN_PROFOND, { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: TITRE_ANGLAIS, level: 1 })).toBeVisible({
      timeout: 20000,
    })

    await contexte.close()
  })
})
