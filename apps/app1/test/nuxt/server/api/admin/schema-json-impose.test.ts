import { describe, it, expect } from 'vitest'

import { importSchema } from '../../../../../server/api/admin/import-edition.post'
import {
  formatDeReponseJson,
  schemaJsonDepuisZod,
} from '../../../../../server/lib/schema-json-du-modele'

/**
 * Le schéma JSON imposé au modèle local, dérivé du VRAI schéma d'import.
 *
 * ⚠️ CE FICHIER EST AVANT TOUT UN TEST DE FUMÉE. `FORMAT_JSON_IMPOSE` est calculé au CHARGEMENT du
 * module de génération : si `z.toJSONSchema` butait sur quelque chose du schéma d'import — et il
 * contient une transformation, sur le fuseau —, le point d'API entier cesserait de se charger. Rien
 * dans les tests existants ne l'aurait dit.
 */
describe('le schéma JSON imposé au modèle', () => {
  const schema = schemaJsonDepuisZod(importSchema) as Record<string, any>

  it('se dérive du schéma d’import sans lever', () => {
    expect(schema.type).toBe('object')
    expect(Object.keys(schema.properties)).toContain('edition')
    expect(Object.keys(schema.properties)).toContain('convention')
  })

  it('décrit les champs que l’IA doit remplir', () => {
    const edition = schema.properties.edition
    // `anyOf`/`$ref` possibles selon la version de Zod : on cherche la forme où qu'elle soit.
    const texte = JSON.stringify(edition)
    for (const champ of ['startDate', 'endDate', 'city', 'country', 'timezone', 'imageUrl']) {
      expect(texte, `${champ} absent du schéma`).toContain(`"${champ}"`)
    }
  })

  it('⚠️ n’impose AUCUN champ obligatoire, sur tout le document', () => {
    /*
     * Le point délicat du lot. L'import EXIGE `city`, `postalCode`, `country`, les dates et
     * l'adresse courriel de la convention. Les transmettre comme obligatoires forcerait le modèle à
     * les INVENTER : un décodage contraint ne peut pas s'abstenir, il doit produire un jeton
     * valide. L'adresse courriel d'une convention est son moyen de revendication, et un cas
     * fabriqué a déjà atteint la production.
     */
    expect(JSON.stringify(schema)).not.toContain('"required"')
  })

  it('ne porte pas $schema, que LM Studio n’attend pas', () => {
    expect(schema).not.toHaveProperty('$schema')
  })

  it('s’emballe dans la forme que LM Studio documente', () => {
    const format = formatDeReponseJson(schema)
    expect(format).toMatchObject({
      type: 'json_schema',
      json_schema: { name: 'import_edition', strict: true },
    })
    // Et il est sérialisable : c'est ce qui partira dans le corps de la requête.
    expect(() => JSON.stringify(format)).not.toThrow()
  })

  it('reste d’une taille raisonnable', () => {
    /*
     * Un schéma énorme coûte deux fois : en jetons de requête, et en temps de construction de la
     * grammaire côté serveur. Le seuil n'est pas une science — il est là pour qu'un gonflement
     * involontaire se voie, par exemple si l'on y adjoignait l'énumération des fuseaux IANA.
     */
    expect(JSON.stringify(format(schema)).length).toBeLessThan(20000)
  })
})

function format(schema: Record<string, any>) {
  return formatDeReponseJson(schema)
}
