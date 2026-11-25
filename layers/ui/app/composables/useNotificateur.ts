/**
 * Les toasts, sous une forme commune.
 *
 * ## ⚠️ POURQUOI CE COMPOSABLE EXISTE : QUATRE-VINGT-DIX-HUIT APPELS, AUCUNE RÈGLE
 *
 * Mesuré le 09/10/2026 sur les écrans de gestion (après la migration vers `useApiAction`) :
 * **98 appels à `toast.add` dans 22 écrans**, et chacun décidait seul de tout.
 *
 * | Ce qui variait | Mesure |
 * | --- | --- |
 * | titre d'un succès | `common.saved` (14), `common.success` (6), `common.deleted` (1), ou un libellé local |
 * | titre d'une erreur | `common.error` (32), `errors.error_occurred` (5), ou le message brut du serveur |
 * | **icône absente** | **32 sur 98** |
 * | icône d'erreur | `x-circle` (24) contre `exclamation-circle` (6) — deux icônes, un seul sens |
 *
 * La convention existait donc déjà **dans les faits** : succès en vert avec `check-circle`, erreur
 * en rouge avec `x-circle`. Elle n'était simplement écrite nulle part, si bien qu'un tiers des
 * appels s'en écartait sans que personne ne le décide.
 *
 * ## Ce que ce composable NE fait pas
 *
 * Il ne choisit pas les mots. Le titre reste à l'appelant, parce qu'un bon titre dit ce qui vient
 * de se passer — « Créneau publié » vaut mieux que « Enregistré ». Ce qui est fixé, c'est la
 * **forme** : couleur et icône par type, et jamais de message serveur brut sans repli traduit.
 *
 * ## 📍 Le piège qu'il referme
 *
 * Trente-huit endroits du dépôt écrivaient `t('common.saved') || 'Sauvegardé'`. Ce repli **ne
 * peut jamais servir** : `t()` rend la CLÉ quand la traduction manque, jamais une chaîne vide, et
 * une clé est toujours vraie. L'utilisateur voyait donc « common.saved » et non « Sauvegardé ».
 * `test/nuxt/composables/repli-apres-t-est-mort.test.ts` le prouve plutôt que de l'affirmer.
 *
 * C'est pour cela que `erreurDuServeur` existe : elle, elle a un vrai repli.
 */

/** Ce qu'un appelant peut préciser en plus du titre. */
export interface OptionsDeNotification {
  description?: string
  /**
   * Pour les rares cas où l'icône porte un sens que le type ne dit pas — par exemple l'étoile
   * d'un responsable d'équipe. À n'employer que là : une icône par appel ramènerait la dispersion
   * que ce composable retire.
   */
  icone?: string
}

const FORMES = {
  succes: { color: 'success', icon: 'i-heroicons-check-circle' },
  erreur: { color: 'error', icon: 'i-heroicons-x-circle' },
  avertissement: { color: 'warning', icon: 'i-heroicons-exclamation-triangle' },
  info: { color: 'info', icon: 'i-heroicons-information-circle' },
  /*
   * ⚠️ `neutre` n'est pas un succès tiède : il existe pour les gestes qui RETIRENT quelque chose
   * sans que ce soit un échec. Dépublier un planning en est le cas du dépôt — l'annoncer en vert
   * dirait « c'est fait, tant mieux » quand l'organisateur vient de masquer ce que les bénévoles
   * voyaient. La couleur est donc neutre, et l'icône se remplace (un œil barré).
   */
  neutre: { color: 'neutral', icon: 'i-heroicons-information-circle' },
} as const

export type TypeDeNotification = keyof typeof FORMES

export function useNotificateur() {
  const toast = useToast()

  const notifier = (type: TypeDeNotification, titre: string, options?: OptionsDeNotification) => {
    const forme = FORMES[type]
    toast.add({
      title: titre,
      description: options?.description,
      icon: options?.icone ?? forme.icon,
      color: forme.color,
    })
  }

  return {
    succes: (titre: string, options?: OptionsDeNotification) => notifier('succes', titre, options),
    erreur: (titre: string, options?: OptionsDeNotification) => notifier('erreur', titre, options),
    avertir: (titre: string, options?: OptionsDeNotification) =>
      notifier('avertissement', titre, options),
    info: (titre: string, options?: OptionsDeNotification) => notifier('info', titre, options),
    neutre: (titre: string, options?: OptionsDeNotification) => notifier('neutre', titre, options),
    notifier,
  }
}

/**
 * Le message d'une erreur d'API, avec un repli TRADUIT.
 *
 * ⚠️ Le message du serveur est souvent du français en dur — `createError({ message: 'Édition
 * introuvable' })`. L'afficher tel quel à un lecteur anglophone est le défaut que quatorze appels
 * commettaient en écrivant `error.data.message` sans alternative. On le garde, parce qu'il est
 * souvent plus précis que n'importe quel libellé générique, mais **en description** et jamais en
 * guise de titre.
 */
export function messageDErreurServeur(erreur: unknown): string | undefined {
  const e = erreur as { data?: { message?: string }; statusMessage?: string; message?: string }
  return e?.data?.message || e?.statusMessage || undefined
}
