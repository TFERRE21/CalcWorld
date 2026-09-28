(function () {
  try {
    /* Google Analytics 4 / Google tag */
    var GA_ID = "G-5B028L6N42";

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {
      window.dataLayer.push(arguments);
    };

    if (!document.querySelector('script[src*="googletagmanager.com/gtag/js?id=' + GA_ID + '"]')) {
      var s = document.createElement("script");
      s.async = true;
      s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
      document.head.appendChild(s);
    }

    gtag("js", new Date());
    gtag("config", GA_ID);

    /* CalcWorld internal visit endpoint */
    var payload = JSON.stringify({
      path: location.pathname,
      referrer: document.referrer || ""
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/analytics/visit",
        new Blob([payload], { type: "application/json" })
      );
    } else {
      fetch("/api/analytics/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true
      }).catch(function () {});
    }
  } catch (e) {}
})();