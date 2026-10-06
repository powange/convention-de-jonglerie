import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * La sélection initiale d'une section doit atteindre le parent.
 *
 * ⚠️ POURQUOI UNE GARDE SUR LA SOURCE. Le défaut qu'elle surveille est un ORDRE D'EXÉCUTION, et il
 * ne produit aucune incohérence visible : les cases apparaissent cochées, la section est juste, et
 * c'est le CHIFFRE du bouton de validation qui ment — « Valider l'entrée (2) » pour trois titres.
 * Il fallait décocher puis recocher un billet pour que le compte tombe.
 *
 * 📍 La cause : l'observateur qui pose la présélection s'exécute pendant le `setup`, donc AVANT
 * que celui qui la remonte ne soit déclaré. Sans `immediate`, le parent n'entend jamais la valeur
 * initiale. Un test de rendu l'attraperait, mais demanderait de monter un composant de 1300 lignes
 * et sa douzaine de composants Nuxt UI — pour vérifier une option de trois mots.
 */

const CHEMIN = join(
  import.meta.dirname,
  '../../../../../layers/ticketing/app/components/ticketing/ParticipantTitleSection.vue'
)

/** Le `<script setup>`, commentaires retirés : ils citent nommément ce qu'on cherche. */
function scriptSansCommentaires(): string {
  const source = readFileSync(CHEMIN, 'utf8')
  const debut = source.indexOf('<script setup')
  expect(debut, 'bloc <script setup> introuvable').toBeGreaterThan(-1)

  return source
    .slice(debut)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('la section remonte sa sélection dès le montage', () => {
  it('l’observateur de `selectedParticipants` existe toujours', () => {
    // Sans cette première assertion, la suivante serait vraie pour la mauvaise raison : un
    // observateur renommé ou retiré rendrait le test vert alors que plus rien ne remonte.
    expect(scriptSansCommentaires()).toContain('watch(selectedParticipants')
  })

  it('⚠️ et il porte `immediate`, sans quoi la valeur initiale se perd', () => {
    const script = scriptSansCommentaires()
    const debut = script.indexOf('watch(selectedParticipants')

    /*
     * ⚠️ BORNÉ AU PROCHAIN `watch(`, et ce détail a d'abord rendu ce test CREUX. Une tranche de
     * 400 caractères débordait sur l'observateur suivant — celui des champs modifiables —, qui
     * porte lui aussi `immediate: true`. Le test passait donc en ayant retiré l'option qu'il
     * surveillait : il lisait la bonne chaîne au mauvais endroit.
     */
    const suivant = script.indexOf('watch(', debut + 6)
    const appel = script.slice(debut, suivant === -1 ? undefined : suivant)

    expect(appel, 'l’observateur de la sélection a perdu `immediate: true`').toMatch(
      /immediate:\s*true/
    )
  })

  it('la présélection est bien ce qui initialise la sélection', () => {
    // Garde contre une remise à zéro qui reviendrait : `selectedParticipants.value = []` ferait
    // s'ouvrir la fiche sur une commande dont aucune ligne n'est cochée.
    const script = scriptSansCommentaires()

    expect(script).toContain('selectedParticipants.value = [...(props.preselection ?? [])]')
    expect(script).not.toContain('selectedParticipants.value = []')
  })
})
