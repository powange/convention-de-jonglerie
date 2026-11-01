import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import { analyserListeJugglingEdge } from '../../../server/utils/jugglingedge-scraper'

/**
 * L'analyse de l'agenda JugglingEdge — la pièce qui manquait pour la veille des conventions.
 *
 * Le dépôt savait déjà lire UN événement (`scrapeJugglingEdgeEvent`, géocodage compris) mais pas en
 * découvrir : c'est ce que `analyserListeJugglingEdge` apporte.
 *
 * ## ⚠️ Pourquoi un HTML FIGÉ et non le site
 *
 * Un test qui irait chercher `events.php` échouerait les jours où le site est lent, et **passerait
 * les jours où il a changé de gabarit sans qu'on le voie** — l'inverse de ce qu'on attend d'un
 * test d'analyse. La fixture est la page réelle du 1er novembre 2026, 45 lignes, douze pays.
 *
 * Le jour où le gabarit changera, c'est ce fichier qu'il faudra re-télécharger : les cas ci-dessous
 * tomberont alors en disant quoi, au lieu de rendre une liste vide en silence.
 */
const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/jugglingedge-events.html'
)
const html = readFileSync(FIXTURE, 'utf8')

describe('analyserListeJugglingEdge', () => {
  const candidats = analyserListeJugglingEdge(html)

  it('le témoin : les quarante-cinq lignes de l’agenda sont LUES', () => {
    /*
     * Sans ce cas, tous les suivants seraient verts sur une liste vide — le défaut classique d'un
     * analyseur dont une ancre a glissé. Le compte est exact parce que la fixture est figée : un
     * gabarit qui change le fera tomber, ce qui est précisément le but.
     */
    expect(candidats).toHaveLength(45)
  })

  it('⚠️ toutes les URL sont CANONIQUES, aucune sur le sous-domaine `fr.`', () => {
    /*
     * LE point qui compte. Les liens de la page sont relatifs (`/event.php?EventID=…`) : les
     * résoudre donnerait `fr.jugglingedge.com`, soit une SECONDE URL pour le même événement. Or le
     * refus d'un administrateur s'y attache — deux URL feraient réapparaître ce qu'il a écarté — et
     * `isJugglingEdgeEventUrl` ne reconnaît pas ce sous-domaine. L'URL vient donc du JSON-LD.
     */
    const hotes = [...new Set(candidats.map((c) => new URL(c.url).hostname))]
    expect(hotes).toEqual(['jugglingedge.com'])
  })

  it('lit le titre, la date, la durée, le pays et l’adresse d’une ligne', () => {
    const premier = candidats.find((c) => c.identifiantSource === '6542')

    expect(premier).toMatchObject({
      url: 'https://jugglingedge.com/event.php?EventID=6542',
      titre: 'HerfstJongleerWeekend 2026',
      debut: '2026-10-30',
      jours: 3,
      pays: 'Pays-Bas',
    })
    expect(premier?.adresse).toContain('Enschede')
  })

  it('⚠️ décode les entités des adresses, qui arrivent encodées du JSON-LD', () => {
    /*
     * Mesuré : le JSON-LD de l'agenda rend `Th&uuml;ringer H&uuml;tte` et
     * `Schlierseestra&szlig;e`. L'ancien décodeur ne traitait que cinq entités nommées, si bien que
     * tous les accents allemands, nordiques et portugais d'un agenda couvrant douze pays
     * restaient écrits `&uuml;`. Ce cas-ci l'éprouve sur de vraies données.
     */
    const allemand = candidats.find((c) => c.identifiantSource === '6563')

    expect(allemand?.lieu).toBe('Bildungszentrum Thüringer Hütte')
    expect(allemand?.adresse).toContain('Rhön')
    // Et aucun candidat ne garde d'entité non décodée dans ses textes.
    const restantes = candidats.filter((c) =>
      /&[a-zA-Z]+;|&#\d+;/.test(`${c.titre} ${c.lieu ?? ''} ${c.adresse ?? ''}`)
    )
    expect(restantes.map((c) => c.titre)).toEqual([])
  })

  it('📍 rend la durée en jours, l’indice que le tri exploitera', () => {
    /*
     * La durée est le signe le moins coûteux pour distinguer une convention d'une soirée de club.
     * Elle ne TRANCHE pas — l'agenda contient un événement de 36 jours, qui n'est probablement pas
     * une convention — mais elle doit être lue, sans quoi le tri n'a rien à exploiter.
     */
    const durees = candidats.map((c) => c.jours)

    expect(durees.every((j) => typeof j === 'number' && j > 0)).toBe(true)
    expect(Math.min(...(durees as number[]))).toBe(1)
    expect(Math.max(...(durees as number[]))).toBe(36)
  })

  it('📍 rend le pays TEL QUE la source l’écrit, sans normaliser', () => {
    /*
     * Douze pays, en français parce qu'on lit le sous-domaine `fr.` — y compris la bizarrerie
     * « le Portugal ». Normaliser ici reviendrait à décider trop tôt et à perdre ce que la source a
     * dit ; c'est l'affichage qui s'en charge. Le cas fixe cette intention.
     */
    const pays = [...new Set(candidats.map((c) => c.pays))].sort()

    expect(pays).toHaveLength(12)
    expect(pays).toContain('Allemagne')
    expect(pays).toContain('le Portugal')
  })

  describe('face à une page qui ne ressemble plus à ce qu’on attend', () => {
    it('écarte une ligne sans JSON-LD plutôt que de l’inventer', () => {
      const sansBloc =
        '<tr id="EventRow1"><td><a href="/event.php?EventID=1">Sans JSON-LD</a></td></tr>'

      expect(analyserListeJugglingEdge(sansBloc)).toEqual([])
    })

    it('écarte une ligne dont le JSON-LD est illisible', () => {
      const casse =
        '<tr id="EventRow2"><script type="application/ld+json">{ pas du json </script></tr>'

      expect(analyserListeJugglingEdge(casse)).toEqual([])
    })

    it('écarte une ligne dont le JSON-LD n’a pas d’URL — sans clé, rien n’est dédoublonnable', () => {
      const sansUrl =
        '<tr id="EventRow3"><script type="application/ld+json">{"name":"Anonyme"}</script></tr>'

      expect(analyserListeJugglingEdge(sansUrl)).toEqual([])
    })

    it('rend une liste vide sur une page vide ou étrangère, sans lever', () => {
      expect(analyserListeJugglingEdge('')).toEqual([])
      expect(analyserListeJugglingEdge('<html><body>rien à voir</body></html>')).toEqual([])
    })
  })
})
