<template>
  <svg
    :class="['loading-logo-svg', { loaded }]"
    xmlns="http://www.w3.org/2000/svg"
    width="727"
    height="727"
    viewBox="-1000 -1000 9270 9270"
  >
    <defs>
      <!-- Masque pour transformer ball-a en C -->
      <mask id="c-mask">
        <rect width="100%" height="100%" fill="white" />
        <circle cx="4813" cy="3500" r="1100" fill="black" />
        <polygon points="4813,3500 6900,2500 6900,4500" fill="black" />
      </mask>

      <!-- Clip pour le chevron -->
      <clipPath id="chevron-clip">
        <path
          d="M0,0 H7270 V7270 H0 Z M4813,1490 A2010,2010 0 1,1 4812,1490 Z"
          clip-rule="evenodd"
        />
      </clipPath>
    </defs>

    <!-- C FINAL (derriere les balles) -->
    <circle
      class="c-final"
      cx="4813"
      cy="3500"
      r="1900"
      fill="rgb(221,46,33)"
      mask="url(#c-mask)"
    />

    <!-- CASCADE BALLS -->
    <circle class="ball ball-a" cx="3635" cy="3500" r="350" fill="rgb(221,46,33)" />
    <circle class="ball ball-b" cx="3635" cy="3500" r="350" fill="rgb(221,46,33)" />
    <circle class="ball ball-c" cx="3635" cy="3500" r="350" fill="currentColor" />

    <!-- LOGO WHITE -->
    <g class="logo-white" fill="currentColor">
      <path
        d="M 1460 5932 l 0 -412 43 6 c 60 9 298 -13 414 -36 246 -51 512 -167 728 -319 192 -135 400 -345 533 -539 l 50 -73 56 75 c 110 149 269 307 409 406 37 27 63 51 57 55 -6 3 -22 29 -36 57 -53 105 -330 407 -519 566 -107 90 -298 217 -450 300 -344 187 -729 292 -1167 318 l -118 7 0 -411 z"
        clip-path="url(#chevron-clip)"
      />
      <path
        d="M 1350 5089 c -185 -18 -396 -94 -522 -187 -29 -21 -82 -70 -118 -109 -186 -199 -280 -498 -280 -893 l 0 -130 375 0 375 0 0 133 c 1 278 56 418 190 480 36 17 65 21 146 21 89 0 107 -3 157 -27 91 -45 134 -111 163 -248 12 -60 15 -226 16 -1020 l 1 -949 382 0 382 0 -3 943 c -1 642 -6 969 -14 1027 -68 501 -262 771 -648 900 -148 49 -425 76 -602 59 z"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">
defineProps<{
  loaded: boolean
}>()
</script>

<style scoped>
/* =============================================
   THEME — utilise currentColor pour heriter du theme
   ============================================= */

.loading-logo-svg {
  width: 200px;
  height: 200px;
  max-width: 50vw;
  max-height: 50vh;
  overflow: visible;
  color: #000000;
}

@media (prefers-color-scheme: dark) {
  .loading-logo-svg {
    color: #ffffff;
  }
}

:global(.dark) .loading-logo-svg {
  color: #ffffff;
}

:global(.light) .loading-logo-svg {
  color: #000000;
}

/* =============================================
   PHASE 1 — CASCADE (boucle infinie)
   Figure-8 pattern, 2.3s par cycle
   ============================================= */

/* Cascade commune */
@keyframes cascade-a {
  0% {
    transform: translate(0px, 0px);
  }
  12.5% {
    transform: translate(600px, -1400px) scale(1.05);
  }
  25% {
    transform: translate(1200px, 0px);
    animation-timing-function: ease-out;
  }
  37.5% {
    transform: translate(600px, 1400px);
  }
  50% {
    transform: translate(0px, 0px);
  }
  62.5% {
    transform: translate(-600px, -1400px) scale(1.05);
    animation-timing-function: ease-in;
  }
  75% {
    transform: translate(-1200px, 0px);
    animation-timing-function: ease-out;
  }
  87.5% {
    transform: translate(-600px, 1400px);
  }
  100% {
    transform: translate(0px, 0px);
  }
}

