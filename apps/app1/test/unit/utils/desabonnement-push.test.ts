import { describe, it, expect } from 'vitest'

import {
  corpsDesabonnementAppareil,
  corpsDesabonnementTousAppareils,
} from '../../../app/utils/desabonnement-push'

/**
 * Couper les notifications sur un appareil ne les coupe que sur celui-là.
 *
 * ⚠️ LA MOITIÉ CLIENTE DU DÉFAUT. Le serveur lisait un corps vide comme « tous les appareils », et
 * `unsubscribe` partait précisément sans corps :
 *
 *     await $fetch('/api/notifications/fcm/unsubscribe', { method: 'POST' })
 *
 * Couper les notifications sur son téléphone les coupait donc aussi sur son ordinateur. Durcir le
 * serveur seul aurait transformé ce défaut silencieux en 400 tout aussi silencieux — le bouton
 * n'aurait plus rien coupé du tout. Les deux moitiés vont ensemble.
 *
 * 🔬 POURQUOI CES TESTS PORTENT SUR UNE FONCTION PURE et non sur le composable : le `$fetch` de
 * Nuxt n'est pas interceptable proprement depuis un test. `vi.stubGlobal('$fetch', …)` ne le touche
 * pas — le composable appelle le `$fetch` auto-importé, pas `globalThis.$fetch`, ce qui laissait
 * l'appel réel partir et répondre 404. Et `registerEndpoint` répond bien, mais son handler ne
 * partage pas les tableaux d'observation du fichier de test : le corps y restait `undefined`, ce
 * qui se lit à tort comme « rien n'a été envoyé ».
 *
 * Deux impasses, et une leçon : un test qui n'observe pas ce qu'il croit observer est pire qu'une
 * absence de test. La DÉCISION — quel périmètre, et jamais « tout » par défaut — se vérifie sans
 * harnais, et c'est elle qui portait le défaut.
 *
 * ⚠️ NON COUVERT, et il faut le savoir : que le composable passe bien ce corps à `$fetch`. Cela se
 * lit dans le code (`body: corps`) et ne se mesure pas ici.
 */

const APPAREIL = '11111111-2222-4333-8444-555555555555'

describe('corpsDesabonnementAppareil', () => {
  it('désigne l’appareil par son `deviceId`', () => {
    expect(corpsDesabonnementAppareil(APPAREIL, null)).toEqual({ deviceId: APPAREIL })
  })

  it('ne demande JAMAIS « tous les appareils »', () => {
    /*
     * L'assertion qui compte. `all` doit rester absent : c'est le geste qu'on ne déduit jamais, et
     * son absence est ce qui distingue « cet appareil » de l'ancien comportement.
     */
    expect(corpsDesabonnementAppareil(APPAREIL, 'jeton-123')).not.toHaveProperty('all')
  })

  it('joint le token au `deviceId` quand les deux sont connus', () => {
    /*
     * Ce n'est pas une redondance. Firebase fait TOURNER les tokens : un même appareil peut avoir
     * plusieurs lignes, et n'en désactiver qu'une laisserait les notifications arriver. À l'inverse,
     * les lignes créées avant la colonne `deviceId` portent `deviceId: null` et ne se retrouvent
     * que par leur token. Le serveur combine les deux en `OR`.
     */
    expect(corpsDesabonnementAppareil(APPAREIL, 'jeton-123')).toEqual({
      deviceId: APPAREIL,
      token: 'jeton-123',
    })
  })

  it('se contente du token quand l’appareil est inconnu', () => {
    // `localStorage` inaccessible (navigation privée verrouillée, site data bloqué) : le token
    // suffit à désigner l'installation, et c'est mieux que de ne rien couper.
    expect(corpsDesabonnementAppareil(null, 'jeton-123')).toEqual({ token: 'jeton-123' })
  })

  it('rend `null` quand rien ne désigne l’appareil — pas un objet vide', () => {
    /*
     * LE TEST CENTRAL DE CE FICHIER. Un objet vide est exactement ce que le serveur interprétait
     * comme « coupe tout, partout ». Rendre `{}` ici, par commodité, réintroduirait le défaut
     * depuis le client alors même que le serveur a été durci — et le 400 qui en résulterait
     * passerait pour une panne plutôt que pour un garde-fou.
     */
    expect(corpsDesabonnementAppareil(null, null)).toBeNull()
    expect(corpsDesabonnementAppareil(undefined, undefined)).toBeNull()
  })

  it('traite une chaîne vide comme une absence', () => {
    // `localStorage.getItem` peut rendre `''` sur une valeur écrasée. Une chaîne vide dans
    // `deviceId` ne correspondrait à aucune ligne : autant ne pas l'envoyer.
    expect(corpsDesabonnementAppareil('', '')).toBeNull()
  })
})

describe('corpsDesabonnementTousAppareils', () => {
  it('demande « tous » EXPLICITEMENT', () => {
    // Le geste existe, nommé. C'est toute la différence avec l'ancien corps vide.
    expect(corpsDesabonnementTousAppareils()).toEqual({ all: true })
  })
})
