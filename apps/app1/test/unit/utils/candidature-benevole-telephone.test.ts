import { getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js'
import { describe, expect, it } from 'vitest'

import { volunteerApplicationBodySchema } from '../../../server/utils/editions/volunteers/applications'

/**
 * Le téléphone d'une candidature bénévole traverse deux moitiés qui doivent s'accorder :
 * le champ à indicatif du formulaire, qui normalise la saisie, et le schéma du point d'API,
 * qui la contrôle. Ce fichier les tient ensemble.
 *
 * Il existe parce qu'elles ne s'accordaient pas. Le formulaire posait un champ de texte libre,
 * dont le contenu partait tel quel : un numéro **collé** depuis les contacts ou un message
 * emporte des espaces insécables, des barres obliques ou un préfixe `tel:`, que le schéma
 * rejette. En production, quelqu'un a réessayé trois fois en vingt-cinq secondes avant
 * d'abandonner.
 *
 * À noter, parce que le diagnostic de départ visait à côté : un `0712345678` tapé simplement
 * passait déjà. Ce n'est pas le « 07 » qui était refusé, c'est la mise en forme du collage.
 */

/**
 * Reproduit `emitValue()` de `app/components/ui/PhoneInput.vue` : ce que le champ à indicatif
 * met réellement dans le corps de la requête.
 *
 * Recopié plutôt qu'importé — la fonction vit dans le `<script setup>` d'un composant, d'où
 * elle n'est pas exportable. Si le composant change, ce test cesse de refléter la réalité :
 * c'est le prix de la duplication, assumé ici faute de mieux, et signalé pour qu'on le sache.
 */
function sortieDuChampIndicatif(saisie: string, pays: 'FR' = 'FR'): string {
  const local = saisie.trim()
  if (!local) return ''
  const parsed = parsePhoneNumberFromString(local, pays)
  if (parsed && parsed.isValid()) return parsed.number
  return `+${getCountryCallingCode(pays)}${local.replace(/\D/g, '')}`
}

const accepte = (phone: string) => volunteerApplicationBodySchema.safeParse({ phone }).success

describe('téléphone d’une candidature bénévole', () => {
  describe('ce que le schéma du point d’API accepte', () => {
    it('accepte le format E.164, celui que produit le champ à indicatif', () => {
      expect(accepte('+33712345678')).toBe(true)
    })

    it('acceptait déjà un numéro national tapé simplement — le « 07 » n’a jamais été en cause', () => {
      expect(accepte('0712345678')).toBe(true)
      expect(accepte('0612345678')).toBe(true)
      expect(accepte('07 12 34 56 78')).toBe(true)
    })

    it('rejette les mises en forme que produit un collage', () => {
      // Espaces insécables : ce que colle un carnet de contacts ou une conversation.
      expect(accepte('07 12 34 56 78')).toBe(false)
      expect(accepte('07/12/34/56/78')).toBe(false)
      expect(accepte('tel:+33712345678')).toBe(false)
    })

    it('laisse passer l’absence de téléphone : le champ est facultatif au niveau du schéma', () => {
      expect(volunteerApplicationBodySchema.safeParse({}).success).toBe(true)
    })
  })

  describe('l’accord entre le champ à indicatif et le schéma', () => {
    const saisies = [
      ['0712345678', 'tapé simplement'],
      ['07 12 34 56 78', 'avec des espaces'],
      ['07 12 34 56 78', 'collé avec des espaces insécables'],
      ['07/12/34/56/78', 'collé avec des barres obliques'],
      ['tel:+33712345678', 'collé depuis un lien'],
      ['+33 7 12 34 56 78', 'saisi à l’international'],
    ] as const

    it.each(saisies)('« %s » (%s) ressort en E.164 et passe le contrôle', (saisie) => {
      const sortie = sortieDuChampIndicatif(saisie)
      expect(sortie).toBe('+33712345678')
      expect(accepte(sortie)).toBe(true)
    })

    it('préfixe un numéro incomplet, que le contrôle rejette alors pour ce qu’il est', () => {
      const sortie = sortieDuChampIndicatif('07 12')
      expect(sortie).toBe('+330712')
      expect(accepte(sortie)).toBe(false)
    })
  })

  describe('la validité réelle du numéro, et pas seulement sa forme', () => {
    it('rejette un numéro français à huit chiffres', () => {
      // Signalé après coup : une candidature était partie avec ce numéro, injoignable. La
      // regex de forme l'acceptait — elle ne regarde que les caractères employés.
      expect(accepte('+3312345678')).toBe(false)
      expect(accepte('12345678')).toBe(false)
    })

    it('accepte les numéros réellement attribués, en France comme ailleurs', () => {
      expect(accepte('+33712345678')).toBe(true)
      expect(accepte('+33612345678')).toBe(true)
      expect(accepte('+3212345678')).toBe(true) // Belgique
      expect(accepte('0712345678')).toBe(true) // format national, replié sur la France
    })

    it('rejette un numéro trop long pour son pays', () => {
      expect(accepte('+337123456789012')).toBe(false)
    })
  })
})
