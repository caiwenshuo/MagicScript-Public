// Intercepts the App Store Connect "Save" button so MagicScript can run
// before the native save. Robust selectors live in shareFunctions.js
// (msGetSaveButton / msGetLanguageMenu / msGetLocaleItems — see issue #1).
function replaceButton() {
  const saveElement = msGetSaveButton();
  if (!saveElement) {
    console.warn(
      "[MagicScript] Save button not found — App Store Connect layout may have changed.",
    );
    return;
  }
  saveElement.removeEventListener("click", clickSubmit);
  saveElement.addEventListener("click", clickSubmit);
}

function clickSubmit(event) {
  event.preventDefault();
  event.stopPropagation();
  chrome.storage.local.get("autoSave", function (result) {
    if (result.autoSave) {
      saveMetaData();
    }
    reproduceDefaultAction();
  });
}

function reproduceDefaultAction() {
  const saveElement = msGetSaveButton();
  if (!saveElement) {
    console.warn(
      "[MagicScript] Save button not found — cannot reproduce the default save action.",
    );
    return;
  }
  saveElement.removeEventListener("click", clickSubmit);
  saveElement.click();
  replaceButton();
}

function saveMetaData() {
  var copyContents = {};
  // 打开语言菜单并收集所有已存在的本地化语言
  if (!msEnsureLanguageMenuOpen()) {
    console.warn(
      "[MagicScript] language button not found — cannot save metadata.",
    );
    return;
  }
  const items = msGetLocaleItems();
  if (items.length === 0) {
    console.warn(
      "[MagicScript] no localizations found — cannot save metadata.",
    );
    return;
  }
  for (let item of items) {
    copyContents[msLangName(item)] = {};
  }

  // 解析 URL，保存应用 id 与平台
  let url = window.location.toString();
  let urlArray = url.split("/");
  let appId = urlArray[4];
  let platform = urlArray[6];

  // 获取 app 名称（_m_sub_title 仍然是一个稳定的 id）
  let appName = "";
  const subTitle = document.querySelector('[id="_m_sub_title"]');
  if (subTitle && subTitle.firstChild) {
    const span = subTitle.firstChild.querySelector("span");
    if (span) appName = span.innerText;
  }

  // 遍历并切换语言，将每种语言下的 metadata 保存到词典中
  let version = "";
  for (let language in copyContents) {
    msEnsureLanguageMenuOpen();
    for (let item of msGetLocaleItems()) {
      if (msLangName(item) == language) {
        item.click();
        copyContents[language]["whatsNew"] = copyWhatsnew("whatsNew");
        copyContents[language]["promotionalText"] =
          copyWhatsnew("promotionalText");
        copyContents[language]["description"] = copyWhatsnew("description");
        copyContents[language]["versionString"] = copyInput("versionString");
        copyContents[language]["keywords"] = copyInput("keywords");
        version = copyInput("versionString");
      }
    }
  }

  let date = new Date();
  let saveContents = {
    appName: appName,
    platform: platform,
    appId: appId,
    version: version,
    metadata: copyContents,
    date: date.toJSON(),
  };
  alert("Successfully saved the latest version of metadata!");
  chrome.storage.local.get("history", function (result) {
    if (Object.keys(result).length != 0) {
      result["history"].unshift(saveContents);
      chrome.storage.local.set(result, function () {});
    } else {
      let history = { history: [saveContents] };
      chrome.storage.local.set(history, function () {});
    }
  });
}
