// =====================================================================
// MagicScript — robust App Store Connect selectors (issue #1)
// ---------------------------------------------------------------------
// App Store Connect is built with styled-components: most of its CSS
// classes (e.g. "cMUEAH", "eeVlrs") are content hashes that Apple
// regenerates on every front-end build. Hardcoding them breaks the
// extension whenever Apple ships an update. The helpers below rely only
// on STABLE attributes: role, aria-*, data-*, name.
// =====================================================================

// Collapse whitespace (incl. non-breaking spaces) so names compare reliably.
function msNormalize(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

// Visible language name of a menu item, normalized.
function msLangName(item) {
  return msNormalize(item && item.textContent);
}

// Localized labels of App Store Connect's "Save" button, lowercase.
// Add your UI language here if the Save button is not detected.
const MS_SAVE_LABELS = [
  "save", // English
  "enregistrer", // French
  "sichern", // German
  "guardar", // Spanish / Portuguese
  "salva", // Italian
  "salvar", // Portuguese (Brazil)
  "bewaren", // Dutch
  "spara", // Swedish
  "gem", // Danish
  "lagre", // Norwegian
  "tallenna", // Finnish
  "zapisz", // Polish
  "uložit", // Czech
  "保存", // Japanese / Chinese (Simplified)
  "儲存", // Chinese (Traditional)
  "저장", // Korean
  "сохранить", // Russian
];

// "Save" button in the version page header.
//
// App Store Connect gives this button no stable id/aria/data attribute, and
// the page header is restructured when there are unsaved changes — so no
// structural anchor is reliable. The button's accessible text, however, is
// the localized word for "Save", and it is the only such button on the
// page. We match that, restricted to type="button" (which the Save button
// uses and the neighbouring "Add for review" button does not).
function msGetSaveButton() {
  const typeButtons = [...document.querySelectorAll('button[type="button"]')];
  // Primary: match the localized "Save" label.
  const byLabel = typeButtons.find((button) =>
    MS_SAVE_LABELS.includes(msNormalize(button.textContent).toLowerCase()),
  );
  if (byLabel) return byLabel;
  // Fallback for UI languages missing from the list above: on a "clean"
  // page the Save button is the only disabled type="button".
  const disabled = typeButtons.filter((button) => button.disabled);
  if (disabled.length === 1) return disabled[0];
  return null;
}

// Button that opens the language dropdown.
function msGetLanguageButton() {
  return document.querySelector(
    'button[aria-haspopup="menu"][aria-controls^="popover-content-"]',
  );
}

// Open the language menu if it is not already open. Returns false if the
// language button cannot be found.
function msEnsureLanguageMenuOpen() {
  const button = msGetLanguageButton();
  if (!button) return false;
  if (button.getAttribute("aria-expanded") !== "true") button.click();
  return true;
}

// Open language menu container (the button points to it via aria-controls).
function msGetLanguageMenu() {
  const button = msGetLanguageButton();
  const menuId = button && button.getAttribute("aria-controls");
  return menuId ? document.getElementById(menuId) : null;
}

// Menu items for the app's EXISTING localizations.
// The dropdown mixes existing localizations with "add a language" entries;
// we exclude the latter so the extension never creates empty localizations.
function msGetLocaleItems() {
  const menu = msGetLanguageMenu();
  if (!menu) return [];
  return [...menu.querySelectorAll('[role="menuitem"]')].filter((item) => {
    const row = item.parentElement;
    // An existing localization has a "remove" button (data-id is stable).
    if (row && row.querySelector('[data-id^="removeLocale_"]')) return true;
    // The primary language has no remove button: its aria-label STARTS with
    // the language name ("English…, selected, Primary"). An "add" entry has
    // an aria-label like "Add X" where the name is at the end.
    const ariaLabel = msNormalize(item.getAttribute("aria-label"));
    if (!ariaLabel) return true; // existing localization with no special label
    return ariaLabel.startsWith(msLangName(item));
  });
}

// Set the value of a React-controlled <textarea>/<input> so App Store
// Connect registers it as a real edit. Assigning .value directly is ignored
// by React: it overrides the instance "value" property and keeps its own
// value tracker. Calling the NATIVE prototype setter bypasses that override,
// and a bubbling "input" event then makes React's tracker fire onChange.
function msSetFieldValue(field, value) {
  const prototype =
    field.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value").set;
  field.focus();
  nativeSetter.call(field, value == null ? "" : value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
  field.blur();
}

// pageCheck 负责在 App Store Connect 的分发页面上定位指定平台下的版本列表，
// 并根据 directToInflight 参数决定是跳转到 inflight 还是 deliverable。
function pageCheck(end, directToInflight = false) {
  // App Store Connect 左侧平台列表容器（iOS / macOS / tvOS 等）
  const platforms = document.querySelector('[class="Box-sc-18eybku-0 bHeRUM"]');
  let ul;

  const url = window.location.toString();

  // 如果不在 distribution 页面，则提醒用户先切到正确页面
  if (!platforms || url.indexOf("distribution") === -1) {
    window.alert(
      "Go the page in App Store Connect where you can edit your app's description first. \n\nThe URL will be like https://appstoreconnect.apple.com/apps/yourAppid/distribution/ios/version/inflight",
    );
    return { success: false, ul: ul };
  }

  let seletedPlatformExist = false;
  for (let platform of platforms.children) {
    if (
      platform.firstChild &&
      platform.firstChild.firstChild &&
      platform.firstChild.firstChild.textContent.indexOf(end.toString()) > -1
    ) {
      // platform.children[1] 是当前平台下「版本列表」的容器
      ul = platform.children[1];
      seletedPlatformExist = true;
      break;
    }
  }

  if (!seletedPlatformExist || !ul) {
    window.alert("The platform you selected is not found");
    return { success: false, ul: ul };
  }

  // 不存在待发布页面，则提醒需要创建新版本
  let hasInflight = false;
  let target = ul;
  // 未发布的 1.0 版本 DOM 结构与正常版本略不同，这里做一次兼容处理
  if (ul.children.length === 1) {
    if (
      ul.firstChild &&
      ul.firstChild.firstChild &&
      ul.firstChild.firstChild.tagName === "DIV"
    ) {
      target = ul.firstChild;
    }
  }

  for (let child of target.children) {
    if (
      child.firstChild &&
      child.firstChild.getAttribute("href") &&
      child.firstChild.getAttribute("href").indexOf("inflight") > -1
    ) {
      hasInflight = true;
    }
  }

  if (!hasInflight) {
    window.alert("Create a new version first");
    return { success: false, ul: ul };
  }

  // 根据 directToInflight 决定是跳到 inflight 还是 deliverable
  if (directToInflight) {
    for (let child of target.children) {
      if (
        child.firstChild &&
        child.firstChild.getAttribute("href") &&
        child.firstChild.getAttribute("href").indexOf("inflight") > -1
      ) {
        child.firstChild.click();
        return { success: true, ul: ul };
      }
    }
  } else {
    for (let child of target.children) {
      if (
        child.firstChild &&
        child.firstChild.getAttribute("href") &&
        child.firstChild.getAttribute("href").indexOf("deliverable") > -1
      ) {
        child.firstChild.click();
        return { success: true, ul: ul };
      }
    }
  }

  return { success: false, ul: ul };
}

// Open the language menu and record every existing localization as a key
// of copyContents. Returns the localization menu items.
function getMenu(copyContents) {
  if (!msEnsureLanguageMenuOpen()) {
    console.warn("[MagicScript] language button not found");
    return [];
  }

  const items = msGetLocaleItems();
  if (items.length === 0) {
    console.warn("[MagicScript] no localizations found in the language menu");
    return [];
  }

  for (const item of items) {
    copyContents[msLangName(item)] = "";
  }
  return items;
}

function copyAndPaste(position, ul) {
  var copyContents = {};
  getMenu(copyContents);
  // 遍历并切换语言，将每种语言下的内容保存到词典中
  for (let language in copyContents) {
    msEnsureLanguageMenuOpen();
    for (let item of msGetLocaleItems()) {
      if (msLangName(item) == language) {
        item.click();
        copyContents[language] = copyWhatsnew(position);
      }
    }
  }
  // 切换到准备发布的 tab
  ul.firstChild.firstChild.click();
  // 使用迭代的方式实现所有语言的粘贴
  setTimeout(() => {
    if (Object.keys(copyContents).length > 0) {
      pasteWhatsnew(0, Object.keys(copyContents), position, copyContents);
    }
  }, 3000);
}

async function copyAndPastePrimary(position, ul, isTranslation = false) {
  var copyContents = {};
  getMenu(copyContents);

  // 复制主语言（菜单的第一个 item）
  msEnsureLanguageMenuOpen();
  const primaryItems = msGetLocaleItems();
  if (primaryItems.length === 0) {
    console.warn("[MagicScript] no localizations found");
    return;
  }
  primaryItems[0].click();
  let primaryContent = copyWhatsnew(position);

  let translateResult;
  if (isTranslation) {
    let languageList = Object.keys(copyContents);
    let textContent = await fetchTextContent();
    translateResult = await translate(textContent, languageList);
  }

  // 遍历并切换语言，将主语言内容（或翻译结果）保存到词典中
  for (let language in copyContents) {
    msEnsureLanguageMenuOpen();
    for (let item of msGetLocaleItems()) {
      if (msLangName(item) == language) {
        item.click();
        copyContents[language] = isTranslation
          ? translateResult[language]
          : primaryContent;
      }
    }
  }

  // 切换到准备发布的 tab
  ul.firstChild.firstChild.click();
  // 使用迭代的方式实现所有语言的粘贴
  setTimeout(() => {
    if (Object.keys(copyContents).length > 1) {
      pasteWhatsnew(0, Object.keys(copyContents), position, copyContents);
    }
  }, 3000);
}

function copyWhatsnew(position) {
  const element = document.querySelector('[name="' + position + '"]');
  if (!element) {
    console.warn("[MagicScript] field not found:", position);
    return "";
  }
  // App Store Connect's metadata fields are <textarea>/<input> — read .value.
  if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
    return element.value;
  }
  // Fallback for a contenteditable rich editor.
  if (element.querySelector("div") != null) {
    return Array.from(element.childNodes)
      .map((node) => (node.innerHTML === "<br>" ? "" : node.innerText))
      .join("\n")
      .trim();
  }
  return element.textContent || "";
}

function copyInput(position) {
  const input = document.querySelector('[name="' + position + '"]');
  if (!input) {
    console.warn("[MagicScript] field not found:", position);
    return "";
  }
  return input.value;
}

// pasteWhatsnew 接收语言名称数组（languages），因为菜单会重新渲染，
// 不能保存 DOM 元素引用，必须每次按语言名称重新匹配。
function pasteWhatsnew(index, languages, position, copyContents) {
  const targetLanguage = languages[index];

  // 切换语言：每次重新获取菜单项并按名称匹配
  msEnsureLanguageMenuOpen();
  for (let item of msGetLocaleItems()) {
    if (msLangName(item) == targetLanguage) {
      item.click();
    }
  }

  // 粘贴文本（字段在语言切换后会重新渲染，所以在 setTimeout 内重新查询）
  setTimeout(() => {
    const field = document.querySelector('[name="' + position + '"]');
    if (!field) {
      console.warn("[MagicScript] field not found:", position);
      return;
    }
    msSetFieldValue(field, copyContents[targetLanguage]);
  }, 1000);

  // 点击保存
  setTimeout(() => {
    const saveButton = msGetSaveButton();
    if (!saveButton) {
      console.warn("[MagicScript] save button not found");
      return;
    }
    if (saveButton.disabled) {
      console.warn(
        "[MagicScript] save button is disabled — the paste may not have",
        "registered as a change",
      );
    }
    saveButton.click();
  }, 2000);

  // 迭代到下一种语言
  setTimeout(() => {
    if (index < languages.length - 1) {
      pasteWhatsnew(index + 1, languages, position, copyContents);
    }
  }, 5000);
}

function getTextContent() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("textContent", function (result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.textContent);
      }
    });
  });
}

async function fetchTextContent() {
  try {
    return await getTextContent();
  } catch (error) {
    console.error("[MagicScript] error retrieving textContent:", error);
    return null;
  }
}
