import { describe, expect, it } from 'vitest'

import { trouverMarqueursNonReconnus } from '../../../scripts/check-i18n-translations.js'

/**
 * La garde qui attrape les marqueurs de traduction échappant à l'outillage.
 *
 * ⚠️ POURQUOI ELLE EXISTE. Neuf libellés de la modale des repas portaient le préfixe « TODO: » —
 * sans crochets — dans douze langues, soit 106 valeurs. Le marqueur officiel du projet est
 * `[TODO]`, seul reconnu par `list-todo-keys` et `translate-todos` : ces valeurs leur étaient donc
 * INVISIBLES. Le diagnostic annonçait « aucune clé [TODO] » pendant qu'un bénévole anglophone
 * lisait « TODO: Description » dans la fenêtre de ses repas.
 *
 * Un marqueur qui échappe à l'outil censé le traquer est pire qu'une traduction manquante : celle-ci
 * finit par apparaître dans un rapport.
 */

describe('trouverMarqueursNonReconnus', () => {
  it('attrape un préfixe « TODO: » sans crochets', () => {
    const trouves = trouverMarqueursNonReconnus({
      edition: { volunteers: { meals: { description: 'TODO: Description' } } },
    })

    expect(Object.keys(trouves)).toEqual(['edition.volunteers.meals.description'])
  })

  it('attrape « TODO » sans deux-points', () => {
    expect(trouverMarqueursNonReconnus({ a: 'TODO traduire ceci' })).toHaveProperty('a')
  })

  it('IGNORE le marqueur officiel entre crochets', () => {
    // Celui-ci est déjà connu de l'outillage : le signaler deux fois n'aiderait personne.
    expect(trouverMarqueursNonReconnus({ a: '[TODO] Aucun repas disponible' })).toEqual({})
  })

  it('n’attrape PAS le mot espagnol ou portugais « Todo »', () => {
    /*
     * 🔬 LE TEST QUI A CORRIGÉ LA GARDE. Une première version employait un motif insensible à la
     * casse et signalait « Todo o período » (portugais) et « Todo lo que falta ya está… »
     * (espagnol) — des traductions parfaitement justes. « Todo » y veut dire « tout ».
     *
     * Seul `TODO` tout en majuscules est un marqueur ; c'est ainsi que l'écrivent le projet et les
     * éditeurs. Une garde qui crie au loup sur de vraies traductions finit par être ignorée.
     */
    const trouves = trouverMarqueursNonReconnus({
      pt: 'Todo o período',
      es: 'Todo lo que falta ya está en una lista de la compra.',
      autre: 'Todos os bilhetes',
    })

    expect(trouves).toEqual({})
  })

  it('descend dans les objets imbriqués et compose le chemin', () => {
    const trouves = trouverMarqueursNonReconnus({
      gestion: { stock: { nom: 'TODO: Nom', ok: 'Nom' } },
    })

    expect(Object.keys(trouves)).toEqual(['gestion.stock.nom'])
  })

  it('tolère une espace avant le marqueur', () => {
    // Un copier-coller maladroit ne doit pas le faire passer entre les mailles.
    expect(trouverMarqueursNonReconnus({ a: '  TODO: quelque chose' })).toHaveProperty('a')
  })

  it('ne signale rien sur un fichier sain', () => {
    expect(
      trouverMarqueursNonReconnus({ a: 'Aucun repas disponible', b: { c: 'Choix de vos repas' } })
    ).toEqual({})
  })
})
