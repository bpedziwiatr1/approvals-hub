# Web resource, not a PCF control

Approvals Hub ships as a single-file HTML web resource (React + Fluent UI v9, bundled with Vite) opened from a sitemap entry, not as a PCF control. A web resource gives a menu page immediately via `$webresource:`, with full control of layout and the least packaging ceremony; PCF would only pay off if the component had to be embedded in many forms or apps, which v1 does not need.
