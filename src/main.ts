import { createApp } from "vue";

import App from "./App.vue";
import router from "./router";
import { initAnalytics } from "./services/analytics";
import "./styles/app.css";

initAnalytics(router);

createApp(App).use(router).mount("#app");
