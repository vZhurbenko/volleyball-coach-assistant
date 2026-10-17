<script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <main class="app-content">
    <RouterView v-slot="{ Component }">
      <Transition name="screen" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </main>
</template>
