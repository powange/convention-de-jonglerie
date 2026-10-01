import { describe, it, expect } from 'vitest'

import {
  appelOuvertAuxCandidatures,
  candidatureModifiable,
  editionAccueilleDesCandidatures,
} from '../../../shared/utils/candidature-spectacle'

/**
 * La règle « cette candidature est-elle encore modifiable ? », et celle du statut d'édition.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE : la première était recopiée à TROIS endroits, et les trois
 * copies étaient fausses, chacune autrement.
 *
 * • La liste des appels d'une édition cherchait l'appel dans la liste PUBLIQUE, qui exclut
 *   volontairement les appels `PRIVATE` : pour une candidature en attente à un appel privé encore
 *   ouvert, la recherche échouait et le bouton « Modifier » ne s'affichait JAMAIS.
 * • Les deux vues de « Mes candidatures » posaient
 *   `(statut === 'PENDING' && visibilité === 'PUBLIC') || visibilité === 'PRIVATE'`. La
 *   parenthèse laisse `PRIVATE` SEUL : une candidature acceptée ou refusée sur un appel privé
 *   affichait « Modifier », et le clic menait sur une page répondant « vous avez déjà candidaté ».
 * • Aucune des deux ne regardait la date limite, que le serveur refuse pourtant
 *   (`my-application.put.ts`).
 *
 * Les cas ci-dessous sont donc ceux du SERVEUR, et c'est lui qui fait foi : un bouton proposé que
 * l'API refuse est un défaut, un bouton caché que l'API accepterait en est un autre.
 */

const DANS_UNE_SEMAINE = new Date(Date.now() + 7 * 24 * 3600 * 1000)
const IL_Y_A_UNE_SEMAINE = new Date(Date.now() - 7 * 24 * 3600 * 1000)

describe('appelOuvertAuxCandidatures', () => {
  it.each(['PUBLIC', 'PRIVATE'])('ACCEPTE la visibilité %s', (visibilite) => {
    expect(appelOuvertAuxCandidatures(visibilite)).toBe(true)
  })

  it.each(['CLOSED', 'OFFLINE'])('REFUSE la visibilité %s', (visibilite) => {
    expect(appelOuvertAuxCandidatures(visibilite)).toBe(false)
  })

  it('REFUSE une visibilité inconnue', () => {
    // Écrite en clair et non en creux : une visibilité ajoutée demain à l'enum n'ouvrira pas les
    // candidatures sans que quelqu'un l'ait décidé.
    expect(appelOuvertAuxCandidatures('SEMI_PRIVATE')).toBe(false)
    expect(appelOuvertAuxCandidatures(undefined)).toBe(false)
    expect(appelOuvertAuxCandidatures(null)).toBe(false)
  })
})

