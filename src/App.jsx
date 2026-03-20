import { useState, useCallback } from "react";

// ── Helpers ───────────────────────────────────────────────────────

function fmt(n, unit = "") {
  if (n == null || isNaN(Number(n))) return "—";
  n = Number(n);
  if (unit === "cr")   return "₹" + n.toFixed(0) + " Cr";
  if (unit === "usdm") return "$" + n.toFixed(1) + "M";
  if (n >= 1_000_000)  return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)      return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function fmtRev(value, currency) {
  if (!value) return "—";
  if (currency?.includes("Cr")) return "₹" + value + " Cr";
  if (currency?.includes("USD")) return "$" + value + "M";
  return "₹" + value + " Cr";
}

function confColor(c) {
  if (!c) return "#6b7280";
  if (c === "High")   return "#34d399";
  if (c === "Medium") return "#fbbf24";
  return "#f87171";
}

function growthColor(g) {
  if (g == null) return "#94a3b8";
  if (g > 50) return "#34d399";
  if (g > 20) return "#fbbf24";
  return "#f87171";
}

// ── API calls ─────────────────────────────────────────────────────

async function callAPI(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

// ── UI primitives ─────────────────────────────────────────────────

function Pill({ label, value, color = "#94a3b8", sub }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "13px 16px", flex: 1, minWidth: "130px" }}>
      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: 700, marginBottom: "5px" }}>{label}</div>
      <div style={{ fontSize: "19px", fontWeight: 800, color, letterSpacing: "-0.4px", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "3px" }}>{sub}</div>}
    </div>
  );
}

function Row({ label, value, sub, accent, conf }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", gap: "12px" }}>
      <span style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.42)", flex: 1 }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: "13px", fontWeight: 700, color: accent ? "#34d399" : "#e2e8f0" }}>{value}</span>
        {sub && <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.28)", marginTop: "1px" }}>{sub}</div>}
      </div>
      {conf && <div style={{ width: 6, height: 6, borderRadius: "50%", background: confColor(conf), flexShrink: 0, marginTop: "5px" }} title={conf + " confidence"} />}
    </div>
  );
}

function SectionHead({ label }) {
  return <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: 700, marginBottom: "10px", marginTop: "4px" }}>{label}</p>;
}

