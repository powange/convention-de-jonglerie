/**
 * Copier un message de la messagerie dans le presse-papiers.
 *
 * Partagé par les deux menus d'un message : la fenêtre de l'appui long, sur mobile, et les actions
 * au survol, sur ordinateur. La bulle est en `select-none` (le geste tactile y est capté), si bien
 * que sans ce bouton on ne pouvait copier un message nulle part.
 *
 * `useClipboard` de VueUse plutôt que l'API du navigateur appelée en direct : il se replie quand
 * elle n'est pas disponible — contexte non sécurisé, permission refusée. Et l'on DIT ce qui s'est
 * passé : une copie qui échoue en silence laisse l'utilisateur coller l'ancien contenu sans
 * comprendre.
 */
export function useCopierMessage() {
  const { t } = useI18n()
  const { copy, isSupported } = useClipboard()
  const toast = useToast()

  /** Copie `texte`, précédé de son auteur : on copie souvent pour transmettre, et savoir qui l'on cite. */
  async function copierMessage(texte: string, auteur?: string) {
    const contenu = auteur ? `${auteur} : ${texte}` : texte

    if (!isSupported.value) {
      toast.add({
        title: t('messenger.copy_unavailable'),
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
      return
    }

    try {
      await copy(contenu)
      toast.add({
        title: t('messenger.copied'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    } catch {
      toast.add({
        title: t('messenger.copy_failed'),
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    }
  }

  return { copierMessage }
}
