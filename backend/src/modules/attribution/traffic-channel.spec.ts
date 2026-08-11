import { classifyTraffic, referrerHost } from "./traffic-channel";

/**
 * Every referrer string below is one a real browser sends. The link shims
 * (l.facebook.com, lm.facebook.com, t.co) are the ones that decide whether the
 * report is trustworthy: they are what Facebook and Twitter actually put in
 * `document.referrer`, and a classifier that only knows "facebook.com" files
 * the largest social channel under "Another website".
 */

describe("referrerHost", () => {
  it("strips scheme, path and www", () => {
    expect(referrerHost("https://www.google.com/search?q=oet")).toBe("google.com");
  });
  it("survives a bare host", () => {
    expect(referrerHost("m.youtube.com")).toBe("m.youtube.com");
  });
  it("returns null for empty and unparseable input", () => {
    expect(referrerHost("")).toBeNull();
    expect(referrerHost(null)).toBeNull();
    expect(referrerHost("   ")).toBeNull();
  });
});

describe("classifyTraffic — organic search", () => {
  it("classifies google.com", () => {
    expect(classifyTraffic({ referrer: "https://www.google.com/" }).channel).toBe("ORGANIC_SEARCH");
  });
  it("classifies every google country domain from one rule", () => {
    for (const r of ["https://www.google.co.uk/", "https://www.google.com.pk/", "https://www.google.ae/", "https://www.google.com.ph/"]) {
      expect(classifyTraffic({ referrer: r }).channel).toBe("ORGANIC_SEARCH");
    }
  });
  it("classifies bing, duckduckgo and ecosia", () => {
    expect(classifyTraffic({ referrer: "https://www.bing.com/search?q=oet" }).source).toBe("bing");
    expect(classifyTraffic({ referrer: "https://duckduckgo.com/" }).channel).toBe("ORGANIC_SEARCH");
    expect(classifyTraffic({ referrer: "https://www.ecosia.org/" }).channel).toBe("ORGANIC_SEARCH");
  });
});

describe("classifyTraffic — YouTube", () => {
  it("classifies the desktop, mobile and short hosts", () => {
    for (const r of ["https://www.youtube.com/", "https://m.youtube.com/", "https://youtu.be/abc123"]) {
      const c = classifyTraffic({ referrer: r });
      expect(c.channel).toBe("YOUTUBE");
      expect(c.source).toBe("youtube");
    }
  });
  it("classifies a tagged YouTube description link with no referrer at all", () => {
    // The common case: the link in a video description carries utm tags, and the
    // YouTube app strips the referrer entirely.
    const c = classifyTraffic({ utmSource: "youtube", utmMedium: "video", utmCampaign: "reading-tips" });
    expect(c.channel).toBe("YOUTUBE");
    expect(c.campaign).toBe("reading-tips");
  });
});

describe("classifyTraffic — Facebook and its link shims", () => {
  it("classifies the shims, not just facebook.com", () => {
    for (const r of [
      "https://www.facebook.com/",
      "https://m.facebook.com/",
      "https://l.facebook.com/l.php?u=https%3A%2F%2Foethq.com",
      "https://lm.facebook.com/l.php?u=https%3A%2F%2Foethq.com",
      "https://business.facebook.com/"
    ]) {
      expect(classifyTraffic({ referrer: r }).channel).toBe("FACEBOOK");
    }
  });
  it("treats a bare fbclid as organic Facebook, not paid", () => {
    // Facebook stamps fbclid on every outbound click, ad or not. Calling it paid
    // would invent ad spend that never happened.
    expect(classifyTraffic({ clickId: "IwAR123", clickIdKind: "fbclid" }).channel).toBe("FACEBOOK");
  });
  it("calls it paid social only when the medium says so", () => {
    expect(classifyTraffic({ clickId: "IwAR123", clickIdKind: "fbclid", utmMedium: "paid_social" }).channel).toBe("PAID_SOCIAL");
  });
});

describe("classifyTraffic — paid search", () => {
  it("trusts gclid over anything hand-typed", () => {
    const c = classifyTraffic({ clickId: "Cj0KC", clickIdKind: "gclid", utmSource: "google" });
    expect(c.channel).toBe("PAID_SEARCH");
  });
  it("classifies msclkid as Bing paid", () => {
    expect(classifyTraffic({ clickId: "abc", clickIdKind: "msclkid" }).source).toBe("bing");
  });
  it("upgrades organic search to paid when utm_medium is cpc", () => {
    expect(classifyTraffic({ utmSource: "google", utmMedium: "cpc" }).channel).toBe("PAID_SEARCH");
  });
  it("upgrades a search REFERRER to paid when the medium is cpc", () => {
    expect(classifyTraffic({ referrer: "https://www.google.com/", utmMedium: "ppc" }).channel).toBe("PAID_SEARCH");
  });
});

