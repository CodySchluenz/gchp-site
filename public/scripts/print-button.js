// CSP-safe print: the site's script-src 'self' blocks inline onclick handlers,
// so print buttons opt in with data-print and we wire them up here.
document.querySelectorAll('[data-print]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    window.print();
  });
});
