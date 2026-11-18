import fs from 'node:fs'
import path from 'node:path'

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'

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
/*
 * ⚠️ AUCUN BOUCHON DE `useRuntimeConfig` ICI, ET C'EST DÉLIBÉRÉ.
 *
 * Ce fichier en portait un : `mockNuxtImport('useRuntimeConfig', …)` rendant un objet écrit à la
 * main. Or cette fonction substitue l'implémentation ENTIÈRE, donc tout ce que les plugins de Nuxt
 * et des modules y lisent doit être satisfait par cet objet. Trois pannes l'ont montré :
 *
 * 1. sans le bloc `app`, le routeur de Nuxt lit `app.baseURL` par ce même appel : `useRouter()`
 *    rend `undefined` et les six cas sortent « skipped » sur un `TypeError` ;
 * 2. le 18/11/2026, la montée de `@nuxtjs/seo` en 6.0.1 a fait tomber les deux cas qui montent la
 *    page, sur **`useI18n()` qui lève dans son `setup`** (vue-i18n code 27 : i18n non installé).
 *    Le symptôme désigne la page, qui rend parfaitement — HTTP 200 vérifié en développement ET en
 *    production. Mesuré : avec `nuxtseo: false`, les six cas repassaient ;
 * 3. un relais « tolérant » rendant `{}` pour toute clé absente a bien fait passer les plugins,
 *    mais `unhead` tombait alors sur `TypeError: object is not a function` — il lisait une clé
 *    dont il attendait une fonction. **Un bouchon trop complaisant déplace la panne.**
 *
 * 📍 La leçon : deviner les clés qu'un bouchon doit fournir ne passe pas à l'échelle, et la liste
 * change à chaque montée de dépendance. On modifie donc la configuration RÉELLE de l'application
 * de test, et on la remet en place après — ce que le test mesure est inchangé, et plus rien ici ne
 * dépend des modules installés.
 */
import PageConfidentialite from '../../../app/pages/privacy-policy.vue'

/*
 * ⚠️ TYPÉ PAR LE RETOUR DE `mountSuspended`, et non par une forme écrite à la main.
 *
 * La version précédente déclarait `{ unmount, html } | null` puis assignait `as never` : TypeScript
 * réduit alors la variable à `never` par analyse de flux, et chaque `monte!.html()` devenait un
 * TS2339 « la propriété n'existe pas ». Trois erreurs de typage pour un raccourci d'écriture.
 * Motif repris de `entry-modal-ligne-previsionnelle.test.ts`.
 */
let monte: Awaited<ReturnType<typeof mountSuspended>> | null = null
/** Relevée au moment où on la remplace, pour la remettre — et pour servir de témoin. */
let adresseOrigine: string | undefined

const publique = () => useRuntimeConfig().public as unknown as Record<string, unknown>

/** Déclare l'adresse dans la configuration réelle, en gardant trace de celle qu'elle remplace. */
const declarerAdresse = (adresse: string) => {
  adresseOrigine = publique().contactEmail as string | undefined
  expect(
    adresseOrigine,
    'le témoin est inutilisable : la configuration déclare déjà l’adresse d’essai'
  ).not.toBe(adresse)
  publique().contactEmail = adresse
}

afterEach(() => {
  monte?.unmount()
  monte = null
  if (adresseOrigine !== undefined) {
    publique().contactEmail = adresseOrigine
    adresseOrigine = undefined
  }
})

describe("confidentialité — l'adresse de contact vient de la configuration", () => {
  const ADRESSE = 'rgpd@convention.test'

  it("affiche l'adresse déclarée, et non une adresse écrite dans le gabarit", async () => {
    declarerAdresse(ADRESSE)
    monte = await mountSuspended(PageConfidentialite)

    expect(monte!.html()).toContain(ADRESSE)
    /*
     * 📍 L'adresse QUE LA CONFIGURATION DÉCLARAIT ne doit plus apparaître : c'est ce qui distingue
     * « lu de la configuration » de « écrit en dur à côté d'une valeur configurable ». Visée par
     * le témoin relevé plus haut, et non par une adresse recopiée ici — qui deviendrait fausse au
     * premier changement de configuration, et qui n'a rien à faire dans un fichier de test.
     */
    expect(monte!.html()).not.toContain(adresseOrigine!)
  })

  it('en fait un lien cliquable', async () => {
    declarerAdresse(ADRESSE)
    monte = await mountSuspended(PageConfidentialite)
    expect(monte!.html()).toContain(`mailto:${ADRESSE}`)
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
