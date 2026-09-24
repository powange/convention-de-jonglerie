import { getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js'
import { describe, expect, it } from 'vitest'

import { manquementsDeLaCandidature } from '../../../../../layers/volunteers/app/utils/validation-candidature'
import { volunteerApplicationBodySchema } from '../../../server/utils/editions/volunteers/applications'
import { telephoneCandidatureAcceptable } from '../../../shared/utils/telephone-candidature'

/**
 * Le formulaire et le point d'API doivent rendre le MÊME verdict sur un téléphone.
 *
 * Ils ne le rendaient pas : le formulaire vérifiait que le champ n'était pas vide, le serveur
 * qu'il contenait un numéro réel. Comme le champ à indicatif émet toujours quelque chose — « 123 »
 * devient `+33123` —, la candidature partait, revenait refusée, et le message « Données invalides
 * (phone : Numéro de téléphone invalide) » s'affichait en toast sans désigner le champ. Le journal
 * d'erreurs de production en portait la trace, classée « bruit attendu » à force de revenir.
 *
 * Ce fichier interroge les deux moitiés sur les mêmes valeurs. Il échoue dès qu'elles se
 * séparent — c'est tout ce qu'on lui demande.
 */

/**
 * Reproduit `emitValue()` de `app/components/ui/PhoneInput.vue` : ce que le champ met réellement
 * dans le corps de la requête.
 *
 * Recopié plutôt qu'importé — la fonction vit dans le `<script setup>` d'un composant, d'où elle
 * n'est pas exportable. La duplication est assumée ici, et signalée pour qu'on le sache.
 */
function sortieDuChampIndicatif(saisie: string, pays: 'FR' = 'FR'): string {
  const local = saisie.trim()
  if (!local) return ''
  const parsed = parsePhoneNumberFromString(local, pays)
  if (parsed && parsed.isValid()) return parsed.number
  return `+${getCountryCallingCode(pays)}${local.replace(/\D/g, '')}`
}

const serveurAccepte = (phone: string) =>
  volunteerApplicationBodySchema.safeParse({ phone }).success

const formulaireAccepte = (phone: string) =>
  !manquementsDeLaCandidature({ phone }).some((manquement) => manquement.champ === 'phone')

/** Des saisies plausibles : trois valides, et les formes qui faisaient diverger les deux moitiés. */
const SAISIES = [
  '0712345678',
  '07 12 34 56 78',
  '+33712345678',
  '123',
  '0612',
  '99999999999999',
  '00',
  'abcdefgh',
]

describe('téléphone : le formulaire et le point d’API disent la même chose', () => {
  for (const saisie of SAISIES) {
    it(`même verdict sur « ${saisie} »`, () => {
      const emis = sortieDuChampIndicatif(saisie)
      expect(formulaireAccepte(emis)).toBe(serveurAccepte(emis))
    })
  }

  it('refuse ce qu’un champ incomplet produit, au lieu de le laisser partir', () => {
    // La valeur exacte qui revenait de production, et le cœur du correctif.
    expect(sortieDuChampIndicatif('123')).toBe('+33123')
    expect(formulaireAccepte('+33123')).toBe(false)
    expect(serveurAccepte('+33123')).toBe(false)
  })

  it('laisse passer un numéro valide, tapé simplement ou avec son indicatif', () => {
    expect(formulaireAccepte('0712345678')).toBe(true)
    expect(formulaireAccepte('+33712345678')).toBe(true)
  })

  it('distingue « absent » de « invalide » : les deux messages ne sont pas le même', () => {
    const absent = manquementsDeLaCandidature({ phone: '' })
    const invalide = manquementsDeLaCandidature({ phone: '+33123' })
    expect(absent.find((m) => m.champ === 'phone')?.cle).toBe('validation.phone_required')
    expect(invalide.find((m) => m.champ === 'phone')?.cle).toBe('validation.phone_invalid')
  })
})

describe('téléphone du contact d’urgence', () => {
  const manquementContact = (emergencyContactPhone: string) =>
    manquementsDeLaCandidature({ phone: '0712345678', emergencyContactPhone }).find(
      (m) => m.champ === 'emergencyContactPhone'
    )

  it('reste facultatif : vide ne vaut pas invalide', () => {
    // Le schéma du serveur accepte explicitement la chaîne vide sur ce champ, parce que le
    // formulaire renvoie ses champs tels quels lors d'une modification.
    expect(manquementContact('')).toBeUndefined()
  })

  it('refuse un numéro saisi mais invalide', () => {
    expect(manquementContact('+33123')?.cle).toBe('validation.emergency_contact_phone_invalid')
  })

  it('accepte un numéro valide', () => {
    expect(manquementContact('+33712345678')).toBeUndefined()
  })
})

describe('la règle partagée suit la borne de longueur du schéma', () => {
  it('refuse en deçà de six caractères, comme le schéma', () => {
    expect(telephoneCandidatureAcceptable('+331')).toBe(false)
    expect(serveurAccepte('+331')).toBe(false)
  })

  it('refuse les mises en forme d’un collage, comme le schéma', () => {
    for (const colle of ['07/12/34/56/78', 'tel:+33712345678']) {
      expect(telephoneCandidatureAcceptable(colle)).toBe(false)
      expect(serveurAccepte(colle)).toBe(false)
    }
  })
})
