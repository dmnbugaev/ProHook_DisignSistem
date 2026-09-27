export interface City {
  id: string;
  name: string;
}
export interface Store {
  id: string;
  cityId: string;
  name: string;
  description: string;
  address?: string;
  hours?: string;
}
export type Availability = "available" | "low" | "unavailable" | "unknown";
export interface StoreOffer {
  storeId: string;
  /** Integer minor currency units (kopecks). */
  price: number;
  oldPrice?: number;
  currency: "RUB";
  availability: Availability;
}
