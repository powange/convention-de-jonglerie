import { chargerTraductionsPourRoute } from '~/utils/chargement-traductions'

/**
 * Changer la langue de l'interface, avec ses traductions.
 *
 * ⚠️ POURQUOI CE COMPOSABLE EXISTE. Le projet charge ses traductions PAR DOMAINE et PAR ROUTE
 * (lazy loading) : changer `locale` ne suffit pas, il faut aussi charger les domaines de la page
 * courante dans la nouvelle langue. Sans cela, l'écran reste sur ses clés brutes — `edition.title`
 * au lieu d'un titre — sans la moindre erreur.
 *
 * La séquence vivait dans `SelectLanguage.vue`, et seul ce composant savait la faire. Deux
 * appelants la demandent désormais : le sélecteur, et l'application de la langue du PROFIL à
 * l'hydratation de la session.
 */
export function useChangementDeLangue() {
  /**
   * Bascule vers `nouvelleLocale` : vide le cache des domaines, recharge ceux de la route
   * courante, puis change la locale.
   *
   * ⚠️ L'ORDRE COMPTE. Les traductions sont chargées AVANT `setLocale` : l'inverse rendrait la
   * page dans la nouvelle langue alors que ses messages ne sont pas encore là — un clignotement
   * de clés brutes, court mais bien visible.
   */
  const changerDeLangue = async (nouvelleLocale: string) => {
    const nuxtApp = useNuxtApp()
    const i18n = nuxtApp.$i18n
    const route = useRoute()

    /*
     * Réinitialiser le cache des domaines déjà chargés pour cette locale, sinon `@nuxtjs/i18n`
     * considère le travail fait et ne rappelle aucun loader.
     */
    ;(nuxtApp as any)[`_loaded_${nouvelleLocale}`] = new Set()

    await chargerTraductionsPourRoute({
      chemin: route.path,
      locale: nouvelleLocale,
      fusionner: (locale, messages) => i18n.mergeLocaleMessage(locale, messages as any),
    })

    await (i18n as any).setLocale(nouvelleLocale)
  }

  return { changerDeLangue }
}
