// CSP-safe print: the site's script-src 'self' blocks inline onclick handlers,
// so print buttons opt in with data-print and we wire them up here.
document.querySelectorAll('[data-print]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    window.print();
  });
});

// CSP-safe confirm: forms opt in with data-confirm; block submit if the
// operator cancels. (Inline onsubmit is blocked by script-src 'self'.)
document.querySelectorAll('form[data-confirm]').forEach(function (form) {
  form.addEventListener('submit', function (e) {
    if (!window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
  });
});
