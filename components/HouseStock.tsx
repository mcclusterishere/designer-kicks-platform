import Link from "next/link";
import Money from "@/components/Money";
import { storefront } from "@/lib/reseller";

/**
 * In Stock — pairs The Heat Chart owns and is selling directly.
 *
 * Everything else on the Market is other people's inventory: the
 * exchange tracks prices we don't set, the customs board lists artists'
 * work we don't own. This board is ours, and it says so plainly rather
 * than blending in. A buyer should always know who they're buying from.
 *
 * No checkout here yet, deliberately. The Terms say we process no
 * payments and are not a party to any transaction, and that is still
 * true — listing a pair isn't selling it. Wiring a card form before
 * those words change would make the site's own legal page wrong, so the
 * buy path is a message until checkout lands with the Terms to match.
 */
export default async function HouseStock() {
  const items = await storefront(60);

  if (items.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-edge bg-surface p-10 text-center">
        <p className="display text-2xl text-white">Nothing in stock right now</p>
        <p className="mx-auto mt-2 max-w-md text-smoke">
          Pairs we own outright show up here the moment they&apos;re listed. In the meantime the{" "}
          <Link href="/market" className="text-volt underline">
            exchange
          </Link>{" "}
          tracks what everything is trading for.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="rounded-xl border border-volt/40 bg-surface p-4">
        <p className="tag text-volt">Sold by The Heat Chart</p>
        <p className="mt-1 text-sm text-smoke">
          These {items.length === 1 ? "is a pair" : "are pairs"} we own and ship ourselves — not
          a listing from a third party, and not an affiliate link. Message us to buy and we&apos;ll
          sort payment and shipping direct.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((it) => (
          <div
            key={it.id}
            className="card-lift overflow-hidden rounded-xl border border-edge bg-surface"
          >
            <div className="aspect-square overflow-hidden bg-panel">
              {it.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.imageUrl}
                  alt={`${it.name}, size ${it.size}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="tag text-smoke">No photo yet</span>
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-bold text-white">{it.name}</p>
              <p className="mt-0.5 text-xs text-smoke">
                {it.brand && <>{it.brand} · </>}Size {it.size} ·{" "}
                {it.condition === "DS"
                  ? "Deadstock"
                  : it.condition === "VNDS"
                    ? "Very near deadstock"
                    : "Used"}
              </p>
              <p className="mt-2 text-lg font-bold tabular-nums text-white">
                <Money cents={it.listPriceCents!} />
              </p>
              <Link
                href={`/messages?about=${encodeURIComponent(`${it.name} — size ${it.size}`)}`}
                className="mt-2.5 block rounded-lg btn-hard py-2 text-center tag font-bold"
              >
                Ask to buy
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
