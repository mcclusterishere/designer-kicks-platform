import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/articles";

export default function robots(): MetadataRoute.Robots {
  return {
    // /go is the outbound click redirect — crawlers following every buy
    // link inflate Market Pulse and look like bot traffic to affiliate
    // networks, so compliant bots are told to stay out.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/go"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
