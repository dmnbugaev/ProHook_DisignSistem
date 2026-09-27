export function usePageSeo(
  title: MaybeRefOrGetter<string>,
  description: MaybeRefOrGetter<string>,
  image: MaybeRefOrGetter<string> = "/brand/lockup.webp",
) {
  useSeoMeta({
    title: () => `${toValue(title)} — Прохук`,
    description: () => toValue(description),
    ogTitle: () => `${toValue(title)} — Прохук`,
    ogDescription: () => toValue(description),
    ogImage: () => toValue(image),
    ogType: "website",
    robots: "noindex, nofollow",
  });
}
