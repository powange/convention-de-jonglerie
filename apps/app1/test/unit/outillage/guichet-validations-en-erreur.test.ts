import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Le contrôle d'accès ne dit pas « tout va bien » quand le chargement a échoué.
 *
 * ## Deux panneaux, deux défauts de nature DIFFÉRENTE
 *
 * **1. Les validations récentes — un silence.** `loadRecentValidations` absorbait son erreur
 * (`catch { // Erreur silencieuse }`), et l'écran affichait « aucune validation pour le moment ».
 * Au guichet, à l'entrée d'une convention, un opérateur peut en conclure que personne n'est encore
 * passé.
 *
 * **2. Les bénévoles non validés — une contradiction, pas un silence.** Ce chargeur passe par
 * `useApiAction`, qui affiche bien un toast d'erreur. Mais le panneau derrière continuait
 * d'afficher « tous les bénévoles sont validés », **en vert et avec une coche**.
 *
 * ⚠️ Ce second cas est le pire de l'écran, et pour une raison qui se généralise : son vide
 * n'annonce pas « il n'y a rien » mais **« tout le monde est passé »**. Sur une panne, l'écran
 * affirmait que TOUT ALLAIT BIEN. **Un vide rassurant n'invite pas à vérifier** — il est donc plus
 * dangereux qu'un vide neutre. Et le toast disparaît, là où le panneau reste.
 *
 * 📍 Le commentaire d'origine distinguait déjà « vide » d'« aboutissement » — « ce vide-ci est un
 * ABOUTISSEMENT, pas un simple il n'y a rien ». Il ne distinguait pas « aboutissement » d'« échec ».
 */
const SOURCE = join(
  import.meta.dirname,
  '../../../../../layers/ticketing/app/pages/editions/[id]/gestion/ticketing/access-control.vue'
)

/* Commentaires retirés : ce fichier EXPLIQUE le défaut en citant les noms des drapeaux. */
const code = () =>
  readFileSync(SOURCE, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '')

const PANNEAUX = [
  {
    nom: 'validations récentes',
    drapeau: 'erreurValidations',
    chargeur: 'loadRecentValidations',
    vide: 'recentValidations.length === 0',
  },
  {
    nom: 'bénévoles non validés',
    drapeau: 'erreurVolontairesNonValides',
    chargeur: 'loadVolunteersNotValidated',
    vide: 'volunteersNotValidated.length === 0',
  },
] as const

describe('contrôle d’accès — une panne ne s’affiche pas comme « tout va bien »', () => {
  for (const { nom, drapeau, chargeur, vide } of PANNEAUX) {
    describe(nom, () => {
      it('⚠️ SA BRANCHE D’ERREUR PASSE AVANT SA BRANCHE VIDE', () => {
        const src = code()
        const erreur = src.indexOf(`v-else-if="${drapeau}"`)
        const videIdx = src.indexOf(`v-else-if="${vide}"`)

        expect(erreur, `aucune branche pour ${drapeau}`).toBeGreaterThan(-1)
        expect(videIdx, `la branche vide de ${vide} a disparu`).toBeGreaterThan(-1)
        expect(erreur, 'la branche vide passe avant celle d’erreur').toBeLessThan(videIdx)
      })

      it('le drapeau est levé en erreur ET abaissé en succès', () => {
        const src = code()
        expect(src, `${drapeau} n’est jamais levé`).toContain(`${drapeau}.value = true`)
        expect(src, `${drapeau} n’est jamais abaissé`).toContain(`${drapeau}.value = false`)
      })

      it(`propose de relancer ${chargeur}`, () => {
        expect(code(), 'l’encart d’erreur est un cul-de-sac').toContain(`@click="${chargeur}()"`)
      })
    })
  }

  it('⚠️ LA COCHE VERTE EST LIÉE À « VIDE », JAMAIS À « ERREUR »', () => {
    /*
     * L'invariant qui compte vraiment, et il n'est PAS un ordre.
     *
     * 📍 Mon premier essai comparait la position du drapeau d'erreur à celle de
     * `text-green-400`. Il était creux : en échangeant les deux `v-else-if`, le bloc vert emporte
     * son `classe-icone` avec lui, donc « erreur avant vert » restait vrai et le cas passait.
     *
     * Ce qu'il faut garantir est que le bloc PORTANT LE VERT soit celui de la condition vide.
     * Autrement dit : le vert ne doit jamais rassurer sur une erreur, quel que soit l'ordre.
     */
    const src = code()
    const vert = src.indexOf('classe-icone="text-green-400"')
    expect(vert, 'le vide vert a disparu').toBeGreaterThan(-1)

    // La condition de la balise qui porte le vert : on remonte au `v-else-if` qui la précède.
    const avant = src.slice(0, vert)
    const condition = avant.slice(avant.lastIndexOf('v-else-if='))

    expect(
      condition,
      'la coche verte est liée à une ERREUR : elle rassurerait sur une panne'
    ).toContain('volunteersNotValidated.length === 0')
  })

  it('le balayage lit bien le fichier — il ne conclut pas sur le vide', () => {
    expect(code().length, 'source vide ou introuvable').toBeGreaterThan(30000)
  })
})
