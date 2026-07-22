# Ship Heat Chart to the App Store

This folder is a complete, zero-dependency Xcode project: a native
Swift shell around theheatchart.com. No CocoaPods, no npm, nothing to
install — it opens and archives on any Mac with Xcode 15+.

What the shell does:
- Loads https://theheatchart.com full-bleed (the site is already
  app-first: standalone display, safe-area tab bar, dark chrome).
- Same-site links stay in the app; external links (affiliate outlinks,
  socials, mailto) open in Safari — Apple wants exactly this split.
- Branded offline screen with retry, dark launch screen, portrait only.
- Cookies persist, so members stay signed in between launches.

## Build & upload (about 15 minutes on a Mac)

1. Open `ios-app/HeatChart.xcodeproj` in Xcode.
2. Click the blue `HeatChart` project icon → target `HeatChart` →
   **Signing & Capabilities** → set **Team** to your Apple Developer
   team. Leave the bundle id `com.mcclustercorp.heatchart` (or change
   it — just use the same one in App Store Connect).
3. In the toolbar device picker choose **Any iOS Device (arm64)**.
4. **Product → Archive.** When the Organizer opens:
   **Distribute App → App Store Connect → Upload** (accept defaults).
5. The build appears in App Store Connect → TestFlight within ~15–30
   minutes of processing.

No Mac? Two workarounds, both fine with this repo:
- A cloud Mac for an hour (MacStadium, MacinCloud, AWS EC2 Mac).
- A cloud CI that builds iOS from a repo (Codemagic has a free tier) —
  point it at `ios-app/` and give it your App Store Connect API key.

## Everything to paste into App Store Connect

See `docs/APP-STORE-KIT.md` — name, subtitle, description, keywords,
privacy answers, review notes, and the screenshot set under
`marketing/app-store/`.
