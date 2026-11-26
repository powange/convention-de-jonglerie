import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Les jobs de CI tournent sur une image de runner ÉPINGLÉE, la même partout.
 *
 * - Épinglée, et non `ubuntu-latest` : changer d'image change les bibliothèques système, et le job
 *   Playwright vérifie précisément que Chromium démarre SANS `--with-deps` sur celles qui sont là.
 *   Un changement d'image doit rester une décision, prise dans une PR qui le montre.
 * - La même partout : passée de 22.04 à 24.04 le 26/11/2026 (retrait annoncé des runners 22.04),
 *   en une fois. Une image laissée en arrière par oubli serait retirée sous nos pieds.
 */
const WORKFLOWS = resolve(process.cwd(), '..', '..', '.github', 'workflows')

describe('images de runner', () => {
  it('⚠️ chaque job déclare une image épinglée, et la même dans tous les workflows', async () => {
    const images = new Map<string, string[]>()
    for (const nom of (await readdir(WORKFLOWS)).filter((f) => /\.ya?ml$/.test(f))) {
      const src = await readFile(join(WORKFLOWS, nom), 'utf8')
      for (const m of src.matchAll(/^\s+runs-on:\s*(\S+)/gm)) {
        images.set(m[1]!, [...(images.get(m[1]!) ?? []), nom])
      }
    }
    expect(images.size, 'aucun runs-on trouvé : le balayage est cassé').toBeGreaterThan(0)
    expect([...images.keys()]).toEqual(['ubuntu-24.04'])
  })
})
