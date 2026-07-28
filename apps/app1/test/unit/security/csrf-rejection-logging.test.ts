import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

/**
 * Les scanners sondent en permanence des chemins inexistants (/api/graphql, /api/wp-admin…).
 * En POST, ils sont arrêtés par le middleware CSRF avant la résolution de route et repartent
 * avec une 403 — qui remplissait le journal des erreurs API pour rien.
 *
 * Ces rejets sont donc marqués `data.csrfRejection` et ignorés par le journal.
 *
 * Ce test verrouille les deux moitiés du contrat, car se tromper de moitié coûte cher :
 * filtrer sur le code 403 ferait disparaître les refus de permission — précisément ceux qui
 * révèlent les bugs de droits.
 */

const read = (relative: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../../', relative), 'utf8')

const csrf = read('server/utils/csrf.ts')
const logger = read('server/plugins/error-logging.ts')

describe('journalisation des rejets CSRF', () => {
  it('marque chaque erreur CSRF pour que le journal puisse la reconnaître', () => {
    // Les deux cas de rejet : jeton absent, et jetons qui ne correspondent pas.
    const thrown = csrf.match(/throw createError\(\{[\s\S]*?\}\)/g) ?? []
    expect(thrown.length, 'les deux rejets CSRF attendus sont introuvables').toBe(2)

    for (const block of thrown) {
      expect(block, `rejet CSRF sans marqueur : ${block}`).toContain('csrfRejection: true')
    }
  })

  it('ignore les erreurs marquées, et elles seules', () => {
    expect(logger).toContain('csrfRejection')
  })

  it('ne filtre jamais sur le code 403, qui porte aussi les refus de permission', () => {
    // Un `statusCode === 403` suivi d'un `return` ferait disparaître « Droits insuffisants »,
    // « Accès refusé » et les autres refus applicatifs du journal.
    const filtreSurLeCode = /statusCode\s*===\s*403[^\n]*\n?\s*(return|\{)/
    expect(
      filtreSurLeCode.test(logger),
      'le journal filtre sur le code 403 : les refus de permission seraient perdus'
    ).toBe(false)
  })
})
