document.addEventListener("DOMContentLoaded", async () => {
  const autoCloseEmptyCheckbox = document.getElementById("auto-close-empty");
  const markEmptyCheckbox = document.getElementById("mark-empty");
  const closeNewTabsCheckbox = document.getElementById("close-new-tabs");
  const closeAllTabsButton = document.getElementById("close-all-tabs");
  const applyButton = document.getElementById("apply");
  const tabCountSpan = document.getElementById("tab-count");
  const unloadedTabCountSpan = document.getElementById("unloaded-tab-count");

  // Retrieve saved options and set checkbox states
  chrome.storage.local.get(
    [
      "autoCloseEmpty",
      "markEmpty",
      "closeAllAfterDelay",
      "closeNewTabsAfterDelay",
    ],
    (result) => {
      autoCloseEmptyCheckbox.checked = result.autoCloseEmpty || false;
      markEmptyCheckbox.checked = result.markEmpty || false;
      closeNewTabsCheckbox.checked = result.closeNewTabsAfterDelay || false;
      closeAllTabsButton.textContent = result.closeAllAfterDelay
        ? "Cancel Close All Tabs"
        : "Close All Tabs After 2 Minutes";
    }
  );

  // Update tab counts
  updateTabCounts();

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateUnloadedTabsCount") {
      unloadedTabCountSpan.textContent = request.count;
    }
  });

  // Apply the selected options
  applyButton.addEventListener("click", () => {
    const autoCloseEmpty = autoCloseEmptyCheckbox.checked;
    const markEmpty = markEmptyCheckbox.checked;
    const closeNewTabsAfterDelay = closeNewTabsCheckbox.checked;

    // Save the settings in storage
    chrome.storage.local.set({
      autoCloseEmpty,
      markEmpty,
      closeNewTabsAfterDelay,
    });

    // Notify the user that settings have been applied
    alert("Settings applied successfully!");
  });

  // Handle "Close All Tabs After 2 Minutes" button click
  closeAllTabsButton.addEventListener("click", () => {
    chrome.storage.local.get(["closeAllAfterDelay"], (result) => {
      const newState = !result.closeAllAfterDelay;
      chrome.storage.local.set({ closeAllAfterDelay: newState });
      closeAllTabsButton.textContent = newState
        ? "Cancel Close All Tabs"
        : "Close All Tabs After 2 Minutes";

      // Send message to background script
      chrome.runtime.sendMessage({
        action: "closeAllTabsAfterDelay",
        start: newState,
      });
    });
  });
});

// Update tab counts
async function updateTabCounts() {
  let tabs = await chrome.tabs.query({});
  document.getElementById("tab-count").textContent = tabs.length;

  let unloadedTabs = tabs.filter((tab) => tab.status === "unloaded");
  document.getElementById("unloaded-tab-count").textContent =
    unloadedTabs.length;
}
