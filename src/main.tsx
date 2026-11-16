import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import {
  AppWindow,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Eye,
  Fence,
  Grid3x3,
  FolderOpen,
  Home as HomeIcon,
  Instagram,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Moon,
  Move,
  Pencil,
  Phone,
  Play,
  Settings,
  Shield,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Upload,
  Warehouse,
  Wrench,
  X,
} from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./style.css";
gsap.registerPlugin(ScrollTrigger);

const BRAND = "Classic Steel";
const PHONES = ["8449243465"];
const WA = "https://wa.me/918449243465";
const WA_QUOTE_TEXT = "Hello Classic Steel, I would like a quote.";
const WA_QUOTE = WA + "?text=" + encodeURIComponent(WA_QUOTE_TEXT);
const MAPS = "https://maps.app.goo.gl/AAHkDogEJLhGy6aZ8";
const MAP_EMBED = "https://www.google.com/maps?q=Panzorconi%2C%20Cuncolim%2C%20Goa%20403703&output=embed";
const LOCATION = "Panzorconi, Cuncolim, Goa – 403703";
const FALLBACK = ["/og.webp"];
function formatPhone(p: string) {
  return p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p;
}
function instagramUrl(data: any) {
  const u = String(data?.instagramUsername || "").replace(/[^a-zA-Z0-9._]/g, "");
  return u ? `https://www.instagram.com/${u}/` : "";
}
function useDocumentMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    let m = document.querySelector('meta[name="description"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", "description");
      document.head.appendChild(m);
    }
    m.setAttribute("content", description);
  }, [title, description]);
}
const CATS = ["SS Railing", "MS Gate & Grill", "Safety Door", "Roof Shed", "Aluminium Windows", "Glass Work", "Fabrication"];

