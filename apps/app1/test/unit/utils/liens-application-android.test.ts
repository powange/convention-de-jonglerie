import { describe, expect, it } from 'vitest'

import {
  empreintesDeSignature,
  lienVersApplication,
  PAQUET_ANDROID,
} from '../../../server/utils/liens-application-android'

/**
 * Le fichier Digital Asset Links, qui associe le domaine à l'application Android.
 *
 * ⚠️ POURQUOI IL EST ÉPROUVÉ ALORS QU'IL NE FAIT QUE COMPOSER UN OBJET. Parce qu'il n'échoue
 * JAMAIS bruyamment. Une empreinte mal découpée, une relation mal nommée, une clé absente : le
 * fichier reste un JSON valide, le serveur répond 200, et le seul symptôme est la barre d'adresse
 * de Chrome qui apparaît au-dessus de l'application sur le téléphone. Pas d'erreur, pas de
 * journal, rien à chercher côté serveur.
 *
 * Et ce symptôme coûte cher : une application qui ressemble à un navigateur déguisé se fait
 * refuser à l'examen du Play Store.
 *
 * C'est donc ici, et nulle part ailleurs, qu'on peut savoir que le fichier est juste avant de
 * publier.
 */

const EMPREINTE =
  '14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5'

describe('empreintesDeSignature', () => {
  it('ne rend RIEN quand la variable est absente', () => {
    /*
     * ⚠️ LE CAS QUI COMPTE LE PLUS, parce que c'est l'état du jour : l'empreinte n'est connue
     * qu'après le premier envoi sur le Play Store.
     *
     * Un tableau vide dit « aucune application n'est associée à ce domaine », ce que Chrome traite
     * comme tel. Une empreinte d'exemple dirait « CETTE application-ci est associée » — et la
     * vraie se verrait alors refuser, pour une raison introuvable.
     */
    expect(empreintesDeSignature(undefined)).toEqual([])
    expect(empreintesDeSignature(null)).toEqual([])
    expect(empreintesDeSignature('')).toEqual([])
  })

  it('accepte une empreinte telle que la console Play l’affiche', () => {
    expect(empreintesDeSignature(EMPREINTE)).toEqual([EMPREINTE])
  })

  it('normalise la casse et les espaces', () => {
    /*
     * Une empreinte recopiée depuis la console Play arrive volontiers avec une espace en trop, un
     * saut de ligne, ou en minuscules. Android compare la chaîne TELLE QUELLE : sans normalisation,
     * une espace invisible suffit à faire échouer l'association, en silence.
     */
    const salie = `  \n${EMPREINTE.toLowerCase()}\t `

    expect(empreintesDeSignature(salie)).toEqual([EMPREINTE])
  })

  it('accepte plusieurs empreintes séparées par une virgule', () => {
    // Le cas d'une rotation de clé : l'ancienne et la nouvelle doivent être acceptées ensemble,
    // le temps que les installations existantes se mettent à jour.
    const autre = EMPREINTE.replace(/^14/, 'AB')

    expect(empreintesDeSignature(`${EMPREINTE}, ${autre}`)).toEqual([EMPREINTE, autre])
  })

  it('ÉCARTE ce qui n’a pas la forme d’une empreinte SHA-256', () => {
    /*
     * ⚠️ Une empreinte tronquée — copiée à moitié, coupée par un retour à la ligne d'une interface
     * — associerait le domaine à une clé qui n'existe pas. Le symptôme serait exactement celui
     * d'une variable oubliée, mais on croirait la configuration faite.
     *
     * Une SHA-1, notamment, a la même allure et ne fait que vingt octets : c'est l'erreur la plus
     * facile à commettre, les deux empreintes étant affichées côte à côte dans la console Play.
     */
    const sha1 = '14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42'
    const tronquee = EMPREINTE.slice(0, 40)

    expect(empreintesDeSignature(sha1)).toEqual([])
    expect(empreintesDeSignature(tronquee)).toEqual([])
    expect(empreintesDeSignature('pas une empreinte')).toEqual([])
  })

  it('garde les valides et jette les invalides d’une même liste', () => {
    // Une liste à moitié fautive ne doit pas emporter l'empreinte correcte avec elle : mieux vaut
    // une association qui marche et une entrée manquante que rien du tout.
    expect(empreintesDeSignature(`${EMPREINTE},n'importe quoi`)).toEqual([EMPREINTE])
  })
})

describe('lienVersApplication', () => {
  it('emploie la relation exigée par un TWA', () => {
    /*
     * ⚠️ `delegate_permission/common.handle_all_urls`, et non `common.get_login_creds` — qui sert
     * au remplissage des mots de passe. Se tromper de relation produit un fichier parfaitement
     * valide qui n'autorise RIEN, et le symptôme reste la barre d'adresse.
     */
    expect(lienVersApplication(EMPREINTE).relation).toEqual([
      'delegate_permission/common.handle_all_urls',
    ])
  })

  it('désigne le paquet Android et l’empreinte', () => {
    expect(lienVersApplication(EMPREINTE).target).toEqual({
      namespace: 'android_app',
      package_name: 'com.jugglingconvention.app',
      sha256_cert_fingerprints: [EMPREINTE],
    })
  })

  it('fige l’identifiant du paquet', () => {
    /*
     * ⚠️ L'identifiant est DÉFINITIF : on ne peut pas le changer après la première publication sur
     * le Play Store, sous peine de perdre les installations et les avis. Ce test est là pour qu'un
     * remaniement ne le modifie pas par inadvertance — et pour que quiconque le changerait
     * volontairement sache ce qu'il fait.
     */
    expect(PAQUET_ANDROID).toBe('com.jugglingconvention.app')
  })
})
