# Lamar Frontend (React + Vite + TypeScript)

Frontend for the Lamar Health care plan intake app. Collects patient/provider/order data, supports PDF upload for patient records (drag & drop), handles confirmation modals, and downloads generated care plans as .txt.

## Tech
- React 19 + Vite
- TypeScript
- React Hook Form + Zod
- Tailwind CSS + shadcn/ui primitives
- react-dropzone (PDF upload)

## Quick Start
```bash
npm install
npm run dev
```

Local dev URLs:
- App: http://localhost:5173
- Backend (local): http://localhost:8000/api

The app auto-selects the local backend when running on localhost, otherwise uses `VITE_API_BASE_URL`.

## Environment
Create `.env.local` (or set in your host):
```
VITE_API_BASE_URL=https://lamar-backend-api.onrender.com/api
```

## Key Flows
- Patient intake form with validation
- Confirmation modals for:
  - MRN exists (name mismatch)
  - NPI exists (name mismatch)
  - Duplicate order for same MRN + medication
- PDF upload (drag/drop or click) → sends file to backend `/api/records/extract` → auto-fills textarea
- After successful order creation → auto-generate care plan (.txt) and download

## Scripts
```bash
npm run dev       # start dev server
npm run build     # production build
npm run preview   # preview build locally
npm run lint      # lint
```

## Project Structure (key paths)
```
lamar-frontend/
  src/
    pages/CarePlanForm.tsx   # primary intake form
    lib/api.ts               # API client helpers
    hooks/                   # react hooks
    components/ui/           # shadcn ui primitives
  public/                    # static assets
  README.md
```
