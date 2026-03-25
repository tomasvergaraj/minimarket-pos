import type { Product, Promotion } from "@/types";

export interface PromoResult {
  price: number;
  label: string | null;
  /** true if the promo depends on quantity (buy_n_get_m, min_quantity) */
  qtyDependent: boolean;
}

/** Base sell price considering existing product-level discount. */
function basePrice(product: Product): number {
  if (product.is_on_offer && product.discount_price && product.discount_price > 0) {
    return product.discount_price;
  }
  return product.sell_price;
}

function appliesTo(promo: Promotion, product: Product): boolean {
  if (promo.product_id) return promo.product_id === product.id;
  if (promo.category_name) return promo.category_name === product.category;
  return true; // global
}

/**
 * Compute the effective unit price for a product given a cart quantity
 * and the currently active promotions list.
 * Returns the first matching promotion result.
 */
export function computePromotion(
  product: Product,
  qty: number,
  promotions: Promotion[]
): PromoResult {
  const base = basePrice(product);

  for (const promo of promotions) {
    if (!appliesTo(promo, product)) continue;

    if (promo.promo_type === "percentage_discount" && promo.discount_pct != null) {
      return {
        price: Math.round(base * (1 - promo.discount_pct / 100)),
        label: `${promo.discount_pct}% OFF`,
        qtyDependent: false,
      };
    }

    if (promo.promo_type === "fixed_discount" && promo.discount_amount != null) {
      return {
        price: Math.max(0, Math.round(base - promo.discount_amount)),
        label: `-$${promo.discount_amount.toLocaleString("es-CL")}`,
        qtyDependent: false,
      };
    }

    if (
      promo.promo_type === "buy_n_get_m" &&
      promo.buy_qty != null &&
      promo.get_qty != null &&
      qty >= promo.buy_qty
    ) {
      const payFor = promo.buy_qty - promo.get_qty;
      const effectivePrice = Math.round((base * payFor) / promo.buy_qty);
      return {
        price: effectivePrice,
        label: `${promo.buy_qty}x${payFor}`,
        qtyDependent: true,
      };
    }

    if (
      promo.promo_type === "min_quantity" &&
      promo.min_qty != null &&
      promo.special_price != null &&
      qty >= promo.min_qty
    ) {
      return {
        price: promo.special_price,
        label: `x${promo.min_qty}+ precio especial`,
        qtyDependent: true,
      };
    }
  }

  return { price: base, label: null, qtyDependent: false };
}

/**
 * Returns the best promo label for a product (qty=1 check for non-qty-dependent promos).
 * Used to show a badge on product cards without knowing the cart quantity.
 */
export function getPromoLabel(product: Product, promotions: Promotion[]): string | null {
  const result = computePromotion(product, 1, promotions);
  return result.label;
}
