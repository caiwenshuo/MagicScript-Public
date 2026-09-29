// Editor for the saved texts captured by saveTexts.js. Only languages
// already captured are listed: their names must match App Store Connect's
// language menu exactly, so new languages come from a new capture.
// Emptying a text removes that language.
const languagesContainer = document.getElementById("languages");
const saveButton = document.getElementById("save");
const message = document.getElementById("message");

// Preselect the Position passed by the popup (?type=promotionalText).
const requestedType = new URLSearchParams(location.search).get("type");
const requestedRadio = document.querySelector(
  'input[name="type"][value="' + requestedType + '"]',
);
if (requestedRadio) requestedRadio.checked = true;

document.querySelectorAll('input[name="type"]').forEach((radio) => {
  radio.addEventListener("change", () => render(""));
});
saveButton.addEventListener("click", save);
render("");

function getSelectedType() {
  return document.querySelector('input[name="type"]:checked').value;
}

function render(statusText) {
  const position = getSelectedType();
  chrome.storage.local.get("savedTexts", function (result) {
    const saved = result.savedTexts && result.savedTexts[position];
    languagesContainer.replaceChildren();
    message.textContent = statusText;
    if (!saved) {
      saveButton.style.display = "none";
      message.textContent =
        'No text saved for this position. Open a version in App Store Connect and use "Save current texts" in the MagicScript popup first.';
      return;
    }
    saveButton.style.display = "";
    Object.keys(saved.texts).forEach((language, index) => {
      const block = document.createElement("div");
      block.className = "language";
      const label = document.createElement("label");
      label.textContent = language;
      label.htmlFor = "language-" + index;
      const textarea = document.createElement("textarea");
      textarea.id = "language-" + index;
      textarea.dataset.language = language;
      textarea.value = saved.texts[language];
      block.append(label, textarea);
      languagesContainer.append(block);
    });
  });
}

function save() {
  const position = getSelectedType();
  const texts = {};
  for (const textarea of languagesContainer.querySelectorAll("textarea")) {
    if (textarea.value.trim()) texts[textarea.dataset.language] = textarea.value;
  }
  chrome.storage.local.get("savedTexts", function (result) {
    const savedTexts = result.savedTexts || {};
    if (Object.keys(texts).length === 0) {
      delete savedTexts[position];
    } else {
      savedTexts[position] = { texts: texts, date: new Date().toJSON() };
    }
    chrome.storage.local.set({ savedTexts: savedTexts }, function () {
      render("Saved.");
    });
  });
}
