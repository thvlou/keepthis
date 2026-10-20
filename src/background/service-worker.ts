/**
 * MV3 service worker shell.
 * Snapshot orchestration, local diff, storage repository, and the Gemini
 * client are not implemented yet (later steps in CLAUDE.md section 15).
 * This handles only enough message actions to prove the extension shell
 * (manifest -> service worker -> Side Panel) is wired correctly.
 */

import type { MessageRequest, MessageResponse } from "../shared/messages";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // No toolbar action surface in this Chrome version; side panel can still
    // be opened from the extensions menu.
  });
});

async function handleGetActiveRoute(): Promise<MessageResponse<"GET_ACTIVE_ROUTE">> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    return {
      ok: false,
      error: { code: "UNSUPPORTED_PAGE", message: "No active tab URL available." },
    };
  }
  return { ok: true, data: { fullUrl: tab.url } };
}

chrome.runtime.onMessage.addListener((message: MessageRequest<"GET_ACTIVE_ROUTE">, _sender, sendResponse) => {
  if (message?.action === "GET_ACTIVE_ROUTE") {
    handleGetActiveRoute().then(sendResponse);
    return true;
  }
  return false;
});
