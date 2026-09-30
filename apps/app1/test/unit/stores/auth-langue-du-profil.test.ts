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
vi.stubGlobal('useI18n', () => etatI18n)

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
