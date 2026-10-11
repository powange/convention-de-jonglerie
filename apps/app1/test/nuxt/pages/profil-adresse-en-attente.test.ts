import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'

/** Le compte que le magasin rend, réglé cas par cas. */
const compte = vi.hoisted(() => ({
  valeur: {} as Record<string, unknown>,
  avecMotDePasse: true,
}))

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({
    user: compte.valeur,
    updateUser: () => {},
  }),
}))

registerEndpoint('/api/profile/has-password', () => ({
  data: { hasPassword: compte.avecMotDePasse },
}))

import PageInformations from '../../../app/pages/profile/informations.vue'

/**
 * Le BRANCHEMENT du changement d'adresse en deux temps — constat B2.
 *
 * ## ⚠️ POURQUOI CE FICHIER EXISTE, alors que le serveur a ses vingt-deux cas
 *
 * Le serveur n'écrit plus l'adresse : il attend un code. Si l'écran ne le DIT pas, la personne tape
 * une nouvelle adresse, lit « profil enregistré », voit l'ancienne revenir au rechargement — et
 * croit son changement refusé en silence. Le correctif serveur, seul, rendrait le défaut PIRE que
 * le défaut d'origine.
 *
 * Et si le champ de mot de passe n'apparaît pas, le serveur refuse systématiquement : la
 * fonctionnalité serait inatteignable.
 *
 * ## ⚠️⚠️ ON VISE DES ANCRES `data-*`, PAS LE TEXTE
 *
 * Les onze clés de ce lot sont créées en français seulement ; l'environnement de test est en
 * anglais, donc elles y ressortent BRUTES — et vue-i18n ne fait aucune interpolation sur une clé
 * absente, si bien que l'adresse elle-même n'apparaîtrait pas dans le libellé. Asserter le texte
 * échouerait pour une raison étrangère au lot, et asserter la clé brute serait vrai jusqu'à la
 * synchronisation des traductions.
 */
const MON_ADRESSE = 'camille@exemple.test'

const utilisateur = (extra: Record<string, unknown> = {}) => ({
  id: 7,
  email: MON_ADRESSE,
  pseudo: 'camille',
  nom: 'Martin',
  prenom: 'Camille',
  ...extra,
})

let monte: { unmount: () => void } | null = null
afterEach(() => {
  monte?.unmount()
  monte = null
})

const rendre = async (user: Record<string, unknown>, avecMotDePasse = true) => {
  compte.valeur = user
  compte.avecMotDePasse = avecMotDePasse
  const wrapper = await mountSuspended(PageInformations)
  monte = wrapper
  // `has-password` est interrogé dans `onMounted` : la réponse arrive après le montage.
  await new Promise((r) => setTimeout(r, 30))
  await wrapper.vm.$nextTick()
  return wrapper
}

describe('Profil — l’adresse en attente de confirmation', () => {
  it('⚠️ ANNONCE LA DEMANDE EN COURS, avec de quoi saisir le code', async () => {
    const page = await rendre(utilisateur({ pendingEmail: 'neuve@exemple.test' }))

    expect(page.find('[data-adresse-en-attente]').exists()).toBe(true)
    expect(page.find('[data-code-adresse]').exists()).toBe(true)
  })

  it('ne dit rien quand aucun changement n’est en cours', async () => {
    /*
     * LE TÉMOIN. Sans lui, un écran qui afficherait TOUJOURS l'encart satisferait le cas précédent
     * — et chacun lirait « adresse en attente de confirmation » sur un profil parfaitement à jour.
     */
    const page = await rendre(utilisateur())

    expect(page.find('[data-adresse-en-attente]').exists()).toBe(false)
    expect(page.find('[data-code-adresse]').exists()).toBe(false)
  })

  it('⚠️ NE DEMANDE LE MOT DE PASSE QUE SI L’ADRESSE EST MODIFIÉE', async () => {
    const page = await rendre(utilisateur())

    // Au repos : aucun mot de passe réclamé pour corriger un prénom.
    expect(page.find('[data-mot-de-passe-adresse]').exists()).toBe(false)

    const champ = page.find('input[type="email"]')
    expect(champ.exists(), 'le champ d’adresse est introuvable').toBe(true)
    await champ.setValue('neuve@exemple.test')
    await page.vm.$nextTick()

    expect(page.find('[data-mot-de-passe-adresse]').exists()).toBe(true)
  })

  it('ne le demande jamais à un compte sans mot de passe', async () => {
    /*
     * Les comptes OAuth n'en ont pas : le réclamer rendrait leur changement d'adresse impossible.
     * Le serveur porte déjà cette nuance, l'écran s'y accorde.
     */
    const page = await rendre(utilisateur(), false)

    const champ = page.find('input[type="email"]')
    await champ.setValue('neuve@exemple.test')
    await page.vm.$nextTick()

    expect(page.find('[data-mot-de-passe-adresse]').exists()).toBe(false)
  })
})
