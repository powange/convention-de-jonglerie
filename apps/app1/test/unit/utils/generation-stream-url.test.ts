import { describe, expect, it } from 'vitest'

import { buildGenerationStreamUrl } from '../../../shared/utils/generation-stream-url'

/**
 * Ce que ces tests protègent réellement : les URLs voyagent dans un seul paramètre, séparées par
 * des retours à la ligne. Or la spécification des URL impose de **supprimer** les retours à la
 * ligne du texte analysé plutôt que de les encoder.
 *
 * Assembler la chaîne à la main collait donc les adresses bout à bout, et le serveur n'en voyait
 * qu'une. Aucune erreur n'était levée : l'analyse tournait, elle ignorait simplement tous les
 * liens sauf le premier. Un défaut invisible, d'où ces vérifications passant par un vrai
 * analyseur d'URL.
 */
const analyser = (sseUrl: string) => new URL(sseUrl, 'https://exemple.test')

describe('buildGenerationStreamUrl', () => {
  it('transmet chaque URL séparément après analyse', () => {
    const urls = ['https://a.example/x', 'https://b.example/y', 'https://c.example/z']
    const recu = analyser(
      buildGenerationStreamUrl({ method: 'direct', urls, detectServices: true })
    ).searchParams.get('urls')

    expect(recu?.split('\n').filter(Boolean)).toEqual(urls)
  })

  // Le cas d'origine : une adresse Facebook parmi d'autres. Concaténées, l'ensemble contenait
  // « facebook.com/events » et partait entier au lecteur Facebook, les autres liens n'étant
  // jamais consultés.
  it('ne colle pas les adresses bout à bout', () => {
    const recu = analyser(
      buildGenerationStreamUrl({
        method: 'direct',
        urls: ['https://facebook.com/events/123', 'https://ma-convention.fr/programme'],
        detectServices: true,
      })
    ).searchParams.get('urls')

    expect(recu).not.toContain('123https://')
    expect(recu?.split('\n')).toHaveLength(2)
  })

  it('supporte une seule URL', () => {
    const recu = analyser(
      buildGenerationStreamUrl({
        method: 'agent',
        urls: ['https://a.example/x'],
        detectServices: false,
      })
    ).searchParams.get('urls')

    expect(recu).toBe('https://a.example/x')
  })

  it('préserve les paramètres de requête des URLs analysées', () => {
    const urls = ['https://fr.jugglingedge.com/event.php?EventID=6447&a=b#ancre']
    const recu = analyser(
      buildGenerationStreamUrl({ method: 'direct', urls, detectServices: true })
    ).searchParams.get('urls')

    expect(recu?.split('\n')).toEqual(urls)
  })

  it('porte la méthode et le drapeau de détection des services', () => {
    const p = analyser(
      buildGenerationStreamUrl({
        method: 'agent',
        urls: ['https://a.example/x'],
        detectServices: false,
      })
    ).searchParams

    expect(p.get('method')).toBe('agent')
    // Explicitement « false » : omettre le paramètre réactiverait la détection côté serveur.
    expect(p.get('detectServices')).toBe('false')
  })

  it('n’ajoute les paramètres optionnels que s’ils sont fournis', () => {
    const sans = analyser(
      buildGenerationStreamUrl({
        method: 'direct',
        urls: ['https://a.example/x'],
        detectServices: true,
      })
    ).searchParams
    expect(sans.has('provider')).toBe(false)
    expect(sans.has('previewedImageUrl')).toBe(false)

    const avec = analyser(
      buildGenerationStreamUrl({
        method: 'direct',
        urls: ['https://a.example/x'],
        provider: 'lmstudio',
        previewedImageUrl: 'https://img.example/affiche.jpg?v=2',
        detectServices: true,
      })
    ).searchParams
    expect(avec.get('provider')).toBe('lmstudio')
    expect(avec.get('previewedImageUrl')).toBe('https://img.example/affiche.jpg?v=2')
  })
})
