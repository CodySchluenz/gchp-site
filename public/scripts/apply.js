// Progressive enhancement only: without JavaScript, the "+ Add another"
// buttons submit the form and the server re-renders with an extra row.
// With JavaScript, we add the row instantly instead. Limits mirror the
// server's MAX_MEMBERS (15) and MAX_EMPLOYERS (10) clamps.
(function () {
  var MAX = { member: 15, employer: 10 };

  document.querySelectorAll('[data-add]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      var kind = btn.getAttribute('data-add');
      var tpl = document.getElementById(kind + '-template');
      var list = document.getElementById(kind + '-list');
      var countInput = document.querySelector('input[name="' + kind + '_count"]');
      if (!tpl || !list || !countInput) return; // fall back to server round trip

      var next = Number(countInput.value) + 1;
      if (!(next >= 2) || next > MAX[kind]) return; // at the cap: let the server answer

      e.preventDefault();
      countInput.value = String(next);
      list.insertAdjacentHTML('beforeend', tpl.innerHTML.replace(/__N__/g, String(next)));
      var first = list.lastElementChild.querySelector('input, select, textarea');
      if (first) first.focus();
    });
  });

  // If the server re-rendered with validation errors, take the applicant to
  // the first one. Without JavaScript the loud banner (with its jump links)
  // and the red field flagging carry this on their own.
  var firstInvalid = document.querySelector('[aria-invalid="true"]');
  if (firstInvalid && firstInvalid.focus) firstInvalid.focus();
})();
