/**
 * Self-contained scroll-motion engine shared by the editor runtime and the
 * starter templates. It runs as a plain `<script>` in the page (no framework,
 * no build step) so animations work identically in the editor preview and in
 * the exported/deployed static site.
 *
 * Elements opt in via `data-ff-m`:
 *   up | fade | left | right | zoom  -> revealed on scroll into view
 *   parallax (+ optional data-ff-speed) -> moved as the page scrolls
 *
 * It is idempotent (guards on window.__ffMotion) and respects
 * prefers-reduced-motion.
 */
export const MOTION_ENGINE_SRC =
  '(function(){' +
  'if(window.__ffMotion){window.__ffMotion.refresh();return;}' +
  'var reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;' +
  'if(!document.querySelector("style[data-ff-engine-css]")){var st=document.createElement("style");st.setAttribute("data-ff-engine-css","1");' +
  'st.textContent="[data-ff-m=fade],[data-ff-m=up],[data-ff-m=left],[data-ff-m=right],[data-ff-m=zoom]{opacity:0;transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1);will-change:opacity,transform}[data-ff-m=up]{transform:translateY(42px)}[data-ff-m=left]{transform:translateX(-42px)}[data-ff-m=right]{transform:translateX(42px)}[data-ff-m=zoom]{transform:scale(.9)}[data-ff-m][data-ff-in]{opacity:1!important;transform:none!important}";' +
  'document.head.appendChild(st);}' +
  'var io=new IntersectionObserver(function(es){for(var i=0;i<es.length;i++){if(es[i].isIntersecting)es[i].target.setAttribute("data-ff-in","1");else es[i].target.removeAttribute("data-ff-in");}},{threshold:.12});' +
  'var px=[];' +
  'function refresh(){var n=document.querySelectorAll("[data-ff-m]");px=[];for(var i=0;i<n.length;i++){var el=n[i];if(el.getAttribute("data-ff-m")==="parallax")px.push(el);else io.observe(el);}onScroll();}' +
  'function onScroll(){if(reduce)return;var vh=window.innerHeight||document.documentElement.clientHeight;for(var i=0;i<px.length;i++){var el=px[i],r=el.getBoundingClientRect();var p=(r.top+r.height/2-vh/2)/vh;var sp=parseFloat(el.getAttribute("data-ff-speed")||"0.25");el.style.transform="translateY("+(p*-120*sp)+"px)";}}' +
  'window.addEventListener("scroll",onScroll,{passive:true});window.addEventListener("resize",onScroll);' +
  'window.__ffMotion={refresh:refresh};refresh();' +
  '})();';

/** A `<script>` tag that boots the engine inside exported template HTML. */
export const MOTION_ENGINE_TAG = `<script data-ff-engine="1">${MOTION_ENGINE_SRC}</script>`;
