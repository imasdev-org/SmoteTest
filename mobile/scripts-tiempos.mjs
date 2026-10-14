// Resumen de tiempos de la última corrida: node scripts-tiempos.mjs [top]
import fs from 'node:fs';
const top = Number(process.argv[2] || 15);
const rows = fs.readFileSync('./test-results/tiempos.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l));
const fmt = ms => `${(ms / 1000).toFixed(1)} s`;
const total = rows.reduce((a, r) => a + r.ms, 0);
console.log(`Total pasos: ${rows.length} — ${fmt(total)}\n`);
const byFeature = {};
for (const r of rows) byFeature[r.feature] = (byFeature[r.feature] || 0) + r.ms;
console.log('Por feature:');
for (const [f, ms] of Object.entries(byFeature).sort((a, b) => b[1] - a[1])) console.log(`  ${fmt(ms).padStart(8)}  ${f}`);
const byStep = {};
for (const r of rows) { const k = r.step.replace(/^\S+\s/, ''); (byStep[k] ||= []).push(r.ms); }
console.log(`\nPasos más lentos (suma de todas sus ejecuciones, top ${top}):`);
Object.entries(byStep).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0), v.length])
  .sort((a, b) => b[1] - a[1]).slice(0, top)
  .forEach(([k, sum, n]) => console.log(`  ${fmt(sum).padStart(8)}  x${n}  ${k}`));
