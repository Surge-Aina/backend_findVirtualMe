# Legacy verticals (quarantined)

These folders hold **legacy, vertical-specific** Express routes, controllers, and Mongoose models that predate the modular `src/modules/` layout. HTTP paths are unchanged; only filesystem locations moved (Phase 1, Batch B2).

| Folder | Former location (repo root) |
|--------|-----------------------------|
| `project-manager/` | `controllers/projectManager`, `routes/projectManager`, `models/projectManager` |
| `photographer/` | `controllers/photographer`, `routes/photographer`, `models/photographer`, plus Drive OAuth (`oauth-handler.js`) and Cloudinary (`cloudinary-config.js`) |
| `local-vendor/` | `localFoodVendor` MVC paths |
| `healthcare/` | `routes/healthcare`, `models/healthcare` |
| `handyman/` | `handyMan` routes/models, `handyman` controllers |
| `data-scientist/` | `dataScientist` MVC |
| `software-engineer/models/` | former `models/softwareEngineer` (minimal / unused in production) |

**Wiring:** `routes.js` re-exports routers and photographer OAuth helpers (`runOAuthEnvSetup`, `registerPhotographerOAuthRoutes`). `src/index.js` composes the app as before.

**Next:** Later batches move features into `src/modules/`; normalization of public API paths is Phase 3 (coordinated with frontend).
