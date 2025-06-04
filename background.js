chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "detectify",
      title: "Detectify",
      contexts: ["selection"]
    });

    [
      { id: "scan", title: "Scan" },
      { id: "deep_scan", title: "Deep Scan" },
      { id: "cancel", title: "Cancel" }
    ].forEach(item => {
      chrome.contextMenus.create({
        id: item.id,
        parentId: "detectify",
        title: item.title,
        contexts: ["selection"]
      });
    });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "cancel" || !info.selectionText) return;

  const mode = info.menuItemId === "deep_scan" ? "deep" : "normal";

  chrome.storage.local.set({ text: info.selectionText, mode }, () => {
    chrome.windows.create({
      url: chrome.runtime.getURL("popup.html"),
      type: "popup",
      width: 400,
      height: 600
    });
  });
});