describe('candidatureModifiable', () => {
  it('🔬 ACCEPTE une candidature en attente sur un appel PRIVÉ encore ouvert', () => {
    /*
     * LE CAS QUI NE MARCHAIT PAS, et le cœur du point B10 : la liste d'une édition cherchait
     * l'appel privé dans la liste publique, qui ne le contient pas, et refusait donc toujours.
     */
    expect(
      candidatureModifiable({
        statut: 'PENDING',
        visibiliteAppel: 'PRIVATE',
        dateLimiteAppel: DANS_UNE_SEMAINE,
      })
    ).toBe(true)
  })

  it('ACCEPTE une candidature en attente sur un appel PUBLIC encore ouvert', () => {
    expect(
      candidatureModifiable({
        statut: 'PENDING',
        visibiliteAppel: 'PUBLIC',
        dateLimiteAppel: DANS_UNE_SEMAINE,
      })
    ).toBe(true)
  })

  it('ACCEPTE un appel SANS date limite', () => {
    // Pas d'échéance est un cas normal, pas une donnée manquante : l'appel reste ouvert.
    expect(candidatureModifiable({ statut: 'PENDING', visibiliteAppel: 'PUBLIC' })).toBe(true)
    expect(
      candidatureModifiable({
        statut: 'PENDING',
        visibiliteAppel: 'PRIVATE',
        dateLimiteAppel: null,
      })
    ).toBe(true)
  })

  it.each(['ACCEPTED', 'REJECTED'])('🔬 REFUSE une candidature %s sur un appel PRIVÉ', (statut) => {
    /*
     * LE CŒUR DU POINT B11, et il visait précisément `PRIVATE` : la parenthèse mal placée
     * laissait cette visibilité sans aucune exigence de statut. Le bouton s'affichait sur une
     * candidature déjà tranchée, et menait sur un écran qui refusait.
     */
    expect(
      candidatureModifiable({
        statut,
        visibiliteAppel: 'PRIVATE',
        dateLimiteAppel: DANS_UNE_SEMAINE,
      })
    ).toBe(false)
  })

  it('REFUSE une candidature en attente dont la DATE LIMITE est passée', () => {
    // Vérifiée par aucune des deux copies, alors que le serveur rend 400.
    expect(
      candidatureModifiable({
        statut: 'PENDING',
        visibiliteAppel: 'PUBLIC',
        dateLimiteAppel: IL_Y_A_UNE_SEMAINE,
      })
    ).toBe(false)
  })

  it.each(['CLOSED', 'OFFLINE'])('REFUSE un appel %s, même en attente', (visibilite) => {
    expect(candidatureModifiable({ statut: 'PENDING', visibiliteAppel: visibilite })).toBe(false)
  })

  it('accepte une date limite donnée en CHAÎNE comme en Date', () => {
    // Les deux formes circulent : la réponse d'API sérialise en chaîne, le serveur manipule des
    // Date. Une seule des deux prise en charge produirait un refus silencieux.
    expect(
      candidatureModifiable({
        statut: 'PENDING',
        visibiliteAppel: 'PUBLIC',
        dateLimiteAppel: DANS_UNE_SEMAINE.toISOString(),
      })
    ).toBe(true)
  })

  it('REFUSE une date limite illisible', () => {
    // Plutôt que de laisser `NaN` répondre « non dépassée » par accident — une comparaison avec
    // NaN est toujours fausse, et `maintenant <= NaN` aurait donc fermé la porte par hasard.
    // On la ferme exprès.
    expect(
      candidatureModifiable({
        statut: 'PENDING',
        visibiliteAppel: 'PUBLIC',
        dateLimiteAppel: 'bientôt',
      })
    ).toBe(false)
  })

  it('compare à l’instant QU’ON LUI DONNE', () => {
    /*
     * 🔬 `maintenant` est un paramètre, et c'est ce qui rend la règle éprouvable. Ce dépôt a
     * perdu sept tests, dans un lot voisin, sur des créneaux datés en dur qui sont devenus passés
     * entre-temps : une règle qui se compare à l'heure présente ne se teste pas autrement.
     */
    const limite = new Date('2026-06-30T23:59:00Z')
    const candidature = {
      statut: 'PENDING',
      visibiliteAppel: 'PUBLIC' as const,
      dateLimiteAppel: limite,
    }

    expect(candidatureModifiable(candidature, new Date('2026-06-30T23:58:00Z'))).toBe(true)
    expect(candidatureModifiable(candidature, new Date('2026-07-01T00:00:00Z'))).toBe(false)
    // À la seconde exacte, c'est encore ouvert : la date limite est le dernier instant admis, et
    // c'est ce que fait le serveur (`new Date() > deadline`).
    expect(candidatureModifiable(candidature, limite)).toBe(true)
  })
})

describe('editionAccueilleDesCandidatures', () => {
  it.each(['PUBLISHED', 'PLANNED', 'OFFLINE'])('ACCEPTE une édition %s', (statut) => {
    expect(editionAccueilleDesCandidatures(statut)).toBe(true)
  })

  it('🔬 ACCEPTE une édition OFFLINE, volontairement', () => {
    /*
     * ⚠️ Toute édition NAÎT `OFFLINE` : ce statut veut surtout dire « pas encore publiée ».
     * Ouvrir un appel à spectacles avant de publier son édition est le parcours normal, et le
     * refuser a cassé trois spécifications de bout en bout (#651). Ce test existe pour que
     * personne ne « corrige » cette ligne en lisant le constat d'origine.
     */
    expect(editionAccueilleDesCandidatures('OFFLINE')).toBe(true)
  })

  it('REFUSE une édition ANNULÉE', () => {
    expect(editionAccueilleDesCandidatures('CANCELLED')).toBe(false)
  })

  it('REFUSE un statut inconnu', () => {
    expect(editionAccueilleDesCandidatures('POSTPONED')).toBe(false)
    expect(editionAccueilleDesCandidatures(undefined)).toBe(false)
  })
})
