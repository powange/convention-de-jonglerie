import { render } from '@vue-email/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import NotificationEmail from '../../../../server/emails/NotificationEmail.vue'
import {
  CHEMIN_DES_PREFERENCES,
  habillageDeCourriel,
  salutationDeCourriel,
  texteDeCourriel,
} from '../../../../server/utils/habillage-courriel'

/**
 * L'habillage des courriels de notification — constat F3.
 *
 * ## ⚠️ LE DÉFAUT
 *
 * Le titre et le message étaient traduits dans la langue de la personne, mais le gabarit restait
 * français : `<Html lang="fr">`, « Bonjour », « L'équipe de Juggling Convention », « Gérer mes
 * notifications », « Cet email a été envoyé automatiquement ». Un anglophone recevait donc un
 * **courriel bilingue** — son contenu dans sa langue, son emballage dans la nôtre.
 *
 * Trois autres défauts voyageaient avec :
 *
 * - le lien « Gérer mes notifications » menait à `/profile`, où rien ne parle de notifications ;
 * - la version TEXTE était le message nu, **sans salutation ni lien d'action** : les clients qui
 *   n'affichent pas le HTML n'y voyaient aucun moyen d'agir ;
 * - aucun en-tête `List-Unsubscribe`, ce qui pèse sur la délivrabilité du domaine entier.
 *
 * ## ⚠️⚠️ POURQUOI LA TRADUCTION EST MARQUÉE, ET NON COMPARÉE À DE L'ANGLAIS
 *
 * Les clés sont écrites **en français seulement** — c'est la règle du dépôt ; les douze autres
 * langues arrivent par `/translate-todos`. Asserter « Hello » échouerait aujourd'hui, et asserter
 * le texte français de demain est tout aussi fragile : [[une assertion sur une traduction est
 * transitoire]].
 *
 * Ce qui se mesure ici est donc le MÉCANISME : `translateServerSide` est remplacé par un marqueur
 * `[langue]clé`, et l'on vérifie que le gabarit rendu porte la langue demandée pour chacune des
 * chaînes d'emballage — et plus aucune phrase française en dur. Le témoin, lui, rend sans marqueur
 * et exige le vrai français : sans lui, un gabarit qui n'afficherait plus rien du tout, ou des clés
 * brutes, satisferait tous les autres cas.
 */
let marquerLesTraductions = false

vi.mock('../../../../server/utils/server-i18n', async (importOriginal) => {
  const vrai = await importOriginal<typeof import('../../../../server/utils/server-i18n')>()
  return {
    ...vrai,
    translateServerSide: (key: string, params: Record<string, unknown> = {}, lang = 'fr') =>
      marquerLesTraductions ? `[${lang}]${key}` : vrai.translateServerSide(key, params, lang),
  }
})

