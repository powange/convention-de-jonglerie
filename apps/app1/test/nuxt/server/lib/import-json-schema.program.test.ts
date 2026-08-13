import { describe, it, expect } from 'vitest'

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
 * Ce que l'IA doit encore relever du programme : le **lien** vers la page qui le décrit, et rien
 * d'autre. Le programme lui-même ne passe plus par ces formats — il est extrait de cette page,
 * journée par journée, sous forme d'éléments datés.
 *
 * Ces attentes ne vivent que dans le contrat de champs et les consignes envoyées au modèle : rien
 * dans le code ne les fait respecter. Si un champ disparaît d'un des formats — il y en a trois,
 * complet, compact et pré-rempli — l'IA cesse silencieusement de le renvoyer, sans que rien
 * n'échoue. D'où ces vérifications.
 */
describe('contrat de champs soumis à l’IA : programme', () => {
  it('cite le lien du programme dans la liste des champs optionnels', () => {
    expect(OPTIONAL_FIELDS).toMatch(/programUrl/)
  })

  /**
   * Certaines conventions tiennent leur programme sur leur propre site. C'est cette page que la
   * passe dédiée relira, journée par journée.
   */
  it('expose le lien externe dans les trois formats', () => {
    expect(JSON.parse(generateJsonExample()).edition).toHaveProperty('programUrl')
    expect(JSON.parse(generateCompactJsonFormat()).edition).toHaveProperty('programUrl')
    expect(JSON_FORMAT_FOR_COMPLETION).toMatch(/programUrl/)
  })

  /**
   * Le champ de programme général a été retiré : plus rien ne l'affiche depuis que la frise porte
   * le déroulé. Le laisser demander coûtait des jetons pour un texte que personne ne lirait.
   */
  it('ne demande plus de programme général', () => {
    // Lu via un indexeur : le champ ayant disparu du type, l'écrire en clair ne compilerait plus
    // — ce qui prouve la suppression, mais casserait le typecheck avant de pouvoir la constater.
    expect((IMPORT_SCHEMA_FIELDS.edition as Record<string, unknown>).program).toBeUndefined()
    expect(JSON.parse(generateJsonExample()).edition).not.toHaveProperty('program')
    expect(JSON.parse(generateCompactJsonFormat()).edition).not.toHaveProperty('program')
    expect(JSON_FORMAT_FOR_COMPLETION).not.toMatch(/"program"/)
  })

  /**
   * Les quatre prompts, dont celui de complétion pré-remplie — le plus utilisé, puisqu'il sert dès
   * qu'un lien Facebook est présent, et qui n'hérite pas des fichiers de règles.
   */
  it.each([
    ['agent complet', generateAgentSystemPrompt],
    ['agent compact', generateCompactAgentSystemPrompt],
    ['extraction directe compacte', generateCompactDirectPrompt],
    ['complétion pré-remplie', getPrefilledJsonPrompt],
  ])('cite le lien du programme dans le prompt %s', (_nom, construire) => {
    expect(construire()).toMatch(/programUrl/)
  })

  /**
   * Le déroulé jour par jour a été retiré de ces formats : le laisser demander coûtait des jetons
   * à chaque analyse et détournait le modèle de ce qu'on attend vraiment de lui.
   */
  it.each([
    ['exemple complet', generateJsonExample],
    ['format compact', generateCompactJsonFormat],
    ['agent complet', generateAgentSystemPrompt],
    ['agent compact', generateCompactAgentSystemPrompt],
    ['extraction directe compacte', generateCompactDirectPrompt],
    ['complétion pré-remplie', getPrefilledJsonPrompt],
  ])('ne demande plus de déroulé par journée dans %s', (_nom, construire) => {
    expect(construire()).not.toMatch(/programDays/)
  })
})
