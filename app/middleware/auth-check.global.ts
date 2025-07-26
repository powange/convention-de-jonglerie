import { useAuthStore } from '~/stores/auth';

export default defineNuxtRouteMiddleware((_to, _from) => {
  const _authStore = useAuthStore();
  // Ensure auth state is initialized on every route change/load
  // This is now handled by auth.client.ts for protected routes
  // and by the ClientOnly component for the main app layout.
  // This global middleware can remain for general checks if needed, but won't re-initialize.
});