<script setup lang="ts">
  import { RouterLink } from "vue-router";

  import AppFooter from "../components/AppFooter.vue";

</script>

<template>
  <div class="about-page">
    <main class="about-layout">
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
        <h1 class="about-hero__title">这不是“站点大全”，而是一份偏个人、偏长期使用的开发索引。</h1>
        <p class="about-hero__description">
          目标很简单，把真正会反复打开的工具、文档、学习资源和灵感站点，从混乱收藏夹里拎出来，整理成按场景浏览的入口。
        </p>
      </header>

      <section class="about-panel">
        <div class="about-panel__section">
          <p>
            一直以来我都使用 Chrome 的收藏夹来整理网站，收藏的网站越来越多，收藏夹也越来越乱，当回头找的时候就变得很麻烦，所以一直想做一个网址导航，贴上自己比较常用的一些网站。
          </p>
          <p>
            某些工具或者现成的网站虽然也能满足自己的部分需求，但是可定制性又不强，自己刚好翻到一个设计师
            <a href="http://viggoz.com/" target="_blank" rel="noreferrer">
              Designer. Viggo.
            </a>
            写的设计师导航网站，感觉和自己的设想、思路都比较契合，几经改造，就有了本站。
          </p>
          <p>
            <strong>特别声明：</strong>
            <RouterLink :to="{ path: '/', hash: '#生存必备' }">『生存必备』</RouterLink>
            的部分链接带 affiliate，介意的慎点。
          </p>
        </div>

        <div class="about-profile">
          <a class="about-profile__card" href="https://go.15tar.com/blog" target="_blank" rel="noreferrer">
            <div class="about-profile__card-head">
              <img :src="'/assets/images/logos/profile.PNG'" width="64" height="64" alt="iStar"
                class="about-profile__avatar" />
              <div class="about-profile__identity">
                <span class="about-profile__label">Maintainer</span>
                <div class="about-profile__name">iStar</div>
                <p class="about-profile__role">Developer, creating things.</p>
              </div>
            </div>
            <div class="about-profile__facts" aria-label="站长信息">
              <span class="about-profile__fact">移动 App 开发 10+ 年</span>
              <span class="about-profile__fact">马拉松爱好者</span>
              <span class="about-profile__fact">持续整理常用工具与文档</span>
              <span class="about-profile__fact">偏爱长期可复用的工作流</span>
            </div>
            <span class="about-profile__action">进入博客</span>
          </a>
        </div>
      </section>

      <AppFooter />
    </main>
  </div>
</template>
