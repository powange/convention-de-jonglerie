import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PageErreur from '../../../app/error.vue'

/**
 * La page d'erreur, et surtout ce qu'elle dit d'une coupure de réseau.
 *
 * ⚠️ CE QU'ELLE REMPLACE. Il n'y avait aucune page d'erreur : les visiteurs tombaient sur celle de
 * Nuxt, « 500 Internal Server Error » suivi de « Failed to fetch dynamically imported module ».
 * Signalé deux fois en production, la seconde avec la capture d'un téléphone en 3G à 13 % de
 * batterie. Les deux fois, la bribe existait et répondait 200 : rien n'était en panne, et l'écran
 * annonçait une panne de serveur. D'où le premier cas ci-dessous — **le code 500 ne doit PAS
 * apparaître** quand la cause est une requête perdue.
 */

const ERREUR_DE_BRIBE = {
  statusCode: 500,
  message: 'Failed to fetch dynamically imported module: https://x/_nuxt/KNI9fb3m.js',
} as never

const ERREUR_VRAIE = {
  statusCode: 500,
  message: 'Cannot read properties of undefined',
} as never

/** Le marqueur qui désarme la reprise automatique, pour que le montage ne recharge pas. */
function desarmerLaReprise() {
  sessionStorage.setItem(`bribe:reprise:${window.location.pathname}`, '1')
}

describe('page d’erreur', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.spyOn(window.location, 'reload').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it("parle de connexion, et ne montre AUCUN code d'erreur, quand la bribe n'est pas arrivée", async () => {
    desarmerLaReprise()

    const composant = await mountSuspended(PageErreur, { props: { error: ERREUR_DE_BRIBE } })
    const texte = composant.text()

    // Les deux langues : l'environnement de test rend l'anglais, et s'appuyer sur sa locale a
    // déjà fait tomber une CI (voir le test du composant de secours).
    expect(texte).toMatch(/chargement|loading/i)
    // 🔬 L'assertion qui porte tout : « 500 » laissait croire à une panne du site.
    expect(texte).not.toContain('500')
    // Et surtout pas le message technique du navigateur.
    expect(texte).not.toContain('dynamically imported')
  })

  it('annonce une adresse introuvable, sans proposer de réessayer', async () => {
    /*
     * Un 404 n'est pas une panne : « Une erreur est survenue » y serait faux, et « Réessayer »
     * ne mènerait qu'au même 404. C'est le seul cas où le bouton de reprise disparaît.
     */
    const composant = await mountSuspended(PageErreur, {
      props: { error: { statusCode: 404, message: 'Page not found' } as never },
    })

    expect(composant.text()).toMatch(/introuvable|not found/i)
    expect(composant.findAll('button')).toHaveLength(1)
    expect(window.location.reload).not.toHaveBeenCalled()
  })

  it('montre le code pour une vraie erreur, elle', async () => {
    const composant = await mountSuspended(PageErreur, { props: { error: ERREUR_VRAIE } })

    expect(composant.text()).toContain('500')
  })

  it('reprend une fois toute seule, puis laisse la main', async () => {
    /*
     * Sur un réseau faible, la requête suivante réussit souvent : le visiteur n'a rien vu passer.
     * Mais une seule fois — sans ce plafond, un déploiement réellement cassé ferait tourner le
     * navigateur en boucle.
     */
    await mountSuspended(PageErreur, { props: { error: ERREUR_DE_BRIBE } })
    expect(window.location.reload).toHaveBeenCalledTimes(1)

    await mountSuspended(PageErreur, { props: { error: ERREUR_DE_BRIBE } })
    expect(window.location.reload).toHaveBeenCalledTimes(1)
  })

  it('ne recharge jamais pour une erreur qui ne vient pas du réseau', async () => {
    await mountSuspended(PageErreur, { props: { error: ERREUR_VRAIE } })

    expect(window.location.reload).not.toHaveBeenCalled()
  })
})
