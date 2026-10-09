import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

import {
  CLES_SERVICES_EDITION,
  servicesDepuisEdition,
  servicesPourEcriture,
} from '../../../shared/utils/services-d-edition'

/**
 * Garde-fou contre la dérive des services d'édition.
 *
 * La même énumération était écrite à cinq endroits, et deux avaient déjà divergé : le formulaire
 * de création/édition et la destructuration du handler de création en portaient 23 au lieu de 26.
 * `hasUnicycleSpace`, `hasLongShow` et `hasATM` étaient donc proposés comme FILTRES sur l'accueil
 * et modifiables depuis la page Services de la gestion, mais absents du formulaire — et perdus par
 * le serveur même s'ils étaient envoyés à la main.
 *
 * `shared/utils/services-d-edition` est désormais la source unique. Ce test la compare au schéma
 * Prisma : c'est lui qui ferme la boucle, car une liste partagée ne fait que déplacer l'oubli
 * d'un endroit à cinq vers un endroit à un. Ajouter une colonne sans l'ajouter à la liste fait
 * tomber un test, au lieu de faire disparaître un service en silence.
 *
 * 📍 Même dispositif que `test/unit/guide/permissions-sync.test.ts` pour les droits
 * d'organisateur — le précédent dont ce lot est l'application aux services.
 */

const schemaPath = path.resolve(__dirname, '../../../prisma/schema/schema.prisma')
const schema = fs.readFileSync(schemaPath, 'utf8')

/**
 * Les surfaces qui dérivent de la liste. Chacune l'énumérait à la main : un service absent de
 * l'une d'elles se filtre sur l'accueil, se coche dans la page Services, et reste invisible —
 * ou non enregistré — ailleurs.
 */
const SURFACES = [
  '../../../app/components/edition/Form.vue',
  '../../../server/api/editions/index.post.ts',
  '../../../app/utils/convention-services.ts',
  '../../../server/utils/validation-schemas.ts',
].map((relative) => ({
  nom: relative.split('/').pop()!,
  contenu: fs.readFileSync(path.resolve(__dirname, relative), 'utf8'),
}))

/** Les colonnes booléennes de service déclarées par un modèle Prisma. */
function colonnesDeService(modele: string): string[] {
  const bloc = schema.match(new RegExp(`model ${modele}\\s*\\{([\\s\\S]*?)\\n\\}`))
  if (!bloc) throw new Error(`Modèle Prisma introuvable : ${modele}`)

  return [...bloc[1]!.matchAll(/^\s*(has[A-Za-z]+|acceptsPets)\s+Boolean/gm)].map((m) => m[1]!)
}

describe('services d’édition — la source unique suit le schéma Prisma', () => {
  it('couvre exactement les colonnes booléennes de service du modèle Edition', () => {
    const attendues = colonnesDeService('Edition')

    // Le test qui compte : une ÉGALITÉ, pas une inclusion. Une inclusion laisserait passer
    // l'oubli, qui est précisément le défaut qu'on corrige.
    expect([...CLES_SERVICES_EDITION].sort()).toEqual([...attendues].sort())
  })

  it('la liste extraite du schéma n’est pas vide', () => {
    // La garde de la garde : une regex qui ne mord plus rendrait un tableau vide, et deux
    // tableaux vides sont égaux — le test ci-dessus passerait au vert en ne vérifiant rien.
    expect(colonnesDeService('Edition').length).toBeGreaterThanOrEqual(26)
  })

  it('aucune surface n’énumère plus les services à la main', () => {
    /*
     * On compte les occurrences littérales des trois services qui avaient disparu. Avant ce lot,
     * `Form.vue` et `index.post.ts` n'en portaient aucune ; maintenant ils ne doivent plus porter
     * d'énumération du tout, puisqu'ils dérivent de la liste.
     *
     * ⚠️ `convention-services.ts` et `validation-schemas.ts` restent exemptés : le premier décrit
     * chaque service (icône, catégorie, clé i18n), le second lui associe un schéma zod. Ils
     * nomment donc légitimement les clés — mais ils les TIRENT de la liste, ce que les deux
     * premières assertions vérifient par ailleurs.
     */
    const aEnumerer = ['Form.vue', 'index.post.ts']
    for (const { nom, contenu } of SURFACES) {
      if (!aEnumerer.includes(nom)) continue
      for (const cle of ['hasUnicycleSpace', 'hasLongShow', 'hasATM', 'hasGym']) {
        expect(contenu, `${nom} énumère encore ${cle} à la main`).not.toContain(`${cle}:`)
      }
    }
  })
})

describe('servicesDepuisEdition', () => {
  it('rend les 26 clés, toutes fausses, sans source', () => {
    const services = servicesDepuisEdition()

    expect(Object.keys(services).sort()).toEqual([...CLES_SERVICES_EDITION].sort())
    expect(Object.values(services).every((v) => v === false)).toBe(true)
  })

  it('reporte ce que l’édition porte, et seulement cela', () => {
    const services = servicesDepuisEdition({ hasGym: true, hasATM: true })

    expect(services.hasGym).toBe(true)
    expect(services.hasATM).toBe(true)
    expect(services.hasUnicycleSpace).toBe(false)
  })

  it('ne laisse jamais passer undefined dans l’état', () => {
    /*
     * ⚠️ Le défaut que ce repli évite : `props.initialData?.hasGym` vaut `undefined` sur une
     * création. Une case liée à `undefined` n'est ni cochée ni décochée — Vue la traite comme non
     * contrôlée, et `UCheckbox` n'émet rien au premier clic. `=== true` force donc un booléen.
     */
    const services = servicesDepuisEdition({ hasGym: undefined, hasATM: null } as never)

    expect(services.hasGym).toBe(false)
    expect(services.hasATM).toBe(false)
    expect(Object.values(services).some((v) => v === undefined || v === null)).toBe(false)
  })

  it('ignore une clé étrangère à la liste', () => {
    const services = servicesDepuisEdition({ hasTeleportation: true } as never)

    expect(services).not.toHaveProperty('hasTeleportation')
  })
})

describe('servicesPourEcriture', () => {
  it('éteint explicitement un service absent du corps', () => {
    // Une édition se crée avec des services à `false`, jamais avec des colonnes `undefined` que
    // Prisma laisserait au défaut du schéma.
    const services = servicesPourEcriture({ hasGala: true })

    expect(services.hasGala).toBe(true)
    expect(services.hasConcert).toBe(false)
    expect(Object.keys(services)).toHaveLength(CLES_SERVICES_EDITION.length)
  })
})
