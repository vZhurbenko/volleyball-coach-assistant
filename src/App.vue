<script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="app">
    <header class="app-bar">
      <span class="app-bar__title">Помощник тренера</span>
    </header>
    <main class="app-content">
      <RouterView />
    </main>
  </div>
</template>
