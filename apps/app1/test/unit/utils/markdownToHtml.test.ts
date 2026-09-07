import { describe, it, expect } from 'vitest'

// Import statique pour optimiser les performances
import { convertirRaccourcisEmoji, markdownToHtml } from '../../../app/utils/markdown'

describe('markdownToHtml', () => {
  it('rend du HTML simple', async () => {
    const html = await markdownToHtml('# Titre')
    expect(html).toContain('<h1')
    expect(html).toContain('Titre')
  })

  it('sanitise script tag', async () => {
    const html = await markdownToHtml('Hello <script>alert(1)</script>')
    expect(html).toContain('Hello')
    expect(html).not.toContain('<script')
  })

  it('gère le GFM (liste + emphase)', async () => {
    const html = await markdownToHtml('- *item*')
    expect(html).toContain('<ul')
    expect(html).toContain('<em>item</em>')
  })

  describe('raccourcis emoji', () => {
    // L'éditeur enregistre `:performing_arts:` et non 🎭 : le rendu doit refaire la conversion,
    // sinon le lecteur voit le raccourci brut là où l'auteur voyait un emoji.
    it("convertit un raccourci en l'emoji correspondant", async () => {
      const html = await markdownToHtml('Spectacle :performing_arts: ce soir')
      expect(html).toContain('Spectacle 🎭 ce soir')
      expect(html).not.toContain(':performing_arts:')
    })

    it('convertit les raccourcis à ponctuation', async () => {
      expect(await markdownToHtml('Bravo :+1:')).toContain('Bravo 👍')
    })

    it('laisse intact un raccourci inconnu', async () => {
      // Les emojis propres à GitHub n'ont qu'une image : rien à mettre à la place.
      expect(await markdownToHtml('Voir :octocat:')).toContain(':octocat:')
    })

    it('ne touche pas au code, où le texte doit rester littéral', async () => {
      // Une documentation qui montre `:tada:` entre accents graves parle du raccourci lui-même.
      const html = await markdownToHtml('Tapez `:tada:` pour fêter ça')
      expect(html).toContain('<code>:tada:</code>')
    })

    it("n'abîme pas un deux-points isolé", async () => {
      const html = await markdownToHtml('Horaire : 20:30, durée 1:30')
      expect(html).toContain('Horaire : 20:30, durée 1:30')
    })
  })
})

describe('convertirRaccourcisEmoji', () => {
  // La balise <meta description> reçoit du texte brut, pas du HTML : elle a besoin de la même
  // table que le rendu, sans passer par markdown.
  it('convertit les raccourcis sans toucher au reste', async () => {
    expect(await convertirRaccourcisEmoji('## Contexte :performing_arts: ce soir')).toBe(
      '## Contexte 🎭 ce soir'
    )
  })

  it('rend le texte inchangé quand il ne contient aucun raccourci', async () => {
    const texte = 'Horaire : 20:30'
    expect(await convertirRaccourcisEmoji(texte)).toBe(texte)
  })

  it('accepte une chaîne vide', async () => {
    expect(await convertirRaccourcisEmoji('')).toBe('')
  })
})

/**
 * Markdown n'a pas de soulignement — ni CommonMark ni GFM —, mais l'éditeur en propose un et
 * l'enregistre en `++texte++` : c'est ce qu'écrit l'extension Underline de Tiptap. Sans
 * conversion au rendu, le lecteur voyait les `++` en toutes lettres, ce qui est arrivé : la
 * description de plusieurs éditions en contient déjà.
 */
describe('soulignement', () => {
  it('convertit `++texte++`', async () => {
    expect(await markdownToHtml('++souligné++')).toContain('<u>souligné</u>')
  })

  it('en convertit plusieurs sur la même ligne', async () => {
    const html = await markdownToHtml('a ++b++ c ++d++ e')
    expect(html).toContain('a <u>b</u> c <u>d</u> e')
  })

  it('respecte le gras qui l’entoure', async () => {
    // C'est l'ordre qu'écrit Tiptap quand les deux marques se cumulent : le souligné à
    // l'intérieur. Le vérifier ici, c'est vérifier que le cas courant passe.
    expect(await markdownToHtml('**++gras souligné++**')).toContain(
      '<strong><u>gras souligné</u></strong>'
    )
  })

  it('fonctionne dans un lien', async () => {
    expect(await markdownToHtml('[++lien++](https://exemple.fr)')).toContain('<u>lien</u>')
  })

  it('laisse le code littéral', async () => {
    // Une documentation qui montre `++x++` parle de la syntaxe elle-même.
    expect(await markdownToHtml('Tapez `++x++`')).toContain('<code>++x++</code>')
  })

  it('ne touche pas à un `++` isolé', async () => {
    // Sans marque fermante, il n'y a rien à souligner — et « 1 + 1 ++ 2 » doit rester lisible.
    expect(await markdownToHtml('1 + 1 ++ 2')).toContain('1 + 1 ++ 2')
  })

  it('ne souligne pas un texte qui contient des `++` par hasard', async () => {
    // « C++ et C++ » serait devenu « C<u> et C</u> ». L'éditeur ne colle jamais d'espace à ses
    // marques, donc ce garde n'écarte que ce qu'il n'a pas écrit.
    const html = await markdownToHtml('C++ et C++ sont deux langages')
    expect(html).toContain('C++ et C++ sont deux langages')
    expect(html).not.toContain('<u>')
  })

  it('laisse tel quel un soulignement enjambant une autre marque', async () => {
    // Limite assumée : la conversion opère sur un nœud de texte, et `++**gras**++` en occupe
    // trois. Le cas ne vient pas de l'éditeur, qui écrit l'ordre inverse.
    expect(await markdownToHtml('++**gras**++')).toContain('++<strong>gras</strong>++')
  })
})