describe('l’habillage des courriels', () => {
  const PROPS = {
    title: 'Someone booked a seat',
    prenom: 'Alice',
    message: 'Bob wants to book 2 seat(s) in your carpool',
    baseUrl: 'https://juggling-convention.com',
    actionUrl: '/editions/7/carpool',
    actionText: 'See the request',
  }

  /** Les cinq chaînes de l'emballage, par leur clé. */
  const CLES = [
    'notifications.email.greeting',
    'notifications.email.signature',
    'notifications.email.manage_notifications',
    'notifications.email.support_project',
    'notifications.email.automatic',
  ]

  beforeEach(() => {
    marquerLesTraductions = false
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('le gabarit rendu', () => {
    it('⚠️ PREND SES CINQ CHAÎNES DANS LA LANGUE DU DESTINATAIRE', async () => {
      marquerLesTraductions = true

      const html = await render(NotificationEmail, { ...PROPS, locale: 'en' })

      for (const cle of CLES) expect(html, cle).toContain(`[en]${cle}`)
    })

    it('⚠️ N’A PLUS AUCUNE PHRASE FRANÇAISE EN DUR', async () => {
      /*
       * LE CŒUR DU CONSTAT. Avec le marqueur, tout ce qui passe par la traduction devient
       * reconnaissable : ce qui reste en français est, par construction, écrit en dur dans le
       * gabarit. Le titre et le message sont fournis par l'appelant, déjà traduits — ils ne
       * comptent pas.
       */
      marquerLesTraductions = true

      const html = await render(NotificationEmail, { ...PROPS, locale: 'en' })

      for (const phrase of [
        'Bonjour',
        'Gérer mes notifications',
        'Soutenir le projet',
        'équipe de Juggling Convention',
        'envoyé automatiquement',
      ]) {
        expect(html, phrase).not.toContain(phrase)
      }
    })

    it('⚠️ DÉCLARE LA LANGUE DU DESTINATAIRE DANS `lang`', async () => {
      /*
       * `<Html lang="fr">` était écrit en dur. L'attribut décide de la langue de la synthèse vocale
       * et du correcteur orthographique du client de messagerie : un courriel anglais annoncé
       * français s'y lit avec l'accent français.
       */
      const html = await render(NotificationEmail, { ...PROPS, locale: 'en' })

      expect(html).toMatch(/<html[^>]*lang="en"/i)
    })

    it('⚠️ MÈNE AUX PRÉFÉRENCES, et non à la page du profil', async () => {
      /*
       * Le lien menait à `/profile`, où rien ne parle de notifications : on cliquait « Gérer mes
       * notifications » et il fallait les chercher.
       */
      const html = await render(NotificationEmail, { ...PROPS, locale: 'fr' })

      expect(html).toContain(`${PROPS.baseUrl}${CHEMIN_DES_PREFERENCES}`)
      expect(CHEMIN_DES_PREFERENCES).toBe('/profile/notifications')
      expect(html).not.toContain(`${PROPS.baseUrl}/profile"`)
    })

    it('rend du vrai français quand c’est la langue du destinataire', async () => {
      /*
       * LE TÉMOIN, et il est indispensable. Sans lui, un gabarit qui n'afficherait plus aucune de
       * ces chaînes — ou qui rendrait les clés brutes, ce que fait `translateServerSide` quand une
       * clé manque — satisferait tous les cas ci-dessus.
       */
      const html = await render(NotificationEmail, { ...PROPS, locale: 'fr' })

      expect(html).toContain('Bonjour Alice,')
      expect(html).toMatch(/<html[^>]*lang="fr"/i)
      // Et surtout pas de clé brute, qui est ce que la traduction rend quand elle ne trouve pas.
      expect(html).not.toContain('notifications.email.')
    })

    it('garde le français par défaut, sans langue passée', async () => {
      // Six des sept gabarits du dépôt n'ont pas encore de langue à passer : leur emballage doit
      // rester celui d'avant, et non une clé brute ou du vide.
      const html = await render(NotificationEmail, PROPS)

      expect(html).toContain('Bonjour Alice,')
      expect(html).toMatch(/<html[^>]*lang="fr"/i)
    })
  })

  describe('la version texte', () => {
    it('⚠️ PORTE LA SALUTATION ET LE LIEN D’ACTION', async () => {
      /*
       * Elle était le message nu. Les clients qui n'affichent pas le HTML — et les filtres
       * anti-pourriel, qui la lisent pour juger — n'y voyaient aucun moyen d'agir : le bouton
       * n'existait que dans la version HTML.
       */
      const texte = texteDeCourriel({ ...PROPS, locale: 'fr' })

      expect(texte).toContain(salutationDeCourriel('Alice', 'fr'))
      expect(texte).toContain(PROPS.message)
      expect(texte).toContain('https://juggling-convention.com/editions/7/carpool')
      expect(texte).toContain(PROPS.actionText)
    })

    it('rend l’URL ABSOLUE, même pour un chemin relatif', () => {
      // `/editions/7` ne mène nulle part dans un courriel : il n'y a pas de page courante.
      const texte = texteDeCourriel({ ...PROPS, actionUrl: '/editions/7', locale: 'fr' })

      expect(texte).toContain('https://juggling-convention.com/editions/7')
    })

    it('n’invente pas de lien quand la notification n’en porte pas', () => {
      /*
       * LE TÉMOIN. Sans lui, un texte qui collerait toujours une URL satisferait le cas ci-dessus —
       * et une notification sans action afficherait un lien vers la racine du site, qui ne mène à
       * rien de ce dont elle parle.
       */
      const texte = texteDeCourriel({
        prenom: 'Alice',
        message: 'Rien à faire',
        baseUrl: PROPS.baseUrl,
        locale: 'fr',
      })

      expect(texte).not.toContain('/editions/')
      expect(texte).toContain('Rien à faire')
    })

    it('suit la langue, elle aussi', () => {
      marquerLesTraductions = true

      const texte = texteDeCourriel({ ...PROPS, locale: 'en' })

      expect(texte).toContain('[en]notifications.email.greeting')
      expect(texte).toContain('[en]notifications.email.signature')
    })

    it('dit comment se désabonner', () => {
      // La même adresse que l'en-tête `List-Unsubscribe` : un seul endroit à connaître.
      const texte = texteDeCourriel({ ...PROPS, locale: 'fr' })

      expect(texte).toContain(`${PROPS.baseUrl}${CHEMIN_DES_PREFERENCES}`)
    })
  })

  describe('les clés elles-mêmes', () => {
    it('existent toutes en français', () => {
      /*
       * `translateServerSide` rend LA CLÉ quand elle ne trouve pas la traduction — pas d'erreur,
       * pas de trace, juste `notifications.email.signature` au milieu d'un courriel. Ce cas est la
       * seule chose qui empêche une faute de frappe dans une clé de partir en production.
       */
      const habillage = habillageDeCourriel('fr')

      for (const [champ, valeur] of Object.entries(habillage)) {
        expect(valeur, champ).not.toContain('notifications.email.')
      }
      expect(salutationDeCourriel('Alice', 'fr')).toContain('Alice')
    })
  })
})
