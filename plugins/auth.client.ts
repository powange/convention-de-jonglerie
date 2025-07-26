import { useAuthStore } from '../app/stores/auth';

export default defineNuxtPlugin((_nuxtApp) => {
  const authStore = useAuthStore();
  authStore.initializeAuth();
});
