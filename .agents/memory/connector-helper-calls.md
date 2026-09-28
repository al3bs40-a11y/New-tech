---
name: Connector helper calls
description: A CodeExecution quirk affecting Replit connector helpers.
---

Call connector helpers such as `listConnections` using the documented `"use impure"` pattern. In this runtime, a `typeof` probe reported `undefined` even though a direct invocation in the same context worked; do not treat that probe as proof the connector is unavailable.

**Why:** The false probe nearly blocked an authenticated GitHub operation despite an added, healthy connection.

**How to apply:** Follow the integration skill's documented call pattern and make a minimal real API request only when ready to use the connection. Avoid speculative credential-fetch calls.