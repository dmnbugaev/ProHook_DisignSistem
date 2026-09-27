export default defineNuxtConfig({
  compatibilityDate: "2026-09-27",
  devtools: { enabled: false },
  components: [{ path: "~/components", pathPrefix: false }],
  css: ["~/assets/css/main.css"],
  app: {
    head: {
      htmlAttrs: { lang: "ru" },
      title: "Прохук — дизайн-система",
      meta: [
        {
          name: "description",
          content:
            "Визуальный язык Прохук: айдентика, типографика, компоненты и движение. Интерактивная дизайн-система.",
        },
      ],
      link: [{ rel: "icon", type: "image/png", href: "/brand/favicon.png" }],
    },
  },
});
