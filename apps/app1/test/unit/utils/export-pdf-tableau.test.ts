import { describe, expect, it } from 'vitest'

import { nomAvecExtensionPdf, orientationPour } from '../../../app/utils/export-pdf-tableau'

/**
 * La mise en page partagée des tableaux imprimés.
 *
 * Le rendu lui-même appartient à `jsPDF` et ne se vérifie pas ici. Ce qui se vérifie, ce sont les
 * deux décisions prises AVANT de le convoquer — et qui, elles, sont des règles.
 */
describe('orientationPour', () => {
  it('passe en paysage au-delà de six colonnes', () => {
    // Le seuil est mesuré sur les tableaux existants : au-delà, les noms se coupent en trois.
    expect(orientationPour(6)).toBe('portrait')
    expect(orientationPour(7)).toBe('landscape')
  })

  it('laisse l’appelant IMPOSER son choix', () => {
    // Un écran peut savoir mieux : deux colonnes de texte libre débordent avant la septième.
    expect(orientationPour(3, 'landscape')).toBe('landscape')
    expect(orientationPour(20, 'portrait')).toBe('portrait')
  })

  it('reste en portrait pour un tableau vide', () => {
    expect(orientationPour(0)).toBe('portrait')
  })
})

describe('nomAvecExtensionPdf', () => {
  it('ajoute l’extension', () => {
    expect(nomAvecExtensionPdf('organisateurs-edition-22')).toBe('organisateurs-edition-22.pdf')
  })

  it('ne la DOUBLE pas', () => {
    // Les appelants passent tantôt un nom nu, tantôt un nom construit par un util qui l'ajoute
    // déjà. « inventaire.pdf.pdf » se voit tout de suite, mais après coup.
    expect(nomAvecExtensionPdf('inventaire.pdf')).toBe('inventaire.pdf')
    expect(nomAvecExtensionPdf('inventaire.PDF')).toBe('inventaire.PDF')
  })

  it('rogne les bords', () => {
    expect(nomAvecExtensionPdf('  liste  ')).toBe('liste.pdf')
  })

  it('retombe sur un nom par défaut plutôt que sur « .pdf »', () => {
    // Un fichier nommé « .pdf » est invisible sous Linux et illisible ailleurs.
    expect(nomAvecExtensionPdf('')).toBe('export.pdf')
    expect(nomAvecExtensionPdf('   ')).toBe('export.pdf')
  })
})
