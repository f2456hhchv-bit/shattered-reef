// Inlines dist-artifact/ into one HTML body fragment (no doctype/html/head/body: the host adds them).
const fs = require('fs'), path = require('path');
const dir = 'dist-artifact', out = process.argv[2] || 'shattered-reef.html';
const assets = fs.readdirSync(path.join(dir, 'assets'));
const js = assets.filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(dir, 'assets', f), 'utf8'));
const css = assets.filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(path.join(dir, 'assets', f), 'utf8'));
if (js.length !== 1) throw new Error('expected one JS chunk, got ' + js.length);
if (js[0].includes('</script')) throw new Error('script contains </script');
const html = `<title>Shattered Reef</title>
<meta name="theme-color" content="#0d1a1f">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap">
<style>${css.join('\n')}</style>
<canvas id="world" aria-label="Shattered Reef game world"></canvas>
<div id="title"></div>
<script type="module">${js[0]}</script>
`;
fs.writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + ' KB');
