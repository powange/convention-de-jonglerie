import { describe, it, expect } from 'vitest'
import { z } from 'zod'

import {
  formatDeReponseJson,
  sansChampsObligatoires,
  schemaJsonDepuisZod,
} from '../../../server/lib/schema-json-du-modele'

describe('sansChampsObligatoires', () => {
  it('retire les champs obligatoires, à tous les niveaux', () => {
    const avant = {
      type: 'object',
      required: ['a'],
      properties: {
        a: { type: 'string' },
        nested: { type: 'object', required: ['b'], properties: { b: { type: 'string' } } },
      },
    }
    const apres = sansChampsObligatoires(avant)
    expect(JSON.stringify(apres)).not.toContain('required')
    // Le reste est intact : on retire une contrainte, on ne réécrit pas la forme.
    expect((apres as any).properties.nested.properties.b).toEqual({ type: 'string' })
  })

  it('descend dans les combinateurs et les tableaux', () => {
    // Un champ obligatoire niché dans un `anyOf` contraindrait tout autant.
    const avant = {
      anyOf: [{ type: 'object', required: ['x'], properties: { x: { type: 'number' } } }],
      items: { type: 'object', required: ['y'] },
    }
    expect(JSON.stringify(sansChampsObligatoires(avant))).not.toContain('required')
  })

  it('ne modifie pas l’original', () => {
    const avant = { type: 'object', required: ['a'] }
    sansChampsObligatoires(avant)
    expect(avant.required).toEqual(['a'])
  })

  it('laisse passer les valeurs qui ne sont pas des objets', () => {
    expect(sansChampsObligatoires(null)).toBeNull()
    expect(sansChampsObligatoires('required')).toBe('required')
    expect(sansChampsObligatoires(3)).toBe(3)
  })
})

describe('schemaJsonDepuisZod', () => {
  const schemaZod = z.object({
    convention: z.object({ name: z.string().min(1), email: z.string().email() }),
    edition: z.object({
      city: z.string().min(1),
      name: z.string().nullable().optional(),
      timezone: z
        .string()
        .nullable()
        .optional()
        .transform((v) => v ?? null),
      hasFoodTrucks: z.boolean().optional(),
    }),
  })

  it('décrit les noms et les types des champs', () => {
    const schema = schemaJsonDepuisZod(schemaZod) as any
    expect(schema.type).toBe('object')
    expect(schema.properties.edition.properties.city).toMatchObject({ type: 'string' })
    expect(schema.properties.edition.properties.hasFoodTrucks).toEqual({ type: 'boolean' })
    /*
     * `minLength` est un bonus conservé volontairement : le champ reste facultatif, mais s'il est
     * émis il ne peut pas être vide. C'est exactement ce qu'on veut d'un décodage contraint — ne
     * pas forcer la présence, mais interdire la chaîne vide quand le modèle se prononce.
     */
    expect(schema.properties.edition.properties.city.minLength).toBe(1)
  })

  it('⚠️ n’impose AUCUN champ obligatoire', () => {
    /*
     * Le point délicat. `city` et `email` sont obligatoires à l'import, mais les transmettre au
     * modèle le forcerait à INVENTER ce que le site ne dit pas : un décodage contraint ne peut pas
     * s'abstenir. L'adresse courriel d'une convention est son moyen de revendication, et un cas
     * fabriqué a déjà atteint la production.
     */
    expect(JSON.stringify(schemaJsonDepuisZod(schemaZod))).not.toContain('required')
  })

  it('décrit ce que le modèle doit PRODUIRE, transformation non appliquée', () => {
    // `io: 'input'` : le fuseau est normalisé à l'entrée ; décrire la sortie annoncerait au modèle
    // une forme qu'il n'a pas à fournir.
    const schema = schemaJsonDepuisZod(schemaZod) as any
    expect(schema.properties.edition.properties.timezone).toBeDefined()
  })

  it('retire $schema : LM Studio attend le schéma, pas un document autonome', () => {
    expect(schemaJsonDepuisZod(schemaZod)).not.toHaveProperty('$schema')
  })
})

describe('formatDeReponseJson', () => {
  it('a la forme que LM Studio documente', () => {
    const format = formatDeReponseJson({ type: 'object' })
    expect(format.type).toBe('json_schema')
    expect(format.json_schema.name).toBe('import_edition')
    expect(format.json_schema.schema).toEqual({ type: 'object' })
  })
})
