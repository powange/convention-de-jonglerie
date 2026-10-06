import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'

import TaskFilters from '../../../../../../layers/tasks/app/components/tasks/TaskFilters.vue'

/**
 * L'avatar d'une personne assignée, dans le filtre des tâches.
 *
 * ⚠️ POURQUOI UN TEST MONTÉ, alors qu'une garde de source existe déjà. Celle-ci
 * (`avatar-sans-repli-dans-un-selecteur.test.ts`) prouve que la forme fautive a disparu — elle ne
 * prouve pas que l'avatar est TOUJOURS LÀ. Supprimer purement et simplement la vignette la
 * laisserait verte. Deux défauts opposés, deux tests.
 *
 * 📍 Ce qui était cassé : le sélecteur passait à Nuxt UI une URL Gravatar en `d=404`, introuvable
 * par construction. Seul `UiUserAvatar` guette cet échec pour dessiner l'initiale sur une couleur
 * calculée depuis le pseudo ; Nuxt UI, lui, affichait son propre repli, gris et identique pour
 * tout le monde. D'où le symptôme tel qu'il a été rapporté : « pas de la bonne couleur ».
 *
 * `UiUserAvatar` pose `alt="Avatar de <pseudo>"` — c'est à cela qu'on le reconnaît, et c'est aussi
 * ce qu'un lecteur d'écran annonce. Le repli de Nuxt UI, lui, ne nomme personne.
 *
 * ⚠️ On éprouve l'affichage REPLIÉ, pas la liste déroulée : la liste d'un `USelectMenu` n'est
 * rendue qu'à l'ouverture, dans un portail, ce qui demanderait de piloter le clavier. L'affichage
 * replié emprunte le même composant, et c'est celui que l'utilisateur voit sans rien faire.
 */
const SANS_PHOTO = {
  id: 7,
  pseudo: 'Zébulon',
  prenom: 'Zoé',
  nom: 'Bulon',
  // Les deux absences qui comptent : pas de photo, et pas d'empreinte d'e-mail. C'est le cas qui
  // produisait un Gravatar introuvable.
  emailHash: null,
  profilePicture: null,
}

const FILTRES = {
  q: '',
  assigneeIds: [7],
  statuses: [],
  due: 'all' as const,
  tagIds: [],
  sort: 'manual' as const,
}

let monte: { unmount: () => void } | null = null
afterEach(() => {
  monte?.unmount()
  monte = null
})

const monter = async (assignables = [SANS_PHOTO]) => {
  const wrapper = await mountSuspended(TaskFilters, {
    props: { modelValue: FILTRES, assignableUsers: assignables },
  })
  monte = wrapper
  return wrapper
}

describe('TaskFilters — l’avatar de la personne assignée', () => {
  it('⚠️ passe par UiUserAvatar, même sans photo de profil', async () => {
    const wrapper = await monter()

    const vignette = wrapper.find('img[alt="Avatar de Zébulon"]')
    expect(vignette.exists()).toBe(true)
  })

  it('affiche aussi son pseudo à côté', async () => {
    // L'avatar seul ne nomme personne : qui a trois personnes sans photo voit trois ronds.
    const wrapper = await monter()

    expect(wrapper.text()).toContain('Zébulon')
  })

  it('ne pose aucune vignette quand personne n’est sélectionné', async () => {
    // Témoin du premier test : sans lui, une vignette affichée en permanence — y compris sur le
    // texte d'invite — le rendrait vert sans rien prouver de la sélection.
    const wrapper = await mountSuspended(TaskFilters, {
      props: { modelValue: { ...FILTRES, assigneeIds: [] }, assignableUsers: [SANS_PHOTO] },
    })
    monte = wrapper

    expect(wrapper.find('img[alt="Avatar de Zébulon"]').exists()).toBe(false)
  })
})
