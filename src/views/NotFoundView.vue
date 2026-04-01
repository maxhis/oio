<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <div class="not-found-page">
    <section class="not-found-panel">
      <p class="not-found-panel__eyebrow">404</p>
      <h1>这一页没有被收录。</h1>
      <p>你访问的地址不存在，或者这条路径已经被新的站点结构替换。</p>
      <RouterLink to="/" class="not-found-panel__link">返回首页继续浏览</RouterLink>
    </section>
  </div>
</template>
