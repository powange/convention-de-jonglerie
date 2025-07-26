<template>
  <div>
    <p>Déconnexion en cours...</p>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();
const toast = useToast();
const router = useRouter();

onMounted(() => {
  authStore.logout();
  toast.add({ title: 'Déconnexion réussie !', icon: 'i-heroicons-check-circle', color: 'success' });
  router.push('/login');
});
</script>
