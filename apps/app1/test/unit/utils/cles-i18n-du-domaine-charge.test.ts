import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

import { getTranslationsToLoad } from '../../../app/utils/translation-loaders'
import { DOMAINES_DU_SOCLE, LOCALES } from '../../../shared/utils/locales-i18n'

/**
 * Une clé hors du domaine chargé par la route s'affiche BRUTE, sans erreur.
 *
 * ## ⚠️ Le défaut que ce test attrape, et pourquoi il était invisible
 *
 * Mesuré le 09/10/2026 sur `app/pages/profile/mes-conventions.vue` : **15 de ses clés `t()`**
 * appartiennent au domaine `edition` (`conventions.add_organizer`,
 * `conventions.cannot_load_conventions`…) et **10 au domaine `gestion`**
 * (`gestion.organizers.*`). Aucune règle ne chargeait l'un ni l'autre sur `/profile`, dont le
 * socle est `['auth', 'profil']`. L'écran affichait donc « conventions.add_organizer » à la place
 * du libellé.
 *
 * Deux raisons pour lesquelles personne ne l'avait vu, et chacune suffit :
 *
 * 1. **Le middleware CUMULE les domaines sur la session.** Qui passe par une page d'édition avant
 *    d'ouvrir « Mes conventions » voit les bons libellés. Le défaut n'apparaît qu'à l'ouverture
 *    DIRECTE — un favori, un rechargement, un premier clic depuis le menu du profil.
 * 2. **Le socle français n'était pas celui des autres langues.** `nuxt.config.ts` chargeait
 *    d'emblée `gestion.json` pour `fr` et pour `fr` SEULEMENT (7 fichiers contre 6). Les clés
 *    `gestion.*` marchaient donc en français et sortaient brutes dans les douze autres langues —
 *    invisible pour qui développe et teste en français. **Corrigé le 10/10/2026** : les treize
 *    socles sont dérivés d'une liste unique, et les cas de la fin de ce fichier l'y maintiennent.
 *
 * ## Ce que ce test NE fait pas
 *
 * Il ne balaie pas tout le dépôt **en garde permanente**. Le namespace d'un fichier vient de sa
 * clé JSON racine et non de son nom (`gestion` vit dans `gestion.json` comme dans
 * `gestion-tasks.json`), beaucoup de clés sont composées à l'exécution, et deux mécanismes
 * fournissent un domaine : la règle de route ET `useLazyI18n` dans le `setup` d'un composant, qui
 * sert aussi ses descendants. Surtout, **un composant hérite de la route qui le rend** : résoudre
 * cela demande de remonter le graphe des composants par leur nom auto-importé, ce qu'aucune
 * heuristique ne fait sans se tromper.
 *
 * ⚠️ CE BALAYAGE A BIEN ÉTÉ FAIT, hors CI, pour établir le lot du 10/10/2026 — et il a coûté
 * quatre corrections à l'outil de mesure lui-même avant de rendre un résultat juste : des noms de
 * composants cités dans des **commentaires** comptés comme des rendus, le dernier segment d'un
 * chemin (`Table`, `Panel`) pris pour un nom auto-importé valide, les layouts invisibles parce
 * qu'ils sont désignés par `definePageMeta` et non par une balise, et `useLazyI18n` ignoré — ce
 * dernier oubli signalant comme brutes onze clés `permissions.*` et deux `ticketing.*`
 * parfaitement traduites. C'est précisément pourquoi il n'est pas une garde : en CI, il aurait
 * rendu quatre verdicts faux avant le bon.
 *
 * Ce fichier couvre donc les cas **mesurés un par un** sur le code courant.
 */

/**
 * Les domaines chargés d'emblée, pour toutes les langues.
 *
 * ⚠️ ÉCRITE À LA MAIN ICI, ET DÉLIBÉRÉMENT. Une première version de ce lot l'importait de
 * `shared/utils/locales-i18n.ts` — où les treize entrées sont maintenant dérivées d'une liste
 * unique. La comparaison devenait alors une tautologie : la configuration était comparée à
 * elle-même, et tout ajout au socle passait au vert.
 *
 * ⚠️ IL N'Y A PLUS DEUX SOCLES NON PLUS. Cette liste visait l'**intersection** des treize parce
 * que le français en avait un septième, `gestion`, et viser le socle français aurait exempté ce
 * domaine en laissant le défaut entier dans les douze autres langues. L'écart est supprimé ; ce
 * qui reste à garder, c'est que le socle n'enfle pas — chaque domaine qui y entre alourdit
 * **toutes** les pages de l'application.
 */
