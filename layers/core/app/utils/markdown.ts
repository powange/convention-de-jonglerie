import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import type { Root, Element } from 'hast'
import type { Root as RacineMdast, Text as TexteMdast } from 'mdast'

// Plugin rehype pour ajouter target="_blank" et rel="noopener noreferrer" aux liens
function rehypeExternalLinks() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'a' && node.properties?.href) {
        node.properties.target = '_blank'
        node.properties.rel = 'noopener noreferrer'
      }
    })
  }
}

/**
 * L'éditeur enregistre les emojis sous forme de raccourci (`:performing_arts:`) : c'est ce que
 * Tiptap écrit dans le markdown, et il le réaffiche en emoji dans le champ de saisie. Sans la
 * conversion ci-dessous, le lecteur voyait le raccourci brut là où l'auteur voyait 🎭.
 *
 * La table est chargée à la demande — 55 Ko qu'il est inutile de télécharger pour un texte qui
 * ne contient aucun raccourci, c'est-à-dire la plupart.
 */
const CONTIENT_RACCOURCI = /:[a-z0-9_+-]+:/
const RACCOURCI = /:([a-z0-9_+-]+):/g

let tableRaccourcis: Record<string, string> | null = null

async function chargerTableRaccourcis(): Promise<Record<string, string>> {
  if (!tableRaccourcis) {
    tableRaccourcis = (await import('./emoji-shortcodes.json')).default as Record<string, string>
  }
  return tableRaccourcis
}

/** Un raccourci inconnu — ceux propres à GitHub, qui n'ont qu'une image — est laissé tel quel. */
function remplacerRaccourcis(texte: string, table: Record<string, string>): string {
  return texte.replace(RACCOURCI, (brut, nom: string) => table[nom] ?? brut)
}

/**
 * Convertit les raccourcis d'un texte brut, hors de tout markdown.
 *
 * Sert aux endroits qui affichent la description sans la rendre — la balise `<meta>` d'une page,
 * par exemple, qui annonçait `:performing_arts:` dans les aperçus de partage.
 */
export async function convertirRaccourcisEmoji(texte: string): Promise<string> {
  if (!texte || !CONTIENT_RACCOURCI.test(texte)) return texte
  return remplacerRaccourcis(texte, await chargerTableRaccourcis())
}

/**
 * Remplace les raccourcis emoji dans les seuls nœuds de texte : le code inline et les blocs de
 * code gardent ainsi leur contenu littéral, et les URL ne sont pas du texte pour mdast.
 */
function remarkRaccourcisEmoji() {
  return async (tree: RacineMdast) => {
    const noeuds: TexteMdast[] = []
    visit(tree, 'text', (node: TexteMdast) => {
      if (CONTIENT_RACCOURCI.test(node.value)) noeuds.push(node)
    })
    if (noeuds.length === 0) return

    const table = await chargerTableRaccourcis()
    for (const node of noeuds) {
      node.value = remplacerRaccourcis(node.value, table)
    }
  }
}

/**
 * Le soulignement, que markdown ne sait pas dire.
 *
 * Ni CommonMark ni GFM n'ont de syntaxe pour cela — sur le web, le souligné signale un lien.
 * L'éditeur, lui, en propose un et l'enregistre en `++texte++` : c'est ce qu'écrit l'extension
 * Underline de Tiptap, et ce qu'elle sait relire. Sans le greffon ci-dessous, le lecteur voyait
 * les `++` en toutes lettres — ce qui est arrivé, la description de plusieurs éditions en
 * contenant déjà.
 *
 * Limite assumée : la conversion opère sur un nœud de texte, donc `++**gras souligné**++` ne
 * prend pas. Le cas est rare, et le traiter demanderait de re-analyser l'intérieur.
 *
 * Les deux gardes sur les espaces écartent un texte qui contient des `++` sans vouloir rien
 * souligner : « C++ et C++ » deviendrait sinon « C<u> et C</u> ». L'éditeur, lui, ne produit
 * jamais d'espace collé aux marques — il taille son contenu — donc ce qu'il écrit passe.
 */
const SOULIGNE = /\+\+(?!\s)([\s\S]+?)(?<!\s)\+\+/g

function remarkSouligne() {
  return (tree: RacineMdast) => {
    visit(tree, 'text', (node: TexteMdast, index, parent) => {
      if (index === null || index === undefined || !parent) return
      if (!node.value.includes('++')) return

      const morceaux: Array<TexteMdast | Record<string, unknown>> = []
      let curseur = 0

      for (const trouve of node.value.matchAll(SOULIGNE)) {
        const debut = trouve.index ?? 0
        if (debut > curseur) {
          morceaux.push({ type: 'text', value: node.value.slice(curseur, debut) } as TexteMdast)
        }
        // `hName` impose la balise rendue : `<u>` dit l'intention de l'auteur, là où `<ins>`
        // annoncerait un ajout au texte.
        morceaux.push({
          type: 'emphasis',
          data: { hName: 'u' },
          children: [{ type: 'text', value: trouve[1] }],
        })
        curseur = debut + trouve[0].length
      }

      if (morceaux.length === 0) return
      if (curseur < node.value.length) {
        morceaux.push({ type: 'text', value: node.value.slice(curseur) } as TexteMdast)
      }

      parent.children.splice(index, 1, ...(morceaux as never[]))
      // Reprendre après les nœuds insérés : sans ça, la visite les repasserait en boucle.
      return index + morceaux.length
    })
  }
}

