## Description
<!-- What does this PR do? Why? -->

## Type of change
- [ ] `fix/*` — bug fix (no logic redesign)
- [ ] `feature/*` — new feature
- [ ] `staging/*` — staging validation
- [ ] `hotfix/*` — production emergency fix

## Critical files modified?
<!-- Check any that apply -->
- [ ] `CommercialEngine.jsx`
- [ ] `GlvPDF.jsx`
- [ ] `calculations.js`
- [ ] `App.jsx` (destination/port logic)
- [ ] `mediaAutoBinding.js`
- [ ] `server.js` / `database.js`
- [ ] `nixpacks.toml` / `railway.toml`
- [ ] None of the above

---

## Pre-merge validation checklist

**Complete ALL items before requesting merge. Leave unchecked items that were not affected.**

### Commercial calculations
- [ ] SCO generated successfully
- [ ] FCO generated successfully
- [ ] Shipment value = headCount × avgWeight × unitPrice (exact)
- [ ] Contract value = shipmentValue × frequency × duration (exact)
- [ ] No mortality deduction in commercial totals
- [ ] Stale state does not appear between consecutive SCO/FCO forms

### PDF rendering
- [ ] PDF cover page shows correct destination country
- [ ] PDF cover page shows correct destination port (user-selected, not PRICE_TABLE default)
- [ ] Section 3 "PRICE, VOLUME & VALUE" matches commercial table values exactly
- [ ] No overlapping or cut-off text
- [ ] Agent signature renders correctly

### Language
- [ ] EN selector → entire PDF in English (all sections, body text, labels)
- [ ] ES selector → entire PDF in Spanish

### Destinations
- [ ] Saudi Arabia SCO → correct port (NOT UAE/Jebel Ali)
- [ ] Algeria SCO → correct port
- [ ] UAE SCO → Jebel Ali/Port Rashid

### Deployment
- [ ] Railway build log: `npm install` completed without errors
- [ ] Railway build log: frontend build step completed
- [ ] Railway build log: `node server.js` started
- [ ] `GET /health` returns `{"ok":true}`
- [ ] App loads in browser (not API-only mode)

### Authentication
- [ ] Login works
- [ ] Session persists across page refresh
- [ ] Profile update saves correctly

### Media
- [ ] Console shows `[media-bind]` log entries when generating PDF
- [ ] `[GLV-PDF] Pre-render validation` log appears in console

---

## Rollback plan
<!-- If this breaks production, what is the recovery step? -->
Recovery branch: `stable-production-v1` (frozen at `fbe516d`)
