export default async function handler(req, res) {
  try {
    const { origin, destination, departDate, returnDate, adults } = req.query;
    const token = await getAmadeusToken();

    const url = `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${departDate}&returnDate=${returnDate}&adults=${adults}&currencyCode=KRW`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Amadeus API 오류: ${response.status} ${errText}`);
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    console.error("flights API error:", err);
    res.status(500).json({ error: "Amadeus API 호출 실패", detail: err.message });
  }
}

async function getAmadeusToken() {
  const response = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.AMADEUS_CLIENT_ID,
      client_secret: process.env.AMADEUS_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`토큰 요청 실패: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.access_token;
}
