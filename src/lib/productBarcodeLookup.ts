import { endOfDayMs, type FridgeCategory, type StorageZone } from "./fridgeService";

export type ScanFillResult = {
  name: string;
  category: FridgeCategory;
  unit?: string;
  quantity?: string;
  source: "openfoodfacts" | "qr_text" | "ean_unknown";
  /** Quando a base ou o QR trouxe uma data parseável (fim do dia, ms). */
  expiryTimestampMs?: number;
  /** Sugestão “Onde guarda” a partir de texto de conservação na OFF. */
  storageSuggestion?: StorageZone;
  /** Tipo/categoria legível (ex.: tag PT da Open Food Facts), só informativo. */
  typeLabel?: string;
};

const OFF_TIMEOUT_MS = 12_000;

type OffProduct = {
  product_name?: string;
  product_name_pt?: string;
  generic_name?: string;
  quantity?: string;
  categories_tags?: string[];
  labels_tags?: string[];
  /** Raramente preenchido; formato varia (ISO, DD/MM/AAAA, texto livre). */
  expiration_date?: string;
  best_before_date?: string;
  /** Texto livre (às vezes indica geladeira / congelador). */
  conservation_conditions?: string;
};

/** Primeira categoria legível (prioriza PT). */
function humanReadableOffCategory(tags: string[] | undefined): string | undefined {
  if (!tags?.length) return undefined;
  const pt = tags.find((t) => t.startsWith("pt:"));
  if (pt) return pt.replace(/^pt:/, "").replace(/-/g, " ");
  const en = tags.find((t) => t.startsWith("en:"));
  if (en) return en.replace(/^en:/, "").replace(/-/g, " ");
  return undefined;
}

function inferCategoryFromOffTags(tags: string[] | undefined, labels?: string[] | undefined): FridgeCategory {
  const all = [...(tags ?? []), ...(labels ?? [])];
  if (!all.length) return "outros";
  const joined = all.join(" ").toLowerCase();
  if (/(frozen|ice-cream|frozen-foods|surimi-frozen|congelad|gelado)/.test(joined)) return "congelados";
  if (/(dairy|milk|cheese|yogurt|butter|latic|iogurte|leite|queijo|manteiga)/.test(joined)) {
    return "laticinios";
  }
  if (/(meat|beef|pork|chicken|fish|egg|carn|ovo|frango|carne)/.test(joined)) return "carnes";
  if (/(beverage|drink|juice|soda|bebida|refrigerante|água|agua|café|cafe)/.test(joined)) {
    return "bebidas";
  }
  if (/(cereal|pasta|rice|flour|grain|massa|arroz|feijão|feijao|gra)/.test(joined)) return "graos";
  if (/(snack|sweet|candy|chocolate|biscuit|doce|biscoito)/.test(joined)) return "doces_snacks";
  if (/(vegetable|fruit|plant|vegetables|fruits|frut|legume|hort)/.test(joined)) return "vegetais";
  return "outros";
}

function inferStorageFromOff(
  conservation: string | undefined,
  tagsJoined: string
): StorageZone | undefined {
  const j = `${conservation ?? ""} ${tagsJoined}`.toLowerCase();
  if (/(congel|freezer|geladeira.*congel|frozen)/.test(j)) return "geladeira";
  if (/(refriger|geladeira|frigor|frio|manter.*frio|keep refrigerated|cold chain)/.test(j)) {
    return "geladeira";
  }
  if (/(ambiente|despensa|prateleira|dry|sec|pantry)/.test(j)) return "despensa";
  return undefined;
}

/**
 * Tenta obter validade a partir de strings da OFF (muitos produtos vêm sem data).
 */
function parseExpiryFromOffStrings(...candidates: (string | undefined)[]): number | undefined {
  for (const raw of candidates) {
    const ms = parseHumanExpiryDate(raw);
    if (ms != null) return ms;
  }
  return undefined;
}

function parseHumanExpiryDate(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  if (/^\d+\s*(month|year|day|semaine|mois|mes|dia|ano)/i.test(s)) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!Number.isNaN(d.getTime())) return endOfDayMs(d.getTime());
  }
  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    let year = Number(br[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, month - 1, day);
    if (!Number.isNaN(d.getTime()) && year > 1990) return endOfDayMs(d.getTime());
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return endOfDayMs(t);
  return null;
}

function pickNameFromProduct(p: OffProduct): string {
  const namePt = p.product_name_pt?.trim();
  const name = p.product_name?.trim();
  const gen = typeof p.generic_name === "string" ? p.generic_name.trim() : "";
  return namePt || name || gen || "";
}

function parseQtyString(q: string | undefined): { qty?: string; unit?: string } {
  if (!q?.trim()) return {};
  const m = q.trim().match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Zà-úÀ-Ú]+)\s*$/);
  if (m) {
    return { qty: m[1].replace(",", "."), unit: m[2].toLowerCase() };
  }
  return {};
}

/** Extrai sequência numérica típica de EAN/UPC (8 a 14 dígitos). */
export function extractPrimaryDigitSequence(raw: string): string | null {
  const matches = raw.match(/\d{8,14}/g);
  if (!matches?.length) return null;
  return matches.reduce((a, b) => (a.length >= b.length ? a : b));
}

