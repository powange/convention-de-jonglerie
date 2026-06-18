import { describe, it, expect } from 'vitest'

import {
  parseSearchTerms,
  matchesAllTerms,
  countMatches,
  highlightText,
  highlightHtml,
} from '../../../app/utils/highlight'

const MARK_CLASS = 'bg-yellow-200 dark:bg-yellow-700/60 text-inherit rounded px-0.5'

describe('highlight utils', () => {
  describe('parseSearchTerms', () => {
    it('devrait découper une requête en termes', () => {
      expect(parseSearchTerms('foo bar baz')).toEqual(['foo', 'bar', 'baz'])
    })

    it('devrait gérer les espaces multiples', () => {
      expect(parseSearchTerms('foo   bar')).toEqual(['foo', 'bar'])
    })

    it('devrait gérer tabulations et retours à la ligne', () => {
      expect(parseSearchTerms('foo\tbar\nbaz')).toEqual(['foo', 'bar', 'baz'])
    })

    it('devrait rogner les espaces de début et de fin', () => {
      expect(parseSearchTerms('  foo bar  ')).toEqual(['foo', 'bar'])
    })

    it('devrait retourner un tableau vide pour une chaîne vide', () => {
      expect(parseSearchTerms('')).toEqual([])
    })

    it('devrait retourner un tableau vide pour une chaîne uniquement espaces', () => {
      expect(parseSearchTerms('     ')).toEqual([])
    })

    it('devrait préserver un terme unique', () => {
      expect(parseSearchTerms('jonglerie')).toEqual(['jonglerie'])
    })
  })

  describe('matchesAllTerms', () => {
    it('devrait retourner true quand tous les termes sont présents', () => {
      expect(matchesAllTerms('Convention de jonglerie', ['convention', 'jonglerie'])).toBe(true)
    })

    it('devrait retourner false si un terme est absent', () => {
      expect(matchesAllTerms('Convention de jonglerie', ['convention', 'absent'])).toBe(false)
    })

    it('devrait être insensible à la casse', () => {
      expect(matchesAllTerms('JONGLERIE', ['jonglerie'])).toBe(true)
      expect(matchesAllTerms('jonglerie', ['JONGLERIE'])).toBe(true)
    })

    it('devrait être insensible aux accents', () => {
      expect(matchesAllTerms('édition spéciale', ['edition'])).toBe(true)
      expect(matchesAllTerms('edition', ['édition'])).toBe(true)
      expect(matchesAllTerms('Évènement à Genève', ['evenement', 'geneve'])).toBe(true)
    })

    it('devrait retourner true quand la liste de termes est vide', () => {
      expect(matchesAllTerms('peu importe', [])).toBe(true)
    })

    it('devrait gérer une correspondance partielle (sous-chaîne)', () => {
      expect(matchesAllTerms('jonglerie', ['jong'])).toBe(true)
    })

    it('devrait retourner false sur un texte vide avec un terme', () => {
      expect(matchesAllTerms('', ['foo'])).toBe(false)
    })
  })

  describe('countMatches', () => {
    it('devrait compter une occurrence unique', () => {
      expect(countMatches('foo bar', ['foo'])).toBe(1)
    })

    it('devrait compter plusieurs occurrences du même terme', () => {
      expect(countMatches('foo foo foo', ['foo'])).toBe(3)
    })

    it('devrait compter les occurrences de plusieurs termes', () => {
      expect(countMatches('foo bar foo', ['foo', 'bar'])).toBe(3)
    })

    it('devrait être insensible à la casse et aux accents', () => {
      expect(countMatches('Édition EDITION édition', ['edition'])).toBe(3)
    })

    it('ne devrait pas compter de chevauchement pour un même terme', () => {
      // "aa" dans "aaaa" => positions 0-2 puis 2-4 = 2 occurrences (sans chevauchement)
      expect(countMatches('aaaa', ['aa'])).toBe(2)
    })

    it('devrait retourner 0 si aucun terme', () => {
      expect(countMatches('foo bar', [])).toBe(0)
    })

    it('devrait retourner 0 pour un texte vide', () => {
      expect(countMatches('', ['foo'])).toBe(0)
    })

    it('devrait retourner 0 si le terme est absent', () => {
      expect(countMatches('foo bar', ['absent'])).toBe(0)
    })

    it('devrait ignorer un terme vide après normalisation', () => {
      // un terme composé uniquement d'un accent combinant disparaît après stripAccents
      expect(countMatches('texte', ['́'])).toBe(0)
    })
  })

  describe('highlightText', () => {
    it('devrait entourer le terme trouvé avec un <mark>', () => {
      const result = highlightText('foo bar', ['bar'])
      expect(result).toBe(`foo <mark class="${MARK_CLASS}">bar</mark>`)
    })

    it("devrait retourner le texte échappé sans <mark> s'il n'y a pas de correspondance", () => {
      expect(highlightText('foo bar', ['absent'])).toBe('foo bar')
    })

    it('devrait surligner plusieurs occurrences', () => {
      const result = highlightText('foo foo', ['foo'])
      expect(result).toBe(
        `<mark class="${MARK_CLASS}">foo</mark> <mark class="${MARK_CLASS}">foo</mark>`
      )
    })

    it('devrait surligner en respectant la casse originale du texte', () => {
      const result = highlightText('Jonglerie', ['jonglerie'])
      expect(result).toBe(`<mark class="${MARK_CLASS}">Jonglerie</mark>`)
    })

    it('devrait surligner en respectant les accents originaux', () => {
      const result = highlightText('édition', ['edition'])
      expect(result).toBe(`<mark class="${MARK_CLASS}">édition</mark>`)
    })

    it('devrait échapper le HTML du texte non surligné (anti-injection)', () => {
      const result = highlightText('<script>alert(1)</script>', ['absent'])
      expect(result).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
      expect(result).not.toContain('<script>')
    })

    it('devrait échapper le HTML même à l’intérieur du <mark>', () => {
      const result = highlightText('<b>bar</b>', ['bar'])
      // Le contenu surligné est échappé, seul le <mark> est du vrai HTML
      expect(result).toContain(`<mark class="${MARK_CLASS}">bar</mark>`)
      expect(result).toContain('&lt;b&gt;')
      expect(result).toContain('&lt;/b&gt;')
      expect(result).not.toContain('<b>')
    })

    it('devrait échapper les guillemets et apostrophes', () => {
      expect(highlightText(`l'"été"`, ['absent'])).toBe('l&#39;&quot;été&quot;')
    })

    it('devrait échapper les esperluettes', () => {
      expect(highlightText('a & b', ['absent'])).toBe('a &amp; b')
    })

    it('ne devrait pas interpréter les caractères regex spéciaux comme des motifs', () => {
      // Le point ne doit matcher qu'un point littéral, pas n'importe quel caractère
      expect(highlightText('abc', ['.'])).toBe('abc')
      const result = highlightText('a.c', ['.'])
      expect(result).toBe(`a<mark class="${MARK_CLASS}">.</mark>c`)
    })

    it('devrait traiter littéralement les métacaractères regex', () => {
      const result = highlightText('prix (5€)', ['(5€)'])
      expect(result).toContain(`<mark class="${MARK_CLASS}">(5€)</mark>`)
    })

    it('devrait fusionner des plages qui se chevauchent', () => {
      // "ab" et "bc" se chevauchent sur "abc" => une seule plage "abc"
      const result = highlightText('abc', ['ab', 'bc'])
      expect(result).toBe(`<mark class="${MARK_CLASS}">abc</mark>`)
    })

    it('devrait gérer un texte vide', () => {
      expect(highlightText('', ['foo'])).toBe('')
    })

    it('devrait gérer une liste de termes vide', () => {
      expect(highlightText('foo bar', [])).toBe('foo bar')
    })

    it('devrait échapper un texte vide sans terme', () => {
      expect(highlightText('', [])).toBe('')
    })
  })

  describe('highlightHtml', () => {
    it('devrait insérer un <mark> dans un nœud texte', () => {
      const result = highlightHtml('<p>foo bar</p>', ['bar'])
      expect(result).toBe(`<p>foo <mark class="${MARK_CLASS}">bar</mark></p>`)
    })

    it('devrait surligner sans casser la structure HTML existante', () => {
      const result = highlightHtml('<p>Convention</p><p>jonglerie</p>', ['jonglerie'])
      expect(result).toBe(`<p>Convention</p><p><mark class="${MARK_CLASS}">jonglerie</mark></p>`)
    })

    it('devrait être insensible à la casse et aux accents', () => {
      const result = highlightHtml('<span>Édition</span>', ['edition'])
      expect(result).toBe(`<span><mark class="${MARK_CLASS}">Édition</mark></span>`)
    })

    it('ne devrait pas re-surligner à l’intérieur d’un <mark> existant', () => {
      const html = `<mark class="${MARK_CLASS}">bar</mark>`
      expect(highlightHtml(html, ['bar'])).toBe(html)
    })

    it('ne devrait pas surligner dans un <script>', () => {
      const html = '<script>var bar = 1</script>'
      expect(highlightHtml(html, ['bar'])).toBe(html)
    })

    it('ne devrait pas surligner dans un <style>', () => {
      const html = '<style>.bar { color: red }</style>'
      expect(highlightHtml(html, ['bar'])).toBe(html)
    })

    it('devrait retourner le HTML inchangé sans terme', () => {
      const html = '<p>foo bar</p>'
      expect(highlightHtml(html, [])).toBe(html)
    })

    it('devrait retourner le HTML inchangé pour une chaîne vide', () => {
      expect(highlightHtml('', ['foo'])).toBe('')
    })

    it('devrait retourner le HTML inchangé si aucune correspondance', () => {
      const html = '<p>foo bar</p>'
      expect(highlightHtml(html, ['absent'])).toBe(html)
    })

    it('devrait surligner plusieurs occurrences réparties dans des éléments', () => {
      const result = highlightHtml('<div><b>foo</b> et foo</div>', ['foo'])
      expect(result).toBe(
        `<div><b><mark class="${MARK_CLASS}">foo</mark></b> et <mark class="${MARK_CLASS}">foo</mark></div>`
      )
    })
  })
})