const SOCLE_COMMUN = ['app', 'common', 'components', 'feedback', 'notifications', 'public']

const PAGES = [
  {
    route: '/profile/mes-conventions',
    fichier: 'app/pages/profile/mes-conventions.vue',
    /** Racine de clé employée par la page → domaine qui la porte. */
    racines: { conventions: 'edition', gestion: 'gestion' },
  },
  /*
   * ⚠️ QUATRE ROUTES AJOUTÉES PAR LE CONSTAT B1, mesurées une par une sur le code courant.
   *
   * Le balayage d'origine en annonçait sept. Deux ont disparu depuis — `workshops.page_title` n'est
   * plus employé que sur la page des ateliers, qui charge son domaine, et le composant
   * `CommentsModal.vue` n'existe plus. Une cinquième, le lien de connexion du covoiturage, se
   * corrige autrement : voir le cas dédié plus bas.
   */
  {
    route: '/conventions/1/edit',
    fichier: 'app/pages/conventions/[id]/edit.vue',
    // `conventions.*` vit dans `edition.json`, et aucune règle ne couvrait `/conventions`.
    racines: { conventions: 'edition' },
  },
  {
    route: '/conventions/1/editions/add',
    fichier: 'app/pages/conventions/[id]/editions/add.vue',
    racines: { conventions: 'edition' },
  },
  {
    route: '/editions/1/gestion',
    fichier: 'app/pages/editions/[id]/gestion/index.vue',
    // La carte des renforts, sur la PREMIÈRE page que voit un organisateur.
    racines: { volunteers: 'volunteers' },
  },
  {
    /*
     * ⚠️ LA ROUTE ET LE FICHIER NE SE CORRESPONDENT PAS ICI, et c'est le cas le plus instructif :
     * les clés sont dans un COMPOSANT, qui hérite du domaine chargé par la route qui le rend. Le
     * composant de progression vit sous `/admin` dans un cas et sous `/editions/:id/gestion` dans
     * l'autre — et seul le premier chargeait `admin`.
     */
    route: '/editions/1/gestion/ai-update',
    fichier: 'app/components/admin/ImportGenerationProgress.vue',
    racines: { admin: 'admin' },
  },
]

/**
 * Les domaines chargés d'emblée, par langue, lus dans la configuration réelle.
 *
 * ⚠️ On repasse par `files` au lieu de relire `DOMAINES_DU_SOCLE` : c'est `files` que
 * `@nuxtjs/i18n` consomme, et c'est là qu'un bloc écrit à la main réapparaîtrait. Comparer la
 * liste à elle-même ne prouverait rien.
 */