describe("classifyTraffic — social and messaging", () => {
  it("classifies Instagram and its shim", () => {
    expect(classifyTraffic({ referrer: "https://l.instagram.com/" }).channel).toBe("INSTAGRAM");
    expect(classifyTraffic({ referrer: "https://www.instagram.com/" }).channel).toBe("INSTAGRAM");
  });
  it("classifies t.co as X, not as an unknown website", () => {
    expect(classifyTraffic({ referrer: "https://t.co/xyz" }).channel).toBe("TWITTER");
  });
  it("classifies x.com and twitter.com the same", () => {
    expect(classifyTraffic({ referrer: "https://x.com/" }).channel).toBe("TWITTER");
    expect(classifyTraffic({ referrer: "https://twitter.com/" }).channel).toBe("TWITTER");
  });
  it("classifies WhatsApp share links", () => {
    expect(classifyTraffic({ referrer: "https://wa.me/" }).channel).toBe("WHATSAPP");
    expect(classifyTraffic({ referrer: "https://api.whatsapp.com/" }).channel).toBe("WHATSAPP");
  });
  it("classifies TikTok and LinkedIn", () => {
    expect(classifyTraffic({ referrer: "https://www.tiktok.com/" }).channel).toBe("TIKTOK");
    expect(classifyTraffic({ referrer: "https://lnkd.in/abc" }).channel).toBe("LINKEDIN");
  });
});

describe("classifyTraffic — email", () => {
  it("classifies a click from a Gmail inbox as email, not organic search", () => {
    // mail.google.com ends with google.com. Order matters here, and getting it
    // wrong quietly inflates organic search with every activation email click.
    expect(classifyTraffic({ referrer: "https://mail.google.com/" }).channel).toBe("EMAIL");
  });
  it("classifies a Yahoo inbox as email, not Yahoo search", () => {
    expect(classifyTraffic({ referrer: "https://mail.yahoo.com/" }).channel).toBe("EMAIL");
  });
  it("classifies utm_medium=email with no referrer", () => {
    expect(classifyTraffic({ utmMedium: "email", utmSource: "activation" }).channel).toBe("EMAIL");
  });
  it("lets utm_medium=email beat a social source", () => {
    expect(classifyTraffic({ utmSource: "facebook", utmMedium: "email" }).channel).toBe("EMAIL");
  });
});

describe("classifyTraffic — direct and referral", () => {
  it("classifies no referrer and no tags as direct", () => {
    expect(classifyTraffic({}).channel).toBe("DIRECT");
    expect(classifyTraffic({ referrer: "" }).channel).toBe("DIRECT");
  });
  it("classifies an unknown site as a referral, keeping the host", () => {
    const c = classifyTraffic({ referrer: "https://www.nursingtimes.co.uk/article/1" });
    expect(c.channel).toBe("REFERRAL");
    expect(c.source).toBe("nursingtimes.co.uk");
  });
  it("keeps an unrecognised utm_source rather than discarding it", () => {
    const c = classifyTraffic({ utmSource: "physio-forum", utmMedium: "post" });
    expect(c.channel).toBe("REFERRAL");
    expect(c.source).toBe("physio-forum");
  });
});

describe("classifyTraffic — hostile input", () => {
  it("does not blow up on a malformed referrer", () => {
    expect(classifyTraffic({ referrer: "not a url" }).channel).toBe("DIRECT");
    expect(classifyTraffic({ referrer: "javascript:alert(1)" }).channel).toBe("DIRECT");
  });
  it("truncates a huge campaign instead of storing it", () => {
    const c = classifyTraffic({ utmSource: "youtube", utmCampaign: "x".repeat(5000) });
    expect(c.campaign!.length).toBe(200);
  });
  it("does not match a lookalike domain", () => {
    expect(classifyTraffic({ referrer: "https://notgoogle.com/" }).channel).toBe("REFERRAL");
    expect(classifyTraffic({ referrer: "https://facebook.com.evil.example/" }).channel).toBe("REFERRAL");
  });
});
