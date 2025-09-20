// /api/mcp-query.js
// Body: { prompt: string }
// 간단 한국어 파서 → flights/hotels 호출 → /api/plan 로직 재사용

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { prompt = "" } = req.method === "GET" ? req.query : req.body || {};
    const p = parseNatural(prompt);

    // /api/plan 호출(툴 오케스트레이션)
    const planRes = await fetch(`${originUrl(req)}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: p.origin,
        destination: p.destination,
        departDate: toISO(p.departDate),
        returnDate: toISO(p.returnDate),
        adults: p.adults,
        currencyCode: "KRW"
      })
    });
    if (!planRes.ok) throw new Error(await planRes.text());
    const data = await planRes.json();

    return res.status(200).json({ query: p, ...data });
  } catch (err) {
    console.error("mcp-query error:", err);
    return res.status(500).json({ error: "mcp-query 실패", detail: String(err?.message || err) });
  }
}

/** === 유틸/파서 === */
function parseNatural(textRaw){
  const t = (textRaw||"").trim();
  const origin = /김포/.test(t) ? "GMP" : "ICN";
  const destination = /나리타/.test(t) ? "NRT" : /하네다|도쿄/.test(t) ? "HND" : "HND";
  const adults = (()=>{ const m = t.match(/(성인|어른|adults?)\s*(\d+)/i); return m? +m[2] : 1; })();
  const nights = (()=>{ const m = t.match(/(\d+)\s*박/); return m? +m[1] : 2; })();

  const Y = new Date().getFullYear();
  const parseKDate = (s)=>{
    if(!s) return null;
    const a = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    const b = s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    const c = s.match(/(\d{1,2})[./-](\d{1,2})/);
    if(a) return new Date(+a[1], +a[2]-1, +a[3]);
    if(b) return new Date(Y, +b[1]-1, +b[2]);
    if(c) return new Date(Y, +c[1]-1, +c[2]);
    return null;
  };

  let departDate=null, returnDate=null;
  const pair = t.match(/(\d{1,2}\s*월\s*\d{1,2}\s*일|\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}).{0,8}?(귀국|리턴|돌아|~|부터|출발).{0,12}?(\d{1,2}\s*월\s*\d{1,2}\s*일|\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2})/);
  if(pair){ departDate = parseKDate(pair[1]); returnDate = parseKDate(pair[3]); }
  if(!departDate){
    const dep = t.match(/(\d{1,2}\s*월\s*\d{1,2}\s*일|\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}).{0,3}출발/);
    if(dep) departDate = parseKDate(dep[1]);
  }
  if(!returnDate && departDate){
    const ret = t.match(/(\d{1,2}\s*월\s*\d{1,2}\s*일|\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}).{0,3}(귀국|복귀|리턴|돌아)/);
    if(ret) returnDate = parseKDate(ret[1]);
  }

  if(!departDate || !returnDate){
    const now = new Date(); const dow = now.getDay();
    const add = ((5 - dow + 7) % 7) || 7; // 다음 금요일
    departDate = new Date(now); departDate.setDate(now.getDate()+add);
    returnDate = new Date(departDate); returnDate.setDate(departDate.getDate()+Math.max(1,nights));
  }

  return { origin, destination, departDate, returnDate, nights, adults };
}
function toISO(d){ return new Date(d).toISOString().slice(0,10); }
function originUrl(req){
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = (req.headers["x-forwarded-proto"] || "https");
  return `${proto}://${host}`;
}
