// /api/health.js
export default function handler(req, res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ ok: true, uptime: process.uptime(), ts: Date.now() });
}
