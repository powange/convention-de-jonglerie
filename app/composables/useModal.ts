import { ref, reactive, type Ref, type UnwrapNestedRefs } from 'vue'

export interface ModalState<T = any> {
  isOpen: Ref<boolean>
  loading: Ref<boolean>
  data: UnwrapNestedRefs<T>
  open: (data?: T) => void
  close: () => void
  toggle: () => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

/**
 * Composable pour gérer l'état d'une modale
 * @param initialData - Données initiales pour la modale
 * @returns État et méthodes pour gérer la modale
 */
export function useModal<T = any>(initialData?: T): ModalState<T> {
  const isOpen = ref(false)
  const loading = ref(false)
  const data = reactive<T>((initialData || {}) as T)

  /**
   * Ouvrir la modale avec des données optionnelles
   */
  const open = (newData?: T) => {
    if (newData) {
      Object.assign(data, newData)
    }
    isOpen.value = true
  }

  /**
   * Fermer la modale
   */
  const close = () => {
    isOpen.value = false
    loading.value = false
  }

  /**
   * Basculer l'état de la modale
   */
  const toggle = () => {
    isOpen.value = !isOpen.value
  }

  /**
   * Définir l'état de chargement
   */
  const setLoading = (value: boolean) => {
    loading.value = value
  }

  /**
   * Réinitialiser la modale à son état initial
   */
  const reset = () => {
    isOpen.value = false
    loading.value = false
    if (initialData) {
      Object.assign(data, initialData)
    }
  }

  return {
    isOpen,
    loading,
    data,
    open,
    close,
    toggle,
    setLoading,
    reset,
  }
}

/**
 * Composable pour gérer plusieurs modales avec confirmation
 * Utile pour les actions destructives (suppression, etc.)
 */
export function useConfirmModal<T = any>(
  onConfirm: (data: T) => Promise<void> | void,
  options?: {
    resetOnClose?: boolean
    closeOnConfirm?: boolean
  }
) {
  const { resetOnClose = true, closeOnConfirm = true } = options || {}
  const modal = useModal<T>()

  /**
   * Confirmer l'action avec gestion du loading
   */
  const confirm = async () => {
    try {
      modal.setLoading(true)
      await onConfirm(modal.data)
      if (closeOnConfirm) {
        modal.close()
      }
    } finally {
      modal.setLoading(false)
    }
  }

  /**
   * Fermer avec reset optionnel
   */
  const cancel = () => {
    modal.close()
    if (resetOnClose) {
      modal.reset()
    }
  }

  return {
    ...modal,
    confirm,
    cancel,
  }
}
