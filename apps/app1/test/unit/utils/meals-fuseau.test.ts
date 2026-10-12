import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { formatMealDate, formatMealDisplay } from '../../../app/utils/meals'

/**
 * Le fuseau du LECTEUR ne doit pas déplacer la date d'un repas (constat F1 du carnet).
 *
 * Pourquoi un fichier à part, et pourquoi `process.env.TZ` : le défaut est **invisible** sur les
 * machines où ce dépôt se construit. L'hôte de développement est en `Europe/Paris` et les runners
 * de la CI en `UTC` — deux fuseaux à l'EST de Greenwich, où minuit UTC tombe le bon jour. C'est
 * précisément pour cela que le défaut a survécu à vingt-six tests qui formatent déjà des dates de
 * repas : aucun ne s'exécute là où il se manifeste.
 *
 * On déplace donc le fuseau du processus vers l'ouest. Node relit `process.env.TZ` à chaud, ce qui
 * rend le défaut reproductible ; l'écrire dans son propre fichier évite que ce déplacement ne
 * contamine les autres tests, Vitest isolant les fichiers dans des workers distincts.
 */
const FUSEAU_INITIAL = process.env.TZ

beforeAll(() => {
  process.env.TZ = 'America/New_York'
})

afterAll(() => {
  if (FUSEAU_INITIAL === undefined) delete process.env.TZ
  else process.env.TZ = FUSEAU_INITIAL
})

describe('repas — la date ne suit pas le fuseau du lecteur', () => {
  it("le fuseau déplacé est bien celui qui révèle le défaut (témoin de l'épreuve)", () => {
    // Témoin : sans ce contrôle, le fuseau pourrait ne pas avoir changé et les cas suivants
    // passeraient pour de bonnes raisons tout en ne prouvant rien.
    const brut = new Date('2026-08-01T00:00:00.000Z').toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
    })
    expect(brut).toContain('31')
    expect(brut).toContain('juillet')
  })

  // La forme que l'API envoie réellement : la colonne est une `@db.Date`, Prisma la rend en
  // `DateTime` à minuit UTC, et JSON la sérialise en instant.
  it("l'instant de minuit UTC garde son jour (formatMealDate)", () => {
    const libelle = formatMealDate('2026-08-01T00:00:00.000Z')
    expect(libelle).toContain('1')
    expect(libelle).toContain('août')
    expect(libelle).not.toContain('juillet')
  })

  it("l'instant de minuit UTC garde son jour (formatMealDisplay)", () => {
    const libelle = formatMealDisplay({
      id: 1,
      date: '2026-08-01T00:00:00.000Z',
      mealType: 'LUNCH',
    })
    expect(libelle).toContain('1')
    expect(libelle).not.toContain('31')
  })

  // L'autre forme en circulation : une journée nue, que les écrans de gestion manipulent.
  it('une journée nue garde son jour', () => {
    const libelle = formatMealDate('2026-08-01')
    expect(libelle).toContain('1')
    expect(libelle).toContain('août')
    expect(libelle).not.toContain('juillet')
  })

  it('un objet Date construit sur minuit UTC garde son jour', () => {
    const libelle = formatMealDate(new Date('2026-08-01T00:00:00.000Z'))
    expect(libelle).toContain('1')
    expect(libelle).toContain('août')
    expect(libelle).not.toContain('juillet')
  })

  it('le premier de janvier ne recule pas d’une année', () => {
    // Le cas où le décalage d'un jour change aussi le mois ET l'année — le plus visible pour un
    // lecteur, et celui qu'un `toContain` sur le seul jour laisserait passer.
    const libelle = formatMealDate('2027-01-01T00:00:00.000Z')
    expect(libelle).toContain('2027')
    expect(libelle).toContain('janvier')
    expect(libelle).not.toContain('2026')
    expect(libelle).not.toContain('décembre')
  })
})
