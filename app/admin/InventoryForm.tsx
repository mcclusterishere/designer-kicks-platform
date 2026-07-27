"use client";

import { useActionState } from "react";
import { saveInventoryItem, type ActionResult } from "@/app/actions";

type Defaults = {
  id?: string;
  name?: string;
  sku?: string | null;
  brand?: string | null;
  size?: string;
  condition?: string;
  costCents?: number;
  listPriceCents?: number | null;
  acquiredFrom?: string | null;
  notes?: string | null;
  imageUrl?: string | null;
  publicListed?: boolean;
};

const input =
  "mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2 text-white placeholder:text-smoke/50 focus:border-volt focus:outline-none";

/** Cents back to a plain dollars string for the form, without currency
 *  symbols — the field is parsed as a number on the way back in. */
function dollars(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? "" : (cents / 100).toFixed(2);
}

export default function InventoryForm({ defaults }: { defaults?: Defaults }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveInventoryItem,
    null
  );
  const editing = Boolean(defaults?.id);

  return (
    <form action={formAction} className="space-y-3" key={defaults?.id ?? "new"}>
      {editing && <input type="hidden" name="id" value={defaults!.id} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="tag text-smoke" htmlFor={`i-name-${defaults?.id ?? "new"}`}>
            Shoe *
          </label>
          <input
            id={`i-name-${defaults?.id ?? "new"}`}
            name="name"
            required
            defaultValue={defaults?.name}
            placeholder="Air Jordan 4 Retro Bred"
            className={input}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="tag text-smoke" htmlFor={`i-size-${defaults?.id ?? "new"}`}>
              Size *
            </label>
            <input
              id={`i-size-${defaults?.id ?? "new"}`}
              name="size"
              required
              defaultValue={defaults?.size}
              placeholder="10.5"
              className={input}
            />
          </div>
          <div>
            <label className="tag text-smoke" htmlFor={`i-cond-${defaults?.id ?? "new"}`}>
              Condition
            </label>
            <select
              id={`i-cond-${defaults?.id ?? "new"}`}
              name="condition"
              defaultValue={defaults?.condition ?? "DS"}
              className={input}
            >
              <option value="DS">DS — deadstock</option>
              <option value="VNDS">VNDS</option>
              <option value="USED">Used</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="tag text-smoke" htmlFor={`i-cost-${defaults?.id ?? "new"}`}>
            Cost basis * ($)
          </label>
          <input
            id={`i-cost-${defaults?.id ?? "new"}`}
            name="cost"
            required
            inputMode="decimal"
            defaultValue={dollars(defaults?.costCents)}
            placeholder="320.00"
            className={input}
          />
          {/* Said here rather than in a help doc nobody opens. */}
          <p className="mt-1 text-[11px] text-smoke">Price paid + tax + inbound shipping.</p>
        </div>
        <div>
          <label className="tag text-smoke" htmlFor={`i-list-${defaults?.id ?? "new"}`}>
            Asking price ($)
          </label>
          <input
            id={`i-list-${defaults?.id ?? "new"}`}
            name="listPrice"
            inputMode="decimal"
            defaultValue={dollars(defaults?.listPriceCents)}
            placeholder="Leave blank if not listed"
            className={input}
          />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor={`i-sku-${defaults?.id ?? "new"}`}>
            SKU
          </label>
          <input
            id={`i-sku-${defaults?.id ?? "new"}`}
            name="sku"
            defaultValue={defaults?.sku ?? ""}
            placeholder="DH6927-111"
            className={input}
          />
          <p className="mt-1 text-[11px] text-smoke">
            Matches the catalog and unlocks live comps.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="tag text-smoke" htmlFor={`i-brand-${defaults?.id ?? "new"}`}>
            Brand
          </label>
          <input
            id={`i-brand-${defaults?.id ?? "new"}`}
            name="brand"
            defaultValue={defaults?.brand ?? ""}
            placeholder="Jordan"
            className={input}
          />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor={`i-from-${defaults?.id ?? "new"}`}>
            Bought from
          </label>
          <input
            id={`i-from-${defaults?.id ?? "new"}`}
            name="acquiredFrom"
            defaultValue={defaults?.acquiredFrom ?? ""}
            placeholder="SNKRS / local / trade"
            className={input}
          />
        </div>
        <div>
          <label className="tag text-smoke" htmlFor={`i-date-${defaults?.id ?? "new"}`}>
            Acquired
          </label>
          <input
            id={`i-date-${defaults?.id ?? "new"}`}
            name="acquiredAt"
            type="date"
            className={input}
          />
          <p className="mt-1 text-[11px] text-smoke">Blank = today. Starts the holding clock.</p>
        </div>
      </div>

      <div>
        <label className="tag text-smoke" htmlFor={`i-img-${defaults?.id ?? "new"}`}>
          Photo URL
        </label>
        <input
          id={`i-img-${defaults?.id ?? "new"}`}
          name="imageUrl"
          defaultValue={defaults?.imageUrl ?? ""}
          placeholder="Leave blank to use the catalog photo"
          className={input}
        />
      </div>

      <div>
        <label className="tag text-smoke" htmlFor={`i-notes-${defaults?.id ?? "new"}`}>
          Notes
        </label>
        <input
          id={`i-notes-${defaults?.id ?? "new"}`}
          name="notes"
          defaultValue={defaults?.notes ?? ""}
          placeholder="Box condition, flaws, where it's stored"
          className={input}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-smoke">
        <input
          type="checkbox"
          name="publicListed"
          defaultChecked={defaults?.publicListed}
          className="h-4 w-4 accent-[#f04e45]"
        />
        Show on The Heat Chart storefront (needs an asking price)
      </label>

      {state && !state.ok && (
        <p role="alert" className="rounded border border-heat/40 bg-heat/10 px-3 py-2 text-sm text-heat">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded border border-volt/40 bg-volt/10 px-3 py-2 text-sm text-volt">
          Saved.
        </p>
      )}

      <button
        disabled={pending}
        className="rounded-lg btn-hard px-5 py-2.5 tag font-bold disabled:opacity-50"
      >
        {pending ? "Saving…" : editing ? "Save changes" : "Add to shelf"}
      </button>
    </form>
  );
}