async function api(path: string, opt: any = {}) {
  const r = await fetch(path, { ...opt, headers: { "Content-Type": "application/json", ...(opt.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err: any = new Error(d.error || "Request failed");
    err.status = r.status;
    err.data = d;
    throw err;
  }
  return d;
}
function trackClick(action: string) {
  try {
    fetch("/api/track-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}
function notify(message: string, type: "error" | "success" = "error") {
  window.dispatchEvent(new CustomEvent("ip-notice", { detail: { message, type } }));
}
function NoticeHost() {
  const [n, setN] = useState<any>(null);
  useEffect(() => {
    const h = (e: any) => {
      setN(e.detail);
      window.setTimeout(() => setN(null), 5200);
    };
    window.addEventListener("ip-notice", h);
    return () => window.removeEventListener("ip-notice", h);
  }, []);
  if (!n) return null;
  return (
    <div className={`adminNotice ${n.type === "success" ? "success" : "error"}`} role="status">
      <div>
        <b>{n.type === "success" ? "Done" : "Something went wrong"}</b>
        <span>{n.message}</span>
      </div>
      <button onClick={() => setN(null)} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div
      className="confirmBackdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="confirmModal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <button className="confirmClose" type="button" onClick={onCancel} aria-label="Close">
          ×
        </button>
        <div className="confirmEyebrow">CONFIRM ACTION</div>
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        <div className="confirmActions">
          <button className="btn outline" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn dangerButton" type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function phoneLink(p: string) {
  return `tel:+91${p}`;
}
function formatDateDMY(value: string) {
  if (!value) return "";
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
function normalizeDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
function dmyToIso(value: string) {
  const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return value.trim() ? null : "";
  const day = Number(m[1]),
    month = Number(m[2]),
    year = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function normalizeTagText(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
function normalizeHashtagText(s: string) {
  return String(s || "")
    .trim()
    .replace(/^#+/, "")
    .toLowerCase();
}
function extractCaptionHashtags(caption: string): string[] {
  return Array.from(new Set((String(caption || "").match(/#[\p{L}0-9_-]+/gu) || []).map((t) => normalizeHashtagText(t))));
}
function WhatsAppLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="currentColor" />
      <path fill="#25D366" d="M8.2 24.7 9.5 20.9a8.9 8.9 0 1 1 3.2 2.6l-4.5 1.2Z" />
      <path
        fill="#fff"
        d="M12.1 10.6c.3-.3.6-.3.9-.1l1.7 1.1c.3.2.4.5.2.8l-.7 1.1c-.1.2-.1.4 0 .6.7 1.1 1.7 2 2.8 2.7.2.1.4.1.6 0l1-.7c.3-.2.6-.1.8.2l1.1 1.7c.2.3.2.7-.1.9-.5.5-1.2.8-1.9.8-1.4-.1-3.1-1-4.8-2.6-1.7-1.6-2.8-3.3-3-4.7-.1-.7.3-1.4.8-1.8Z"
      />
    </svg>
  );
}
function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem("ip-theme") === "dark");
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("ip-theme", dark ? "dark" : "light");
  }, [dark]);
  return (
    <button
      className="themeToggle"
      type="button"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      onClick={() => setDark((x) => !x)}
    >
      <Sun size={17} />
      <span className={`themeSwitch ${dark ? "on" : "off"}`}>
        <i />
      </span>
      <Moon size={17} />
    </button>
  );
}
function Nav({ page = "home" }: { page?: string }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (open) {
        setHidden(false);
        lastY = y;
        return;
      }
      if (y < 80) setHidden(false);
      else if (y > lastY + 4) setHidden(true);
      else if (y < lastY - 4) setHidden(false);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);
  const links: [string, string, string][] = [
    ["Home", "/", "home"],
    ["About", "/#about", "about"],
    ["Services", "/#services", "services"],
    ["Projects", "/projects", "projects"],
    ["Contact", "/contact", "contact"],
  ];
  return (
    <header className={`siteHeader${hidden ? " headerHidden" : ""}`}>
      <div className="referenceWrap nav">
        <a className="brandLogo brandWordmark" href="/" onClick={() => setOpen(false)} aria-label="Classic Steel home">
          <img src="/logo.svg" alt="Classic Steel — SS Railing & MS Fabrication" />
        </a>
        <nav className="desktopNav">
          {links.map(([label, href, key]) => (
            <a key={label} className={page === key ? "navActive" : ""} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="navActions">
          <ThemeToggle />
          <a className="referenceButton desktopQuote" href="/contact" onClick={() => trackClick("quote_nav")}>
            GET A QUOTE
          </a>
          <button className="mobileMenuBtn" onClick={() => setOpen((x) => !x)} aria-expanded={open} aria-label="Menu">
            <Menu size={22} />
          </button>
        </div>
      </div>
      {open && (
        <div className="mobileMenu">
          {links.map(([label, href]) => (
            <a key={label} href={href} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
          <a href={WA_QUOTE} target="_blank" rel="noreferrer" onClick={() => trackClick("whatsapp_nav")}>
            WHATSAPP US <ArrowRight size={14} />
          </a>
        </div>
      )}
    </header>
  );
}
function usePublicData() {
  const [data, setData] = useState<any>({
    services: [],
    videos: [],
    photos: [],
    phone: "8087467783",
    maps: MAPS,
    homepage: {},
    loaded: false,
  });
  useEffect(() => {
    const early = (window as any).__earlyPublic;
    (window as any).__earlyPublic = null;
    (early || Promise.reject(new Error("no early fetch")))
      .catch(() => api("/api/public"))
      .then((d: any) => setData({ ...d, loaded: true }))
      .catch(() => setData((d: any) => ({ ...d, loaded: true })));
    const t = setTimeout(() => {
      api("/api/analytics", { method: "POST" }).catch(() => {});
    }, 4000);
    return () => clearTimeout(t);
  }, []);
  return data;
}
function DemoPhotos() {
  return FALLBACK.map((image, i) => ({
    id: "demo" + i,
    image_url: image,
    category: CATS[i % CATS.length],
    caption: "Classic Steel project",
  }));
}
function groupPhotos(photos: any[]) {
  const map = new Map<string, any[]>();
  const order: string[] = [];
  for (const p of photos) {
    const key = p.group_id ? `g:${p.group_id}` : `s:${p.id}`;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(p);
  }
  return order.map((key) =>
    map
      .get(key)!
      .slice()
      .sort((a, b) => Number(a.group_order || 0) - Number(b.group_order || 0)),
  );
}
function SmartCrop({
  photo,
  alt,
  className,
  eager,
  style,
  hero,
}: {
  photo: any;
  alt?: string;
  className?: string;
  eager?: boolean;
  style?: React.CSSProperties;
  hero?: boolean;
}) {
  const dfx = Number(hero ? (photo?.focal_x_hero ?? photo?.focal_x ?? 50) : (photo?.focal_x ?? 50));
  const dfy = Number(hero ? (photo?.focal_y_hero ?? photo?.focal_y ?? 50) : (photo?.focal_y ?? 50));
  const dzoom = Number(hero ? (photo?.focal_zoom_hero ?? photo?.focal_zoom ?? 1) : (photo?.focal_zoom ?? 1));
  const mfx = Number(hero ? (photo?.focal_x_hero_mobile ?? dfx) : (photo?.focal_x_mobile ?? dfx));
  const mfy = Number(hero ? (photo?.focal_y_hero_mobile ?? dfy) : (photo?.focal_y_mobile ?? dfy));
  const mzoom = Number(hero ? (photo?.focal_zoom_hero_mobile ?? dzoom) : (photo?.focal_zoom_mobile ?? dzoom));
  return (
    <img
      src={photo?.image_url || photo?.image}
      alt={alt || ""}
      loading={eager ? "eager" : "lazy"}
      className={`smartCrop${className ? " " + className : ""}`}
      style={{
        ...style,
        ["--fx-d" as any]: `${dfx}%`,
        ["--fy-d" as any]: `${dfy}%`,
        ["--zoom-d" as any]: dzoom,
        ["--fx-m" as any]: `${mfx}%`,
        ["--fy-m" as any]: `${mfy}%`,
        ["--zoom-m" as any]: mzoom,
        objectFit: "cover",
      }}
    />
  );
}
function GalleryTile({
  images,
  isOpen,
  onOpen,
  onClose,
  onZoom,
}: {
  images: any[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onZoom?: (p: any) => void;
}) {
  const [idx, setIdx] = useState(0);
  const multi = images.length > 1;
  const touchX = useRef<number | null>(null);
  const swiped = useRef(false);
  useEffect(() => {
    if (!multi || isOpen) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % images.length), 5000);
    return () => clearInterval(t);
  }, [multi, isOpen, images.length]);
  const go = (dir: number) => setIdx((i) => (i + dir + images.length) % images.length);
  return (
    <div
      role="button"
      tabIndex={0}
      className={`edgeGalleryItem galleryTile${isOpen ? " expanded" : ""}`}
      onClick={() => {
        if (swiped.current) {
          swiped.current = false;
          return;
        }
        if (!multi) return onZoom?.(images[0]);
        isOpen ? onClose() : onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (!multi) return onZoom?.(images[0]);
        isOpen ? onClose() : onOpen();
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null || !multi) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) < 40) return;
        swiped.current = true;
        e.preventDefault();
        go(dx < 0 ? 1 : -1);
        onOpen();
      }}
    >
      {images.map((p: any, i: number) => (
        <SmartCrop
          key={p.id || i}
          photo={p}
          alt={p.caption || "Classic Steel project"}
          className={`galleryTileImg${i === idx ? " active" : ""}`}
        />
      ))}
      {multi && isOpen && (
        <span className="galleryTileCount">
          {idx + 1}/{images.length}
        </span>
      )}
      {multi && isOpen && (
        <>
          <button
            type="button"
            className="galleryTileNav prev"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label="Previous image"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="galleryTileNav next"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label="Next image"
          >
            <ChevronRight size={18} />
          </button>
          <span className="galleryTileDots">
            {images.map((_: any, i: number) => (
              <span key={i} className={i === idx ? "active" : ""} />
            ))}
          </span>
        </>
      )}
    </div>
  );
}
function Lightbox({ photo, onClose }: { photo: any; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="photoLightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button type="button" className="photoLightboxClose" onClick={onClose} aria-label="Close">
        <X size={24} />
      </button>
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={photo.image_url || photo.image} alt={photo.caption || "Classic Steel project"} />
        {(photo.caption || photo.category) && (
          <figcaption>
            <b>{photo.caption}</b>
            {photo.category && <span>{photo.category}</span>}
          </figcaption>
        )}
      </figure>
    </div>
  );
}
function ImageGrid({ photos, limit = 15 }: { photos: any[]; limit?: number }) {
  const groups = groupPhotos(photos).slice(0, limit);
  const [openKey, setOpenKey] = useState<string | number | null>(null);
  const [zoom, setZoom] = useState<any>(null);
  if (!groups.length) return <div className="galleryNoPhotos">No projects in this category yet.</div>;
  return (
    <>
      <div className="edgeGallery">
        {groups.map((g, i) => {
          const key = g[0]?.group_id || g[0]?.id || i;
          return (
            <GalleryTile
              images={g}
              key={key}
              isOpen={openKey === key}
              onOpen={() => setOpenKey(key)}
              onClose={() => setOpenKey(null)}
              onZoom={setZoom}
            />
          );
        })}
      </div>
      {zoom && <Lightbox photo={zoom} onClose={() => setZoom(null)} />}
    </>
  );
}
function HeroCopy() {
  return (
    <div className="heroCenter">
      <small>SS RAILING &amp; MS FABRICATION</small>
      <h1>
        Your vision, <i>our work.</i>
      </h1>
      <p className="heroLead">
        SS railings, MS gates &amp; grills, safety doors, roof sheds, aluminium windows and glass work — strong structure, beautiful design.
      </p>
      <div className="heroActions">
        <a className="referenceButton" href="/contact" onClick={() => trackClick("quote_hero")}>
          REQUEST A QUOTE <ArrowRight size={13} />
        </a>
        <a className="referenceButton ghost" href={WA_QUOTE} target="_blank" rel="noreferrer" onClick={() => trackClick("whatsapp_hero")}>
          WHATSAPP US
        </a>
      </div>
      <p className="heroNote">✓ Quality work &nbsp; ✓ Customer satisfaction &nbsp; ✓ On-time delivery</p>
    </div>
  );
}
function Hero({ data }: { data: any }) {
  const cfg = data.homepage?.hero || { count: 4, source: "latest_instagram", interval: 7, transition: "normal", scrollReveal: false };
  const photos = (data.homepage?.heroPhotos?.length ? data.homepage.heroPhotos : data.photos || []).slice(
    0,
    Math.max(3, Math.min(5, Number(cfg.count) || 4)),
  );
  const fallback = data.loaded ? FALLBACK.slice(0, Number(cfg.count) || 4).map((src: string) => ({ image_url: src })) : [];
  const imgs = photos.length ? photos : fallback;
  const scrollMode = !!cfg.scrollReveal && imgs.length > 1;
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (scrollMode || imgs.length < 2) return;
    const ms = (Number(cfg.interval) || 7) * 1000;
    const t = setInterval(() => setI((x) => (x + 1) % imgs.length), ms);
    return () => clearInterval(t);
  }, [imgs.map((p: any) => p.image_url).join("|"), cfg.interval, scrollMode]);
  const duration = cfg.transition === "slow" ? "1.2s" : cfg.transition === "fast" ? "0.55s" : "0.85s";
  const pinRef = useRef<HTMLElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    if (!scrollMode || !pinRef.current) return;
    const layers = layerRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!layers.length) return;
    const segmentSize = 1 / layers.length;
    const st = ScrollTrigger.create({
      trigger: pinRef.current,
      start: "top top",
      end: () => `+=${window.innerHeight * layers.length}`,
      pin: true,
      pinSpacing: true,
      scrub: 1,
      onUpdate(self) {
        const progress = self.progress;
        layers.forEach((el, idx) => {
          const segStart = idx * segmentSize,
            segEnd = (idx + 1) * segmentSize;
          let p = 0;
          if (progress >= segStart && progress <= segEnd) p = (progress - segStart) / segmentSize;
          else if (progress > segEnd) p = 1;
          const left = 50 - p * 50,
            right = 50 + p * 50,
            deg = 90 + p * 40;
          const mask = `linear-gradient(${deg}deg, #000 ${left}%, transparent ${left}%, transparent ${right}%, #000 ${right}%)`;
          el.style.maskImage = mask;
          (el.style as any).webkitMaskImage = mask;
        });
      },
    });
    return () => {
      st.kill();
    };
  }, [scrollMode, imgs.map((p: any) => p.image_url).join("|")]);
  if (scrollMode) {
    const base = imgs[imgs.length - 1];
    const maskedLayers = imgs.slice(0, imgs.length - 1);
    return (
      <section className="referenceHero heroScrollPin" ref={pinRef as any}>
        <div className="heroScrollLayers">
          <div className="heroScrollLayer" style={{ zIndex: 0 }}>
            <SmartCrop photo={base} alt="Classic Steel work" eager hero className="heroScrollImg" />
          </div>
          {maskedLayers.map((p: any, idx: number) => (
            <div
              className="heroScrollLayer"
              key={p.image_url + idx}
              style={{ zIndex: maskedLayers.length - idx }}
              ref={(el) => {
                layerRefs.current[idx] = el;
              }}
            >
              <SmartCrop photo={p} alt="Classic Steel work" eager={idx === 0} hero className="heroScrollImg" />
            </div>
          ))}
        </div>
        <div className="heroOverlay" />
        <HeroCopy />
      </section>
    );
  }
  return (
    <section className="referenceHero heroSlideshow">
      <div
        className="heroSlides"
        onTouchStart={(e) => {
          (e.currentTarget as any)._touchX = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const startX = (e.currentTarget as any)._touchX;
          if (startX == null) return;
          const dx = (e.changedTouches[0]?.clientX ?? startX) - startX;
          if (Math.abs(dx) < 40) return;
          setI((x) => (x + (dx < 0 ? 1 : -1) + imgs.length) % imgs.length);
        }}
      >
        {imgs.map((p: any, n: number) => (
          <SmartCrop
            key={p.image_url + n}
            photo={p}
            alt="Classic Steel work"
            eager={n === 0}
            hero
            className={`heroSlide ${n === i ? "active" : ""}`}
            style={{ transitionDuration: duration }}
          />
        ))}
      </div>
      <div className="heroOverlay" />
      <HeroCopy />
    </section>
  );
}
function FestivalBannerVisual({ f }: { f: any }) {
  const mobileUrl = f.photo.image_url_mobile || f.photo.image_url;
  return (
    <section className="festivalBanner" data-festival={f.key} style={{ ["--festival-accent" as any]: f.accent }}>
      <div
        className="festivalBannerArt"
        style={{ ["--festival-bg" as any]: `url("${f.photo.image_url}")`, ["--festival-bg-mobile" as any]: `url("${mobileUrl}")` }}
      >
        <picture>
          <source media="(max-width:700px)" srcSet={mobileUrl} />
          <img
            src={f.photo.image_url}
            alt={`${f.title} — Classic Steel`}
            style={{ objectPosition: `${f.photo.focal_x ?? 50}% ${f.photo.focal_y ?? 50}%` }}
          />
        </picture>
      </div>
      <div className="festivalBannerMsg">
        <div className="festivalBannerBrand">CLASSIC STEEL</div>
        <p className="festivalBannerKicker">{f.kicker}</p>
        <h2>{f.title}</h2>
        <div className="festivalBannerOrnament">
          <i></i>
          <b>✦</b>
          <i></i>
        </div>
        <p className="festivalBannerCopy">{f.copy}</p>
        <p className="festivalBannerSignoff">With warm wishes, Classic Steel</p>
      </div>
    </section>
  );
}
function FestivalBanner({ data }: { data: any }) {
  const f = data?.festival;
  if (!f || !f.photo) return null;
  return <FestivalBannerVisual f={f} />;
}
function RevealImage({
  photo,
  mode,
  duration,
}: {
  photo: any;
  mode: "slice" | "scribble" | "curtain" | "sweep" | "circle";
  duration: string;
}) {
  if (mode === "scribble")
    return (
      <div className="introReveal introReveal-scribble" style={{ "--reveal-duration": duration } as any}>
        <svg className="introRevealScribbleSvg" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <mask id="introScribbleMask" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="600">
              <rect x="0" y="0" width="400" height="600" fill="#000" />
              <polyline
                className="introScribbleStroke"
                fill="none"
                stroke="#fff"
                strokeWidth="140"
                strokeLinecap="round"
                strokeLinejoin="round"
                points="-110,-60 510,50 -110,160 510,270 -110,380 510,490 -110,600 510,660"
              />
            </mask>
          </defs>
          <image
            href={photo?.image_url}
            x="0"
            y="0"
            width="400"
            height="600"
            preserveAspectRatio="xMidYMid slice"
            mask="url(#introScribbleMask)"
          />
        </svg>
      </div>
    );
  if (mode === "curtain")
    return (
      <div className="introReveal introReveal-curtain" style={{ "--reveal-duration": duration } as any}>
        <SmartCrop photo={photo} alt="Classic Steel work" className="introRevealImg introRevealCurtainImg" />
        <div className="introRevealCurtainPanel" />
      </div>
    );
  if (mode === "sweep")
    return (
      <div className="introReveal introReveal-sweep" style={{ "--reveal-duration": duration } as any}>
        <SmartCrop photo={photo} alt="Classic Steel work" className="introRevealImg introRevealSweepImg" />
        <div className="introRevealSweepBar" />
      </div>
    );
  if (mode === "circle")
    return (
      <div className="introReveal introReveal-circle" style={{ "--reveal-duration": duration } as any}>
        <svg className="introRevealScribbleSvg" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <filter id="introCircleDisplace" x="-50%" y="-50%" width="200%" height="200%">
              <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="34" />
            </filter>
            <mask id="introCircleMask" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="600">
              <rect x="0" y="0" width="400" height="600" fill="#000" />
              <circle className="introCircleGrow" cx="200" cy="300" r="420" fill="#fff" style={{ filter: "url(#introCircleDisplace)" }} />
            </mask>
          </defs>
          <image
            href={photo?.image_url}
            x="0"
            y="0"
            width="400"
            height="600"
            preserveAspectRatio="xMidYMid slice"
            mask="url(#introCircleMask)"
          />
        </svg>
      </div>
    );
  return (
    <div className="introReveal introReveal-slice" style={{ "--reveal-duration": duration } as any}>
      <SmartCrop photo={photo} alt="Classic Steel work" className="introRevealImg" />
      <div className="introRevealSlices">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function About({ data }: { data: any }) {
  const stripCfg = data.homepage?.strip || { interval: 7, transition: "normal", reveal: "none" };
  const revealMode = ["slice", "scribble", "curtain", "sweep", "circle"].includes(stripCfg.reveal) ? stripCfg.reveal : null;
  const source = data.homepage?.stripPhotos?.length
    ? data.homepage.stripPhotos
    : data.homepage?.aboutPhoto
      ? [data.homepage.aboutPhoto]
      : null;
  const items = source && source.length ? source.slice(0, 8) : data.loaded ? [{ image_url: "/og.webp" }] : [];
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
  }, [items.map((p: any) => p.id || p.image_url).join("|")]);
  useEffect(() => {
    if (items.length < 2) return;
    const ms = Math.max(1000, Number(stripCfg.interval || 7) * 1000);
    const t = setInterval(() => setI((x) => (x + 1) % items.length), ms);
    return () => clearInterval(t);
  }, [items.length, stripCfg.interval]);
  const duration = stripCfg.transition === "slow" ? "1.2s" : stripCfg.transition === "fast" ? "0.55s" : "0.85s";
  const aboutText = String(
    data.homepage?.about?.text ||
      "Classic Steel builds SS railings, MS gates and grills, safety doors, roof sheds, aluminium windows and glass work for homes and businesses across Goa.",
  )
    .split(/\n{2,}/)
    .map((s: string) => s.trim())
    .filter(Boolean);
  return (
    <section className="referenceIntro" id="about">
      <div className="referenceWrap introGrid">
        <div className="introImage">
          {revealMode ? (
            <RevealImage key={i} photo={items[i]} mode={revealMode} duration={duration} />
          ) : (
            items.map((p: any, n: number) => (
              <SmartCrop
                key={(p.id || p.image_url) + n}
                photo={p}
                alt={p.caption || "Classic Steel work"}
                className={`introImageSlide${n === i ? " active" : ""}`}
                style={{ transitionDuration: duration }}
              />
            ))
          )}
        </div>
        <div className="introCopy">
          <small>WHY CLASSIC STEEL</small>
          <h2>
            Strong structure,
            <br />
            <i>beautiful design.</i>
          </h2>
          {aboutText.map((p: string, idx: number) => (
            <p key={idx}>{p}</p>
          ))}
          <ul className="featureList">
            <li>
              <Check size={16} /> <b>Custom work</b> — made as per your needs and your space.
            </li>
            <li>
              <Check size={16} /> <b>Strong &amp; durable</b> — quality steel and solid fabrication.
            </li>
            <li>
              <Check size={16} /> <b>Clean, premium finish</b> — elegant looks that last.
            </li>
            <li>
              <Check size={16} /> <b>On-time delivery</b> — call or WhatsApp for a quote.
            </li>
          </ul>
          <a className="referenceButton dark" href="/contact">
            GET A QUOTE <ArrowRight size={13} />
          </a>
        </div>
      </div>
    </section>
  );
}
function OurGallery({ data }: { data: any }) {
  const photos = data.homepage?.galleryPhotos?.length ? data.homepage.galleryPhotos : data.photos || [];
  return (
    <section className="referenceGallery" id="projects">
      <div className="fullGalleryWrap">
        <div className="referenceSectionHead centerOnly">
          <div>
            <small>OUR PROJECTS</small>
            <h2>Real work. Different spaces.</h2>
          </div>
        </div>
        <ImageGrid photos={photos} limit={photos.length} />
        <div className="centerAction">
          <a className="referenceButton dark" href="/projects">
            EXPLORE ALL PROJECTS <ArrowRight size={13} />
          </a>
        </div>
      </div>
    </section>
  );
}
const DEFAULT_RANGE = [
  {
    id: "r1",
    title: "SS Railing",
    description: "Modern, durable and elegant stainless-steel railings for stairs, balconies and terraces.",
    image_url: "",
  },
  {
    id: "r2",
    title: "MS Gate & Grill",
    description: "Strong, secure and stylish gates and window grills.",
    image_url: "",
  },
  { id: "r3", title: "Safety Door", description: "Protection and peace of mind for your home.", image_url: "" },
  {
    id: "r4",
    title: "Roof Shed",
    description: "Weather-proof, long-lasting sheds for parking, terraces and courtyards.",
    image_url: "",
  },
  {
    id: "r5",
    title: "Aluminium Windows",
    description: "Light, stylish and modern aluminium windows.",
    image_url: "",
  },
  {
    id: "r6",
    title: "Glass Work",
    description: "Clean look, premium finish — glass railings, partitions and more.",
    image_url: "",
  },
  {
    id: "r7",
    title: "Fabrication",
    description: "All types of fabrication — custom work as per your needs.",
    image_url: "",
  },
];
function ServiceIcon({ title }: { title: string }) {
  const t = String(title || "").toLowerCase();
  const I = t.includes("rail")
    ? Fence
    : t.includes("gate") || t.includes("grill")
      ? Grid3x3
      : t.includes("door")
        ? DoorOpen
        : t.includes("shed") || t.includes("roof")
          ? Warehouse
          : t.includes("window")
            ? AppWindow
            : t.includes("glass")
              ? Square
              : Wrench;
  return (
    <div className="serviceIconTile" aria-hidden="true">
      <I size={44} strokeWidth={1.6} />
    </div>
  );
}
function parseImages(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  try {
    const a = JSON.parse(String(v || "[]"));
    return Array.isArray(a) ? a.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}
const SERVICE_IMAGE_LIMIT = 10;
function serviceSlides(s: any, photos: any[]) {
  const own = parseImages(s.images);
  const list = own.length ? own : s.image_url ? [s.image_url] : [];
  if (s.include_projects !== 0 && s.include_projects !== false) {
    const title = String(s.title || "").toLowerCase();
    for (const p of photos) {
      if (list.length >= SERVICE_IMAGE_LIMIT) break;
      if (String(p.category || p.occasion || "").toLowerCase() === title && p.image_url && !list.includes(p.image_url))
        list.push(p.image_url);
    }
  }
  return list.slice(0, SERVICE_IMAGE_LIMIT);
}
function ServiceCard({ s, photos, offset }: { s: any; photos: any[]; offset: number }) {
  const slides = serviceSlides(s, photos);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const n = slides.length;
  useEffect(() => {
    if (n < 2 || paused) return;
    let t: any;
    // Stagger the cards so they don't all change at the same moment.
    const start = setTimeout(
      () => {
        setI((x) => (x + 1) % n);
        t = setInterval(() => setI((x) => (x + 1) % n), 4500);
      },
      4500 + offset * 700,
    );
    return () => {
      clearTimeout(start);
      clearInterval(t);
    };
  }, [n, paused, offset]);
  const go = (d: number) => setI((x) => (x + d + n) % n);
  return (
    <article onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div
        className="serviceMedia"
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
          setPaused(true);
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 40 && n > 1) go(dx < 0 ? 1 : -1);
        }}
      >
        {n ? (
          slides.map((src, k) => (
            <img
              key={src + k}
              src={src}
              alt={k === i ? s.title : ""}
              loading={k === 0 ? "lazy" : "lazy"}
              className={k === i ? "active" : ""}
            />
          ))
        ) : (
          <ServiceIcon title={s.title} />
        )}
        {n > 1 && (
          <>
            <button type="button" className="serviceArrow prev" onClick={() => go(-1)} aria-label={`Previous ${s.title} image`}>
              <ChevronLeft size={18} />
            </button>
            <button type="button" className="serviceArrow next" onClick={() => go(1)} aria-label={`Next ${s.title} image`}>
              <ChevronRight size={18} />
            </button>
            <span className="serviceDots" aria-hidden="true">
              {slides.map((_, k) => (
                <i key={k} className={k === i ? "active" : ""} />
              ))}
            </span>
          </>
        )}
      </div>
      <div>
        <h3>{s.title}</h3>
        <p>{s.description}</p>
        <a className="referenceButton dark serviceBtn" href={`/contact?service=${encodeURIComponent(s.title)}`}>
          GET A QUOTE <ArrowRight size={13} />
        </a>
      </div>
    </article>
  );
}
function Services({ services, photos = [] }: { services: any[]; photos?: any[] }) {
  const list = services.length ? services : DEFAULT_RANGE;
  return (
    <section className="servicesSection" id="services">
      <div className="referenceWrap">
        <div className="referenceSectionHead centerOnly">
          <div>
            <small>OUR SERVICES</small>
            <h2>SS railing &amp; MS fabrication</h2>
          </div>
        </div>
        <div className="servicesGrid">
          {list.map((s: any, idx: number) => (
            <ServiceCard key={s.id} s={s} photos={photos} offset={idx} />
          ))}
        </div>
      </div>
    </section>
  );
}
function carouselOffsets(n: number, maxVisible: number) {
  if (n <= 0) return [];
  const visibleCount = Math.min(maxVisible, n);
  const start = -Math.floor((visibleCount - 1) / 2);
  return Array.from({ length: visibleCount }, (_, k) => start + k);
}
function carouselStyle(off: number, maxScaleDrop = 0.13, maxOpacityDrop = 0.35) {
  const dist = Math.abs(off);
  const scale = off === 0 ? 1 : Math.max(0.6, 1 - dist * maxScaleDrop);
  const opacity = off === 0 ? 1 : Math.max(0.25, 1 - dist * maxOpacityDrop);
  return { "--offset": off, "--scale": scale, "--opacity": opacity, zIndex: 30 - dist } as React.CSSProperties;
}
function VideoPoster({ v }: { v: any }) {
  const [broken, setBroken] = useState(false);
  if (v.thumbnail_url && !broken)
    return <img src={v.thumbnail_url} alt={v.title || "Project video"} loading="lazy" onError={() => setBroken(true)} />;
  // No cover image: let the browser show the first frame of the video itself.
  return <video className="reelPosterVideo" src={v.media_url + "#t=0.1"} muted playsInline preload="metadata" />;
}
function VideoGallery({ data }: { data: any }) {
  const items = ((data.videos || []) as any[]).filter((v) => v.media_url);
  const ig = instagramUrl(data);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStart = useRef<number | null>(null);
  useEffect(() => {
    if (active > Math.max(0, items.length - 1)) setActive(Math.max(0, items.length - 1));
  }, [items.length, active]);
  // Still loading: keep the space quiet. Loaded with no videos: show the section with a friendly message.
  if (!data.loaded && !items.length) return null;
  if (!items.length)
    return (
      <section className="referenceSection instagramReels videoGallery" id="projects">
        <div className="referenceWrap">
          <div className="referenceSectionHead centerOnly">
            <div>
              <small>OUR PROJECTS</small>
              <h2>Real work. Different spaces.</h2>
            </div>
          </div>
          <div className="videoEmpty">
            <Play size={28} />
            <p>Project videos are coming soon. Meanwhile, browse our work or WhatsApp us for photos of similar jobs.</p>
          </div>
        </div>
        <div className="centerAction">
          <a className="referenceButton dark" href="/projects">
            EXPLORE ALL PROJECTS <ArrowRight size={13} />
          </a>
        </div>
      </section>
    );
  const n = items.length;
  const go = (next: number) => {
    videoRef.current?.pause();
    setPlaying(false);
    setProgress(0);
    setActive(((next % n) + n) % n);
  };
  const toggle = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      el.pause();
      setPlaying(false);
    }
  };
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
    touchStart.current = null;
    if (Math.abs(dx) < 45) return;
    go(active + (dx < 0 ? 1 : -1));
  };
  const visible = carouselOffsets(n, 5).map((off) => {
    const i = (((active + off) % n) + n) % n;
    return { v: items[i], i, off };
  });
  return (
    <section className="referenceSection instagramReels videoGallery" id="projects">
      <div className="referenceWrap">
        <div className="referenceSectionHead">
          <div>
            <small>OUR PROJECTS</small>
            <h2>Real work. Different spaces.</h2>
            <p>Swipe to change video. Tap the video to play or pause.</p>
          </div>
          {ig && (
            <a className="referenceVisit" href={ig} target="_blank" rel="noreferrer">
              <Instagram size={15} /> Follow on Instagram <ArrowRight size={14} />
            </a>
          )}
        </div>
      </div>
      <div className="reelCarousel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {visible.map(({ v, i, off }) => {
          const isActive = off === 0;
          return (
            <article
              className={`reelCard${isActive ? " reelCard-active" : " reelCard-other"}`}
              style={carouselStyle(off)}
              key={v.id || i}
              onClick={() => (isActive ? toggle() : go(i))}
              aria-current={isActive}
            >
              <div className="reelThumb">
                {isActive ? (
                  <video
                    key={v.id}
                    ref={videoRef}
                    className="reelPosterVideo"
                    src={v.media_url}
                    poster={v.thumbnail_url || undefined}
                    playsInline
                    preload="metadata"
                    aria-label={v.title || "Project video"}
                    onTimeUpdate={(e) => {
                      const el = e.currentTarget;
                      setProgress(el.duration ? (el.currentTime / el.duration) * 100 : 0);
                    }}
                    onPause={() => setPlaying(false)}
                    onPlay={() => setPlaying(true)}
                    onEnded={() => {
                      setPlaying(false);
                      setProgress(0);
                    }}
                  />
                ) : (
                  <VideoPoster v={v} />
                )}
                {!(isActive && playing) && (
                  <span className="reelPlayBadge">
                    <Play size={18} fill="currentColor" />
                  </span>
                )}
                {isActive && (
                  <span className="videoProgress" aria-hidden="true">
                    <i style={{ width: `${progress}%` }} />
                  </span>
                )}
              </div>
              <div className="reelCaption">{v.title || "Project video"}</div>
            </article>
          );
        })}
      </div>
      <div className="reelControls">
        <span>
          Video {active + 1} of {n}
        </span>
        <span className="reelSwipeHint">
          ↔ <b>Swipe to change video</b> ↔
        </span>
        <div className="reelNav">
          <button type="button" onClick={() => go(active - 1)} aria-label="Previous video">
            <ChevronLeft size={22} />
          </button>
          <button type="button" onClick={() => go(active + 1)} aria-label="Next video">
            <ChevronRight size={22} />
          </button>
        </div>
      </div>
      <div className="centerAction">
        <a className="referenceButton dark" href="/projects">
          EXPLORE ALL PROJECTS <ArrowRight size={13} />
        </a>
      </div>
    </section>
  );
}
const AVATAR_COLORS = ["#c0392b", "#8e44ad", "#2980b9", "#16a085", "#d35400", "#2c3e50", "#b8860b", "#27ae60"];
function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
function TestimonialText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 160;
  return (
    <>
      <p className={open ? "expanded" : ""}>{text}</p>
      {long && (
        <button type="button" className="testimonialReadMore" onClick={() => setOpen((x) => !x)}>
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </>
  );
}
function Testimonials({ data }: { data: any }) {
  const items = (data.testimonials || []) as any[];
  const agg = data.reviewsAggregate;
  if (!items.length) return null;
  const track = items.concat(items);
  const ratingRounded = Math.round(Number(agg?.rating || 0));
  return (
    <section className="referenceSection testimonialsSection">
      <div className="referenceWrap">
        <div className="testimonialsHead">
          <small>TESTIMONIALS</small>
          <h2>What Our Customers Say</h2>
          {agg && Number(agg.count) > 0 && (
            <div className="reviewsBadge">
              <div className="reviewsStars">
                {"★".repeat(ratingRounded)}
                {"☆".repeat(5 - ratingRounded)}
              </div>
              <span className="reviewsBadgeSource">
                <Check size={14} />
                {agg.count} customer review{Number(agg.count) === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="testimonialStrip">
        <div className="testimonialTrack" style={{ animationDuration: `${items.length * 4}s` }}>
          {track.map((r: any, i: number) => (
            <article className="testimonialCard" key={(r?.id || "") + i}>
              <div className="testimonialCardHead">
                <div className="avatar" style={{ background: AVATAR_COLORS[hashStr(r?.author_name || "G") % AVATAR_COLORS.length] }}>
                  {String(r?.author_name || "G")[0].toUpperCase()}
                </div>
                <div>
                  <b>{r?.author_name}</b>
                  {r?.relative_time && <span className="muted">{r.relative_time}</span>}
                </div>
              </div>
              <div className="stars">{"★".repeat(Number(r?.rating || 5))}</div>
              {r?.image_url ? (
                <img className="testimonialShot" src={r.image_url} alt={`Review from ${r?.author_name || "a customer"}`} />
              ) : (
                <TestimonialText text={r?.review_text || ""} />
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
function QuoteBand() {
  return (
    <section className="quoteBand">
      <div className="referenceWrap quoteBandInner">
        <div>
          <small>HAVE A PROJECT IN MIND?</small>
          <h2>
            Let's build something <i>great together.</i>
          </h2>
          <p>WhatsApp a photo of the site with the approximate size and the design you like — we'll guide you from there.</p>
        </div>
        <div className="quoteBandActions">
          <a className="referenceButton dark" href="/contact">
            GET A QUOTE <ArrowRight size={13} />
          </a>
          <a
            className="referenceButton outlineBtn"
            href={WA_QUOTE}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackClick("whatsapp_band")}
          >
            WHATSAPP US
          </a>
        </div>
      </div>
    </section>
  );
}
function WhatsAppWidget() {
  const [open, setOpen] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  // Close the chat box when tapping/clicking anywhere outside it, or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <>
      <button
        className={`scrollTopBtn${showTop ? " show" : ""}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
      >
        <ArrowUp size={20} />
      </button>
      <div className="waWidget" ref={widgetRef}>
        {open && (
          <div className="waPanel">
            <div className="waPanelHead">
              <span>
                <WhatsAppLogo size={30} /> WhatsApp
              </span>
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X />
              </button>
            </div>
            <div className="waPanelBody">
              <p>Hi! Send us a photo of your site on WhatsApp for a quick quote.</p>
              <a href={WA_QUOTE} target="_blank" rel="noreferrer" onClick={() => trackClick("whatsapp_widget_chat")}>
                Open chat <ArrowRight size={20} />
              </a>
            </div>
          </div>
        )}
        <button
          className="waBubble"
          onClick={() =>
            setOpen((x) => {
              if (!x) trackClick("whatsapp_bubble");
              return !x;
            })
          }
          aria-label={open ? "Close WhatsApp" : "Open WhatsApp"}
        >
          <WhatsAppLogo size={34} />
        </button>
      </div>
    </>
  );
}
function Footer({ data }: { data: any }) {
  const ig = instagramUrl(data);
  return (
    <footer className="csFooter" id="contact">
      <div className="referenceWrap csFooterGrid">
        <div className="csFooterBrand">
          <a href="/" className="csFooterLogo" aria-label="Classic Steel home">
            <img src="/logo.svg" alt="Classic Steel — SS Railing & MS Fabrication" />
          </a>
          <p>SS railings, MS gates &amp; grills, safety doors, roof sheds, aluminium windows and glass work across Goa.</p>
          <a className="csFooterCta" href="/contact" onClick={() => trackClick("quote_footer")}>
            Get a quote <ArrowRight size={15} />
          </a>
        </div>
        <nav className="csFooterCol" aria-label="Footer">
          <h3>Quick links</h3>
          <a href="/">Home</a>
          <a href="/#about">About</a>
          <a href="/#services">Services</a>
          <a href="/projects">Projects</a>
          <a href="/contact">Contact</a>
        </nav>
        <div className="csFooterCol">
          <h3>Talk to us</h3>
          {PHONES.map((p) => (
            <a key={p} className="csFooterAction" href={phoneLink(p)} onClick={() => trackClick("call_click")}>
              <span className="csFooterIcon">
                <Phone size={16} />
              </span>
              <span>
                <small>Call</small>
                {formatPhone(p)}
              </span>
            </a>
          ))}
          <a className="csFooterAction" href={WA_QUOTE} target="_blank" rel="noreferrer" onClick={() => trackClick("whatsapp_footer")}>
            <span className="csFooterIcon wa">
              <WhatsAppLogo size={18} />
            </span>
            <span>
              <small>WhatsApp</small>
              {formatPhone(PHONES[0])}
            </span>
          </a>
          {ig && (
            <a className="csFooterAction" href={ig} target="_blank" rel="noreferrer">
              <span className="csFooterIcon">
                <Instagram size={16} />
              </span>
              <span>
                <small>Instagram</small>@{String(data?.instagramUsername || "")}
              </span>
            </a>
          )}
        </div>
        <div className="csFooterCol">
          <h3>Visit us</h3>
          <p className="csFooterAddress">
            <MapPin size={16} />
            <span>{LOCATION}</span>
          </p>
          <a className="csFooterLink" href={MAPS} target="_blank" rel="noreferrer">
            Open in Google Maps <ArrowRight size={14} />
          </a>
        </div>
      </div>
      <div className="referenceWrap csFooterMap">
        <iframe title="Classic Steel location" src={MAP_EMBED} loading="lazy" />
      </div>
      <div className="referenceWrap csFooterBottom">
        <span>
          © {new Date().getFullYear()} {BRAND}. All rights reserved.
        </span>
        <span>Strong Structure • Beautiful Design</span>
      </div>
    </footer>
  );
}

function Home() {
  const data = usePublicData();
  useDocumentMeta(
    "Classic Steel | SS Railing & MS Fabrication in Cuncolim, Goa",
    "Classic Steel — SS railings, MS gates & grills, safety doors, roof sheds, aluminium windows, glass work and all types of fabrication in Cuncolim, Goa.",
  );
  return (
    <>
      <Nav />
      <main>
        {data?.festival ? <FestivalBanner data={data} /> : <Hero data={data} />}
        <About data={data} />
        <Services services={data.services || []} photos={data.photos || []} />
        <VideoGallery data={data} />
        <Testimonials data={data} />
        <QuoteBand />
      </main>
      <Footer data={data} />
      <WhatsAppWidget />
    </>
  );
}

function ProjectPhotoViewer({ photos }: { photos: any[] }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<any>(null);
  const touchX = useRef<number | null>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const n = photos.length;
  const key = photos.map((p) => p.id).join("|");
  useEffect(() => setActive(0), [key]);
  useEffect(() => {
    // Keep the active thumbnail in view.
    const el = thumbsRef.current?.querySelector<HTMLElement>("button.active");
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);
  useEffect(() => {
    if (zoom) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      if (e.key === "ArrowRight") setActive((x) => (x + 1) % Math.max(1, n));
      if (e.key === "ArrowLeft") setActive((x) => (x - 1 + Math.max(1, n)) % Math.max(1, n));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n, zoom]);
  if (!n) return null;
  const p = photos[Math.min(active, n - 1)];
  const go = (d: number) => setActive((x) => (((x + d) % n) + n) % n);
  return (
    <section className="projectVideo projectPhotos">
      <div
        className="projectVideoStage projectPhotoStage"
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 45 && n > 1) go(dx < 0 ? 1 : -1);
        }}
      >
        <img className="projectVideoBackdrop" src={p.image_url} alt="" aria-hidden="true" />
        <img
          key={p.id}
          className="projectPhotoMain"
          src={p.image_url}
          alt={p.caption || p.category || "Classic Steel project"}
          onClick={() => setZoom(p)}
        />
        {n > 1 && (
          <>
            <button type="button" className="projectVideoArrow prev" onClick={() => go(-1)} aria-label="Previous photo">
              <ChevronLeft size={24} />
            </button>
            <button type="button" className="projectVideoArrow next" onClick={() => go(1)} aria-label="Next photo">
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </div>
      <div className="projectVideoMeta">
        <b>{p.caption || p.category || "Project photo"}</b>
        <span>
          Photo {Math.min(active, n - 1) + 1} of {n}
          {n > 1 ? " · swipe or use the arrows · tap to enlarge" : " · tap to enlarge"}
        </span>
      </div>
      {n > 1 && (
        <div className="projectVideoThumbs projectPhotoThumbs" ref={thumbsRef}>
          {photos.map((x, k) => (
            <button
              type="button"
              key={x.id || k}
              className={k === active ? "active" : ""}
              onClick={() => setActive(k)}
              aria-label={`Show photo ${k + 1}`}
            >
              <img src={x.image_url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {zoom && <Lightbox photo={zoom} onClose={() => setZoom(null)} />}
    </section>
  );
}
function ProjectVideoPlayer({ videos }: { videos: any[] }) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const ref = useRef<HTMLVideoElement>(null);
  const touchX = useRef<number | null>(null);
  const n = videos.length;
  const key = videos.map((v) => v.id).join("|");
  useEffect(() => {
    setActive(0);
    setPlaying(false);
    setProgress(0);
  }, [key]);
  if (!n) return null;
  const v = videos[Math.min(active, n - 1)];
  const go = (d: number) => {
    ref.current?.pause();
    setPlaying(false);
    setProgress(0);
    setActive((x) => (((x + d) % n) + n) % n);
  };
  const pick = (k: number) => {
    ref.current?.pause();
    setPlaying(false);
    setProgress(0);
    setActive(k);
  };
  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => setPlaying(false));
    else el.pause();
  };
  return (
    <section className="projectVideo">
      <div
        className="projectVideoStage"
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 45 && n > 1) go(dx < 0 ? 1 : -1);
        }}
      >
        {v.thumbnail_url && <img className="projectVideoBackdrop" src={v.thumbnail_url} alt="" aria-hidden="true" />}
        <video
          key={v.id}
          ref={ref}
          src={v.media_url}
          poster={v.thumbnail_url || undefined}
          playsInline
          preload="metadata"
          aria-label={v.title || "Project video"}
          onClick={toggle}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setProgress(0);
          }}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            setProgress(el.duration ? (el.currentTime / el.duration) * 100 : 0);
          }}
        />
        {!playing && (
          <button type="button" className="projectVideoPlay" onClick={toggle} aria-label="Play video">
            <Play size={30} fill="currentColor" />
          </button>
        )}
        {n > 1 && (
          <>
            <button type="button" className="projectVideoArrow prev" onClick={() => go(-1)} aria-label="Previous video">
              <ChevronLeft size={24} />
            </button>
            <button type="button" className="projectVideoArrow next" onClick={() => go(1)} aria-label="Next video">
              <ChevronRight size={24} />
            </button>
          </>
        )}
        <span className="videoProgress" aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </span>
      </div>
      <div className="projectVideoMeta">
        <b>{v.title || "Project video"}</b>
        <span>
          Video {Math.min(active, n - 1) + 1} of {n}
          {n > 1 ? " · swipe or use the arrows" : ""}
        </span>
      </div>
      {n > 1 && (
        <div className="projectVideoThumbs">
          {videos.map((x, k) => (
            <button
              type="button"
              key={x.id}
              className={k === active ? "active" : ""}
              onClick={() => pick(k)}
              aria-label={`Play ${x.title || "video " + (k + 1)}`}
            >
              {x.thumbnail_url ? <img src={x.thumbnail_url} alt="" loading="lazy" /> : <Play size={16} />}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
function Gallery() {
  const data = usePublicData();
  useDocumentMeta(
    "Projects | Classic Steel, Goa",
    "Browse completed Classic Steel railing, gate, grill, door, shed, window and glass work in Goa.",
  );
  const photos = data.photos || [];
  const videos = ((data.videos || []) as any[]).filter((v) => v.media_url);
  const catOf = (x: any) => x.category || x.occasion || "Other";
  const serviceOrder = ((data.services || []) as any[]).map((s: any) => s.title);
  const order = (c: string) => {
    const i = serviceOrder.indexOf(c);
    if (i !== -1) return i;
    const j = CATS.indexOf(c);
    return j === -1 ? 99 : 50 + j;
  };
  const cats = ["All", ...Array.from(new Set<string>([...photos.map(catOf), ...videos.map(catOf)])).sort((a, b) => order(a) - order(b))];
  const [cat, setCat] = useState(() => {
    const q = new URLSearchParams(location.search).get("category");
    return q || "All";
  });
  const shownPhotos = cat === "All" ? photos : photos.filter((p: any) => catOf(p) === cat);
  const shownVideos = cat === "All" ? videos : videos.filter((v: any) => catOf(v) === cat);
  return (
    <>
      <Nav page="projects" />
      <section className="galleryPageHead">
        <small>PROJECTS</small>
        <h1>Real work. Different spaces.</h1>
        <p>Pick a category, then swipe through its videos and photos.</p>
      </section>
      <div className="galleryFilter">
        {(cats as string[]).map((c) => (
          <button className={c === cat ? "active" : ""} key={c} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      {shownVideos.length > 0 && <h2 className="projectBlockTitle">Videos</h2>}
      <ProjectVideoPlayer videos={shownVideos} />
      {shownPhotos.length > 0 && <h2 className="projectBlockTitle">Photos</h2>}
      <ProjectPhotoViewer photos={shownPhotos} />
      {!shownPhotos.length && !shownVideos.length && <div className="galleryNoPhotos">No projects in this category yet.</div>}
      <QuoteBand />
      <Footer data={data} />
      <WhatsAppWidget />
    </>
  );
}

const REQUIREMENTS = [
  "SS Railing",
  "MS Gate & Grill",
  "Safety Door",
  "Roof Shed",
  "Aluminium Windows",
  "Glass Work",
  "Other fabrication",
  "Not sure — need advice",
];
function requirementFromParam(v: string | null) {
  const s = String(v || "").toLowerCase();
  if (!s) return REQUIREMENTS[0];
  if (s.includes("rail")) return "SS Railing";
  if (s.includes("gate") || s.includes("grill")) return "MS Gate & Grill";
  if (s.includes("door")) return "Safety Door";
  if (s.includes("shed") || s.includes("roof")) return "Roof Shed";
  if (s.includes("window")) return "Aluminium Windows";
  if (s.includes("glass")) return "Glass Work";
  if (s.includes("fabric")) return "Other fabrication";
  return REQUIREMENTS[0];
}
function ContactPage() {
  const data = usePublicData();
  useDocumentMeta(
    "Contact | Classic Steel, Cuncolim Goa",
    "Call, WhatsApp or send an enquiry to Classic Steel in Cuncolim, Goa for SS railings, MS gates & grills, safety doors, roof sheds and fabrication.",
  );
  const [form, setForm] = useState(() => ({
    name: "",
    phone: "",
    service: requirementFromParam(new URLSearchParams(location.search).get("service")),
    details: "",
  }));
  const [sent, setSent] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = `Hello Classic Steel,\n\nName: ${form.name}\nPhone: ${form.phone}\nRequirement: ${form.service}\nDetails: ${form.details}`;
    trackClick("whatsapp_contact_form");
    window.open(`${WA}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    setSent(true);
  };
  return (
    <>
      <Nav page="contact" />
      <main className="contactPage upvcContact">
        <section className="contactHero">
          <small>CONTACT</small>
          <h1>Tell us what you need.</h1>
          <p>Call, WhatsApp or use the enquiry form below. The form prepares your details as a WhatsApp message.</p>
        </section>
        <section className="referenceWrap upvcContactGrid">
          <div className="upvcContactCard">
            <small>DIRECT CONTACT</small>
            <h2>Let's talk about your project.</h2>
            <div className="upvcContactItem">
              <span>Phone / WhatsApp</span>
              <a href={WA} target="_blank" rel="noreferrer" onClick={() => trackClick("whatsapp_contact_card")}>
                {formatPhone(PHONES[0])}
              </a>
            </div>
            {PHONES.slice(1).map((p) => (
              <div className="upvcContactItem" key={p}>
                <span>Phone</span>
                <a href={phoneLink(p)} onClick={() => trackClick("call_click")}>
                  {formatPhone(p)}
                </a>
              </div>
            ))}
            <div className="upvcContactItem">
              <span>Location</span>
              <b>{LOCATION}</b>
              <a className="upvcMapLink" href={MAPS} target="_blank" rel="noreferrer">
                <MapPin size={15} /> View on Google Maps <ArrowRight size={13} />
              </a>
            </div>
            <p className="upvcNote">For the quickest enquiry, WhatsApp a photo of the site and a short description of what you want.</p>
          </div>
          <div className="upvcContactCard">
            <small>ENQUIRY FORM</small>
            <h2>Request a quote</h2>
            <form className="upvcForm" onSubmit={submit}>
              <label>
                Name
                <input
                  className="input"
                  autoComplete="name"
                  placeholder="Your name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>
              <label>
                Phone / WhatsApp
                <input
                  className="input"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="Your number"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </label>
              <div className="reqField" role="radiogroup" aria-label="What do you need?">
                <span className="reqLabel">What do you need?</span>
                <div className="reqChips">
                  {REQUIREMENTS.map((r) => (
                    <button
                      type="button"
                      key={r}
                      role="radio"
                      aria-checked={form.service === r}
                      className={`reqChip${form.service === r ? " active" : ""}`}
                      onClick={() => setForm({ ...form, service: r })}
                    >
                      {form.service === r && <Check size={14} />}
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <label>
                Project details
                <textarea
                  className="input"
                  rows={5}
                  placeholder="Tell us what you need — approximate size, location, preferred design, etc."
                  value={form.details}
                  onChange={(e) => setForm({ ...form, details: e.target.value })}
                  required
                />
              </label>
              <button className="referenceButton dark" type="submit">
                SEND ENQUIRY ON WHATSAPP <ArrowRight size={13} />
              </button>
              {sent && (
                <p className="upvcToast" role="status">
                  Opening WhatsApp with your enquiry…
                </p>
              )}
            </form>
          </div>
        </section>
        <section className="referenceWrap upvcContactMap">
          <iframe title="Classic Steel location — Cuncolim, Goa" src={MAP_EMBED} loading="lazy" />
        </section>
      </main>
      <Footer data={data} />
      <WhatsAppWidget />
    </>
  );
}

function hammingDistance(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}
function isDuplicatePhash(phash: string, existing: string[]) {
  return existing.some((h) => h && hammingDistance(phash, h) <= 6);
}
// Full-screen photo chooser used by the Homepage editor (hero, About strip, gallery slots).
function PhotoChooser({
  photos,
  chosenId,
  title,
  note,
  onPick,
  onUpload,
  uploading,
  onClose,
}: {
  photos: any[];
  chosenId?: string | null;
  title: string;
  note?: string;
  onPick: (id: string) => void;
  onUpload?: (f: File) => void;
  uploading?: boolean;
  onClose: () => void;
}) {
  const cats = ["All", ...Array.from(new Set<string>(photos.map((p: any) => p.category || p.occasion || "Other")))];
  const [cat, setCat] = useState("All");
  const shown = cat === "All" ? photos : photos.filter((p: any) => (p.category || p.occasion || "Other") === cat);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, []);
  return createPortal(
    <div className="chooserOverlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="chooserPanel" onClick={(e) => e.stopPropagation()}>
        <div className="chooserHead">
          <div>
            <b>{title}</b>
            <span className="muted">
              {shown.length} photo{shown.length === 1 ? "" : "s"} · tap one to choose it
            </span>
          </div>
          <button type="button" className="btn outline" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {note && <p className="muted chooserNote">{note}</p>}
        {cats.length > 2 && (
          <div className="chooserCats">
            {cats.map((c) => (
              <button type="button" key={c} className={c === cat ? "active" : ""} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
        )}
        <div className="chooserGrid">
          {shown.map((p: any) => (
            <button
              type="button"
              key={p.id}
              className={`chooserItem${chosenId === p.id ? " chosen" : ""}`}
              onClick={() => onPick(p.id)}
              title={p.caption || p.category || ""}
            >
              <PickerThumb src={p.image_url} />
              {p._count > 1 && <span className="pickerStackBadge">{p._count}</span>}
              {chosenId === p.id && (
                <span className="chooserCheck">
                  <Check size={16} />
                </span>
              )}
            </button>
          ))}
          {!shown.length && <p className="muted">No published photos here yet.</p>}
        </div>
        {onUpload && (
          <label className="chooserUpload">
            <Upload size={18} />
            <span>{uploading ? "Uploading…" : "Or upload a new photo"}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
              }}
            />
          </label>
        )}
      </div>
    </div>,
    document.body,
  );
}
function PickerThumb({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <span className="pickerThumbBroken" title="Not viewable here yet — still on Instagram's servers" />;
  return <img src={src} alt="" onError={() => setBroken(true)} />;
}
// Photo quality gate. Two signals that hold up in practice:
//  - too small: forwarded / screenshotted / downloaded images are low-resolution (camera photos are 3000px+);
//  - blurry: little edge detail even in the most detailed parts of the picture.
const QUALITY_MIN_SHORT_SIDE = 600;
const QUALITY_MIN_PIXELS = 480_000;
const QUALITY_MIN_SHARPNESS = 90;
function assessQuality(src: Blob | string): Promise<{ ok: boolean; issue: string; width: number; height: number; sharpness: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = typeof src === "string" ? src : URL.createObjectURL(src);
    const done = (r: any) => {
      if (typeof src !== "string") URL.revokeObjectURL(url);
      resolve(r);
    };
    img.onload = () => {
      try {
        const W = img.naturalWidth,
          H = img.naturalHeight;
        // Measured near website display size, so blur that visitors would notice is what counts.
        const s = Math.min(1, 1600 / Math.max(W, H));
        const w = Math.max(8, Math.round(W * s)),
          h = Math.max(8, Math.round(H * s));
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const x = c.getContext("2d", { willReadFrequently: true })!;
        x.drawImage(img, 0, 0, w, h);
        const d = x.getImageData(0, 0, w, h).data;
        const g = new Float32Array(w * h);
        for (let i = 0, k = 0; i < g.length; i++, k += 4) g[i] = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2];
        // Laplacian variance per tile; average the most detailed quarter so plain walls/sky don't count as blur.
        const T = 8,
          tw = Math.floor((w - 2) / T),
          th = Math.floor((h - 2) / T);
        const tiles: number[] = [];
        for (let ty = 0; ty < T; ty++)
          for (let tx = 0; tx < T; tx++) {
            let s1 = 0,
              s2 = 0,
              n = 0;
            for (let y = 1 + ty * th; y < 1 + (ty + 1) * th; y++)
              for (let xx = 1 + tx * tw; xx < 1 + (tx + 1) * tw; xx++) {
                const k = y * w + xx;
                const z = g[k - 1] + g[k + 1] + g[k - w] + g[k + w] - 4 * g[k];
                s1 += z;
                s2 += z * z;
                n++;
              }
            if (n) tiles.push(s2 / n - (s1 / n) ** 2);
          }
        tiles.sort((a, b) => b - a);
        const top = tiles.slice(0, Math.max(1, Math.floor(tiles.length / 4)));
        const sharpness = top.reduce((a, b) => a + b, 0) / top.length;
        let issue = "";
        if (Math.min(W, H) < QUALITY_MIN_SHORT_SIDE || W * H < QUALITY_MIN_PIXELS) issue = `Low resolution (${W}×${H})`;
        else if (sharpness < QUALITY_MIN_SHARPNESS) issue = "Blurry";
        done({ ok: !issue, issue, width: W, height: H, sharpness });
      } catch {
        done({ ok: true, issue: "", width: 0, height: 0, sharpness: 0 });
      }
    };
    img.onerror = () => done({ ok: true, issue: "", width: 0, height: 0, sharpness: 0 });
    img.src = url;
  });
}
// Checks photos that haven't been checked yet (Instagram imports, older uploads). Low-quality ones are
// unpublished and moved to Pending with the reason, so nothing is deleted and you can approve one anyway.
async function checkPhotoQuality(photos: any[], onStatus?: (t: string) => void) {
  const todo = photos.filter(
    (p) => !p.quality_checked && p.image_url && (String(p.image_url).startsWith("/") || String(p.image_url).startsWith(location.origin)),
  );
  let flagged = 0;
  for (let i = 0; i < todo.length; i++) {
    const p = todo[i];
    onStatus?.(`Checking photo quality… ${i + 1} of ${todo.length}`);
    const q = await assessQuality(p.image_url);
    if (!q.width) continue; // couldn't load it; try again another time
    const body: any = { quality_checked: true, quality_issue: q.issue };
    if (!q.ok) {
      body.published = false;
      body.status = "pending";
      flagged++;
    }
    try {
      await api("/api/admin/photos/" + p.id, { method: "PATCH", body: JSON.stringify(body) });
    } catch {}
  }
  return { checked: todo.length, flagged };
}
function scoreImage(file: File) {
  return new Promise<any>((resolve, reject) => {
    const img = new Image(),
      url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 640,
        s = Math.min(1, max / Math.max(img.width, img.height)),
        w = Math.max(1, Math.round(img.width * s)),
        h = Math.max(1, Math.round(img.height * s));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const x = c.getContext("2d", { willReadFrequently: true });
      if (!x) return reject(new Error("Could not process image"));
      x.drawImage(img, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h).data;
      let sum = 0,
        sum2 = 0,
        clip = 0;
      const g = new Float32Array(w * h);
      for (let y = 0; y < h; y++)
        for (let xx = 0; xx < w; xx++) {
          const k = (y * w + xx) * 4,
            v = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2];
          g[y * w + xx] = v;
          sum += v;
          sum2 += v * v;
          if (v < 8 || v > 247) clip++;
        }
      let lap = 0;
      for (let y = 1; y < h - 1; y++)
        for (let xx = 1; xx < w - 1; xx++) {
          const k = y * w + xx,
            z = g[k - 1] + g[k + 1] + g[k - w] + g[k + w] - 4 * g[k];
          lap += z * z;
        }
      const mean = sum / (w * h),
        variance = sum2 / (w * h) - mean * mean,
        sharp = Math.min(100, (lap / (w * h)) * 1.7),
        exposure = Math.max(0, 100 - Math.abs(mean - 128) * 0.75 - (clip / (w * h)) * 100),
        contrast = Math.min(100, Math.sqrt(Math.max(0, variance)) * 1.15),
        brightness = Math.max(0, 100 - Math.abs(mean - 128) * 0.7),
        clarity = Math.min(100, sharp * 0.65 + contrast * 0.35),
        composition = Math.max(0, 100 - Math.abs(img.width / img.height - 1.5) * 35),
        total = sharp * 0.3 + exposure * 0.2 + contrast * 0.15 + clarity * 0.15 + brightness * 0.1 + composition * 0.1;
      const phash = Array.from({ length: 8 }, (_, yy) =>
        Array.from({ length: 8 }, (_, xx) =>
          g[Math.min(h - 1, Math.floor(((yy + 0.5) * h) / 8)) * w + Math.min(w - 1, Math.floor(((xx + 0.5) * w) / 8))] > mean ? "1" : "0",
        ).join(""),
      ).join("");
      URL.revokeObjectURL(url);
      resolve({
        width: img.width,
        height: img.height,
        bytes: file.size,
        sharpness: sharp,
        brightness,
        exposure,
        contrast,
        clarity,
        color: 0,
        composition,
        total_score: total,
        phash,
      });
    };
    img.onerror = reject;
    img.src = url;
  });
}
function toWebp(file: File) {
  return new Promise<File>((resolve, reject) => {
    const img = new Image(),
      url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 2048,
        s = Math.min(1, max / Math.max(img.width, img.height)),
        w = Math.max(1, Math.round(img.width * s)),
        h = Math.max(1, Math.round(img.height * s));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const x = c.getContext("2d");
      if (!x) return reject(new Error("Could not process image"));
      x.drawImage(img, 0, 0, w, h);
      c.toBlob(
        (b) => {
          URL.revokeObjectURL(url);
          if (!b) return reject(new Error("WebP conversion failed"));
          resolve(new File([b], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" }));
        },
        "image/webp",
        0.86,
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

function SmartCropStatic({ photo, alt }: { photo: any; alt?: string }) {
  const fx = Number(photo?.focal_x ?? 50),
    fy = Number(photo?.focal_y ?? 50),
    zoom = Number(photo?.focal_zoom ?? 1);
  return (
    <img
      src={photo?.image_url || photo?.image}
      alt={alt || ""}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: `${fx}% ${fy}%`,
        transform: `scale(${zoom})`,
        transformOrigin: `${fx}% ${fy}%`,
      }}
    />
  );
}
const CROP_DEVICE_RATIO: { desktop: number; mobile: number } = { desktop: 2.35, mobile: 0.8 };
function FocalPointEditor({
  photo,
  onClose,
  onSaved,
  simple,
  hero,
}: {
  photo: any;
  onClose: () => void;
  onSaved: () => void;
  simple?: boolean;
  hero?: boolean;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [d, setD] = useState(() => ({
    fx: Number(hero ? (photo?.focal_x_hero ?? photo?.focal_x ?? 50) : (photo?.focal_x ?? 50)),
    fy: Number(hero ? (photo?.focal_y_hero ?? photo?.focal_y ?? 50) : (photo?.focal_y ?? 50)),
    zoom: Number(hero ? (photo?.focal_zoom_hero ?? photo?.focal_zoom ?? 1) : (photo?.focal_zoom ?? 1)),
  }));
  const [m, setM] = useState(() => {
    const bfx = Number(hero ? (photo?.focal_x_hero ?? photo?.focal_x ?? 50) : (photo?.focal_x ?? 50));
    const bfy = Number(hero ? (photo?.focal_y_hero ?? photo?.focal_y ?? 50) : (photo?.focal_y ?? 50));
    const bzoom = Number(hero ? (photo?.focal_zoom_hero ?? photo?.focal_zoom ?? 1) : (photo?.focal_zoom ?? 1));
    return {
      fx: Number(hero ? (photo?.focal_x_hero_mobile ?? bfx) : (photo?.focal_x_mobile ?? bfx)),
      fy: Number(hero ? (photo?.focal_y_hero_mobile ?? bfy) : (photo?.focal_y_mobile ?? bfy)),
      zoom: Number(hero ? (photo?.focal_zoom_hero_mobile ?? bzoom) : (photo?.focal_zoom_mobile ?? bzoom)),
    };
  });
  const active = simple || device === "desktop" ? d : m;
  const setActive = simple || device === "desktop" ? setD : setM;
  const targetRatio = simple ? 0.8 : CROP_DEVICE_RATIO[device];
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [imgRatio, setImgRatio] = useState(1);
  const imgRef = useRef<HTMLImageElement>(null);
  const moveTo = (clientX: number, clientY: number) => {
    const el = imgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100));
    setActive((a) => ({ ...a, fx: Math.round(x), fy: Math.round(y) }));
  };
  const onDown = (e: React.MouseEvent) => {
    setDragging(true);
    moveTo(e.clientX, e.clientY);
  };
  const onMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    moveTo(e.clientX, e.clientY);
  };
  const onUp = () => setDragging(false);
  const onTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) moveTo(t.clientX, t.clientY);
  };
  const cropBox = () => {
    let baseW: number, baseH: number;
    if (imgRatio > targetRatio) {
      baseH = 100;
      baseW = (100 * targetRatio) / imgRatio;
    } else {
      baseW = 100;
      baseH = (100 * imgRatio) / targetRatio;
    }
    const w = Math.min(100, baseW / active.zoom),
      h = Math.min(100, baseH / active.zoom);
    const left = Math.max(0, Math.min(100 - w, active.fx - w / 2));
    const top = Math.max(0, Math.min(100 - h, active.fy - h / 2));
    return { left, top, w, h };
  };
  const box = cropBox();
  const previewPhoto = { ...photo, focal_x: active.fx, focal_y: active.fy, focal_zoom: active.zoom };
  const save = async () => {
    setSaving(true);
    try {
      const body: any = simple
        ? { focal_x: d.fx, focal_y: d.fy, focal_zoom: d.zoom }
        : hero
          ? {
              focal_x_hero: d.fx,
              focal_y_hero: d.fy,
              focal_zoom_hero: d.zoom,
              focal_x_hero_mobile: m.fx,
              focal_y_hero_mobile: m.fy,
              focal_zoom_hero_mobile: m.zoom,
            }
          : { focal_x: d.fx, focal_y: d.fy, focal_zoom: d.zoom, focal_x_mobile: m.fx, focal_y_mobile: m.fy, focal_zoom_mobile: m.zoom };
      await api("/api/admin/photos/" + photo.id, { method: "PATCH", body: JSON.stringify(body) });
      notify("Crop position saved.", "success");
      onSaved();
      onClose();
    } catch (e: any) {
      notify(e.message);
    } finally {
      setSaving(false);
    }
  };
  if (!photo) return null;
  return (
    <div className="cropEditorOverlay" onClick={onClose}>
      <div className="cropEditorPanel" onClick={(e) => e.stopPropagation()}>
        <h3>Fix crop position</h3>
        {!simple && (
          <div className="cropEditorDeviceTabs">
            <button type="button" className={device === "desktop" ? "sel" : ""} onClick={() => setDevice("desktop")}>
              Desktop
            </button>
            <button type="button" className={device === "mobile" ? "sel" : ""} onClick={() => setDevice("mobile")}>
              Mobile
            </button>
          </div>
        )}
        <p className="muted">
          The bright box is exactly what stays visible{simple ? "" : ` on ${device === "desktop" ? "desktop" : "phones"}`} — everything
          darkened gets cropped away. Drag it to reposition{simple ? "." : "; zoom controls how much of the photo it shows."}
          {hero ? " This crop only applies to the Hero banner, not anywhere else this photo appears." : ""}
        </p>
        <div
          className={`cropEditorFull${dragging ? " dragging" : ""}`}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) moveTo(t.clientX, t.clientY);
          }}
          onTouchMove={onTouchMove}
        >
          <img
            ref={imgRef}
            src={photo.image_url}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const t = e.currentTarget;
              setImgRatio(t.naturalWidth / Math.max(1, t.naturalHeight));
            }}
          />
          <div
            className="cropEditorSpotlight"
            style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.w}%`, height: `${box.h}%` }}
          />
        </div>
        {!simple && (
          <label className="cropEditorZoom">
            <span>Zoom {Math.round(active.zoom * 100)}%</span>
            <input
              type="range"
              min={1}
              max={2.5}
              step={0.05}
              value={active.zoom}
              onChange={(e) => setActive((a) => ({ ...a, zoom: Number(e.target.value) }))}
            />
          </label>
        )}
        {simple && active.zoom !== 1 && (
          <button
            type="button"
            className="btn outline cropEditorResetZoom"
            disabled={saving}
            onClick={async () => {
              setActive((a) => ({ ...a, zoom: 1 }));
              setSaving(true);
              try {
                await api("/api/admin/photos/" + photo.id, { method: "PATCH", body: JSON.stringify({ focal_zoom: 1 }) });
                notify("Zoom reset and saved.", "success");
                onSaved();
              } catch (e: any) {
                notify(e.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Resetting…" : `Reset zoom now (currently ${Math.round(active.zoom * 100)}% — saves immediately)`}
          </button>
        )}
        <p className="muted cropEditorPreviewLabel">{simple ? "Preview:" : `${device === "desktop" ? "Desktop" : "Mobile"} preview:`}</p>
        <div className="cropEditorPreviewRow single">
          <div className={`cropEditorPreview ${simple ? "gallery" : device}`} style={{ aspectRatio: targetRatio }}>
            <SmartCropStatic photo={previewPhoto} alt="" />
          </div>
        </div>
        <div className="cropEditorActions">
          <button className="btn outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn light" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save crop position"}
          </button>
        </div>
      </div>
    </div>
  );
}
function GroupCardImg({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (broken || !src)
    return (
      <div className="groupCardImgBroken">
        <span>Still on Instagram's servers — not viewable here yet. Run "Move older photos to permanent storage" to fix.</span>
      </div>
    );
  return <img src={src} alt={alt} onError={() => setBroken(true)} />;
}
function PhotoGroupCard({
  group,
  cats,
  onRefresh,
  selected,
  onToggleSelect,
}: {
  group: any[];
  cats: string[];
  onRefresh: () => void;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [cat, setCat] = useState(group[0]?.category || group[0]?.occasion || "Other");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const [aliasEdit, setAliasEdit] = useState("");
  const [catPick, setCatPick] = useState("");
  const [customCat, setCustomCat] = useState("");
  const multi = group.length > 1;
  const live = !!group[0]?.published;
  const tags = extractCaptionHashtags(group[0]?.caption || "");
  useEffect(() => {
    if (!multi || expanded) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % group.length), 5000);
    return () => clearInterval(t);
  }, [multi, expanded, group.length]);
  const go = (dir: number) => setIdx((i) => (i + dir + group.length) % group.length);
  const approveGroup = async () => {
    for (const p of group) {
      await api("/api/admin/photos/" + p.id, {
        method: "PATCH",
        body: JSON.stringify({ category: cat, occasion: cat, status: "approved", published: true }),
      });
      try {
        await api("/api/admin/photos/materialize", { method: "POST", body: JSON.stringify({ ids: [p.id] }) });
      } catch {}
    }
    onRefresh();
  };
  const unpublishGroup = async () => {
    for (const p of group) await api("/api/admin/photos/" + p.id, { method: "PATCH", body: JSON.stringify({ published: false }) });
    onRefresh();
  };
  const changeCategory = async (value: string) => {
    setCat(value);
    for (const p of group)
      await api("/api/admin/photos/" + p.id, { method: "PATCH", body: JSON.stringify({ category: value, occasion: value }) });
    onRefresh();
  };
  const deleteGroup = async (e: React.MouseEvent) => {
    e.stopPropagation();
    for (const p of group) await api("/api/admin/photos/" + p.id, { method: "DELETE" });
    onRefresh();
  };
  const unstackGroup = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api("/api/admin/photos/unstack", { method: "POST", body: JSON.stringify({ group_id: group[0]?.group_id }) });
      notify("Split back into separate photos.", "success");
      onRefresh();
    } catch (e: any) {
      notify(e.message);
    }
  };
  const openTag = (t: string) => {
    if (activeTag === t) {
      setActiveTag(null);
      return;
    }
    setActiveTag(t);
    setAliasEdit(t);
    const suggestion = cats.find((c) => c !== "Other" && t.includes(normalizeTagText(c)));
    setCatPick(suggestion || "");
    setCustomCat("");
  };
  const resolveTag = async () => {
    const alias = normalizeHashtagText(aliasEdit);
    const category = (catPick === "__custom__" ? customCat : catPick).trim();
    if (!alias) return notify("Enter a hashtag to match on.");
    if (!category) return notify("Choose or type a category.");
    try {
      const r = await api("/api/admin/hashtags/resolve", { method: "POST", body: JSON.stringify({ hashtag: activeTag, alias, category }) });
      notify(`#${alias} → ${category}.${r.updated ? ` ${r.updated} pending photo(s) updated.` : ""}`, "success");
      setActiveTag(null);
      onRefresh();
    } catch (e: any) {
      notify(e.message);
    }
  };
  const dismissTag = async () => {
    if (!activeTag) return;
    try {
      await api(`/api/admin/hashtags/${encodeURIComponent(activeTag)}/dismiss`, { method: "POST" });
    } catch {}
    setActiveTag(null);
  };
  return (
    <div className={selected ? "photoGroupSelected" : ""}>
      <div className={`photoCard photoGroupVisual${expanded ? " expanded" : ""}`} onClick={() => multi && setExpanded((x) => !x)}>
        {onToggleSelect && (
          <label className="photoGroupCheck" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={!!selected} onChange={onToggleSelect} />
          </label>
        )}
        <GroupCardImg
          key={group[idx]?.id || idx}
          src={group[idx]?.image_url || "/catalogue-reference.webp"}
          alt={group[idx]?.caption || "Photo"}
        />
        {live && <span className="photoLiveBadge">LIVE</span>}
        {!live && group[0]?.quality_issue && (
          <span className="photoQualityBadge" title={`${group[0].quality_issue} — approve it anyway if you're happy with it`}>
            {String(group[0].quality_issue).startsWith("Blurry") ? "Blurry" : "Low resolution"}
          </span>
        )}
        {multi && (
          <span className="photoGroupCount">
            {idx + 1}/{group.length}
          </span>
        )}
        {multi && expanded && (
          <>
            <button
              type="button"
              className="photoGroupNav prev"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              aria-label="Previous"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="photoGroupNav next"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              aria-label="Next"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
        <button className="iconDanger photoGroupDelete" onClick={deleteGroup} aria-label="Delete">
          <Trash2 size={15} />
        </button>
        <button
          type="button"
          className="photoMoveBtn"
          onClick={(e) => {
            e.stopPropagation();
            setShowCrop(true);
          }}
          aria-label="Adjust crop position"
        >
          <Move size={16} />
        </button>
      </div>
      <div className="photoTags">
        {tags.length ? (
          tags.map((t) => (
            <button type="button" key={t} className={`photoTagChip${activeTag === t ? " active" : ""}`} onClick={() => openTag(t)}>
              #{t}
            </button>
          ))
        ) : (
          <span className="photoTagsEmpty">No hashtags on this caption</span>
        )}
      </div>
      {activeTag && (
        <div className="photoTagResolve">
          <input
            className="input"
            value={aliasEdit}
            onChange={(e) => setAliasEdit(e.target.value)}
            placeholder="matches hashtags containing…"
          />
          <select value={catPick} onChange={(e) => setCatPick(e.target.value)}>
            <option value="">Choose category…</option>
            {cats
              .filter((c) => c !== "Other")
              .map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            <option value="__custom__">+ New category…</option>
          </select>
          {catPick === "__custom__" && (
            <input className="input" placeholder="New category name" value={customCat} onChange={(e) => setCustomCat(e.target.value)} />
          )}
          <button className="btn light" onClick={resolveTag}>
            Resolve
          </button>
          <button className="btn outline" onClick={dismissTag}>
            Dismiss
          </button>
        </div>
      )}
      <div className="photoMeta">
        <select value={cat} onChange={(e) => changeCategory(e.target.value)}>
          {cats.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        {live ? (
          <button className="btn outline" onClick={unpublishGroup}>
            Unpublish
          </button>
        ) : (
          <button className="btn outline" onClick={approveGroup}>
            Approve{multi ? ` all ${group.length}` : ""}
          </button>
        )}
      </div>
      {multi && (
        <button type="button" className="btn outline photoUnstackBtn" onClick={unstackGroup}>
          Split into {group.length} separate photos
        </button>
      )}
      {showCrop && <FocalPointEditor photo={group[idx]} onClose={() => setShowCrop(false)} onSaved={onRefresh} simple />}
    </div>
  );
}
function HashtagsPanel({ cats, refresh }: { cats: string[]; refresh: () => void }) {
  const [tags, setTags] = useState<any[]>([]);
  const [aliasEdits, setAliasEdits] = useState<Record<string, string>>({});
  const [catEdits, setCatEdits] = useState<Record<string, string>>({});
  const [customCat, setCustomCat] = useState<Record<string, string>>({});
  const load = () =>
    api("/api/admin/hashtags")
      .then((rows: any[]) => setTags(rows || []))
      .catch(() => {});
  useEffect(() => {
    load();
  }, []);
  const suggestFor = (text: string) => cats.find((c) => c !== "Other" && text.includes(normalizeTagText(c)));
  const resolve = async (hashtag: string) => {
    const alias = normalizeHashtagText(aliasEdits[hashtag] ?? hashtag);
    const picked = catEdits[hashtag] ?? suggestFor(alias) ?? "";
    const category = (picked === "__custom__" ? customCat[hashtag] || "" : picked).trim();
    if (!alias) return notify("Enter a hashtag to match on.");
    if (!category) return notify("Choose or type a category.");
    try {
      const r = await api("/api/admin/hashtags/resolve", { method: "POST", body: JSON.stringify({ hashtag, alias, category }) });
      notify(
        `#${alias} → ${category}.${r.updated ? ` ${r.updated} pending photo(s) updated.` : " Will apply to future posts."}`,
        "success",
      );
      load();
      refresh();
    } catch (e: any) {
      notify(e.message);
    }
  };
  const dismiss = async (hashtag: string) => {
    try {
      await api(`/api/admin/hashtags/${encodeURIComponent(hashtag)}/dismiss`, { method: "POST" });
      load();
    } catch (e: any) {
      notify(e.message);
    }
  };
  if (!tags.length)
    return (
      <p className="muted">
        No unresolved hashtags right now — new ones will show up here as Instagram posts come in that don't match a category.
      </p>
    );
  return (
    <div className="list">
      {tags.map((row: any) => {
        const alias = aliasEdits[row.hashtag] ?? row.hashtag;
        const suggestion = suggestFor(alias);
        const pickedRaw = catEdits[row.hashtag] ?? (suggestion || "");
        return (
          <div className="listItem hashtagRow" key={row.hashtag}>
            <div>
              <b>#{row.hashtag}</b>
              <span>
                {`Seen ${row.count}×`}
                {suggestion && !catEdits[row.hashtag] ? ` · Suggested: ${suggestion}` : ""}
              </span>
            </div>
            <div className="listActions hashtagActions">
              <input
                className="input"
                value={alias}
                onChange={(e) => setAliasEdits({ ...aliasEdits, [row.hashtag]: e.target.value })}
                placeholder="matches hashtags containing…"
              />
              <select value={pickedRaw} onChange={(e) => setCatEdits({ ...catEdits, [row.hashtag]: e.target.value })}>
                <option value="">Choose category…</option>
                {cats
                  .filter((c) => c !== "Other")
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                <option value="__custom__">+ New category…</option>
              </select>
              {pickedRaw === "__custom__" && (
                <input
                  className="input"
                  placeholder="New category name"
                  value={customCat[row.hashtag] || ""}
                  onChange={(e) => setCustomCat({ ...customCat, [row.hashtag]: e.target.value })}
                />
              )}
              <button className="btn light" onClick={() => resolve(row.hashtag)}>
                Resolve
              </button>
              <button className="btn outline" onClick={() => dismiss(row.hashtag)}>
                Dismiss
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
function GallerySlotsEditor({ services, photos, initial, refresh }: { services: any[]; photos: any[]; initial: any; refresh: () => void }) {
  const cats = Array.from(new Set([...(services || []).map((s: any) => String(s.title || "").trim()).filter(Boolean), "Other"]));
  const approved = photos.filter((p: any) => p.status === "approved" && p.published);
  const [slots, setSlots] = useState<any[]>(() =>
    (
      (initial?.slots && initial.slots.length
        ? initial.slots
        : Array.from({ length: 15 }, () => ({ type: "category", category: "Other" }))) as any[]
    ).map((s: any) => ({ ...s, _k: s._k || crypto.randomUUID() })),
  );
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [popoverMode, setPopoverMode] = useState<"category" | "pin">("category");
  const [uploading, setUploading] = useState(false);
  const [livePreview, setLivePreview] = useState<any[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [cropTarget, setCropTarget] = useState<any>(null);
  const loadPreview = () => {
    setPreviewLoading(true);
    api("/api/admin/gallery-preview")
      .then((r: any) => setLivePreview(r.photos || []))
      .catch(() => setLivePreview([]))
      .finally(() => setPreviewLoading(false));
  };
  useEffect(() => {
    loadPreview();
  }, []);
  const pinnedCount = slots.filter((s: any) => s.type === "pinned").length;
  const photoById = (id: string) => photos.find((p: any) => p.id === id);
  const groupFor = (p: any) =>
    p && p.group_id
      ? photos
          .filter((x: any) => x.group_id === p.group_id)
          .sort((a: any, b: any) => Number(a.group_order || 0) - Number(b.group_order || 0))
      : p
        ? [p]
        : [];
  const [stackIdx, setStackIdx] = useState<Record<string, number>>({});
  const openSlot = (i: number) => {
    if (openIdx === i) {
      setOpenIdx(null);
      return;
    }
    setOpenIdx(i);
    setPopoverMode(slots[i].type === "pinned" ? "pin" : "category");
  };
  const addSlot = () => {
    if (slots.length >= 21) return;
    setSlots((s) => [...s, { type: "category", category: "Other", _k: crypto.randomUUID() }]);
  };
  const removeSlot = (key: string) => {
    if (slots.length <= 3) return;
    const idx = slots.findIndex((x) => x._k === key);
    setSlots((s) => s.filter((x) => x._k !== key));
    if (idx >= 0 && openIdx === idx) setOpenIdx(null);
    loadPreview();
  };
  const setSlotCategory = (i: number, category: string) => {
    setSlots((s) => s.map((x, idx) => (idx === i ? { type: "category", category } : x)));
  };
  const pinSlot = (i: number, photoId: string) => {
    setSlots((s) => s.map((x, idx) => (idx === i ? { type: "pinned", photo_id: photoId } : x)));
    setOpenIdx(null);
    notify("This slot is now fixed to that exact photo — it will stop auto-rotating. Click Unpin on the slot to go back.", "success");
  };
  const unpinSlot = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSlots((s) => s.map((x, idx) => (idx === i ? { type: "category", category: "Other" } : x)));
  };
  const pinCurrent = (i: number) => {
    if (pinnedCount >= 5) return notify("Only 5 slots can be pinned. Unpin one first.");
    const current = livePreview?.[i];
    if (!current) return notify("Nothing is showing in this slot yet.");
    pinSlot(i, current.id);
  };
  const skipCurrentPhoto = async (i: number) => {
    const current = livePreview?.[i];
    if (!current) return notify("Nothing is showing in this slot yet.");
    try {
      await api("/api/admin/photos/" + current.id, { method: "PATCH", body: JSON.stringify({ excluded_from_auto: true }) });
      notify("That photo is now skipped everywhere it would auto-rotate — a different one takes its place.", "success");
      loadPreview();
    } catch (e: any) {
      notify(e.message);
    }
  };
  const uploadForSlot = async (i: number, file: File) => {
    setUploading(true);
    try {
      const webp = await toWebp(file);
      const score = await scoreImage(webp);
      const signed = await api("/api/admin/upload-url", {
        method: "POST",
        body: JSON.stringify({ size: webp.size, contentType: "image/webp", name: webp.name }),
      });
      const put = await fetch(signed.url, { method: "PUT", headers: { "Content-Type": "image/webp" }, body: webp });
      if (!put.ok) {
        const d = await put.json().catch(() => ({}));
        throw new Error(d.error || "Image upload failed.");
      }
      const created = await api("/api/admin/photos", {
        method: "POST",
        body: JSON.stringify({
          source: "manual",
          source_id: null,
          r2_key: signed.key,
          image_url: "/media/" + signed.key,
          reservation_id: signed.reservationId,
          caption: "Pinned homepage photo",
          category: "Other",
          occasion: "Other",
          status: "approved",
          published: true,
          ...score,
          bytes: webp.size,
        }),
      });
      pinSlot(i, created.id);
      refresh();
      loadPreview();
      notify("Uploaded and pinned to this slot.", "success");
    } catch (e: any) {
      notify(e.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };
  const save = async () => {
    try {
      await api("/api/admin/homepage/gallery", { method: "PUT", body: JSON.stringify({ slots }) });
      refresh();
      loadPreview();
      notify("Gallery layout saved.", "success");
    } catch (e: any) {
      notify(e.message);
    }
  };
  return (
    <div className="panel homepagePanel gallerySlotsEditor">
      <div className="panelTitle">
        <div>
          <h3>Our Gallery · {slots.length} slots</h3>
          <p className="muted">
            Set each slot to a category (rotates automatically among your best approved photos) or pin one exact photo. Thumbnails below are
            exactly what's live on your site right now. Up to 21 slots total, up to 5 pinned.
          </p>
        </div>
      </div>
      <div className="slotSummary">
        <div>
          <b>{slots.length}</b>
          <span>slots</span>
        </div>
        <div>
          <b>{pinnedCount}/5</b>
          <span>pinned</span>
        </div>
      </div>
      <div className="gallerySlotsGrid">
        {slots.map((slot: any, i: number) => {
          const pinnedPhoto = slot.type === "pinned" ? photoById(slot.photo_id) : null;
          const livePhoto = slot.type === "category" ? (previewLoading ? null : livePreview?.[i] || null) : null;
          const faceBase = slot.type === "pinned" ? pinnedPhoto : livePhoto;
          const faceGroup = groupFor(faceBase);
          const stacked = faceGroup.length > 1;
          const faceIdx = stacked ? Math.min(stackIdx[slot._k] || 0, faceGroup.length - 1) : 0;
          const facePhoto = faceGroup[faceIdx] || faceBase;
          const pickerPhotos =
            slot.type === "category" ? approved.filter((p: any) => (p.category || p.occasion) === slot.category) : approved;
          const pickerGroups = groupPhotos(pickerPhotos);
          return (
            <div className="gallerySlot" key={slot._k}>
              <button type="button" className="gallerySlotFace" onClick={() => openSlot(i)}>
                {facePhoto ? (
                  <SmartCrop photo={facePhoto} alt="" />
                ) : slot.type === "pinned" ? (
                  <span className="gallerySlotMissing">Missing photo</span>
                ) : (
                  <span className="gallerySlotCategory">{previewLoading ? "Loading…" : slot.category}</span>
                )}
                {slot.type === "category" && facePhoto && <span className="gallerySlotCategoryOverlay">{slot.category}</span>}
                {slot.type === "pinned" && (
                  <>
                    <span className="gallerySlotPinBadge">Pinned</span>
                    <button type="button" className="gallerySlotUnpin" onClick={(e) => unpinSlot(i, e)}>
                      Unpin
                    </button>
                  </>
                )}
                {stacked && (
                  <span className="gallerySlotStackCount">
                    {faceIdx + 1}/{faceGroup.length}
                  </span>
                )}
                {stacked && (
                  <>
                    <button
                      type="button"
                      className="gallerySlotNav prev"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStackIdx((s) => ({ ...s, [slot._k]: (faceIdx - 1 + faceGroup.length) % faceGroup.length }));
                      }}
                      aria-label="Previous in stack"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      className="gallerySlotNav next"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStackIdx((s) => ({ ...s, [slot._k]: (faceIdx + 1) % faceGroup.length }));
                      }}
                      aria-label="Next in stack"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </>
                )}
              </button>
              {facePhoto && (
                <button
                  type="button"
                  className="photoMoveBtn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCropTarget(facePhoto);
                  }}
                  aria-label="Adjust crop position"
                >
                  <Move size={16} />
                </button>
              )}
              <button
                type="button"
                className="gallerySlotRemove"
                onClick={() => removeSlot(slot._k)}
                disabled={slots.length <= 3}
                aria-label="Remove slot"
              >
                <X size={13} />
              </button>
              {openIdx === i && (
                <div className="gallerySlotPopover">
                  <div className="segmented small">
                    <button type="button" className={popoverMode === "category" ? "sel" : ""} onClick={() => setPopoverMode("category")}>
                      Category
                    </button>
                    <button type="button" className={popoverMode === "pin" ? "sel" : ""} onClick={() => setPopoverMode("pin")}>
                      Change image
                    </button>
                  </div>
                  {popoverMode === "category" ? (
                    <>
                      <select
                        value={slot.type === "category" ? slot.category : "Other"}
                        onChange={(e) => setSlotCategory(i, e.target.value)}
                      >
                        {cats.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                      <button type="button" className="btn outline pinCurrentBtn" onClick={() => pinCurrent(i)}>
                        Pin this image
                      </button>
                      <button type="button" className="btn outline pinCurrentBtn" onClick={() => skipCurrentPhoto(i)}>
                        Don't show this photo again
                      </button>
                    </>
                  ) : (
                    <PhotoChooser
                      photos={pickerGroups.map((g: any[]) => ({ ...g[0], _count: g.length }))}
                      chosenId={
                        slot.type === "pinned" ? pickerGroups.find((g: any[]) => g.some((p: any) => p.id === slot.photo_id))?.[0]?.id : null
                      }
                      title={`Choose photo for slot ${i + 1}`}
                      note={
                        slot.type === "category" ? `Showing only ${slot.category} photos, so whatever you tap fits this slot.` : undefined
                      }
                      onPick={(id) => pinSlot(i, id)}
                      onUpload={(f) => uploadForSlot(i, f)}
                      uploading={uploading}
                      onClose={() => setOpenIdx(null)}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
        {slots.length < 21 && (
          <button type="button" className="gallerySlotAdd" onClick={addSlot}>
            + Add slot
          </button>
        )}
      </div>
      <button className="btn light" onClick={save}>
        Save gallery layout
      </button>
      {cropTarget && <FocalPointEditor photo={cropTarget} onClose={() => setCropTarget(null)} onSaved={loadPreview} simple />}
    </div>
  );
}
function HeroAdmin({ photos, initial, refresh }: { photos: any[]; initial: any; refresh: () => void }) {
  const cfg = initial || { count: 4, source: "latest_instagram", photo_ids: [], interval: 7, transition: "normal", scrollReveal: false };
  const [count, setCount] = useState(Number(cfg.count) || 4);
  const [source, setSource] = useState(cfg.source || "latest_instagram");
  const [interval, setInterval_] = useState(Number(cfg.interval) || 7);
  const [transition, setTransition] = useState(cfg.transition || "normal");
  const [scrollReveal, setScrollReveal] = useState(!!cfg.scrollReveal);
  const [slots, setSlots] = useState<(string | null)[]>(() =>
    Array.from({ length: Number(cfg.count) || 4 }, (_, i) => (cfg.photo_ids || [])[i] || null),
  );
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cropTarget, setCropTarget] = useState<any>(null);
  const approved = photos.filter((p) => p.status === "approved" && p.published);
  const photoById = (id: string) => photos.find((p) => p.id === id);
  const setCountAndResize = (n: number) => {
    setCount(n);
    setSlots((s) => Array.from({ length: n }, (_, i) => s[i] || null));
  };
  const save = async () => {
    const ids = slots.filter(Boolean) as string[];
    if (source === "manual" && ids.length !== count) return notify(`Fill all ${count} slots.`);
    await api("/api/admin/homepage/hero", {
      method: "PUT",
      body: JSON.stringify({ count, source, photo_ids: ids, interval, transition, scrollReveal }),
    });
    refresh();
    notify("Hero settings have been saved.", "success");
  };
  const pickSlot = (i: number, photoId: string) => {
    setSlots((s) => s.map((x, idx) => (idx === i ? photoId : x)));
    setOpenIdx(null);
  };
  const clearSlot = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSlots((s) => s.map((x, idx) => (idx === i ? null : x)));
  };
  const uploadForSlot = async (i: number, file: File) => {
    setUploading(true);
    try {
      const webp = await toWebp(file);
      const score = await scoreImage(webp);
      const signed = await api("/api/admin/upload-url", {
        method: "POST",
        body: JSON.stringify({ size: webp.size, contentType: "image/webp", name: webp.name }),
      });
      const put = await fetch(signed.url, { method: "PUT", headers: { "Content-Type": "image/webp" }, body: webp });
      if (!put.ok) {
        const d = await put.json().catch(() => ({}));
        throw new Error(d.error || "Image upload failed.");
      }
      const created = await api("/api/admin/photos", {
        method: "POST",
        body: JSON.stringify({
          source: "manual",
          source_id: null,
          r2_key: signed.key,
          image_url: "/media/" + signed.key,
          reservation_id: signed.reservationId,
          caption: "Hero photo",
          category: "Other",
          occasion: "Other",
          status: "approved",
          published: true,
          ...score,
          bytes: webp.size,
        }),
      });
      pickSlot(i, created.id);
      refresh();
      notify("Uploaded and added to Hero.", "success");
    } catch (e: any) {
      notify(e.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };
  const previewPhotos =
    source === "manual"
      ? slots.map((id) => (id ? photoById(id) : null)).filter(Boolean)
      : photos.filter((p) => String(p.source || "").toLowerCase() === "instagram").slice(0, count);
  return (
    <div className="panel homepagePanel">
      <h3>Homepage Hero</h3>
      <p className="muted">Choose 3–5 images and how long each stays on screen.</p>
      <div className="settingRow">
        <label>
          Images
          <select value={count} onChange={(e) => setCountAndResize(Number(e.target.value))}>
            {[3, 4, 5].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Source
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="latest_instagram">Latest Instagram</option>
            <option value="manual">Manual catalogue</option>
          </select>
        </label>
        <label>
          Time on screen
          <select value={interval} onChange={(e) => setInterval_(Number(e.target.value))}>
            {[3, 5, 7, 10, 15].map((n) => (
              <option key={n} value={n}>
                {n} seconds
              </option>
            ))}
          </select>
        </label>
        <label>
          Transition
          <select value={transition} onChange={(e) => setTransition(e.target.value)}>
            <option value="slow">Slow</option>
            <option value="normal">Normal</option>
            <option value="fast">Fast</option>
          </select>
        </label>
        <label>
          Scroll reveal
          <select value={scrollReveal ? "on" : "off"} onChange={(e) => setScrollReveal(e.target.value === "on")}>
            <option value="off">Off (auto-rotate)</option>
            <option value="on">On (experimental)</option>
          </select>
        </label>
      </div>
      {scrollReveal && (
        <p className="muted" style={{ marginTop: -6 }}>
          When on, the Hero pins in place and visitors scroll through your images one by one with a diagonal wipe reveal, instead of them
          auto-rotating on a timer. Time on screen is ignored while this is on.
        </p>
      )}
      {source === "manual" && (
        <div className="gallerySlotsGrid stripSlotsGrid">
          {slots.map((photoId, i) => {
            const photo = photoId ? photoById(photoId) : null;
            return (
              <div className="gallerySlot" key={i}>
                <button type="button" className="gallerySlotFace" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
                  {photo ? <SmartCrop photo={photo} alt="" hero /> : <span className="gallerySlotCategory">Empty</span>}
                </button>
                {photo && (
                  <button
                    type="button"
                    className="photoMoveBtn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCropTarget(photo);
                    }}
                    aria-label="Adjust crop position"
                  >
                    <Move size={16} />
                  </button>
                )}
                {photo && (
                  <button type="button" className="gallerySlotRemove" onClick={(e) => clearSlot(i, e)} aria-label="Remove photo">
                    <X size={13} />
                  </button>
                )}
                {openIdx === i && (
                  <PhotoChooser
                    photos={approved}
                    chosenId={photoId}
                    title={`Choose photo ${i + 1}`}
                    onPick={(id) => pickSlot(i, id)}
                    onUpload={(f) => uploadForSlot(i, f)}
                    uploading={uploading}
                    onClose={() => setOpenIdx(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      <button className="btn light" onClick={save}>
        Save Hero
      </button>
      <div className="heroPreviewBlock">
        <p className="muted">
          Live preview — this is exactly what shows behind the homepage headline, full-bleed cropped. Click move to fix any that get cut
          off.
        </p>
        <div className="heroPreviewRow">
          {previewPhotos.map((p: any) => (
            <div className="heroPreviewTile" key={p.id}>
              <SmartCrop photo={p} alt="" hero />
              <button type="button" className="photoMoveBtn" onClick={() => setCropTarget(p)} aria-label="Adjust crop position">
                <Move size={16} />
              </button>
            </div>
          ))}
          {!previewPhotos.length && <p className="muted">Nothing selected yet.</p>}
        </div>
      </div>
      {cropTarget && <FocalPointEditor photo={cropTarget} onClose={() => setCropTarget(null)} onSaved={refresh} hero />}
    </div>
  );
}
function StripAdmin({ photos, initial, refresh }: { photos: any[]; initial: any; refresh: () => void }) {
  const cfg = initial || { photo_ids: [], interval: 7, transition: "normal" };
  const initialSlots = Array.from({ length: 8 }, (_, i) => (cfg.photo_ids || [])[i] || null);
  const [slots, setSlots] = useState<(string | null)[]>(initialSlots);
  const [interval, setInterval_] = useState(Number(cfg.interval) || 7);
  const [transition, setTransition] = useState(cfg.transition || "normal");
  const [reveal, setReveal] = useState(cfg.reveal || "none");
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cropTarget, setCropTarget] = useState<any>(null);
  const approved = photos.filter((p: any) => p.status === "approved" && p.published);
  const photoById = (id: string) => photos.find((p: any) => p.id === id);
  const save = async () => {
    const ids = slots.filter(Boolean) as string[];
    if (!ids.length) return notify("Choose at least 1 image.");
    await api("/api/admin/homepage/strip", { method: "PUT", body: JSON.stringify({ photo_ids: ids, interval, transition, reveal }) });
    refresh();
    notify("Featured roll settings have been saved.", "success");
  };
  const pickSlot = (i: number, photoId: string) => {
    setSlots((s) => s.map((x, idx) => (idx === i ? photoId : x)));
    setOpenIdx(null);
  };
  const clearSlot = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSlots((s) => s.map((x, idx) => (idx === i ? null : x)));
  };
  const uploadForSlot = async (i: number, file: File) => {
    setUploading(true);
    try {
      const webp = await toWebp(file);
      const score = await scoreImage(webp);
      const signed = await api("/api/admin/upload-url", {
        method: "POST",
        body: JSON.stringify({ size: webp.size, contentType: "image/webp", name: webp.name }),
      });
      const put = await fetch(signed.url, { method: "PUT", headers: { "Content-Type": "image/webp" }, body: webp });
      if (!put.ok) {
        const d = await put.json().catch(() => ({}));
        throw new Error(d.error || "Image upload failed.");
      }
      const created = await api("/api/admin/photos", {
        method: "POST",
        body: JSON.stringify({
          source: "manual",
          source_id: null,
          r2_key: signed.key,
          image_url: "/media/" + signed.key,
          reservation_id: signed.reservationId,
          caption: "Featured roll photo",
          category: "Other",
          occasion: "Other",
          status: "approved",
          published: true,
          ...score,
          bytes: webp.size,
        }),
      });
      pickSlot(i, created.id);
      refresh();
      notify("Uploaded and added to the roll.", "success");
    } catch (e: any) {
      notify(e.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="panel homepagePanel">
      <h3>About Us photo</h3>
      <p className="muted">
        Fill up to 8 slots. This is the photo next to your "We capture real moments" text on the homepage — it automatically fades between
        all of them.
      </p>
      <div className="settingRow">
        <label>
          Time on screen
          <select value={interval} onChange={(e) => setInterval_(Number(e.target.value))}>
            {[3, 5, 7, 10, 15].map((n) => (
              <option key={n} value={n}>
                {n} seconds
              </option>
            ))}
          </select>
        </label>
        <label>
          Transition
          <select value={transition} onChange={(e) => setTransition(e.target.value)}>
            <option value="slow">Slow</option>
            <option value="normal">Normal</option>
            <option value="fast">Fast</option>
          </select>
        </label>
        <label>
          Reveal animation
          <select value={reveal} onChange={(e) => setReveal(e.target.value)}>
            <option value="none">Off (plain fade)</option>
            <option value="slice">Slice reveal</option>
            <option value="scribble">Scribble reveal</option>
            <option value="curtain">Curtain reveal</option>
            <option value="sweep">Sweep reveal</option>
            <option value="circle">Circle reveal</option>
          </select>
        </label>
      </div>
      <div className="gallerySlotsGrid stripSlotsGrid">
        {slots.map((photoId, i) => {
          const photo = photoId ? photoById(photoId) : null;
          return (
            <div className="gallerySlot" key={i}>
              <button type="button" className="gallerySlotFace" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
                {photo ? <SmartCrop photo={photo} alt="" /> : <span className="gallerySlotCategory">Empty</span>}
              </button>
              {photo && (
                <button
                  type="button"
                  className="photoMoveBtn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCropTarget(photo);
                  }}
                  aria-label="Adjust crop position"
                >
                  <Move size={16} />
                </button>
              )}
              {photo && (
                <button type="button" className="gallerySlotRemove" onClick={(e) => clearSlot(i, e)} aria-label="Remove photo">
                  <X size={13} />
                </button>
              )}
              {openIdx === i && (
                <PhotoChooser
                  photos={approved}
                  chosenId={photoId}
                  title={`Choose photo ${i + 1}`}
                  onPick={(id) => pickSlot(i, id)}
                  onUpload={(f) => uploadForSlot(i, f)}
                  uploading={uploading}
                  onClose={() => setOpenIdx(null)}
                />
              )}
            </div>
          );
        })}
      </div>
      <button className="btn light" onClick={save}>
        Save featured roll
      </button>
      {cropTarget && <FocalPointEditor photo={cropTarget} onClose={() => setCropTarget(null)} onSaved={refresh} />}
    </div>
  );
}
function Photos({ photos, services, refresh }: { photos: any[]; services: any[]; refresh: () => void }) {
  const [skipLowQuality, setSkipLowQuality] = useState(true);
  const [qualityStatus, setQualityStatus] = useState("");
  const qualityRunning = useRef(false);
  const runQualityCheck = async (all: any[], announce: boolean) => {
    if (qualityRunning.current) return;
    qualityRunning.current = true;
    try {
      const r = await checkPhotoQuality(all, setQualityStatus);
      if (r.flagged) {
        notify(
          `Moved ${r.flagged} blurry or low-resolution photo${r.flagged === 1 ? "" : "s"} to Pending (marked “Low quality”).`,
          "success",
        );
        refresh();
      } else if (announce && r.checked) notify(`Checked ${r.checked} photo${r.checked === 1 ? "" : "s"} — all look fine.`, "success");
      else if (r.checked) refresh();
    } finally {
      setQualityStatus("");
      qualityRunning.current = false;
    }
  };
  // Automatically check any photos that haven't been checked yet (e.g. new Instagram imports).
  useEffect(() => {
    if (photos.some((p: any) => !p.quality_checked && "quality_checked" in p)) runQualityCheck(photos, false);
  }, [photos.length]);
  const [category, setCategory] = useState(services[0]?.title || "SS Railing"),
    [link, setLink] = useState(""),
    [files, setFiles] = useState<File[]>([]),
    [caption, setCaption] = useState(""),
    [uploading, setUploading] = useState(false),
    [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null),
    [igSyncBusy, setIgSyncBusy] = useState(""),
    [materializeBusy, setMaterializeBusy] = useState(false),
    [stacking, setStacking] = useState(false),
    [selectedGroups, setSelectedGroups] = useState<Record<string, any[]>>({}),
    [view, setView] = useState<"unresolved" | "pending" | "published">("pending");
  const cats = Array.from(new Set([...(services || []).map((s: any) => s.title), "Other"]));
  const toggleSelect = (key: string, groupPhotos: any[]) =>
    setSelectedGroups((s) => {
      const next = { ...s };
      if (next[key]) delete next[key];
      else next[key] = groupPhotos;
      return next;
    });
  useEffect(() => {
    if (!uploading && !materializeBusy) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [uploading, materializeBusy]);
  const stackSelected = async () => {
    const groups = Object.values(selectedGroups);
    if (groups.length < 2) return notify("Select at least 2 photos or groups to stack together.");
    const ids = groups.flatMap((g) => g.map((p: any) => p.id));
    setStacking(true);
    try {
      await api("/api/admin/photos/stack", { method: "POST", body: JSON.stringify({ ids }) });
      notify(`Stacked ${ids.length} photos into one tile.`, "success");
      setSelectedGroups({});
      refresh();
    } catch (e: any) {
      notify(e.message);
    } finally {
      setStacking(false);
    }
  };
  const approve = async (id: string) => {
    await api("/api/admin/photos/" + id, {
      method: "PATCH",
      body: JSON.stringify({ category, occasion: category, status: "approved", published: true }),
    });
    try {
      await api("/api/admin/photos/materialize", { method: "POST", body: JSON.stringify({ ids: [id] }) });
    } catch {}
    refresh();
  };
  const uploadManual = async () => {
    if (!files.length) return notify("Choose one or more images first.");
    setUploading(true);
    setBatchProgress({ done: 0, total: files.length });
    const existingHashes = photos.map((p: any) => p.phash).filter(Boolean);
    const batchHashes: string[] = [];
    let uploaded = 0,
      duplicates = 0,
      lowQuality = 0,
      failed = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        if (skipLowQuality) {
          const q = await assessQuality(file);
          if (!q.ok) {
            lowQuality++;
            setBatchProgress({ done: i + 1, total: files.length });
            continue;
          }
        }
        const webp = await toWebp(file);
        const score = await scoreImage(webp);
        if (isDuplicatePhash(score.phash, existingHashes) || isDuplicatePhash(score.phash, batchHashes)) {
          duplicates++;
          setBatchProgress({ done: i + 1, total: files.length });
          continue;
        }
        batchHashes.push(score.phash);
        const signed = await api("/api/admin/upload-url", {
          method: "POST",
          body: JSON.stringify({ size: webp.size, contentType: "image/webp", name: webp.name }),
        });
        const put = await fetch(signed.url, { method: "PUT", headers: { "Content-Type": "image/webp" }, body: webp });
        if (!put.ok) {
          const d = await put.json().catch(() => ({}));
          throw new Error(d.error || "Image upload failed.");
        }
        await api("/api/admin/photos", {
          method: "POST",
          body: JSON.stringify({
            source: "manual",
            source_id: null,
            r2_key: signed.key,
            image_url: "/media/" + signed.key,
            reservation_id: signed.reservationId,
            caption: caption.trim() || "Manual photo",
            category,
            occasion: category,
            status: "pending",
            published: false,
            ...score,
            quality_checked: 1,
            bytes: webp.size,
          }),
        });
        uploaded++;
      } catch {
        failed++;
      }
      setBatchProgress({ done: i + 1, total: files.length });
    }
    setFiles([]);
    setCaption("");
    const el = document.querySelector<HTMLInputElement>(".manualPhotoInput");
    if (el) el.value = "";
    refresh();
    notify(
      `Uploaded ${uploaded} to ${category}.${duplicates ? ` Skipped ${duplicates} as duplicate(s) already in your library.` : ""}${lowQuality ? ` Skipped ${lowQuality} blurry or low-resolution photo${lowQuality === 1 ? "" : "s"}.` : ""}${failed ? ` ${failed} failed.` : ""}`,
      "success",
    );
    setUploading(false);
    setBatchProgress(null);
  };
  const materializeAll = async () => {
    setMaterializeBusy(true);
    let totalStored = 0,
      totalFailed = 0,
      totalRefreshed = 0,
      rounds = 0;
    try {
      while (rounds < 60) {
        const r = await api("/api/admin/photos/materialize-all", { method: "POST" });
        totalStored += r.stored || 0;
        totalFailed += r.failed || 0;
        totalRefreshed += r.refreshed || 0;
        rounds++;
        setBatchProgress({ done: totalStored + totalFailed, total: totalStored + totalFailed + (r.remaining || 0) });
        if (!r.remaining) break;
        if (!r.stored && !r.refreshed) break;
      }
      notify(
        `Moved ${totalStored} photo(s) to permanent storage.${totalRefreshed ? ` (${totalRefreshed} needed a fresh link from Instagram first.)` : ""}${totalFailed ? ` ${totalFailed} failed — these may no longer exist on Instagram.` : ""}`,
        "success",
      );
      refresh();
    } catch (e: any) {
      notify(e.message);
    } finally {
      setMaterializeBusy(false);
      setBatchProgress(null);
    }
  };
  const recommendText =
    "Instagram photos are imported into Pending and categorized by hashtags. Manual uploads are converted to WebP before storage, then enter Pending in the selected category.";
  return (
    <div>
      <div className="panel manualUploadPanel">
        <div>
          <h3>Upload photos manually</h3>
          <p className="muted">
            Choose a category, select one or many images (a whole folder from a site visit works fine), and each is converted to WebP before
            storage. Anything that looks like a duplicate of a photo already in your library is skipped automatically.
          </p>
        </div>
        <div className="manualUploadGrid">
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {cats.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Caption / context <span className="muted">(optional, applied to all)</span>
            <input
              className="input"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. SS staircase railing, Margao villa"
            />
          </label>
          <label className="filePick">
            Images
            <input
              className="manualPhotoInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            <span>{files.length ? `${files.length} image(s) selected` : "Choose images"}</span>
          </label>
          <button className="btn light" onClick={uploadManual} disabled={uploading || !files.length}>
            {uploading
              ? `Uploading ${batchProgress?.done || 0} / ${batchProgress?.total || files.length}…`
              : `Upload ${files.length || ""} & add to catalogue`}
          </button>
        </div>
      </div>
      <div className="upload">
        <button
          className="btn outline"
          onClick={async () => {
            try {
              const r = await api("/api/admin/instagram/connect-link", { method: "POST" });
              setLink(r.url);
              navigator.clipboard?.writeText(r.url);
              notify("Client link created and copied.", "success");
            } catch (e: any) {
              notify(e.message);
            }
          }}
        >
          <Instagram size={17} /> Create client link
        </button>
        {link && (
          <div className="instagramLinkBox">
            <input className="input" readOnly value={link} />
            <button className="btn light" onClick={() => navigator.clipboard?.writeText(link)}>
              Copy
            </button>
          </div>
        )}
        <button
          className="btn outline"
          disabled={!!igSyncBusy}
          onClick={async () => {
            setIgSyncBusy("Syncing…");
            try {
              const r = await runInstagramSync((t) => setIgSyncBusy(t));
              notify(
                `Instagram sync complete: ${r.totalPhotos} new photos, ${r.totalVideos} new videos, ${r.downloaded} videos downloaded.${r.pending ? ` ${r.pending} still downloading in the background.` : ""} New photos are checked for blur automatically.`,
                "success",
              );
              refresh();
            } catch (e: any) {
              notify(e.message);
            } finally {
              setIgSyncBusy("");
            }
          }}
        >
          <Instagram size={17} /> {igSyncBusy || "Sync Instagram"}
        </button>
        <label className="checkRow qualityToggle">
          <input type="checkbox" checked={skipLowQuality} onChange={(e) => setSkipLowQuality(e.target.checked)} />
          Skip blurry or low-resolution photos when uploading
        </label>
        {qualityStatus && <span className="syncStatus">{qualityStatus}</span>}
        <button className="btn outline" onClick={materializeAll} disabled={materializeBusy}>
          {materializeBusy
            ? batchProgress
              ? `Moving… ${batchProgress.done} / ${batchProgress.total}`
              : "Moving…"
            : "Move older photos to permanent storage"}
        </button>
        <span className="muted">{recommendText}</span>
      </div>
      <div className="modes">
        <button className={view === "unresolved" ? "sel" : ""} onClick={() => setView("unresolved")}>
          Unresolved hashtags
        </button>
        <button className={view === "pending" ? "sel" : ""} onClick={() => setView("pending")}>
          Pending
        </button>
        <button className={view === "published" ? "sel" : ""} onClick={() => setView("published")}>
          Published
        </button>
      </div>
      {view !== "unresolved" && Object.keys(selectedGroups).length > 0 && (
        <div className="upload">
          <span className="muted">{Object.keys(selectedGroups).length} selected</span>
          <button className="btn light" onClick={stackSelected} disabled={stacking || Object.keys(selectedGroups).length < 2}>
            {stacking ? "Stacking…" : "Stack selected into one tile"}
          </button>
          <button className="btn outline" onClick={() => setSelectedGroups({})}>
            Clear selection
          </button>
        </div>
      )}
      {view === "unresolved" ? (
        <div className="panel">
          <HashtagsPanel cats={cats} refresh={refresh} />
        </div>
      ) : (
        <div className="photoGrid">
          {groupPhotos(photos)
            .filter((g) => (view === "pending" ? !g[0]?.published : !!g[0]?.published))
            .map((g, i) => {
              const key = g[0]?.group_id || g[0]?.id || String(i);
              return (
                <PhotoGroupCard
                  key={key}
                  group={g}
                  cats={cats}
                  onRefresh={refresh}
                  selected={!!selectedGroups[key]}
                  onToggleSelect={() => toggleSelect(key, g)}
                />
              );
            })}
        </div>
      )}
    </div>
  );
}

function FestivalsAdmin({ photos, refresh }: { photos: any[]; refresh: () => void }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [dateEdits, setDateEdits] = useState<Record<string, { start: string; end: string }>>({});
  const load = () => {
    setLoading(true);
    api("/api/admin/festivals")
      .then((r: any) => {
        setItems(r.items || []);
        setActive(r.active || null);
        const d: any = {};
        for (const it of r.items || [])
          if (it.movable) d[it.key] = { start: formatDateDMY(it.start || ""), end: formatDateDMY(it.end || "") };
        setDateEdits(d);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);
  const saveDates = async () => {
    const dates: any = {};
    for (const k in dateEdits) {
      const startIso = dmyToIso(dateEdits[k].start || "");
      const endIso = dmyToIso(dateEdits[k].end || "");
      if (startIso === null || endIso === null) return notify("Enter valid dates as DD/MM/YYYY.");
      dates[k] = { start: startIso, end: endIso };
    }
    setSaving(true);
    try {
      await api("/api/admin/festivals", { method: "PUT", body: JSON.stringify({ dates }) });
      notify("Saved.", "success");
      load();
    } catch (e: any) {
      notify(e.message);
    } finally {
      setSaving(false);
    }
  };
  if (loading)
    return (
      <div className="panel">
        <p className="muted">Loading…</p>
      </div>
    );
  return (
    <div className="panel homepagePanel">
      <h3>Festival greetings</h3>
      <p className="muted">
        A full-width banner wishing clients well appears automatically above the Hero on the exact festival day — the same fixed photo every
        time, no algorithm involved. New Year, Independence Day and Christmas repeat every year automatically. Ganesh Chaturthi, Diwali and
        Eid move every year on the lunar calendar, so their dates below need a yearly update.
      </p>
      {active && (
        <p className="muted" style={{ color: "var(--accent)", fontWeight: 700 }}>
          Today is a festival day: {items?.find((i) => i.key === active)?.title || active}
        </p>
      )}
      {!active && <p className="muted">No festival is active today.</p>}
      <div className="festivalDatesBlock">
        <h4>Update yearly — movable festival dates</h4>
        {(items || [])
          .filter((it: any) => it.movable)
          .map((it: any) => (
            <div className="festivalDateRow" key={it.key}>
              <span>{it.title}</span>
              <label>
                From
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="DD/MM/YYYY"
                  value={dateEdits[it.key]?.start || ""}
                  onChange={(e) => setDateEdits((d) => ({ ...d, [it.key]: { ...d[it.key], start: normalizeDateInput(e.target.value) } }))}
                />
              </label>
              <label>
                To
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="DD/MM/YYYY"
                  value={dateEdits[it.key]?.end || ""}
                  onChange={(e) => setDateEdits((d) => ({ ...d, [it.key]: { ...d[it.key], end: normalizeDateInput(e.target.value) } }))}
                />
              </label>
            </div>
          ))}
        <button className="btn outline" onClick={saveDates} disabled={saving}>
          Save dates
        </button>
      </div>
      <div className="gallerySlotsGrid">
        {(items || []).map((it: any) => (
          <div className="gallerySlot" key={it.key}>
            <div className="gallerySlotFace">
              <img src={it.photo.image_url} alt="" />
              <span className="gallerySlotCategoryOverlay">{it.title}</span>
            </div>
            <button type="button" className="festivalPreviewBtn" onClick={() => setPreviewItem(it)}>
              Preview
            </button>
          </div>
        ))}
      </div>
      {previewItem && (
        <div className="festivalPreviewOverlay" onClick={() => setPreviewItem(null)}>
          <div className="festivalPreviewPanel" onClick={(e) => e.stopPropagation()}>
            <div className="festivalPreviewHead">
              <b>Preview — {previewItem.title}</b>
              <button className="btn outline" onClick={() => setPreviewItem(null)}>
                Close
              </button>
            </div>
            <div className="festivalPreviewFrame">
              <FestivalBannerVisual f={previewItem} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function TestimonialsAdmin() {
  const load = () => {};
  const emptyForm = {
    author_name: "",
    rating: 5,
    review_text: "",
    relative_time: "",
    verified: true,
    active: true,
    sort_order: 0,
    image_url: "",
  };
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>(emptyForm);
  const [confirm, setConfirm] = useState<any>(null);
  const loadItems = () => {
    api("/api/admin/testimonials")
      .then((r: any) => setItems(r || []))
      .catch(() => setItems([]));
  };
  useEffect(() => {
    loadItems();
  }, []);
  const saveItem = async () => {
    if (!form.author_name.trim()) return notify("Enter the reviewer's name.");
    try {
      await api("/api/admin/testimonials", { method: "POST", body: JSON.stringify(form) });
      setForm(emptyForm);
      loadItems();
      load();
      notify(form.id ? "Testimonial updated." : "Testimonial added.", "success");
    } catch (e: any) {
      notify(e.message);
    }
  };
  const deleteItem = (t: any) =>
    setConfirm({
      title: "Delete this testimonial?",
      message: `Delete the review from "${t.author_name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      action: async () => {
        try {
          await api("/api/admin/testimonials/" + t.id, { method: "DELETE" });
          setConfirm(null);
          loadItems();
          load();
          notify("Testimonial deleted.", "success");
        } catch (e: any) {
          setConfirm(null);
          notify(e.message);
        }
      },
    });
  const toggleActive = async (t: any) => {
    await api("/api/admin/testimonials", { method: "POST", body: JSON.stringify({ ...t, active: !t.active }) });
    loadItems();
    load();
  };
  const manualManager = (
    <div className="panel">
      <h3>{form.id ? "Edit testimonial" : "Add a testimonial"}</h3>
      <p className="muted">
        Add real reviews from your customers (copied from Google, WhatsApp or Instagram with their OK). The homepage shows up to 8 active
        ones.
      </p>
      <div className="careerFormGrid">
        <label>
          Reviewer name
          <input className="input" value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })} />
        </label>
        <label>
          Rating
          <select value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} star{n !== 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          When <span className="muted">(e.g. "2 weeks ago")</span>
          <input className="input" value={form.relative_time} onChange={(e) => setForm({ ...form, relative_time: e.target.value })} />
        </label>
        <label>
          Photo URL <span className="muted">(optional)</span>
          <input className="input" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
        </label>
        <label className="wide">
          Review text
          <textarea
            className="input"
            rows={3}
            value={form.review_text}
            onChange={(e) => setForm({ ...form, review_text: e.target.value })}
          />
        </label>
      </div>
      <div className="careerFormActions">
        <button className="btn light" onClick={saveItem}>
          {form.id ? "Save changes" : "Add testimonial"}
        </button>
        {form.id && (
          <button className="btn outline" onClick={() => setForm(emptyForm)}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
  const manualList = (
    <div className="list">
      {items.map((t: any) => (
        <div className="listItem" key={t.id}>
          <div>
            <b>{t.author_name}</b>
            <span>
              {"★".repeat(t.rating)} · {t.active ? "Showing on site" : "Hidden"}
              {t.relative_time ? ` · ${t.relative_time}` : ""}
            </span>
            <span>{t.review_text}</span>
          </div>
          <div className="listActions">
            <button
              className="btn outline"
              onClick={() =>
                setForm({
                  id: t.id,
                  author_name: t.author_name,
                  rating: t.rating,
                  review_text: t.review_text,
                  relative_time: t.relative_time || "",
                  verified: !!t.verified,
                  active: !!t.active,
                  sort_order: t.sort_order || 0,
                  image_url: t.image_url || "",
                })
              }
            >
              Edit
            </button>
            <button className="btn outline" onClick={() => toggleActive(t)}>
              {t.active ? "Hide" : "Show"}
            </button>
            <button className="iconDanger" onClick={() => deleteItem(t)}>
              <Trash2 />
            </button>
          </div>
        </div>
      ))}
      {!items.length && <p className="muted">No testimonials added yet.</p>}
    </div>
  );
  return (
    <>
      {manualManager}
      {manualList}
      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || ""}
        message={confirm?.message || ""}
        confirmLabel={confirm?.confirmLabel || "Delete"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.action?.()}
      />
    </>
  );
}
// Tap a service thumbnail in the admin: see the card's rotating images, then fix its name/description.
function ServicePreviewModal({
  list,
  index,
  slidesFor,
  onIndex,
  onClose,
  onSave,
  onEditImages,
}: {
  list: any[];
  index: number;
  slidesFor: (s: any) => string[];
  onIndex: (i: number) => void;
  onClose: () => void;
  onSave: (s: any, changes: any) => Promise<void>;
  onEditImages: (s: any) => void;
}) {
  const item = list[index];
  const slides = item ? slidesFor(item) : [];
  const [k, setK] = useState(0);
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [saving, setSaving] = useState(false);
  const touchX = useRef<number | null>(null);
  useEffect(() => {
    setK(0);
    setTitle(item?.title || "");
    setDescription(item?.description || "");
  }, [item?.id]);
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setK((x) => (x + 1) % slides.length), 3500);
    return () => clearInterval(t);
  }, [slides.length, item?.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, []);
  if (!item) return null;
  const n = slides.length;
  const go = (d: number) => n && setK((x) => (x + d + n) % n);
  const dirty = title.trim() !== String(item.title || "") || description.trim() !== String(item.description || "");
  const save = async (thenNext: boolean) => {
    if (!title.trim()) return notify("Enter a service name.");
    setSaving(true);
    try {
      if (dirty) await onSave(item, { title: title.trim(), description: description.trim() });
      if (thenNext && index < list.length - 1) onIndex(index + 1);
      else if (!thenNext) notify("Saved.", "success");
    } finally {
      setSaving(false);
    }
  };
  return createPortal(
    <div className="videoPreviewOverlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="videoPreviewPanel" onClick={(e) => e.stopPropagation()}>
        <div className="videoPreviewHead">
          <b>
            Service {index + 1} of {list.length}
          </b>
          <button type="button" className="btn outline" onClick={onClose} aria-label="Close preview">
            <X size={18} />
          </button>
        </div>
        <div
          className="servicePreviewStage"
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          }}
        >
          {n ? (
            slides.map((src, j) => <img key={src + j} src={src} alt="" className={j === k ? "active" : ""} />)
          ) : (
            <ServiceIcon title={item.title} />
          )}
          {n > 1 && (
            <>
              <button type="button" className="serviceArrow prev" onClick={() => go(-1)} aria-label="Previous image">
                <ChevronLeft size={18} />
              </button>
              <button type="button" className="serviceArrow next" onClick={() => go(1)} aria-label="Next image">
                <ChevronRight size={18} />
              </button>
              <span className="serviceDots" aria-hidden="true">
                {slides.map((_, j) => (
                  <i key={j} className={j === k ? "active" : ""} />
                ))}
              </span>
            </>
          )}
        </div>
        <p className="muted servicePreviewCount">
          {n ? `Image ${k + 1} of ${n} on the homepage card` : "No images yet — the card shows an icon."}
        </p>
        <label className="videoPreviewField">
          Name
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="videoPreviewField">
          Short description
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <button type="button" className="btn outline" onClick={() => onEditImages(item)}>
          <Upload size={16} /> Edit images &amp; more
        </button>
        <div className="videoPreviewActions">
          <button type="button" className="btn outline" onClick={() => onIndex(index - 1)} disabled={index === 0 || saving}>
            <ChevronLeft size={16} /> Previous
          </button>
          <button type="button" className="btn light" onClick={() => save(false)} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" className="btn outline" onClick={() => save(true)} disabled={saving || index === list.length - 1}>
            {dirty ? "Save & next" : "Next"} <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
function ServicesAdmin({ services, photos = [], refresh }: any) {
  const projectPhotosFor = (title: string) =>
    (photos as any[])
      .filter(
        (p) =>
          (p.published === 1 || p.published === true) &&
          String(p.category || p.occasion || "").toLowerCase() === String(title || "").toLowerCase() &&
          p.image_url,
      )
      .map((p) => p.image_url as string);
  const empty = {
    id: "",
    title: "",
    description: "",
    instagram_hashtags: "",
    images: [] as string[],
    include_projects: true,
    active: true,
    sort_order: 0,
  };
  const [form, setForm] = useState<any>(empty);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<any>(null);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const quickSave = async (item: any, changes: any) => {
    try {
      await api("/api/admin/services", {
        method: "POST",
        body: JSON.stringify({
          id: item.id,
          title: item.title,
          description: item.description || "",
          instagram_hashtags: item.instagram_hashtags || "",
          images: parseImages(item.images).length ? parseImages(item.images) : item.image_url ? [item.image_url] : [],
          include_projects: item.include_projects !== 0 && item.include_projects !== false,
          active: item.active !== 0 && item.active !== false,
          sort_order: item.sort_order || 0,
          price: 0,
          ...changes,
        }),
      });
      refresh();
    } catch (e: any) {
      notify(e.message);
      throw e;
    }
  };
  const edit = (item: any) => {
    setForm({
      id: item.id,
      title: item.title || "",
      description: item.description || "",
      instagram_hashtags: item.instagram_hashtags || "",
      images: parseImages(item.images).length ? parseImages(item.images) : item.image_url ? [item.image_url] : [],
      include_projects: item.include_projects !== 0 && item.include_projects !== false,
      active: item.active !== 0 && item.active !== false,
      sort_order: item.sort_order || 0,
    });
    setOpen(true);
    setTimeout(() => document.querySelector(".serviceEditor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const addNew = () => {
    setForm({ ...empty, sort_order: services.length });
    setOpen(true);
  };
  const uploadImages = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const added: string[] = [];
    let skipped = 0;
    // Every image already used on any service (and in this editor) — fingerprints are part of the file name.
    const known = [...form.images, ...services.flatMap((x: any) => parseImages(x.images))].join(" ");
    const room = SERVICE_IMAGE_LIMIT - form.images.length;
    if (room <= 0) {
      notify(`This service already has ${SERVICE_IMAGE_LIMIT} images (the maximum). Remove one to add another.`);
      return;
    }
    let tooMany = 0,
      lowQ = 0;
    try {
      for (let k = 0; k < files.length; k++) {
        setUploading(`Uploading ${k + 1} of ${files.length}…`);
        if (added.length >= room) {
          tooMany++;
          continue;
        }
        const fp = "img-" + (await fileHash(files[k])).slice(0, 20);
        if (known.includes(fp) || added.some((x) => x.includes(fp))) {
          skipped++;
          continue;
        }
        const q = await assessQuality(files[k]);
        if (!q.ok) {
          lowQ++;
          continue;
        }
        const webp = await toWebp(files[k]);
        const signed = await api("/api/admin/upload-url", {
          method: "POST",
          body: JSON.stringify({ size: webp.size, contentType: "image/webp", name: fp + ".webp", purpose: "service-image" }),
        });
        const put = await fetch(signed.url, { method: "PUT", headers: { "Content-Type": "image/webp" }, body: webp });
        if (!put.ok) {
          const d = await put.json().catch(() => ({}));
          throw new Error(d.error || "Image upload failed.");
        }
        added.push("/media/" + signed.key);
      }
    } catch (e: any) {
      notify(e.message);
    } finally {
      if (added.length) setForm((f: any) => ({ ...f, images: [...f.images, ...added].slice(0, SERVICE_IMAGE_LIMIT) }));
      if (tooMany) notify(`Only ${SERVICE_IMAGE_LIMIT} images are allowed per service — ${tooMany} were not added.`);
      if (skipped) notify(`Skipped ${skipped} image${skipped === 1 ? "" : "s"} already used on the site.`);
      if (lowQ) notify(`Skipped ${lowQ} blurry or low-resolution image${lowQ === 1 ? "" : "s"}.`);
      setUploading("");
      const el = document.querySelector<HTMLInputElement>(".serviceImageInput");
      if (el) el.value = "";
    }
  };
  const moveImage = (idx: number, d: number) =>
    setForm((f: any) => {
      const list = f.images.slice();
      const j = idx + d;
      if (j < 0 || j >= list.length) return f;
      [list[idx], list[j]] = [list[j], list[idx]];
      return { ...f, images: list };
    });
  const removeImage = (idx: number) => setForm((f: any) => ({ ...f, images: f.images.filter((_: any, k: number) => k !== idx) }));
  const save = async () => {
    if (!form.title.trim()) return notify("Add a service name.");
    setSaving(true);
    try {
      await api("/api/admin/services", {
        method: "POST",
        body: JSON.stringify({ ...form, id: form.id || undefined, image_url: form.images[0] || "", price: 0 }),
      });
      notify(form.id ? "Service saved." : "Service added.", "success");
      setForm(empty);
      setOpen(false);
      refresh();
    } catch (e: any) {
      notify(e.message);
    } finally {
      setSaving(false);
    }
  };
  const deleteService = (item: any) =>
    setConfirm({
      title: "Delete this service?",
      message: `Delete “${item.title}”? Its uploaded images are deleted too. This cannot be undone.`,
      confirmLabel: "Delete service",
      action: async () => {
        try {
          await api("/api/admin/services/" + item.id, { method: "DELETE" });
          setConfirm(null);
          refresh();
          notify("Service deleted.", "success");
        } catch (e: any) {
          setConfirm(null);
          notify(e.message);
        }
      },
    });
  return (
    <>
      <div>
        {open ? (
          <div className="panel serviceEditor">
            <h3>{form.id ? `Edit “${form.title || "service"}”` : "Add a service"}</h3>
            <div className="serviceEditorGrid">
              <label>
                Name
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. SS Railing"
                />
              </label>
              <label>
                Instagram hashtags <span className="muted">(posts with these tags go into this service)</span>
                <input
                  className="input"
                  placeholder="#ssrailing, #staircaserailing"
                  value={form.instagram_hashtags}
                  onChange={(e) => setForm({ ...form, instagram_hashtags: e.target.value })}
                />
              </label>
              <label className="wide">
                Short description <span className="muted">(shown on the homepage card)</span>
                <textarea
                  className="input"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
            </div>
            <div className="serviceImagesHead">
              <b>
                Card images ({form.images.length}/{SERVICE_IMAGE_LIMIT})
              </b>
              <span className="muted">They rotate automatically on the homepage. The first one shows first.</span>
            </div>
            <div className="serviceImagesGrid">
              {form.images.map((src: string, idx: number) => (
                <div className="serviceImageItem" key={src + idx}>
                  <img src={src} alt="" />
                  {idx === 0 && <span className="serviceImageBadge">First</span>}
                  <div className="serviceImageActions">
                    <button type="button" onClick={() => moveImage(idx, -1)} disabled={idx === 0} aria-label="Move earlier">
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveImage(idx, 1)}
                      disabled={idx === form.images.length - 1}
                      aria-label="Move later"
                    >
                      <ChevronRight size={15} />
                    </button>
                    <button type="button" className="danger" onClick={() => removeImage(idx)} aria-label="Remove image">
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ))}
              <label className={`serviceImageAdd${uploading ? " busy" : ""}`}>
                <Upload size={20} />
                <span>{uploading || "Add images"}</span>
                <input
                  className="serviceImageInput"
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={!!uploading}
                  onChange={(e) => uploadImages(e.target.files)}
                />
              </label>
            </div>
            <label className="checkRow">
              <input
                type="checkbox"
                checked={form.include_projects}
                onChange={(e) => setForm({ ...form, include_projects: e.target.checked })}
              />
              Also rotate through published project photos in the “{form.title || "this"}” category
            </label>
            {form.include_projects &&
              (() => {
                const proj = projectPhotosFor(form.title).filter((u: string) => !form.images.includes(u));
                const shown = Math.max(0, SERVICE_IMAGE_LIMIT - form.images.length);
                return proj.length ? (
                  <div className="serviceProjectStrip">
                    <span className="muted">
                      Project photos in “{form.title}” ({proj.length}) — managed in Projects &amp; Curation.
                      {proj.length > shown ? ` The card shows ${shown} of them (${SERVICE_IMAGE_LIMIT} images max in total).` : ""}
                    </span>
                    <div className="serviceProjectThumbs">
                      {proj.map((u: string, k: number) => (
                        <img key={u + k} src={u} alt="" loading="lazy" className={k < shown ? "" : "notShown"} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="muted">No published project photos in “{form.title || "this"}” yet.</p>
                );
              })()}
            <label className="checkRow">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Show this service on the website
            </label>
            <div className="careerFormActions">
              <button className="btn light" onClick={save} disabled={saving || !!uploading}>
                {saving ? "Saving…" : form.id ? "Save changes" : "Add service"}
              </button>
              <button
                className="btn outline"
                onClick={() => {
                  setForm(empty);
                  setOpen(false);
                }}
              >
                Cancel
              </button>
            </div>
            {form.id && form.images.length === 0 && !(form.include_projects && projectPhotosFor(form.title).length) && (
              <p className="muted">No images yet — the card shows an icon until you add one.</p>
            )}
          </div>
        ) : (
          <div className="panel videoSyncRow">
            <div>
              <h3>Services</h3>
              <p className="muted">These are the cards in “Our services” on the homepage, and the categories for your project photos.</p>
            </div>
            <button className="btn light" onClick={addNew}>
              Add service
            </button>
          </div>
        )}
        <div className="list">
          {services.length ? (
            services.map((item: any) => {
              const imgs = parseImages(item.images).length ? parseImages(item.images) : item.image_url ? [item.image_url] : [];
              const proj = item.include_projects !== 0 ? projectPhotosFor(item.title).filter((u: string) => !imgs.includes(u)) : [];
              const onCard = Math.min(SERVICE_IMAGE_LIMIT, imgs.length + proj.length);
              const thumb = imgs[0] || proj[0];
              return (
                <div className={`listItem${item.active === 0 ? " isHidden" : ""}`} key={item.id}>
                  <div className="listItemMain">
                    <button
                      type="button"
                      className="videoThumbBtn"
                      onClick={() => setPreviewIdx(services.indexOf(item))}
                      aria-label={`Preview ${item.title}`}
                      title="Tap to preview"
                    >
                      {thumb ? (
                        <img className="listThumb" src={thumb} alt="" loading="lazy" />
                      ) : (
                        <span className="listThumb listThumbEmpty" />
                      )}
                      <span className="videoThumbPlay" aria-hidden="true">
                        <Eye size={14} />
                      </span>
                    </button>
                    <div>
                      <b>{item.title}</b>
                      <span>
                        {onCard} image{onCard === 1 ? "" : "s"} on the card ({imgs.length} uploaded here
                        {item.include_projects !== 0 ? ` + ${proj.length} project photo${proj.length === 1 ? "" : "s"}` : ""}) ·{" "}
                        {item.instagram_hashtags || "no hashtags"}
                        {item.active === 0 ? " · Hidden" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="listActions">
                    <button className="btn outline" onClick={() => edit(item)}>
                      Edit
                    </button>
                    <button className="iconDanger" onClick={() => deleteService(item)} aria-label={`Delete ${item.title}`}>
                      <Trash2 />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="muted">No services yet. Click “Add service” to create one.</p>
          )}
        </div>
      </div>
      {previewIdx !== null && services[previewIdx] && (
        <ServicePreviewModal
          list={services}
          index={previewIdx}
          slidesFor={(it: any) => serviceSlides(it, photos as any[])}
          onIndex={(i) => setPreviewIdx(Math.max(0, Math.min(services.length - 1, i)))}
          onClose={() => setPreviewIdx(null)}
          onSave={quickSave}
          onEditImages={(it: any) => {
            setPreviewIdx(null);
            edit(it);
          }}
        />
      )}
      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || ""}
        message={confirm?.message || ""}
        confirmLabel={confirm?.confirmLabel || "Delete"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.action?.()}
      />
    </>
  );
}
// Pulls new Instagram posts (photos and videos), then keeps downloading queued video files
// into the website's own storage until none are left.
async function runInstagramSync(onStatus?: (text: string) => void) {
  let cursor: string | undefined,
    totalPhotos = 0,
    totalVideos = 0,
    rounds = 0;
  while (rounds < 40) {
    onStatus?.("Checking Instagram…");
    const r: any = await api("/api/admin/instagram/sync", { method: "POST", body: JSON.stringify(cursor ? { cursor } : {}) });
    totalPhotos += r.photosImported || 0;
    totalVideos += r.reelsImported || 0;
    rounds++;
    if (!r.nextCursor) break;
    cursor = r.nextCursor;
  }
  const dl = await downloadQueuedVideos(onStatus);
  return { totalPhotos, totalVideos, ...dl };
}
async function downloadQueuedVideos(onStatus?: (text: string) => void) {
  let downloaded = 0,
    failed = 0,
    pending = 0,
    error = "";
  for (let round = 0; round < 60; round++) {
    const r: any = await api("/api/admin/instagram/download-videos", { method: "POST" });
    downloaded += r.downloaded || 0;
    failed += r.failed || 0;
    pending = r.pending || 0;
    error = r.error || "";
    if (pending) onStatus?.(`Downloading Instagram videos… ${downloaded} done, ${pending} left`);
    if (!pending || error || (!r.downloaded && !r.failed)) break;
  }
  return { downloaded, failed, pending, error };
}
// Re-encodes a video in the browser (hardware H.264) to shrink it while keeping it visually the same:
// long side capped at 1920px (Full HD), high quality setting. Falls back to the original file if the
// browser can't encode, or if the result wouldn't be meaningfully smaller.
async function compressVideo(file: File, onProgress: (pct: number) => void): Promise<File> {
  if (typeof (window as any).VideoEncoder === "undefined") return file;
  try {
    const mb = await import("mediabunny");
    const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
    const target = new mb.BufferTarget();
    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target });
    const conversion = await mb.Conversion.init({
      input,
      output,
      video: (track: any) => {
        const w = track.displayWidth,
          h = track.displayHeight;
        const opts: any = { codec: "avc", quality: mb.QUALITY_HIGH, forceTranscode: true };
        if (Math.max(w, h) > 1920) {
          if (w >= h) opts.width = 1920;
          else opts.height = 1920;
        }
        return opts;
      },
      // Audio is copied as-is (no re-encoding): it is already small and stays exactly the same.
    });
    if (!conversion.isValid || conversion.discardedTracks.length) {
      console.warn(
        "Video compression skipped: unsupported tracks",
        conversion.discardedTracks.map((d: any) => d.reason),
      );
      return file;
    }
    conversion.onProgress = (p: number) => onProgress(Math.round(p * 100));
    await conversion.execute();
    const buf = target.buffer;
    if (!buf || buf.byteLength >= file.size * 0.9) {
      console.warn("Video compression skipped: result not smaller", buf?.byteLength, file.size);
      return file;
    }
    return new File([buf], file.name.replace(/\.[^.]+$/, "") + ".mp4", { type: "video/mp4" });
  } catch (e) {
    console.warn("Video compression skipped:", e);
    return file;
  }
}
async function fileHash(file: Blob) {
  // Large files: fingerprint the size plus the first and last 8 MB (fast, low memory, still unique in practice).
  const CHUNK = 8 * 1048576;
  const buf =
    file.size <= 3 * CHUNK
      ? await file.arrayBuffer()
      : await new Blob([String(file.size), file.slice(0, CHUNK), file.slice(file.size - CHUNK)]).arrayBuffer();
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function captureVideoPoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let done = false;
    const finish = (b: Blob | null) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve(b);
    };
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    video.onloadedmetadata = () => {
      try {
        video.currentTime = Math.min(1, (video.duration || 2) / 3);
      } catch {
        finish(null);
      }
    };
    video.onseeked = () => {
      try {
        const w = video.videoWidth,
          h = video.videoHeight;
        if (!w || !h) return finish(null);
        const scale = Math.min(1, 1080 / Math.max(w, h));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => finish(b), "image/webp", 0.85);
      } catch {
        finish(null);
      }
    };
    video.onerror = () => finish(null);
    setTimeout(() => finish(null), 15000);
  });
}
function putWithProgress(url: string, body: Blob, contentType: string, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = "Upload failed.";
      try {
        msg = JSON.parse(xhr.responseText).error || msg;
      } catch {}
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(body);
  });
}
const VIDEO_UPLOAD_MB = 75;
const VIDEO_UPLOAD_LIMIT = VIDEO_UPLOAD_MB * 1024 * 1024;
// Tap a video thumbnail in the admin: watch it, then rename / re-categorise it in the same place.
function VideoPreviewModal({
  list,
  index,
  cats,
  onIndex,
  onClose,
  onSave,
}: {
  list: any[];
  index: number;
  cats: string[];
  onIndex: (i: number) => void;
  onClose: () => void;
  onSave: (v: any, changes: any) => Promise<void>;
}) {
  const v = list[index];
  const [title, setTitle] = useState(v?.title || "");
  const [category, setCategory] = useState(v?.category || "Other");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setTitle(v?.title || "");
    setCategory(v?.category || "Other");
  }, [v?.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, []);
  if (!v) return null;
  const dirty = title.trim() !== String(v.title || "") || category !== String(v.category || "Other");
  const save = async (thenNext: boolean) => {
    if (!title.trim()) return notify("Enter a title.");
    setSaving(true);
    try {
      if (dirty) await onSave(v, { title: title.trim(), category });
      if (thenNext && index < list.length - 1) onIndex(index + 1);
      else if (!thenNext) notify("Saved.", "success");
    } finally {
      setSaving(false);
    }
  };
  return createPortal(
    <div className="videoPreviewOverlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="videoPreviewPanel" onClick={(e) => e.stopPropagation()}>
        <div className="videoPreviewHead">
          <b>
            Video {index + 1} of {list.length}
          </b>
          <button type="button" className="btn outline" onClick={onClose} aria-label="Close preview">
            <X size={18} />
          </button>
        </div>
        <video
          key={v.id}
          className="videoPreviewPlayer"
          src={v.media_url}
          poster={v.thumbnail_url || undefined}
          controls
          autoPlay
          muted
          playsInline
          preload="metadata"
        />
        <label className="videoPreviewField">
          <span className="renameLabel">
            <Pencil size={14} /> Name <span className="muted">(tap to rename)</span>
          </span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save(true);
            }}
            placeholder="e.g. SS staircase railing, Margao"
          />
        </label>
        <label className="videoPreviewField">
          Category
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {Array.from(new Set([...cats, "Other", v.category || "Other"])).map((c: string) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="videoPreviewActions">
          <button type="button" className="btn outline" onClick={() => onIndex(index - 1)} disabled={index === 0 || saving}>
            <ChevronLeft size={16} /> Previous
          </button>
          <button type="button" className={`btn light${dirty ? " saveReady" : ""}`} onClick={() => save(false)} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save name"}
          </button>
          <button type="button" className="btn outline" onClick={() => save(true)} disabled={saving || index === list.length - 1}>
            {dirty ? "Save & next" : "Next"} <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
function VideosAdmin({ videos, services, refresh }: { videos: any[]; services: any[]; refresh: () => void }) {
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [queue, setQueue] = useState<{ file: File; title: string }[]>([]),
    [category, setCategory] = useState(""),
    [progress, setProgress] = useState<number | null>(null),
    [busy, setBusy] = useState(""),
    [status, setStatus] = useState(""),
    [confirm, setConfirm] = useState<any>(null);
  const cats = services.length ? services.map((s: any) => s.title) : CATS;
  const titleFromName = (name: string) =>
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim();
  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const ok = ["video/mp4", "video/webm", "video/quicktime"];
    const picked = Array.from(list).filter((f) => ok.includes((f.type || "video/mp4").toLowerCase()));
    if (picked.length < list.length) notify("Some files were skipped — only MP4, MOV or WebM videos can be uploaded.");
    setQueue((q) => [...q, ...picked.map((f) => ({ file: f, title: titleFromName(f.name) }))]);
    const el = document.querySelector<HTMLInputElement>(".manualVideoInput");
    if (el) el.value = "";
  };
  // Uploads one video: duplicate check → compress → upload file + cover → save. Returns what happened.
  const uploadOne = async (file: File, title: string, cat: string, say: (t: string) => void): Promise<"ok" | "dup" | string> => {
    if (file.size > 1536 * 1048576) return "over 1.5 GB";
    say("checking for duplicates…");
    const contentHash = await fileHash(file);
    const check: any = await api("/api/admin/videos/check-hash?hash=" + contentHash);
    if (check.duplicate) return "dup";
    say("compressing… 0%");
    const small = await compressVideo(file, (pct) => say(`compressing… ${pct}%`));
    if (small.size > VIDEO_UPLOAD_LIMIT)
      return `still ${(small.size / 1048576).toFixed(0)} MB after compression — the limit is ${VIDEO_UPLOAD_MB} MB; trim it shorter`;
    say(
      small === file
        ? "uploading…"
        : `compressed ${(file.size / 1048576).toFixed(1)} → ${(small.size / 1048576).toFixed(1)} MB, uploading…`,
    );
    const type = (small.type || file.type || "video/mp4").toLowerCase();
    const posterBlob = await captureVideoPoster(small);
    const signed = await api("/api/admin/upload-url", {
      method: "POST",
      body: JSON.stringify({ size: small.size, contentType: type, name: small.name }),
    });
    setProgress(0);
    await putWithProgress(signed.url, small, type, setProgress);
    let poster: any = null;
    if (posterBlob) {
      try {
        poster = await api("/api/admin/upload-url", {
          method: "POST",
          body: JSON.stringify({ size: posterBlob.size, contentType: "image/webp", name: file.name, purpose: "video-poster" }),
        });
        const put = await fetch(poster.url, { method: "PUT", headers: { "Content-Type": "image/webp" }, body: posterBlob });
        if (!put.ok) poster = null;
      } catch {
        poster = null;
      }
    }
    try {
      await api("/api/admin/videos", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim() || titleFromName(file.name) || "Project video",
          category: cat,
          r2_key: signed.key,
          reservationId: signed.reservationId,
          poster_key: poster?.key || "",
          posterReservationId: poster?.reservationId || "",
          content_hash: contentHash,
        }),
      });
    } catch (e: any) {
      if (e?.data?.duplicate) return "dup";
      throw e;
    }
    return "ok";
  };
  const upload = async () => {
    if (!queue.length) return notify("Choose one or more videos first.");
    const cat = category || cats[0] || "Other";
    const items = queue.slice();
    setBusy("upload");
    let done = 0,
      dups = 0;
    const failed: string[] = [];
    try {
      for (let k = 0; k < items.length; k++) {
        const it = items[k];
        const say = (t: string) => setStatus(`Video ${k + 1} of ${items.length} (${it.title || it.file.name}): ${t}`);
        try {
          const r = await uploadOne(it.file, it.title, cat, say);
          if (r === "ok") done++;
          else if (r === "dup") dups++;
          else failed.push(`${it.title || it.file.name} (${r})`);
        } catch (e: any) {
          failed.push(`${it.title || it.file.name} (${e?.message || "failed"})`);
        }
        setQueue((q) => q.filter((x) => x.file !== it.file));
      }
      const parts = [`Uploaded ${done} video${done === 1 ? "" : "s"}.`];
      if (dups) parts.push(`Skipped ${dups} already on the site.`);
      if (failed.length) parts.push(`Failed: ${failed.join(", ")}.`);
      notify(parts.join(" "), failed.length && !done ? "error" : "success");
      refresh();
    } finally {
      setBusy("");
      setStatus("");
      setProgress(null);
    }
  };
  const syncInstagram = async () => {
    setBusy("sync");
    try {
      const r = await runInstagramSync(setStatus);
      notify(
        `Instagram sync complete: ${r.totalPhotos} new photos, ${r.totalVideos} new videos, ${r.downloaded} videos downloaded.${r.pending ? ` ${r.pending} still downloading in the background.` : ""}${r.error ? " " + r.error : ""}`,
        "success",
      );
      refresh();
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy("");
      setStatus("");
    }
  };
  const retryDownloads = async () => {
    setBusy("retry");
    try {
      await api("/api/admin/instagram/download-videos/retry", { method: "POST" });
      const r = await downloadQueuedVideos(setStatus);
      notify(
        `Downloaded ${r.downloaded} video(s).${r.failed ? ` ${r.failed} failed again.` : ""}${r.error ? " " + r.error : ""}`,
        "success",
      );
      refresh();
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy("");
      setStatus("");
    }
  };
  const restoreDeleted = async () => {
    setConfirm(null);
    setBusy("restore");
    try {
      let cursor: string | undefined,
        total = 0,
        rounds = 0;
      while (rounds < 40) {
        const r: any = await api("/api/admin/instagram/reels/reset", { method: "POST", body: JSON.stringify(cursor ? { cursor } : {}) });
        total += r.reelsImported || 0;
        rounds++;
        if (!r.nextCursor) break;
        cursor = r.nextCursor;
      }
      const d = await downloadQueuedVideos(setStatus);
      notify(`Restored ${total} Instagram video(s); ${d.downloaded} downloaded.`, "success");
      refresh();
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy("");
      setStatus("");
    }
  };
  const save = async (v: any, changes: any) => {
    try {
      await api("/api/admin/videos", {
        method: "POST",
        body: JSON.stringify({ id: v.id, title: v.title, category: v.category, active: !!v.active, sort_order: v.sort_order, ...changes }),
      });
      refresh();
    } catch (e: any) {
      notify(e.message);
    }
  };
  const ordered = videos.slice().sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  const move = async (idx: number, dir: number) => {
    const other = ordered[idx + dir];
    const v = ordered[idx];
    if (!other) return;
    const a = Number(v.sort_order || 0),
      b = Number(other.sort_order || 0);
    await save(v, { sort_order: a === b ? b + dir : b });
    await save(other, { sort_order: a === b ? a : a });
  };
  const videoState = (v: any) => {
    if (String(v.platform) !== "instagram") return String(v.media_url || "").startsWith("/media/") ? "Uploaded" : "Starter video";
    if (String(v.media_url || "").startsWith("/media/")) return "Instagram · downloaded";
    return v.download_error ? `Instagram · download failed (${v.download_error})` : "Instagram · waiting to download";
  };
  const pendingCount = videos.filter(
    (v: any) => String(v.platform) === "instagram" && !String(v.media_url || "").startsWith("/media/"),
  ).length;
  return (
    <>
      <div className="panel videoAdminPanel">
        <h3>Upload videos</h3>
        <p className="muted">
          Choose one or many MP4, MOV or WebM videos. Each is checked for duplicates, compressed automatically (Full HD, high quality) and
          gets a cover image from the video. Limit: 75 MB per video after compression.
        </p>
        <div className="manualVideoGrid videoUploadGrid">
          <label className={`btn outline videoPick${busy ? " disabled" : ""}`}>
            <Upload size={17} /> Choose videos
            <input
              className="manualVideoInput"
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              multiple
              onChange={(e) => addFiles(e.target.files)}
              disabled={!!busy}
            />
          </label>
          <select
            className="input"
            value={category || cats[0]}
            onChange={(e) => setCategory(e.target.value)}
            disabled={!!busy}
            aria-label="Category"
          >
            {cats.map((c: string) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button className="btn light" onClick={upload} disabled={!!busy || !queue.length}>
            {busy === "upload"
              ? progress !== null && progress < 100
                ? `Uploading… ${progress}%`
                : "Working…"
              : queue.length > 1
                ? `Upload ${queue.length} videos`
                : "Upload video"}
          </button>
        </div>
        {queue.length > 0 && (
          <div className="videoQueue">
            {queue.map((it, k) => (
              <div className="videoQueueItem" key={it.file.name + it.file.size + k}>
                <span className="videoQueueSize">{(it.file.size / 1048576).toFixed(1)} MB</span>
                <input
                  className="input"
                  value={it.title}
                  placeholder="Title, e.g. SS railing installation"
                  disabled={!!busy}
                  onChange={(e) => setQueue((q) => q.map((x, j) => (j === k ? { ...x, title: e.target.value } : x)))}
                  aria-label={`Title for ${it.file.name}`}
                />
                <button
                  type="button"
                  className="iconDanger"
                  disabled={!!busy}
                  onClick={() => setQueue((q) => q.filter((_, j) => j !== k))}
                  aria-label={`Remove ${it.file.name}`}
                >
                  <X size={18} />
                </button>
              </div>
            ))}
            <p className="muted">All selected videos go into the “{category || cats[0]}” category. You can change each one later below.</p>
          </div>
        )}
        {busy === "upload" && status && <p className="syncStatus">{status}</p>}
        {busy === "upload" && progress !== null && (
          <div className="uploadBar" aria-hidden="true">
            <i style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <div className="panel videoAdminPanel">
        <div className="videoSyncRow">
          <div>
            <h3>Instagram</h3>
            <p className="muted">
              Sync downloads new Instagram photos and videos straight into the website's storage, so they keep working even if the post
              changes. This also runs automatically twice a day.
              {pendingCount ? ` ${pendingCount} video(s) are waiting to download.` : ""}
            </p>
            {status && <p className="syncStatus">{status}</p>}
          </div>
          <div className="videoAdminActions">
            <button className="btn light" onClick={syncInstagram} disabled={!!busy}>
              {busy === "sync" ? (
                "Syncing…"
              ) : (
                <>
                  <Instagram size={17} /> Sync now
                </>
              )}
            </button>
            {pendingCount > 0 && (
              <button className="btn outline" onClick={retryDownloads} disabled={!!busy}>
                {busy === "retry" ? "Downloading…" : "Retry downloads"}
              </button>
            )}
            <button
              className="btn outline"
              onClick={() =>
                setConfirm({
                  title: "Restore deleted Instagram videos?",
                  message: "Instagram videos you deleted from the website will be imported and downloaded again on this sync.",
                })
              }
              disabled={!!busy}
            >
              {busy === "restore" ? "Restoring…" : "Restore deleted"}
            </button>
          </div>
        </div>
      </div>
      <div className="list">
        {ordered.length ? (
          ordered.map((v: any, idx: number) => (
            <div className={`listItem${v.active ? "" : " isHidden"}`} key={v.id}>
              <div className="listItemMain">
                <button
                  type="button"
                  className="videoThumbBtn"
                  onClick={() => setPreviewIdx(idx)}
                  aria-label={`Preview ${v.title}`}
                  title="Tap to preview"
                >
                  {v.thumbnail_url ? (
                    <img
                      className="listThumb listThumbPortrait"
                      src={v.thumbnail_url}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                  ) : (
                    <span className="listThumb listThumbPortrait listThumbEmpty" />
                  )}
                  <span className="videoThumbPlay" aria-hidden="true">
                    <Play size={14} fill="currentColor" />
                  </span>
                </button>
                <div>
                  <b>{v.title}</b>
                  <span>
                    {videoState(v)} · {v.category || "Other"} · {v.active ? "Showing" : "Hidden"}
                  </span>
                </div>
              </div>
              <div className="listActions">
                <button className="btn outline" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label={`Move ${v.title} up`}>
                  <ArrowUp size={16} />
                </button>
                <button
                  className="btn outline"
                  onClick={() => move(idx, 1)}
                  disabled={idx === ordered.length - 1}
                  aria-label={`Move ${v.title} down`}
                >
                  <ArrowDown size={16} />
                </button>
                <select
                  className="input videoCatSelect"
                  value={v.category || "Other"}
                  onChange={(e) => save(v, { category: e.target.value })}
                  aria-label={`Category for ${v.title}`}
                >
                  {Array.from(new Set([...cats, "Other", v.category || "Other"])).map((c: string) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <button
                  className="btn outline"
                  onClick={() => {
                    const t = window.prompt("Video title", v.title || "");
                    if (t && t.trim()) save(v, { title: t.trim() });
                  }}
                >
                  Rename
                </button>
                <button className="btn outline" onClick={() => save(v, { active: !v.active })}>
                  {v.active ? "Hide" : "Show"}
                </button>
                <button
                  className="iconDanger"
                  onClick={() =>
                    setConfirm({
                      title: "Delete this video?",
                      message: `"${v.title}" will be removed from the website${String(v.media_url || "").startsWith("/media/") ? " and its file deleted from storage" : ""}.${String(v.platform) === "instagram" ? " It won't be downloaded again on the next Instagram sync." : ""}`,
                      del: v,
                    })
                  }
                  aria-label={`Delete ${v.title}`}
                >
                  <Trash2 />
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">No videos yet. Upload one above or sync Instagram.</p>
        )}
      </div>
      {previewIdx !== null && ordered[previewIdx] && (
        <VideoPreviewModal
          list={ordered}
          index={previewIdx}
          cats={cats}
          onIndex={(i) => setPreviewIdx(Math.max(0, Math.min(ordered.length - 1, i)))}
          onClose={() => setPreviewIdx(null)}
          onSave={(v, changes) => save(v, changes)}
        />
      )}
      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || ""}
        message={confirm?.message || ""}
        confirmLabel={confirm?.del ? "Delete" : "Restore"}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm?.del) return restoreDeleted();
          const v = confirm.del;
          setConfirm(null);
          try {
            await api("/api/admin/videos/" + v.id, { method: "DELETE" });
            notify("Video deleted.", "success");
            refresh();
          } catch (e: any) {
            notify(e.message);
          }
        }}
      />
    </>
  );
}
function AdminsAdmin({ admins, refresh }: { admins: any[]; refresh: () => void }) {
  const [e, setE] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState<any>(null);
  const invite = async () => {
    const email = e.trim().toLowerCase();
    if (!email) return notify("Enter the admin email address.");
    setBusy(true);
    try {
      const r = await api("/api/admin/admin-invites", { method: "POST", body: JSON.stringify({ email }) });
      setE("");
      refresh();
      if (r.ok) {
        notify("Invitation email sent.", "success");
      } else if (r.inviteUrl) {
        navigator.clipboard?.writeText(r.inviteUrl);
        notify(
          "The invitation was created, but the email could not be delivered. The invitation link has been copied so you can still complete the setup.",
        );
      }
    } catch (err: any) {
      if (err?.data?.inviteUrl) {
        navigator.clipboard?.writeText(err.data.inviteUrl);
        notify(
          "The invitation was created, but the email could not be delivered. The invitation link has been copied so you can still complete the setup.",
        );
      } else notify(err.message);
    } finally {
      setBusy(false);
    }
  };
  const adminCount = admins.filter((a) => a.role === "admin" && a.active).length;
  const deleteAdmin = (a: any) =>
    setConfirm({
      title: "Delete admin?",
      message: `Are you sure you want to remove ${a.name}'s admin access? This will immediately remove their access to the Admin panel.`,
      confirmLabel: "Delete admin",
      action: async () => {
        try {
          await api("/api/admin/admins/" + a.id, { method: "DELETE" });
          setConfirm(null);
          notify("Admin deleted.", "success");
          refresh();
        } catch (err: any) {
          setConfirm(null);
          notify(err.message);
        }
      },
    });
  const makeOwner = (a: any) =>
    setConfirm({
      title: "Transfer Owner access?",
      message: `${a.name} (${a.email}) will become the Owner, with full control including Admins and Activity Log. You will become a regular Admin. This can be undone later by whoever holds Owner access.`,
      confirmLabel: "Transfer ownership",
      action: async () => {
        try {
          await api("/api/admin/admins/" + a.id + "/make-owner", { method: "POST" });
          setConfirm(null);
          notify("Ownership transferred. Reloading…", "success");
          setTimeout(() => location.reload(), 900);
        } catch (err: any) {
          setConfirm(null);
          notify(err.message);
        }
      },
    });
  return (
    <>
      <div>
        <div className="panel adminInvitePanel">
          <div>
            <h3>Invite an admin</h3>
            <p className="muted">Enter an email address. They will verify the invitation and choose their own password.</p>
          </div>
          <div className="adminInviteForm">
            <input
              className="input"
              type="email"
              autoComplete="email"
              placeholder="Admin email"
              value={e}
              onChange={(ev) => setE(ev.target.value)}
              disabled={busy}
            />
            <button className="btn light" onClick={invite} disabled={busy || adminCount >= 5}>
              {busy ? "Sending…" : "Invite admin"}
            </button>
          </div>
          <p className="muted adminInviteLimit">
            {adminCount} of 5 Admin accounts in use. Pending invitations also count toward the limit.
          </p>
          <p className="muted" style={{ marginTop: 10 }}>
            To make someone the Owner (e.g. handing the site over to a client), invite them as an admin first, have them complete setup,
            then use "Make Owner" below.
          </p>
        </div>
        <div className="list">
          {admins.map((a) => (
            <div className="listItem adminAccountItem" key={a.id}>
              <div>
                <b>{a.name}</b>
                <span>
                  {a.email} · {a.role}
                </span>
                <span>Created {istDateTime(a.created_at)}</span>
              </div>
              {a.role === "admin" && a.active && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn outline" onClick={() => makeOwner(a)}>
                    Make Owner
                  </button>
                  <button className="iconDanger" onClick={() => deleteAdmin(a)} aria-label={`Delete ${a.name}`}>
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || ""}
        message={confirm?.message || ""}
        confirmLabel={confirm?.confirmLabel || "Delete"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.action?.()}
      />
    </>
  );
}
function AdminSetup() {
  const [step, setStep] = useState<"email" | "code" | "account">("email"),
    [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [show, setShow] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (step === "email") {
        await api("/api/setup/request-code", { method: "POST", body: JSON.stringify({ email }) });
        setStep("code");
      } else if (step === "code") {
        await api("/api/setup/verify-code", { method: "POST", body: JSON.stringify({ email, code }) });
        setStep("account");
      } else {
        if (password !== confirm) return setError("Passwords do not match");
        await api("/api/setup/create", { method: "POST", body: JSON.stringify({ name, email, password, confirmPassword: confirm }) });
        setDone(true);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };
  if (done)
    return (
      <>
        <NoticeHost />
        <div className="login">
          <div className="panel">
            <small>OWNER SETUP COMPLETE</small>
            <h2>Your admin account is ready.</h2>
            <a className="btn light" href="/admin">
              Go to Admin
            </a>
          </div>
        </div>
      </>
    );
  return (
    <>
      <NoticeHost />
      <div className="login">
        <form className="panel" onSubmit={run}>
          <small>FIRST-TIME SETUP</small>
          <h2>Classic Steel</h2>
          {step === "email" && (
            <>
              <p className="muted">We'll send a verification code before creating the Owner account.</p>
              <input
                className="input"
                type="email"
                placeholder="Admin email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button className="btn light">Send verification code</button>
            </>
          )}
          {step === "code" && (
            <>
              <p className="muted">
                We sent a 6-digit code to <b>{email}</b>.
              </p>
              <input
                className="input"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
              <button className="btn light">Verify email</button>
            </>
          )}
          {step === "account" && (
            <>
              <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
              <div className="passwordField">
                <input
                  className="input"
                  type={show ? "text" : "password"}
                  minLength={12}
                  placeholder="Password (12+ characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" className="passwordToggle" onClick={() => setShow((x) => !x)}>
                  {show ? "Hide" : "Show"}
                </button>
              </div>
              <input
                className="input"
                type={show ? "text" : "password"}
                minLength={12}
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              <button className="btn light">Create Owner account</button>
            </>
          )}
          {error && <p className="errorText">{error}</p>}
          <a className="muted setupBack" href="/admin">
            Back to Admin
          </a>
        </form>
      </div>
    </>
  );
}
function AdminInviteSetup() {
  const token = new URLSearchParams(location.search).get("token") || "";
  const [email, setEmail] = useState(""),
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [show, setShow] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [done, setDone] = useState(false);
  useEffect(() => {
    if (!token) {
      setError("This invitation link is missing. Ask the Owner to send a new invitation.");
      setLoading(false);
      return;
    }
    api("/api/admin/admin-invites/" + encodeURIComponent(token))
      .then((d) => setEmail(d.email))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    try {
      await api("/api/admin/invites/complete", {
        method: "POST",
        body: JSON.stringify({ token, email, name, password, confirmPassword: confirm }),
      });
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    }
  };
  if (done)
    return (
      <div className="login">
        <div className="panel inviteSetupPanel">
          <small>ADMIN ACCOUNT READY</small>
          <h2>Welcome to Classic Steel</h2>
          <p className="muted">Your email has been verified and your Admin account is ready.</p>
          <a className="btn light" href="/admin">
            Go to Admin login
          </a>
        </div>
      </div>
    );
  return (
    <div className="login">
      <form className="panel inviteSetupPanel" onSubmit={submit}>
        <small>ADMIN INVITATION</small>
        <h2>Create your admin account</h2>
        {loading ? (
          <p className="muted">Verifying your invitation…</p>
        ) : error && !email ? (
          <p className="errorText">{error}</p>
        ) : (
          <>
            <p className="muted">Your invitation verifies ownership of this email. Choose your own password below.</p>
            <label className="inviteField">
              <span>Email</span>
              <input className="input" type="email" value={email} readOnly />
            </label>
            <label className="inviteField">
              <span>Name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
            </label>
            <div className="passwordField">
              <input
                className="input"
                type={show ? "text" : "password"}
                minLength={12}
                placeholder="Password (12+ characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="button" className="passwordToggle" onClick={() => setShow((x) => !x)}>
                {show ? "Hide" : "Show"}
              </button>
            </div>
            <div className="passwordField">
              <input
                className="input"
                type={show ? "text" : "password"}
                minLength={12}
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              <button type="button" className="passwordToggle" onClick={() => setShow((x) => !x)}>
                {show ? "Hide" : "Show"}
              </button>
            </div>
            <button className="btn light">Create Admin account</button>
            {error && <p className="errorText">{error}</p>}
          </>
        )}
        <a className="muted setupBack" href="/admin">
          Back to login
        </a>
      </form>
    </div>
  );
}

function formatBytes(n: number) {
  if (!n) return "0 MB";
  const mb = n / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
function countryName(code: string) {
  if (!code || code === "Unknown") return "Unknown";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}
function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function DonutPanel({
  title,
  items,
  colors,
  emptyText,
}: {
  title: string;
  items: { label: string; value: number }[];
  colors: string[];
  emptyText: string;
}) {
  const total = items.reduce((a, x) => a + x.value, 0);
  if (!total)
    return (
      <div className="panel devicePanel">
        <h3>{title}</h3>
        <p className="muted">{emptyText}</p>
      </div>
    );
  const gradient = items
    .map(
      (x, i) =>
        `${colors[i % colors.length]} ${(items.slice(0, i).reduce((a, y) => a + y.value, 0) / total) * 360}deg ${(items.slice(0, i + 1).reduce((a, y) => a + y.value, 0) / total) * 360}deg`,
    )
    .join(",");
  return (
    <div className="panel devicePanel">
      <h3>{title}</h3>
      <div className="deviceChart">
        <div className="pie" style={{ background: `conic-gradient(${gradient})` }}>
          <div>
            {total}
            <small>visits</small>
          </div>
        </div>
        <div className="legend">
          {items.map((x, i) => (
            <div key={x.label}>
              <i style={{ background: colors[i % colors.length] }} />
              <b>{x.label}</b>
              <span>{x.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function istGreeting() {
  const hour = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }));
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}
function Dashboard({ dash, isOwner, name }: any) {
  if (!dash) return <div className="panel">Loading…</div>;
  const firstName = String(name || "")
    .trim()
    .split(" ")[0];
  const vals = ["mobile", "desktop", "tablet"].map((k) => ({
    label: k,
    value: dash.analytics.reduce((a: any, x: any) => a + Number(x[k] || 0), 0),
  }));
  const total = vals.reduce((a, x) => a + x.value, 0) || 1;
  const gradient = vals
    .map(
      (x, i) =>
        `${["#36b37e", "#4c8bf5", "#f5b64c"][i]} ${(vals.slice(0, i).reduce((a, y) => a + y.value, 0) / total) * 360}deg ${(vals.slice(0, i + 1).reduce((a, y) => a + y.value, 0) / total) * 360}deg`,
    )
    .join(",");
  const storageUsed = Number(dash.storageBytes || 0),
    storageLimit = Number(dash.storageLimit || 1),
    storagePct = Math.min(100, (storageUsed / storageLimit) * 100),
    storageRemaining = Math.max(0, storageLimit - storageUsed);
  const devicesPanel = (
    <div className="panel devicePanel">
      <h3>Devices</h3>
      <div className="deviceChart">
        <div className="pie" style={{ background: `conic-gradient(${gradient})` }}>
          <div>
            {total}
            <small>visits</small>
          </div>
        </div>
        <div className="legend">
          {vals.map((x, i) => (
            <div key={x.label}>
              <i style={{ background: ["#36b37e", "#4c8bf5", "#f5b64c"][i] }} />
              <b>{x.label}</b>
              <span>{x.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  return (
    <div className="dash">
      {firstName && (
        <p className="dashGreeting">
          {istGreeting()}, {firstName}
        </p>
      )}
      <div className="stat">
        <small>TODAY</small>
        <b>{dash.analytics[0]?.visitors || 0}</b>
        <span>unique visitors</span>
      </div>
      <div className="stat">
        <small>7 DAYS</small>
        <b>{dash.analytics.slice(0, 7).reduce((a: any, x: any) => a + x.visitors, 0)}</b>
        <span>unique visitors</span>
      </div>
      <div className="stat">
        <small>30 DAYS</small>
        <b>{dash.analytics.slice(0, 30).reduce((a: any, x: any) => a + x.visitors, 0)}</b>
        <span>unique visitors</span>
      </div>
      {isOwner ? (
        <div className="devicePanelsRow">
          {devicesPanel}
          <ActivityLogPanel />
        </div>
      ) : (
        devicesPanel
      )}
      <div className="panel devicePanel">
        <h3>Storage</h3>
        {dash.storageEnabled ? (
          <div className="deviceChart">
            <div
              className="pie"
              style={{ background: `conic-gradient(#4c8bf5 0deg ${storagePct * 3.6}deg,#2a343980 ${storagePct * 3.6}deg 360deg)` }}
            >
              <div>
                {storagePct.toFixed(0)}%<small>{formatBytes(storageUsed)} used</small>
              </div>
            </div>
            <div className="legend">
              <div>
                <i style={{ background: "#4c8bf5" }} />
                <b>Used</b>
                <span>{formatBytes(storageUsed)}</span>
              </div>
              <div>
                <i style={{ background: "#2a343980" }} />
                <b>Remaining</b>
                <span>{formatBytes(storageRemaining)}</span>
              </div>
              <div>
                <i style={{ background: "transparent" }} />
                <b>Hard limit</b>
                <span>{formatBytes(storageLimit)}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="muted">R2 storage isn't connected yet. Once bound, usage will show here.</p>
        )}
      </div>
    </div>
  );
}

function AboutTextAdmin({ initial, refresh }: { initial: any; refresh: () => void }) {
  const [text, setText] = useState(initial?.text || "");
  useEffect(() => {
    setText(initial?.text || "");
  }, [initial?.text]);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!text.trim()) return notify("About text cannot be empty.");
    setBusy(true);
    try {
      await api("/api/admin/homepage/about", { method: "PUT", body: JSON.stringify({ text: text.trim() }) });
      refresh();
      notify("About text has been saved.", "success");
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="panel homepagePanel">
      <h3>About Us text</h3>
      <p className="muted">
        This is the paragraph next to your "We capture real moments" heading on the homepage. Leave a blank line between paragraphs to split
        into two.
      </p>
      <textarea className="input" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn light" onClick={save} disabled={busy} style={{ marginTop: 12 }}>
        {busy ? "Saving…" : "Save About text"}
      </button>
    </div>
  );
}
function istDay(ts: string) {
  const iso = ts.includes("T") ? ts : ts.replace(" ", "T") + "Z";
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
function istDateTime(ts: string) {
  const iso = ts.includes("T") ? ts : ts.replace(" ", "T") + "Z";
  return (
    new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }) + " IST"
  );
}
function ActivityLogPanel() {
  const [items, setItems] = useState<any[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<"all" | "today" | "7d" | "date">("all");
  const [pickedDate, setPickedDate] = useState("");
  useEffect(() => {
    api("/api/admin/activity-log")
      .then(setItems)
      .catch(() => setItems([]));
  }, []);
  const today = istDay(new Date().toISOString());
  const sixtyAgo = istDay(new Date(Date.now() - 60 * 86400000).toISOString());
  const filtered = (items || []).filter((it: any) => {
    if (filter === "today") return istDay(it.created_at) === today;
    if (filter === "7d")
      return (
        new Date(it.created_at.includes("T") ? it.created_at : it.created_at.replace(" ", "T") + "Z").getTime() >= Date.now() - 7 * 86400000
      );
    if (filter === "date") return pickedDate && istDay(it.created_at) === pickedDate;
    return true;
  });
  const shown = expanded ? filtered : (items || []).slice(0, 5);
  return (
    <div className="panel devicePanel">
      <h3 className="activityLogHead" onClick={() => items && items.length > 0 && setExpanded((x) => !x)}>
        Admin Activity Log
        {items && items.length > 0 && <ChevronDown size={18} className={`activityLogChevron${expanded ? " open" : ""}`} />}
      </h3>
      {items === null ? (
        <p className="muted">Loading…</p>
      ) : !items.length ? (
        <p className="muted">No activity recorded yet.</p>
      ) : (
        <>
          <div className="list activityLogList">
            {shown.map((it: any) => (
              <div className="listItem" key={it.id}>
                <div>
                  <b>{it.action}</b>
                  <span>
                    {it.admin_name} · {istDateTime(it.created_at)}
                  </span>
                </div>
              </div>
            ))}
            {expanded && !shown.length && <p className="muted">No activity in this range.</p>}
          </div>
          {expanded && (
            <div className="activityLogFilters">
              <button type="button" className={filter === "all" ? "sel" : ""} onClick={() => setFilter("all")}>
                All
              </button>
              <button type="button" className={filter === "today" ? "sel" : ""} onClick={() => setFilter("today")}>
                Today
              </button>
              <button type="button" className={filter === "7d" ? "sel" : ""} onClick={() => setFilter("7d")}>
                Last 7 days
              </button>
              <input
                type="date"
                value={pickedDate}
                min={sixtyAgo}
                max={today}
                onChange={(e) => {
                  setPickedDate(e.target.value);
                  setFilter("date");
                }}
              />
            </div>
          )}
          <button
            type="button"
            className="btn outline activityLogToggle"
            onClick={() => {
              setExpanded((x) => !x);
              if (expanded) setFilter("all");
            }}
          >
            {expanded ? "Show less" : `Browse all (${items.length})`}
          </button>
          <p className="muted activityLogNote">Times shown in IST. Kept for 60 days, then removed automatically.</p>
        </>
      )}
    </div>
  );
}
function HomepageAdmin({ photos, services, homepage, refresh }: { photos: any[]; services: any[]; homepage: any; refresh: () => void }) {
  const [section, setSection] = useState<"hero" | "strip">("hero");
  return (
    <>
      <div className="modes homepageSectionTabs">
        <button className={section === "hero" ? "sel" : ""} onClick={() => setSection("hero")}>
          Top slideshow
        </button>
        <button className={section === "strip" ? "sel" : ""} onClick={() => setSection("strip")}>
          “Why Classic Steel” section
        </button>
      </div>
      <p className="muted homepageSectionNote">
        {section === "hero"
          ? "The big photos that slide behind your headline at the very top of the homepage."
          : "The text and rotating photos in the “Why Classic Steel” section, just below the top slideshow."}
      </p>
      {section === "hero" && <HeroAdmin photos={homepage.photos || photos} initial={homepage.hero} refresh={refresh} />}
      {section === "strip" && (
        <>
          <AboutTextAdmin initial={homepage.about} refresh={refresh} />
          <StripAdmin photos={homepage.photos || photos} initial={homepage.strip} refresh={refresh} />
        </>
      )}
    </>
  );
}
function Admin() {
  const [user, setUser] = useState<any>(null),
    [tab, setTab] = useState("dashboard"),
    [dash, setDash] = useState<any>(null),
    [photos, setPhotos] = useState<any[]>([]),
    [services, setServices] = useState<any[]>([]),
    [videos, setVideos] = useState<any[]>([]),
    [admins, setAdmins] = useState<any[]>([]),
    [homepage, setHomepage] = useState<any>({
      hero: { count: 4, source: "latest_instagram", photo_ids: [], interval: 7, transition: "normal" },
      gallery: { slots: [], columns: 3 },
      strip: { photo_ids: [] },
      about: { photo_id: null, text: "" },
      photos: [],
    }),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [showLoginPassword, setShowLoginPassword] = useState(false);
  const load = () => {
    api("/api/admin/services")
      .then(setServices)
      .catch(() => {});
    api("/api/admin/photos")
      .then(setPhotos)
      .catch(() => {});
    api("/api/admin/videos")
      .then(setVideos)
      .catch(() => {});
    api("/api/admin/homepage")
      .then(setHomepage)
      .catch(() => {});
    if (user?.role === "owner")
      api("/api/admin/admins")
        .then(setAdmins)
        .catch(() => {});
    api("/api/admin/dashboard")
      .then(setDash)
      .catch(() => {});
  };
  useEffect(() => {
    api("/api/me")
      .then((u) => {
        setUser(u);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (user) load();
  }, [user]);
  if (!user)
    return (
      <>
        <NoticeHost />
        <div className="login">
          <form
            className="panel"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                setUser(await api("/api/login", { method: "POST", body: JSON.stringify({ email, password }) }));
              } catch (e: any) {
                notify(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <small>PRIVATE ADMIN</small>
            <h2>Classic Steel</h2>
            <input
              className="input loginInput"
              autoComplete="username"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="passwordField">
              <input
                className="input loginInput"
                autoComplete="current-password"
                type={showLoginPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="button" className="passwordToggle" onClick={() => setShowLoginPassword((x) => !x)}>
                {showLoginPassword ? "Hide" : "Show"}
              </button>
            </div>
            <button className="btn light" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <a className="muted setupLink" href="/admin/setup">
              First-time Owner setup
            </a>
          </form>
        </div>
      </>
    );
  const tabs: any[] = [
    ["dashboard", "Dashboard", BarChart3],
    ["gallery", "Projects & Curation", FolderOpen],
    ["homepage", "Homepage", Settings],
    ["festivals", "Festivals", Sparkles],
    ["services", "Services", Settings],
    ["videos", "Videos", Play],
    ["testimonials", "Testimonials", Check],
    ...(user.role === "owner" ? [["admins", "Admins", Shield]] : []),
  ];
  return (
    <>
      <NoticeHost />
      <div className="admin">
        <aside>
          <a className="brand" href="/">
            Classic Steel <span>Admin</span>
          </a>
          {tabs.map(([k, n, I]) => (
            <button className={tab === k ? "active" : ""} onClick={() => setTab(k)} key={k}>
              <I size={17} />
              {n}
            </button>
          ))}
          <a className="adminBack" href={PUBLIC_HOST ? `https://${PUBLIC_HOST}/` : "/"}>
            <HomeIcon size={17} />
            Public website
          </a>
          <button
            onClick={async () => {
              await api("/api/logout", { method: "POST" });
              location.reload();
            }}
          >
            <LogOut size={17} />
            Log out
          </button>
        </aside>
        <main className="adminMain">
          <div className="adminTop">
            <div>
              <small>CONTROL CENTER</small>
              <h1>
                {tab === "gallery"
                  ? "Projects & Curation"
                  : tab === "homepage"
                    ? "Homepage"
                    : tab === "services"
                      ? "Services"
                      : tab === "videos"
                        ? "Videos"
                        : tab[0].toUpperCase() + tab.slice(1)}
              </h1>
            </div>
            {tab === "dashboard" && user.name && (
              <span className="dashGreetingInline">
                {istGreeting()}, {String(user.name).trim().split(" ")[0]}
              </span>
            )}
            <div className="adminTopActions">
              <ThemeToggle />
              <span className="pill">{user.role === "owner" ? "Owner" : "Admin"}</span>
            </div>
          </div>
          {tab === "dashboard" && <Dashboard dash={dash} isOwner={user.role === "owner"} name={user.name} />}{" "}
          {tab === "gallery" && <Photos photos={photos} services={services} refresh={load} />}{" "}
          {tab === "homepage" && <HomepageAdmin photos={photos} services={services} homepage={homepage} refresh={load} />}{" "}
          {tab === "services" && <ServicesAdmin services={services} photos={photos} refresh={load} />}{" "}
          {tab === "videos" && <VideosAdmin videos={videos} services={services} refresh={load} />}{" "}
          {tab === "testimonials" && <TestimonialsAdmin />}
          {tab === "festivals" && <FestivalsAdmin photos={photos} refresh={load} />}{" "}
          {tab === "admins" && user.role === "owner" && <AdminsAdmin admins={admins} refresh={load} />}
        </main>
      </div>
    </>
  );
}
// Optional: set these once your domains are live (e.g. "classicsteel.in" and "admin.classicsteel.in").
// Left empty, the whole site (including /admin) works on any hostname.
const PUBLIC_HOST = "";
const ADMIN_HOST_FRONTEND = "";
function PublicRoutes() {
  const p = location.pathname.replace(/\/+$/, "") || "/";
  if (p === "/projects" || p === "/gallery") return <Gallery />;
  if (p === "/contact") return <ContactPage />;
  return <Home />;
}
function App() {
  const host = location.hostname.toLowerCase();
  const isAdminHost = !!ADMIN_HOST_FRONTEND && host === ADMIN_HOST_FRONTEND;
  const isPublicHost = !!PUBLIC_HOST && (host === PUBLIC_HOST || host === `www.${PUBLIC_HOST}`);
  const path = location.pathname.replace(/\/+$/, "");
  if (isAdminHost) {
    if (path === "/admin/setup") return <AdminSetup />;
    if (path === "/admin/invite") return <AdminInviteSetup />;
    return <Admin />;
  }
  if (isPublicHost && location.pathname.startsWith("/admin")) {
    location.replace("/");
    return null;
  }
  if (path === "/admin/setup") return <AdminSetup />;
  if (path === "/admin/invite") return <AdminInviteSetup />;
  if (location.pathname.startsWith("/admin")) return <Admin />;
  return <PublicRoutes />;
}

createRoot(document.getElementById("root")!).render(<App />);
