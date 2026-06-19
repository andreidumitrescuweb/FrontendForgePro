import { MOTION_ENGINE_TAG } from './motionEngine';

/**
 * Starter content so a project is usable WITHOUT the AI. A blank professional
 * skeleton plus a gallery of complete, responsive, animated templates. Each is a
 * single self-contained index.html (fonts via <link>, styles in <head>, motion
 * engine + data-ff-m baked in) so it looks alive the moment it's exported.
 */

export interface Template {
  id: string;
  name: string;
  category: 'Blank' | 'Agency' | 'SaaS' | 'Local' | 'Portfolio';
  description: string;
  files: Record<string, string>;
  entryFile: string;
}

const RESET = `*{margin:0;padding:0;box-sizing:border-box}img{max-width:100%;display:block}a{text-decoration:none;color:inherit}html{scroll-behavior:smooth}`;

function doc(opts: { title: string; fonts: string; css: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${opts.title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${opts.fonts}" rel="stylesheet">
<style>${RESET}${opts.css}</style>
</head>
<body>
${opts.body}
${MOTION_ENGINE_TAG}
</body>
</html>`;
}

// ---------------------------------------------------------------- Blank
const BLANK = doc({
  title: 'My site',
  fonts: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  css: `body{font-family:Inter,system-ui,sans-serif;color:#0f172a;line-height:1.6}
.wrap{max-width:1100px;margin:0 auto;padding:0 24px}
.hero{min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:20px;padding:80px 24px}
.hero h1{font-size:clamp(36px,7vw,68px);font-weight:800;letter-spacing:-.02em;line-height:1.05}
.hero p{font-size:clamp(16px,2.5vw,20px);color:#475569;max-width:560px}
.btn{display:inline-block;background:#4f46e5;color:#fff;padding:14px 28px;border-radius:12px;font-weight:600}`,
  body: `<section class="hero">
  <h1 data-ff-m="up">Start building</h1>
  <p data-ff-m="up">Click anything to edit it. Add sections, shapes and motion from the right panel.</p>
  <a class="btn" href="#" data-ff-m="up">Get started</a>
</section>`,
});

// ---------------------------------------------------------------- Agency
const AGENCY = doc({
  title: 'Studio — Creative Agency',
  fonts: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Inter:wght@400;500;600&display=swap',
  css: `body{font-family:Inter,sans-serif;background:#0b0b10;color:#f4f4f5;line-height:1.6;overflow-x:hidden}
.wrap{max-width:1200px;margin:0 auto;padding:0 28px}
.display{font-family:'Space Grotesk',sans-serif;letter-spacing:-.02em}
nav{display:flex;align-items:center;justify-content:space-between;padding:26px 28px;max-width:1200px;margin:0 auto}
nav .logo{font-family:'Space Grotesk';font-weight:700;font-size:22px}
nav .links{display:flex;gap:28px;font-size:15px;color:#a1a1aa}
.hero{position:relative;padding:120px 28px 100px;max-width:1200px;margin:0 auto}
.hero h1{font-size:clamp(44px,9vw,120px);font-weight:700;line-height:.95}
.hero .accent{color:#a78bfa}
.hero p{margin-top:24px;max-width:520px;font-size:clamp(16px,2.2vw,20px);color:#a1a1aa}
.blob{position:absolute;top:40px;right:-60px;width:380px;height:380px;border-radius:50%;background:radial-gradient(circle at 30% 30%,#7c3aed,#4f46e5 60%,transparent 70%);filter:blur(20px);opacity:.55;z-index:-1}
.section{padding:90px 28px;max-width:1200px;margin:0 auto}
.eyebrow{color:#a78bfa;font-weight:600;letter-spacing:.08em;text-transform:uppercase;font-size:13px}
.section h2{font-family:'Space Grotesk';font-size:clamp(30px,5vw,52px);font-weight:700;margin:12px 0 40px;letter-spacing:-.02em}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px}
.card{background:#15151d;border:1px solid #26262f;border-radius:18px;padding:30px}
.card h3{font-family:'Space Grotesk';font-size:22px;margin-bottom:10px}
.card p{color:#a1a1aa}
.work{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}
.work .tile{border-radius:18px;overflow:hidden;aspect-ratio:4/3;position:relative}
.work .tile img{width:100%;height:100%;object-fit:cover;transition:transform .6s ease}
.work .tile:hover img{transform:scale(1.07)}
.cta{text-align:center;background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:28px;padding:70px 28px;margin:0 28px 60px}
.cta h2{font-family:'Space Grotesk';font-size:clamp(30px,5vw,52px);font-weight:700}
.btn{display:inline-block;background:#fff;color:#0b0b10;padding:15px 30px;border-radius:12px;font-weight:600;margin-top:22px}
footer{border-top:1px solid #26262f;padding:40px 28px;color:#71717a;text-align:center}
@media(max-width:640px){nav .links{display:none}}`,
  body: `<nav>
  <div class="logo">◆ STUDIO</div>
  <div class="links"><a href="#">Work</a><a href="#">Services</a><a href="#">About</a><a href="#">Contact</a></div>
</nav>
<header class="hero">
  <div class="blob" data-ff-m="parallax" data-ff-speed="0.5"></div>
  <h1 class="display" data-ff-m="up">We craft <span class="accent">bold</span><br>digital brands.</h1>
  <p data-ff-m="up">An independent studio designing websites and identities for ambitious companies.</p>
</header>
<section class="section">
  <div class="eyebrow" data-ff-m="up">What we do</div>
  <h2 data-ff-m="up">Services</h2>
  <div class="grid">
    <div class="card" data-ff-m="up"><h3>Brand design</h3><p>Identity systems that make you unmistakable.</p></div>
    <div class="card" data-ff-m="up"><h3>Web design</h3><p>Fast, beautiful, conversion-focused websites.</p></div>
    <div class="card" data-ff-m="up"><h3>Motion</h3><p>Interactions and animation that feel alive.</p></div>
  </div>
</section>
<section class="section">
  <div class="eyebrow" data-ff-m="up">Selected</div>
  <h2 data-ff-m="up">Recent work</h2>
  <div class="work">
    <div class="tile" data-ff-m="zoom"><img src="https://picsum.photos/seed/agency1/800/600" alt="Project"></div>
    <div class="tile" data-ff-m="zoom"><img src="https://picsum.photos/seed/agency2/800/600" alt="Project"></div>
    <div class="tile" data-ff-m="zoom"><img src="https://picsum.photos/seed/agency3/800/600" alt="Project"></div>
  </div>
</section>
<section class="cta" data-ff-m="zoom">
  <h2>Let's build something great.</h2>
  <a class="btn" href="#">Start a project</a>
</section>
<footer>© 2026 Studio. All rights reserved.</footer>`,
});

// ---------------------------------------------------------------- SaaS
const SAAS = doc({
  title: 'Flow — Product',
  fonts: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
  css: `body{font-family:'Plus Jakarta Sans',sans-serif;color:#0f172a;line-height:1.6;background:#fff}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
nav{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;max-width:1120px;margin:0 auto}
nav .logo{font-weight:800;font-size:21px;color:#4f46e5}
nav .links{display:flex;gap:26px;align-items:center;color:#475569;font-weight:500}
.btn{display:inline-block;background:#4f46e5;color:#fff;padding:12px 22px;border-radius:10px;font-weight:600}
.btn.ghost{background:#eef2ff;color:#4f46e5}
.hero{text-align:center;padding:90px 24px 70px;max-width:820px;margin:0 auto}
.pill{display:inline-block;background:#eef2ff;color:#4f46e5;padding:7px 14px;border-radius:999px;font-size:13px;font-weight:600;margin-bottom:22px}
.hero h1{font-size:clamp(36px,6.5vw,68px);font-weight:800;letter-spacing:-.03em;line-height:1.05}
.hero p{margin:20px auto 0;max-width:560px;font-size:clamp(16px,2.3vw,20px);color:#475569}
.hero .row{display:flex;gap:12px;justify-content:center;margin-top:30px;flex-wrap:wrap}
.shot{max-width:1000px;margin:50px auto 0;border-radius:18px;border:1px solid #e2e8f0;box-shadow:0 30px 60px rgba(2,6,23,.12);overflow:hidden}
.section{padding:80px 24px;max-width:1120px;margin:0 auto}
.section h2{text-align:center;font-size:clamp(28px,4.5vw,44px);font-weight:800;letter-spacing:-.02em;margin-bottom:14px}
.section .sub{text-align:center;color:#64748b;max-width:560px;margin:0 auto 46px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}
.feat{padding:28px;border:1px solid #e9eef5;border-radius:16px;background:#fbfcfe}
.feat .ic{width:46px;height:46px;border-radius:12px;background:#eef2ff;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:14px}
.feat h3{font-size:19px;font-weight:700;margin-bottom:8px}
.feat p{color:#64748b}
.price{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;max-width:900px;margin:0 auto}
.plan{border:1px solid #e2e8f0;border-radius:18px;padding:32px;text-align:center}
.plan.hot{border-color:#4f46e5;box-shadow:0 20px 40px rgba(79,70,229,.15)}
.plan .amt{font-size:44px;font-weight:800;margin:8px 0}
.plan .amt span{font-size:15px;font-weight:500;color:#94a3b8}
.cta{text-align:center;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#fff;border-radius:26px;padding:64px 24px;margin:0 24px 60px}
.cta h2{font-size:clamp(28px,4.5vw,46px);font-weight:800}
.cta .btn{background:#fff;color:#4f46e5;margin-top:20px}
footer{border-top:1px solid #e2e8f0;padding:36px 24px;text-align:center;color:#94a3b8}
@media(max-width:640px){nav .links{display:none}}`,
  body: `<nav>
  <div class="logo">⬡ Flow</div>
  <div class="links"><a href="#">Features</a><a href="#">Pricing</a><a href="#">Docs</a><a class="btn ghost" href="#">Sign in</a></div>
</nav>
<header class="hero">
  <span class="pill" data-ff-m="up">New · v2 is here</span>
  <h1 data-ff-m="up">The workspace your team will actually love</h1>
  <p data-ff-m="up">Plan, track and ship — all in one fast, delightful app built for modern teams.</p>
  <div class="row" data-ff-m="up"><a class="btn" href="#">Start free</a><a class="btn ghost" href="#">Book a demo</a></div>
</header>
<div class="shot" data-ff-m="zoom"><img src="https://picsum.photos/seed/saasshot/1000/560" alt="Product screenshot"></div>
<section class="section">
  <h2 data-ff-m="up">Everything in one place</h2>
  <p class="sub" data-ff-m="up">Stop switching tabs. Flow brings your whole workflow together.</p>
  <div class="grid">
    <div class="feat" data-ff-m="up"><div class="ic">⚡</div><h3>Lightning fast</h3><p>Instant search and navigation, even at scale.</p></div>
    <div class="feat" data-ff-m="up"><div class="ic">🔒</div><h3>Secure by default</h3><p>Enterprise-grade security and SSO included.</p></div>
    <div class="feat" data-ff-m="up"><div class="ic">📊</div><h3>Insightful</h3><p>Dashboards that turn data into decisions.</p></div>
    <div class="feat" data-ff-m="up"><div class="ic">🔗</div><h3>Integrations</h3><p>Connects with the tools you already use.</p></div>
  </div>
</section>
<section class="section">
  <h2 data-ff-m="up">Simple pricing</h2>
  <p class="sub" data-ff-m="up">Start free, upgrade when you grow.</p>
  <div class="price">
    <div class="plan" data-ff-m="up"><h3>Starter</h3><div class="amt">$0<span>/mo</span></div><p>For individuals</p></div>
    <div class="plan hot" data-ff-m="up"><h3>Pro</h3><div class="amt">$24<span>/mo</span></div><p>For growing teams</p></div>
    <div class="plan" data-ff-m="up"><h3>Scale</h3><div class="amt">$79<span>/mo</span></div><p>For companies</p></div>
  </div>
</section>
<section class="cta" data-ff-m="zoom">
  <h2>Ready to get into the Flow?</h2>
  <a class="btn" href="#">Start free trial</a>
</section>
<footer>© 2026 Flow Inc.</footer>`,
});

// ---------------------------------------------------------------- Local / Restaurant
const LOCAL = doc({
  title: 'Olive & Ember — Restaurant',
  fonts: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600&display=swap',
  css: `body{font-family:Inter,sans-serif;color:#221a12;line-height:1.6;background:#fbf7f0}
.serif{font-family:Fraunces,serif}
nav{display:flex;align-items:center;justify-content:space-between;padding:22px 28px;max-width:1140px;margin:0 auto}
nav .logo{font-family:Fraunces;font-weight:700;font-size:23px}
nav .links{display:flex;gap:26px;color:#6b5b46;font-weight:500}
.btn{display:inline-block;background:#9a3412;color:#fff;padding:13px 26px;border-radius:999px;font-weight:600}
.hero{position:relative;display:grid;grid-template-columns:1.1fr 1fr;gap:40px;align-items:center;max-width:1140px;margin:0 auto;padding:60px 28px 80px}
.hero h1{font-family:Fraunces;font-size:clamp(40px,7vw,76px);font-weight:700;line-height:1.02}
.hero p{margin:20px 0 28px;font-size:18px;color:#6b5b46;max-width:440px}
.hero .img{border-radius:24px;overflow:hidden;aspect-ratio:4/5;box-shadow:0 30px 60px rgba(154,52,18,.18)}
.hero .img img{width:100%;height:100%;object-fit:cover}
.section{max-width:1140px;margin:0 auto;padding:70px 28px}
.section h2{font-family:Fraunces;font-size:clamp(30px,5vw,52px);font-weight:700;text-align:center;margin-bottom:40px}
.menu{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:26px}
.dish{background:#fff;border-radius:18px;padding:24px;border:1px solid #efe6d8}
.dish .top{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.dish h3{font-family:Fraunces;font-size:21px}
.dish .price{color:#9a3412;font-weight:700}
.dish p{color:#8a7a63;margin-top:6px;font-size:15px}
.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}
.gallery img{border-radius:14px;aspect-ratio:1;object-fit:cover}
.cta{text-align:center;background:#221a12;color:#fbf7f0;border-radius:26px;padding:70px 28px;margin:0 28px 60px}
.cta h2{font-family:Fraunces;font-size:clamp(30px,5vw,50px);font-weight:700}
.cta .btn{margin-top:22px}
footer{text-align:center;padding:40px 28px;color:#8a7a63}
@media(max-width:780px){.hero{grid-template-columns:1fr}nav .links{display:none}}`,
  body: `<nav>
  <div class="logo">Olive & Ember</div>
  <div class="links"><a href="#">Menu</a><a href="#">About</a><a href="#">Gallery</a><a href="#">Contact</a></div>
</nav>
<header class="hero">
  <div>
    <h1 data-ff-m="up">Wood-fired food,<br>made with love.</h1>
    <p data-ff-m="up">Seasonal Mediterranean plates in the heart of the city. Open for lunch & dinner.</p>
    <a class="btn" href="#" data-ff-m="up">Book a table</a>
  </div>
  <div class="img" data-ff-m="right"><img src="https://picsum.photos/seed/food-hero/700/880" alt="Signature dish"></div>
</header>
<section class="section">
  <h2 data-ff-m="up">Favourites</h2>
  <div class="menu">
    <div class="dish" data-ff-m="up"><div class="top"><h3>Charred aubergine</h3><span class="price">$14</span></div><p>Tahini, pomegranate, herbs.</p></div>
    <div class="dish" data-ff-m="up"><div class="top"><h3>Ember ribeye</h3><span class="price">$32</span></div><p>Grilled over oak, smoked butter.</p></div>
    <div class="dish" data-ff-m="up"><div class="top"><h3>Saffron risotto</h3><span class="price">$19</span></div><p>Aged parmesan, lemon.</p></div>
  </div>
</section>
<section class="section">
  <h2 data-ff-m="up">From the kitchen</h2>
  <div class="gallery">
    <img src="https://picsum.photos/seed/r1/400/400" alt="" data-ff-m="zoom">
    <img src="https://picsum.photos/seed/r2/400/400" alt="" data-ff-m="zoom">
    <img src="https://picsum.photos/seed/r3/400/400" alt="" data-ff-m="zoom">
    <img src="https://picsum.photos/seed/r4/400/400" alt="" data-ff-m="zoom">
  </div>
</section>
<section class="cta" data-ff-m="zoom">
  <h2>Join us this weekend</h2>
  <a class="btn" href="#">Reserve now</a>
</section>
<footer>123 Market St · Open Tue–Sun · (555) 010-2030</footer>`,
});

// ---------------------------------------------------------------- Portfolio
const PORTFOLIO = doc({
  title: 'Maya Rivera — Portfolio',
  fonts: 'https://fonts.googleapis.com/css2?family=Sora:wght@400;600;800&family=Inter:wght@400;500&display=swap',
  css: `body{font-family:Inter,sans-serif;color:#18181b;line-height:1.6;background:#fafafa}
.sora{font-family:Sora,sans-serif}
.wrap{max-width:900px;margin:0 auto;padding:0 24px}
nav{display:flex;justify-content:space-between;align-items:center;max-width:900px;margin:0 auto;padding:26px 24px}
nav .logo{font-family:Sora;font-weight:800}
nav .links{display:flex;gap:22px;color:#52525b}
.hero{max-width:900px;margin:0 auto;padding:80px 24px 60px}
.hero .av{width:84px;height:84px;border-radius:50%;object-fit:cover;margin-bottom:24px}
.hero h1{font-family:Sora;font-size:clamp(36px,6.5vw,64px);font-weight:800;letter-spacing:-.02em;line-height:1.05}
.hero h1 .g{background:linear-gradient(90deg,#6366f1,#ec4899);-webkit-background-clip:text;background-clip:text;color:transparent}
.hero p{margin-top:20px;font-size:20px;color:#52525b;max-width:560px}
.section{max-width:900px;margin:0 auto;padding:60px 24px}
.section h2{font-family:Sora;font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:#a1a1aa;margin-bottom:26px}
.proj{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}
.proj a{display:block;border-radius:18px;overflow:hidden;background:#fff;border:1px solid #ececef;transition:transform .3s ease}
.proj a:hover{transform:translateY(-6px)}
.proj img{aspect-ratio:16/10;object-fit:cover}
.proj .meta{padding:18px}
.proj h3{font-family:Sora;font-size:19px;font-weight:600}
.proj p{color:#71717a;font-size:14px}
.about{font-family:Sora;font-size:clamp(22px,3.5vw,34px);font-weight:600;line-height:1.4;letter-spacing:-.01em}
.cta{max-width:900px;margin:0 auto 70px;padding:0 24px}
.cta .box{background:#18181b;color:#fafafa;border-radius:24px;padding:56px 28px;text-align:center}
.cta h2{font-family:Sora;font-size:clamp(26px,4.5vw,42px);font-weight:800;color:#fafafa;letter-spacing:-.02em}
.btn{display:inline-block;background:#fafafa;color:#18181b;padding:14px 26px;border-radius:12px;font-weight:600;margin-top:18px}
footer{text-align:center;padding:36px 24px;color:#a1a1aa}
@media(max-width:640px){nav .links{display:none}}`,
  body: `<nav>
  <div class="logo">Maya R.</div>
  <div class="links"><a href="#">Work</a><a href="#">About</a><a href="#">Contact</a></div>
</nav>
<header class="hero">
  <img class="av" src="https://picsum.photos/seed/maya/160/160" alt="Maya" data-ff-m="up">
  <h1 data-ff-m="up">Product designer crafting <span class="g">human</span> interfaces.</h1>
  <p data-ff-m="up">I help startups turn complex ideas into clear, delightful products.</p>
</header>
<section class="section">
  <h2 data-ff-m="up">Selected work</h2>
  <div class="proj">
    <a href="#" data-ff-m="up"><img src="https://picsum.photos/seed/p1/640/400" alt=""><div class="meta"><h3>Fintech app</h3><p>End-to-end product design</p></div></a>
    <a href="#" data-ff-m="up"><img src="https://picsum.photos/seed/p2/640/400" alt=""><div class="meta"><h3>Health platform</h3><p>Design system & web</p></div></a>
    <a href="#" data-ff-m="up"><img src="https://picsum.photos/seed/p3/640/400" alt=""><div class="meta"><h3>Travel brand</h3><p>Identity & site</p></div></a>
    <a href="#" data-ff-m="up"><img src="https://picsum.photos/seed/p4/640/400" alt=""><div class="meta"><h3>Music startup</h3><p>Mobile app</p></div></a>
  </div>
</section>
<section class="section">
  <h2 data-ff-m="up">About</h2>
  <p class="about" data-ff-m="up">For 8 years I've partnered with teams worldwide to design products people genuinely enjoy using — from first sketch to shipped release.</p>
</section>
<section class="cta">
  <div class="box" data-ff-m="zoom">
    <h2>Let's work together</h2>
    <a class="btn" href="#">Get in touch</a>
  </div>
</section>
<footer>© 2026 Maya Rivera</footer>`,
});

export const BLANK_TEMPLATE: Template = {
  id: 'blank',
  name: 'Blank page',
  category: 'Blank',
  description: 'A clean, professional starting point.',
  entryFile: 'index.html',
  files: { 'index.html': BLANK },
};

export const TEMPLATES: Template[] = [
  { id: 'agency', name: 'Creative Agency', category: 'Agency', description: 'Bold dark studio landing with parallax & reveals.', entryFile: 'index.html', files: { 'index.html': AGENCY } },
  { id: 'saas', name: 'SaaS / Startup', category: 'SaaS', description: 'Clean product page with features & pricing.', entryFile: 'index.html', files: { 'index.html': SAAS } },
  { id: 'local', name: 'Restaurant / Local', category: 'Local', description: 'Warm local-business page with menu & gallery.', entryFile: 'index.html', files: { 'index.html': LOCAL } },
  { id: 'portfolio', name: 'Portfolio', category: 'Portfolio', description: 'Elegant personal portfolio with work grid.', entryFile: 'index.html', files: { 'index.html': PORTFOLIO } },
];

export const ALL_STARTERS: Template[] = [BLANK_TEMPLATE, ...TEMPLATES];
