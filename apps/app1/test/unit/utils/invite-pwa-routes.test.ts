import { describe, it, expect } from 'vitest'

import { invitePwaAutorisee } from '../../../app/utils/invite-pwa-routes'

/**
 * Où l'on ne propose PAS d'installer l'application.
 *
 * ⚠️ CE QUI SE PASSAIT. L'invitation s'affichait cinq secondes après l'événement du navigateur,
 * dans une MODALE, par-dessus n'importe quelle page. Cinq secondes, c'est exactement le temps
 * qu'il faut pour commencer à remplir un formulaire : la modale surgissait au milieu d'une
 * candidature de bénévole, d'un profil en cours d'édition — ou, au guichet, PENDANT UN SCAN DE
 * BILLETS, où elle prenait le focus entre deux QR codes.
 *
 * Le bandeau qui la remplace ne bloque plus rien, mais une invitation reste une interruption : sur
 * ces écrans-là, on n'en veut pas du tout.
 *
 * Le critère est une fonction PURE, éprouvée sans monter de composant ni simuler de routeur —
 * c'est elle qui porte la décision, et c'est le seul endroit où elle se mesure proprement.
 */

describe('invitePwaAutorisee', () => {
  describe('les écrans où l’invitation est permise', () => {
    it.each([
      ['/', 'accueil'],
      ['/editions', 'liste des éditions'],
      ['/editions/42', 'détail d’une édition'],
      ['/editions/42/carpool', 'covoiturage public'],
      ['/favorites', 'favoris'],
      ['/messenger', 'messagerie'],
      ['/conventions', 'conventions'],
    ])('%s (%s)', (chemin) => {
      expect(invitePwaAutorisee(chemin)).toBe(true)
    })
  })

  describe('les écrans de saisie et d’opération', () => {
    it.each([
      ['/editions/42/gestion', 'racine de la gestion'],
      ['/editions/42/gestion/volunteers/form', 'formulaire de bénévoles'],
      ['/editions/42/gestion/ticketing/access-control', 'contrôle d’accès — le scan'],
      ['/editions/42/volunteers', 'candidature de bénévole'],
      ['/editions/42/shows-call/7/apply', 'candidature à un appel à spectacles'],
      ['/profile', 'espace profil'],
      ['/profile/informations', 'informations personnelles'],
      ['/profile/mes-candidatures-benevole', 'ses candidatures'],
    ])('%s (%s)', (chemin) => {
      expect(invitePwaAutorisee(chemin)).toBe(false)
    })
  })

  it('le contrôle d’accès est couvert par « gestion », pas par une règle propre', () => {
    /*
     * L'énoncé du lot listait `/gestion/ticketing/access-control` à part. Il n'a pas besoin de sa
     * propre règle — le motif de gestion l'attrape déjà. L'écrire une seconde fois donnerait deux
     * endroits à tenir d'accord, et c'est ainsi qu'une règle recopiée finit par diverger.
     *
     * Ce test verrouille l'implication : si le motif de gestion changeait, le scan resterait
     * couvert ou ce test tomberait.
     */
    expect(invitePwaAutorisee('/editions/42/gestion')).toBe(false)
    expect(invitePwaAutorisee('/editions/42/gestion/ticketing/access-control')).toBe(false)
  })

  describe('les pièges de correspondance', () => {
    it('ne bloque PAS un chemin qui contient seulement le mot', () => {
      /*
       * Une correspondance par simple inclusion (`chemin.includes('volunteers')`) bloquerait des
       * pages publiques qui n'ont rien à voir. Les motifs exigent une frontière de segment.
       */
      expect(invitePwaAutorisee('/editions/42/volunteersomething')).toBe(true)
      expect(invitePwaAutorisee('/blog/gestionnaire-de-convention')).toBe(true)
      expect(invitePwaAutorisee('/profiles-publics')).toBe(true)
    })

    it('bloque un appel à spectacles seulement sur `/apply`', () => {
      // Consulter un appel à spectacles n'est pas y candidater : rien à interrompre.
      expect(invitePwaAutorisee('/editions/42/shows-call/7')).toBe(true)
      expect(invitePwaAutorisee('/editions/42/shows-call/7/apply')).toBe(false)
    })

    it('retire un éventuel préfixe de langue avant de décider', () => {
      /*
       * La stratégie i18n du projet est `no_prefix`, donc ce cas ne se présente pas AUJOURD'HUI.
       * S'y fier sans le dire rendrait le critère muet le jour où elle changerait — et un bandeau
       * qui réapparaît sur les formulaires ne se signale pas comme une régression : il ne casse
       * rien, il dérange.
       */
      expect(invitePwaAutorisee('/fr/profile/informations')).toBe(false)
      expect(invitePwaAutorisee('/en/editions/42/gestion')).toBe(false)
      expect(invitePwaAutorisee('/fr/editions/42')).toBe(true)
    })

    it('refuse un chemin vide plutôt que de l’autoriser', () => {
      // Un chemin absent signale un état qu'on ne sait pas lire : mieux vaut ne rien proposer.
      expect(invitePwaAutorisee('')).toBe(false)
    })
  })
})
