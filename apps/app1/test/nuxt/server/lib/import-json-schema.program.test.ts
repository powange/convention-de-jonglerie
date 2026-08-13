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
 * Ce que l'IA doit encore relever du programme : le **lien** vers une page dédiée, et le
 * programme **général** — vie commune, tarifs, accès. Le déroulé horaire, lui, ne passe plus par
 * ces formats : il est extrait journée par journée sous forme d'éléments datés.
 *
 * Ces attentes ne vivent que dans le contrat de champs et les consignes envoyées au modèle : rien
 * dans le code ne les fait respecter. Si un champ disparaît d'un des formats — il y en a trois,
 * complet, compact et pré-rempli — l'IA cesse silencieusement de le renvoyer, sans que rien
 * n'échoue. D'où ces vérifications.
 */
describe('contrat de champs soumis à l’IA : programme', () => {
  it('cite le programme et son lien dans la liste des champs optionnels', () => {
    expect(OPTIONAL_FIELDS).toMatch(/program \(/)
    expect(OPTIONAL_FIELDS).toMatch(/programUrl/)
  })

  /**
   * Certaines conventions tiennent leur programme sur leur propre site et n'ont pas vocation à le
   * recopier. Le lien se cumule avec le programme général plutôt que de le remplacer.
   */
  it('expose le lien externe dans les trois formats', () => {
    expect(JSON.parse(generateJsonExample()).edition).toHaveProperty('programUrl')
    expect(JSON.parse(generateCompactJsonFormat()).edition).toHaveProperty('programUrl')
    expect(JSON_FORMAT_FOR_COMPLETION).toMatch(/programUrl/)
  })

  it('expose le programme général dans les trois formats', () => {
    expect(JSON.parse(generateJsonExample()).edition).toHaveProperty('program')
    expect(JSON.parse(generateCompactJsonFormat()).edition).toHaveProperty('program')
    expect(JSON_FORMAT_FOR_COMPLETION).toMatch(/"program"/)
  })

  /**
   * Le champ général doit dire ce qu'il ne reçoit **pas**.
   *
   * Sans cette borne, le modèle y déversait le déroulé horaire de la convention — un pavé que
   * plus rien n'affiche, et qui remplaçait la description utile.
   */
  it('écarte le déroulé horaire du champ général', () => {
    expect(IMPORT_SCHEMA_FIELDS.edition.program.description).toMatch(/déroulé horaire/)
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
