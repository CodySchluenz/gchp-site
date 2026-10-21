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
      var card = list.lastElementChild;
      var first = card.querySelector('input, select, textarea');
      if (first) first.focus();
      if (card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Sherlyn 2026-10-21: say out loud that it worked and keep the running
      // count honest, so nobody sends a one-person household by accident.
      if (kind === 'member') {
        var status = document.getElementById('member-added');
        if (status) status.textContent = 'Person ' + next + ' added below. Fill in their name.';
        btn.textContent = '+ Add another person';
        document.querySelectorAll('[data-member-count]').forEach(function (el) { el.textContent = String(next); });
        document.querySelectorAll('[data-member-word]').forEach(function (el) { el.textContent = 'people'; });
      }
    });
  });

  // If the server re-rendered with validation errors, take the applicant to
  // the first one. Without JavaScript the loud banner (with its jump links)
  // and the red field flagging carry this on their own.
  var firstInvalid = document.querySelector('[aria-invalid="true"]');
  if (firstInvalid && firstInvalid.focus) firstInvalid.focus();
})();
