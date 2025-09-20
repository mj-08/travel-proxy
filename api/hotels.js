// /api/hotels.js
// Query: destination(도시코드 예: TYO), checkIn(YYYY-MM-DD), checkOut, adults

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { destination, checkIn, checkOut, adults = "1" } =
      req.method === "GET" ? req.query : req.body || {};

    if (!destination || !checkIn || !checkOut) {
      return res.status(400).json({ error: "Missing params: destination, checkIn, checkOut" });
    }

    const apiKey = process.env.HOTELBEDS_API_KEY;
    const secret = process.env.HOTELBEDS_API_SECRET;
    if (!apiKey || !secret) {
      // 환경변수 미설정 시에도 개발/데모 편의를 위해 Mock 반환
      const nights = Math.max(1, Math.round((+new Date(checkOut) - +new Date(checkIn)) / 86400000));
      return res.status(200).json({
        hotels: [
          { id:"H1", name:"Mock 신주쿠 스테이", area:"신주쿠", stars:4.5, rating:4.6, reviews:1320, refundable:true,  checkIn, checkOut, nights, pricePerNight:120000, taxesPerNight:15000 },
          { id:"H2", name:"Mock 긴자 프리미어", area:"긴자", stars:5.0, rating:4.8, reviews:980,  refundable:false, checkIn, checkOut, nights, pricePerNight:190000, taxesPerNight:22000 },
          { id:"H3", name:"Mock 아사쿠사 리버", area:"아사쿠사", stars:3.8, rating:4.3, reviews:740,  refundable:true,  checkIn, checkOut, nights, pricePerNight:90000,  taxesPerNight:12000 }
        ]
      });
    }

    // Hotelbeds signature: SHA256(apiKey + secret + timestamp)
    const timestamp = Math.floor(Date.now() / 1000);
    const crypto = await import("crypto");
    const signature = crypto
      .createHash("sha256")
      .update(apiKey + secret + timestamp)
      .digest("hex");

    // 참고: 실제 Hotelbeds 검색 파라미터는 엔드포인트/쿼리 구조가 계약에 따라 다를 수 있음
    const url = `https://api.test.hotelbeds.com/hotel-api/1.0/hotels?destination=${destination}&checkIn=${checkIn}&checkOut=${checkOut}&occupancies=${adults}`;

    const apiRes = await fetch(url, {
      headers: {
        "Api-Key": apiKey,
        "X-Signature": signature,
        Accept: "application/json"
      }
    });

    if (!apiRes.ok) {
      const t = await apiRes.text();
      throw new Error(`Hotelbeds error: ${apiRes.status} ${t}`);
    }

    const raw = await apiRes.json();

    // 단순 스키마로 변환
    const list = (raw?.hotels || raw?.data || raw?.hotels?.hotels || []);
    const nights =
      Math.max(1, Math.round((+new Date(checkOut) - +new Date(checkIn)) / 86400000));

    const items = (Array.isArray(list) ? list : list?.hotels || [])
      .slice(0, 20)
      .map((h, i) => ({
        id: `H_${i}`,
        name: h.name || h?.hotel?.name || `Hotel ${i + 1}`,
        area: h.zoneName || h?.hotel?.zoneName || "도쿄",
        stars: Number(h.categoryName?.match(/\d+/)?.[0] || 4),
        rating: Number(h.rating || 4.4),
        reviews: 200 + i * 17,
        refundable: true, // 샘플
        checkIn,
        checkOut,
        nights,
        pricePerNight: Math.round(Number(h.minRate || h?.rooms?.[0]?.rates?.[0]?.net || 100000)),
        taxesPerNight: Math.round(Number(h.taxesPerNight || 15000))
      }));

    return res.status(200).json({ hotels: items });
  } catch (err) {
    console.error("hotels API error:", err);
    return res.status(500).json({ error: "Hotelbeds API 실패", detail: String(err?.message || err) });
  }
}