function soclesParLangue(): Record<string, string[]> {
  return Object.fromEntries(
    LOCALES.map(({ code, files }) => [
      code,
      files.map((f) => f.replace(/^[\w-]+\//, '').replace(/\.json$/, '')).sort(),
    ])
  )
}

describe('clés i18n — chaque page charge le domaine de ses clés', () => {
  it.each(PAGES)('$route charge les domaines de ses clés', ({ route, racines }) => {
    const charges = new Set([...SOCLE_COMMUN, ...getTranslationsToLoad(route)])

    for (const [racine, domaine] of Object.entries(racines)) {
      expect(charges.has(domaine), `« ${racine}.* » exige le domaine « ${domaine} »`).toBe(true)
    }
  })

  it.each(PAGES)('$route emploie bien les racines déclarées ici', ({ fichier, racines }) => {
    /*
     * La garde de la garde : sans elle, ce test resterait vert après un remaniement qui aurait
     * retiré ces clés de la page. On garderait un domaine chargé pour rien, et on croirait
     * couvrir un risque disparu.
     */
    const src = fs.readFileSync(path.resolve(__dirname, '../../../', fichier), 'utf8')
    const employees = new Set([...src.matchAll(/\$?t\('([a-z][\w]*)\./g)].map((m) => m[1]!))

    for (const racine of Object.keys(racines)) {
      expect(employees.has(racine), `${fichier} n'emploie plus « ${racine}.* »`).toBe(true)
    }
  })

  it('⚠️ LE LIEN DE CONNEXION DU COVOITURAGE N’EXIGE PLUS LE DOMAINE `auth`', () => {
    /*
     * LE CINQUIÈME CAS DU CONSTAT B1, corrigé autrement que par un chargement.
     *
     * Le commentaire d'une annonce proposait `auth.login` à un visiteur non connecté. `auth.json`
     * n'est chargé que sous /auth, /login, /register et /profile : sur une page de covoiturage
     * atteinte par rechargement, la clé sortait donc brute.
     *
     * Charger tout le domaine `auth` sur chaque page d'édition pour un seul mot coûterait plus que
     * de prendre `navigation.login`, de même texte, dans `common.json` — qui est TOUJOURS embarqué.
     * Ce cas interdit le retour en arrière.
     */
    const src = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../../layers/carpool/app/components/edition/carpool/CommentsInline.vue'
      ),
      'utf8'
    )

    expect(src).toContain("$t('navigation.login')")
    expect(src).not.toContain("$t('auth.")
  })

  it('⚠️ LES TREIZE LANGUES ONT EXACTEMENT LE MÊME SOCLE', () => {
    /*
     * CE CAS REMPLACE CELUI QUI ENREGISTRAIT L'ANOMALIE. Le précédent exigeait que le socle
     * français porte `gestion` en plus — un défaut consigné plutôt que corrigé, avec sa propre
     * annonce : « il tombera le jour où on le corrigera ». C'est ce jour.
     *
     * Ce qu'il y avait à corriger n'était pas seulement 84 Ko et 1 195 clés embarqués sur chaque
     * page française, l'accueil public compris. C'était surtout que ce fichier **masquait les
     * défauts de chargement du domaine `gestion` au seul lecteur capable de les voir** : une clé
     * `gestion.*` employée hors des routes `/gestion` s'affichait bien en français et sortait
     * brute dans les douze autres langues. Celui qui développe, en français, ne pouvait pas s'en
     * apercevoir — et un seul défaut de ce genre existait vraiment, celui de `MyTicketCard`
     * ci-dessous.
     */
    const socles = soclesParLangue()
    expect(Object.keys(socles).length).toBe(13)

    for (const [langue, domaines] of Object.entries(socles)) {
      expect(domaines, `le socle de « ${langue} » s'écarte des autres`).toEqual(
        [...SOCLE_COMMUN].sort()
      )
    }

    /*
     * Et `gestion` n'y revient pas — pas même pour les treize à la fois, ce qui serait pire que
     * l'écart corrigé : 84 Ko sur chaque page, dans chaque langue. Un domaine qui sort brut se
     * règle par une règle de route, ou par un `useLazyI18n` dans le composant qui l'emploie.
     */
    expect([...DOMAINES_DU_SOCLE]).not.toContain('gestion')
  })

  it('⚠️ `nuxt.config.ts` N’ÉCRIT PLUS AUCUN SOCLE À LA MAIN', () => {
    /*
     * LA CAUSE, et non le symptôme. Les treize langues étaient décrites en treize blocs recopiés,
     * chacun répétant la même liste préfixée du code de langue. Rien ne vérifiait qu'ils disaient
     * la même chose, et ils ne le disaient pas.
     *
     * Le cas ci-dessus serait satisfait par treize blocs manuels redevenus identiques — et le
     * quatorzième écart arriverait comme le premier. Ce que celui-ci garde, c'est qu'il n'y ait
     * qu'UN endroit où écrire le socle.
     */
    const config = fs.readFileSync(path.resolve(__dirname, '../../../nuxt.config.ts'), 'utf8')

    expect(config).toContain('locales: LOCALES')
    expect(config).not.toMatch(/files:\s*\[/)
    // Et le `.json` préfixé d'une langue n'y apparaît plus nulle part.
    expect(config).not.toMatch(/'(?:cs|da|de|en|es|fr|it|nl|pl|pt|ru|sv|uk)\/[\w-]+\.json'/)
  })

  it('⚠️ LA CARTE « MON BILLET » N’EXIGE PLUS LE DOMAINE `gestion`', () => {
    /*
     * LE DÉFAUT QUE LE SOCLE FRANÇAIS MASQUAIT — le seul, mesuré en balayant les 125 fichiers qui
     * emploient une clé `gestion.*`.
     *
     * `MyTicketCard` est rendu sur `/editions/:id`, la fiche PUBLIQUE d'une édition, et employait
     * `gestion.ticketing.origin_site` pour nommer le logo du fournisseur d'un billet. La clé est
     * désormais dans `ticketing.json`, le domaine partagé public + gestion, que ce composant
     * charge lui-même par `useLazyI18n('ticketing')` et que les écrans de gestion reçoivent par
     * leur route.
     *
     * ⚠️ Le défaut n'était visible qu'en `alt`/`title`, et seulement pour un fournisseur inconnu :
     * personne ne l'aurait signalé. C'est bien le genre de chose qu'un socle de langue privilégié
     * fait vivre indéfiniment.
     */
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../../app/components/edition/MyTicketCard.vue'),
      'utf8'
    )

    expect(src).toContain("$t('ticketing.origin_site')")
    expect(src).not.toContain('gestion.')
    // Le témoin : le composant charge bien le domaine dont il emploie maintenant les clés.
    expect(src).toContain("useLazyI18n('ticketing')")
  })

  it('⚠️ L’INFOBULLE DU BOUTON DE MESSAGERIE PREND UNE CLÉ DU SOCLE', () => {
    /*
     * Ce bouton est dans l'en-tête de TOUTES les pages, et le domaine `messenger` n'est chargé que
     * sur `/messenger`. Son infobulle affichait donc la chaîne « messenger.conversations » sur les
     * 33 autres routes, dans les treize langues — et comme le bouton est réduit à son icône,
     * c'était le seul texte qui le nommait.
     *
     * ⚠️ `messenger.conversations` N'EST PAS SUPPRIMÉE pour autant : `messenger.vue` l'emploie
     * toujours comme titre de sa colonne, et là le domaine est chargé.
     */
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../../app/components/messenger/HeaderButton.vue'),
      'utf8'
    )

    expect(src).toContain("$t('navigation.messenger')")
    expect(src).not.toContain("$t('messenger.")
  })

  it('⚠️ LE MENU DE GESTION NE TIRE PLUS UN LIEN HORS DU SOCLE', () => {
    /*
     * `edition-dashboard.vue` habille toutes les pages de gestion. Son lien « Renforts » employait
     * `volunteers.renforts_title`, d'un domaine chargé seulement sur l'accueil de la gestion et
     * sous `/gestion/volunteers` : il sortait brut dans le menu de la FAQ, du stock, des tâches,
     * de la trésorerie et des autres.
     *
     * ⚠️ POURQUOI PAS UNE RÈGLE DE ROUTE. Charger les 48 Ko de `volunteers.json` sur chaque page
     * de gestion pour un libellé de lien serait disproportionné. Tous ses voisins de ce menu
     * prennent déjà leur libellé dans `common.json` (`edition.volunteers.swaps`, `.planning`,
     * `.volunteer_notifications`) : le lien était le seul à en sortir.
     */
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../../app/layouts/edition-dashboard.vue'),
      'utf8'
    )

    expect(src).toContain("t('edition.volunteers.renforts')")
    /*
     * ⚠️ On vise l'APPEL et non la chaîne nue : le commentaire ci-dessus nomme l'ancienne clé pour
     * dire ce qu'elle coûtait, et une assertion sur `'volunteers.renforts_title'` mordait dessus.
     * Le même piège a déjà fait six fois des faux positifs dans l'outillage i18n du dépôt.
     */
    expect(src).not.toContain("t('volunteers.renforts_title')")
  })
})
