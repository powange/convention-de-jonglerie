import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import Section from '../../../../../../layers/carpool/app/components/edition/carpool/Section.vue'

/**
 * Affiner la liste des annonces de covoiturage.
 *
 * ## ⚠️ LE DÉFAUT
 *
 * Une édition fréquentée porte des dizaines d'annonces, et la page n'offrait qu'un interrupteur
 * « archives ». Pour savoir si quelqu'un partait de sa ville, il fallait lire chaque carte.
 *
 * ## Ce que ce fichier éprouve, et ce qu'il n'éprouve pas
 *
 * La RÈGLE de filtrage est éprouvée ailleurs, dans `test/unit/utils/filtres-du-covoiturage.test.ts`
 * — croisements des trois critères compris. Ici, c'est le **câblage** qui est en jeu, et lui seul :
 * un util juste mais branché nulle part est le défaut que ce dépôt a payé cinq fois.
 *
 * On ne pilote donc que le champ « ville », qui est un vrai `<input>`. `USelect` et `UCheckbox` sont
 * des composants à gabarit libre (Reka UI) : les piloter dans jsdom reviendrait à tester Reka UI, et
 * un test qui échoue sur une version de la bibliothèque n'apprend rien sur ce filtre.
 */
const offresRendues = { valeur: [] as unknown[] }
const demandesRendues = { valeur: [] as unknown[] }

registerEndpoint('/api/editions/7/carpool-offers', () => offresRendues.valeur)
registerEndpoint('/api/editions/7/carpool-requests', () => demandesRendues.valeur)

/*
 * ⚠️ `useFetch` MET SES RÉPONSES EN CACHE, PAR URL, ET LE CACHE SURVIT AU DÉMONTAGE.
 *
 * Sans cette purge, le second montage ne rappelle pas le point d'entrée : il relit la réponse du
 * premier. Les trois quarts de ce fichier étaient faux de la manière la plus trompeuse — le cas
 * « l'édition n'a AUCUNE annonce » affichait deux offres d'un test précédent, et le cas « resserre
 * aussi les demandes » n'avait aucune demande à resserrer. Aucune erreur, aucun avertissement : les
 * assertions portaient simplement sur les données du voisin.
 *
 * L'URL est la même d'un test à l'autre parce que l'identifiant d'édition est fixé par le point
 * d'entrée enregistré ; c'est donc la clé qu'il faut vider, pas l'URL qu'il faut varier.
 */
beforeEach(() => {
  clearNuxtData()
})

mockNuxtImport('useAuthStore', () => () => ({
  isAuthenticated: false,
  user: null,
}))

/*
 * ⚠️ `$t` RÉSOUT EN ANGLAIS DANS CE HARNAIS. Une clé qui existe en anglais est traduite ; une clé
 * neuve, créée en français seulement comme le veut la règle du dépôt, ressort telle quelle. Rendre
 * `t` identité évite d'asserter sur un libellé dont la langue dépend du harnais — et surtout, sur
 * un libellé qu'on changera : c'est la mésaventure du lot précédent.
 */
mockNuxtImport('useI18n', () => () => ({
  t: (cle: string) => cle,
  locale: { value: 'fr' },
}))

const offre = (p: Record<string, unknown> = {}) => ({
  id: 1,
  userId: 2,
  tripDate: new Date(Date.now() + 86_400_000).toISOString(),
  locationCity: 'Lyon',
  locationAddress: 'Gare Part-Dieu',
  availableSeats: 4,
  remainingSeats: 2,
  direction: 'TO_EVENT',
  bookings: [],
  passengers: [],
  commentCount: 0,
  user: { id: 2, pseudo: 'Conductrice' },
  ...p,
})

const demande = (p: Record<string, unknown> = {}) => ({
  id: 10,
  userId: 3,
  tripDate: new Date(Date.now() + 86_400_000).toISOString(),
  locationCity: 'Lyon',
  seatsNeeded: 1,
  direction: 'TO_EVENT',
  commentCount: 0,
  user: { id: 3, pseudo: 'Passager' },
  ...p,
})

const monter = async (offres: unknown[], demandes: unknown[] = []) => {
  offresRendues.valeur = offres
  demandesRendues.valeur = demandes

  return mountSuspended(Section, {
    props: { editionId: 7 },
    global: {
      /*
       * Les cartes sont remplacées par un témoin : ce n'est pas leur rendu qu'on observe, et une
       * carte réelle ferait entrer dans ce test ses propres dépendances (session, fuseau, Leaflet
       * pour l'onglet carte). Le témoin porte la ville, ce qui permet d'asserter QUELLES annonces
       * restent et non seulement combien.
       */
      stubs: {
        EditionCarpoolOfferCard: {
          props: ['offer'],
          template: '<div data-offre>{{ offer.locationCity }}</div>',
        },
        EditionCarpoolRequestCard: {
          props: ['request'],
          template: '<div data-demande>{{ request.locationCity }}</div>',
        },
      },
    },
  })
}

