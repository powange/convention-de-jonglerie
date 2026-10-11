import { describe, expect, it } from 'vitest'

import { nomAffichableDEdition } from '../../../shared/utils/nom-edition'

/**
 * Le nom sous lequel une édition se présente — constat B5 de l'administration.
 *
 * ## Le défaut
 *
 * Le rappel manuel d'édition composait `` `${edition.convention.name} - ${edition.title}` ``. Or
 * `Edition` **n'a pas** de champ `title` : la notification s'intitulait « Convention X —
 * **undefined** », et elle partait vraiment. La règle existait pourtant déjà, juste, dans la tâche
 * des échéances de tâches — et une troisième fois côté client.
 *
 * ## 📊 POURQUOI UN SEUL NOM ET NON UNE COMPOSITION — la mesure a corrigé la fiche
 *
 * Elle proposait de garder la composition en ajoutant un repli. Relevé sur les **70 éditions** de
 * la base de développement : **32 sans nom du tout**, et **21 des 38 nommées** portent un nom qui
 * COMMENCE par celui de la convention. Composer donnerait « Jongle en Zik - Jongle en Zik 2025 »
 * dans la majorité des cas nommés — et c'est logique, le schéma dit que `Edition.name` EST le
 * « nom d'affichage de l'événement ».
 */
describe('nomAffichableDEdition', () => {
  it('⚠️ REND LE NOM DE L’ÉDITION SEUL, sans y recoller celui de la convention', () => {
    /*
     * LE CAS QUI PORTE LA DÉCISION, et il vient des données réelles : 21 éditions sur 38 portent
     * un nom déjà préfixé par celui de la convention. Toute composition les redoublerait.
     */
    expect(
      nomAffichableDEdition({
        id: 1,
        name: 'Jongle en Zik 2025',
        convention: { name: 'Jongle en Zik' },
      })
    ).toBe('Jongle en Zik 2025')
  })

  it('retombe sur le nom de la convention quand l’édition n’en a pas', () => {
    // 32 éditions sur 70 sont dans ce cas : c'est le chemin le plus fréquent, pas le cas limite.
    expect(
      nomAffichableDEdition({ id: 1, name: null, convention: { name: 'Jongle en Zik' } })
    ).toBe('Jongle en Zik')
  })

  it('⚠️ NE REND JAMAIS « undefined », même sans convention chargée', () => {
    /*
     * Une édition ORPHELINE — importée, convention non revendiquée — n'a pas de relation chargée.
     * Le numéro reste exploitable ; « undefined » dans une notification ne l'est pas, et c'était
     * exactement le défaut.
     */
    expect(nomAffichableDEdition({ id: 42, name: null, convention: null })).toBe('Édition #42')
    expect(nomAffichableDEdition({ id: 42 })).toBe('Édition #42')
  })

  it('sans identifiant non plus', () => {
    // Le dernier repli : « Édition », jamais une chaîne qui contient le mot « undefined ».
    expect(nomAffichableDEdition({})).toBe('Édition')
    expect(nomAffichableDEdition({ name: '', convention: { name: '' } })).toBe('Édition')
  })
})
