// Small enhancements: discourage saving protected videos, confirm matching passwords,
// and show a slim buy bar on phones once the hero's button has scrolled away.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('video[data-protect]').forEach((v) => {
    v.addEventListener('contextmenu', (e) => e.preventDefault());
    v.setAttribute('disablepictureinpicture', '');
  });

  const pw = document.getElementById('password');
  const confirm = document.getElementById('confirm');
  if (pw && confirm) {
    const check = () => confirm.setCustomValidity(confirm.value && confirm.value !== pw.value ? "Passwords don't match." : '');
    pw.addEventListener('input', check);
    confirm.addEventListener('input', check);
  }

  const bar = document.getElementById('stickybar');
  const hero = document.getElementById('hero-cta');
  if (bar && hero && 'IntersectionObserver' in window) {
    const price = document.getElementById('price');
    let heroVisible = true;
    let priceVisible = false;
    const update = () => { bar.hidden = heroVisible || priceVisible; };
    new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; update(); }).observe(hero);
    if (price) new IntersectionObserver(([e]) => { priceVisible = e.isIntersecting; update(); }).observe(price);
  }
});
