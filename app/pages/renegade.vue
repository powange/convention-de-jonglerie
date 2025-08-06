<template>
  <div class="min-h-screen bg-gradient-to-br from-black via-orange-900 to-yellow-900 flex flex-col items-center justify-start pt-8 p-4">
    <!-- Titre -->
    <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-yellow-400 mb-4 sm:mb-6 md:mb-8 text-center animate-pulse drop-shadow-[0_0_30px_rgba(251,191,36,0.5)]">
      {{ $t('renegade.title') }}
    </h1>
    
    <!-- Compte à rebours -->
    <div class="bg-black/50 backdrop-blur-md rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 md:mb-8 shadow-2xl border border-orange-800/30 w-full max-w-xs sm:max-w-md md:max-w-2xl lg:max-w-4xl">
      <h2 class="text-base sm:text-lg md:text-xl lg:text-2xl text-orange-200 mb-3 sm:mb-4 md:mb-6 text-center px-2">
        {{ $t('renegade.countdown_title') }}
      </h2>
      
      <div class="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 lg:gap-6 text-center">
        <div class="bg-gradient-to-b from-orange-800/50 to-red-900/50 rounded-lg p-2 sm:p-3 md:p-4 border border-orange-600/30">
          <div class="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-yellow-400 drop-shadow-lg whitespace-nowrap">{{ timeRemaining.hours }}</div>
          <div class="text-xs sm:text-sm md:text-base lg:text-lg text-orange-200 mt-0.5 sm:mt-1">{{ $t('renegade.hours') }}</div>
        </div>
        
        <div class="bg-gradient-to-b from-orange-800/50 to-red-900/50 rounded-lg p-2 sm:p-3 md:p-4 border border-orange-600/30">
          <div class="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-yellow-400 drop-shadow-lg whitespace-nowrap">{{ timeRemaining.minutes }}</div>
          <div class="text-xs sm:text-sm md:text-base lg:text-lg text-orange-200 mt-0.5 sm:mt-1">{{ $t('renegade.minutes') }}</div>
        </div>
        
        <div class="bg-gradient-to-b from-orange-800/50 to-red-900/50 rounded-lg p-2 sm:p-3 md:p-4 border border-orange-600/30">
          <div class="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-yellow-400 drop-shadow-lg whitespace-nowrap">{{ timeRemaining.seconds }}</div>
          <div class="text-xs sm:text-sm md:text-base lg:text-lg text-orange-200 mt-0.5 sm:mt-1">{{ $t('renegade.seconds') }}</div>
        </div>
      </div>
    </div>
    
    <!-- Vidéo YouTube -->
    <div class="w-full max-w-xs sm:max-w-md md:max-w-2xl lg:max-w-4xl mx-auto px-2 sm:px-4">
      <div class="relative aspect-video w-full rounded-lg sm:rounded-xl md:rounded-2xl shadow-2xl overflow-hidden bg-black border border-orange-800/30">
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