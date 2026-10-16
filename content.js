(() => {
  const ROOT = document.documentElement;
  ROOT.classList.add("lsts-dark-enabled");

  // Universal CSS Color Parser (Supports oklch, lab, color(srgb), rgb, hsl, hex)
  const colorCache = new Map();
  let ctx = null;

  function parseAnyColor(colorStr) {
    if (!colorStr || colorStr === "transparent" || colorStr === "rgba(0, 0, 0, 0)") {
      return null;
    }
    if (colorCache.has(colorStr)) {
      return colorCache.get(colorStr);
    }

    try {
      if (!ctx) {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        ctx = canvas.getContext("2d", { willReadFrequently: true });
      }
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000000";
      ctx.fillStyle = colorStr;
      ctx.fillRect(0, 0, 1, 1);
      const data = ctx.getImageData(0, 0, 1, 1).data;
      const rgba = [data[0], data[1], data[2], +(data[3] / 255).toFixed(3)];
      colorCache.set(colorStr, rgba);
      return rgba;
    } catch (e) {
      return null;
    }
  }

  function getBrightness([r, g, b]) {
    return (r * 299 + g * 587 + b * 114) / 1000;
  }

  // Matches white, off-white, slate-50, warm cream, and light gray surfaces
  function isLightSurface(rgba) {
    if (!rgba || rgba[3] < 0.15) return false;
    const [r, g, b] = rgba;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    return getBrightness(rgba) > 200 && saturation < 0.25;
  }

  function processElement(el) {
    if (!(el instanceof HTMLElement)) return;
    const tag = el.tagName;
    if (["SCRIPT", "STYLE", "LINK", "META", "HEAD", "HTML", "BODY"].includes(tag)) return;

    // 1. Protect images, SVGs, and the green sprout mascot
    if (tag === "IMG" || tag === "SVG" || tag === "PICTURE" || tag === "CANVAS") {
      const style = window.getComputedStyle(el);
      // If the page renders a blurred duplicate "ghost" image behind the mascot, hide the duplicate
      if (style.filter && style.filter.includes("blur")) {
        el.setAttribute("data-lsts-role", "decorative-glow");
        return;
      }

      el.setAttribute("data-lsts-preserve", "true");
      if (el.parentElement && el.parentElement !== document.body) {
        const parentRect = el.parentElement.getBoundingClientRect();
        if (parentRect.width > 0 && parentRect.width < 280 && parentRect.height < 280) {
          el.parentElement.setAttribute("data-lsts-role", "mascot-wrapper");
        }
      }
      return;
    }

    const style = window.getComputedStyle(el);
    const bgRGBA = parseAnyColor(style.backgroundColor);
    const textRGBA = parseAnyColor(style.color);
    const bgImage = style.backgroundImage || "none";
    const rect = el.getBoundingClientRect();
    const textContent = (el.textContent || "").trim();

    // 2. Kill blurred background glow blobs (causes light patches or mascot ghost halos)
    if (
      (style.filter && style.filter.includes("blur")) ||
      (typeof el.className === "string" && /\bblur-(xl|2xl|3xl)\b/.test(el.className))
    ) {
      el.setAttribute("data-lsts-role", "decorative-glow");
      return;
    }

    // 3. Top Navbar ("Khu vực Học Sinh")
    if (
      tag === "HEADER" ||
      tag === "NAV" ||
      (rect.top <= 5 && rect.height >= 45 && rect.height <= 110 && rect.width >= window.innerWidth * 0.8)
    ) {
      el.setAttribute("data-lsts-role", "navbar");
    }

    // 4. Logout Button ("Thoát")
    if (
      (tag === "BUTTON" || tag === "A") &&
      (textContent === "Thoát" || textContent === "Logout" || textContent === "Sign out")
    ) {
      el.setAttribute("data-lsts-role", "logout-btn");
      return;
    }

    // 5. Language Switcher Pill ("VI / EN")
    if ((textContent === "VIEN" || textContent === "VI EN") && rect.width < 160 && rect.height < 65) {
      el.setAttribute("data-lsts-role", "lang-toggle");
    }

    // 6. Full-screen React Layout Wrappers vs Cards
    const hasLightBg = isLightSurface(bgRGBA);
    const hasGradient = bgImage !== "none" && bgImage.includes("gradient") && !bgImage.includes("url(");
    const borderRadius = parseFloat(style.borderRadius) || 0;

    if (!el.hasAttribute("data-lsts-role")) {
      // Full-Viewport Page Wrapper (strip its white/cream background so dark mode shows through)
      if (rect.width >= window.innerWidth * 0.92 && rect.height >= window.innerHeight * 0.6) {
        if (hasLightBg || hasGradient) {
          el.setAttribute("data-lsts-role", "page-bg");
        }
      }
      // Hero Greeting Banner ("Good morning/afternoon/evening...")
      else if (
        (hasLightBg || hasGradient) &&
        borderRadius >= 10 &&
        rect.width > window.innerWidth * 0.4 &&
        rect.height >= 110 &&
        rect.height <= 400 &&
        /Good (morning|afternoon|evening)|Xin chào|Chào|Truy cập các nền tảng/i.test(textContent)
      ) {
        el.setAttribute("data-lsts-role", "hero-card");
      }
      // Decorative overlay inside Hero Card (right behind the green mascot)
      else if (
        el.closest('[data-lsts-role="hero-card"]') &&
        (hasLightBg || hasGradient || style.position === "absolute") &&
        el.children.length === 0 &&
        textContent === ""
      ) {
        el.setAttribute("data-lsts-role", "decorative-glow");
      }
      // App Utility Cards (Outlook Mail, Canvas LMS, Hệ thống CRM, Microsoft Teams, Canva)
      else if (
        (hasLightBg || hasGradient) &&
        borderRadius >= 8 &&
        rect.width >= 160 &&
        rect.width <= 550 &&
        rect.height >= 90 &&
        rect.height <= 360
      ) {
        el.setAttribute("data-lsts-role", "app-card");
      }
      // Generic white surface
      else if (hasLightBg && rect.width > 40 && rect.height > 30) {
        el.setAttribute("data-lsts-role", "surface");
      }
    }

    // 7. Convert Dark Gray/Black Text -> Crisp Light Text (preserving blue/red accent text)
    if (textRGBA && textRGBA[3] > 0.2) {
      const [r, g, b] = textRGBA;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const isNeutralText = max - min < 45;

      if (isNeutralText) {
        const brightness = getBrightness(textRGBA);
        if (brightness < 75) {
          el.setAttribute("data-lsts-text", "heading");
        } else if (brightness >= 75 && brightness < 175) {
          el.setAttribute("data-lsts-text", "muted");
        }
      }
    }
  }

  function scanPage() {
    if (!document.body) return;
    const allElements = document.body.querySelectorAll("*");
    for (let i = 0; i < allElements.length; i++) {
      processElement(allElements[i]);
    }
  }

  function init() {
    scanPage();

    // Re-scan during React hydration bursts
    [100, 300, 700, 1500].forEach((delay) => setTimeout(scanPage, delay));

    const observer = new MutationObserver(() => {
      scanPage();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("load", scanPage);

  // Toggle Dark Mode with Alt + D
  window.addEventListener("keydown", (e) => {
    if (e.altKey && e.key.toLowerCase() === "d") {
      ROOT.classList.toggle("lsts-dark-enabled");
    }
  });
})();
