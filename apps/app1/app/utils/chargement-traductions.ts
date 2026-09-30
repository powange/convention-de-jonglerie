import { getTranslationsToLoad, translationLoaders } from '~/utils/translation-loaders'

/**
 * Charger les domaines de traduction d'une route dans une locale donnée.
 *
 * ⚠️ POURQUOI CETTE FONCTION EXISTE. La boucle vivait dans `SelectLanguage.vue`, et seul ce
 * composant savait la faire. Le jour où il a fallu appliquer la langue du PROFIL au moment de
 * l'hydratation de la session, il n'y avait le choix qu'entre la recopier ou l'extraire — et
 * recopiée, elle aurait divergé au premier domaine ajouté : la langue changée à la main aurait
 * chargé ses traductions, celle du profil non, et la moitié de l'écran serait restée en clés
 * brutes. Sans erreur, comme toujours avec l'i18n de ce projet.
 *
 * Les dépendances sont passées en arguments plutôt que lues par des auto-imports : c'est ce qui
 * rend la fonction éprouvable sans monter de composant Nuxt, et la décision qu'elle porte — quels
 * domaines, dans quel ordre, et que faire d'un loader qui échoue — est précisément celle qu'on
 * veut vérifier.
 */
export interface DependancesDeChargement {
  /** Le chemin de la route courante, qui détermine les domaines à charger. */
  chemin: string
  /** La locale visée. */
  locale: string
  /** Comment fusionner les messages obtenus (en production : `i18n.mergeLocaleMessage`). */
  fusionner: (locale: string, messages: Record<string, unknown>) => void
  /** Les loaders, remplaçables dans un test. */
  loaders?: typeof translationLoaders
  /** Le calcul des domaines, remplaçable dans un test. */
  domainesDeLaRoute?: (chemin: string) => string[]
}

/**
 * Charge et fusionne les traductions, et rend la liste des domaines EFFECTIVEMENT chargés.
 *
 * Rendre cette liste n'est pas une commodité de test : c'est le seul moyen, à l'exécution, de
 * distinguer « aucun domaine n'était à charger » de « les loaders ont tous échoué ». Les deux
 * donnent un écran identique.
 */
export async function chargerTraductionsPourRoute(
  deps: DependancesDeChargement
): Promise<string[]> {
  const {
    chemin,
    locale,
    fusionner,
    loaders = translationLoaders,
    domainesDeLaRoute = getTranslationsToLoad,
  } = deps

  const domaines = domainesDeLaRoute(chemin)
  const charges: string[] = []

  for (const domaine of domaines) {
    const loader = loaders[domaine]?.[locale]
    if (!loader) continue

    try {
      const messages = await loader().then((m: any) => m.default || m)
      fusionner(locale, messages)
      charges.push(domaine)
    } catch (error) {
      /*
       * Un domaine qui échoue ne doit pas empêcher les autres : l'écran perdrait alors TOUS ses
       * libellés au lieu d'un seul bloc. On trace et on continue — c'est déjà ce que faisait
       * `SelectLanguage`, et ce comportement est conservé volontairement.
       */
      console.error(`Erreur lors du chargement de ${domaine} pour ${locale}:`, error)
    }
  }

  return charges
}
