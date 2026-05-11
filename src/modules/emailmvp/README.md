# Email MVP module

Isolated email MVP feature: JWT auth, SMTP/IMAP helpers, Google OAuth for Gmail, and email templates. Mounted at `/api/mvp` from `src/index.js`.

Uses the main app MongoDB connection (`MONGO_URI`); models live under this folder. This module was moved from `microservices/emailmvp/` as part of backend structural refactoring (Batch B5).
