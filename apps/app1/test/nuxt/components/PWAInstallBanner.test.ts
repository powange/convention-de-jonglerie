import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'

import PWAInstallBanner from '../../../app/components/PWAInstallBanner.vue'

/**
 * L'invitation à installer l'application ne bloque plus rien, et se tait où il faut.
 *
 * ⚠️ CE QUE CES TESTS REMPLACENT, et pourquoi il fallait les réécrire. L'ancien fichier comptait
 * cinq tests, tous verts, et toutes ses assertions étaient `component.exists()` ou
 * `html().length > 0`. Celui qui s'appelait « ne devrait pas afficher la bannière si déjà en mode
 * standalone » n'assertait QUE `exists()` — vrai que la bannière soit là ou non. Celui qui
 * s'appelait « utilise UModal comme composant principal » ne disait rien de `UModal`.
 *
 * Cinq tests qui ne pouvaient rien attraper, et qui auraient continué de passer quand la modale a
 * été remplacée par un bandeau.
 *
 * ⚠️ POURQUOI LE COMPOSABLE EST REMPLACÉ PAR UN DOUBLE. `useInvitePwa` garde son état AU NIVEAU DU
 * MODULE — c'est voulu : le navigateur n'émet `beforeinstallprompt` qu'une fois, et le bandeau
 * comme l'entrée du menu doivent lire le même objet. Cet état survit donc entre les tests. Piloter
 * un double est le seul moyen de décider, test par test, ce que le bandeau doit voir.
 */

const etat = vi.hoisted(() => ({
  visible: false,
  installations: 0,
  reports: 0,
}))

mockNuxtImport('useInvitePwa', () => () => ({
  afficherLeBandeau: computed(() => etat.visible),
  entreeDeMenuDisponible: computed(() => false),
  installer: () => {
    etat.installations += 1
  },
  reporter: () => {
    etat.reports += 1
  },
  ecouterLeNavigateur: () => {},
}))

describe('PWAInstallBanner', () => {
  const montes: { unmount: () => void }[] = []

  beforeEach(() => {
    etat.visible = false
    etat.installations = 0
    etat.reports = 0
  })

  afterEach(() => {
    while (montes.length) montes.pop()?.unmount()
  })

  const monter = async () => {
    const composant = await mountSuspended(PWAInstallBanner)
    montes.push(composant)
    await nextTick()
    return composant
  }

  it('n’affiche RIEN quand l’invitation n’est pas permise', async () => {
    /*
     * L'assertion que l'ancien fichier ne faisait pas. Rendre le composant n'a jamais rien prouvé :
     * ce qui compte est qu'il ne mette pas de bandeau à l'écran.
     */
    const composant = await monter()

    expect(composant.find('.fixed').exists()).toBe(false)
    expect(composant.findAll('button')).toHaveLength(0)
  })

  it('affiche le bandeau quand l’invitation est permise', async () => {
    etat.visible = true

    const composant = await monter()

    expect(composant.find('.fixed').exists()).toBe(true)
  })

  it('le bandeau est POSITIONNÉ, pas en flux — et donc non bloquant', async () => {
    /*
     * ⚠️ LE CŒUR DU LOT. L'invitation était une `UModal` : elle prenait le focus et empêchait toute
     * interaction avec la page, au milieu d'un formulaire ou d'un scan de billets.
     *
     * On mesure donc la NATURE du conteneur, pas seulement sa présence : `fixed` + `bottom-0`
     * signifie qu'il flotte au-dessus sans rien déplacer et sans capter les clics ailleurs que sur
     * ses boutons. Un bandeau en flux (`UBanner`) pousserait la page vers le bas sous les doigts de
     * quelqu'un en train de la lire.
     */
    etat.visible = true

    const composant = await monter()
    const classes = composant.find('.fixed').classes()

    expect(classes).toContain('fixed')
    expect(classes.some((c) => c.includes('bottom-0'))).toBe(true)
  })

  it('n’emploie PLUS de modale', async () => {
    // La garde qui empêche le retour en arrière : une modale se reconnaît à son rôle ARIA.
    etat.visible = true

    const composant = await monter()

    expect(composant.find('[role="dialog"]').exists()).toBe(false)
    expect(composant.find('[aria-modal="true"]').exists()).toBe(false)
  })

  it('les deux actions existantes sont proposées', async () => {
    /*
     * ⚠️ L'assertion porte sur les BOUTONS, pas sur leurs libellés. Le harnais rend les vraies
     * traductions dans sa locale par défaut (`en`) : asserter « pwa.install.button » cherchait une
     * clé brute qui n'apparaît jamais, et asserter « Installer maintenant » lierait le test au
     * français. Ce qui compte ici est qu'il y ait bien deux actions, plus le bouton de fermeture.
     */
    etat.visible = true

    const composant = await monter()
    const actions = composant.findAll('[data-slot="actions"] button')

    expect(actions.length).toBeGreaterThanOrEqual(2)
    // Les libellés sont rendus, quels qu'ils soient : un bouton sans libellé serait muet.
    const libelles = composant.findAll('[data-slot="label"]').map((n) => n.text())
    expect(libelles.filter((l) => l.length > 0).length).toBeGreaterThanOrEqual(2)
  })

  it('déclenche l’installation au clic sur la première action', async () => {
    /*
     * Le bouton de l'ancienne modale appelait bien `installApp`. Ce qui n'était pas éprouvé, c'est
     * qu'il l'appelle encore après le changement de composant : un `onClick` mal nommé sur
     * `UAlert` rendrait un bouton qui s'affiche, se survole, s'enfonce, et ne fait rien — le même
     * défaut que celui corrigé sur les toasts.
     */
    etat.visible = true

    const composant = await monter()
    const actions = composant.findAll('[data-slot="wrapper"] [data-slot="actions"] button')
    await actions[0]!.trigger('click')

    expect(etat.installations).toBe(1)
    expect(etat.reports).toBe(0)
  })

  it('« Plus tard » reporte, et n’installe rien', async () => {
    etat.visible = true

    const composant = await monter()
    const actions = composant.findAll('[data-slot="wrapper"] [data-slot="actions"] button')
    await actions[1]!.trigger('click')

    expect(etat.reports).toBe(1)
    expect(etat.installations).toBe(0)
  })
})
