import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useAuthStore } from '../../../app/stores/auth'

/**
 * La langue choisie dans le profil s'applique à l'interface.
 *
 * ⚠️ CE QUI N'ALLAIT PAS. Le champ `preferredLanguage` existait dans le profil, s'enregistrait
 * bien, et n'avait AUCUN effet sur l'interface : celle-ci suivait la langue du navigateur, ou le
 * cookie i18n. Quelqu'un qui choisissait le français sur un ordinateur en anglais voyait son choix
 * retenu — et l'interface rester en anglais à chaque visite.
 *
 * Un réglage sans effet est pire qu'un réglage absent : on le rechange, en croyant s'être trompé.
 *
 * Deux moitiés étaient manquantes, et il fallait les deux : le serveur ne renvoyait même pas le
 * champ dans `/api/session/me` (ajouté au `select` et au type partagé), et le client ne faisait
 * rien de la valeur.
 *
 * 🔬 CES TESTS PORTENT SUR LA DÉCISION, pas sur le rendu : quand bascule-t-on, et quand s'abstient-
 * on. C'est là que le défaut vivait, et c'est ce qui se vérifie sans navigateur.
 */

const changerDeLangue = vi.hoisted(() => vi.fn(async () => undefined))
const etatI18n = vi.hoisted(() => ({
  locale: { value: 'en' } as { value: string },
  locales: { value: [{ code: 'fr' }, { code: 'en' }, { code: 'nl' }] },
}))

vi.stubGlobal('useChangementDeLangue', () => ({ changerDeLangue }))

/*
 * ⚠️ ON BOUCHE `useNuxtApp`, PAS `useI18n`, ET C'EST TOUT L'ENJEU DE CE FICHIER.
 *
 * Ces tests bouchaient `useI18n` — exactement l'appel qui était cassé. `useI18n` exige d'être
 * appelé au sommet d'un `setup`, et dans une action Pinia vue-i18n lève « Must be called at the
 * top of a `setup` function ». Le `try/catch` de la fonction avalait la levée : les trois tests
 * passaient au vert, la langue du profil ne s'appliquait jamais, et une erreur était journalisée
 * à CHAQUE chargement de page d'un utilisateur connecté. Signalé par l'utilisateur le 05/10/2026,
 * six jours après le correctif #629 censé rendre ce réglage effectif.
 *
 * 📍 La leçon, et elle vaut au-delà de ce fichier : **un bouchon placé sur l'appel fautif rend le
 * test aveugle à ce qu'il doit garder.** Il faut boucher la même porte que le code emploie — ici
 * `useNuxtApp().$i18n` — pour qu'un retour à `useI18n` fasse tomber le test.
 */
vi.stubGlobal('useNuxtApp', () => ({ $i18n: etatI18n }))

describe('appliquerLaLangueDuProfil', () => {
  let store: ReturnType<typeof useAuthStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useAuthStore()
    changerDeLangue.mockClear()
    etatI18n.locale.value = 'en'
  })

  it('bascule sur la langue du profil quand elle diffère', async () => {
    await store.appliquerLaLangueDuProfil('fr')

    expect(changerDeLangue).toHaveBeenCalledWith('fr')
  })

  it('ne fait RIEN quand la langue est déjà la bonne', async () => {
    /*
     * ⚠️ « SI ELLE DIFFÈRE » N'EST PAS UNE OPTIMISATION. Rejouer le changement vers la langue déjà
     * active vide le cache des domaines de traduction et les recharge TOUS — à chaque chargement
     * de page, pour tout le monde. Le coût serait invisible en développement et bien réel en
     * production.
     */
    etatI18n.locale.value = 'fr'

    await store.appliquerLaLangueDuProfil('fr')

    expect(changerDeLangue).not.toHaveBeenCalled()
  })

  it('ne fait rien sans langue choisie', async () => {
    // `preferredLanguage` est nullable : un compte ancien, ou créé par OAuth, peut ne rien porter.
    // L'interface reste alors sur la langue détectée par le navigateur.
    await store.appliquerLaLangueDuProfil(null)

    expect(changerDeLangue).not.toHaveBeenCalled()
  })

  it('ignore une langue que l’application ne sert pas', async () => {
    /*
     * Un code retiré depuis, ou saisi de travers en base. Tenter la bascule rendrait l'écran en
     * CLÉS BRUTES — `edition.title` au lieu d'un titre — sans lever d'erreur : le pire résultat
     * possible, puisqu'il ressemble à une panne de l'application plutôt qu'à une donnée invalide.
     */
    await store.appliquerLaLangueDuProfil('xx')

    expect(changerDeLangue).not.toHaveBeenCalled()
  })

  it('un échec du changement ne remonte PAS', async () => {
    /*
     * L'invariant qui protège l'essentiel : cette bascule est déclenchée depuis l'hydratation de
     * la session, dont dépend tout le reste de la page. Ne pas pouvoir appliquer une préférence de
     * langue ne doit pas faire échouer l'hydratation — on se retrouverait déconnecté pour un
     * réglage d'affichage.
     */
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {})
    changerDeLangue.mockRejectedValueOnce(new Error('domaine introuvable'))

    await expect(store.appliquerLaLangueDuProfil('fr')).resolves.toBeUndefined()
    expect(erreur).toHaveBeenCalled()

    erreur.mockRestore()
  })
})

