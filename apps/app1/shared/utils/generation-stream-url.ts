/**
 * Construction de l'URL du flux de génération d'import (SSE).
 *
 * Le serveur reçoit les URLs à analyser dans un seul paramètre, séparées par des retours à la
 * ligne — la virgule ayant été écartée parce qu'elle apparaît dans les URLs.
 *
 * Le piège est là : la spécification des URL impose de **supprimer** les tabulations et les
 * retours à la ligne du texte analysé, au lieu de les encoder. Assembler la chaîne à la main
 * collait donc les URLs bout à bout — « https://a/xhttps://b/y » — et le serveur, qui redécoupe
 * sur `\n`, n'en voyait plus qu'une. Avec une adresse Facebook dans le lot, le bloc concaténé
 * contenait « facebook.com/events » et partait entier au lecteur Facebook : les autres liens
 * n'étaient jamais consultés, sans le moindre message d'erreur.
 *
 * `URLSearchParams` encode le retour à la ligne en `%0A`, qui traverse l'analyseur intact et que
 * le serveur redécode. D'où cette fonction, isolée pour être vérifiable.
 */
export interface GenerationStreamParams {
  method: 'direct' | 'agent'
  urls: string[]
  previewedImageUrl?: string
  provider?: string
  detectServices: boolean
  /** Page du programme, qui reçoit une passe d'extraction dédiée côté serveur. */
  programUrl?: string
}

export function buildGenerationStreamUrl({
  method,
  urls,
  previewedImageUrl,
  provider,
  detectServices,
  programUrl,
}: GenerationStreamParams): string {
  const params = new URLSearchParams()
  params.set('method', method)
  params.set('urls', urls.join('\n'))
  if (previewedImageUrl) params.set('previewedImageUrl', previewedImageUrl)
  if (provider) params.set('provider', provider)
  if (programUrl) params.set('programUrl', programUrl)
  // Toujours transmise : le serveur l'active par défaut, l'omettre changerait le comportement.
  params.set('detectServices', detectServices ? 'true' : 'false')

  return `/api/admin/generate-import-json-stream?${params.toString()}`
}
