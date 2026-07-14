// CSP-safe print: the site's script-src 'self' blocks inline onclick handlers,
// so print buttons opt in with data-print and we wire them up here.
document.querySelectorAll('[data-print]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    window.print();
  });
});

// CSP-safe confirm: a form OR a specific submit button opts in with data-confirm.
// Reading the submit event's submitter lets one form host both an unconfirmed
// submit (Save/Move) and a confirmed one (Delete) in the same editor row.
document.querySelectorAll('form').forEach(function (form) {
  form.addEventListener('submit', function (e) {
    var el = e.submitter;
    var msg = (el && el.getAttribute('data-confirm')) || form.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) e.preventDefault();
  });
});
