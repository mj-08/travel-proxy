// /api/flights.js
// Query: origin, destination, departDate, returnDate, adults, currencyCode(선택: 기본 KRW)

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { origin, destination, departDate, returnDate, adults = "1", currencyCode = "KRW" } =
      req.method === "GET" ? req.query : req.body || {};

    if (!origin || !destination || !departDate || !returnDate) {
      return res.status(400).json({ error: "Missing params: origin, destination, departDate, returnDate" });
    }

    // 1) Amadeus OAuth2 토큰
    const tokenRes = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.AMADEUS_CLIENT_ID,
        client_secret: process.env.AMADEUS_CLIENT_SECRET
      })
    });
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      throw new Error(`Amadeus token error: ${tokenRes.status} ${t}`);
    }
    const { access_token } = await tokenRes.json();

    // 2) Flight Offers 검색
    const url = `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${departDate}&returnDate=${returnDate}&adults=${adults}&currencyCode=${currencyCode}`;

    const apiRes = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
    if (!apiRes.ok) {
      const t = await apiRes.text();
      throw new Error(`Amadeus search error: ${apiRes.status} ${t}`);
    }
    const raw = await apiRes.json();

    // 3) 경량 스키마로 변환 (프론트/플래너 공통 사용)
    const items = (raw?.data || []).slice(0, 20).map((it, i) => {
      const out = it.itineraries?.[0];
      const ret = it.itineraries?.[1];
      const firstSeg = out?.segments?.[0];
      const lastSegR = ret?.segments?.slice(-1)[0];

      const isoToHM = (iso) => (iso ? iso.slice(11, 16) : "--:--");
      const parseDur = (dur) => {
        const m = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(dur || "");
        return (+(m?.[1] || 0)) * 60 + +(m?.[2] || 0);
      };

      return {
        id: `F_${i}`,
        airline: { code: firstSeg?.carrierCode || it?.validatingAirlineCodes?.[0] || "XX", name: firstSeg?.carrierCode || "항공" },
        origin,
        destination,
        departDate,
        returnDate,
        departTime: isoToHM(firstSeg?.departure?.at),
        returnTime: isoToHM(lastSegR?.arrival?.at),
        duration: parseDur(out?.duration) + parseDur(ret?.duration),
        stops:
          Math.max(0, (out?.segments?.length || 1) - 1) +
          Math.max(0, (ret?.segments?.length || 1) - 1),
        ontime: 90,                 // 샘플(정시율 데이터 없음)
        baggageIncluded: false,     // 샘플
        price: Math.round(+it?.price?.grandTotal || 0)
      };
    });

    return res.status(200).json({ flights: items });
  } catch (err) {
    console.error("flights API error:", err);
    return res.status(500).json({ error: "Amadeus API 실패", detail: String(err?.message || err) });
  }
}
