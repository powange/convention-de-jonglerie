import { describe, expect, it } from 'vitest'

import {
  listeTronquee,
  pagesRestantes,
} from '../../../../../layers/volunteers/app/utils/pagination-complete'

/**
 * Charger une liste paginée en entier.
 *
 * Le défaut : la page de planning appelait le point d'API des candidatures sans préciser de
 * taille de page. Celui-ci pagine par 20 — elle ne voyait donc que les 20 premiers acceptés sur
 * 42, et rien ne le signalait. Le calculateur d'effectif annonçait 20 bénévoles, la moyenne
 * d'heures portait sur un effectif tronqué, et les acceptés au-delà du vingtième disparaissaient
 * du relevé individuel dès lors qu'ils ne tenaient aucun créneau.
 */
describe('pagesRestantes', () => {
  it('ne redemande rien quand la première page suffit', () => {
    expect(pagesRestantes(42, 100)).toEqual([])
    expect(pagesRestantes(100, 100)).toEqual([])
  })

  it('redemande les pages qui manquent', () => {
    // 250 éléments par pages de 100 : la première est déjà là, restent la 2 et la 3.
    expect(pagesRestantes(250, 100)).toEqual([2, 3])
  })

  it('compte une page pour un reliquat d’un seul élément', () => {
    // Le cas qu'un `Math.floor` perdrait — et avec lui le 101ᵉ bénévole.
    expect(pagesRestantes(101, 100)).toEqual([2])
  })

  it('suit la taille de page réellement demandée', () => {
    // Le défaut d'origine : 42 acceptés vus par pages de 20, il en manquait deux pages.
    expect(pagesRestantes(42, 20)).toEqual([2, 3])
  })

  it('s’arrête avant de boucler sans fin sur un total aberrant', () => {
    // Le garde-fou ne vise pas les grosses éditions mais une API qui annoncerait n'importe quoi.
    expect(pagesRestantes(10_000_000, 100)).toHaveLength(99)
  })

  it('ne demande rien sur des valeurs inexploitables', () => {
    // `pagination.total` absent rend NaN : mieux vaut garder la première page que tout perdre.
    expect(pagesRestantes(Number.NaN, 100)).toEqual([])
    expect(pagesRestantes(250, 0)).toEqual([])
    expect(pagesRestantes(250, Number.NaN)).toEqual([])
  })
})

describe('listeTronquee', () => {
  it('signale une liste incomplète', () => {
    expect(listeTronquee(20, 42)).toBe(true)
  })

  it('ne signale rien quand tout est là', () => {
    expect(listeTronquee(42, 42)).toBe(false)
  })

  it('ne signale rien quand le total est inconnu', () => {
    // Sans total, on ne sait pas : se taire vaut mieux qu'alerter à tort à chaque chargement.
    expect(listeTronquee(20, Number.NaN)).toBe(false)
  })
})
