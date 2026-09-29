// Captures the selected field (What's New or Promotional Text) in every
// localization of the version currently displayed and stores it as the
// saved texts, reused later by savedTexts.js. Injected by popup.js.
// No top-level const/let: this file may be injected several times.
chrome.storage.local.get(["selectedType", "savedTexts"], function (result) {
  const position = result.selectedType;
  const languages = {};
  getMenu(languages);
  if (
    Object.keys(languages).length === 0 ||
    !document.querySelector('[name="' + position + '"]')
  ) {
    window.alert(
      "Open an app version page in App Store Connect first, then save the texts again.",
    );
    return;
  }

  // Switch to each language and read the field; empty fields are skipped so
  // they never overwrite a real text when applied.
  const texts = {};
  for (const language in languages) {
    msEnsureLanguageMenuOpen();
    for (const item of msGetLocaleItems()) {
      if (msLangName(item) == language) {
        item.click();
        const text = copyWhatsnew(position);
        if (text) texts[language] = text;
      }
    }
  }

  const count = Object.keys(texts).length;
  if (count === 0) {
    window.alert(
      "The " + position + " field is empty in every language: nothing saved.",
    );
    return;
  }

  const savedTexts = result.savedTexts || {};
  savedTexts[position] = { texts: texts, date: new Date().toJSON() };
  chrome.storage.local.set({ savedTexts: savedTexts }, function () {
    window.alert(
      "Saved " + position + " text for " + count + " languages.",
    );
  });
});