/*
 * ⚠️ CE QUE `$t` REND DANS CE HARNAIS, ET POURQUOI LES ASSERTIONS VISENT L'ICÔNE.
 *
 * `$t` du gabarit ne passe PAS par le `useI18n` simulé ci-dessus : il interroge le module i18n, en
 * **anglais** dans ce harnais. Une clé neuve — créée en français seulement, comme le veut la règle
 * du dépôt — ressort donc telle quelle, tandis qu'une clé PRÉEXISTANTE est traduite : l'état vide
 * historique s'affiche « Be the first to offer a ride… ». Asserter ce libellé reviendrait à casser
 * le test au premier mot changé — c'est la mésaventure d'un lot précédent.
 *
 * L'icône de l'état vide porte, elle, des classes que rien d'autre ne porte dans ce rendu : les
 * icônes d'onglet sont en `size-5`. C'est donc le relevé stable.
 */
/*
 * Le relevé stable est `data-etat-vide`, posé par le composant, et non un libellé.
 *
 * Mon premier jet cherchait la clé `components.carpool.filters.none_matching` dans le rendu, au
 * motif qu'une clé neuve créée en français seulement ressort telle quelle dans ce harnais — qui est
 * en anglais. C'était vrai le jour où je l'ai écrit, et **faux le lendemain** : la synchronisation
 * des traductions remplit les douze autres langues avec `[TODO] <texte français>`, et la clé résout
 * alors ; puis `/translate-todos` la traduit, et le texte français disparaît à son tour. Ni la clé
 * ni le texte français ne tiennent dans le temps.
 */
const etatVide = (page: Awaited<ReturnType<typeof monter>>) =>
  page.find('[data-etat-vide]').attributes('data-etat-vide')

/**
 * Activer un onglet.
 *
 * `UTabs` démonte les panneaux inactifs (`unmountOnHide` vaut `true` par défaut, et c'est voulu :
 * Leaflet n'est chargé qu'à l'ouverture de l'onglet carte). Le panneau des demandes n'existe donc
 * PAS avant ce clic — ma première version assertait sur un panneau absent, et la liste vide qu'elle
 * observait n'était pas un filtre qui marche, c'était un onglet qui n'était pas là.
 *
 * Visé par `role="tab"` et non par une classe : c'est le contrat d'accessibilité du composant, pas
 * un détail de son gabarit.
 */
const activerLOnglet = async (page: Awaited<ReturnType<typeof monter>>, cle: string) => {
  const onglet = page.findAll('[role="tab"]').find((bouton) => bouton.text().includes(cle))
  expect(onglet, `onglet ${cle} introuvable`).toBeTruthy()
  // Reka UI active sur `mousedown` puis `focus` (mode « automatic »), pas sur `click`.
  await onglet!.trigger('mousedown')
  await onglet!.trigger('focus')
  await nextTick()
  await nextTick()
}

/** La case « Offres avec des places libres » : un `role="checkbox"`, et non un `<input>`. */
const cocherLesPlacesLibres = async (page: Awaited<ReturnType<typeof monter>>) => {
  const case_ = page.find('[role="checkbox"]')
  expect(case_.exists()).toBe(true)
  await case_.trigger('click')
  await nextTick()
}

/** Le champ « ville » : le seul champ texte de la barre de filtres. */
const saisirLaVille = async (page: Awaited<ReturnType<typeof monter>>, valeur: string) => {
  const champ = page.find('input[type="text"]')
  expect(champ.exists()).toBe(true)
  await champ.setValue(valeur)
  await nextTick()
}

