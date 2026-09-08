import { describe, expect, it } from 'vitest'

import {
  formatExtractionForAI,
  type WebContentExtraction,
} from '../../../server/utils/web-content-extractor'

/**
 * Ce que le modèle reçoit d'une page de billetterie.
 *
 * Les tarifs passent avant le texte libre parce que ce sont eux qui nomment les services rendus,
 * et que le texte libre est ce que le budget coupe en premier. Mais ils ne peuvent pas tout
 * prendre non plus : une billetterie à trente tarifs affamerait la description de la page.
 */
const extraction = (
  tarifs: Array<{ nom: string; description: string; prix: string }>,
  textContent = 'Le texte libre de la page.'
): WebContentExtraction => ({
  url: 'https://exemple.fr',
  title: 'Une convention',
  metaDescription: '',
  openGraph: {},
  jsonLdEvents: [],
  contactInfo: {
    emails: [],
    phones: [],
    instagramUrls: [],
    facebookUrls: [],
    ticketingUrls: [],
    websiteUrls: [],
  },
  navigation: [],
  textContent,
  links: [],
  ticketTiers: tarifs,
})

const PASS = {
  nom: 'PASS 3 JOURS',
  description: 'donne accès au gymnase (+douches), ateliers, camping & aux petits déj !',
  prix: '25€',
}

describe('formatExtractionForAI, section des tarifs', () => {
  it('annonce chaque tarif avec son prix et ce qu il comprend', () => {
    const texte = formatExtractionForAI(extraction([PASS]), 2500)

    expect(texte).toContain('=== Tarifs de la billetterie ===')
    expect(texte).toContain('- PASS 3 JOURS (25€)')
    expect(texte).toContain('gymnase (+douches)')
  })

  it('place les tarifs avant le texte libre', () => {
    // C'est tout l'objet du déplacement : le texte libre se fait tronquer en premier, et les
    // tarifs y disparaissaient sur une page un peu longue.
    const texte = formatExtractionForAI(extraction([PASS]), 2500)

    expect(texte.indexOf('Tarifs de la billetterie')).toBeLessThan(texte.indexOf('Contenu textuel'))
  })

  it('ne mentionne pas de section quand la page ne vend rien', () => {
    expect(formatExtractionForAI(extraction([]), 2500)).not.toContain('Tarifs de la billetterie')
  })

  it('borne la liste et dit combien de tarifs elle laisse de côté', () => {
    const beaucoup = Array.from({ length: 40 }, (_, i) => ({
      nom: `TARIF ${i}`,
      description: 'x'.repeat(200),
      prix: `${i}€`,
    }))

    const texte = formatExtractionForAI(extraction(beaucoup), 2000)

    expect(texte).toMatch(/\(\+ \d+ autre\(s\) tarif\(s\) non détaillé\(s\)\)/)
    expect(texte).toContain('TARIF 0')
    expect(texte).not.toContain('TARIF 39')
  })

  it('garde au moins un tarif, même quand le budget est dérisoire', () => {
    // Sans ce plancher, un budget serré effacerait la section entière et l'on perdrait
    // jusqu'à l'information qu'il existe des tarifs.
    const texte = formatExtractionForAI(extraction([PASS]), 100)

    expect(texte).toContain('PASS 3 JOURS')
  })
})
