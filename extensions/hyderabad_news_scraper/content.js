/**
 * High-Speed Multi-Tab Grievance-First Content Script for Hyderabad Regional News.
 * Features:
 *  - Fast link discovery prioritized by civic grievance keywords
 *  - Rapid 1.2s navigation loop
 *  - Detailed extraction of headline, body, zone, and civic grievance categorization
 *  - Live on-screen floating HUD showing worker status and grievance tag
 */

(function () {
  const currentUrl = window.location.href;
  const hostname = window.location.hostname.replace("www.", "");
  console.log("[Hyderabad Multi-Tab Crawler Worker] Active on:", hostname);

  // ================= 1. CIVIC GRIEVANCE TAXONOMY =================
  const GRIEVANCE_CATEGORIES = [
    {
      category: "Roads, Bridges & Sewerage Overflow",
      keywords: ["سڑک", "روڈ", "پل", "گڑھا", "سیوریج", "پانی", "نکاسی", "کیچڑ", "نالہ", "ٹریفک جام", "road", "pothole", "sewerage", "drainage", "waterlogging", "inundated"]
    },
    {
      category: "Electricity & HESCO Outages",
      keywords: ["بجلی", "حیسکو", "hesco", "ٹرانسفارمر", "لوڈشیڈنگ", "بلیک آؤٹ", "power outage", "load shedding", "feeder", "transformer blast", "electricity cut"]
    },
    {
      category: "Drinking Water & WASA Crisis",
      keywords: ["پینے کا پانی", "واسا", "wasa", "فلٹر پلانٹ", "پانی بحران", "ٹینکر", "water crisis", "drinking water", "water shortage"]
    },
    {
      category: "Hospitals & Public Healthcare (LUH)",
      keywords: ["ہسپتال", "سول ہسپتال", "luh", "ڈاکٹر", "ادویات", "ڈینگی", "مریض", "hospital", "doctor", "medicine shortage", "liaquat university hospital"]
    },
    {
      category: "Sanitation & Municipal Neglect (SSWMB/HMC)",
      keywords: ["کچرا", "صفائی", "بلدیہ", "سیوریج", "بدبو", "hmc", "sswmb", "garbage", "trash", "sanitation", "solid waste"]
    },
    {
      category: "Public Protests & Administrative Corruption",
      keywords: ["احتجاج", "مظاہرہ", "شٹر ڈاؤن", "ہڑتال", "شہریوں کا احتجاج", "protest", "strike", "demonstration", "corruption", "dc hyderabad"]
    }
  ];

  function evaluateGrievance(text) {
    const lower = (text || "").toLowerCase();
    for (const cat of GRIEVANCE_CATEGORIES) {
      for (const kw of cat.keywords) {
        if (lower.includes(kw.toLowerCase())) {
          return { isGrievance: true, category: cat.category, match: kw };
        }
      }
    }
    return { isGrievance: false, category: "General Regional News", match: null };
  }

  // ================= 2. HYDERABAD ZONE MAPPING =================
  const districtMap = [
    { name: "Qasimabad", keywords: ["qasimabad", "قاسم آباد", "wadhu wah", "وادھو واہ", "sheedi goth", "nasim nagar", "citizen colony", "marvi town"] },
    { name: "Latifabad", keywords: ["latifabad", "لطیف آباد", "unit 1", "unit 2", "unit 3", "unit 4", "unit 5", "unit 6", "unit 7", "unit 8", "unit 9", "unit 10", "unit 11", "unit 12", "autobahn", "آٹو بھان"] },
    { name: "Hyderabad City", keywords: ["hyderabad city", "حیدرآباد سٹی", "saddar", "صدر", "haider chowk", "حیدر چوک", "thandi sarak", "ٹھنڈی سڑک", "resham gali", "ریشم گلی", "tilak chari", "gul centre", "pacca qila", "tower market"] },
    { name: "Paretabad", keywords: ["paretabad", "پریٹ آباد", "phuleli", "پھلیلی", "fuleli"] },
    { name: "Hyderabad Rural", keywords: ["tando jam", "ٹنڈو جام", "hatri", "ہاتڑی", "husri", "حسری", "rural"] },
    { name: "Kotri / Jamshoro", keywords: ["jamshoro", "جامشورو", "kotri", "کوٹری", "kotri barrage", "کوٹری بیراج", "indus river"] },
    { name: "Matiari", keywords: ["matiari", "مٹیاری", "hala", "ہالہ"] },
    { name: "Tando Allahyar", keywords: ["tando allahyar", "ٹنڈو الہ یار"] }
  ];

  function detectDistrict(text) {
    const lower = (text || "").toLowerCase();
    for (const d of districtMap) {
      for (const kw of d.keywords) {
        if (lower.includes(kw.toLowerCase())) return d.name;
      }
    }
    return "Hyderabad";
  }

  // ================= 3. FLOATING ON-SCREEN HUD =================
  function showCrawlerHUD(headline, metaInfo, isGrievance = false) {
    try {
      let hud = document.getElementById("hyd-crawler-hud");
      if (!hud) {
        hud = document.createElement("div");
        hud.id = "hyd-crawler-hud";
        hud.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:9999999;background:rgba(15,23,42,0.96);backdrop-filter:blur(12px);color:#f8fafc;padding:12px 18px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:12px;box-shadow:0 10px 35px rgba(0,0,0,0.6);border:1.5px solid #0284c7;max-width:380px;display:flex;flex-direction:column;gap:5px;pointer-events:none;animation:fadeIn 0.2s ease;";
        document.body.appendChild(hud);
      }

      if (isGrievance) {
        hud.style.borderColor = "#ef4444";
        hud.style.boxShadow = "0 10px 35px rgba(239,68,68,0.3)";
      } else {
        hud.style.borderColor = "#38bdf8";
        hud.style.boxShadow = "0 10px 35px rgba(56,189,248,0.2)";
      }

      const portalClean = hostname.replace(".com", "").replace("www.", "").toUpperCase();
      hud.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <span style="font-weight:700;color:${isGrievance ? '#f87171' : '#38bdf8'};display:flex;align-items:center;gap:6px;">
            <span>${isGrievance ? '🚨' : '⚡'}</span> [${portalClean} WORKER]
          </span>
          <span style="font-size:10px;background:#1e293b;color:#cbd5e1;padding:2px 6px;border-radius:4px;font-weight:600;">1.2s Fast Crawl</span>
        </div>
        <div style="font-weight:600;font-size:12px;color:#f1f5f9;line-height:1.4;margin-top:2px;">${headline}</div>
        <div style="font-size:11px;color:${isGrievance ? '#fca5a5' : '#94a3b8'};font-weight:500;">${metaInfo}</div>
      `;
    } catch (e) {}
  }

  // ================= 4. ARTICLE VS LISTING DETECTOR =================
  function isArticlePage() {
    // Express News article check
    if (hostname.includes("express.pk")) {
      return (currentUrl.includes("/story/") || currentUrl.includes("/pakistan/") || currentUrl.includes("/sindh/")) && currentUrl.split("/").length > 5;
    }
    // Dawn article check
    if (hostname.includes("dawn.com")) {
      return currentUrl.includes("/news/") && currentUrl.split("/").length > 4;
    }
    // Daily Jang article check
    if (hostname.includes("jang.com.pk")) {
      return currentUrl.includes("/news/") && currentUrl.split("/").length > 4;
    }
    // Kawish / Regional Sindhi portals
    if (hostname.includes("thekawish.com") || hostname.includes("dailyibrat.com")) {
      return currentUrl.includes("/news/") || currentUrl.split("/").length > 4;
    }
    // Generic fallback heuristic
    return document.querySelector("h1") && document.querySelectorAll("article p, main p, p").length >= 3;
  }

  // ================= 5. ARTICLE EXTRACTION (HIGH SPEED) =================
  function processArticle() {
    const h1 = document.querySelector("h1");
    let title = h1 ? h1.innerText.trim() : "";
    if (!title) {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle && ogTitle.content) title = ogTitle.content.trim();
      else title = document.title;
    }

    // Strip portal suffix
    title = title.replace(/\s*[-|]\s*(Dainik Bhaskar|Live Hindustan|Hindustan|Prabhat Khabar|Jagran|Amar Ujala).*$/i, "").trim();

    const paragraphs = Array.from(document.querySelectorAll("article p, .story-content p, .article-body p, main p, p"))
      .map(p => p.innerText.trim())
      .filter(t => t.length > 20 && !t.includes("ऐप डाउनलोड") && !t.includes("सब्सक्राइब") && !t.includes("Follow us"));

    const content = paragraphs.slice(0, 10).join("\n\n");
    const snippet = paragraphs.slice(0, 2).join(" ").substring(0, 320);

    const district = detectDistrict(title + " " + content);
    const grievanceInfo = evaluateGrievance(title + " " + content);

    let mediaUrl = "";
    const metaImg = document.querySelector('meta[property="og:image"], meta[name="twitter:image"], meta[itemprop="image"]');
    if (metaImg && metaImg.content && !metaImg.content.includes("logo") && !metaImg.content.includes("default") && !metaImg.content.includes("favicon")) {
      mediaUrl = metaImg.content;
    }
    if (!mediaUrl) {
      const artImg = document.querySelector("article img, main img, figure img, .story-media img, .detail-img img");
      if (artImg) mediaUrl = artImg.currentSrc || artImg.src || artImg.getAttribute("data-src") || artImg.getAttribute("data-original") || "";
    }
    if (!mediaUrl || mediaUrl.includes("logo") || mediaUrl.includes("grey") || mediaUrl.startsWith("data:")) {
      const fallbackThemes = {
        "Roads, Bridges & Waterlogging": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
        "Electricity & Power Outages": "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80",
        "Drinking Water & Water Supply": "https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=800&q=80",
        "Hospitals & Public Healthcare": "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80",
        "Sanitation & Municipal Neglect": "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=800&q=80"
      };
      mediaUrl = fallbackThemes[grievanceInfo.category] || "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80";
    }
    const ts = Date.now();

    const articlePayload = {
      id: `hyd_multi_${ts}_${Math.random().toString(36).substring(2, 7)}`,
      title: title,
      snippet: snippet || title,
      content: content || snippet,
      source_name: hostname.replace("www.", ""),
      source_url: currentUrl,
      media_urls: [mediaUrl],
      district_hint: district,
      is_grievance: grievanceInfo.isGrievance,
      grievance_category: grievanceInfo.category,
      urgency_hint: grievanceInfo.isGrievance ? 4 : 2,
      scraped_at: ts / 1000
    };

    if (title.length > 10) {
      const meta = grievanceInfo.isGrievance 
        ? `📍 ${district} | 🚨 ${grievanceInfo.category} (Moving in 1.2s...)`
        : `📍 ${district} | Streamed. Moving to next article in 1.2s...`;
      showCrawlerHUD(`✓ Scraped: "${title.substring(0, 42)}..."`, meta, grievanceInfo.isGrievance);

      // Publish to background worker
      chrome.runtime.sendMessage({
        type: "ARTICLE_SCRAPED",
        article: articlePayload
      }).catch(() => {});
    }

    // Fast 1.2s automated navigation to next queued article
    setTimeout(() => {
      showCrawlerHUD("Navigating to next article...", "Requesting next URL from worker queue...", false);
      chrome.runtime.sendMessage({ type: "REQUEST_NEXT_ARTICLE" }).catch(() => {});
    }, 1200);
  }

  // ================= 6. LISTING / SECTION HARVESTING (GRIEVANCE FIRST) =================
  function processListing() {
    showCrawlerHUD("Harvesting news links...", "Scanning portal & prioritizing civic grievances...", false);

    const linksWithScore = [];
    const seenHrefs = new Set();
    const anchors = Array.from(document.querySelectorAll("a[href]"));

    for (const a of anchors) {
      const href = a.href || "";
      const linkText = (a.innerText || "").trim();
      if (!href || href.startsWith("javascript:") || href.includes("#") || seenHrefs.has(href)) continue;

      let isArticle = false;
      if (hostname.includes("express.pk")) {
        if ((href.includes("/story/") || href.includes("/pakistan/") || href.includes("/sindh/")) && href.split("/").length > 5) {
          isArticle = true;
        }
      } else if (hostname.includes("dawn.com")) {
        if (href.includes("/news/") && href.split("/").length > 4) {
          isArticle = true;
        }
      } else if (hostname.includes("jang.com.pk")) {
        if (href.includes("/news/") && href.split("/").length > 4) {
          isArticle = true;
        }
      } else if (hostname.includes("thekawish.com") || hostname.includes("dailyibrat.com")) {
        if (href.includes("/news/") || href.split("/").length > 4) {
          isArticle = true;
        }
      } else if (href.includes("/news/") || href.includes("/story/")) {
        isArticle = true;
      }

      if (isArticle) {
        seenHrefs.add(href);
        const evalResult = evaluateGrievance(linkText + " " + href);
        // Grievance articles get priority score 10
        linksWithScore.push({
          url: href,
          isGrievance: evalResult.isGrievance,
          score: evalResult.isGrievance ? 10 : 1
        });
      }
    }

    // Sort: Civic Grievances FIRST, then other stories
    linksWithScore.sort((a, b) => b.score - a.score);
    const sortedUrls = linksWithScore.map(item => item.url);
    const grievanceCount = linksWithScore.filter(item => item.isGrievance).length;

    console.log(`[Hyderabad Multi-Tab Crawler] Discovered ${sortedUrls.length} articles (${grievanceCount} civic grievances) on ${currentUrl}`);

    if (sortedUrls.length > 0) {
      showCrawlerHUD(
        `Discovered ${sortedUrls.length} Articles!`,
        `🚨 ${grievanceCount} Civic Grievances prioritized. Loading first...`,
        grievanceCount > 0
      );

      chrome.runtime.sendMessage({
        type: "PAGE_HARVESTED_LINKS",
        links: sortedUrls,
        pageUrl: currentUrl
      }).catch(() => {});
    } else {
      showCrawlerHUD("Rotating section...", "No article links on page. Rotating seed...", false);
      setTimeout(() => {
        chrome.runtime.sendMessage({ type: "REQUEST_NEXT_ARTICLE" }).catch(() => {});
      }, 1500);
    }
  }

  // Fast dispatcher (350ms after DOM load)
  setTimeout(() => {
    if (isArticlePage()) {
      processArticle();
    } else {
      processListing();
    }
  }, 450);
})();
