let closeAllTabsTimeout;
const MAX_TABS = 10;
let autoCloseEmpty = false;
let markEmpty = false;
let closeAllAfterDelay = false;
let unloadedTabsCount = 0;
let unusedTabsCount = 0;
let closeUnusedTabsAfterDelay = false;

// Function to initialize extension state
function initializeExtension() {
  chrome.storage.local.get(
    [
      "autoCloseEmpty",
      "markEmpty",
      "maxTabs",
      "closeAllAfterDelay",
      "closeUnusedTabsAfterDelay",
    ],
    (result) => {
      autoCloseEmpty = result.autoCloseEmpty || false;
      markEmpty = result.markEmpty || false;
      closeAllAfterDelay = result.closeAllAfterDelay || false;
      closeUnusedTabsAfterDelay = result.closeUnusedTabsAfterDelay || false;

      if (autoCloseEmpty) {
        startAutoCloseEmptyTabs();
      }
      if (markEmpty) {
        startMarkEmptyTabs();
      }
      if (closeAllAfterDelay) {
        startCloseAllTabsTimer();
      }
      updateTabCounts();
    }
  );
}

// Function to update tab counts
async function updateTabCounts() {
  try {
    let tabs = await chrome.tabs.query({});
    unloadedTabsCount = tabs.filter((tab) => tab.status === "unloaded").length;
    unusedTabsCount = tabs.filter(
      (tab) => tab.status === "unloaded" || tab.url === "chrome://newtab/"
    ).length;

    chrome.runtime.sendMessage(
      {
        action: "updateTabCounts",
        unloadedCount: unloadedTabsCount,
        unusedCount: unusedTabsCount,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.log(
            "Popup is not open. Unloaded tabs count:",
            unloadedTabsCount,
            "Unused tabs count:",
            unusedTabsCount
          );
        }
      }
    );
  } catch (error) {
    console.error("Error updating tab counts:", error);
  }
}

// Listen for new tabs being created
chrome.tabs.onCreated.addListener(async (tab) => {
  try {
    let tabs = await chrome.tabs.query({});

    // If tab count exceeds the max limit, close the oldest tab
    if (tabs.length > MAX_TABS) {
      let oldestTab = tabs[0];
      await chrome.tabs.remove(oldestTab.id);
    }

    // If closeUnusedTabsAfterDelay is enabled, set a timer to close the new tab if unused
    if (closeUnusedTabsAfterDelay) {
      setTimeout(async () => {
        try {
          let updatedTab = await chrome.tabs.get(tab.id);
          if (
            updatedTab.status === "unloaded" ||
            updatedTab.url === "chrome://newtab/"
          ) {
            await chrome.tabs.remove(tab.id);
          }
        } catch (error) {
          console.error("Error closing unused tab after delay:", error);
        }
      }, 120000); // 2 minutes
    }

    await updateTabCounts();
  } catch (error) {
    console.error("Error handling new tab creation:", error);
  }
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  updateTabCounts().catch((error) => {
    console.error("Error updating tab counts on tab update:", error);
  });
});

// Listen for tab removals
chrome.tabs.onRemoved.addListener(() => {
  updateTabCounts().catch((error) => {
    console.error("Error updating tab counts on tab removal:", error);
  });
});

// On installation, set default values for settings
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set(
    {
      autoCloseEmpty: false,
      markEmpty: false,
      maxTabs: MAX_TABS,
      closeAllAfterDelay: false,
      closeUnusedTabsAfterDelay: false,
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error setting initial storage:",
          chrome.runtime.lastError
        );
      } else {
        initializeExtension();
      }
    }
  );
});

// Listen for changes in storage
chrome.storage.onChanged.addListener((changes, namespace) => {
  for (let key in changes) {
    if (key === "autoCloseEmpty") {
      autoCloseEmpty = changes[key].newValue;
      if (autoCloseEmpty) {
        startAutoCloseEmptyTabs();
      }
    } else if (key === "markEmpty") {
      markEmpty = changes[key].newValue;
      if (markEmpty) {
        startMarkEmptyTabs();
      }
    } else if (key === "closeAllAfterDelay") {
      closeAllAfterDelay = changes[key].newValue;
      if (closeAllAfterDelay) {
        startCloseAllTabsTimer();
      } else {
        clearTimeout(closeAllTabsTimeout);
      }
    } else if (key === "closeUnusedTabsAfterDelay") {
      closeUnusedTabsAfterDelay = changes[key].newValue;
    }
  }
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTabCounts") {
    sendResponse({
      unloadedCount: unloadedTabsCount,
      unusedCount: unusedTabsCount,
    });
  } else if (request.action === "closeAllTabsAfterDelay") {
    if (request.start) {
      startCloseAllTabsTimer();
    } else {
      clearTimeout(closeAllTabsTimeout);
    }
  } else if (request.action === "closeUnusedTabs") {
    closeUnusedTabs();
  }
});

function startAutoCloseEmptyTabs() {
  setInterval(async () => {
    if (autoCloseEmpty) {
      try {
        let tabs = await chrome.tabs.query({});
        for (let tab of tabs) {
          if (tab.url === "about:blank" || tab.url === "") {
            await chrome.tabs.remove(tab.id);
          }
        }
      } catch (error) {
        console.error("Error in autoCloseEmptyTabs:", error);
      }
    }
  }, 120000); // Check every 2 minutes
}

function startMarkEmptyTabs() {
  setInterval(async () => {
    if (markEmpty) {
      try {
        let tabs = await chrome.tabs.query({});
        for (let tab of tabs) {
          if (tab.url === "about:blank" || tab.url === "") {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              function: () => {
                if (!document.title.startsWith("[EMPTY] ")) {
                  document.title = "[EMPTY] " + document.title;
                }
              },
            });
          }
        }
      } catch (error) {
        console.error("Error in markEmptyTabs:", error);
      }
    }
  }, 60000); // Check every minute
}

function startCloseAllTabsTimer() {
  clearTimeout(closeAllTabsTimeout);
  closeAllTabsTimeout = setTimeout(closeAllTabs, 120000); // 120000 ms = 2 minutes
}

async function closeAllTabs() {
  try {
    let tabs = await chrome.tabs.query({});
    for (let tab of tabs) {
      await chrome.tabs.remove(tab.id);
    }
  } catch (error) {
    console.error("Error in closeAllTabs:", error);
  }
}

async function closeUnusedTabs() {
  try {
    let tabs = await chrome.tabs.query({});
    for (let tab of tabs) {
      if (tab.status === "unloaded" || tab.url === "chrome://newtab/") {
        await chrome.tabs.remove(tab.id);
      }
    }
    updateTabCounts();
  } catch (error) {
    console.error("Error in closeUnusedTabs:", error);
  }
}

// Initialize the extension
initializeExtension();
