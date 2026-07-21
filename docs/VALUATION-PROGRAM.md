# The Heat Chart Art-Capital Program — Legal & Paperwork Pack

Working framework for running the valuation + consignment + lending
program without stepping on a landmine. **Not legal advice** — this is
the map to hand a lawyer, and the program's own house rules.

---

## 1. The honest read on the original idea

The plan as sketched: recall sold pieces, relist at 2× with a 75% split
to the original buyer, use the resale prices to substantiate loans.

**What's legitimate in it (most of it):**
- Buying back / consigning back work you sold early and reselling it
  higher is normal art-market behavior. Galleries and artists do it
  constantly. A generous split to the returning collector is just a
  consignment agreement.
- Building a documented sales record and using it to support financing
  is exactly how the art-lending industry works.
- A platform publishing valuations from transparent market data is a
  real, legal business (Artnet, Artprice, ArtTactic).

**The one red line:** presenting *engineered* prices to a lender as
arm's-length market evidence. If resales are pre-arranged with buyers
who are promised most of the money back (or a free commission), and
those prices are then shown to a bank as "what the market pays," that
is misrepresentation to a lender — loan-fraud territory (18 U.S.C.
§ 1014 for federally-connected lenders; state fraud statutes
otherwise). Wash-trading your own index has the same shape.

**The fix is disclosure, and it's built into the app:** relists are
recorded as *consignments* with the prior price, the split, and the
floor on the public record. A disclosed consignment resale is real
market data — a hidden round-trip is fraud. Same transaction, opposite
legal outcome, and the difference is the paperwork.

## 2. What the platform may and may not say

| We DO | We DON'T |
|---|---|
| Publish "HC Value Estimates" with a published methodology | Call any number an "appraisal" |
| Record and verify sales with evidence | Certify authenticity or condition |
| Generate Portfolio Statements from platform records | Promise loan approval or act as a broker |
| Refer members to qualified appraisers/lenders | Take fees contingent on loan outcomes (without advice) |

Why: formal appraisals for lending, insurance, tax, and donation must
be **USPAP-compliant** and performed by a **qualified appraiser** (IRS
definition for tax; lender policy for credit). A platform's estimate is
market data. Keep the two vocabularies strictly separate — every
estimate surface in the app already carries the disclaimer.

## 3. Commissioned vs. non-commissioned (why the app tracks it)

- **Original (open-market) work:** price set by bids/sales → genuine
  price discovery → strong comparable evidence. Copyright presumptively
  stays with the artist.
- **Commissioned work:** price is a negotiated fee for labor →
  income/demand evidence, weak market comp. May carry client-specific
  restrictions (likeness, exclusivity); under 17 U.S.C. § 101 most
  commissions are NOT "works made for hire" unless written, so the
  artist usually keeps copyright — worth stating in commission
  contracts.
- The valuation engine weighs the two differently and says so in the
  estimate basis. Appraisers will respect the distinction; lenders'
  diligence teams will notice it was made.

## 4. Formation / paperwork checklist

1. **Consignment agreement** (template §5) — signed for every relist.
   The app records the disclosed terms; the paper holds the signatures.
2. **Sale evidence standard** — keep: receipt or payment screenshot per
   verified sale (already uploaded to the platform), shipping proof
   when pieces move.
3. **Methodology document** — the estimate methodology is published in
   the app (lib/valuation.ts + /art-capital + every statement). Freeze
   changes with dated versions; lenders hate moving methodologies.
4. **Appraiser relationship** — engage at least one USPAP-credentialed
   appraiser (ISA, AAA, or ASA member) willing to work from Portfolio
   Statements. This is the bridge from "platform data" to "bankable
   valuation."
5. **Lender conversations** — art-secured lending shops and local
   credit unions; lead with the ledger + appraiser pipeline, never with
   platform estimates alone.
6. **Insurance** — scheduled-property coverage for consigned pieces in
   the artist's custody; the consignor should be named.
7. **Taxes** — consignment resales are income to the artist (their
   share) and to the consignor (theirs); 1099-K thresholds apply when
   payments go through processors. Flag for the accountant.

## 5. Consignment agreement — working template

> CONSIGNMENT AGREEMENT
>
> Consignor: ______________________ ("Owner")
> Artist/Consignee: ______________________
> Piece: ______________________ (Heat Chart ID: __________)
>
> 1. Owner delivers the Piece to Artist to offer for resale on The
>    Heat Chart marketplace.
> 2. Prior purchase price of $______ is disclosed and will appear on
>    the Piece's public market record.
> 3. Minimum resale (floor): $______. Artist may accept any bid at or
>    above the floor.
> 4. Proceeds: ____% to Owner, ____% to Artist, paid within ____ days
>    of the buyer's payment clearing. [Alternative: Owner elects a new
>    commissioned piece of equivalent agreed value in lieu of cash.]
> 5. Title remains with Owner until resale completes; risk of loss
>    while in Artist's custody is Artist's, insured for the floor.
> 6. If unsold after ____ days, either party may end this agreement
>    and the Piece returns to Owner at Artist's expense.
> 7. Both parties acknowledge the resale terms will be disclosed on
>    the platform's provenance record.
>
> Signatures / date.

## 6. House rules (enforced in-app)

- Relists of previously-sold pieces REQUIRE a consignment record —
  prior price, split, floor, all public. (Built: `Consignment` model,
  bid-floor enforcement, sale-note disclosure.)
- Verified ✓ requires evidence; unverified sales are labeled
  self-reported everywhere they appear.
- One standing bid per user per piece — a bidder re-bidding moves
  their bid, it never stacks the book or pumps HX.
- Estimates always print their basis and the disclaimer, including in
  the API.
