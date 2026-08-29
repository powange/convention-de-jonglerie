/**
 * Ouvre — ou retrouve — la conversation privée entre un bénévole et les responsables bénévoles
 * d'une édition, puis y emmène.
 *
 * Deux écrans le proposent : la liste des candidatures dans le profil, et la page bénévolat de
 * l'édition. Le serveur décide qui participe à la conversation ; l'appelant ne fournit que
 * l'édition. Rassembler ici l'endpoint, la redirection et le message d'échec évite qu'un des
 * deux boutons parte de son côté le jour où l'un des trois change.
 */
export function useContactResponsablesBenevoles() {
  const { t } = useI18n()
  const toast = useToast()

  const editionId = ref<number | null>(null)

  const { execute, loading } = useApiAction<{ editionId: number }, { conversationId: number }>(
    '/api/messenger/volunteer-to-organizers',
    {
      method: 'POST',
      body: () => ({ editionId: editionId.value! }),
      // Pas de toast de succès : la redirection vers la conversation est la confirmation.
      silent: true,
      onSuccess: (resultat) => {
        navigateTo(`/messenger?conversationId=${resultat.conversationId}`)
      },
      onError: () => {
        toast.add({
          title: t('common.error'),
          description: t('pages.volunteers.contact_organizer_error'),
          color: 'error',
        })
      },
    }
  )

  const contacter = (id: number) => {
    editionId.value = id
    execute()
  }

  return { contacter, loading }
}
