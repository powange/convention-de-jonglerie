import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'

import { TicketingVolunteerHandoutItemsList } from '#components'

/**
 * Le réglage des articles à remettre aux bénévoles.
 *
 * Ces tests sont nés d'un onglet qui ne montait pas du tout : une surveillance en `immediate`
 * appelait, pendant le `setup`, une fonction déclarée cinquante lignes plus bas. Zone morte
 * temporelle, `setup` qui lève, composant qui ne rend RIEN — et rien pour le voir, puisque ni le
 * lint, ni le typage, ni les tests unitaires ne montent un composant. D'où ces tests-ci.
 *
 * Deux pièges de cet environnement, déjà payés ailleurs dans ce dépôt : le composant s'IMPORTE
 * depuis `#components` — `resolveComponent` échoue en silence et le test passerait sans rien
 * monter —, et le corps d'une `UModal` est **téléporté dans `document.body`**, donc absent du
 * HTML du composant monté. D'où le démontage entre deux tests.
 */
const ARTICLES = [
  { id: 52, name: '1 ticket boisson' },
  { id: 58, name: 'Badge en bois' },
  { id: 63, name: 'Ficelle bleu' },
]

const EQUIPES = [
  { id: 'equipe-accueil', name: 'Accueil', color: '#ff0000' },
  { id: 'equipe-bar', name: 'Bar', color: '#00ff00' },
]

/** Deux articles globaux, tels que l'édition 22 les porte réellement. */
const ASSOCIATIONS = [
  { id: 94, handoutItemId: 52, teamId: null, name: '1 ticket boisson', quantity: 3 },
  { id: 95, handoutItemId: 58, teamId: null, name: 'Badge en bois', quantity: 1 },
]

registerEndpoint('/api/editions/22/ticketing/handout-items', () => ({
  success: true,
  data: { handoutItems: ARTICLES },
}))

// Ce point d'API rend un TABLEAU nu, sans enveloppe `data` : le composant le lit tel quel.
registerEndpoint('/api/editions/22/volunteer-teams', () => EQUIPES)

let monte: Awaited<ReturnType<typeof mountSuspended>> | null = null

afterEach(() => {
  monte?.unmount()
  monte = null
  document.body.innerHTML = ''
})

const monter = async (items = ASSOCIATIONS) => {
  monte = await mountSuspended(TicketingVolunteerHandoutItemsList, {
    props: { items, loading: false, editionId: 22 },
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  return monte
}

/** Le bouton qui ouvre le réglage, repéré par son icône plutôt que par sa position. */
const boutonModifier = (composant: NonNullable<typeof monte>) =>
  composant.findAll('button').find((b) => b.html().includes('pencil'))

describe('l’onglet des articles des bénévoles', () => {
  it('se monte, tout simplement', async () => {
    // Le défaut d'origine : le `setup` levait et l'onglet restait vide. C'est ce test-ci qui
    // l'aurait vu, et c'est pourquoi il énonce quelque chose d'aussi élémentaire.
    const composant = await monter()
    expect(composant.html()).toContain('1 ticket boisson')
  })

  it('affiche la quantité des articles déjà posés', async () => {
    const composant = await monter()
    expect(composant.html()).toContain('×3')
  })

  it('n’affiche PAS le formulaire tant qu’on ne l’a pas demandé', async () => {
    // Le réglage vit désormais dans une modale : la liste dit ce qui EST configuré, et rien de
    // plus. Le formulaire déroulé sous la liste mêlait les deux.
    // On vise la CLÉ et non sa traduction : l'i18n n'est pas chargé dans cet environnement, et
    // `$t` y rend le nom de la clé. Chercher « Portée » passerait quoi qu'il arrive.
    const composant = await monter()
    expect(composant.html()).not.toContain('volunteer.scope_label')
    expect(document.body.textContent).not.toContain('volunteer.scope_label')
  })

  it('ouvre le réglage sur le bouton « Modifier »', async () => {
    const composant = await monter()
    const bouton = boutonModifier(composant)
    expect(bouton).toBeDefined()

    await bouton!.trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))

    // La modale est téléportée : c'est dans le document qu'il faut la chercher.
    expect(document.body.textContent).toContain('volunteer.scope_label')
    expect(document.body.textContent).toContain('volunteer.save')
  })

  it('rouvre le réglage sur ce qui est ENREGISTRÉ, pas sur une saisie abandonnée', async () => {
    // Une modification qu'on annule ne doit pas ressurgir à la réouverture : on croirait y avoir
    // renoncé, et « Enregistrer » l'écrirait pour de bon.
    const composant = await monter()
    const bouton = boutonModifier(composant)!

    await bouton.trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))

    const vm = composant.vm as unknown as {
      selection: Array<{ handoutItemId: number; quantity: number }>
      modaleOuverte: boolean
    }
    vm.selection = [{ handoutItemId: 63, quantity: 9 }]
    vm.modaleOuverte = false
    await new Promise((resolve) => setTimeout(resolve, 0))

    await bouton.trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(vm.selection).toEqual([
      { handoutItemId: 52, quantity: 3 },
      { handoutItemId: 58, quantity: 1 },
    ])
  })
})
