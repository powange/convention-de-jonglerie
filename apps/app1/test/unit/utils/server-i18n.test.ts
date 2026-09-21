import { describe, expect, it } from 'vitest'

import { fusionnerTraductions } from '../../../server/utils/server-i18n'

/**
 * La fusion des fichiers de traduction côté serveur.
 *
 * Le défaut réparé : un `Object.assign` là où il fallait une fusion en profondeur. Quatre fichiers
 * du dépôt partagent la racine `gestion` et deux la racine `shows_call` ; à plat, le dernier lu
 * effaçait les précédents. Aucune erreur, aucune trace — `translateServerSide` se contentait de
 * rendre la clé demandée, qui partait telle quelle dans un courriel.
 *
 * Les cas ci-dessous reproduisent la structure réelle des fichiers plutôt qu'un exemple abstrait :
 * c'est cette structure-là qui a produit le défaut.
 */
describe('fusionnerTraductions', () => {
  it('conserve les deux sous-arbres quand deux fichiers partagent une racine', () => {
    // Exactement `gestion.json` puis `gestion-map.json` : à plat, `stock` disparaissait.
    const ensemble = fusionnerTraductions({}, { gestion: { stock: { title: 'Stock' } } })
    fusionnerTraductions(ensemble, { gestion: { map: { title: 'Plan' } } })

    expect(ensemble).toEqual({
      gestion: { stock: { title: 'Stock' }, map: { title: 'Plan' } },
    })
  })

  it('tient sur QUATRE fichiers, le nombre réel qui partage `gestion`', () => {
    const ensemble = {}
    for (const domaine of ['stock', 'map', 'shows_call', 'task']) {
      fusionnerTraductions(ensemble, { gestion: { [domaine]: { title: domaine } } })
    }

    expect(Object.keys((ensemble as any).gestion)).toEqual(['stock', 'map', 'shows_call', 'task'])
  })

  it('descend aussi loin que les fichiers sont imbriqués', () => {
    const ensemble = fusionnerTraductions({}, { a: { b: { c: { d: 'profond' } } } })
    fusionnerTraductions(ensemble, { a: { b: { c: { e: 'aussi' } } } })

    expect(ensemble).toEqual({ a: { b: { c: { d: 'profond', e: 'aussi' } } } })
  })

  it('laisse le dernier fichier l’emporter sur une clé RÉELLEMENT en conflit', () => {
    // Fusionner ne veut pas dire tout garder : deux textes pour une même clé restent un conflit,
    // et il se tranche comme avant.
    const ensemble = fusionnerTraductions({}, { common: { save: 'Enregistrer' } })
    fusionnerTraductions(ensemble, { common: { save: 'Sauver' } })

    expect(ensemble).toEqual({ common: { save: 'Sauver' } })
  })

  it('REMPLACE un tableau au lieu de le fusionner', () => {
    // Fusionner deux tableaux rendrait une liste écrite dans aucun fichier — une traduction que
    // personne n'a relue. Le remplacement est le comportement d'`Object.assign`, et il est juste.
    const ensemble = fusionnerTraductions({}, { liste: ['un', 'deux'] })
    fusionnerTraductions(ensemble, { liste: ['trois'] })

    expect(ensemble).toEqual({ liste: ['trois'] })
  })

  it('ne confond pas `null` avec un objet à fusionner', () => {
    const ensemble = fusionnerTraductions({}, { a: { b: 'texte' } })
    fusionnerTraductions(ensemble, { a: null })

    expect(ensemble).toEqual({ a: null })
  })

  it('accepte un ajout vide ou absent sans rien casser', () => {
    const ensemble = fusionnerTraductions({}, { common: { save: 'Enregistrer' } })

    expect(fusionnerTraductions(ensemble, {})).toEqual({ common: { save: 'Enregistrer' } })
    expect(fusionnerTraductions(ensemble, undefined)).toEqual({ common: { save: 'Enregistrer' } })
  })

  it('remplace une chaîne par un sous-arbre, et l’inverse', () => {
    // Cas tordu mais possible entre deux fichiers mal découpés : il ne doit pas lever.
    const versArbre = fusionnerTraductions({ a: 'texte' }, { a: { b: 'sous-arbre' } })
    expect(versArbre).toEqual({ a: { b: 'sous-arbre' } })

    const versTexte = fusionnerTraductions({ a: { b: 'sous-arbre' } }, { a: 'texte' })
    expect(versTexte).toEqual({ a: 'texte' })
  })
})
