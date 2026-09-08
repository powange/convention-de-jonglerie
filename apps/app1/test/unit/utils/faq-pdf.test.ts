import { describe, expect, it } from 'vitest'

import { nomFichierFaq, preparerFaqPourPdf } from '../../../../../layers/faq/app/utils/faq-pdf'

/**
 * Deux documents pour deux usages : la FAQ telle que le public la voit, qu'on laisse à l'accueil,
 * et le document de travail interne. Ce qui sort du site se décide ici, et pas dans le code de
 * mise en page — une entrée privée imprimée par mégarde ne se rattrape pas.
 */
const entree = (question: string, reponseTexte: string, isPublic = true) => ({
  question,
  reponseTexte,
  isPublic,
})

const FAQ = [
  entree('Où dormir ?', 'Camping sur place.'),
  entree('Combien de bénévoles ?', 'Consigne interne : viser 40.', false),
  entree('Y a-t-il un bar ?', 'Oui, ouvert le soir.'),
]

describe('preparerFaqPourPdf', () => {
  it('ne garde que les entrées publiques par défaut', () => {
    const resultat = preparerFaqPourPdf(FAQ, { inclurePrivees: false })

    expect(resultat.map((e) => e.question)).toEqual(['Où dormir ?', 'Y a-t-il un bar ?'])
    expect(resultat.every((e) => !e.prive)).toBe(true)
  })

  it('garde tout et signale ce qui est privé quand on le demande', () => {
    const resultat = preparerFaqPourPdf(FAQ, { inclurePrivees: true })

    expect(resultat).toHaveLength(3)
    expect(resultat.find((e) => e.question === 'Combien de bénévoles ?')?.prive).toBe(true)
    expect(resultat.find((e) => e.question === 'Où dormir ?')?.prive).toBe(false)
  })

  it("conserve l'ordre d'affichage", () => {
    // La FAQ est ordonnée à la main par les organisateurs : le document doit suivre.
    const resultat = preparerFaqPourPdf(FAQ, { inclurePrivees: true })

    expect(resultat.map((e) => e.question)).toEqual([
      'Où dormir ?',
      'Combien de bénévoles ?',
      'Y a-t-il un bar ?',
    ])
  })

  it('resserre les blancs sans coller les paragraphes', () => {
    // Le rendu du markdown laisse des lignes vides en surnombre ; deux paragraphes doivent
    // rester deux paragraphes, la mise en page s'appuie dessus.
    const resultat = preparerFaqPourPdf(
      [entree('  Question  ', '\n\nPremier.\n\n\n\nSecond.  \n\n')],
      { inclurePrivees: false }
    )

    expect(resultat[0]?.question).toBe('Question')
    expect(resultat[0]?.reponse).toBe('Premier.\n\nSecond.')
  })

  it('écarte une entrée sans question', () => {
    const resultat = preparerFaqPourPdf([entree('   ', 'Une réponse orpheline.')], {
      inclurePrivees: true,
    })

    expect(resultat).toEqual([])
  })

  it('rend une liste vide quand tout est privé et qu’on ne veut que le public', () => {
    expect(preparerFaqPourPdf([entree('Q', 'R', false)], { inclurePrivees: false })).toEqual([])
  })
})

describe('nomFichierFaq', () => {
  it("compose le nom à partir de l'édition", () => {
    expect(nomFichierFaq('Convention de Jonglerie 2026')).toBe(
      'faq-convention-de-jonglerie-2026.pdf'
    )
  })

  it('retire accents et ponctuation', () => {
    expect(nomFichierFaq("L'Été à Rêve-sur-Mer !")).toBe('faq-l-ete-a-reve-sur-mer.pdf')
  })

  it('retombe sur un nom générique sans édition', () => {
    // Sans ce repli, un nom d'édition vide produisait un fichier appelé « -.pdf ».
    expect(nomFichierFaq(null)).toBe('faq.pdf')
    expect(nomFichierFaq('   ')).toBe('faq.pdf')
    expect(nomFichierFaq('!!!')).toBe('faq.pdf')
  })
})
