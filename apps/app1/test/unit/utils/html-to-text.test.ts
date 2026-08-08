import { describe, expect, it } from 'vitest'

import { htmlVersTexte } from '../../../shared/utils/html-to-text'

/**
 * Cette conversion sert le relevé d'un programme : ce sont l'ordre et la séparation des lignes
 * qui portent le déroulé d'une journée. Un pavé continu où plus rien ne sépare les journées
 * serait inutilisable, autant pour le découpage que pour le modèle.
 */
describe('htmlVersTexte', () => {
  it('sépare les blocs par des sauts de ligne', () => {
    const texte = htmlVersTexte('<p>Samedi 1</p><p>Accueil 14:00</p><p>Repas 20:00</p>')
    expect(texte.split('\n')).toEqual(['Samedi 1', 'Accueil 14:00', 'Repas 20:00'])
  })

  it('traite <br> comme une séparation', () => {
    expect(htmlVersTexte('10:00 Atelier<br>14:00 Spectacle').split('\n')).toEqual([
      '10:00 Atelier',
      '14:00 Spectacle',
    ])
  })

  it('sépare les lignes et cellules de tableau', () => {
    const texte = htmlVersTexte('<tr><td>10:00</td><td>Massues</td></tr><tr><td>14:00</td></tr>')
    expect(texte).toContain('10:00')
    expect(texte).toContain('Massues')
    expect(texte.split('\n').length).toBeGreaterThan(1)
  })

  // Le code n'est jamais du contenu : le laisser passer noierait le programme.
  it('retire scripts et styles avec leur contenu', () => {
    const texte = htmlVersTexte(
      '<p>Programme</p><script>var x = "Atelier fantôme"</script><style>.a{color:red}</style>'
    )
    expect(texte).toBe('Programme')
  })

  it('décode les entités courantes', () => {
    expect(htmlVersTexte('<p>R&eacute;p&eacute;tition &amp; spectacle</p>')).toBe(
      'Répétition & spectacle'
    )
    expect(htmlVersTexte('<p>10:00&nbsp;-&nbsp;12:00</p>')).toBe('10:00 - 12:00')
  })

  it('décode les entités numériques', () => {
    expect(htmlVersTexte('<p>caf&#233;</p>')).toBe('café')
  })

  it('supprime les lignes vides et les espaces superflus', () => {
    expect(htmlVersTexte('<div>  </div><div>   Gala    à    20h   </div><div></div>')).toBe(
      'Gala à 20h'
    )
  })

  it('rend une chaîne vide sur une page sans texte', () => {
    expect(htmlVersTexte('<html><head><title>x</title></head><body></body></html>')).toBe('x')
  })
})
