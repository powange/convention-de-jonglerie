import { describe, expect, it } from 'vitest'

import {
  extraireErreursChamps,
  messageErreurValidation,
} from '../../../app/utils/erreurs-validation'

/**
 * Le détail par champ arrive à DEUX niveaux dans l'erreur, pas un.
 *
 * `handleValidationError` répond `createError({ status: 400, message: 'Données invalides',
 * data: { errors } })` ; h3 sérialise en `{ statusCode, message, data: { errors } }` et ofetch
 * met tout le corps dans `error.data`. Le chemin est donc `error.data.data.errors`.
 *
 * Ce test existe parce que le chemin à un seul niveau avait été retenu : il rend `undefined`
 * sans broncher, le formulaire n'affiche aucun marqueur, et le refus paraît venir de nulle
 * part. Rien ne le signale — ni le lint, ni le typecheck, l'erreur étant typée `any`.
 */

/** L'erreur telle qu'ofetch la produit face à `handleValidationError`. */
const erreurReelle = (errors: Record<string, string>) => ({
  statusCode: 400,
  message: 'Données invalides',
  data: {
    statusCode: 400,
    statusMessage: 'Données invalides',
    message: 'Données invalides',
    data: { errors, message: 'Veuillez corriger les erreurs de saisie' },
  },
})

describe('extraireErreursChamps', () => {
  it('lit le détail à deux niveaux, tel que le rend réellement l’API', () => {
    expect(extraireErreursChamps(erreurReelle({ phone: 'Numéro de téléphone invalide' }))).toEqual({
      phone: 'Numéro de téléphone invalide',
    })
  })

  it('accepte aussi la forme à plat, employée par quelques points d’API', () => {
    expect(extraireErreursChamps({ data: { errors: { nom: 'Nom requis' } } })).toEqual({
      nom: 'Nom requis',
    })
  })

  it('rend null quand il n’y a pas de détail par champ', () => {
    expect(extraireErreursChamps({ message: 'Droits insuffisants' })).toBeNull()
    expect(extraireErreursChamps({ data: { message: 'Boum' } })).toBeNull()
    expect(extraireErreursChamps(undefined)).toBeNull()
    expect(extraireErreursChamps({ data: { data: { errors: {} } } })).toBeNull()
  })

  it('écarte les valeurs qui ne sont pas des messages', () => {
    expect(
      extraireErreursChamps({ data: { data: { errors: { phone: 'Invalide', teams: ['x'] } } } })
    ).toEqual({ phone: 'Invalide' })
  })
})

describe('messageErreurValidation', () => {
  it('préfère le détail par champ à un « Données invalides » nu', () => {
    const erreur = erreurReelle({ phone: 'Numéro de téléphone invalide' })
    const champs = extraireErreursChamps(erreur)
    expect(messageErreurValidation(erreur, champs, 'repli')).toBe('Numéro de téléphone invalide')
  })

  it('joint plusieurs refus', () => {
    const erreur = erreurReelle({ phone: 'Invalide', nom: 'Requis' })
    expect(messageErreurValidation(erreur, extraireErreursChamps(erreur), 'repli')).toBe(
      'Invalide · Requis'
    )
  })

  it('retombe sur le message de l’API, puis sur le repli fourni', () => {
    expect(
      messageErreurValidation({ data: { message: 'Droits insuffisants' } }, null, 'repli')
    ).toBe('Droits insuffisants')
    expect(messageErreurValidation({}, null, 'repli')).toBe('repli')
  })
})
