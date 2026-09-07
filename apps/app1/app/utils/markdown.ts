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
