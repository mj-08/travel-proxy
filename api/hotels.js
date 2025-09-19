export default async function handler(req, res) {
  try {
    const { destination, checkIn, checkOut, adults } = req.query;
    if (!destination || !checkIn || !checkOut || !adults) {
      return res.status(400).json({ error: "Missing query parameter(s)" });
    }

    const apiKey = process.env.HOTELBEDS_API_KEY;
    const secret = process.env.HOTELBEDS_API_SECRET;

    if (!apiKey || !secret) {
      return res.status(500).json({ error: "Hotelbeds 환경변수 미설정" });
    }

    // Hotelbeds signature: SHA256(apiKey + secret + timestamp)
    const timestamp = Math.floor(Date.now() / 1000);
    const crypto = await import("crypto");
    const signature = crypto
      .createHash("sha256")
      .update(apiKey + secret + timestamp)
      .digest("hex");

    const url = `https://api.test.hotelbeds.com/hotel-api/1.0/hotels?destination=${destination}&checkIn=${checkIn}&checkOut=${checkOut}&occupancies=${adults}`;

    const response = await fetch(url, {
      headers: {
        "Api-Key": apiKey,
        "X-Signature": signature,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Hotelbeds API 오류: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("hotels API error:", err);
    return res.status(500).json({ error: "Hotelbeds API 호출 실패", detail: err.message });
  }
}
