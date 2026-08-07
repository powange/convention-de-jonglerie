import { describe, it, expect } from 'vitest'

import { importSchema } from '../../../../server/api/admin/import-edition.post'
import {
  IMPORT_SCHEMA_FIELDS,
  JSON_FORMAT_FOR_COMPLETION,
  OPTIONAL_FIELDS,
  generateAgentSystemPrompt,
  generateCompactAgentSystemPrompt,
  generateCompactDirectPrompt,
  generateCompactJsonFormat,
  generateJsonExample,
  getPrefilledJsonPrompt,
} from '../../../../server/lib/import-json-schema'

/**
 * Le programme d'une convention se lit jour par jour. L'IA doit donc remplir `programDays` dès
 * que la source détaille le déroulé, et ne réserver `program` qu'à ce qui n'a pas de date.
 *
 * Cette préférence ne vit que dans le contrat de champs et les consignes envoyées au modèle : rien
 * dans le code ne la fait respecter. Si un champ disparaît d'un des formats — il y en a trois,
 * complet, compact et pré-rempli — l'IA cesse silencieusement de renvoyer les journées, sans que
 * rien n'échoue. D'où ces vérifications.
 */
describe('contrat de champs soumis à l’IA : programme', () => {
  it('décrit les deux champs, en indiquant lequel privilégier', () => {
    const jours = IMPORT_SCHEMA_FIELDS.edition.programDays
    const general = IMPORT_SCHEMA_FIELDS.edition.program

    expect(jours.description).toMatch(/PRIVILÉGIER/)
    expect(general.description).toMatch(/programDays/)
  })

  it('cite le programme par jour dans la liste des champs optionnels', () => {
    expect(OPTIONAL_FIELDS).toMatch(/programDays/)
    expect(OPTIONAL_FIELDS).toMatch(/program \(/)
    expect(OPTIONAL_FIELDS).toMatch(/programUrl/)
  })

  /**
   * Certaines conventions tiennent leur programme sur leur propre site et n'ont pas vocation à le
   * recopier. Le lien se cumule avec les deux autres champs plutôt que de les remplacer.
   */
  it('expose le lien externe dans les trois formats', () => {
    expect(JSON.parse(generateJsonExample()).edition).toHaveProperty('programUrl')
    expect(JSON.parse(generateCompactJsonFormat()).edition).toHaveProperty('programUrl')
    expect(JSON_FORMAT_FOR_COMPLETION).toMatch(/programUrl/)
  })

  it('expose les deux champs dans le format complet, avec un exemple de journée', () => {
    const exemple = JSON.parse(generateJsonExample())

    expect(Array.isArray(exemple.edition.programDays)).toBe(true)
    expect(exemple.edition.programDays[0]).toHaveProperty('date')
    expect(exemple.edition.programDays[0]).toHaveProperty('content')
    expect(exemple.edition.programDays[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(exemple.edition).toHaveProperty('program')
  })

  // Les modèles à contexte réduit reçoivent ce format-là et pas l'autre : l'oublier reviendrait à
  // désactiver la fonctionnalité pour eux seuls, sans que rien ne le signale.
  it('expose les deux champs dans le format compact', () => {
    const compact = JSON.parse(generateCompactJsonFormat())

    expect(Array.isArray(compact.edition.programDays)).toBe(true)
    expect(compact.edition.programDays[0]).toHaveProperty('date')
    expect(compact.edition).toHaveProperty('program')
  })

  it('expose les deux champs dans le format de complétion pré-rempli', () => {
    expect(JSON_FORMAT_FOR_COMPLETION).toMatch(/programDays/)
    expect(JSON_FORMAT_FOR_COMPLETION).toMatch(/PRIVILÉGIER/)
    expect(JSON_FORMAT_FOR_COMPLETION).toMatch(/"program"/)
  })

  /**
   * Le maillon décisif : la règle vit dans un fichier `.txt` assemblé par `loadPrompt`. Décrire
   * les champs ne suffit pas — sans la consigne, rien ne dit au modèle lequel préférer, et le
   * défaut naturel serait de tout verser dans le champ général.
   */
  it.each([
    ['agent complet', generateAgentSystemPrompt],
    ['agent compact', generateCompactAgentSystemPrompt],
    ['extraction directe compacte', generateCompactDirectPrompt],
  ])('porte la consigne de préférence dans le prompt %s', (_nom, construire) => {
    const prompt = construire()

    expect(prompt).toMatch(/programDays/)
    expect(prompt).toMatch(/PLUTÔT QUE program/)
    expect(prompt).toMatch(/programUrl/)
  })

  /**
   * Le quatrième prompt, oublié d'abord — et c'est le plus utilisé : il sert dès qu'un lien
   * Facebook est présent. Il n'hérite pas des fichiers de règles, seulement du format JSON ; ses
   * consignes lui sont propres. Décrire le champ dans le format ne suffisait pas : la liste des
   * champs prioritaires orientait le modèle ailleurs, et aucune journée n'était extraite d'une
   * source qui en publiait pourtant neuf.
   */
  it('porte la consigne dans le prompt de complétion pré-remplie', () => {
    const prompt = getPrefilledJsonPrompt()

    expect(prompt).toMatch(/programDays/)
    expect(prompt).toMatch(/programUrl/)
    expect(prompt).toMatch(/JOUR PAR JOUR/)
    expect(prompt).toMatch(/privilégie programDays/)
  })
})

describe('importSchema : programme par journée', () => {
  const base = () => ({
    convention: { name: 'Convention Test', email: 'contact@test.org' },
    edition: {
      startDate: '2025-07-15',
      endDate: '2025-07-20',
      addressLine1: '1 rue du Cirque',
      city: 'Paris',
      country: 'France',
      postalCode: '75001',
    },
  })

  it('accepte une liste de journées', () => {
    const payload = base()
    ;(payload.edition as Record<string, unknown>).programDays = [
      { date: '2025-07-15', content: 'Accueil' },
      { date: '2025-07-16', content: 'Ateliers' },
    ]
    expect(importSchema.safeParse(payload).success).toBe(true)
  })

  it('accepte un import sans aucune journée', () => {
    expect(importSchema.safeParse(base()).success).toBe(true)
  })

  it('refuse une date qui n’est pas au format AAAA-MM-JJ', () => {
    const payload = base()
    ;(payload.edition as Record<string, unknown>).programDays = [
      { date: '15/07/2025', content: 'Accueil' },
    ]
    expect(importSchema.safeParse(payload).success).toBe(false)
  })

  // Une année erronée dans la source pourrait engendrer des centaines de journées.
  it('refuse une liste déraisonnablement longue', () => {
    const payload = base()
    ;(payload.edition as Record<string, unknown>).programDays = Array.from(
      { length: 61 },
      (_, i) => ({ date: `2025-07-${String((i % 28) + 1).padStart(2, '0')}`, content: 'x' })
    )
    expect(importSchema.safeParse(payload).success).toBe(false)
  })
})
