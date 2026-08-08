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

  // La page du programme est signalée à part pour recevoir une passe d'extraction dédiée : sans
  // ce paramètre, le serveur ne saurait pas laquelle des sources mérite le budget entier.
  it('signale la page du programme quand elle est fournie', () => {
    const p = analyser(
      buildGenerationStreamUrl({
        method: 'direct',
        urls: ['https://ejc.example/', 'https://ejc.example/program/'],
        programUrl: 'https://ejc.example/program/',
        detectServices: true,
      })
    ).searchParams

    expect(p.get('programUrl')).toBe('https://ejc.example/program/')
    expect(p.get('urls')?.split('\n')).toHaveLength(2)
  })

  /**
   * Le périmètre n'est transmis que lorsqu'il vaut `false` : le serveur traite l'absence comme
   * « demandé », pour ne rien changer aux appelants qui l'ignorent. Envoyer `true` serait inutile,
   * mais oublier d'envoyer `false` ferait tourner un volet que l'utilisateur a décoché.
   */
  it('transmet un volet refusé, et tait un volet accepté', () => {
    const refuse = analyser(
      buildGenerationStreamUrl({
        method: 'direct',
        urls: ['https://a.example/x'],
        extractInfos: false,
        extractProgram: true,
        detectServices: true,
      })
    ).searchParams

    expect(refuse.get('extractInfos')).toBe('false')
    expect(refuse.has('extractProgram')).toBe(false)
  })

  it('porte les bornes de l’édition quand elles sont connues', () => {
    const p = analyser(
      buildGenerationStreamUrl({
        method: 'direct',
        urls: ['https://a.example/x'],
        editionStartDate: '2026-08-01',
        editionEndDate: '2026-08-09',
        detectServices: true,
      })
    ).searchParams

    expect(p.get('editionStartDate')).toBe('2026-08-01')
    expect(p.get('editionEndDate')).toBe('2026-08-09')
  })

  /**
   * Chaque journée demandée coûte un appel au modèle. Une liste vide ne doit surtout pas être
   * transmise comme telle : côté serveur, l'absence vaut « toutes », et envoyer une liste vide
   * ferait relever zéro journée alors que l'utilisateur en attend neuf.
   */
  it('transmet les journées demandées, et tait une liste vide', () => {
    const avec = analyser(
      buildGenerationStreamUrl({
        method: 'direct',
        urls: ['https://a.example/x'],
        programDates: ['2026-08-01', '2026-08-03'],
        detectServices: true,
      })
    ).searchParams
    expect(avec.get('programDates')).toBe('2026-08-01,2026-08-03')

    const sansListe = analyser(
      buildGenerationStreamUrl({
        method: 'direct',
        urls: ['https://a.example/x'],
        programDates: [],
        detectServices: true,
      })
    ).searchParams
    expect(sansListe.has('programDates')).toBe(false)
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
    expect(sans.has('programUrl')).toBe(false)
    expect(sans.has('extractInfos')).toBe(false)
    expect(sans.has('editionStartDate')).toBe(false)
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