// Schéma de sanitisation étendu pour autoriser target et rel sur les liens, et la balise du
// soulignement. `u` ne figure pas dans le schéma par défaut ; on l'ajoute sans risque puisque
// c'est le greffon ci-dessus qui la produit, jamais le HTML brut d'un auteur — celui-ci est de
// toute façon écarté avant d'arriver ici.
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'u'],
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a || ['href']), 'target', 'rel'],
  },
}

// Processor stateless côté client/SSR
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkSouligne)
  .use(remarkRaccourcisEmoji)
  .use(remarkRehype)
  .use(rehypeExternalLinks)
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeStringify)

export async function markdownToHtml(md: string): Promise<string> {
  if (!md) return ''

  // Préprocessing: ajouter des sauts de ligne forcés pour les sauts simples
  const preprocessed = md.replace(/([^\n])\n([^\n])/g, '$1  \n$2')

  const file = await processor.process(preprocessed)
  return String(file)
}

/**
 * Les nœuds mdast dont les enfants sont des BLOCS distincts, et qu'il faut donc séparer.
 *
 * Tout le reste est en ligne et se recolle sans espace.
 */
const CONTENEURS_DE_BLOCS = new Set([
  'list',
  'listItem',
  'blockquote',
  'table',
  'tableRow',
  'tableCell',
  'footnoteDefinition',
])

/** Les nœuds qui portent du texte lisible, dans l'arbre mdast. */
type NoeudTexte = { type: string; value?: string; children?: NoeudTexte[] }

/**
 * Le texte d'un markdown, sans son balisage — pour un APERÇU, jamais pour un affichage complet.
 *
 * ## ⚠️ POURQUOI UN EXTRAIT TEXTE ET NON LE HTML RENDU
 *
 * Les pages d'une édition rendent la description d'un appel à spectacles avec `markdownToHtml`,
 * dans un conteneur `prose`. La page centralisée des appels ouverts, elle, l'interpolait **telle
 * quelle** : l'artiste y lisait `**Scène ouverte**`, `## Conditions` ou `:performing_arts:`.
 *
 * Mais cette page n'affiche pas la description — elle en montre une **vignette de deux lignes**
 * (`line-clamp-2`) dans une grille de cartes. Y rendre le HTML y ferait entrer un titre de niveau
 * 2 à sa taille normale, et `line-clamp` ne borne pas de façon fiable une suite d'éléments de
 * bloc. L'extrait texte dit la même chose et tient dans la carte.
 *
 * ## L'ARBRE, ET PAS UNE EXPRESSION RÉGULIÈRE
 *
 * Le texte est extrait de l'arbre **mdast** produit par le même analyseur que `markdownToHtml`,
 * et non par une suite de `replace`. Retirer du balisage à coups d'expressions régulières est
 * exactement la famille de défauts que l'import de carte vient de payer : il reste toujours une
 * forme imbriquée à laquelle on n'avait pas pensé, et le résultat est faux sans être signalé.
 * L'analyseur, lui, sait déjà ce qui est du balisage.
 *
 * ## Les choix d'affichage, et leurs raisons
 *
 * - les blocs de premier niveau sont joints par ` · ` et non par une espace : sans séparateur,
 *   « ## Conditions » suivi d'un paragraphe donnerait « Conditions Les artistes doivent… », qui se
 *   lit comme une phrase mal formée ;
 * - les raccourcis d'emoji sont convertis, comme le fait l'affichage complet — `:performing_arts:`
 *   brut dans une vignette est précisément l'un des trois symptômes du constat ;
 * - le texte alternatif d'une image est écarté : dans un aperçu de deux lignes, il décrit quelque
 *   chose que le lecteur ne voit pas.
 */
export async function markdownEnTexte(md: string): Promise<string> {
  if (!md) return ''

  const arbre = unified().use(remarkParse).use(remarkGfm).parse(md) as unknown as NoeudTexte

  const texteDu = (noeud: NoeudTexte): string => {
    // `image` porte un `alt` mais pas de `value` exploitable ici : écarté, voir l'en-tête.
    if (noeud.type === 'image') return ''
    if (typeof noeud.value === 'string') return noeud.value
    /*
     * ⚠️ UN SÉPARATEUR POUR LES CONTENEURS DE BLOCS, rien pour les nœuds en ligne.
     *
     * Les enfants d'un nœud EN LIGNE se recollent sans espace — c'est ce qui fait que
     * « **Scène** ouverte » rend « Scène ouverte » et non « Scène  ouverte ». Mais une LISTE a
     * pour enfants des éléments distincts : les joindre de la même façon rendait « un deux
     * trois » sous la forme « undeuxtrois ».
     *
     * Défaut réel, attrapé par son test et non par la relecture.
     */
    const separateur = CONTENEURS_DE_BLOCS.has(noeud.type) ? ' ' : ''
    return (noeud.children ?? []).map(texteDu).join(separateur)
  }

  const blocs = (arbre.children ?? [])
    .map((bloc) => texteDu(bloc).replace(/\s+/g, ' ').trim())
    .filter((bloc) => bloc.length > 0)

  const texte = blocs.join(' · ')

  /*
   * ⚠️ LA CONVERSION DES EMOJIS NE DOIT PAS POUVOIR FAIRE ÉCHOUER L'APERÇU. Elle importe une
   * table de 55 Ko à la demande, donc elle dépend du réseau. Un rejet non rattrapé dans le
   * watcher appelant **interromprait l'hydratation** de la page — défaut déjà payé ici, et dont
   * le symptôme est une page figée sans aucune erreur visible.
   *
   * Le repli rend le texte SANS les emojis convertis : un `:performing_arts:` résiduel est un
   * défaut d'affichage mineur, là où une page figée n'en est pas un.
   */
  try {
    return await convertirRaccourcisEmoji(texte)
  } catch {
    return texte
  }
}
