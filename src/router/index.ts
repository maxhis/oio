import { createRouter, createWebHistory } from "vue-router";

import AboutView from "../views/AboutView.vue";
import AdminView from "../views/AdminView.vue";
import HomeView from "../views/HomeView.vue";
import NotFoundView from "../views/NotFoundView.vue";

const homeMeta = {
  title: "oio.15tar.com - 开发者网址导航",
  description:
    "oio - 收集国内外优秀开发工具网站、app开发资源网站、灵感创意网站、素材资源网站，定时更新分享优质开发书签。oio.15tar.com",
  keywords:
    "app开发,iOS开发,Android开发,React Native开发,Flutter开发,小程序开发,app开发资源,网址导航,创意导航,程序员网址大全,开发者网址大全,跨平台app开发 oio.15tar.com",
  image: "/assets/images/oio_banner.png",
  bodyClass: "home-body",
};

const aboutMeta = {
  title: "关于本站 - oio.15tar.com",
  description:
    "了解 oio.15tar.com 的由来、站长背景，以及这个开发者网址导航的整理原则。",
  keywords: "oio.15tar.com,关于本站,开发者网址导航,站长介绍,开发资源导航",
  image: "/assets/images/oio_banner.png",
  bodyClass: "about-body",
};

const notFoundMeta = {
  title: "404 - oio.15tar.com",
  description: "你访问的页面不存在，返回 oio.15tar.com 浏览开发者导航。",
  keywords: "oio.15tar.com,404",
  image: "/assets/images/oio_banner.png",
  bodyClass: "not-found-body",
};

const adminMeta = {
  title: "后台管理 - oio.15tar.com",
  description: "受 Cloudflare Access 保护的 oio.15tar.com 后台，用于维护导航数据。",
  keywords: "oio.15tar.com,admin,cloudflare access,d1,r2",
  image: "/assets/images/oio_banner.png",
  bodyClass: "admin-body",
};

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
      meta: homeMeta,
    },
    {
      path: "/index.html",
      redirect: "/",
    },
    {
      path: "/about",
      name: "about",
      component: AboutView,
      meta: aboutMeta,
    },
    {
      path: "/about.html",
      redirect: "/about",
    },
    {
      path: "/admin",
      name: "admin",
      component: AdminView,
      meta: adminMeta,
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: NotFoundView,
      meta: notFoundMeta,
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    }

    if (to.path !== from.path) {
      return { top: 0 };
    }

    return false;
  },
});

export default router;
