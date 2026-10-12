import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Le sondage distingue le mauvais LIEN de la simple PANNE — constat F2 des petits modules.
 *
 * ## ⚠️⚠️ CE QUE CE DÉFAUT COÛTAIT, et qui n'est pas visible depuis la page
 *
 * `fetchSurvey` posait `error = true` pour n'importe quelle exception, et l'écran n'avait qu'un
 * seul état d'erreur : « Ce lien de sondage est invalide ou a expiré ». Un votant dont la session
 * venait d'expirer — le cas le plus fréquent ici, un sondage se lisant longuement —, une coupure
 * réseau ou un 500 lisaient donc qu'ils avaient un MAUVAIS LIEN.
 *
 * Ils allaient alors en réclamer un nouveau à l'organisateur, **qui le régénérait — invalidant
 * celui de tous les autres votants**. Une panne passagère se soldait par une invalidation
 * collective, et personne ne pouvait faire le lien entre les deux.
 *
 * ## Pourquoi un test MONTÉ, et pas une garde de source
 *
 * Ce qui est en cause ici est exactement ce qui s'affiche, et la page est assez petite (220
 * lignes, un seul chargement) pour être montée pour de vrai. Une lecture du code dirait que les
 * trois branches existent ; elle ne dirait pas laquelle sort.
 *
 * ## ⚠️ ON VISE LES ANCRES `data-*`, PAS LE TEXTE
 *
 * Les deux clés de ce lot sont créées en français seulement, et l'environnement de test est en
 * ANGLAIS : elles y ressortiraient brutes. Asserter le texte échouerait pour une raison étrangère
 * au lot, et asserter la clé brute serait vrai jusqu'à la synchronisation des traductions.
 */
const JETON = 'jeton-de-test'

/** Ce que l'endpoint fait, réglé cas par cas. */
const reponse = vi.hoisted(() => ({
  code: 0 as number,
  charge: null as unknown,
}))

registerEndpoint(`/api/survey/${JETON}`, () => {
  if (reponse.code) throw createError({ statusCode: reponse.code })
  return reponse.charge
})

const navigateTo = vi.hoisted(() => vi.fn((cible: string) => cible))
mockNuxtImport('navigateTo', () => navigateTo)

mockNuxtImport('useRoute', () => () => ({
  params: { token: JETON },
  fullPath: `/survey/${JETON}`,
  query: {},
}))

import PageSondage from '../../../app/pages/survey/[token].vue'

const sondage = {
  showCall: {
    name: 'Scène ouverte',
    surveyOpen: true,
    edition: { name: 'Édition 2026', convention: { name: 'Convention test' } },
  },
  applications: [],
  myVotes: {},
  results: null,
  isApplicant: false,
}

let monte: { unmount: () => void; html: () => string } | null = null
afterEach(() => {
  monte?.unmount()
  monte = null
  navigateTo.mockClear()
})

beforeEach(() => {
  reponse.code = 0
  reponse.charge = sondage
})

/**
 * Monte la page ET ATTEND QUE LE CHARGEMENT SOIT RETOMBÉ, puis rend l'état atteint.
 *
 * ⚠️⚠️ SANS CETTE ATTENTE, QUATRE DE CES SEPT CAS ÉTAIENT FAUX. `mountSuspended` résout le
 * `setup`, mais `fetchSurvey` part d'un `onMounted` que personne n'attend : au moment de
 * l'assertion, le gabarit en était encore à son état de chargement. Les cas en `not.toContain`
 * passaient donc POUR LA MAUVAISE RAISON — aucun message n'était affiché parce qu'AUCUN écran ne
 * l'était.
 *
 * ⚠️⚠️ ET MON PREMIER TÉMOIN D'ATTENTE A MORDU : il cherchait la chaîne « Loading » dans le HTML,
 * qui contient le COMMENTAIRE `<!-- Loading -->` du gabarit. La condition était donc vraie pour
 * toujours, et les sept cas échouaient sur l'attente elle-même — sur un correctif qui
 * fonctionnait. D'où les ancres `data-etat`, qui ne dépendent ni d'un texte, ni d'un commentaire,
 * ni de la langue.
 *
 * 📍 Et une attente RÉELLE plutôt que `vi.waitFor` : son scrutin ne laissait pas l'appel
 * progresser.
 */
const etatAtteint = async (): Promise<string> => {
  monte = (await mountSuspended(PageSondage)) as never
  for (let i = 0; i < 150 && etat() === 'chargement'; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  // Le témoin de l'attente : sans lui, un chargement qui n'aboutit jamais rendrait verts tous les
  // cas en `not.toContain`, puisqu'un écran qui n'existe pas ne contient rien.
  expect(etat(), "le chargement n'est pas retombé").not.toBe('chargement')
  return etat()
}

/** L'état que la page affiche, lu sur son ancre et non sur son texte. */
const etat = (): string => monte!.html().match(/data-etat="([a-z-]+)"/)?.[1] ?? 'aucun'

describe('sondage — le mauvais lien n’est plus le message de toutes les pannes', () => {
  it('un 404 annonce bien un lien invalide', async () => {
    reponse.code = 404
    expect(await etatAtteint()).toBe('lien-invalide')
  })

  it('un 500 n’annonce PAS un lien invalide', async () => {
    // 📍 LE CŒUR DU CONSTAT. C'est cette assertion-ci qui échouait avant le correctif : les deux
    // cas produisaient le même écran.
    reponse.code = 500
    expect(await etatAtteint()).toBe('panne')
  })

  it('une coupure réseau n’annonce pas davantage un lien invalide', async () => {
    // Le serveur ne répond rien du tout : pas de code à lire, donc la branche par défaut.
    reponse.code = 503
    expect(await etatAtteint()).toBe('panne')
  })

  it('un 500 offre de réessayer', async () => {
    reponse.code = 500
    await etatAtteint()
    // 📍 L'ancre du bouton, et non son libellé : `common.retry` EXISTE en anglais, donc elle est
    // rendue « Retry » et non en clé brute. Chercher la clé échouait sur un correctif qui marche.
    expect(monte!.html()).toContain('data-action="reessayer"')
  })

  it('un 404 n’offre PAS de réessayer', async () => {
    // Réessayer sur un lien invalide ne peut rien donner : c'est le seul cas où demander un
    // nouveau lien a un sens, et le bouton détournerait de ce geste-là.
    reponse.code = 404
    await etatAtteint()
    expect(monte!.html()).not.toContain('data-action="reessayer"')
  })

  it('un 401 ramène à la connexion, avec retour sur le sondage', async () => {
    reponse.code = 401
    await etatAtteint()
    expect(navigateTo).toHaveBeenCalledTimes(1)
    const cible = navigateTo.mock.calls[0]![0] as string
    expect(cible).toContain('/login')
    expect(cible).toContain(encodeURIComponent(`/survey/${JETON}`))
  })

  it("un 401 n'affiche aucun des deux états d'erreur avant de partir", async () => {
    // Sinon l'écran clignoterait un message d'échec sur une page qu'on quitte.
    reponse.code = 401
    expect(await etatAtteint()).toBe('aucun')
  })

  it('un succès affiche le sondage, et aucun état d’erreur', async () => {
    expect(await etatAtteint()).toBe('sondage')
    expect(navigateTo).not.toHaveBeenCalled()
  })
})
