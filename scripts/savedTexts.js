// Pastes the saved texts (see saveTexts.js) into every matching
// localization of the inflight version. Injected by popup.js.
// No top-level const/let: this file may be injected several times.
chrome.storage.local.get(
  ["selectedPlatform", "selectedType", "savedTexts"],
  function (result) {
    const position = result.selectedType;
    const saved = result.savedTexts && result.savedTexts[position];
    if (!saved || Object.keys(saved.texts).length === 0) {
      window.alert(
        "No text saved for " +
          position +
          '. Use "Save current texts" first.',
      );
      return;
    }

    const pageCheckResult = self.pageCheck(result.selectedPlatform, true);
    if (!pageCheckResult.success) return;

    // Wait for the inflight version page to load.
    setTimeout(() => {
      const versionLanguages = {};
      getMenu(versionLanguages);
      const all = Object.keys(versionLanguages);
      const languages = all.filter((language) => language in saved.texts);
      const skipped = all.filter((language) => !(language in saved.texts));
      if (skipped.length > 0) {
        console.warn(
          "[MagicScript] no saved text for:",
          skipped.join(", "),
        );
      }
      if (languages.length === 0) {
        window.alert(
          "None of this version's languages has a saved text.",
        );
        return;
      }
      pasteWhatsnew(0, languages, position, saved.texts);
    }, 3000);
  },
);
