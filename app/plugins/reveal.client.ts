/**
 * Появление секций при прокрутке: элементы с data-reveal получают класс
 * reveal-in, когда входят в кадр (IntersectionObserver). Скрытое состояние
 * включается только этим плагином через класс html.js-reveal — в SSR и без
 * JavaScript контент виден сразу. prefers-reduced-motion — без анимации.
 */
export default defineNuxtPlugin(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.documentElement.classList.add("js-reveal");

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          entry.target.classList.add("reveal-in");
          observer.unobserve(entry.target);
        }
    },
    { rootMargin: "0px 0px -8% 0px" },
  );

  const attach = () => {
    for (const element of document.querySelectorAll<HTMLElement>(
      "[data-reveal]:not(.reveal-in)",
    ))
      observer.observe(element);
  };
  attach();

  // Каталоговые списки и промо-карточки догружаются динамически — новые
  // элементы с data-reveal подхватываются по мере появления в DOM.
  const mutations = new MutationObserver(() => attach());
  mutations.observe(document.body, { childList: true, subtree: true });
});
