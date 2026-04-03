<script setup lang="ts">
  import { RouterLink } from "vue-router";

  import AppFooter from "../components/AppFooter.vue";

</script>

<template>
  <div class="about-page">
    <main class="about-layout">
      <nav class="about-back">
        <RouterLink to="/" class="about-back__link">← 返回首页</RouterLink>
      </nav>

      <header class="about-hero">
        <RouterLink to="/" class="about-hero__brand">
          <span class="about-hero__badge" aria-hidden="true">
            <img src="/assets/images/logo-mark.svg" alt="" class="about-hero__logo" />
          </span>
          <span class="about-hero__brand-copy">
            <span class="about-hero__domain">OIO</span>
            <span class="about-hero__brand-text">开发者网址导航</span>
          </span>
        </RouterLink>
        <h1 class="about-hero__title">一份偏个人、偏长期使用的开发索引。</h1>
        <p class="about-hero__description">
          把真正会反复打开的工具、文档和灵感站点，从混乱的收藏夹中拎出来，整理成按使用场景浏览的入口。
        </p>
      </header>

      <section class="about-panel">
        <div class="about-panel__section">
          <p>
            收藏夹里的链接越攒越多，真正要找的时候却翻不到。OIO 就是为了解决这个问题——把高频回访的站点按场景归类，做成一个随时可查的索引。
          </p>
          <p>
            <strong>特别声明：</strong>
            <RouterLink :to="{ path: '/', hash: '#生存必备' }">『生存必备』</RouterLink>
            的部分链接带 affiliate，介意的慎点。
          </p>
        </div>

        <div class="about-profile">
          <div class="about-profile__card">
            <img :src="'/assets/images/logos/profile.PNG'" width="64" height="64" alt="iStar"
              class="about-profile__avatar" />
            <div class="about-profile__body">
              <div class="about-profile__identity">
                <div class="about-profile__name">iStar</div>
                <p class="about-profile__role">Developer, creating things.</p>
              </div>
              <div class="about-profile__facts" aria-label="站长信息">
                <span class="about-profile__fact">移动 App 开发 10+ 年</span>
                <span class="about-profile__fact">马拉松爱好者</span>
                <span class="about-profile__fact">持续整理常用工具与文档</span>
                <span class="about-profile__fact">偏爱长期可复用的工作流</span>
              </div>
            </div>
            <a class="about-profile__action" href="https://go.15tar.com/blog" target="_blank" rel="noreferrer">进入博客 →</a>
          </div>
        </div>
      </section>

      <AppFooter />
    </main>
  </div>
</template>
