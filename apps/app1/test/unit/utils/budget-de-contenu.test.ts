import { describe, it, expect } from 'vitest'

import {
  budgetDeContenu,
  CARACTERES_PAR_JETON,
  RESERVE_PROMPT_SYSTEME,
} from '../../../server/utils/budget-de-contenu'

describe('budgetDeContenu', () => {
  it('⚠️ le cas réel qui a fait échouer un import', () => {
    /*
     * Contexte chargé à 8192, réponse budgétée à 4096. LM Studio refusait :
     *   request (8437 tokens) exceeds the available context size (8192 tokens)
     *
     * L'ancien calcul accordait 16 060 caractères. Le nouveau doit tenir dans la place qui reste
     * une fois la réponse et le prompt système déduits.
     */
    const { caracteres, jetonsDisponibles } = budgetDeContenu(8192, 4096)

    expect(jetonsDisponibles).toBeLessThanOrEqual(8192 - 4096 - RESERVE_PROMPT_SYSTEME)
    expect(caracteres).toBeLessThan(16060)
    // Et surtout : le contenu, converti en jetons, doit tenir dans le contexte avec la réponse.
    const jetonsDuContenu = caracteres / CARACTERES_PAR_JETON
    expect(jetonsDuContenu + 4096 + RESERVE_PROMPT_SYSTEME).toBeLessThanOrEqual(8192)
  })

  it('déduit la RÉPONSE, que l’ancien calcul ignorait', () => {
    // À contexte égal, demander une réponse plus longue laisse moins de place au contenu.
    const court = budgetDeContenu(32768, 1024).caracteres
    const long = budgetDeContenu(32768, 8192).caracteres
    expect(long).toBeLessThan(court)
    expect(court - long).toBeGreaterThan(0)
  })

  it('profite d’un grand contexte, jusqu’au plafond', () => {
    // C'est le gain attendu si l'on relève le contexte dans LM Studio.
    expect(budgetDeContenu(32768, 4096).caracteres).toBeGreaterThan(
      budgetDeContenu(8192, 4096).caracteres * 5
    )
    // Au-delà, le plafond borne : on paierait du temps de traitement pour rien.
    expect(budgetDeContenu(262144, 4096).caracteres).toBe(50000)
  })

  it('ne rend jamais une valeur négative ni nulle', () => {
    /*
     * Un contexte plus petit que la réponse demandée est une configuration absurde mais possible —
     * `max_tokens` est réglable depuis /admin/ai-config. Rendre un nombre négatif ferait un
     * `substring` vide, donc une extraction muette sans erreur.
     */
    for (const [ctx, reponse] of [
      [4096, 4096],
      [2048, 8192],
      [0, 4096],
    ]) {
      const { caracteres } = budgetDeContenu(ctx, reponse)
      expect(caracteres).toBeGreaterThan(0)
      expect(Number.isFinite(caracteres)).toBe(true)
    }
  })

  it('le rapport caractères/jeton est PESSIMISTE', () => {
    // Mesuré à ~1,5 sur du contenu scrapé ; les 4 d'avant accordaient près de trois fois la place.
    expect(CARACTERES_PAR_JETON).toBeLessThan(4)
    expect(CARACTERES_PAR_JETON).toBeGreaterThanOrEqual(1.5)
  })
})
