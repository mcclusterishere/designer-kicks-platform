import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
try { process.loadEnvFile(); } catch {}
const prisma = new PrismaClient();

const EMAIL = "shot-rival@test.example";
await prisma.artistProfile.deleteMany({ where: { slug: "shot-rival" } });
await prisma.user.deleteMany({ where: { email: EMAIL } });
await prisma.user.create({
  data: {
    name: "Shot Rival",
    email: EMAIL,
    passwordHash: await hash("rivalpass99", 10),
    artistProfile: {
      create: {
        slug: "shot-rival",
        displayName: "Shot Rival",
        status: "APPROVED",
        submissions: {
          create: {
            title: "Shot Rival Piece",
            artistName: "Shot Rival",
            email: EMAIL,
            baseShoe: "Nike Air Force 1",
            category: "sneakers",
            imageUrl: "/seed/ge-dr-1.webp",
            status: "APPROVED",
          },
        },
      },
    },
  },
});

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:3000/signin", { waitUntil: "networkidle" });
await page.fill("#email", EMAIL);
await page.fill("#password", "rivalpass99");
await page.getByRole("button", { name: "Sign In", exact: true }).click();
await page.waitForURL("**/profile", { timeout: 15000 });
await page.locator("[data-testid=walkthrough]").waitFor({ timeout: 10000 });
await page.screenshot({ path: "e2e/.artifacts/walkthrough.png" });

await page.goto("http://localhost:3000/artists/gunnar-esquivel", { waitUntil: "networkidle" });
await page.locator("[data-testid=profile-challenge]").first().waitFor({ timeout: 10000 });
await page.locator("[data-testid=profile-challenge]").first().scrollIntoViewIfNeeded();
await page.screenshot({ path: "e2e/.artifacts/profile-challenge.png" });

await prisma.submission.deleteMany({ where: { title: "Shot Rival Piece" } });
await prisma.artistProfile.deleteMany({ where: { slug: "shot-rival" } });
await prisma.user.deleteMany({ where: { email: EMAIL } });
await browser.close();
await prisma.$disconnect();
console.log("done");
