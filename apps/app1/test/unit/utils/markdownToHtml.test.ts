import { describe, it, expect } from 'vitest'

// Import statique pour optimiser les performances
import {
  convertirRaccourcisEmoji,
  markdownEnTexte,
  markdownToHtml,
} from '../../../app/utils/markdown'

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

/**
 * L'extrait TEXTE d'un markdown, pour une vignette de deux lignes.
 *
 * ## Le défaut que ces cas ferment
 *
 * La page centralisée des appels ouverts interpolait la description **telle quelle** : l'artiste y
 * lisait `**Scène ouverte**`, `## Conditions` ou `:performing_arts:`, alors que les pages d'une
 * édition la rendent proprement.
 *
 * 📍 Un extrait texte plutôt que le HTML rendu : la carte n'affiche que deux lignes
 * (`line-clamp-2`), où un titre de niveau 2 entrerait à sa taille normale et où `line-clamp` ne
 * borne pas de façon fiable une suite d'éléments de bloc.
 */
describe('markdownEnTexte', () => {
  it('rend une chaîne vide pour une absence', async () => {
    expect(await markdownEnTexte('')).toBe('')
  })

  it('retire le gras, l’italique et le code inline', async () => {
    expect(await markdownEnTexte('**Scène ouverte** en *juillet*, voir `README`')).toBe(
      'Scène ouverte en juillet, voir README'
    )
  })

  it('sépare les blocs de premier niveau par un point médian', async () => {
    /*
     * ⚠️ SANS SÉPARATEUR, « ## Conditions » suivi d'un paragraphe donnerait « Conditions Les
     * artistes doivent… », qui se lit comme une phrase mal formée. C'est le symptôme exact du
     * constat, déplacé plutôt que corrigé.
     */
    expect(await markdownEnTexte('## Conditions\n\nLes artistes doivent postuler.')).toBe(
      'Conditions · Les artistes doivent postuler.'
    )
  })

  it('aplatit une liste en gardant chaque entrée', async () => {
    expect(await markdownEnTexte('- un\n- deux\n- trois')).toBe('un deux trois')
  })

  it('garde le libellé d’un lien, pas son adresse', async () => {
    // Une URL dans un aperçu de deux lignes mange la place sans rien dire de plus.
    expect(await markdownEnTexte('Voir [le règlement](https://exemple.test/tres/longue/url)')).toBe(
      'Voir le règlement'
    )
  })

  it('écarte le texte alternatif d’une image', async () => {
    // Dans un aperçu, il décrit quelque chose que le lecteur ne voit pas.
    expect(await markdownEnTexte('![affiche de la convention](/a.png)')).toBe('')
  })

  it('convertit les raccourcis d’emoji', async () => {
    // `:performing_arts:` brut dans une vignette est l'un des trois symptômes du constat.
    expect(await markdownEnTexte('Spectacle :performing_arts:')).toBe('Spectacle 🎭')
  })

  it('réduit les espaces et les sauts de ligne internes', async () => {
    expect(await markdownEnTexte('Une ligne\nqui continue')).toBe('Une ligne qui continue')
  })

  it('n’émet aucun séparateur pour un markdown qui ne contient que du balisage', async () => {
    // `---` est une règle horizontale : aucun texte, donc aucun bloc à joindre. Sans le filtre
    // sur les blocs vides, on obtiendrait « · · ».
    expect(await markdownEnTexte('---\n\n---')).toBe('')
  })
})