describe('la porte par laquelle i18n est atteint', () => {
  /*
   * ⚠️ CE TEST EST LE GARDE-FOU DU PRÉCÉDENT DÉFAUT. `useI18n` n'est volontairement PAS bouché
   * dans ce fichier : si quelqu'un y revient, l'appel échouera — soit parce que le global est
   * absent, soit, dans le navigateur, parce que vue-i18n refuse d'être appelé hors d'un `setup`.
   *
   * On le constate en retirant `useNuxtApp` : la fonction ne doit alors RIEN faire, ce qui prouve
   * qu'elle passe bien par cette porte-là et par aucune autre.
   */
  it('passe par useNuxtApp().$i18n, et non par useI18n', async () => {
    setActivePinia(createPinia())
    const store = useAuthStore()
    changerDeLangue.mockClear()

    const vrai = (globalThis as Record<string, unknown>).useNuxtApp
    ;(globalThis as Record<string, unknown>).useNuxtApp = undefined

    // Sans cette porte, la fonction lève et son `try/catch` avale : aucune bascule.
    await store.appliquerLaLangueDuProfil('fr')
    expect(changerDeLangue).not.toHaveBeenCalled()
    ;(globalThis as Record<string, unknown>).useNuxtApp = vrai
    etatI18n.locale.value = 'en'
    await store.appliquerLaLangueDuProfil('fr')
    expect(changerDeLangue).toHaveBeenCalledWith('fr')
  })

  it('n’emploie plus `useI18n` dans le code du store', () => {
    /*
     * Lecture du source, parce que c'est la seule façon de l'affirmer sans navigateur : un bouchon
     * de `useI18n` ferait passer n'importe quelle version. Volontairement limité à la fonction
     * concernée — le store peut légitimement employer `useI18n` ailleurs, dans un `setup`.
     */
    const source = readFileSync(resolve(__dirname, '../../../app/stores/auth.ts'), 'utf8')
    // Les repères sont les DÉCLARATIONS, signature comprise : `initializeAuth(` seul apparaît
    // d'abord dans un commentaire bien plus haut, et le découpage partait alors à reculons en
    // rendant une chaîne vide — un test qui passait sur du néant. Attrapé par ce test lui-même.
    const debut = source.indexOf('async appliquerLaLangueDuProfil(')
    const fin = source.indexOf('initializeAuth(): Promise<void>')
    expect(debut).toBeGreaterThan(-1)
    expect(fin).toBeGreaterThan(debut)
    /*
     * ⚠️ LES COMMENTAIRES SONT RETIRÉS AVANT DE CHERCHER, et c'est indispensable : le commentaire
     * qui EXPLIQUE le correctif cite forcément `useI18n()` — « useNuxtApp().$i18n et non
     * useI18n() ». Sans ce nettoyage, le test tombait sur l'explication du défaut au lieu du
     * défaut. Le remède n'est pas de reformuler la phrase : un commentaire explique le code, il
     * ne doit pas en faire partie. C'est exactement le piège que `check-i18n` nous a déjà coûté
     * six fois.
     */
    const codeSeul = source
      .slice(debut, fin)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')

    expect(codeSeul).not.toMatch(/\buseI18n\(/)
    expect(codeSeul).toContain('useNuxtApp()')
  })
})
