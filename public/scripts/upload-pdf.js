// One-button upload for admin paper-application screens (progressive
// enhancement). Without JavaScript, the classic two-step form still works:
// choose a file, then press Upload. With JavaScript, the button itself opens
// the file picker and publishes the chosen file in one motion — no separate
// "choose file" control for the operator to discover.
//
// Wired per-form (querySelectorAll) rather than a single querySelector: the
// paper-application screen hosts two of these side by side (family PDF,
// elderly/disabled PDF), and each must enhance independently.
(function () {
  document.querySelectorAll('[data-upload-form]').forEach(function (form) {
    var input = form.querySelector('input[type="file"]');
    var button = form.querySelector('[data-upload-button]');
    var fileRow = form.querySelector('[data-file-row]');
    if (!input || !button || !fileRow) return;

    // Take over: hide the confusing native control and make the button do it all.
    fileRow.hidden = true;
    input.required = false; // the button flow below guarantees a file is chosen
    button.textContent = 'Choose the PDF and publish it';

    button.addEventListener('click', function (e) {
      if (input.files.length === 0) {
        e.preventDefault(); // do not submit an empty form — open the picker instead
        input.click();
      }
      // With a file already chosen the click submits the form normally.
    });

    input.addEventListener('change', function () {
      if (input.files.length > 0) form.submit(); // picked a file: publish it now
    });
  });
})();
