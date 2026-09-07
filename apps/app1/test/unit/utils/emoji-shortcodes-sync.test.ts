import { gitHubEmojis } from '@tiptap/extension-emoji'
import { describe, it, expect } from 'vitest'

import { construireTable } from '../../../scripts/generate-emoji-shortcodes.mjs'

import table from '../../../app/utils/emoji-shortcodes.json'

/**
 * L'éditeur propose les emojis de `gitHubEmojis` et les enregistre en raccourci ; le rendu les
 * relit dans `emoji-shortcodes.json`. Les deux doivent dire la même chose, sans quoi un emoji
 * choisi dans l'éditeur s'afficherait en `:raccourci:` chez le lecteur — c'est exactement le
 * défaut qu'a signalé un organisateur sur un appel à spectacles.
 *
 * Le fichier étant figé, une montée de version de Tiptap peut l'écarter de la table : ce test
 * est là pour le dire au lieu de laisser la dérive filer en production. En cas d'échec :
 * `npm run emoji:generate`.
 */
describe('table des raccourcis emoji', () => {
  it("reste synchronisée avec la table de l'éditeur", () => {
    expect(table).toEqual(construireTable(gitHubEmojis))
  })

  it('contient les raccourcis usuels, y compris ceux à ponctuation', () => {
    // `+1` et `-1` sortent du motif « lettres et tirets bas » : s'ils manquaient, la table
    // pourrait paraître complète tout en perdant une famille entière de raccourcis.
    expect((table as Record<string, string>).performing_arts).toBe('🎭')
    expect((table as Record<string, string>)['+1']).toBe('👍')
    expect((table as Record<string, string>)['-1']).toBe('👎')
  })

  it("écarte les emojis propres à GitHub, qui n'ont pas de caractère", () => {
    // `:octocat:` n'existe que sous forme d'image : le convertir n'aurait rien à écrire.
    expect(table).not.toHaveProperty('octocat')
  })
})
