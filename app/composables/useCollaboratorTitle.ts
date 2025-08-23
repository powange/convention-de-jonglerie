// Génère un titre court (badge) à partir des droits granularisés
// Heuristique: si tous les droits globaux => "permissions.admin" (Administrateur)
// sinon si gestion collaborateurs ou édition/suppression globales => "permissions.manager"
// sinon si ajout/édition éditions => "permissions.editor"
// sinon => "permissions.viewer"

export function useCollaboratorTitle() {
  const { t } = useI18n()

  function formatRightsTitle(collab: { rights?: Record<string, boolean>; title?: string | null }) {
    if (!collab.rights) return collab.title || t('permissions.viewer')
    const r = collab.rights
    const allKeys = [
      'editConvention',
      'deleteConvention',
      'manageCollaborators',
      'addEdition',
      'editAllEditions',
      'deleteAllEditions',
    ]
    const allTrue = allKeys.every((k) => r[k])
    if (allTrue) return t('permissions.admin')
    if (r.manageCollaborators || (r.editConvention && r.deleteConvention))
      return t('permissions.manager')
    if (r.addEdition || r.editAllEditions || r.deleteAllEditions) return t('permissions.editor')
    return t('permissions.viewer')
  }

  return { formatRightsTitle }
}
