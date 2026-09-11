import { describe, expect, it } from 'vitest'

import {
  chaineDeRequete,
  parametresDeFiltre,
  parametresDeTri,
  parametresDesCandidatures,
} from '../../../../../layers/volunteers/app/utils/parametres-candidatures'

/**
 * La composition vivait deux fois dans le même composant — une fois pour la liste, une fois pour
 * l'export — mot pour mot identique. Le jour où un filtre s'ajoute à l'une sans être reporté sur
 * l'autre, l'export livre silencieusement autre chose que ce qu'on a sous les yeux, et personne ne
 * s'en aperçoit : un fichier de candidatures ne se relit pas ligne à ligne.
 */
describe('parametresDeTri', () => {
  it('prend la première colonne comme tri principal', () => {
    expect(parametresDeTri([{ id: 'nom', desc: true }])).toEqual({
      sortField: 'nom',
      sortDir: 'desc',
      sortSecondary: undefined,
    })
  })

  it('verse les colonnes suivantes dans le départage', () => {
    expect(
      parametresDeTri([
        { id: 'status' },
        { id: 'nom', desc: true },
        { id: 'allergies', desc: false },
      ])
    ).toEqual({
      sortField: 'status',
      sortDir: 'asc',
      sortSecondary: 'nom:desc,allergies:asc',
    })
  })

  it('retombe sur la date de candidature sans tri', () => {
    expect(parametresDeTri([])).toEqual({
      sortField: 'createdAt',
      sortDir: 'asc',
      sortSecondary: undefined,
    })
  })

  it('rend undefined et non une chaîne vide sans départage', () => {
    // Un paramètre absent ne part pas dans la requête ; une chaîne vide y figurerait.
    expect(parametresDeTri([{ id: 'nom' }]).sortSecondary).toBeUndefined()
  })
})

describe('parametresDeFiltre', () => {
  it('transmet les filtres actifs', () => {
    expect(
      parametresDeFiltre({
        statut: 'PENDING',
        equipesSouhaitees: ['a', 'b'],
        presence: ['montage'],
        equipesAssignees: ['c'],
        recherche: 'dupont',
      })
    ).toEqual({
      status: 'PENDING',
      teams: 'a,b',
      presence: 'montage',
      assignedTeams: 'c',
      search: 'dupont',
    })
  })

  it('efface le statut « tous »', () => {
    // `ALL` est la valeur que porte le contrôle quand il ne filtre rien : la transmettre
    // chercherait un statut de ce nom.
    expect(parametresDeFiltre({ statut: 'ALL' }).status).toBeUndefined()
  })

  it('efface une liste vide plutôt que d’envoyer une chaîne vide', () => {
    // Une chaîne vide se lirait « filtre sur rien » et ne rendrait aucune candidature.
    const p = parametresDeFiltre({ equipesSouhaitees: [], presence: [], equipesAssignees: [] })

    expect(p.teams).toBeUndefined()
    expect(p.presence).toBeUndefined()
    expect(p.assignedTeams).toBeUndefined()
  })

  it('efface une recherche vide', () => {
    expect(parametresDeFiltre({ recherche: '' }).search).toBeUndefined()
    expect(parametresDeFiltre({}).search).toBeUndefined()
  })

  it('ne rend que les clés attendues', () => {
    // Une clé de trop partirait dans la requête et serait ignorée en silence.
    expect(Object.keys(parametresDeFiltre({})).sort()).toEqual([
      'assignedTeams',
      'presence',
      'search',
      'status',
      'teams',
    ])
  })
})

describe('parametresDesCandidatures', () => {
  // Tous les filtres actifs, et c'est délibéré : une comparaison entre deux `undefined` ne prouve
  // rien. Avec un jeu partiel, retirer un filtre de l'export passait inaperçu — une sonde de
  // mutation l'a montré.
  const filtres = {
    statut: 'ACCEPTED',
    equipesSouhaitees: ['bar', 'accueil'],
    presence: ['montage'],
    equipesAssignees: ['cuisine'],
    recherche: 'marie',
  }
  const tri = [{ id: 'nom', desc: true }]

  it('la liste pagine et demande les équipes', () => {
    expect(
      parametresDesCandidatures(filtres, tri, { usage: 'liste', page: 2, pageSize: 20 })
    ).toEqual({
      status: 'ACCEPTED',
      teams: 'bar,accueil',
      presence: 'montage',
      assignedTeams: 'cuisine',
      search: 'marie',
      sortField: 'nom',
      sortDir: 'desc',
      sortSecondary: undefined,
      page: 2,
      pageSize: 20,
      includeTeams: 'true',
    })
  })

  it('l’export se déclare et ne pagine pas', () => {
    const p = parametresDesCandidatures(filtres, tri, { usage: 'export' })

    expect(p.export).toBe('true')
    expect(p.page).toBeUndefined()
    expect(p.pageSize).toBeUndefined()
    expect(p.includeTeams).toBeUndefined()
  })

  it('la liste et l’export filtrent et trient exactement pareil', () => {
    // C'est la promesse du module, et la seule qui compte : ce qu'on exporte est ce qu'on voit.
    const liste = parametresDesCandidatures(filtres, tri, { usage: 'liste', page: 3, pageSize: 50 })
    const exporte = parametresDesCandidatures(filtres, tri, { usage: 'export' })

    for (const cle of [
      'status',
      'teams',
      'presence',
      'assignedTeams',
      'search',
      'sortField',
      'sortDir',
      'sortSecondary',
    ]) {
      expect(exporte[cle]).toEqual(liste[cle])
    }
  })
})

describe('chaineDeRequete', () => {
  it('écrit les paramètres présents', () => {
    expect(chaineDeRequete({ status: 'PENDING', page: 2 })).toBe('status=PENDING&page=2')
  })

  it('retire ce qui est absent plutôt que d’écrire « undefined »', () => {
    // `URLSearchParams` écrirait `status=undefined`, que le serveur prendrait pour un statut.
    expect(chaineDeRequete({ status: undefined, search: '', teams: 'a' })).toBe('teams=a')
  })

  it('échappe ce qui doit l’être', () => {
    expect(chaineDeRequete({ search: 'jean & marie' })).toBe('search=jean+%26+marie')
  })

  it('rend une chaîne vide quand il n’y a rien à demander', () => {
    expect(chaineDeRequete({ status: undefined })).toBe('')
  })
})
