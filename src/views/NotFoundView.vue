<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <div class="not-found-page">
    <section id="about" class="not-found-panel animated bounce-in">
      <div class="bg-align">
        <h1>404</h1>
        <p>Oops! It looks like you're lost...</p>
        <p>The page you're looking for doesn't exist or another error occurred.</p>
        <p>
          <RouterLink to="/">👉 oio.dev</RouterLink>
        </p>
      </div>
    </section>
  </div>
</template>
