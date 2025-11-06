// Génère un titre court (badge) à partir des droits granularisés
// Heuristique: si tous les droits globaux => "permissions.admin" (Administrateur)
// sinon si gestion organisateurs ou édition/suppression globales => "permissions.manager"
// sinon si ajout/édition éditions => "permissions.editor"
// sinon => "permissions.viewer"

export function useOrganizerTitle() {
  const { t } = useI18n()

  function formatRightsTitle(collab: { rights?: Record<string, boolean>; title?: string | null }) {
    // Prioriser le titre personnalisé s'il existe
    if (collab.title && collab.title.trim()) {
      return collab.title.trim()
    }

    // Sinon, utiliser les permissions automatiques
    if (!collab.rights) return t('permissions.viewer')
    const r = collab.rights
    const allKeys = [
      'editConvention',
      'deleteConvention',
      'manageOrganizers',
      'manageVolunteers',
      'addEdition',
      'editAllEditions',
      'deleteAllEditions',
    ]
    const allTrue = allKeys.every((k) => r[k])
    if (allTrue) return t('permissions.admin')
    if (r.manageOrganizers || (r.editConvention && r.deleteConvention))
      return t('permissions.manager')
    if (r.addEdition || r.editAllEditions || r.deleteAllEditions || r.manageVolunteers)
      return t('permissions.editor')
    return t('permissions.viewer')
  }

  return { formatRightsTitle }
}
