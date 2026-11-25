# Security

Report a vulnerability in Grid to [alex@comonad.co.uk](mailto:alex@comonad.co.uk).

Please include the page or endpoint, what you expected, and what you observed. Give us a chance to fix it before you publish the details.

Do not open a public GitHub issue for a vulnerability, and do not include tokens, cookies, or personal data in the report.

Grid is a public dashboard. The JSON API needs no key. Cron routes reject requests that do not carry `CRON_SECRET`.
