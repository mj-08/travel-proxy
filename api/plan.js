// /api/plan.js
// Query: origin, destination, departDate, returnDate, adults, currencyCode
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
const KRW = (n) => Math.round(Number(n || 0));
const riskScore = (f, h) => (Math.max(0, f.stops) * 2) + ((100 - (f.ontime || 90)) / 10) + (h.refundable ? 0 : 1.5);

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const params = (req.method === "GET" ? req.query : req.body) || {};
    const { origin, destination, departDate, returnDate, adults = "1", currencyCode = "KRW" } = params;

    if (!origin || !destination || !departDate || !returnDate) {
      return res.status(400).json({ error: "Missing params: origin, destination, departDate, returnDate" });
    }

    // 병렬 호출
    const [fRes, hRes] = await Promise.all([
      fetch(`${originUrl(req)}/api/flights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, departDate, returnDate, adults, currencyCode })
      }),
      fetch(`${originUrl(req)}/api/hotels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: toCity(destination), checkIn: departDate, checkOut: returnDate, adults })
      })
    ]);

    if (!fRes.ok) throw new Error(`flights fail: ${await fRes.text()}`);
    if (!hRes.ok) throw new Error(`hotels fail: ${await hRes.text()}`);

    const { flights } = await fRes.json();
    const { hotels } = await hRes.json();

    const combos = [];
    for (const f of flights) {
      for (const h of hotels.slice(0, 10)) {
        const hotelCost = (h.pricePerNight + h.taxesPerNight) * (h.nights || nightsFrom(h));
        combos.push({
          flight: f, hotel: h,
          total: KRW(f.price) + KRW(hotelCost),
          risk: riskScore(f, h)
        });
      }
    }

    if (!combos.length) return res.status(200).json({ lowest: null, fastest: null, safest: null });

    const lowest  = [...combos].sort((a,b)=>a.total - b.total)[0];
    const fastest = [...combos].sort((a,b)=>a.flight.duration - b.flight.duration || a.total - b.total)[0];
    const safest  = [...combos].sort((a,b)=>a.risk - b.risk || a.total - b.total)[0];

    return res.status(200).json({ lowest, fastest, safest, meta:{countFlights: flights.length, countHotels: hotels.length} });
  } catch (err) {
    console.error("plan API error:", err);
    return res.status(500).json({ error: "Plan 실패", detail: String(err?.message || err) });
  }
}

function nightsFrom(h) {
  const inD = h.checkIn ? new Date(h.checkIn) : null;
  const outD = h.checkOut ? new Date(h.checkOut) : null;
  return inD && outD ? Math.max(1, Math.round((+outD - +inD) / 86400000)) : 2;
}
function toCity(airport) {
  const map = { HND: "TYO", NRT: "TYO", GMP: "SEL", ICN: "SEL" };
  return map[airport] || airport;
}
function originUrl(req){
  // absolute URL 생성 (Vercel 배포 도메인 기준)
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = (req.headers["x-forwarded-proto"] || "https");
  return `${proto}://${host}`;
}
