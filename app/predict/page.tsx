import { redirect } from "next/navigation";

/**
 * The Call lives inside the market now.
 *
 * Splitting "look at a price" from "bet on that price" across two pages made
 * them feel like two products. They're one act, so they're one panel — open
 * any pair on the exchange or the customs floor and the chart, the origin
 * and the ticket are all right there.
 *
 * This redirect stays for every link already in the wild.
 */
export const dynamic = "force-dynamic";

export default async function PredictRedirect() {
  redirect("/market?calls=1");
}
