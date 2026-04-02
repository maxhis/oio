import { createRouter, createWebHistory } from "vue-router";

import AboutView from "../views/AboutView.vue";
import AdminView from "../views/AdminView.vue";
import HomeView from "../views/HomeView.vue";
import NotFoundView from "../views/NotFoundView.vue";

const homeMeta = {
  title: "OIO - 开发者网址导航",
  description:
    "OIO 收集国内外优秀开发工具网站、App 开发资源网站、灵感创意网站和素材资源网站，持续整理值得长期保存的优质书签。",
  keywords:
    "app开发,iOS开发,Android开发,React Native开发,Flutter开发,小程序开发,app开发资源,网址导航,创意导航,程序员网址大全,开发者网址大全,跨平台app开发",
  image: "/assets/images/oio_banner.png",
  bodyClass: "home-body",
};

const aboutMeta = {
  title: "关于本站 - OIO",
  description:
    "了解 OIO 的由来、维护者背景，以及这个开发者网址导航的整理原则。",
  keywords: "关于本站,开发者网址导航,站长介绍,开发资源导航",
  image: "/assets/images/oio_banner.png",
  bodyClass: "about-body",
};

const notFoundMeta = {
  title: "404 - OIO",
  description: "你访问的页面不存在，返回 OIO 浏览开发者导航。",
  keywords: "404,开发者网址导航",
  image: "/assets/images/oio_banner.png",
  bodyClass: "not-found-body",
};

const adminMeta = {
  title: "后台管理 - OIO",
  description: "受 Cloudflare Access 保护的 OIO 后台，用于维护导航数据。",
  keywords: "admin,cloudflare access,d1,r2,导航后台",
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
