const DEVICE_ID_KEY = 'fcm_device_id'

/**
 * Composable pour gérer un identifiant unique et persistant de l'appareil
 * Cet ID est stocké dans localStorage et reste stable même après les mises à jour du navigateur
 */
export function useDeviceId() {
  /**
   * Génère un UUID v4
   */
  const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  /**
   * Récupère ou crée l'identifiant unique de l'appareil
   */
  const getDeviceId = (): string | null => {
    if (!import.meta.client) return null

    let deviceId = localStorage.getItem(DEVICE_ID_KEY)

    if (!deviceId) {
      deviceId = generateUUID()
      localStorage.setItem(DEVICE_ID_KEY, deviceId)
    }

    return deviceId
  }

  /**
   * Supprime l'identifiant de l'appareil (utile pour les tests)
   */
  const clearDeviceId = (): void => {
    if (import.meta.client) {
      localStorage.removeItem(DEVICE_ID_KEY)
    }
  }

  return {
    getDeviceId,
    clearDeviceId,
  }
}
