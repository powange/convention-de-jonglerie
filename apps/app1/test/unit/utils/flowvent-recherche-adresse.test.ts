import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/*
 * ⚠️ Lu COMME DU TEXTE puis transpilé, et non importé : un fichier TypeScript d'app2 ne se
 * transforme qu'avec le tsconfig que Nuxt génère dans `apps/app2/.nuxt`, absent de la CI d'app1.
 */
const APP2 = resolve(__dirname, '../../../../app2')
const { outputText } = ts.transpileModule(
  readFileSync(resolve(APP2, 'server/utils/geocodage.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
)
const g: Record<string, any> = {}
new Function('exports', outputText)(g)

/**
 * La recherche d'adresse du formulaire de l'événement de Flowvent : un résultat Nominatim ramené
 * aux champs du formulaire (`versAdresseTrouvee`, apps/app2/server/utils/geocodage.ts).
 */
describe('Flowvent — recherche d’adresse', () => {
  it('remplit adresse, ville, pays et coordonnées depuis une adresse de rue', () => {
    expect(
      g.versAdresseTrouvee({
        display_name: '12, Rue des Lilas, Croix-Rousse, Lyon, 69004, France',
        name: '',
        lat: '45.7745',
        lon: '4.8320',
        address: {
          house_number: '12',
          road: 'Rue des Lilas',
          suburb: 'Croix-Rousse',
          city: 'Lyon',
          postcode: '69004',
          country: 'France',
        },
      })
    ).toEqual({
      libelle: '12 Rue des Lilas, 69004 Lyon, France',
      nomDuLieu: '',
      addressLine1: '12 Rue des Lilas',
      postalCode: '69004',
      city: 'Lyon',
      country: 'France',
      latitude: 45.7745,
      longitude: 4.832,
    })
  })

  it('reprend le nom d’un lieu nommé, et la commune d’un village', () => {
    const a = g.versAdresseTrouvee({
      display_name: 'Gymnase Jean Moulin, Avenue du Stade, Saint-Genis, 01630, France',
      name: 'Gymnase Jean Moulin',
      lat: '46.2',
      lon: '6.0',
      address: {
        road: 'Avenue du Stade',
        village: 'Saint-Genis',
        postcode: '01630',
        country: 'France',
      },
    })
    expect(a.nomDuLieu).toBe('Gymnase Jean Moulin')
    expect(a.addressLine1).toBe('Avenue du Stade')
    expect(a.city).toBe('Saint-Genis')
    expect(a.libelle).toBe('Gymnase Jean Moulin, Avenue du Stade, 01630 Saint-Genis, France')
  })

  it('ne prend pas le nom de la rue pour le nom d’un lieu', () => {
    const a = g.versAdresseTrouvee({
      display_name: 'Rue des Lilas, Lyon, France',
      name: 'Rue des Lilas',
      lat: '45',
      lon: '4',
      address: { road: 'Rue des Lilas', city: 'Lyon', country: 'France' },
    })
    expect(a.nomDuLieu).toBe('')
  })

  it('écarte un résultat sans coordonnées', () => {
    expect(g.versAdresseTrouvee({ display_name: 'Quelque part', address: {} })).toBeNull()
  })
})
