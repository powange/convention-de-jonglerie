import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * L'écran des quotas distingue « rien à montrer » de « le chargement a échoué ».
 *
 * ## Le défaut, et ce que ses propres commentaires avouaient
 *
 * Les sept chargeurs absorbaient leur erreur en silence, et leurs commentaires disaient
 * « la liste reste vide plutôt que de casser la page », « l'onglet reste vide ». L'auteur avait
 * donc arbitré entre **vide** et **planter** — alors qu'il existe une troisième réponse : dire
 * que ça a échoué. C'est celle que le lot des repas (#838) a établie depuis.
 *
 * Résultat : à la moindre panne, l'écran annonçait « aucun tarif », « aucun quota », et un
 * organisateur pouvait croire qu'il n'avait rien configuré.
 *
 * ## 📍 Le correctif passe par DEUX composants partagés, pas par sept blocs de gabarit
 *
 * Six des sept listes passent par `QuotaAssociationList` ou `QuotaBlocGlobal`. Une branche
 * d'erreur dans chacun de ces deux composants sert donc les six d'un coup — et c'est la septième,
 * la liste des quotas elle-même, qui garde sa branche dans la page.
 *
 * ⚠️ **J'ai failli poser trois props sur le mauvais composant.** Trois chargeurs sont passés à
 * DEUX composants chacun, et `QuotaBlocGlobal` n'avait ni la prop `erreur` ni l'émission
 * `reessayer` : les attributs y auraient été acceptés **en silence**, sans rien faire. D'où les
 * cas qui vérifient que les deux composants déclarent bien ce qu'on leur passe.
 */
const RACINE = join(import.meta.dirname, '../../../../..')
const PAGE = join(RACINE, 'layers/ticketing/app/pages/editions/[id]/gestion/ticketing/quotas.vue')
const LISTE = join(RACINE, 'layers/ticketing/app/components/ticketing/QuotaAssociationList.vue')
const BLOC = join(RACINE, 'layers/ticketing/app/components/ticketing/QuotaBlocGlobal.vue')

/*
 * ⚠️ Commentaires retirés : les trois fichiers EXPLIQUENT le défaut en citant « branche vide »,
 * « aucun quota » et le nom des drapeaux. Sans ce retrait, la garde se prouverait sur
 * l'explication. Piège payé dix fois dans ce dépôt, dont deux fois par moi sur ce lot.
 */
const code = (chemin: string) =>
  readFileSync(chemin, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '')

const DRAPEAUX = [
  { drapeau: 'erreurQuotas', chargeur: 'loadQuotas' },
  { drapeau: 'erreurTiers', chargeur: 'loadTiers' },
  { drapeau: 'erreurOptions', chargeur: 'loadOptions' },
  { drapeau: 'erreurOrganisateurs', chargeur: 'loadOrganisateurs' },
  { drapeau: 'erreurBenevoles', chargeur: 'loadBenevoles' },
  { drapeau: 'erreurArtistes', chargeur: 'loadArtistes' },
  { drapeau: 'erreurChamps', chargeur: 'loadChamps' },
] as const

describe('quotas — panne de chargement ≠ absence de données', () => {
  describe('les deux composants partagés', () => {
    it('⚠️ `QuotaAssociationList` : la branche d’erreur PASSE AVANT la branche vide', () => {
      const src = code(LISTE)
      const erreur = src.indexOf('v-else-if="erreur"')
      const vide = src.indexOf('v-else-if="!elements.length"')

      expect(erreur, 'aucune branche d’erreur').toBeGreaterThan(-1)
      expect(vide, 'la branche vide a disparu').toBeGreaterThan(-1)
      expect(erreur, '`messageVide` l’emportera sur une panne').toBeLessThan(vide)
    })

    it('⚠️ `QuotaBlocGlobal` : la branche d’erreur PASSE AVANT la branche vide', () => {
      const src = code(BLOC)
      const erreur = src.indexOf('v-else-if="erreur"')
      const vide = src.indexOf('<span v-else')

      expect(erreur, 'aucune branche d’erreur').toBeGreaterThan(-1)
      expect(vide, 'la branche vide a disparu').toBeGreaterThan(-1)
      expect(erreur, '« aucun quota » l’emportera sur une panne').toBeLessThan(vide)
    })

    it('⚠️ LES DEUX DÉCLARENT `erreur` ET `reessayer`', () => {
      /*
       * Le cas qui attrape la prop inventée. Vue accepte en SILENCE un attribut qui ne correspond
       * à aucune prop, et un `@reessayer` non déclaré devient un écouteur d'attribut : le bouton
       * serait là, et ne ferait rien.
       */
      for (const [nom, chemin] of [
        ['QuotaAssociationList', LISTE],
        ['QuotaBlocGlobal', BLOC],
      ] as const) {
        const src = code(chemin)
        expect(src, `${nom} ne déclare pas la prop erreur`).toMatch(/erreur\?:\s*boolean/)
        expect(src, `${nom} ne déclare pas l’émission reessayer`).toContain('reessayer: []')
      }
    })
  })

  describe('la page', () => {
    it('⚠️ SA BRANCHE D’ERREUR PASSE AVANT SA BRANCHE VIDE', () => {
      const src = code(PAGE)
      const erreur = src.indexOf('v-if="!loadingQuotas && erreurQuotas"')
      const vide = src.indexOf('v-else-if="!loadingQuotas && quotas.length === 0"')

      expect(erreur, 'aucune branche d’erreur dans la page').toBeGreaterThan(-1)
      expect(vide, 'la branche vide a disparu').toBeGreaterThan(-1)
      expect(erreur, '« aucun quota » l’emportera sur une panne').toBeLessThan(vide)
    })

    for (const { drapeau, chargeur } of DRAPEAUX) {
      it(`${drapeau} est levé en erreur ET abaissé en succès`, () => {
        const src = code(PAGE)
        expect(src, `${drapeau} n’est jamais levé`).toContain(`${drapeau}.value = true`)
        expect(src, `${drapeau} n’est jamais abaissé`).toContain(`${drapeau}.value = false`)
      })
    }

    it('⚠️ CHAQUE `:erreur` CÂBLÉ A SON `@reessayer`', () => {
      /*
       * Un encart d'erreur sans issue vaut à peine mieux qu'un mensonge. Les deux comptes doivent
       * coïncider : un `:erreur` sans `@reessayer` afficherait un bouton mort, ou pas de bouton.
       */
      const src = code(PAGE)
      const erreurs = (src.match(/:erreur="erreur\w+"/g) ?? []).length
      const reprises = (src.match(/@reessayer="load\w+"/g) ?? []).length

      expect(erreurs, 'aucune prop :erreur câblée').toBeGreaterThan(5)
      expect(reprises, 'les reprises ne suivent pas les erreurs').toBe(erreurs)
    })

    it('⚠️ PLUS AUCUN `catch` MUET DANS LES SEPT CHARGEURS', () => {
      /*
       * Le témoin du reste : on peut ajouter les drapeaux ET laisser un chargeur avec son
       * `catch { // Erreur silencieuse }` d'origine, auquel cas son onglet continue de mentir.
       */
      expect(code(PAGE).match(/catch\s*\{\s*\}/g) ?? []).toEqual([])
    })
  })

  it('le balayage lit bien les trois fichiers — il ne conclut pas sur le vide', () => {
    expect(code(PAGE).length, 'page vide ou introuvable').toBeGreaterThan(20000)
    expect(code(LISTE).length, 'liste vide ou introuvable').toBeGreaterThan(1000)
    expect(code(BLOC).length, 'bloc vide ou introuvable').toBeGreaterThan(500)
  })
})