/* Ball B: offset 1/3 cycle */
@keyframes cascade-b {
  0% {
    transform: translate(600px, 1400px);
  }
  12.5% {
    transform: translate(0px, 0px);
  }
  25% {
    transform: translate(-600px, -1400px) scale(1.05);
    animation-timing-function: ease-in;
  }
  37.5% {
    transform: translate(-1200px, 0px);
    animation-timing-function: ease-out;
  }
  50% {
    transform: translate(-600px, 1400px);
  }
  62.5% {
    transform: translate(0px, 0px);
  }
  75% {
    transform: translate(600px, -1400px) scale(1.05);
  }
  87.5% {
    transform: translate(1200px, 0px);
    animation-timing-function: ease-out;
  }
  100% {
    transform: translate(600px, 1400px);
  }
}

/* Ball C: offset 2/3 cycle */
@keyframes cascade-c {
  0% {
    transform: translate(-600px, -1400px) scale(1.05);
    animation-timing-function: ease-in;
  }
  12.5% {
    transform: translate(-1200px, 0px);
    animation-timing-function: ease-out;
  }
  25% {
    transform: translate(-600px, 1400px);
  }
  37.5% {
    transform: translate(0px, 0px);
  }
  50% {
    transform: translate(600px, -1400px) scale(1.05);
  }
  62.5% {
    transform: translate(1200px, 0px);
    animation-timing-function: ease-out;
  }
  75% {
    transform: translate(600px, 1400px);
  }
  87.5% {
    transform: translate(0px, 0px);
  }
  100% {
    transform: translate(-600px, -1400px) scale(1.05);
  }
}

/* Par defaut: cascade infinie */
.ball-a {
  animation: cascade-a 2.3s linear infinite;
}
.ball-b {
  animation: cascade-b 2.3s linear infinite;
}
.ball-c {
  animation: cascade-c 2.3s linear infinite;
}

/* C final et logo blanc: caches pendant la cascade */
.c-final {
  opacity: 0;
}
.logo-white {
  opacity: 0;
}

/* =============================================
   PHASE 2+3 — SETTLE (declenche par .loaded)
   Transition + grossissement + revelation
   ============================================= */

/* Ball A → C center (1178, 0) + grossit */
@keyframes settle-a {
  0% {
    transform: translate(0px, 0px);
    r: 350;
  }
  50% {
    transform: translate(1178px, 0px);
    r: 1900;
  }
  100% {
    transform: translate(1178px, 0px);
    r: 1900;
  }
}
@keyframes settle-a-opacity {
  0%,
  50% {
    opacity: 1;
  }
  70% {
    opacity: 0;
  }
  100% {
    opacity: 0;
  }
}

/* Ball B → orbit rouge (1291, 2809) + grossit */
@keyframes settle-b {
  0% {
    transform: translate(0px, 0px);
    r: 350;
  }
  50% {
    transform: translate(1291px, 2809px);
    r: 713;
  }
  100% {
    transform: translate(1291px, 2809px);
    r: 713;
  }
}

/* Ball C → orbit blanc (-1637, -2500) + grossit */
@keyframes settle-c {
  0% {
    transform: translate(0px, 0px);
    r: 350;
  }
  50% {
    transform: translate(-1637px, -2500px);
    r: 731;
  }
  100% {
    transform: translate(-1637px, -2500px);
    r: 731;
  }
}

/* C final apparait */
@keyframes c-appear {
  0%,
  49% {
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 1;
  }
}

/* Logo blanc apparait */
@keyframes white-appear {
  0%,
  50% {
    opacity: 0;
  }
  70% {
    opacity: 1;
  }
  100% {
    opacity: 1;
  }
}

/* Quand .loaded est ajoute, on bascule sur les animations settle */
.loaded .ball-a {
  animation:
    settle-a 3s ease-in-out forwards,
    settle-a-opacity 3s linear forwards;
}
.loaded .ball-b {
  animation: settle-b 3s ease-in-out forwards;
}
.loaded .ball-c {
  animation: settle-c 3s ease-in-out forwards;
}
.loaded .c-final {
  animation: c-appear 3s linear forwards;
}
.loaded .logo-white {
  animation: white-appear 3s linear forwards;
}
</style>
