// background.js

// 1) Create the “Detectify” context‐menu and its submenus.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "detectify",
      title: "Detectify",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "scan",
      parentId: "detectify",
      title: "Scan",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "deep_scan",
      parentId: "detectify",
      title: "Deep Scan",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "cancel",
      parentId: "detectify",
      title: "Cancel",
      contexts: ["selection"]
    });
  });
});

// 2) Open popup.html when the user clicks “Scan” or “Deep Scan”.
//    Save the selected text and mode (“normal” or “deep”) in chrome.storage.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "cancel") return;
  if (!info.selectionText) return;

  const selection = info.selectionText;
  const mode = info.menuItemId === "deep_scan" ? "deep" : "normal";

  chrome.storage.local.set({ text: selection, mode: mode }, () => {
    // Open the popup window to display the scan UI
    chrome.windows.create({
      url: chrome.runtime.getURL("popup.html"),
      type: "popup",
      width: 400,
      height: 600
    });
  });
});

// 3) Remove all code that fetches directly from OpenAI in background.js.
//    Instead, the popup script (popup.js) will call your backend’s /api/factcheck route.
//    Therefore, we no longer need to listen for “fetchFromOpenAI” here.