function Shimmer({ message }) {
  return (
    <div>
      {message && (
        <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "12px", padding: "10px 14px", background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.12)", borderRadius: "9px" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", animation: "pulse 1s infinite", flexShrink: 0 }} />
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>{message}</span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
        {[60, 80, 50, 70, 90].map((h, i) => (
          <div key={i} style={{ height: h + "px", borderRadius: "10px", background: "rgba(255,255,255,0.035)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)", animation: "sweep 1.5s ease infinite", animationDelay: `${i * 0.1}s` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Store Map Panel ───────────────────────────────────────────────

function StoresPanel({ brand, country }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [maxPg,   setMaxPg]   = useState(3);

  const run = async () => {
    setLoading(true); setError(null); setData(null);
    try {
      const result = await callAPI("/api/stores", { brand, country, maxPages: maxPg });
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "18px", background: "rgba(99,179,237,0.04)", border: "1px solid rgba(99,179,237,0.12)", borderRadius: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#63b3ed", marginBottom: "2px" }}>🗺️ Store Count — Live Search</div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
            Searches for "{brand}" locations in {country} via TomTom (free) or OpenStreetMap
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select value={maxPg} onChange={e => setMaxPg(Number(e.target.value))} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: "7px", padding: "5px 8px", fontSize: "11px", fontFamily: "inherit" }}>
            <option value={1}>Quick (20 results)</option>
            <option value={3}>Standard (60 results)</option>
            <option value={5}>Deep (100 results)</option>
          </select>
          <button onClick={run} disabled={loading} style={{
            padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
            background: "rgba(99,179,237,0.12)", border: "1px solid rgba(99,179,237,0.25)",
            color: loading ? "rgba(255,255,255,0.2)" : "#63b3ed",
          }}>{loading ? "Searching…" : "Count Stores"}</button>
        </div>
      </div>

      {loading && <Shimmer message="Searching for store locations…" />}
      {error && <div style={{ fontSize: "12px", color: "#f87171", padding: "10px 14px", background: "rgba(248,113,113,0.08)", borderRadius: "8px" }}>⚠️ {error}</div>}

      {data && (
        <div style={{ animation: "fadeIn .3s ease" }}>
          {/* Source badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", padding: "2px 9px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)" }}>
              via {data.source}
            </span>
            {!data.hasTomTomKey && (
              <span style={{ fontSize: "10px", color: "rgba(251,191,36,0.7)", background: "rgba(251,191,36,0.07)", padding: "2px 9px", borderRadius: "10px", border: "1px solid rgba(251,191,36,0.15)" }}>
                💡 Add TOMTOM_KEY for better results (free at developer.tomtom.com)
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
            <Pill label="Stores Found" value={data.estimatedTotal}   color="#63b3ed" sub={`${data.source} data`} />
            <Pill label="Cities"       value={data.cityCount ?? "—"} color="#63b3ed" sub="unique cities" />
            {data.states?.length > 0 && <Pill label="States / Regions" value={data.states.length} color="#63b3ed" />}
          </div>

          {data.cities?.length > 0 && (
            <div style={{ marginBottom: "12px" }}>
              <SectionHead label="Cities Detected" />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {data.cities.map((c, i) => (
                  <span key={i} style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.05)", padding: "3px 10px", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.07)" }}>{c}</span>
                ))}
              </div>
            </div>
          )}

          {data.stores?.length > 0 && (
            <div>
              <SectionHead label={`Store List (${data.stores.length} shown)`} />
              <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                {data.stores.map((s, i) => (
                  <div key={i} style={{ padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: "7px", fontSize: "11.5px", color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.address}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: "10px", fontSize: "10.5px", color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>
            Note: Results may include franchise/distributor outlets. Cross-check with the brand's official store locator for EBO-only counts.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Traffic Panel ─────────────────────────────────────────────────

function TrafficPanel({ brand, domain, industry }) {
  const [aov,     setAov]     = useState("");
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const run = async () => {
    setLoading(true); setError(null); setData(null);
    try {
      const result = await callAPI("/api/traffic", { brand, domain, industry, avgOrderValue: Number(aov) || null });
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "18px", background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.12)", borderRadius: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#a78bfa", marginBottom: "2px" }}>📊 Online Sales Velocity</div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>Web traffic → conversion → GMV estimate via Similarweb + Claude</div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "7px", overflow: "hidden" }}>
            <span style={{ padding: "0 8px", fontSize: "11px", color: "rgba(255,255,255,0.3)", borderRight: "1px solid rgba(255,255,255,0.08)" }}>₹ AOV</span>
            <input value={aov} onChange={e => setAov(e.target.value)} placeholder="e.g. 6500" style={{ background: "none", border: "none", color: "#fff", fontSize: "12px", fontFamily: "inherit", padding: "6px 10px", width: "90px" }} />
          </div>
          <button onClick={run} disabled={loading} style={{
            padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
            background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)",
            color: loading ? "rgba(255,255,255,0.2)" : "#a78bfa",
          }}>{loading ? "Analysing…" : "Analyse Traffic"}</button>
        </div>
      </div>

      {loading && <Shimmer message="Searching Similarweb, Amazon, and web for traffic and sales data…" />}
      {error && <div style={{ fontSize: "12px", color: "#f87171", padding: "10px 14px", background: "rgba(248,113,113,0.08)", borderRadius: "8px" }}>⚠️ {error}</div>}

      {data && (
        <div style={{ animation: "fadeIn .3s ease" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
            <Pill label="Monthly Visits"     value={fmt(data.webTraffic?.monthlyVisits)} color="#a78bfa" sub={data.webTraffic?.source} />
            <Pill label="India Rank"         value={data.webTraffic?.indiaRank ? "#" + fmt(data.webTraffic.indiaRank) : "—"} color="#a78bfa" sub="Similarweb rank" />
            <Pill label="Monthly GMV Est."   value={data.salesVelocity?.estimatedMonthlyGMV ? "₹" + fmt(data.salesVelocity.estimatedMonthlyGMV) : "—"} color="#34d399" sub="estimated" />
            <Pill label="Annual Online Rev." value={data.salesVelocity?.estimatedAnnualOnlineRevenue ? "₹" + data.salesVelocity.estimatedAnnualOnlineRevenue + " Cr" : "—"} color="#34d399" sub={data.salesVelocity?.method?.slice(0, 40)} />
          </div>

          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <SectionHead label="Online Channels" />
              {data.onlinePresence?.channels?.map((c, i) => (
                <div key={i} style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "4px" }}>· {c}</div>
              ))}
              {data.onlinePresence?.hasApp && (
                <div style={{ fontSize: "12px", color: "#a78bfa", marginTop: "6px" }}>
                  📱 App available {data.onlinePresence.appRating ? `· ★ ${data.onlinePresence.appRating}` : ""}
                </div>
              )}
              {data.onlinePresence?.amazonReviews && (
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>
                  Amazon: {fmt(data.onlinePresence.amazonReviews)} reviews
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <SectionHead label="Sales Model" />
              <Row label="Conv. Rate (est.)"  value={data.salesVelocity?.estimatedConversionRate ? data.salesVelocity.estimatedConversionRate + "%" : "—"} />
              <Row label="Monthly Orders"     value={fmt(data.salesVelocity?.estimatedMonthlyOrders)} />
              <Row label="Avg Order Value"    value={data.salesVelocity?.avgOrderValue ? "₹" + fmt(data.salesVelocity.avgOrderValue) : "—"} />
              <Row label="Online % of Rev."   value={data.onlineShareOfTotal ? data.onlineShareOfTotal + "%" : "—"} />
            </div>
          </div>

          {data.analystNote && (
            <div style={{ marginTop: "12px", padding: "11px 14px", background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.14)", borderRadius: "9px", fontSize: "12.5px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6, fontStyle: "italic" }}>
              💡 {data.analystNote}
            </div>
          )}

          <div style={{ marginTop: "8px", fontSize: "10.5px", color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>
            Traffic and conversion figures are estimates. Confidence improves if domain and AOV are provided.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Estimate Panel ────────────────────────────────────────────────

function EstimatePanel({ brand, researchData }) {
  const retail = researchData?.retail;
  const [ass, setAss] = useState({
    storeCount:          retail?.totalStores ?? "",
    revenuePerStoreLow:  retail?.revenuePerStore?.value ? String(Math.max(1, retail.revenuePerStore.value * 0.7)) : "2",
    revenuePerStoreHigh: retail?.revenuePerStore?.value ? String(retail.revenuePerStore.value * 1.3) : "5",
    onlineReviews:       researchData?.online?.amazonReviews ?? "",
    reviewsPerUnit:      "100",
    avgPrice:            "",
    onlineChannels:      researchData?.online?.channels?.join(", ") ?? "website, Amazon, Flipkart",
    storeTypes:          retail?.storeTypes ?? "EBO",
    industryContext:     researchData?.industry ?? "retail",
  });
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const upd = (k, v) => setAss(p => ({ ...p, [k]: v }));

  const run = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const result = await callAPI("/api/estimate", {
        brand,
        assumptions: {
          ...ass,
          storeCount:          Number(ass.storeCount)          || null,
          revenuePerStoreLow:  Number(ass.revenuePerStoreLow)  || null,
          revenuePerStoreHigh: Number(ass.revenuePerStoreHigh) || null,
          onlineReviews:       Number(ass.onlineReviews)       || null,
          reviewsPerUnit:      Number(ass.reviewsPerUnit)      || 100,
          avgPrice:            Number(ass.avgPrice)            || null,
        },
      });
      setResult(result);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const F = ({ label, field, ph, prefix }) => (
    <div style={{ flex: 1, minWidth: "150px" }}>
      <label style={{ fontSize: "10px", color: "rgba(255,255,255,0.33)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, display: "block", marginBottom: "5px" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "7px", overflow: "hidden" }}>
        {prefix && <span style={{ padding: "0 8px", fontSize: "11px", color: "rgba(255,255,255,0.28)", borderRight: "1px solid rgba(255,255,255,0.07)" }}>{prefix}</span>}
        <input value={ass[field]} onChange={e => upd(field, e.target.value)} placeholder={ph}
          style={{ flex: 1, background: "none", border: "none", color: "#fff", fontSize: "12.5px", fontFamily: "inherit", padding: "8px 10px" }} />
      </div>
    </div>
  );

  return (
    <div style={{ padding: "18px", background: "rgba(251,191,36,0.03)", border: "1px solid rgba(251,191,36,0.12)", borderRadius: "14px" }}>
      <div style={{ fontSize: "13px", fontWeight: 700, color: "#fbbf24", marginBottom: "3px" }}>📐 Revenue Estimator</div>
      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "16px" }}>Proxy model: stores × revenue/store + reviews × units × price</div>

      <div style={{ marginBottom: "14px" }}>
        <div style={{ fontSize: "10px", color: "rgba(99,179,237,0.7)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: "8px" }}>🏪 Offline</div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <F label="Stores"              field="storeCount"          ph="e.g. 28" />
          <F label="Rev/Store Low (Cr)"  field="revenuePerStoreLow"  ph="e.g. 2"  prefix="₹Cr" />
          <F label="Rev/Store High (Cr)" field="revenuePerStoreHigh" ph="e.g. 5"  prefix="₹Cr" />
          <F label="Store Types"         field="storeTypes"          ph="EBO / MBO" />
        </div>
      </div>
      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "10px", color: "rgba(167,139,250,0.7)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: "8px" }}>🛒 Online</div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <F label="Total Reviews"  field="onlineReviews"  ph="e.g. 12000" />
          <F label="Units/Review"   field="reviewsPerUnit" ph="e.g. 100" />
          <F label="Avg Price (₹)"  field="avgPrice"       ph="e.g. 6500" prefix="₹" />
          <F label="Channels"       field="onlineChannels" ph="website, Amazon…" />
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <button onClick={run} disabled={loading} style={{
          padding: "10px 20px", borderRadius: "9px", fontSize: "13px", fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
          background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)",
          color: loading ? "rgba(255,255,255,0.2)" : "#fbbf24",
        }}>{loading ? "Running…" : "Run Estimate"}</button>
        {error && <span style={{ fontSize: "12px", color: "#f87171" }}>⚠️ {error}</span>}
      </div>

      {result && (
        <div style={{ marginTop: "20px", animation: "fadeIn .3s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <span style={{ fontSize: "14px", fontWeight: 700 }}>Result</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: confColor(result.confidence) }} />
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{result.confidence} — {result.confidenceReason}</span>
            </div>
          </div>

          {/* Revenue summary */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
            {result.estimatedRevenue?.offlineMid != null && (
              <Pill label="Offline Est." value={"₹" + result.estimatedRevenue.offlineMid + " Cr"} color="#63b3ed" sub={`₹${result.estimatedRevenue.offlineMin}–${result.estimatedRevenue.offlineMax} Cr range`} />
            )}
            {result.estimatedRevenue?.onlineMid != null && (
              <Pill label="Online Est." value={"₹" + result.estimatedRevenue.onlineMid + " Cr"} color="#a78bfa" sub={`₹${result.estimatedRevenue.onlineMin}–${result.estimatedRevenue.onlineMax} Cr range`} />
            )}
            <Pill label="Total Est." value={"₹" + result.estimatedRevenue?.totalMid + " Cr"} color="#34d399"
              sub={`₹${result.estimatedRevenue?.totalMin}–${result.estimatedRevenue?.totalMax} Cr range`} />
          </div>

          {result.keyAssumptions?.length > 0 && (
            <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "9px", marginBottom: "10px" }}>
              <SectionHead label="Key Assumptions" />
              {result.keyAssumptions.map((a, i) => <div key={i} style={{ fontSize: "12px", color: "rgba(255,255,255,0.42)", marginBottom: "3px" }}>· {a}</div>)}
            </div>
          )}

          {result.benchmarks?.length > 0 && (
            <div style={{ padding: "12px 14px", background: "rgba(99,179,237,0.04)", border: "1px solid rgba(99,179,237,0.1)", borderRadius: "9px", marginBottom: "10px" }}>
              <SectionHead label="Benchmarks Used" />
              {result.benchmarks.map((b, i) => (
                <div key={i} style={{ fontSize: "12px", color: "rgba(255,255,255,0.42)", marginBottom: "4px" }}>
                  <strong style={{ color: "#fff" }}>{b.reference}</strong>: {b.revenue} — {b.context}
                </div>
              ))}
            </div>
          )}

          {result.analystNote && (
            <div style={{ padding: "11px 14px", background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.1)", borderRadius: "9px", fontSize: "12.5px", color: "rgba(255,255,255,0.5)", lineHeight: 1.65, fontStyle: "italic" }}>
              💡 {result.analystNote}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── CompetitorDiscovery ───────────────────────────────────────────

const THREAT_COLOR = { High: "#f87171", Medium: "#fbbf24", Low: "#34d399" };
const TYPE_COLOR   = { Direct: "#ff6b6b", Indirect: "#63b3ed", Emerging: "#a78bfa" };

function CompetitorDiscovery({ brand, industry, country, onResearch, trackedBrands }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [done,    setDone]    = useState(false);

  const discover = async () => {
    setLoading(true); setError(null);
    try {
      const result = await callAPI("/api/competitors", { brand, industry, country });
      setData(result);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!done && !loading) {
    return (
      <div style={{ padding: "18px", background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.14)", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#fbbf24", marginBottom: "3px" }}>🔭 Competitor Landscape</div>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>Discover who {brand} competes with — direct, indirect, and emerging threats</div>
        </div>
        <button onClick={discover} style={{
          padding: "9px 20px", borderRadius: "9px", fontSize: "12.5px", fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
          background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.28)", color: "#fbbf24",
        }}>Discover Competitors →</button>
      </div>
    );
  }

  if (loading) {
    return <Shimmer message={`Mapping the competitor landscape for ${brand}…`} />;
  }

  if (error) {
    return (
      <div style={{ padding: "12px 15px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.18)", borderRadius: "9px", color: "#fca5a5", fontSize: "12.5px" }}>
        ⚠️ {error} — <button onClick={discover} style={{ background: "none", border: "none", color: "#63b3ed", cursor: "pointer", fontFamily: "inherit", fontSize: "12px" }}>retry</button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      {/* Landscape summary */}
      {data.competitorLandscape && (
        <div style={{ padding: "13px 16px", background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.14)", borderRadius: "11px", marginBottom: "16px", fontSize: "13px", color: "rgba(255,255,255,0.55)", lineHeight: 1.65 }}>
          <span style={{ color: "#fbbf24", fontWeight: 700, marginRight: "6px" }}>🗺️ Landscape:</span>
          {data.competitorLandscape}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
        {Object.entries(TYPE_COLOR).map(([type, color]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: 8, height: 8, borderRadius: "2px", background: color + "40", border: `1px solid ${color}` }} />
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{type} Competitor</span>
          </div>
        ))}
        <div style={{ marginLeft: "auto", fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>Click any card to research → </div>
      </div>

      {/* Competitor cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
        {data.competitors?.map((comp, i) => {
          const typeColor   = TYPE_COLOR[comp.type]   ?? "#94a3b8";
          const threatColor = THREAT_COLOR[comp.threat] ?? "#94a3b8";
          const alreadyTracked = !!trackedBrands[comp.name];

          return (
            <div
              key={i}
              onClick={() => !alreadyTracked && onResearch(comp.name, data.industry, country)}
              style={{
                position: "relative",
                background: alreadyTracked ? "rgba(52,211,153,0.05)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${alreadyTracked ? "rgba(52,211,153,0.25)" : typeColor + "30"}`,
                borderRadius: "13px",
                padding: "15px 16px",
                cursor: alreadyTracked ? "default" : "pointer",
                transition: "all .18s",
              }}
              onMouseEnter={e => { if (!alreadyTracked) { e.currentTarget.style.background = typeColor + "10"; e.currentTarget.style.borderColor = typeColor + "50"; e.currentTarget.style.transform = "translateY(-1px)"; }}}
              onMouseLeave={e => { if (!alreadyTracked) { e.currentTarget.style.background = "rgba(255,255,255,0.025)"; e.currentTarget.style.borderColor = typeColor + "30"; e.currentTarget.style.transform = "translateY(0)"; }}}
            >
              {/* Type badge */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <span style={{ fontSize: "9px", fontWeight: 700, color: typeColor, background: typeColor + "18", padding: "2px 8px", borderRadius: "10px", letterSpacing: "0.8px", textTransform: "uppercase" }}>{comp.type}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: threatColor }} title={`${comp.threat} threat`} />
                  <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.8px" }}>{comp.threat} threat</span>
                </div>
              </div>

              {/* Name + domain */}
              <div style={{ marginBottom: "8px" }}>
                <div style={{ fontSize: "15px", fontWeight: 800, color: "#fff", marginBottom: "2px", letterSpacing: "-0.3px" }}>{comp.name}</div>
                {comp.domain && <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.3)" }}>{comp.domain}</div>}
              </div>

              {/* Key stats */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
                {comp.estimatedRevenue && comp.estimatedRevenue !== "Unknown" && (
                  <div style={{ fontSize: "10.5px", color: "#34d399", background: "rgba(52,211,153,0.08)", padding: "2px 8px", borderRadius: "6px" }}>
                    {comp.estimatedRevenue}
                  </div>
                )}
                {comp.estimatedFunding && comp.estimatedFunding !== "Unknown" && (
                  <div style={{ fontSize: "10.5px", color: "#a78bfa", background: "rgba(167,139,250,0.08)", padding: "2px 8px", borderRadius: "6px" }}>
                    {comp.estimatedFunding}
                  </div>
                )}
                {comp.storeCount != null && (
                  <div style={{ fontSize: "10.5px", color: "#63b3ed", background: "rgba(99,179,237,0.08)", padding: "2px 8px", borderRadius: "6px" }}>
                    {comp.storeCount} stores
                  </div>
                )}
              </div>

              {/* Differentiator */}
              <p style={{ margin: "0 0 8px", fontSize: "11.5px", color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>{comp.keyDifferentiator}</p>

              {/* Threat reason */}
              {comp.threatReason && (
                <p style={{ margin: 0, fontSize: "10.5px", color: `${threatColor}99`, lineHeight: 1.4, fontStyle: "italic" }}>{comp.threatReason}</p>
              )}

              {/* CTA or tracked badge */}
              <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {alreadyTracked ? (
                  <span style={{ fontSize: "10.5px", color: "#34d399", fontWeight: 700 }}>✓ Already researched</span>
                ) : (
                  <span style={{ fontSize: "10.5px", color: typeColor, fontWeight: 600 }}>Click to research →</span>
                )}
                {comp.positioning && (
                  <span style={{ fontSize: "9.5px", color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: "6px" }}>{comp.positioning}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Brand Report ──────────────────────────────────────────────────

const TABS = [
  { id: "overview",     label: "📊 Overview" },
  { id: "financial",    label: "💰 Financials" },
  { id: "stores",       label: "🗺️ Stores" },
  { id: "online",       label: "📈 Online" },
  { id: "competitors",  label: "🔭 Competitors" },
  { id: "estimate",     label: "📐 Estimator" },
  { id: "news",         label: "📰 News" },
];

function BrandReport({ data, onClose, onResearch, trackedBrands }) {
  const [tab, setTab] = useState("overview");
  const { financials, funding, retail, online, employees, recentNews, statedGoals, dataGaps, analystNote, dataQuality } = data;
  const rev  = financials?.latestRevenue;
  const prev = financials?.previousRevenue;

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "22px", animation: "fadeIn .3s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px", textTransform: "uppercase" }}>{data.country} · {data.industry}</span>
            {dataQuality && (
              <span style={{ fontSize: "9px", fontWeight: 700, color: confColor(dataQuality === "Good" ? "High" : dataQuality === "Fair" ? "Medium" : "Low"), background: "rgba(255,255,255,0.06)", padding: "1px 7px", borderRadius: "10px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                {dataQuality} data
              </span>
            )}
          </div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.7px", margin: 0 }}>{data.brand}</h2>
          {data.legalName && data.legalName !== data.brand && (
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>{data.legalName}</div>
          )}
          {analystNote && <p style={{ margin: "8px 0 0", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6, maxWidth: "540px", fontStyle: "italic" }}>"{analystNote}"</p>}
        </div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.45)", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit" }}>✕ Close</button>
      </div>

      {/* Quick pills */}
      <div style={{ display: "flex", gap: "9px", flexWrap: "wrap", marginBottom: "20px" }}>
        <Pill icon="💰" label="Revenue"      value={rev?.value ? fmtRev(rev.value, rev.currency) : "—"} sub={rev?.period}    color="#34d399" />
        <Pill icon="📈" label="YoY Growth"   value={financials?.revenueGrowth != null ? financials.revenueGrowth + "%" : "—"} color={growthColor(financials?.revenueGrowth)} sub={prev?.value ? `prev: ${fmtRev(prev.value, prev.currency)}` : undefined} />
        <Pill icon="🏪" label="Stores"       value={retail?.totalStores ?? "—"}    sub={retail?.storeTypes}                  color="#63b3ed" />
        <Pill icon="🚀" label="Funding"      value={funding?.totalRaised?.value ? fmtRev(funding.totalRaised.value, funding.totalRaised.currency) : "—"} sub={funding?.latestRound?.type} color="#a78bfa" />
        <Pill icon="👥" label="Employees"    value={employees?.count ?? "—"}        sub={employees?.source}                   color="#fb923c" />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "2px", marginBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0", overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 13px", borderRadius: "8px 8px 0 0", fontSize: "12px",
            fontWeight: tab === t.id ? 700 : 500, cursor: "pointer", fontFamily: "inherit",
            whiteSpace: "nowrap", transition: "all .15s",
            background: tab === t.id ? "rgba(52,211,153,0.08)" : "transparent",
            border: "none",
            borderBottom: `2px solid ${tab === t.id ? "#34d399" : "transparent"}`,
            color: tab === t.id ? "#fff" : "rgba(255,255,255,0.38)",
          }}>{t.label}</button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", animation: "fadeIn .2s ease" }}>
          <div style={{ flex: 1, minWidth: "220px" }}>
            <SectionHead label="Financial Snapshot" />
            <Row label="Revenue (latest)"    value={rev?.value ? fmtRev(rev.value, rev.currency) : "—"}      conf={rev?.confidence} accent />
            <Row label="Revenue growth"      value={financials?.revenueGrowth != null ? financials.revenueGrowth + "%" : "—"} accent={financials?.revenueGrowth > 30} />
            <Row label="Tofler range"         value={financials?.toflerRevenueRange ?? "—"} sub="from public RoC data" />
            <Row label="EBITDA margin"        value={financials?.ebitdaMargin != null ? financials.ebitdaMargin + "%" : "—"} />
            <Row label="Profitability"        value={financials?.profitStatus ?? "—"} />
            <Row label="Stores"              value={retail?.totalStores ?? "—"} />
            <Row label="Funding raised"       value={funding?.totalRaised?.value ? fmtRev(funding.totalRaised.value, funding.totalRaised.currency) : "—"} />
            <Row label="Online channels"      value={online?.channels?.slice(0,3).join(", ") ?? "—"} />
          </div>
          <div style={{ flex: 1, minWidth: "220px" }}>
            <SectionHead label="Stated Goals" />
            <div style={{ padding: "13px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", fontSize: "12.5px", color: "rgba(255,255,255,0.5)", lineHeight: 1.65, marginBottom: "12px" }}>
              {statedGoals || "No public goals found"}
            </div>
            {dataGaps?.length > 0 && (
              <div style={{ padding: "10px 13px", background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.13)", borderRadius: "9px" }}>
                <div style={{ fontSize: "10px", color: "rgba(251,191,36,0.7)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>⚠️ Data Gaps</div>
                {dataGaps.map((g, i) => <div key={i} style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.38)", marginBottom: "2px" }}>· {g}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FINANCIALS */}
      {tab === "financial" && (
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", animation: "fadeIn .2s ease" }}>
          <div style={{ flex: 1, minWidth: "220px", padding: "16px", background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.1)", borderRadius: "12px" }}>
            <SectionHead label="Revenue" />
            <Row label={rev?.period ?? "Latest"}     value={rev?.value ? fmtRev(rev.value, rev.currency) : "—"} conf={rev?.confidence} accent />
            <Row label={prev?.period ?? "Previous"}  value={prev?.value ? fmtRev(prev.value, prev.currency) : "—"} />
            <Row label="YoY Growth"                  value={financials?.revenueGrowth != null ? financials.revenueGrowth + "%" : "—"} accent={financials?.revenueGrowth > 30} />
            <Row label="Tofler RoC Range"             value={financials?.toflerRevenueRange ?? "—"} sub="public MCA filing" />
            <Row label="EBITDA Margin"               value={financials?.ebitdaMargin != null ? financials.ebitdaMargin + "%" : "—"} />
            <Row label="Profit Status"               value={financials?.profitStatus ?? "—"} />
            {financials?.burnRate && <Row label="Burn Rate" value={financials.burnRate} />}
            <div style={{ marginTop: "10px", fontSize: "10.5px", color: "rgba(255,255,255,0.22)", fontStyle: "italic" }}>Source: {rev?.source ?? "Multiple"}</div>
          </div>
          <div style={{ flex: 1, minWidth: "220px", padding: "16px", background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.1)", borderRadius: "12px" }}>
            <SectionHead label="Funding" />
            <Row label="Total Raised"     value={funding?.totalRaised?.value ? fmtRev(funding.totalRaised.value, funding.totalRaised.currency) : "—"} accent />
            <Row label="Latest Round"     value={funding?.latestRound?.type ?? "—"} sub={funding?.latestRound?.date} />
            <Row label="Round Size"       value={funding?.latestRound?.amount ? fmtRev(funding.latestRound.amount, "USD M") : "—"} />
            <Row label="Lead Investor"    value={funding?.latestRound?.leadInvestor ?? "—"} />
            <Row label="Valuation"        value={funding?.valuation?.value ? fmtRev(funding.valuation.value, funding.valuation.currency) : "—"} sub={funding?.valuation?.asOf} />
            <Row label="Listed"           value={funding?.isPubliclyListed ? "Yes " + (funding.stockSymbol ?? "") : "No — private"} />
            {funding?.keyInvestors?.length > 0 && (
              <div style={{ marginTop: "10px" }}>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>Investors</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {funding.keyInvestors.map((inv, i) => (
                    <span key={i} style={{ fontSize: "11px", color: "#c4b5fd", background: "rgba(167,139,250,0.08)", padding: "3px 9px", borderRadius: "20px", border: "1px solid rgba(167,139,250,0.15)" }}>{inv}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STORES */}
      {tab === "stores" && (
        <div style={{ animation: "fadeIn .2s ease" }}>
          <div style={{ display: "flex", gap: "9px", flexWrap: "wrap", marginBottom: "16px" }}>
            <Pill label="Total Stores"   value={retail?.totalStores ?? "—"}    color="#63b3ed" />
            <Pill label="Cities"         value={retail?.citiesPresent ?? "—"}   color="#63b3ed" />
            <Pill label="Countries"      value={retail?.countriesPresent ?? "—"} color="#63b3ed" />
            <Pill label="Rev / Store"    value={retail?.revenuePerStore?.value ? "₹" + retail.revenuePerStore.value + " Cr" : "—"} color="#34d399" sub={retail?.revenuePerStore?.note} />
          </div>
          {retail?.storeTypes && <div style={{ marginBottom: "12px", fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>Store types: {retail.storeTypes}</div>}
          {retail?.expansionPlan && (
            <div style={{ padding: "13px 15px", background: "rgba(99,179,237,0.05)", border: "1px solid rgba(99,179,237,0.13)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.52)", lineHeight: 1.65, marginBottom: "16px" }}>
              📍 <strong style={{ color: "#63b3ed" }}>Expansion Plan:</strong> {retail.expansionPlan}
            </div>
          )}
          {/* Live Maps counter */}
          <StoresPanel brand={data.brand} country={data.country ?? "India"} />
        </div>
      )}

      {/* ONLINE */}
      {tab === "online" && (
        <div style={{ animation: "fadeIn .2s ease" }}>
          <div style={{ display: "flex", gap: "9px", flexWrap: "wrap", marginBottom: "16px" }}>
            <Pill label="Online % Rev"  value={online?.onlineShareOfRevenue ? online.onlineShareOfRevenue + "%" : "—"} color="#a78bfa" />
            <Pill label="Monthly Visits" value={fmt(online?.monthlyWebTraffic)} color="#a78bfa" sub={online?.websiteTrafficSource} />
            <Pill label="Amazon Reviews" value={fmt(online?.amazonReviews)} color="#fbbf24" />
          </div>
          {online?.channels?.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <SectionHead label="Sales Channels" />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {online.channels.map((c, i) => (
                  <span key={i} style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", background: "rgba(167,139,250,0.07)", padding: "4px 12px", borderRadius: "20px", border: "1px solid rgba(167,139,250,0.15)" }}>{c}</span>
                ))}
              </div>
            </div>
          )}
          {/* Live traffic analyser */}
          <TrafficPanel brand={data.brand} domain={data.domain ?? online?.domain} industry={data.industry} />
        </div>
      )}

      {/* COMPETITORS */}
      {tab === "competitors" && (
        <div style={{ animation: "fadeIn .2s ease" }}>
          <CompetitorDiscovery
            brand={data.brand}
            industry={data.industry}
            country={data.country ?? "India"}
            onResearch={onResearch}
            trackedBrands={trackedBrands}
          />
        </div>
      )}

      {/* ESTIMATOR */}
      {tab === "estimate" && (
        <div style={{ animation: "fadeIn .2s ease" }}>
          <EstimatePanel brand={data.brand} researchData={data} />
        </div>
      )}

      {/* NEWS */}
      {tab === "news" && (
        <div style={{ animation: "fadeIn .2s ease" }}>
          {recentNews?.length > 0
            ? <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {recentNews.map((n, i) => (
                  <div key={i} style={{ padding: "13px 15px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{n.headline}</span>
                      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", flexShrink: 0 }}>{n.date}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.42)", lineHeight: 1.5 }}>{n.significance}</p>
                  </div>
                ))}
              </div>
            : <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.2)" }}>No recent news found</div>
          }
        </div>
      )}
    </div>
  );
}

// ── Comparison row ────────────────────────────────────────────────

function CompareRow({ brand, data, onSelect, selected, onRemove }) {
  const rev    = data?.financials?.latestRevenue;
  const growth = data?.financials?.revenueGrowth;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <div
        onClick={() => onSelect(brand)}
        style={{
          flex: 1, display: "flex", alignItems: "center", gap: "14px",
          padding: "13px 16px", borderRadius: "11px", cursor: "pointer", transition: "all .15s",
          background: selected ? "rgba(52,211,153,0.07)" : "rgba(255,255,255,0.02)",
          border: `1px solid ${selected ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.05)"}`,
        }}
        onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
        onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
      >
        <div style={{ flex: 2, minWidth: "90px" }}>
          <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#fff" }}>{brand}</div>
          <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.3)" }}>{data?.country} · {data?.industry}</div>
        </div>
        <div style={{ flex: 1, textAlign: "right" }}>
          <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#34d399" }}>{rev?.value ? fmtRev(rev.value, rev.currency) : "—"}</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)" }}>{rev?.period ?? "revenue"}</div>
        </div>
        <div style={{ flex: 1, textAlign: "right" }}>
          <div style={{ fontSize: "13.5px", fontWeight: 700, color: growthColor(growth) }}>{growth != null ? growth + "%" : "—"}</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)" }}>growth</div>
        </div>
        <div style={{ flex: 1, textAlign: "right" }}>
          <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#63b3ed" }}>{data?.retail?.totalStores ?? "—"}</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)" }}>stores</div>
        </div>
        <div style={{ flex: 1, textAlign: "right" }}>
          <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#a78bfa" }}>{data?.funding?.totalRaised?.value ? fmtRev(data.funding.totalRaised.value, data.funding.totalRaised.currency) : "—"}</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)" }}>raised</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: confColor(rev?.confidence) }} title={rev?.confidence + " confidence"} />
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>{data?.dataQuality}</div>
        </div>
      </div>
      <button onClick={() => onRemove(brand)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "14px", padding: "4px 8px", flexShrink: 0 }}>✕</button>
    </div>
  );
}

// ── Search form ───────────────────────────────────────────────────

function SearchForm({ onSearch, loading }) {
  const [brand,    setBrand]    = useState("");
  const [industry, setIndustry] = useState("");
  const [country,  setCountry]  = useState("India");

  const submit = () => {
    if (!brand.trim()) return;
    onSearch(brand.trim(), industry.trim() || "consumer / retail", country);
    setBrand("");
  };

  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 2, minWidth: "200px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "9px 14px" }}>
        <span style={{ opacity: 0.4 }}>🔍</span>
        <input
          value={brand}
          onChange={e => setBrand(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="Any company — Zara, Oyo, Byju's, Reliance…"
          style={{ flex: 1, background: "none", border: "none", color: "#fff", fontSize: "13px", fontFamily: "inherit" }}
        />
      </div>
      <input
        value={industry}
        onChange={e => setIndustry(e.target.value)}
        placeholder="Industry (optional)"
        style={{ flex: 1, minWidth: "130px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "9px", padding: "9px 12px", color: "#fff", fontSize: "12.5px", fontFamily: "inherit" }}
      />
      <select
        value={country}
        onChange={e => setCountry(e.target.value)}
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "#fff", borderRadius: "9px", padding: "9px 10px", fontSize: "12.5px", fontFamily: "inherit" }}
      >
        {["India","USA","UK","UAE","Singapore","Global"].map(c => <option key={c}>{c}</option>)}
      </select>
      <button onClick={submit} disabled={!brand.trim() || loading} style={{
        padding: "9px 18px", borderRadius: "9px", fontSize: "12.5px", fontWeight: 700,
        cursor: !brand.trim() || loading ? "not-allowed" : "pointer", fontFamily: "inherit",
        background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)",
        color: brand.trim() ? "#34d399" : "rgba(255,255,255,0.2)", whiteSpace: "nowrap",
      }}>+ Research</button>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────

const EXAMPLES = [
  { brand: "Zomato",        industry: "food delivery", country: "India" },
  { brand: "Nykaa",         industry: "beauty retail", country: "India" },
  { brand: "Decathlon",     industry: "sports retail", country: "India" },
  { brand: "Boat",          industry: "consumer electronics", country: "India" },
  { brand: "Lenskart",      industry: "eyewear retail", country: "India" },
  { brand: "Oyo",           industry: "hospitality", country: "India" },
];

export default function App() {
  const [brands,   setBrands]   = useState({});   // key → data | "loading" | "error"
  const [selected, setSelected] = useState(null);
  const [error,    setError]    = useState(null);

  const anyLoading = Object.values(brands).some(v => v === "loading");

  const research = useCallback(async (brand, industry, country) => {
    if (brands[brand]) return; // already tracked
    setBrands(prev => ({ ...prev, [brand]: "loading" }));
    setError(null);
    try {
      const data = await callAPI("/api/research", { brand, industry, country });
      setBrands(prev => ({ ...prev, [brand]: data }));
      setSelected(brand);
    } catch (err) {
      setBrands(prev => ({ ...prev, [brand]: "error" }));
      setError(`Failed to research "${brand}": ${err.message}`);
    }
  }, [brands]);

  const remove = useCallback((brand) => {
    setBrands(prev => { const n = { ...prev }; delete n[brand]; return n; });
    if (selected === brand) setSelected(null);
  }, [selected]);

  const loadedEntries  = Object.entries(brands).filter(([, v]) => typeof v === "object");
  const loadingEntries = Object.entries(brands).filter(([, v]) => v === "loading");
  const selectedData   = selected && typeof brands[selected] === "object" ? brands[selected] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#080c10", color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sweep  { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        input::placeholder, select option { color: rgba(255,255,255,0.25); }
        input:focus { outline: none; }
        select { cursor: pointer; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>

      {/* ── HEADER ── */}
      <header style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(8,12,16,0.96)", backdropFilter: "blur(20px)",
        position: "sticky", top: 0, zIndex: 30, padding: "16px 28px 14px",
      }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "2px" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 8px #34d399", display: "inline-block", animation: "pulse 2s infinite" }} />
                <span style={{ fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>CFO Intelligence Platform</span>
              </div>
              <h1 style={{ fontSize: "19px", fontWeight: 800, letterSpacing: "-0.5px" }}>
                Competitor{" "}
                <span style={{ background: "linear-gradient(120deg,#34d399,#63b3ed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Financial Intel</span>
              </h1>
            </div>
            <div style={{ flex: 1 }}>
              <SearchForm onSearch={research} loading={anyLoading} />
            </div>
          </div>

          {/* Data source badges */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[
              { label: "📑 Tofler / RoC",    tip: "Indian company MCA filings" },
              { label: "🗺️ TomTom / OSM",    tip: "Free store count — no Google Maps needed" },
              { label: "📊 Similarweb",       tip: "Website traffic estimation" },
              { label: "📰 Entrackr / Inc42", tip: "Startup funding & revenue news" },
              { label: "🌐 Web Search",       tip: "Claude searches 10+ sources" },
            ].map(b => (
              <span key={b.label} title={b.tip} style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: "3px 10px", borderRadius: "20px" }}>{b.label}</span>
            ))}
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main style={{ maxWidth: "1100px", margin: "0 auto", padding: "22px 28px 64px" }}>

        {/* Error */}
        {error && (
          <div style={{ padding: "11px 15px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.18)", borderRadius: "9px", color: "#fca5a5", fontSize: "12.5px", marginBottom: "16px" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Empty state */}
        {Object.keys(brands).length === 0 && (
          <div style={{ textAlign: "center", padding: "50px 20px", animation: "fadeIn .4s ease" }}>
            <div style={{ fontSize: "44px", marginBottom: "12px" }}>🏦</div>
            <p style={{ fontSize: "17px", fontWeight: 700, color: "rgba(255,255,255,0.55)", marginBottom: "5px" }}>Research any company in the world</p>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.25)", marginBottom: "26px" }}>Revenue · Funding · Stores · Online Sales · Employee Growth</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
              {EXAMPLES.map(e => (
                <button key={e.brand} onClick={() => research(e.brand, e.industry, e.country)} style={{
                  padding: "7px 15px", borderRadius: "20px", fontSize: "12.5px", fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                  background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.16)", color: "rgba(255,255,255,0.45)",
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#34d399"; e.currentTarget.style.background = "rgba(52,211,153,0.12)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; e.currentTarget.style.background = "rgba(52,211,153,0.06)"; }}
                >{e.brand}</button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loadingEntries.map(([brand]) => (
          <div key={brand} style={{ marginBottom: "16px" }}>
            <Shimmer message={`Researching ${brand} — searching Tofler, Entrackr, Inc42, funding news, web…`} />
          </div>
        ))}

        {/* Brand list */}
        {loadedEntries.length > 0 && (
          <div style={{ marginBottom: "18px" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "20px", fontSize: "10px", color: "rgba(255,255,255,0.22)", marginBottom: "8px", paddingRight: "32px" }}>
              <span>REVENUE</span><span>GROWTH</span><span>STORES</span><span>FUNDING</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
              {loadedEntries.map(([brand, data]) => (
                <CompareRow key={brand} brand={brand} data={data} onSelect={setSelected} selected={selected === brand} onRemove={remove} />
              ))}
            </div>
          </div>
        )}

        {/* Detail report */}
        {selectedData && (
          <BrandReport key={selected} data={selectedData} onClose={() => setSelected(null)} onResearch={research} trackedBrands={brands} />
        )}
      </main>
    </div>
  );
}
