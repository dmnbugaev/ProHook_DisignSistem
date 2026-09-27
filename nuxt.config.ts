export default defineNuxtConfig({
  compatibilityDate: "2026-09-27",
  runtimeConfig: {
    moyskladToken: "",
  },
  devtools: { enabled: false },
  components: [{ path: "~/components", pathPrefix: false }],
  css: ["~/assets/css/main.css", "~/assets/css/catalog.css"],
  app: {
    head: {
      htmlAttrs: { lang: "ru" },
      title: "Прохук — каталог товаров",
      meta: [
        { name: "robots", content: "noindex, nofollow" },
        {
          name: "description",
          content: "Каталог товаров Прохук с ценами и наличием по магазинам.",
        },
      ],
      link: [{ rel: "icon", type: "image/png", href: "/brand/favicon.png" }],
    },
  },
});
