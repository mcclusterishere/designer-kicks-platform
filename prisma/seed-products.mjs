// The Market's curated slate. Every product tops up by slug on deploy:
// created if missing, NEVER updated — the admin's edits (tagged links,
// price tweaks, swapped images) always win. Links are plain merchant
// URLs on purpose: /go applies the AFF_*_TEMPLATE env tags at click
// time, so the whole slate starts paying the moment a program approves
// and its template lands in Railway. No link surgery required.
//
// Keep every host on the MERCHANTS allowlist in lib/affiliates.ts —
// /go bounces anything it doesn't recognize.

let s = 0;
function p({ slug, name, merchant, category, blurb, price, url, featured, imageUrl }) {
  s += 10;
  return {
    slug,
    name,
    merchant,
    category,
    blurb,
    price: price ?? null,
    imageUrl: imageUrl ?? null,
    affiliateUrl: url,
    featured: featured ?? false,
    sortOrder: s,
  };
}

export const marketSlate = [
  // ---- Cop The Heat: the marketplaces for hyped + rare pairs ----
  p({
    slug: "stockx-sneakers",
    name: "StockX — bid or buy every pair",
    merchant: "StockX",
    category: "marketplace",
    blurb: "The stock market of sneakers. Live asks on everything from the drop calendar, verified before it ships.",
    url: "https://stockx.com/sneakers",
    featured: true,
  }),
  p({
    slug: "goat-sneakers",
    name: "GOAT — new, used & vintage grails",
    merchant: "GOAT",
    category: "marketplace",
    blurb: "Deepest catalog in the game — including used and vintage pairs the other apps won't touch.",
    url: "https://www.goat.com/sneakers",
  }),
  p({
    slug: "etsy-custom-sneakers",
    name: "Etsy — commission custom heat",
    merchant: "Etsy",
    category: "marketplace",
    blurb: "Hand-painted one-of-ones from working customizers — the same craft that battles on this site.",
    url: "https://www.etsy.com/search?q=custom%20sneakers",
    featured: true,
  }),
  p({
    slug: "ebay-sneakers",
    name: "eBay Sneakers — the rare & the vintage",
    merchant: "eBay",
    category: "marketplace",
    blurb: "Authenticity Guarantee on pairs over $100, and the only place half the 90s-2000s vault still surfaces.",
    url: "https://www.ebay.com/b/Sneakers/15709/bn_57918",
  }),
  p({
    slug: "kickscrew-catalog",
    name: "KicksCrew — global sizes & GRs",
    merchant: "KicksCrew",
    category: "marketplace",
    blurb: "Overseas stock means sizes and colorways that sold out stateside are still sitting here.",
    url: "https://www.kickscrew.com/",
  }),
  p({
    slug: "stadium-goods-catalog",
    name: "Stadium Goods — deadstock, consigned",
    merchant: "Stadium Goods",
    category: "marketplace",
    blurb: "The consignment giant. Deadstock heat, brick-and-mortar trust.",
    url: "https://www.stadiumgoods.com/",
  }),
  p({
    slug: "grailed-sneakers",
    name: "Grailed — the menswear vault",
    merchant: "Grailed",
    category: "marketplace",
    blurb: "Where archive pieces and worn-once grails go up for real-people prices.",
    url: "https://www.grailed.com/shop?query=sneakers",
  }),
  p({
    slug: "flight-club-catalog",
    name: "Flight Club — the OG consignment shop",
    merchant: "Flight Club",
    category: "marketplace",
    blurb: "The store that invented sneaker consignment. NY, LA, Miami — and the site.",
    url: "https://www.flightclub.com/",
  }),

  // ---- Fresh Releases: retail for launch day ----
  p({
    slug: "nike-snkrs-launch",
    name: "SNKRS — every Nike & Jordan launch",
    merchant: "SNKRS",
    category: "retail",
    blurb: "The draw everyone loses and enters anyway. Every drop on our calendar links here for a reason.",
    url: "https://www.nike.com/launch",
  }),
  p({
    slug: "adidas-confirmed",
    name: "adidas CONFIRMED — Three Stripes drops",
    merchant: "adidas",
    category: "retail",
    blurb: "Yeezy-era muscle memory, now the home of AE and BadBo launches.",
    url: "https://www.adidas.com/us/release-dates",
  }),
  p({
    slug: "foot-locker-shoes",
    name: "Foot Locker — the mall run, online",
    merchant: "Foot Locker",
    category: "retail",
    blurb: "House of Hoops raffles and GRs that actually restock.",
    url: "https://www.footlocker.com/category/shoes.html",
  }),
  p({
    slug: "finish-line-shoes",
    name: "Finish Line — launch reservations",
    merchant: "Finish Line",
    category: "retail",
    blurb: "Sleeper raffle entries on Jordan launch days — most people forget they exist.",
    url: "https://www.finishline.com/",
  }),
  p({
    slug: "jd-sports-shoes",
    name: "JD Sports — exclusives & GRs",
    merchant: "JD Sports",
    category: "retail",
    blurb: "UK-born, US-stocked — carries exclusives the big two don't get.",
    url: "https://www.jdsports.com/",
  }),
  p({
    slug: "end-launches",
    name: "END. Launches — boutique raffles",
    merchant: "END.",
    category: "retail",
    blurb: "The boutique draw for collabs that never touch SNKRS.",
    url: "https://www.endclothing.com/us/launches",
  }),

  // ---- Customizer Supplies: what the artists on this site actually use ----
  p({
    slug: "angelus-leather-paint",
    name: "Angelus Leather Paint — the standard",
    merchant: "Angelus Direct",
    category: "customization",
    blurb: "The paint on 90% of the customs in our battles. Start with the 1oz set, graduate to 4oz staples.",
    price: "From $3.95",
    url: "https://angelusdirect.com/collections/leather-paint",
    featured: true,
  }),
  p({
    slug: "angelus-finishers",
    name: "Angelus Finishers — matte to high gloss",
    merchant: "Angelus Direct",
    category: "customization",
    blurb: "The clear coat that decides whether your work survives a wear. Matte for most jobs.",
    url: "https://angelusdirect.com/collections/finishers",
  }),
  p({
    slug: "angelus-prep-deglazer",
    name: "Angelus Preparer & Deglazer",
    merchant: "Angelus Direct",
    category: "customization",
    blurb: "Strip the factory finish first or watch your paint crack. Non-negotiable step one.",
    url: "https://angelusdirect.com/collections/prep",
  }),
  p({
    slug: "angelus-brushes",
    name: "Angelus Brush Sets",
    merchant: "Angelus Direct",
    category: "customization",
    blurb: "Detail liners to wide flats — the strokes that separate clean lines from craft-fair work.",
    url: "https://angelusdirect.com/collections/brushes",
  }),
  p({
    slug: "amazon-airbrush-kit",
    name: "Airbrush kits — fades & gradients",
    merchant: "Amazon",
    category: "customization",
    blurb: "The tool behind every smooth fade in the league. Compressor kits start cheap; upgrade when you're sure.",
    url: "https://www.amazon.com/s?k=airbrush+kit+for+sneaker+customizing",
  }),

  // ---- Keep Them Clean: care & protection ----
  p({
    slug: "reshoevn8r-cleaning-kit",
    name: "Reshoevn8r Signature Cleaning Kit",
    merchant: "Reshoevn8r",
    category: "cleaning",
    blurb: "Three brushes, solution, and the wash bag that survives midsole abuse. The restoration channel favorite.",
    price: "From $29.95",
    url: "https://reshoevn8r.com/collections/shoe-cleaning-kits",
    featured: true,
  }),
  p({
    slug: "crep-protect-spray",
    name: "Crep Protect — rain & stain armor",
    merchant: "Crep Protect",
    category: "cleaning",
    blurb: "The spray-before-you-wear ritual. Two coats and suede stops fearing the forecast.",
    url: "https://crepprotect.com/",
  }),
  p({
    slug: "amazon-jason-markk-kit",
    name: "Jason Markk Essential Kit",
    merchant: "Amazon",
    category: "cleaning",
    blurb: "The premium cleaner in the tiny bottle that lasts a year. Gentle enough for painted panels.",
    url: "https://www.amazon.com/s?k=jason+markk+essential+kit",
  }),
  p({
    slug: "amazon-magic-eraser-midsole",
    name: "Midsole erasers & sole brighteners",
    merchant: "Amazon",
    category: "cleaning",
    blurb: "Yellowed soles and scuffed midsoles come back from the dead for under $15.",
    url: "https://www.amazon.com/s?k=sneaker+sole+bright+midsole+cleaner",
  }),

  // ---- Laces & Extras ----
  p({
    slug: "lace-lab-laces",
    name: "Lace Lab — the lace swap upgrade",
    merchant: "Lace Lab",
    category: "accessories",
    blurb: "Rope, flat, oval — the $10 move that makes a GR look like a PE.",
    url: "https://www.lacelab.com/",
  }),
  p({
    slug: "amazon-crease-protectors",
    name: "Crease protectors & toe shields",
    merchant: "Amazon",
    category: "accessories",
    blurb: "Force fields for toe boxes. Your 1s will thank you.",
    url: "https://www.amazon.com/s?k=sneaker+crease+protector",
  }),
  p({
    slug: "amazon-display-cases",
    name: "Stackable display cases",
    merchant: "Amazon",
    category: "accessories",
    blurb: "Magnetic-door crates that turn a closet pile into a wall of heat.",
    url: "https://www.amazon.com/s?k=sneaker+display+case+magnetic",
  }),
  p({
    slug: "amazon-cedar-shoe-trees",
    name: "Cedar shoe trees",
    merchant: "Amazon",
    category: "accessories",
    blurb: "Shape holders that also kill moisture. Grails deserve better than tissue paper.",
    url: "https://www.amazon.com/s?k=cedar+shoe+trees",
  }),
];
