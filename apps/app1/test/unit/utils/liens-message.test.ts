import { describe, expect, it } from 'vitest'

import { decouperLiensMessage } from '../../../shared/utils/liens-message'

/**
 * Les adresses d'un message de la messagerie, rendues cliquables.
 *
 * Ce qui compte : rien ne se perd (recoller les morceaux rend le texte d'origine), la ponctuation
 * de fin de phrase ne part pas dans le lien, et un domaine nu reste du texte.
 */
const recolle = (texte: string) =>
  decouperLiensMessage(texte)
    .map((m) => m.texte)
    .join('')

const liens = (texte: string) =>
  decouperLiensMessage(texte).flatMap((m) => (m.type === 'lien' ? [m.href] : []))

describe('decouperLiensMessage', () => {
  it('laisse un texte sans adresse en un seul morceau', () => {
    expect(decouperLiensMessage('Rendez-vous à 14h')).toEqual([
      { type: 'texte', texte: 'Rendez-vous à 14h' },
    ])
  })

  it('rend vide un texte vide', () => {
    expect(decouperLiensMessage('')).toEqual([])
  })

  it('reconnaît http et https, au milieu du texte', () => {
    expect(decouperLiensMessage('Voir https://site.fr/page?a=1 ou http://autre.org ici')).toEqual([
      { type: 'texte', texte: 'Voir ' },
      { type: 'lien', texte: 'https://site.fr/page?a=1', href: 'https://site.fr/page?a=1' },
      { type: 'texte', texte: ' ou ' },
      { type: 'lien', texte: 'http://autre.org', href: 'http://autre.org' },
      { type: 'texte', texte: ' ici' },
    ])
  })

  it('complète « www. » en https, sans changer le texte affiché', () => {
    expect(decouperLiensMessage('www.jonglerie.fr')).toEqual([
      { type: 'lien', texte: 'www.jonglerie.fr', href: 'https://www.jonglerie.fr' },
    ])
  })

  it('laisse un domaine nu en texte', () => {
    expect(liens('le fichier programme.pdf et site.fr')).toEqual([])
  })

  it('retire la ponctuation de fin de phrase', () => {
    expect(liens('Regarde https://site.fr.')).toEqual(['https://site.fr'])
    expect(liens('https://site.fr, puis www.b.fr !')).toEqual([
      'https://site.fr',
      'https://www.b.fr',
    ])
    expect(liens('(voir https://site.fr)')).toEqual(['https://site.fr'])
  })

  it('garde une parenthèse qui appartient à l’adresse', () => {
    expect(liens('https://fr.wikipedia.org/wiki/Jonglerie_(art)')).toEqual([
      'https://fr.wikipedia.org/wiki/Jonglerie_(art)',
    ])
  })

  it('s’arrête aux chevrons et aux sauts de ligne', () => {
    expect(liens('<https://site.fr>')).toEqual(['https://site.fr'])
    expect(liens('https://a.fr\nhttps://b.fr')).toEqual(['https://a.fr', 'https://b.fr'])
  })

  it('ignore un préfixe sans rien derrière', () => {
    expect(liens('tape https:// ou www. puis la suite')).toEqual([])
  })

  it('ne perd aucun caractère', () => {
    const texte = 'A: https://x.fr/(a)). B: www.y.fr?\nC <http://z.org> fin'
    expect(recolle(texte)).toBe(texte)
  })

  it('ne produit jamais de lien autre que http(s)', () => {
    expect(liens('javascript:alert(1) data:text/html,x')).toEqual([])
  })
})
