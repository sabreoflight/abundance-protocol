// Small enhancements: discourage saving protected videos, and confirm matching passwords.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('video[data-protect]').forEach((v) => {
    v.addEventListener('contextmenu', (e) => e.preventDefault());
    v.setAttribute('disablepictureinpicture', '');
  });
  const pw = document.getElementById('password');
  const confirm = document.getElementById('confirm');
  if (pw && confirm) {
    const check = () => confirm.setCustomValidity(confirm.value && confirm.value !== pw.value ? "Passwords don't match." : '');
    pw.addEventListener('input', check); confirm.addEventListener('input', check);
  }
});
