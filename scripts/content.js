// content.js — listens for url changes broadcast by background.js so the
// Save-button interceptor is re-attached after in-app (SPA) navigation.
chrome.runtime.onMessage.addListener(function (request) {
  if (request.message === "hello!") {
    if (/inflight/.test(request.url)) {
      replaceButton();
    }
  }
});
