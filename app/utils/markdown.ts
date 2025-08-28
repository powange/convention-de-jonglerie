import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

// Processor stateless côté client/SSR
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify)

export async function markdownToHtml(md: string): Promise<string> {
  if (!md) return ''

  // Préprocessing: ajouter des sauts de ligne forcés pour les sauts simples
  const preprocessed = md.replace(/([^\n])\n([^\n])/g, '$1  \n$2')

  const file = await processor.process(preprocessed)
  return String(file)
}
