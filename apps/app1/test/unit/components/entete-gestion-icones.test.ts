import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * L'ordre des icônes dans la barre de gestion d'une édition.
 *
 * Demande de l'utilisateur, le 1er octobre 2026 : la messagerie à GAUCHE des notifications, comme
 * dans l'en-tête du site, pour qu'un organisateur retrouve ses deux icônes à la même place en
 * passant de l'un à l'autre.
 *
 * ⚠️ POURQUOI UN TEST QUI LIT LA SOURCE, et pas un test de bout en bout.
 * `MessengerHeaderButton` ne s'affiche que si le compte a AU MOINS UNE CONVERSATION
 * (`hasConversations`, dans le composant). Un test Playwright sur le compte de test serait donc
 * VACUEMENT vert — l'icône absente, l'ordre trivialement « respecté ». Et lui donner une
 * conversation coûte plus que l'assertion ne vaut : le groupe des organisateurs exige une ligne
 * `EditionOrganizer` que le créateur d'une convention n'a pas (403 constaté), et le passer
 * bénévole de l'édition partagée remplit son prénom — cohabitation qui a déjà valu une CI rouge.
 *
 * Ce test prouve donc MOINS : l'ordre dans la mise en page, pas celui à l'écran. Mais il le prouve
 * vraiment, et il attrape le seul accident vraisemblable — qu'on réordonne ce bloc.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), 'utf8')

const MISE_EN_PAGE = 'app/layouts/edition-dashboard.vue'
const ENTETE_DU_SITE = 'app/components/AppHeader.vue'

const ordreDesIcones = (source: string) => {
  const messagerie = source.indexOf('<MessengerHeaderButton')
  const notifications = source.indexOf('<NotificationsCenter')
  return { messagerie, notifications }
}

describe('la barre de gestion porte les mêmes icônes, dans le même ordre, que l’en-tête du site', () => {
  it('🔬 la messagerie précède les notifications dans la barre de gestion', () => {
    const { messagerie, notifications } = ordreDesIcones(lire(MISE_EN_PAGE))

    expect(messagerie, 'MessengerHeaderButton absent de la barre de gestion').toBeGreaterThan(-1)
    expect(notifications, 'NotificationsCenter absent de la barre de gestion').toBeGreaterThan(-1)
    expect(messagerie).toBeLessThan(notifications)
  })

  it('🔬 le même ordre que l’en-tête du site, lu et non recopié', () => {
    /*
     * L'assertion qui donne son sens à la précédente : l'énoncé est « comme dans l'en-tête du
     * site ». On compare donc les deux sources plutôt que de figer un ordre ici — si quelqu'un
     * inverse les deux icônes du site un jour, ce test demandera que la gestion suive, au lieu de
     * laisser les deux barres diverger en silence.
     */
    const site = ordreDesIcones(lire(ENTETE_DU_SITE))
    const gestion = ordreDesIcones(lire(MISE_EN_PAGE))

    expect(site.messagerie).toBeGreaterThan(-1)
    expect(site.messagerie < site.notifications).toBe(gestion.messagerie < gestion.notifications)
  })
})
