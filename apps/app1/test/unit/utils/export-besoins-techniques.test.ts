import { describe, expect, it } from 'vitest'

import {
  besoinsPropresDuSpectacle,
  entetesTechniques,
  lignesDUnSpectacle,
  passagesDUnSpectacle,
  type LibellesTechniques,
  type SpectacleTechnique,
} from '../../../../../layers/artists/app/utils/export-besoins-techniques'

const L: LibellesTechniques = {
  aucunBesoin: 'Aucun besoin renseigné',
  colonneNumero: 'Numéro',
  colonneArtistes: 'Artistes',
  colonneBesoins: 'Besoins techniques',
  colonneMiseEnPlace: 'Mise en place scène',
  date: (instant) => `le ${instant.slice(0, 10)}`,
}

const spectacle = (p: Partial<SpectacleTechnique> = {}): SpectacleTechnique => ({
  title: 'Gala du samedi',
  type: 'STANDARD',
  performances: [],
  technicalNeeds: null,
  artists: [],
  acts: [],
  ...p,
})

describe('entetesTechniques', () => {
  /* Les mêmes colonnes pour tous les spectacles : on ne relit pas les en-têtes à chaque page. */
  it('rend quatre colonnes, toujours les mêmes', () => {
    expect(entetesTechniques(L)).toEqual([
      'Numéro',
      'Artistes',
      'Besoins techniques',
      'Mise en place scène',
    ])
  })
})

describe('passagesDUnSpectacle', () => {
  /*
   * Le point d'API rend les dates et s'en sert pour trier — « l'ordre dans lequel la régie vit la
   * soirée » — mais le document ne les montrait pas. Une feuille technique sans horaire oblige à
   * retourner à l'écran pour savoir quand on monte.
   */
  it('rend les passages, séparés', () => {
    const s = spectacle({ performances: ['2026-07-14T20:00:00Z', '2026-07-15T21:00:00Z'] })
    expect(passagesDUnSpectacle(s, L)).toBe('le 2026-07-14 · le 2026-07-15')
  })

  it('rend une chaîne vide sans passage, plutôt qu’un séparateur orphelin', () => {
    expect(passagesDUnSpectacle(spectacle(), L)).toBe('')
    expect(passagesDUnSpectacle(spectacle({ performances: undefined }), L)).toBe('')
  })
})

describe('lignesDUnSpectacle', () => {
  /*
   * Un spectacle sans numéro rend UNE ligne, la sienne. En rendre zéro l'aurait fait disparaître
   * du document alors qu'il a bien des besoins.
   */
  it('rend une ligne pour un spectacle sans numéro', () => {
    const s = spectacle({ technicalNeeds: 'Scène 4×4, deux douches', artists: ['Ada', 'Bo'] })
    expect(lignesDUnSpectacle(s, L)).toEqual([
      ['Gala du samedi', 'Ada, Bo', 'Scène 4×4, deux douches', ''],
    ])
  })

  it('annonce l’absence de besoin plutôt que de laisser vide', () => {
    expect(lignesDUnSpectacle(spectacle(), L)[0]![2]).toBe('Aucun besoin renseigné')
    expect(lignesDUnSpectacle(spectacle({ technicalNeeds: '   ' }), L)[0]![2]).toBe(
      'Aucun besoin renseigné'
    )
  })

  it('rend une ligne par numéro pour un cabaret', () => {
    const s = spectacle({
      type: 'CABARET',
      acts: [
        { title: 'Massues', technicalNeeds: 'Tapis', stageSetup: 'Fond noir', artists: ['Ada'] },
        { title: 'Diabolo', technicalNeeds: null, stageSetup: null, artists: [] },
      ],
    })
    expect(lignesDUnSpectacle(s, L)).toEqual([
      ['Massues', 'Ada', 'Tapis', 'Fond noir'],
      ['Diabolo', '', 'Aucun besoin renseigné', ''],
    ])
  })

  /*
   * L'espace insécable étroite des montants s'imprime en barre oblique avec les polices de jsPDF.
   * Les besoins peuvent en porter — « prévoir 1 250 € de matériel ».
   */
  it('rend les cellules imprimables par jsPDF', () => {
    const s = spectacle({ technicalNeeds: 'Prévoir 1 250 € de location' })
    expect(lignesDUnSpectacle(s, L)[0]![2]).toBe('Prévoir 1 250 € de location')
  })

  /* Les besoins gardent leurs lignes — `overflow: linebreak` sait les rendre —, pas les titres. */
  it('garde les retours à la ligne des besoins, et les aplatit ailleurs', () => {
    const s = spectacle({ title: 'Gala\ndu samedi', technicalNeeds: 'Son\n\nLumière' })
    const [ligne] = lignesDUnSpectacle(s, L)
    expect(ligne![0]).toBe('Gala du samedi')
    expect(ligne![2]).toBe('Son\nLumière')
  })
})

describe('besoinsPropresDuSpectacle', () => {
  /*
   * Un cabaret peut porter ses propres besoins — fond de scène, régie commune — qui ne tiennent
   * dans aucun numéro. Ils étaient rendus avant ce changement, et se perdraient dans un tableau
   * qui ne parlerait que des numéros.
   */
  it('rend les besoins du cabaret lui-même', () => {
    const s = spectacle({
      type: 'CABARET',
      technicalNeeds: 'Fond de scène noir',
      acts: [{ title: 'Massues', technicalNeeds: null, stageSetup: null, artists: [] }],
    })
    expect(besoinsPropresDuSpectacle(s)).toBe('Fond de scène noir')
  })

  /* Sur un spectacle sans numéro, ses besoins sont DÉJÀ dans sa ligne : les répéter ferait double. */
  it('ne rend rien pour un spectacle sans numéro', () => {
    expect(besoinsPropresDuSpectacle(spectacle({ technicalNeeds: 'Scène 4×4' }))).toBe('')
  })

  /* On n'écrit pas « aucun besoin » pour un cabaret dont chaque numéro, lui, en déclare. */
  it('reste vide quand le cabaret n’a pas de besoin propre', () => {
    const s = spectacle({
      type: 'CABARET',
      technicalNeeds: null,
      acts: [{ title: 'Massues', technicalNeeds: 'Tapis', stageSetup: null, artists: [] }],
    })
    expect(besoinsPropresDuSpectacle(s)).toBe('')
  })
})
