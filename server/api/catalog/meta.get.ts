import { catalogRepository } from "../../repositories/catalog";
export default defineEventHandler(() => catalogRepository.getMeta());
