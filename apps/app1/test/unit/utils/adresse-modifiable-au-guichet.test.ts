import { describe, expect, it } from 'vitest'

import {
  adresseAEcrire,
  comptesQuiRefusent,
  verdictDAdresse,
} from '../../../shared/utils/adresse-modifiable-au-guichet'

/**
 * Le droit du guichet à réécrire l'adresse de courriel d'un compte.
 *
 * Deux erreurs opposées coûtent ici, et aucune ne se voit à l'écran.
 *
 * Trop permissif : réécrire l'adresse d'un compte vérifié, donc en usage, permet d'en demander la
 * réinitialisation du mot de passe et de le prendre. Le guichet est tenu, entre autres, par des
 * bénévoles en créneau de contrôle d'accès.
 *
 * Trop strict : refuser une validation d'entrée parce que l'écran a renvoyé l'adresse déjà
 * enregistrée bloquerait une file d'attente pour rien. L'écran pré-remplit ce champ et l'envoie à
 * chaque validation — l'immense majorité des appels ne demandent AUCUN changement.
 */

const NON_VERIFIE = { id: 1, email: 'alicee@exemple.fr', isEmailVerified: false }
const VERIFIE = { id: 2, email: 'bob@exemple.fr', isEmailVerified: true }

describe('verdictDAdresse', () => {
  it('laisse corriger la faute de frappe d’un compte non vérifié', () => {
    // Le cas pour lequel ce champ existe : un artiste ajouté à la main, une lettre en trop.
    expect(verdictDAdresse(NON_VERIFIE, 'alice@exemple.fr')).toEqual({ decision: 'corrigeable' })
  })

  it('FIGE l’adresse d’un compte vérifié', () => {
    // Le compte appartient à quelqu'un : le réécrire permettrait de le prendre.
    expect(verdictDAdresse(VERIFIE, 'pirate@exemple.fr')).toEqual({ decision: 'figee' })
  })

  it('ne voit aucun changement quand l’écran renvoie l’adresse enregistrée', () => {
    // Le cas ordinaire, et de loin le plus fréquent. Le traiter comme un changement ferait
    // refuser la validation d'entrée de toute personne au compte vérifié.
    expect(verdictDAdresse(VERIFIE, 'bob@exemple.fr')).toEqual({ decision: 'inchangee' })
    expect(verdictDAdresse(NON_VERIFIE, 'alicee@exemple.fr')).toEqual({ decision: 'inchangee' })
  })

  it('ignore la casse et les espaces de bord', () => {
    // Un champ pré-rempli dans lequel on clique peut revenir légèrement différent. Ce n'est pas
    // une demande de changement, et la refuser bloquerait une entrée sans raison lisible.
    expect(verdictDAdresse(VERIFIE, '  BOB@Exemple.FR ')).toEqual({ decision: 'inchangee' })
  })

  it('traite une adresse absente ou vide comme « on n’y touche pas »', () => {
    // Les écrans envoient le bloc entier à chaque validation : une absence n'est pas une demande
    // de suppression, et l'interpréter ainsi viderait l'adresse du compte.
    expect(verdictDAdresse(VERIFIE, undefined)).toEqual({ decision: 'inchangee' })
    expect(verdictDAdresse(VERIFIE, null)).toEqual({ decision: 'inchangee' })
    expect(verdictDAdresse(VERIFIE, '   ')).toEqual({ decision: 'inchangee' })
  })

  it('ne fige rien sur un compte non vérifié, quelle que soit l’adresse', () => {
    expect(verdictDAdresse(NON_VERIFIE, 'nimporte@exemple.fr')).toEqual({
      decision: 'corrigeable',
    })
  })
})

describe('comptesQuiRefusent', () => {
  it('nomme les comptes qui bloquent, plutôt que de rendre un simple non', () => {
    // « L'adresse de ce compte est déjà vérifiée » se comprend au comptoir ; « refusé » envoie
    // chercher quelqu'un.
    expect(comptesQuiRefusent([NON_VERIFIE, VERIFIE], 'autre@exemple.fr')).toEqual([VERIFIE])
  })

  it('ne bloque rien quand l’adresse ne change pour personne', () => {
    expect(comptesQuiRefusent([VERIFIE], 'bob@exemple.fr')).toEqual([])
  })

  it('ne bloque rien quand aucun compte n’est vérifié', () => {
    expect(comptesQuiRefusent([NON_VERIFIE], 'autre@exemple.fr')).toEqual([])
  })
})

describe('adresseAEcrire', () => {
  it('est vrai dès qu’un compte change réellement d’adresse', () => {
    expect(adresseAEcrire([NON_VERIFIE], 'alice@exemple.fr')).toBe(true)
  })

  it('est faux quand l’adresse soumise est déjà celle du compte', () => {
    // Évite une écriture inutile, et surtout le recalcul d'une empreinte de gravatar identique.
    expect(adresseAEcrire([NON_VERIFIE], 'alicee@exemple.fr')).toBe(false)
  })

  it('est faux quand seul un compte FIGÉ changerait', () => {
    // Le refus se décide ailleurs ; ici on ne dit que ce qu'il y aurait à écrire.
    expect(adresseAEcrire([VERIFIE], 'autre@exemple.fr')).toBe(false)
  })

  it('est faux sur une liste vide', () => {
    expect(adresseAEcrire([], 'autre@exemple.fr')).toBe(false)
  })
})
