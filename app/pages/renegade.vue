<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex flex-col items-center justify-center p-4">
    <!-- Titre -->
    <h1 class="text-4xl md:text-6xl font-bold text-white mb-8 text-center animate-pulse">
      {{ $t('renegade.title') }}
    </h1>
    
    <!-- Compte à rebours -->
    <div class="bg-black/30 backdrop-blur-md rounded-2xl p-8 mb-8 shadow-2xl">
      <h2 class="text-xl md:text-2xl text-purple-200 mb-6 text-center">
        {{ $t('renegade.countdown_title') }}
      </h2>
      
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div class="bg-purple-800/50 rounded-lg p-4">
          <div class="text-3xl md:text-5xl font-bold text-white">{{ timeRemaining.days }}</div>
          <div class="text-sm md:text-base text-purple-200 mt-1">{{ $t('renegade.days') }}</div>
        </div>
        
        <div class="bg-purple-800/50 rounded-lg p-4">
          <div class="text-3xl md:text-5xl font-bold text-white">{{ timeRemaining.hours }}</div>
          <div class="text-sm md:text-base text-purple-200 mt-1">{{ $t('renegade.hours') }}</div>
        </div>
        
        <div class="bg-purple-800/50 rounded-lg p-4">
          <div class="text-3xl md:text-5xl font-bold text-white">{{ timeRemaining.minutes }}</div>
          <div class="text-sm md:text-base text-purple-200 mt-1">{{ $t('renegade.minutes') }}</div>
        </div>
        
        <div class="bg-purple-800/50 rounded-lg p-4">
          <div class="text-3xl md:text-5xl font-bold text-white">{{ timeRemaining.seconds }}</div>
          <div class="text-sm md:text-base text-purple-200 mt-1">{{ $t('renegade.seconds') }}</div>
        </div>
      </div>
    </div>
    
    <!-- Vidéo YouTube -->
    <div class="w-full max-w-4xl mx-auto px-4">
      <div class="relative aspect-video w-full rounded-2xl shadow-2xl overflow-hidden bg-black">
        <iframe
          class="absolute inset-0 w-full h-full"
          src="https://www.youtube.com/embed/947Bhwl4rAI?rel=0"
          title="YouTube video player"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen
        ></iframe>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

// Définir un layout vide pour cette page (pas de header/footer)
definePageMeta({
  layout: false
});

// Date cible : 7 août 2025 à 01:00
const targetDate = new Date('2025-08-07T01:00:00');

// État réactif pour le temps restant
const now = ref(new Date());
let interval: NodeJS.Timeout;

// Calculer le temps restant
const timeRemaining = computed(() => {
  const diff = targetDate.getTime() - now.value.getTime();
  
  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0
    };
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return {
    days: String(days).padStart(2, '0'),
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0')
  };
});

// Mettre à jour le temps toutes les secondes
onMounted(() => {
  interval = setInterval(() => {
    now.value = new Date();
  }, 1000);
});

// Nettoyer l'intervalle lors de la destruction du composant
onUnmounted(() => {
  if (interval) {
    clearInterval(interval);
  }
});
</script>

<style scoped>
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>