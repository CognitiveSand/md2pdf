# md2pdf Follow-ups

This file tracks deferred implementation work that is still required before the
v0.1 release.

## M4 - Browser-less Host Support

Status: planned before v0.1 release.

M4 currently detects installed Chrome/Chromium/Firefox browsers and provisions a
matching WebDriver. Hosts without any supported browser fail with
`BrowserNotFoundError`.

Follow-up work:

- Provision Chromium-for-Testing as the last-resort browser when no supported
  browser is installed.
- Provision the matching `chromedriver` into the per-user driver cache.
- Apply the same artifact freshness/quarantine policy used for driver
  provisioning.
- Add mocked catalog/cache tests for the browser provisioning path.
- Add a browser-backed smoke test once M5 WebDriver PDF rendering is available.
