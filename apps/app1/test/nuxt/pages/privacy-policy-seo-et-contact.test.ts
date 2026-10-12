import fs from 'node:fs'
import path from 'node:path'

import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Le titre d'onglet était français pour les treize langues, et l'adresse de contact en dur
 * — constat F4 des petits modules.
 *
 * ## Le défaut
 *
 * Tout le corps de cette page passe par i18n ; son titre de page, non. Un lecteur anglophone
 * lisait « Politique de confidentialité » dans son onglet, et les moteurs indexaient la
 * description française quelle que soit la version servie.
 *
 * ⚠️ Et la chaîne était écrite **trois fois** : `definePageMeta.title`, sa `description`, et
 * `useHead`. Les deux premières ne servaient à rien — `useHead` les écrase — mais leur présence
 * faisait croire que corriger l'une suffisait.
 *
 * L'adresse du responsable du traitement, elle, était écrite au milieu d'une ligne dont l'autre
 * moitié passait déjà par i18n.
 *
 * ## Ce que chaque moitié de ce fichier prouve
 *
 * L'adresse est éprouvée **en montant la page** : la configuration est remplacée, et l'on vérifie
 * que c'est bien elle qui s'affiche. Une lecture du code ne dirait pas d'où vient la valeur.
 *
 * Le titre et la description passent par une garde de **source** : `useSeoMeta` les pose dans
 * l'entête du document, qu'un montage de composant ne rend pas, et asserter le texte traduit
 * serait de toute façon transitoire — l'environnement de test est en anglais.
 */
const config = vi.hoisted(() => ({ adresse: 'contact@exemple.test' }))

/*
 * ⚠️ LE BLOC `app` N'EST PAS DÉCORATIF. Remplacer `useRuntimeConfig` par le seul `public` fait
 * échouer la mise en place de Nuxt elle-même, AVANT tout test : son routeur lit `app.baseURL` par
 * ce même appel, et `useRouter()` rendait donc `undefined`. Les six cas sortaient « skipped » sur
 * un `TypeError` étranger à ce qu'ils mesurent.
 */
mockNuxtImport('useRuntimeConfig', () => () => ({
  app: { baseURL: '/', buildAssetsDir: '/_nuxt/', cdnURL: '' },
  public: { contactEmail: config.adresse },
}))

import PageConfidentialite from '../../../app/pages/privacy-policy.vue'

let monte: { unmount: () => void; html: () => string } | null = null
afterEach(() => {
  monte?.unmount()
  monte = null
  config.adresse = 'contact@exemple.test'
})

describe("confidentialité — l'adresse de contact vient de la configuration", () => {
  it("affiche l'adresse déclarée, et non une adresse écrite dans le gabarit", async () => {
    config.adresse = 'rgpd@convention.test'
    monte = (await mountSuspended(PageConfidentialite)) as never
    expect(monte!.html()).toContain('rgpd@convention.test')
    // 📍 L'adresse d'origine ne doit plus apparaître : c'est ce qui distingue « lu de la
    // configuration » de « écrit en dur à côté d'une valeur configurable ».
    expect(monte!.html()).not.toContain('powange@gmail.com')
  })

  it('en fait un lien cliquable', async () => {
    config.adresse = 'rgpd@convention.test'
    monte = (await mountSuspended(PageConfidentialite)) as never
    expect(monte!.html()).toContain('mailto:rgpd@convention.test')
  })
})

const RACINE = path.resolve(__dirname, '../../../../..')
const lire = (relatif: string) => fs.readFileSync(path.resolve(RACINE, relatif), 'utf8')

describe("confidentialité — l'onglet et la description sont traduits", () => {
  const PAGE = 'apps/app1/app/pages/privacy-policy.vue'

  it('la chaîne française figée a disparu du code', () => {
    // Elle y était TROIS fois.
    expect(lire(PAGE)).not.toContain("title: 'Politique de confidentialité'")
    expect(lire(PAGE)).not.toContain('protection des données personnelles')
  })

  it('le titre et la description passent par des clés', () => {
    const code = lire(PAGE)
    expect(code).toContain('useSeoMeta(')
    expect(code).toContain("t('privacy.title')")
    expect(code).toContain("t('privacy.meta_description')")
  })

  it('les deux clés existent en français', () => {
    const fr = JSON.parse(lire('apps/app1/i18n/locales/fr/privacy.json'))
    expect(fr.privacy.title).toBeTruthy()
    expect(fr.privacy.meta_description).toBeTruthy()
  })

  it("l'adresse de repli est déclarée dans la configuration", () => {
    // Sans ce repli, une instance qui ne déclare rien n'afficherait AUCUN moyen de contact sur la
    // page qui l'exige.
    expect(lire('apps/app1/nuxt.config.ts')).toContain(
      'contactEmail: process.env.NUXT_PUBLIC_CONTACT_EMAIL ||'
    )
  })
})
