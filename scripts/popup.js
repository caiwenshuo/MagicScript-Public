// 为 execute 按钮添加事件监听器
document.getElementById("execute").addEventListener("click", executeScript);
document.getElementById("saveTexts").addEventListener("click", saveCurrentTexts);
document.getElementById("editSaved").addEventListener("click", () => {
    chrome.tabs.create({ url: `savedTextsEditor.html?type=${getSelectedType()}` });
});
// document.getElementById("history").addEventListener("click", openHistoryTab);
// document.getElementById("saveMetaData").addEventListener("click", saveDataClick);

// document.body.onload = readAutoSaveState;


const copyOptionRadios = document.querySelectorAll('input[name="copyOption"]');
        
// 获取 Text Group 容器
const textGroup = document.getElementById('textGroup');

const savedGroup = document.getElementById('savedGroup');

// 根据选中的操作显示 Text group 或 Saved text group
copyOptionRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        const operation = getSelectedOperation();
        textGroup.style.display = operation === 'copy_primary_translation' ? 'block' : 'none';
        savedGroup.style.display = operation === 'copy_saved' ? 'block' : 'none';
    });
});

// Saved text status follows the selected Position and any saved change.
document.querySelectorAll('input[name="type"]').forEach(radio => {
    radio.addEventListener('change', refreshSavedStatus);
});
chrome.storage.onChanged.addListener((changes) => {
    if (changes.savedTexts) refreshSavedStatus();
});
refreshSavedStatus();

function refreshSavedStatus() {
    const position = getSelectedType();
    chrome.storage.local.get('savedTexts', function (result) {
        const saved = result.savedTexts && result.savedTexts[position];
        document.getElementById('savedStatus').textContent = saved
            ? `Saved text: ${Object.keys(saved.texts).length} languages, saved ${saved.date.slice(0, 10)}`
            : 'No saved text';
        // Editing requires a prior capture.
        document.getElementById('editSaved').style.display = saved ? '' : 'none';
    });
}

// Capture the selected field in every language of the displayed version.
async function saveCurrentTexts() {
    const currTab = await getTabId();
    await chrome.storage.local.set({ selectedType: getSelectedType() });
    chrome.scripting.executeScript({
        target: { tabId: currTab.id },
        files: ["scripts/shareFunctions.js", "scripts/saveTexts.js"]
    });
}

// Execution progress modal: the injected scripts write `pasteProgress` (see
// msReportProgress in shareFunctions.js). The modal blocks the popup while a
// script runs; "Close" hides it and clears the stored progress, which is
// also the way out if a run stops midway.
const progressOverlay = document.getElementById('progressOverlay');
const progressText = document.getElementById('progressText');
const progressClose = document.getElementById('progressClose');

function showProgress(text) {
    progressText.textContent = text;
    progressOverlay.hidden = false;
    progressClose.focus();
}

progressClose.addEventListener('click', () => {
    progressOverlay.hidden = true;
    chrome.storage.local.set({ pasteProgress: '' });
});
chrome.storage.onChanged.addListener((changes) => {
    // An empty value is a reset: it never hides the modal by itself.
    if (changes.pasteProgress && changes.pasteProgress.newValue) {
        showProgress(changes.pasteProgress.newValue);
    }
});
// Reopening the popup during (or right after) a run shows its progress.
chrome.storage.local.get('pasteProgress', (result) => {
    if (result.pasteProgress) showProgress(result.pasteProgress);
});

// 获取当前选中的类型（whatsNew 或 promotionalText）
function getSelectedType() {
    return document.querySelector('input[name="type"]:checked').value;
}

function getSelectedPlatform() {
    return document.querySelector('input[name="platformType"]:checked').value;
}

// 获取当前选中的操作（copy_latest、copy_primary 或 copy_primary_translation）
function getSelectedOperation() {
    return document.querySelector('input[name="copyOption"]:checked').value;
}

// 处理 execute 按钮点击，根据选中的类型和操作执行对应的功能
async function executeScript() {
    // 说明：展示执行中的提示，引导用户等待页面自动修改
    showProgress('Starting… Please wait until the content on the page begins to change.');
    let currTab = await getTabId();
    let selectedType = getSelectedType(); // 获取选中的类型
    let selectedOperation = getSelectedOperation(); // 获取选中的操作
    let selectedPlatform = getSelectedPlatform(); // 获取选中的平台
    let scriptFiles = ["scripts/shareFunctions.js"];


    console.log("selectedPlatform", selectedPlatform)
    // 设置全局变量
    // pasteProgress is reset so the same final message still fires onChanged,
    // and so a run that stops early (alert) leaves nothing stale behind.
    await chrome.storage.local.set({ selectedPlatform: selectedPlatform, selectedType: selectedType, pasteProgress: '' });

    // 根据选中的操作和类型决定加载哪些脚本
    switch (selectedOperation) {
        case "copy_latest":
            // 说明：埋点服务依赖 config.js 中的私有配置，因此需要优先注入 config.js。
            scriptFiles.push("scripts/config.js", "scripts/eventTracker.js", `scripts/${selectedType}.js`);
            break;
        case "copy_primary":
            // 同上，保证 EventTracker 能够正确读取埋点服务地址。
            scriptFiles.push("scripts/config.js", "scripts/eventTracker.js", `scripts/${selectedType}Primary.js`);
            break;
        case "copy_primary_translation":
            // 说明：当使用翻译功能时，额外注入 config.js（如果存在）用于提供私有翻译服务地址。
            // scripts/config.js 应该由开发者在本地从 config.template.js 拷贝生成，并在 .gitignore 中忽略。
            scriptFiles.push("scripts/config.js", "scripts/eventTracker.js", "scripts/translate.js", `scripts/${selectedType}PrimaryTranslation.js`);
            const textContent = document.getElementById('inputText').value;
            chrome.storage.local.set({ 'textContent': textContent }, function() {
                chrome.scripting.executeScript({
                    target: { tabId: currTab.id },
                    files: scriptFiles
                });
            });
            return;
        case "copy_saved":
            scriptFiles.push("scripts/savedTexts.js");
            break;
        default:
            console.log("No operation selected");
            return;
    }

    // 执行 Chrome 脚本
    chrome.scripting.executeScript({
        target: { tabId: currTab.id },
        files: scriptFiles
    });
}

// 获取当前活动标签页
async function getTabId() {
    let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab;
}

// 打开历史记录页面
// function openHistoryTab() {
//     chrome.tabs.create({ url: "history.html" });
// }

// // 读取 `autoSave` 状态
// function readAutoSaveState() {
//     chrome.storage.local.get('autoSave', function (result) {
//         document.getElementById("saveMetaData").checked = result.autoSave || false;
//     });
// }

// 处理 `autoSave` 选项变化
// function saveDataClick() {
//     let result = { 'autoSave': document.getElementById("saveMetaData").checked };
//     chrome.storage.local.set(result);
// }
