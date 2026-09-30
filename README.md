# ChaiCart Live

The real-time companion app for the [ChaiCart Cloud Workshop](https://github.com/theharithsa/chaicart-cloud-workshop). Students join on their phones; the facilitator runs every activity from a console; a projector screen shows live results. All data is stored in Firebase and updates instantly on every device.

It runs alongside the slide decks and printed materials. Anything physical (Human Kitchen, Paper Plane Factory, Follow the Order) stays physical, and the print kit is the backup if the Wi-Fi fails.

## What's in it

| Route | Who | What it does |
|---|---|---|
| `#/` and `#/join?s=CODE` | Students | Join with name, semester, branch, team (from the table card) and role |
| `#/play` | Students | Team credits and region rank, plus whatever activity is live right now |
| `#/certificate` | Students | Personal certificate, printable or saveable as PDF |
| `#/console` | Facilitator, captains | Launch, lock and reveal activities; timers; scoring; leaderboard; student list |
| `#/screen` | Projector | Join QR code, live leaderboard, poll and quiz results, hints and timers |

### Activities

| Activity | Day | Type | Scoring |
|---|---|---|---|
| Pre-workshop survey | 1 | Individual form | — |
| Cloud or Not? | 1 | Live poll | — |
| Where Should They Live? | 1 | Team form, one scenario per team | Facilitator awards |
| Shark Tank region vote | 1 | Team vote within region | Region winners +50 |
| Architecture Lego: our design | 1 | Team checklist (feeds Day 2 games) | — |
| Day 1 recap quiz | 1 | Individual quiz | 10 per question, scaled by team accuracy |
| Guess the Downtime | 2 | Individual quiz | 5 per question |
| Who Killed Checkout? | 2 | Evidence on phones, live hints, one accusation per team | Automatic, with first-correct bonus |
| Observability Treasure Hunt | 2 | Team self-marked total | Applied from form |
| Error Budget Poker | 2 | Team decisions with dice rolls | Automatic, uses the architecture checklist |
| Blameless postmortem | 2 | Team form | Facilitator awards |
| Paper Plane Factory | 2 | Team results | Region best +50 |
| Cloud Bill Shock | 2 | 3 cards dealt per team, pick controls for refunds | Automatic, uses the architecture checklist |
| My 90-day plan | 2 | Individual form | — |
| Demo Day region vote | 2 | Team vote within region | Picks finalists |
| Day 2 recap quiz | 2 | Individual quiz | 10 per question |
| Post-workshop feedback | 2 | Individual form | — |

Paper-scored activities (Timeline, Service sort, Bingo, Kitchen, Gallery) are entered in **Console → Leaderboard → Enter a whole round**.

## Tech

- React 19, TypeScript, Vite; hash routing, so it runs on any static host.
- Firebase Authentication: students sign in anonymously; facilitators with Google.
- Cloud Firestore with offline cache and real-time listeners.
- No Cloud Functions: runs on the free **Spark** plan. The console does the marking.

### Staying within the free tier

Every screen reads the leaderboard from **one document** (`sessions/{id}/public/leaderboard`), so a scoring round costs about 120 reads rather than 2,880. A full two-day workshop for 120 students stays well inside Spark's 50,000 reads and 20,000 writes per day.

## Firebase setup (one time)

1. **Create a project** at [console.firebase.google.com](https://console.firebase.google.com). Analytics is not needed.
2. **Authentication → Sign-in method:** enable **Anonymous** and **Google**.
3. **Firestore Database → Create database:** production mode, location `asia-south1` (Mumbai).
4. **Project settings → Your apps → Add app → Web.** Copy the config values.
5. In this folder:
   ```bash
   cp .env.example .env.local     # then paste the six values
   npm install
   ```
6. **Deploy the security rules:**
   ```bash
   npx firebase-tools login
   npx firebase-tools use --add          # pick your project
   npx firebase-tools deploy --only firestore:rules
   ```
7. **Register facilitators and captains:** in Firestore, create a collection `admins` with one document per Google account. The **document ID is the email address**; the fields don't matter, for example `role: "facilitator"`.
8. **Authorised domains** (Authentication → Settings): add the domain you host on, for example `theharithsa.github.io`. `localhost` and your `*.web.app` domain are there already.

## Run locally

```bash
npm run dev        # http://localhost:5173
```

Open `#/console`, sign in with an admin Google account, and create a session in **Setup** (for example `CHAI26`). Scan the QR code from a phone, or open `#/join?s=CHAI26` in a private window, to join as a student.

## Deploy

**Firebase Hosting** (recommended; same project, free):

```bash
npm run build
npx firebase-tools deploy --only hosting
```

**GitHub Pages or any static host:** `npm run build` and publish the `dist` folder. The app uses relative paths and hash routing, so it works from a sub-path. Remember to add the domain to Firebase authorised domains.

## On the day

1. Laptop screen: `#/console`. Projector: **Open projector screen** from the console (same browser, so it is already signed in).
2. Put the screen on **Join QR** while students arrive and join.
3. In **Run**, select an activity, press **Launch on phones**, and every phone switches to it. Use **Lock**, **Reveal**, **Next** and the timers.
4. Press the scoring button in each panel once the activity is finished. Each activity is marked **scored** in the list so it isn't applied twice; **Leaderboard → Undo last change** reverses the most recent scoring.
5. After the workshop, export students and form responses as CSV from the console.

## Security model

- Students can create only their own profile, and write only their own (or their team's) submission for the activity that is **currently open**. Quiz answers and poker choices can only be added for the current question and can't be changed afterwards. Accusations are final once submitted.
- Only admins can change sessions, credits and the leaderboard, or read the ledger and private data.
- Answer keys live in a separate code chunk loaded only by the console and are never fetched by the student app. A determined student could still find that file by URL; for stronger secrecy, move the keys into a Firestore document under `private/`.
- The Firebase web config in `.env.local` is not a secret; access is controlled by the rules in [`firestore.rules`](firestore.rules).

## Data and privacy

Only name, semester, branch, team and role are stored for students, plus their responses. Export what you need after the workshop, then delete the session from the Firestore console.

## Project layout

```
src/
  content/     teams, activities, mystery evidence, budget and bill-shock rules
  admin/       answer keys (console only)
  lib/         Firestore hooks, submissions, credits ledger
  pages/       student app: Join, Play, Certificate, student/* activity views
  console/     facilitator console, projector screen, per-activity panels
firestore.rules   security rules
firebase.json     rules and hosting config
```

## License

MIT
