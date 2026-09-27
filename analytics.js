(function () {
  try {
    var payload = JSON.stringify({
      path: location.pathname,
      referrer: document.referrer || ""
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/visit", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/analytics/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true
      }).catch(function(){});
    }
  } catch (e) {}
})();