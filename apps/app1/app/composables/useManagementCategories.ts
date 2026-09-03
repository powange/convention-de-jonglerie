import type { InjectionKey, Ref } from 'vue'

/**
 * Sur mobile, l'accueil de gestion n'affiche que les catégories ; ouvrir l'une d'elles montre ses
 * seuls liens. Tout se joue sur la même page, la catégorie ouverte vivant dans l'URL — ainsi le
 * retour du téléphone ramène à la liste, et un rafraîchissement rouvre la même catégorie.
 *
 * Les sections s'inscrivent elles-mêmes ici plutôt que d'être décrites dans une liste tenue à
 * part : celle-ci se serait désynchronisée du jour où l'on ajoute ou retire une catégorie.
 */
export interface CategorieGestion {
  id: string
  titre: string
  icone: string
  classeIcone: string
  /**
   * Sert à restituer l'ordre du document, l'inscription suivant l'ordre de montage.
   *
   * Un accesseur et non une `Ref` : placée dans un `ref` de tableau, une référence imbriquée est
   * déballée par Vue, et le type ne survit pas au passage.
   */
  element: () => HTMLElement | null
}

interface ContexteCategories {
  enregistrer: (categorie: CategorieGestion) => void
  oublier: (id: string) => void
  categorieOuverte: Ref<string | null>
}

const cleCategories: InjectionKey<ContexteCategories> = Symbol('categories-gestion')

/** À appeler dans la page qui porte les sections. */
export function fournirCategoriesGestion() {
  const route = useRoute()
  const router = useRouter()

  const inscrites = ref<CategorieGestion[]>([])

  // La catégorie ouverte se lit dans l'URL : le serveur et le navigateur en tirent le même
  // affichage, sans détection de largeur en JavaScript — c'est Tailwind qui décide du seuil.
  const categorieOuverte = computed(() => (route.query.section as string) || null)

  // Vrai dès qu'on a ouvert une catégorie depuis cette page. Sans ce repère, revenir en arrière
  // après un accès direct à l'URL ferait quitter l'accueil de gestion.
  const aPousseUneEtape = ref(false)

  const categories = computed(() => {
    const liste = [...inscrites.value]
    return liste.sort((a, b) => {
      const ea = a.element()
      const eb = b.element()
      if (!ea || !eb) return 0
      return ea.compareDocumentPosition(eb) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    })
  })

  const ouvrir = (id: string) => {
    aPousseUneEtape.value = true
    router.push({ query: { ...route.query, section: id } })
  }

  const fermer = () => {
    if (aPousseUneEtape.value) {
      aPousseUneEtape.value = false
      router.back()
      return
    }
    const query = { ...route.query }
    delete query.section
    router.replace({ query })
  }

  provide(cleCategories, {
    categorieOuverte,
    enregistrer: (categorie) => {
      inscrites.value = [...inscrites.value.filter((c) => c.id !== categorie.id), categorie]
    },
    oublier: (id) => {
      inscrites.value = inscrites.value.filter((c) => c.id !== id)
    },
  })

  return { categories, categorieOuverte, ouvrir, fermer }
}

/** À appeler dans une section, pour s'inscrire auprès de la page. */
export function useCategoriesGestion() {
  return inject(cleCategories, null)
}
