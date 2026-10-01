import { describe, it, expect } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import ConfirmModal from '../../../../app/components/ui/ConfirmModal.vue'

// Mock useI18n pour éviter les problèmes d'initialisation
mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
  locale: { value: 'fr' },
}))

describe('ConfirmModal', () => {
  it('monte le composant avec succès', async () => {
    const component = await mountSuspended(ConfirmModal, {
      props: {
        modelValue: true,
        title: 'Confirmer la suppression',
        description: 'Êtes-vous sûr de vouloir supprimer cet élément ?',
      },
    })

    expect(component.exists()).toBe(true)
  })

  it('rend le composant avec les props fournis', async () => {
    const component = await mountSuspended(ConfirmModal, {
      props: {
        modelValue: true,
        title: 'Confirmer la suppression',
        description: 'Êtes-vous sûr de vouloir supprimer cet élément ?',
      },
    })

    // Le composant devrait être rendu même si le contenu est dans un teleport
    expect(component.html()).toBeDefined()
    expect(component.html().length).toBeGreaterThan(0)
  })

  it('utilise UModal comme composant de base', async () => {
    const component = await mountSuspended(ConfirmModal, {
      props: {
        modelValue: false,
        title: 'Confirmer',
        description: 'Message',
      },
    })

    // Le composant devrait être défini
    expect(component.exists()).toBe(true)
  })

  /**
   * ⚠️ CE QUE CE FICHIER NE PROUVAIT PAS, et ce que cela a coûté. Les trois cas ci-dessus
   * n'assertaient que `exists()` et `html().length > 0` : ils seraient restés verts si le
   * composant n'affichait rien du tout. Deux écrans lui passaient donc `:message=` — une prop
   * QUI N'EXISTE PAS —, et Vue déposait silencieusement l'attribut inconnu sur l'élément racine.
   * Le texte voulu n'apparaissait jamais ; à sa place, le repli générique « Êtes-vous sûr ? ».
   *
   * Le corps de la modale est téléporté par `UModal` : il faut donc le chercher dans le document
   * et non dans l'arbre du composant, ce qui est précisément ce qu'un test « défini, non vide »
   * évitait de regarder.
   */
  it('🔬 AFFICHE la description qu’on lui passe', async () => {
    await mountSuspended(ConfirmModal, {
      props: {
        modelValue: true,
        title: 'Supprimer ce spectacle ?',
        description: 'Ses représentations et ses numéros seront supprimés avec lui.',
      },
    })

    expect(document.body.textContent).toContain(
      'Ses représentations et ses numéros seront supprimés avec lui.'
    )
  })

  it('retombe sur le message générique SANS description', async () => {
    // Le pendant nécessaire : le repli doit continuer d'exister, c'est lui qui couvre les appels
    // qui n'ont rien de particulier à dire. Ici `t` rend la clé, d'où l'assertion sur la clé.
    await mountSuspended(ConfirmModal, {
      props: { modelValue: true, title: 'Confirmer' },
    })

    expect(document.body.textContent).toContain('common.are_you_sure')
  })
})
