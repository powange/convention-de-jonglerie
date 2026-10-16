import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * L'écran des articles à remettre distingue « rien à montrer » de « le chargement a échoué ».
 *
 * ## Le défaut
 *
 * Ses sept listes avaient chacune un squelette de chargement et un état vide, mais **rien entre
 * les deux**. Les onze chargeurs absorbaient leur erreur en silence (`catch { // Erreur
 * silencieuse }`), donc à la moindre panne le drapeau de chargement retombait, la liste restait
 * vide, et l'écran annonçait « aucun tarif », « aucun spectacle », « aucun artiste ».
 *
 * **Une panne devenait une affirmation sur les données.** Un organisateur pouvait conclure qu'il
 * n'avait rien configuré et tout ressaisir.
 *
 * ## ⚠️ CE QUE CETTE GARDE PROTÈGE VRAIMENT : L'ORDRE
 *
 * La liste est vide dans les deux cas. Si la branche vide passait avant la branche d'erreur, elle
 * l'emporterait et le drapeau ne servirait à rien — l'écran rejouerait exactement le défaut, avec
 * tout l'appareillage en place. **C'est invisible à la relecture**, et c'est la leçon que le lot
 * des repas (#838) avait déjà payée.
 *
 * Une garde de source, donc, et assumée comme telle : éprouver les sept états par montage
 * demanderait de doubler sept points d'API et de faire échouer chacun à son tour. Ce qui compte
 * ici est l'ordre de deux branches, et il se lit.
 */
const SOURCE = join(
  import.meta.dirname,
  '../../../../../layers/ticketing/app/pages/editions/[id]/gestion/ticketing/handout-items.vue'
)

/** Les sept listes dont l'état vide affirmait quelque chose de faux. */
const SECTIONS = [
  { drapeau: 'erreurTiers', chargeur: 'loadTiers', vide: 'tiers.length === 0' },
  { drapeau: 'erreurOptions', chargeur: 'loadOptions', vide: 'ticketingOptions.length === 0' },
  {
    drapeau: 'erreurCustomFields',
    chargeur: 'loadCustomFields',
    vide: 'customFields.length === 0',
  },
  {
    drapeau: 'erreurEditionOrganizers',
    chargeur: 'loadEditionOrganizers',
    vide: 'editionOrganizers.length === 0',
  },
  { drapeau: 'erreurShows', chargeur: 'loadShows', vide: 'shows.length === 0' },
  { drapeau: 'erreurArtists', chargeur: 'loadArtists', vide: 'artists.length === 0' },
  { drapeau: 'erreurMeals', chargeur: 'loadMeals', vide: 'enabledMealsGrouped.length === 0' },
] as const

/*
 * ⚠️ Les commentaires sont retirés : ceux que ce lot a posés dans la source CONTIENNENT les mots
 * « branche vide », « aucun élément » et le nom des drapeaux. Sans ce retrait, la garde se
 * prouverait sur l'explication du défaut au lieu du code. Piège déjà payé neuf fois ici.
 */
const code = () =>
  readFileSync(SOURCE, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '')

describe('articles à remettre — panne de chargement ≠ absence de données', () => {
  for (const { drapeau, chargeur, vide } of SECTIONS) {
    describe(drapeau, () => {
      it('⚠️ SA BRANCHE PASSE AVANT LA BRANCHE VIDE', () => {
        const src = code()
        const erreur = src.indexOf(`v-else-if="${drapeau}"`)
        const videIdx = src.indexOf(`v-else-if="${vide}"`)

        expect(erreur, `aucune branche pour ${drapeau}`).toBeGreaterThan(-1)
        expect(videIdx, `la branche vide de ${vide} a disparu`).toBeGreaterThan(-1)
        expect(
          erreur,
          `la branche vide passe avant celle d’erreur : « aucun élément » l’emportera`
        ).toBeLessThan(videIdx)
      })

      it('le drapeau est levé en erreur ET abaissé en succès', () => {
        /*
         * Les deux comptent. Sans la remise à `false`, un écran qui échoue une fois garderait son
         * encart d'erreur après un rechargement réussi — et le bouton « Réessayer » ne servirait
         * à rien, ce qui est pire qu'une absence de bouton.
         */
        const src = code()
        expect(src, `${drapeau} n’est jamais levé`).toContain(`${drapeau}.value = true`)
        expect(src, `${drapeau} n’est jamais abaissé`).toContain(`${drapeau}.value = false`)
      })

      it(`propose de relancer ${chargeur}`, () => {
        expect(code(), `l’encart d’erreur est un cul-de-sac`).toContain(`@click="${chargeur}()"`)
      })
    })
  }

  it('⚠️ PLUS AUCUN `catch` MUET DANS LES SEPT CHARGEURS', () => {
    /*
     * Le témoin du reste : on peut très bien ajouter les drapeaux ET laisser un chargeur avec son
     * `catch { // Erreur silencieuse }` d'origine, auquel cas sa section continue de mentir.
     *
     * 📍 Les quatre AUTRES chargeurs de l'écran (`loadHandoutItems`,
     * `loadVolunteerHandoutItems`, `loadOrganizerItems`, `loadArtistItems`) gardent le leur, et
     * c'est délibéré : leurs données n'alimentent pas un état vide qui affirme quelque chose.
     * On attend donc 11 - 7 = 4 catch muets, et pas zéro.
     */
    const muets = code().match(/catch\s*\{\s*\}/g) ?? []

    expect(
      muets.length,
      'un chargeur a retrouvé un catch muet, ou les quatre assumés ont changé de nombre'
    ).toBe(4)
  })

  it('le balayage lit bien le fichier — il ne conclut pas sur le vide', () => {
    expect(code().length, 'source vide ou introuvable').toBeGreaterThan(20000)
  })
})