describe('la barre de filtres du covoiturage', () => {
  it('affiche toutes les annonces au repos', async () => {
    const page = await monter([offre({ id: 1 }), offre({ id: 2, locationCity: 'Paris' })])

    expect(page.findAll('[data-offre]')).toHaveLength(2)
  })

  it('resserre la liste sur la ville saisie, accents et casse ignorés', async () => {
    /*
     * ⚠️ L'ASSERTION QUI PROUVE LE CÂBLAGE, et elle porte sur la VILLE RETENUE, pas sur un compte.
     * Un filtre qui garderait la mauvaise annonce donnerait le même nombre.
     */
    const page = await monter([
      offre({ id: 1, locationCity: 'Châlons-en-Champagne' }),
      offre({ id: 2, locationCity: 'Lyon' }),
    ])

    await saisirLaVille(page, 'chalons')

    const restantes = page.findAll('[data-offre]')
    expect(restantes).toHaveLength(1)
    expect(restantes[0]!.text()).toContain('Châlons')
  })

  it('resserre aussi les demandes', async () => {
    // Les deux onglets lisent la même règle : sans ce cas, un oubli sur les demandes passerait.
    const page = await monter(
      [],
      [demande({ id: 10, locationCity: 'Nantes' }), demande({ id: 11 })]
    )

    await activerLOnglet(page, 'components.carpool.requests_long')
    expect(page.findAll('[data-demande]')).toHaveLength(2)

    await saisirLaVille(page, 'nantes')

    const restantes = page.findAll('[data-demande]')
    expect(restantes).toHaveLength(1)
    expect(restantes[0]!.text()).toContain('Nantes')
  })

  it('la case « places libres » écarte une offre complète', async () => {
    const page = await monter([
      offre({ id: 1, locationCity: 'Lyon', remainingSeats: 0 }),
      offre({ id: 2, locationCity: 'Paris', remainingSeats: 3 }),
    ])

    await cocherLesPlacesLibres(page)

    const restantes = page.findAll('[data-offre]')
    expect(restantes).toHaveLength(1)
    expect(restantes[0]!.text()).toContain('Paris')
  })

  it('reporte le resserrement sur le compteur de l’onglet', async () => {
    /*
     * ⚠️ LE COMPTEUR EST LE SEUL ENDROIT OÙ LE FILTRE SE VOIT DEPUIS L'AUTRE ONGLET. Un onglet qui
     * annoncerait 2 offres pour en montrer 1 ferait chercher la seconde — et c'est le genre de
     * chiffre faux mais plausible qu'on ne remet jamais en cause.
     */
    const page = await monter([offre({ id: 1 }), offre({ id: 2, locationCity: 'Paris' })])

    expect(page.text()).toContain('(2)')

    await saisirLaVille(page, 'paris')

    expect(page.text()).toContain('(1)')
    expect(page.text()).not.toContain('(2)')
  })

  describe("l'état vide", () => {
    it('propose de réinitialiser quand les filtres ont tout masqué', async () => {
      const page = await monter([offre({ id: 1, locationCity: 'Lyon' })])

      await saisirLaVille(page, 'marseille')

      expect(page.findAll('[data-offre]')).toHaveLength(0)
      expect(etatVide(page)).toBe('filtres')
      // Et le bouton qui répare la situation est bien là — l'état seul ne le prouverait pas.
      expect(page.findAll('button').length).toBeGreaterThan(0)
    })

    it("invite à publier quand l'édition n'a AUCUNE annonce", async () => {
      /*
       * ⚠️ LE CAS QUI BORNE LE DISCRIMINANT, et il est le cœur de ces deux états.
       *
       * Le discriminant n'est PAS « des filtres sont posés » : sur une édition sans aucune annonce,
       * proposer de réinitialiser ne ferait rien apparaître, et cacherait l'invitation à publier la
       * première. Sans ce cas, un simple `v-if="filtresActifs"` passerait.
       */
      const page = await monter([])

      expect(etatVide(page)).toBe('aucune-annonce')
    })

    it("n'invite plus à publier quand ce sont les filtres qui ont vidé la liste", async () => {
      // Le témoin opposé du précédent : les deux messages ne doivent jamais se croiser.
      const page = await monter([offre({ id: 1, locationCity: 'Lyon' })])

      await saisirLaVille(page, 'marseille')

      expect(etatVide(page)).not.toBe('aucune-annonce')
    })
  })

  it('rend les DEUX intitulés d’onglet, le court et le long', async () => {
    /*
     * ⚠️ CE QUI REMPLACE UNE MESURE DE `window.innerWidth`.
     *
     * Le composant tenait la largeur de la fenêtre dans un `ref`, posé au montage et à chaque
     * redimensionnement, pour choisir l'intitulé. Le `ref` partait à `false` côté serveur : le
     * rendu initial portait TOUJOURS l'intitulé long, et l'hydratation ne corrige pas une classe
     * déjà posée — un défaut déjà payé ailleurs dans ce dépôt. Sur un téléphone, le premier
     * affichage débordait.
     *
     * Les deux variantes sont maintenant rendues, et `sm:` en montre une. Ce test asserte donc leur
     * PRÉSENCE SIMULTANÉE : c'est précisément ce qu'une mesure en JavaScript ne pouvait pas produire,
     * et donc le seul relevé qui distingue les deux implémentations.
     */
    const page = await monter([])
    const texte = page.text()

    expect(texte).toContain('components.carpool.offers_long')
    expect(texte).toContain('components.carpool.offers_short')
    expect(texte).toContain('components.carpool.map_tab')
    expect(texte).toContain('components.carpool.map_tab_short')
  })
})