export async function fetchOpenFoodFactsProduct(barcode: string): Promise<ScanFillResult | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), OFF_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
      { signal: ctrl.signal, headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { status?: number; product?: OffProduct };
    if (json.status !== 1 || !json.product) return null;
    const p = json.product;
    const name = pickNameFromProduct(p);
    if (!name) return null;
    const tagsJoined = (p.categories_tags ?? []).join(" ");
    const category = inferCategoryFromOffTags(p.categories_tags, p.labels_tags);
    const { qty, unit } = parseQtyString(p.quantity);
    const expiryTimestampMs = parseExpiryFromOffStrings(p.expiration_date, p.best_before_date);
    const storageSuggestion = inferStorageFromOff(p.conservation_conditions, tagsJoined);
    const typeLabel = humanReadableOffCategory(p.categories_tags);

    return {
      name,
      category,
      unit: unit ?? "unid",
      quantity: qty,
      source: "openfoodfacts",
      ...(expiryTimestampMs != null ? { expiryTimestampMs } : {}),
      ...(storageSuggestion != null ? { storageSuggestion } : {}),
      ...(typeLabel != null ? { typeLabel } : {}),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function mapLooseCategoryToFridge(c: unknown): FridgeCategory | undefined {
  if (typeof c !== "string") return undefined;
  const x = c.toLowerCase();
  if (/(latic|leite|queijo|iogurte|dairy|milk|cheese)/.test(x)) return "laticinios";
  if (/(veget|frut|hort|legume|salad)/.test(x)) return "vegetais";
  if (/(congel|frozen|gelad)/.test(x)) return "congelados";
  if (/(carn|carne|ovo|meat)/.test(x)) return "carnes";
  if (/(bebida|drink|água|agua)/.test(x)) return "bebidas";
  if (/(grão|graos|massa|arroz|feij)/.test(x)) return "graos";
  if (/(doce|snack|bisco)/.test(x)) return "doces_snacks";
  if (/(outro|other|misc)/.test(x)) return "outros";
  return undefined;
}

function parseQrOrPlainText(data: string): ScanFillResult {
  const trimmed = data.trim();
  try {
    const j = JSON.parse(trimmed) as Record<string, unknown>;
    const name =
      (typeof j.name === "string" && j.name) ||
      (typeof j.nome === "string" && j.nome) ||
      (typeof j.product === "string" && j.product) ||
      "";
    if (name.trim()) {
      const catRaw = j.categoria ?? j.category ?? j.tipo;
      const category = mapLooseCategoryToFridge(catRaw) ?? "outros";
      const validade =
        typeof j.validade === "string"
          ? j.validade
          : typeof j.expiry === "string"
            ? j.expiry
            : typeof j.expiryDate === "string"
              ? j.expiryDate
              : undefined;
      const expiryMs =
        typeof j.expiryTimestampMs === "number"
          ? endOfDayMs(j.expiryTimestampMs)
          : parseHumanExpiryDate(validade) ?? undefined;
      const storageRaw = j.storage ?? j.guardar ?? j.local;
      const storageSuggestion =
        typeof storageRaw === "string"
          ? mapLooseStorageToZone(storageRaw)
          : undefined;

      return {
        name: name.trim().slice(0, 200),
        category,
        source: "qr_text",
        ...(expiryMs != null ? { expiryTimestampMs: expiryMs } : {}),
        ...(storageSuggestion != null ? { storageSuggestion } : {}),
        ...(typeof j.typeLabel === "string" ? { typeLabel: j.typeLabel.slice(0, 120) } : {}),
      };
    }
  } catch {
    /* not JSON */
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      const nameParam =
        u.searchParams.get("name") || u.searchParams.get("nome") || u.searchParams.get("q");
      if (nameParam) {
        return {
          name: decodeURIComponent(nameParam).slice(0, 200),
          category: "outros",
          source: "qr_text",
        };
      }
      const parts = u.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && last.length > 2 && !/^\d+$/.test(last)) {
        return {
          name: decodeURIComponent(last.replace(/[-_+]/g, " ")).slice(0, 200),
          category: "outros",
          source: "qr_text",
        };
      }
    } catch {
      /* ignore */
    }
  }
  const firstLine = trimmed.split(/[\r\n]+/)[0]?.trim() ?? "";
  return {
    name: (firstLine || trimmed || "Item").slice(0, 200),
    category: "outros",
    source: "qr_text",
  };
}

function mapLooseStorageToZone(s: string): StorageZone | undefined {
  const x = s.toLowerCase();
  if (/(geladeira|frigo|refriger|frio)/.test(x)) return "geladeira";
  if (/(despensa|arm[aá]rio|prateleira|seco)/.test(x)) return "despensa";
  if (/(freezer|congel)/.test(x)) return "geladeira";
  return undefined;
}

/**
 * Código de barras: tenta Open Food Facts (alimentos).
 * QR: URL/texto/JSON simples; se o payload for só dígitos (GTIN), também consulta OFF.
 */
export async function resolveScanToProduct(data: string, barcodeType: string): Promise<ScanFillResult> {
  const trimmed = data.trim();
  const typeLower = barcodeType.toLowerCase();
  const isQrLike = typeLower === "qr" || typeLower === "datamatrix" || typeLower === "pdf417";
  const digits = extractPrimaryDigitSequence(trimmed);

  if (isQrLike && /^https?:\/\//i.test(trimmed)) {
    return parseQrOrPlainText(trimmed);
  }

  if (digits && digits.length >= 8 && digits.length <= 14) {
    const found = await fetchOpenFoodFactsProduct(digits);
    if (found) return found;
    if (!isQrLike) {
      return {
        name: `Produto ${digits}`,
        category: "outros",
        source: "ean_unknown",
      };
    }
  }

  if (isQrLike) {
    return parseQrOrPlainText(trimmed);
  }

  return {
    name: trimmed.slice(0, 200) || "Item",
    category: "outros",
    source: "ean_unknown",
  };
}
