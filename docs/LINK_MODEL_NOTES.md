## Device-Level Link Model

The legacy configuration stored links as simple `from`/`to` area ids. The new model keeps those fields for backward compatibility, but each link now tracks two explicit endpoints with optional device/interface metadata:

- `areaId` – required for both endpoints
- `deviceId` – optional, pairs the link to a specific device in that area
- `interface` / `interfaceType` – optional labels for wireless, LAN, fiber, etc.
- `label` – optional display name

### Migration & Normalization

`backend/server.js` normalizes every config load/save:

1. Legacy links are promoted into endpoint objects, inheriting the legacy `from`/`to` area ids.
2. Endpoints referencing missing devices are reset to area-only links.
3. Links with missing areas, duplicated endpoints, or invalid devices are dropped automatically. The server logs removals and the `/api/config` response includes `invalidLinksRemoved`.

On the frontend, the settings link editor flattens everything into two fully formed endpoints before persisting. The auto-save toast indicates when invalid links were cleaned up.

### Dashboard Rendering

`frontend/components/NetworkMap.tsx` now resolves links per-device:

- Lines reflect device ↔ device context, including intra-area arcs (dashed) when both endpoints share the same area.
- Tooltips show endpoint names and live latency.
- The area detail panel lists connected devices with status badges.

### When Manual Clean-up Is Needed

If a migration drops links (see `invalidLinksRemoved` or server logs), re-open the settings link editor to re-create them with proper device selections. This ensures the map and monitoring share the same device metadata.


