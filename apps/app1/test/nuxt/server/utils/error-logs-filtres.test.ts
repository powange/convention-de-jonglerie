import { describe, expect, it } from 'vitest'

import {
  filtresDuJournal,
  periodeAppliquee,
  PERIODE_PAR_DEFAUT,
} from '../../../../server/utils/error-logs/filtres'

/**
 * Les critères sont décrits ici pour les DEUX vues du journal — la liste à plat et le regroupement
 * par empreinte. Un compteur de groupe qui ne correspondrait pas aux lignes obtenues en dépliant
 * serait pire qu'une absence de regroupement, et c'est ce que cette description unique empêche.
 */
describe('periodeAppliquee', () => {
  it('a une seule valeur par défaut', () => {
    // Correctif : la fenêtre valait un jour pour « non résolues » et sept sinon. Changer de filtre
    // de statut réduisait donc la période sans le dire, et la baisse du nombre de résultats se
    // lisait comme une baisse du nombre d'erreurs.
    expect(periodeAppliquee(undefined)).toBe(PERIODE_PAR_DEFAUT)
    expect(periodeAppliquee(null)).toBe(PERIODE_PAR_DEFAUT)
    expect(periodeAppliquee('')).toBe(PERIODE_PAR_DEFAUT)
  })

  it('respecte une période demandée', () => {
    for (const periode of ['1d', '7d', '30d', '90d', 'all'])
      expect(periodeAppliquee(periode)).toBe(periode)
  })

  it('retombe sur le défaut plutôt que d’appliquer une valeur inconnue de travers', () => {
    expect(periodeAppliquee('depuis-toujours')).toBe(PERIODE_PAR_DEFAUT)
  })
})

describe('filtresDuJournal', () => {
  it('ne dépend plus du statut pour choisir sa fenêtre', () => {
    // Les deux doivent produire la MÊME borne temporelle.
    const avecStatut = filtresDuJournal({ status: 'unresolved' })
    const sansStatut = filtresDuJournal({ status: 'all' })

    expect(avecStatut.periode).toBe(sansStatut.periode)
    expect(avecStatut.periode).toBe(PERIODE_PAR_DEFAUT)
  })

  it('ne borne pas le temps quand on demande toute la période', () => {
    const { where, periode } = filtresDuJournal({ timeRange: 'all' })

    expect(periode).toBe('all')
    expect(JSON.stringify(where)).not.toContain('createdAt')
  })

  it('résout une famille de types en plusieurs codes', () => {
    const { where } = filtresDuJournal({ errorType: 'famille:base-de-donnees' })

    expect(JSON.stringify(where)).toContain('DatabaseDeadlockError')
  })

  it('donne à chaque critère sa propre entrée du AND', () => {
    // La recherche libre et le filtre utilisateur produisent tous deux une clé `OR`. Étalés dans un
    // même objet, le second écraserait le premier, en silence.
    const { where } = filtresDuJournal({ search: 'Dupont', user: 'marie' }) as any

    expect(Array.isArray(where.AND)).toBe(true)
    expect(where.AND.filter((c: any) => c.OR || c.user)).toHaveLength(2)
  })

  it('filtre sur les quatre composantes exactes quand on demande les occurrences d’un groupe', () => {
    const { where } = filtresDuJournal({
      timeRange: 'all',
      fpErrorType: 'ValidationError',
      fpMethod: 'POST',
      fpPath: '/api/editions',
      fpMessage: 'Données invalides',
    }) as any

    expect(where).toEqual({
      errorType: 'ValidationError',
      method: 'POST',
      path: '/api/editions',
      message: 'Données invalides',
    })
  })

  it('traite un type d’empreinte vide comme une absence de type', () => {
    // `errorType` est nullable en base : l'écran envoie une chaîne vide pour dire « pas de type »,
    // et le filtre doit alors viser IS NULL et non la chaîne vide.
    const { where } = filtresDuJournal({
      timeRange: 'all',
      fpErrorType: '',
      fpMethod: 'GET',
      fpPath: '/api/x',
      fpMessage: 'Boum',
    }) as any

    expect(where.errorType).toBeNull()
  })

  it('ignore une empreinte incomplète plutôt que d’en appliquer une partie', () => {
    // Trois composantes sur quatre ne désignent pas un groupe : appliquer ce qu'on a élargirait
    // silencieusement la sélection.
    const { where } = filtresDuJournal({
      timeRange: 'all',
      fpMethod: 'GET',
      fpPath: '/api/x',
    }) as any

    expect(where).toEqual({})
  })
})
