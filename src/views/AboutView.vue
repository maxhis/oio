<script setup lang="ts">
import { RouterLink } from "vue-router";

import AppFooter from "../components/AppFooter.vue";
</script>

<template>
  <div class="about-page">
    <nav class="navbar horizontal-menu navbar-fixed-top">
      <div class="navbar-inner">
        <div class="navbar-brand">
          <RouterLink to="/" class="logo">
            <img
              :src="'/assets/images/logo_dark@2x.svg'"
              width="100%"
              alt="oio.dev"
              class="hidden-xs"
            />
            <img
              :src="'/assets/images/logo@2x.svg'"
              width="100%"
              alt="oio.dev"
              class="visible-xs"
            />
          </RouterLink>
        </div>
      </div>
    </nav>

    <div class="page-container">
      <main class="main-content">
        <div class="row">
          <div class="col-md-12">
            <div class="panel panel-default about-panel">
              <h4 class="text-gray">关于网站</h4>
              <div class="panel-body">
                <div class="row">
                  <div class="col-sm-12">
                    <blockquote>
                      <p>
                        一直以来我都使用 Chrome 的收藏夹来整理网站，收藏的网站越来越多，收藏夹也越来越乱，当回头找的时候就变得很麻烦，所以一直想做一个网址导航，贴上自己比较常用的一些网站。
                      </p>
                      <br />
                      <p>
                        某些工具或者现成的网站虽然也能满足自己的部分需求，但是可定制性又不强，自己刚好翻到一个设计师
                        <a href="http://viggoz.com/" target="_blank" rel="noreferrer">
                          Designer. Viggo.
                        </a>
                        写的设计师导航网站，感觉和自己的设想、思路都比较契合，几经改造，就有了本站。
                      </p>
                      <br />
                      <p>
                        <b>特别声明：</b>
                        <RouterLink :to="{ path: '/', hash: '#生存必备' }">
                          『生存必备』
                        </RouterLink>
                        的部分链接带 affiliate，介意的慎点！
                      </p>
                    </blockquote>
                  </div>
                </div>

                <h4 class="text-gray">关于站长</h4>
                <div class="row">
                  <div class="col-sm-4">
                    <a
                      class="xe-widget xe-conversations box2 about-profile-card"
                      href="https://go.oio.dev/blog"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <div class="xe-comment-entry">
                        <img
                          :src="'/assets/images/logos/profile.PNG'"
                          class="img-circle"
                          width="40"
                          alt="iStar"
                        />
                        <div class="xe-comment">
                          <div class="xe-user-name overflowClip_1">
                            <strong>iStar</strong>
                          </div>
                          <p class="overflowClip_2">
                            Developer, creating things.
                          </p>
                        </div>
                      </div>
                    </a>
                  </div>

                  <div class="col-md-8">
                    <div class="row">
                      <div class="col-sm-12">
                        <br />
                        <blockquote>
                          <p>
                            站长是从事移动 app 开发近十年的程序员，建立本站的目的是为了提高自己的效率，希望对你也有用。<br />
                            如果你有更好的想法或提交网址，欢迎与我交流分享：
                            <a href="mailto:mail.oio.dev@gmail.com">
                              <i aria-hidden="true" class="fa fa-envelope"></i>
                            </a>
                          </p>
                        </blockquote>
                      </div>
                    </div>
                    <br />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <AppFooter fixed />
      </main>
    </div>
  </div>
</template>
