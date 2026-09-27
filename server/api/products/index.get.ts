import { parseCatalogQuery } from "../../../shared/utils/catalog-query";
import { catalogRepository } from "../../repositories/catalog";
export default defineEventHandler((event) =>
  catalogRepository.list(parseCatalogQuery(getQuery(event))),
);
