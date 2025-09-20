// /api/health.js
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

if (req.method === "OPTIONS") {
  return res.status(200).end();
}

export default function handler(req, res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ ok: true, uptime: process.uptime(), ts: Date.now() });
}
