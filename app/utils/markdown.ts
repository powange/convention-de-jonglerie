import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import type { Root, Element } from 'hast'

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

// Schéma de sanitisation étendu pour autoriser target et rel sur les liens
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a || ['href']), 'target', 'rel'],
  },
}

// Processor stateless côté client/SSR
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
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
