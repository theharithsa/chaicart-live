import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import { bingoBoard } from "../../functions/bingo.js";
const require = createRequire(
  new URL("../../functions/package.json", import.meta.url),
);
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
test.describe.configure({ mode: "serial" });
let app, db, sink;
const bizEvents = [];
const sid = "REHEARSAL";
const adminEmail = "facilitator@example.invalid",
  captainEmail = "captain@example.invalid";
const base = () => db.doc("sessions/" + sid);
const keys = JSON.parse(fs.readFileSync("scripts/activity-keys.json", "utf8"));
const ts = createRequire(import.meta.url)("typescript");
const exports = {};
new Function(
  "exports",
  ts.transpile(fs.readFileSync("src/admin/keys.ts", "utf8"), {
    module: ts.ModuleKind.CommonJS,
  }),
)(exports);
const activitiesExports = {};
new Function(
  "exports",
  "require",
  ts.transpile(fs.readFileSync("src/content/activities.ts", "utf8"), {
    module: ts.ModuleKind.CommonJS,
  }),
)(activitiesExports, () =>
  JSON.parse(fs.readFileSync("src/content/paperless.json", "utf8")),
);
const activities = activitiesExports.ACTIVITIES;
async function actor(browser, email, path = "/", options = {}) {
  const context = await browser.newContext(options);
  await context.route("https://**dynatrace.com/**", (route) => route.abort());
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    console.error("Rehearsal page error:", error.message),
  );
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  const uid = await page.evaluate(
    (email) => import("/test/browser-auth.ts").then((m) => m.login(email)),
    email,
  );
  await page.evaluate(
    (sid) => localStorage.setItem("chaicart-session", sid),
    sid,
  );
  await page.goto("/#" + path);
  await page.reload();
  return { context, page, uid };
}
async function launch(id, index = 0) {
  const a = activities.find((a) => a.id === id);
  await base().update({
    currentActivity: id,
    state: {
      phase: "open",
      index,
      indexedField:
        a.kind === "quiz" ? "answers" : a.kind === "budget" ? "choices" : null,
    },
    screen: "activity",
  });
}
async function profile(uid, role = "COO", teamId = "mumbai-1a") {
  await base()
    .collection("students")
    .doc(uid)
    .set({
      name: "Rehearsal " + role,
      semester: "5",
      branch: "CSE",
      teamId,
      role,
    });
  await base()
    .collection("teams")
    .doc(teamId)
    .update({ ["slots." + role]: uid });
}
test.beforeAll(async () => {
  if (process.env.GCLOUD_PROJECT !== "demo-chaicart")
    throw new Error("Use demo-chaicart emulators, never production.");
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8185";
  app = initializeApp({ projectId: "demo-chaicart" }, "browser-rehearsal");
  db = getFirestore(app);
  sink = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    if (req.url.includes("/bizevents/")) bizEvents.push(JSON.parse(body));
    res.writeHead(req.url.includes("/bizevents/") ? 202 : 200, {
      "Content-Type": "application/json",
    });
    res.end("{}");
  });
  await new Promise((resolve) => sink.listen(8799, "127.0.0.1", resolve));
  const content = {
    ...keys,
    bingo: keys.bingo.map(([term, clue]) => ({ term, clue })),
  };
  await db.doc("workshopContent/keys").set(exports);
  await db.doc("workshopContent/activityKeys").set(content);
  await db.doc("admins/" + adminEmail).set({ role: "facilitator" });
});
test.afterAll(async () => {
  await new Promise((resolve) => sink.close(resolve));
  await deleteApp(app);
});
test("facilitator creates session, duplicate/invalid creation recovers, 24 team codes and initial balances exist", async ({
  browser,
}) => {
  const { context, page } = await actor(browser, adminEmail, "/console");
  await expect(page.getByRole("button", { name: "Setup", exact: true }))
    .toBeVisible({ timeout: 30000 })
    .catch(async (error) => {
      console.error(
        "Rehearsal access screen:",
        await page.locator("body").innerText(),
      );
      throw error;
    });
  await page.getByRole("button", { name: "Setup", exact: true }).click();
  const form = page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: "Create a session" }) });
  await form.getByLabel(/Session code/).fill("X");
  await form
    .getByRole("button", { name: "Create session", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("4–16");
  await form.getByLabel(/Session code/).fill(sid);
  await form
    .getByRole("button", { name: "Create session", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("created");
  expect((await base().collection("teams").get()).size).toBe(24);
  expect(
    Object.values(
      (await base().collection("public").doc("leaderboard").get()).data()
        .scores,
    ),
  ).toEqual(Array(24).fill(1000));
  await form.getByLabel(/Session code/).fill(sid);
  await form
    .getByRole("button", { name: "Create session", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("already exists");
  await expect(
    form.getByRole("button", { name: "Create session", exact: true }),
  ).toBeEnabled();
  await base()
    .collection("staff")
    .doc(captainEmail)
    .set({ role: "captain", region: "west" });
  await context.close();
});
test("anonymous cannot join as Google student or reach staff controls; normal student cannot enter console", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.route("https://**dynatrace.com/**", (route) => route.abort());
  const page = await context.newPage();
  await page.goto("/");
  await page.evaluate(() =>
    import("/test/browser-auth.ts").then((m) => m.anonymous()),
  );
  await page.goto("/#/join?s=" + sid);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sign in with Google" }),
  ).toBeVisible();
  await expect(page.getByLabel("Team code from your captain")).toHaveCount(0);
  await page.goto("/#/console");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sign in with Google" }),
  ).toBeVisible();
  await context.close();
  const student = await actor(
    browser,
    "unauthorized@example.invalid",
    "/console",
  );
  await expect(
    student.page.getByRole("heading", { name: /No console access/ }),
  ).toBeVisible();
  await student.context.close();
});
test("student joins through real form; saved roster and role survive reload; wrong team code is rejected", async ({
  browser,
}) => {
  const { context, page, uid } = await actor(
    browser,
    "coo@example.invalid",
    "/join?s=" + sid,
  );
  const code = (await base().collection("teams").doc("mumbai-1a").get()).data()
    .joinCode;
  await page.getByLabel("Team code from your captain").fill("WRONG");
  await page.getByLabel("Your name").fill("Rehearsal COO");
  await page.getByLabel("Semester").selectOption("5");
  await page.getByLabel("Branch").fill("CSE");
  await page
    .getByRole("combobox", { name: "Team", exact: true })
    .selectOption("mumbai-1a");
  await page.getByRole("radio", { name: /COO/ }).check();
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("team code");
  await page.getByLabel("Team code from your captain").fill(code);
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page).toHaveURL(/#\/play/);
  expect(
    (await base().collection("students").doc(uid).get()).data()?.role,
  ).toBe("COO");
  await page.reload();
  await expect(page.getByText("Rehearsal COO").first()).toBeVisible();
  await context.close();
});
test("all 24 live activities render on student and facilitator screens without uncaught errors", async ({
  browser,
}) => {
  const student = await actor(browser, "coo@example.invalid", "/play", {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const facilitator = await actor(browser, adminEmail, "/console");
  await facilitator.page.evaluate(
    (sid) => localStorage.setItem("chaicart-console-session", sid),
    sid,
  );
  await facilitator.page.reload();
  await facilitator.page
    .getByRole("button", { name: "Run", exact: true })
    .click();
  const errors = [];
  for (const p of [student.page, facilitator.page])
    p.on("pageerror", (e) => errors.push(e.message));
  for (const a of activities) {
    await facilitator.page
      .getByRole("button", { name: a.title, exact: false })
      .first()
      .click();
    await facilitator.page
      .getByRole("button", { name: "Launch on phones", exact: true })
      .click();
    await expect(
      student.page.getByRole("heading", { name: a.title, exact: true }).first(),
    ).toBeVisible();
    expect((await base().get()).data()?.currentActivity).toBe(a.id);
  }
  expect(errors).toEqual([]);
  await student.context.close();
  await facilitator.context.close();
});

test("every Day 1 and Day 2 form saves actual values, reloads, and appears in student workspace", async ({
  browser,
}) => {
  const student = await actor(browser, "coo@example.invalid", "/play");
  for (const a of activities.filter((a) => a.kind === "form")) {
    await launch(a.id);
    await expect(
      student.page.getByRole("heading", { name: a.title, exact: true }).first(),
    ).toBeVisible();
    for (const f of a.fields) {
      if (f.type === "scale")
        await student.page
          .locator(".field")
          .filter({ hasText: f.label })
          .getByRole("button", { name: "4", exact: true })
          .click();
      else if (f.type === "checks") {
        if (f.options.length)
          await student.page
            .getByRole("checkbox", { name: f.options[0].label })
            .check();
      } else if (f.type === "select")
        await student.page
          .getByRole("combobox", { name: f.label, exact: true })
          .selectOption(f.options[0]);
      else
        await student.page
          .getByLabel(f.label, { exact: true })
          .nth(
            a.fields
              .slice(0, a.fields.indexOf(f))
              .filter((prior) => prior.label === f.label).length,
          )
          .fill(
            f.type === "number"
              ? String(f.id === "nps" ? 9 : 30)
              : "Rehearsal evidence for " + f.id,
          );
    }
    await student.page
      .getByRole("button", { name: "Submit", exact: true })
      .click();
    const ref = base()
      .collection("submissions")
      .doc(
        a.id + "__" + (a.scope === "individual" ? student.uid : "mumbai-1a"),
      );
    await expect.poll(async () => (await ref.get()).exists).toBe(true);
    const saved = (await ref.get()).data();
    expect(saved.activity).toBe(a.id);
    expect(saved.scope).toBe(a.scope);
    for (const f of a.fields.filter((f) => f.required))
      expect(saved.values[f.id]).toBeDefined();
    await student.page.reload();
    await expect(
      student.page.getByRole("button", { name: "Update", exact: true }),
    ).toBeVisible();
  }
  await student.page
    .getByRole("button", { name: "My workshop", exact: true })
    .click();
  await student.page.getByRole("button", { name: "Team", exact: true }).click();
  await expect(
    student.page.getByRole("heading", { name: "Your Cloud or Not answers" }),
  ).toBeVisible();
  await expect(
    student.page.getByText("Blameless postmortem · Rehearsal COO", {
      exact: true,
    }),
  ).toBeVisible();
  await student.context.close();
});
test("all 28 quiz questions: individual Cloud credits, wrong answers, recap team scoring, reload and student details", async ({
  browser,
}) => {
  const student = await actor(browser, "coo@example.invalid", "/play");
  const second = await actor(browser, "cto@example.invalid");
  await profile(second.uid, "CTO");
  await second.page.goto("/#/play");
  const facilitator = await actor(browser, adminEmail, "/console");
  await facilitator.page.evaluate(
    (sid) => localStorage.setItem("chaicart-console-session", sid),
    sid,
  );
  await facilitator.page.reload();
  await facilitator.page
    .getByRole("button", { name: "Run", exact: true })
    .click();
  let expectedScore = (
    await base().collection("public").doc("leaderboard").get()
  ).data()?.scores["mumbai-1a"];
  for (const a of activities.filter((a) => a.kind === "quiz")) {
    await launch(a.id);
    await facilitator.page
      .getByRole("button", { name: a.title, exact: false })
      .first()
      .click();
    for (let i = 0; i < a.questions.length; i++) {
      await expect(
        student.page.getByText(`Question ${i + 1} of ${a.questions.length}`, {
          exact: true,
        }),
      ).toBeVisible();
      const answer = exports.QUIZ_KEYS[a.id][i].answer;
      const wrong = a.id === "cloud-or-not" && i === 1;
      await student.page
        .locator(".option")
        .nth(wrong ? (answer + 1) % a.questions[i].options.length : answer)
        .click();
      await expect(
        student.page.getByText("Answer locked in. Wait for the reveal."),
      ).toBeVisible();
      if (a.id === "cloud-or-not") {
        await second.page.locator(".option").nth(answer).click();
        await expect(
          second.page.getByText("Answer locked in. Wait for the reveal."),
        ).toBeVisible();
      }
      await facilitator.page
        .getByRole("button", { name: "Reveal and score", exact: true })
        .click();
      await expect(
        student.page.getByText(wrong ? "Not this time." : "Correct!", {
          exact: true,
        }),
      ).toBeVisible();
      expectedScore += a.id === "cloud-or-not" ? (wrong ? 100 : 200) : a.points;
      await expect
        .poll(
          async () =>
            (await base().collection("public").doc("leaderboard").get()).data()
              .scores["mumbai-1a"],
        )
        .toBe(expectedScore);
      if (i < a.questions.length - 1)
        await facilitator.page
          .getByRole("button", { name: "Next question", exact: true })
          .click();
    }
  }
  expect(
    (await base().collection("quizResults").doc(student.uid).get()).data()
      .credits,
  ).toBe(700);
  expect(
    (await base().collection("quizResults").doc(second.uid).get()).data()
      .credits,
  ).toBe(800);
  await facilitator.page
    .getByRole("button", { name: "Students", exact: true })
    .click();
  await facilitator.page
    .getByText("View Rehearsal COO’s submitted work", { exact: true })
    .click();
  await expect(
    facilitator.page.getByText("Cloud or Not: 700 personal credits", {
      exact: true,
    }),
  ).toBeVisible();
  await student.context.close();
  await second.context.close();
  await facilitator.context.close();
});
test("timeline dragging and keyboard reorder, service sorting, architecture and gallery submission", async ({
  browser,
}) => {
  const student = await actor(browser, "coo@example.invalid", "/play");
  await launch("timeline");
  await expect(
    student.page.getByRole("list", {
      name: "Timeline events in chronological order",
    }),
  ).toBeVisible();
  const items = student.page.locator("[data-timeline-id]");
  const initial = await items.evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-timeline-id")),
  );
  const handle = student.page.getByRole("button", { name: /Drag event 1:/ });
  const from = await handle.boundingBox();
  const to = await items.nth(1).boundingBox();
  await student.page.mouse.move(
    from.x + from.width / 2,
    from.y + from.height / 2,
  );
  await student.page.mouse.down();
  await student.page.mouse.move(to.x + to.width / 2, to.y + to.height * 0.8, {
    steps: 10,
  });
  await student.page.mouse.up();
  await expect
    .poll(() =>
      items.evaluateAll((items) =>
        items.map((item) => item.getAttribute("data-timeline-id")),
      ),
    )
    .not.toEqual(initial);
  await student.page
    .getByRole("button", { name: /Move.*up/ })
    .nth(1)
    .click();
  await student.page
    .getByRole("button", { name: "Submit team answer", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await base()
            .collection("submissions")
            .doc("timeline__mumbai-1a")
            .get()
        ).exists,
    )
    .toBe(true);
  await launch("service-sort");
  for (let i = 0; i < 20; i++)
    await student.page
      .locator("select")
      .nth(i)
      .selectOption(keys.services["service-" + i]);
  await student.page
    .getByRole("button", { name: "Submit team answer", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await base()
            .collection("submissions")
            .doc("service-sort__mumbai-1a")
            .get()
        ).exists,
    )
    .toBe(true);
  await launch("architecture");
  await student.page
    .getByLabel("Cloud provider")
    .selectOption("Microsoft Azure");
  await student.page
    .getByLabel("Region / zones")
    .fill("Central India, two zones");
  await student.page.getByRole("checkbox").first().check();
  await student.page.getByLabel(/Request flow/).fill("web → database");
  await student.page
    .getByRole("button", { name: "Submit team answer", exact: true })
    .click();
  await expect(student.page.getByRole("status")).toContainText(
    "design reasoning",
  );
  await student.page
    .getByLabel(
      "Why these choices? Failure protection, scale, security and cost",
      { exact: true },
    )
    .fill("Two zones protect the database and web service.");
  await student.page
    .getByRole("button", { name: "Submit team answer", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await base()
            .collection("submissions")
            .doc("architecture__mumbai-1a")
            .get()
        ).exists,
    )
    .toBe(true);
  await launch("gallery");
  await student.page
    .locator("textarea")
    .first()
    .fill("Queue work and design for recovery");
  await student.page
    .getByRole("button", { name: "Submit team answer", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await base().collection("submissions").doc("gallery__mumbai-1a").get())
          .exists,
    )
    .toBe(true);
  await student.context.close();
});
test("both regional votes save, own team absent, revisions replace one team vote, lock blocks changes", async ({
  browser,
}) => {
  const student = await actor(browser, "coo@example.invalid", "/play");
  for (const id of ["shark-vote", "demo-vote"]) {
    await launch(id);
    await expect(student.page.locator(".option")).toHaveCount(5);
    await student.page.locator(".option").first().click();
    const ref = base()
      .collection("submissions")
      .doc(id + "__mumbai-1a");
    await expect.poll(async () => (await ref.get()).exists).toBe(true);
    const first = (await ref.get()).data()?.choice;
    expect(first).not.toBe("mumbai-1a");
    await student.page.locator(".option").nth(1).click();
    await expect
      .poll(async () => (await ref.get()).data()?.choice)
      .not.toBe(first);
    await base().update({ "state.phase": "locked" });
    await expect(student.page.locator(".option").first()).toBeDisabled();
  }
  await student.context.close();
});
test("captain sees only regional team codes, reviews incorrect timeline at zero, awards Architecture/Gallery/Day2 once", async ({
  browser,
}) => {
  const captain = await actor(browser, captainEmail, "/captain?s=" + sid);
  await expect(
    captain.page.getByText("West India", { exact: true }),
  ).toBeVisible();
  const code = (await base().collection("teams").doc("mumbai-1a").get()).data()
    .joinCode;
  await expect(captain.page.getByText(code, { exact: true })).toBeVisible();
  await base()
    .collection("submissions")
    .doc("timeline__mumbai-1a")
    .update({ "values.order": [...keys.timeline].reverse(), locked: false });
  await captain.page.getByLabel("Review activity").selectOption("timeline");
  await captain.page
    .getByRole("button", { name: "Approve for facilitator", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await base().collection("reviews").doc("timeline__mumbai-1a").get()
        ).data()?.status,
    )
    .toBe("approved");
  for (const activity of [
    "architecture",
    "gallery",
    "treasure-hunt",
    "postmortem",
    "downtime",
  ]) {
    await captain.page.getByLabel("Review activity").selectOption(activity);
    await captain.page
      .getByLabel("Feedback / judging evidence")
      .fill("Rehearsal rubric checked");
    await captain.page
      .getByRole("button", { name: "Approve for facilitator", exact: true })
      .click();
    await expect(
      captain.page.getByRole("button", {
        name: "Award reviewed credits to team",
        exact: true,
      }),
    ).toBeEnabled();
    await captain.page
      .getByRole("button", {
        name: "Award reviewed credits to team",
        exact: true,
      })
      .click();
    await expect(
      captain.page.getByRole("button", {
        name: /^Awarded .* credits$/,
        exact: true,
      }),
    ).toBeDisabled();
    expect(
      (
        await base()
          .collection("awards")
          .doc(activity + "__mumbai-1a")
          .get()
      ).exists,
    ).toBe(true);
  }
  await captain.context.close();
});
test("networking steps and X validation, resources and participant workspace stay available", async ({
  browser,
}) => {
  const student = await actor(browser, "coo@example.invalid", "/play");
  await base().update({ networkingOpen: true });
  await student.page
    .getByRole("button", { name: "My workshop", exact: true })
    .click();
  await student.page
    .getByRole("button", { name: "Networking", exact: true })
    .click();
  for (const heading of [
    "Day 1 · LinkedIn network",
    "Day 1 · GitHub developer circle",
    "Day 2 · X learning circle",
  ]) {
    await student.page
      .locator(".card")
      .filter({
        has: student.page.getByRole("heading", { name: heading, exact: true }),
      })
      .getByRole("button", { name: "I completed these steps", exact: true })
      .click();
  }
  await expect
    .poll(
      async () =>
        (await base().collection("networking").doc(student.uid).get()).data()
          ?.completed?.length,
    )
    .toBe(3);
  await student.page
    .getByLabel("Your best post URL")
    .fill("https://example.invalid/unsafe");
  await student.page
    .getByRole("button", { name: "Submit best post before final awards" })
    .click();
  await expect(
    student.page.getByText(/Enter a public X post URL/),
  ).toBeVisible();
  await student.page
    .getByLabel("Your best post URL")
    .fill("https://x.com/rehearsal/status/123456");
  await student.page
    .getByRole("button", { name: "Submit best post before final awards" })
    .click();
  await expect
    .poll(
      async () =>
        (await base().collection("xEntries").doc(student.uid).get()).exists,
    )
    .toBe(true);
  await student.page
    .getByRole("button", { name: "Resources", exact: true })
    .click();
  await expect(student.page.getByRole("link").first()).toBeVisible();
  await student.context.close();
});
test("factory round1 performs a release with real transactions", async ({
  browser,
}) => {
  const student = await actor(browser, "coo@example.invalid", "/play");
  await launch("factory");
  await base()
    .collection("public")
    .doc("factory")
    .set({ round: 1, open: true, endsAt: Date.now() + 180000 });
  const release = student.page
    .locator(".card")
    .filter({ hasText: /Release 1 ·/ })
    .first();
  await release
    .getByRole("button", { name: "Plan release", exact: true })
    .click();
  await release.getByLabel("Checksum").fill("9");
  await release
    .getByRole("button", { name: "Submit build", exact: true })
    .click();
  await release.getByRole("button", { name: "Run tests", exact: true }).click();
  await release.getByRole("button", { name: "Deploy", exact: true }).click();
  await expect(
    release.getByRole("button", { name: "Released", exact: true }),
  ).toBeDisabled();
  const ref = base().collection("factoryTickets").doc("mumbai-1a__1__0");
  expect((await ref.get()).data()?.stage).toBe(4);
  await student.context.close();
});
test("Bingo claim follows called terms and captain awards valid claim exactly once", async ({
  browser,
}) => {
  const student = await actor(browser, "coo@example.invalid", "/play");
  await launch("bingo");
  const marks = bingoBoard("mumbai-1a").slice(0, 5);
  await base()
    .collection("public")
    .doc("workshop")
    .update({ bingoCalled: marks });
  for (const term of marks)
    if (term !== "FREE")
      await student.page
        .getByRole("button", { name: term, exact: true })
        .click();
  await student.page
    .getByRole("button", { name: "Claim bingo", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await base().collection("submissions").doc("bingo__mumbai-1a").get())
          .exists,
    )
    .toBe(true);
  const captain = await actor(browser, captainEmail, "/captain?s=" + sid);
  await captain.page.getByLabel("Review activity").selectOption("bingo");
  await expect(
    captain.page.getByRole("button", {
      name: "Approve for facilitator",
      exact: true,
    }),
  ).toBeEnabled();
  await captain.page
    .getByRole("button", { name: "Approve for facilitator", exact: true })
    .click();
  await expect(
    captain.page.getByRole("button", {
      name: "Award reviewed credits to team",
      exact: true,
    }),
  ).toBeEnabled();
  await captain.page
    .getByRole("button", {
      name: "Award reviewed credits to team",
      exact: true,
    })
    .click();
  await expect(
    captain.page.getByRole("button", {
      name: "Awarded 30 credits",
      exact: true,
    }),
  ).toBeDisabled();
  await student.context.close();
  await captain.context.close();
});
test("Checkout mystery is immutable; every Poker card and Bill Shock control is saved", async ({
  browser,
}) => {
  const student = await actor(browser, "coo@example.invalid", "/play");
  await launch("mystery");
  const selects = student.page.getByRole("combobox");
  for (let i = 0; i < 3; i++) await selects.nth(i).selectOption({ index: 1 });
  for (const name of [
    "Evidence: a metric",
    "Evidence: a log line",
    "Evidence: a trace",
    "Immediate fix and how to prevent it",
  ])
    await student.page
      .getByLabel(name, { exact: true })
      .fill("Rehearsal evidence");
  await student.page
    .getByRole("button", { name: /Submit.*accusation/i })
    .click();
  await expect
    .poll(
      async () =>
        (
          await base().collection("submissions").doc("mystery__mumbai-1a").get()
        ).data()?.locked,
    )
    .toBe(true);
  await student.page.reload();
  await expect(
    student.page.getByRole("button", { name: /Submit.*accusation/i }),
  ).toHaveCount(0);
  const b = {};
  new Function(
    "exports",
    ts.transpile(fs.readFileSync("src/content/budget.ts", "utf8"), {
      module: ts.ModuleKind.CommonJS,
    }),
  )(b);
  await launch("budget");
  for (let i = 0; i < b.BUDGET_CARDS.length; i++) {
    await base().update({ "state.index": i });
    await expect(
      student.page
        .getByText(`Card ${i + 1} of ${b.BUDGET_CARDS.length}`, {
          exact: false,
        })
        .first(),
    ).toBeVisible();
    if (b.BUDGET_CARDS[i].forced)
      await student.page
        .getByRole("button", { name: "Apply this card", exact: true })
        .click();
    else await student.page.locator(".option").nth(1).click();
    await expect
      .poll(async () =>
        Boolean(
          (
            await base()
              .collection("submissions")
              .doc("budget__mumbai-1a")
              .get()
          ).data()?.choices?.[i],
        ),
      )
      .toBe(true);
  }
  await launch("billshock");
  const groups = await student.page
    .locator("input[type=radio]")
    .evaluateAll((inputs) => [...new Set(inputs.map((input) => input.name))]);
  for (const group of groups)
    await student.page.locator(`input[name="${group}"]`).first().check();
  await student.page
    .getByRole("button", { name: "Submit answers", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await base()
            .collection("submissions")
            .doc("billshock__mumbai-1a")
            .get()
        ).exists,
    )
    .toBe(true);
  await student.context.close();
});
test("all five roles complete networking, captain awards three 100-credit activities, factory round2 and both station games complete", async ({
  browser,
}) => {
  const members = [];
  for (const role of ["CEO", "CTO", "CFO", "SRE", "COO"]) {
    const member = await actor(
      browser,
      role.toLowerCase() + "@example.invalid",
      "/play",
    );
    if (role !== "COO") await profile(member.uid, role);
    await member.page.reload();
    members.push({ ...member, role });
  }
  await base().update({ networkingOpen: true });
  for (const member of members) {
    await member.page
      .getByRole("button", { name: "My workshop", exact: true })
      .click();
    await member.page
      .getByRole("button", { name: "Networking", exact: true })
      .click();
    const existing =
      (await base().collection("networking").doc(member.uid).get()).data()
        ?.completed || [];
    for (const heading of [
      "Day 1 · LinkedIn network",
      "Day 1 · GitHub developer circle",
      "Day 2 · X learning circle",
    ].slice(existing.length)) {
      await member.page
        .locator(".card")
        .filter({
          has: member.page.getByRole("heading", { name: heading, exact: true }),
        })
        .getByRole("button", { name: "I completed these steps", exact: true })
        .click();
    }
    await expect
      .poll(
        async () =>
          (await base().collection("networking").doc(member.uid).get()).data()
            ?.completed?.length,
      )
      .toBe(3);
    await member.page
      .getByRole("button", { name: "Live activity", exact: true })
      .click();
  }
  const captain = await actor(browser, captainEmail, "/captain?s=" + sid);
  for (const activity of ["network-linkedin", "network-github", "network-x"]) {
    await captain.page.getByLabel("Review activity").selectOption(activity);
    await captain.page
      .getByRole("button", { name: "Approve for facilitator", exact: true })
      .click();
    await expect(
      captain.page.getByRole("button", {
        name: "Award reviewed credits to team",
        exact: true,
      }),
    ).toBeEnabled();
    await captain.page
      .getByRole("button", {
        name: "Award reviewed credits to team",
        exact: true,
      })
      .click();
    await expect(
      captain.page.getByRole("button", {
        name: "Awarded 100 credits",
        exact: true,
      }),
    ).toBeDisabled();
  }
  await captain.context.close();
  await launch("factory");
  await base()
    .collection("public")
    .doc("factory")
    .set({ round: 2, open: true, endsAt: Date.now() + 180000 });
  for (const [i, role] of ["CEO", "CTO", "SRE", "COO"].entries()) {
    const member = members.find((m) => m.role === role);
    const release = member.page
      .locator(".card")
      .filter({ hasText: /Release 1 ·/ })
      .first();
    if (role === "CTO") await release.getByLabel("Checksum").fill("10");
    await release
      .getByRole("button", {
        name: ["Plan release", "Submit build", "Run tests", "Deploy"][i],
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () =>
          (
            await base()
              .collection("factoryTickets")
              .doc("mumbai-1a__2__0")
              .get()
          ).data()?.stage,
      )
      .toBe(i + 1);
  }
  const extraVolunteers = [];
  for (const [email, role] of [
    ["volunteer6@example.invalid", "CEO"],
    ["volunteer7@example.invalid", "CTO"],
  ]) {
    const volunteer = await actor(browser, email, "/play");
    await profile(volunteer.uid, role, "mumbai-1b");
    await volunteer.page.reload();
    extraVolunteers.push(volunteer);
  }
  const volunteers = [...members, ...extraVolunteers];
  for (const activity of ["kitchen", "follow-order"]) {
    await launch(activity);
    const ref = base()
      .collection("stationTokens")
      .doc(activity + "-rehearsal");
    const assignees = Array.from(
      { length: activity === "kitchen" ? 5 : 7 },
      (_, i) => volunteers[i].uid,
    );
    await ref.set({
      activity,
      station: 0,
      blocked: false,
      assignees,
      labels: assignees.map((_, i) => "Station " + i),
    });
    for (let i = 0; i < assignees.length; i++) {
      const member = volunteers.find((m) => m.uid === assignees[i]);
      const token = member.page
        .locator(".card")
        .filter({ hasText: activity + "-rehearsal" })
        .first();
      if (i === 1) {
        await ref.update({ blocked: true });
        await expect(
          token.getByRole("button", {
            name: "I am this station: hand off",
            exact: true,
          }),
        ).toBeDisabled();
        await ref.update({ blocked: false });
      }
      await token
        .getByRole("button", {
          name: "I am this station: hand off",
          exact: true,
        })
        .click();
      await expect
        .poll(async () => (await ref.get()).data()?.station)
        .toBe(i + 1);
    }
    expect((await ref.collection("events").get()).size).toBe(assignees.length);
  }
  for (const member of volunteers) await member.context.close();
});

test("timers and projector modes, architecture freeze, CSV export and atomic student transfers", async ({
  browser,
}) => {
  const fac = await actor(browser, adminEmail, "/console");
  await fac.page.evaluate(
    (sid) => localStorage.setItem("chaicart-console-session", sid),
    sid,
  );
  await fac.page.reload();
  await fac.page.getByRole("button", { name: "Run", exact: true }).click();
  await fac.page.getByRole("button", { name: "1 min", exact: true }).click();
  await expect
    .poll(async () => Boolean((await base().get()).data()?.timer?.endsAt))
    .toBe(true);
  await fac.page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect.poll(async () => (await base().get()).data()?.timer).toBeNull();
  const screen = await actor(browser, adminEmail, "/screen?s=" + sid);
  await base().update({ screen: "join" });
  await expect(
    screen.page.getByRole("heading", { name: "Scan to join" }),
  ).toBeVisible();
  await base().update({ screen: "leaderboard" });
  await expect(
    screen.page.getByText("Mumbai-1a", { exact: true }).first(),
  ).toBeVisible();
  await fac.page.getByRole("button", { name: "Workshop", exact: true }).click();
  await fac.page
    .getByRole("button", {
      name: "Freeze approved architecture for Day2",
      exact: true,
    })
    .click();
  await expect
    .poll(
      async () =>
        (await base().collection("designs").doc("mumbai-1a").get()).data()
          ?.locked,
    )
    .toBe(true);
  const student = await actor(browser, "coo@example.invalid", "/play");
  await launch("architecture");
  await expect(
    student.page.getByText(
      "Approved design frozen for Day 2. Ask your facilitator before making changes.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    student.page.getByRole("button", {
      name: "Submit team answer",
      exact: true,
    }),
  ).toBeDisabled();
  await fac.page.getByRole("button", { name: "Students", exact: true }).click();
  const downloaded = fac.page.waitForEvent("download");
  await fac.page
    .getByRole("button", { name: "Export CSV", exact: true })
    .click();
  const download = await downloaded;
  const csv = fs.readFileSync(await download.path(), "utf8");
  expect(csv).toContain("Rehearsal COO");
  expect(csv).toContain("semester");
  const move = fac.page.getByLabel("Move Rehearsal COO", { exact: true });
  await move.selectOption("mumbai-1b");
  await expect
    .poll(
      async () =>
        (await base().collection("students").doc(student.uid).get()).data()
          ?.teamId,
    )
    .toBe("mumbai-1b");
  expect(
    (await base().collection("teams").doc("mumbai-1b").get()).data().slots.COO,
  ).toBe(student.uid);
  await fac.page
    .getByLabel("Move Rehearsal COO", { exact: true })
    .selectOption("mumbai-1a");
  await expect
    .poll(
      async () =>
        (await base().collection("students").doc(student.uid).get()).data()
          ?.teamId,
    )
    .toBe("mumbai-1a");
  await student.context.close();
  await screen.context.close();
  await fac.context.close();
});

test("offline edits remain pending until reconnect and do not count as confirmed saves", async ({
  browser,
}) => {
  const student = await actor(browser, "coo@example.invalid", "/play");
  await launch("shark-pitch");
  const ref = base().collection("submissions").doc("shark-pitch__mumbai-1a");
  await expect(
    student.page.getByRole("button", { name: "Update", exact: true }),
  ).toBeEnabled();
  await student.page
    .getByRole("textbox", {
      name: "Our cloud choice, business value and 60-second pitch",
      exact: true,
    })
    .fill("Offline recovery rehearsal");
  await student.context.setOffline(true);
  await student.page
    .getByRole("button", { name: "Update", exact: true })
    .click();
  await expect(
    student.page.getByText("Pending server confirmation…", { exact: true }),
  ).toBeVisible();
  expect((await ref.get()).data()?.values.pitch).not.toBe(
    "Offline recovery rehearsal",
  );
  await student.context.setOffline(false);
  await expect
    .poll(async () => (await ref.get()).data()?.values.pitch)
    .toBe("Offline recovery rehearsal");
  await expect(student.page.getByText("Saved.", { exact: true })).toBeVisible();
  await student.context.close();
});
test("certificate gating, service-model nested leaderboard, completion and reopening, session deletion", async ({
  browser,
}) => {
  const student = await actor(browser, "coo@example.invalid", "/certificate");
  await expect(
    student.page.getByRole("heading", { name: "Completion verification pending" }),
  ).toBeVisible();
  const fac = await actor(browser, adminEmail, "/console");
  await fac.page.evaluate(
    (sid) => localStorage.setItem("chaicart-console-session", sid),
    sid,
  );
  await fac.page.reload();
  await fac.page.getByRole("button", { name: "Run", exact: true }).click();
  await fac.page
    .getByRole("button", { name: "Service Model Sort", exact: false })
    .first()
    .click();
  await fac.page
    .getByRole("button", { name: "Leaderboard", exact: true })
    .last()
    .click();
  await expect(
    fac.page.getByText("Mumbai-1a", { exact: true }).first(),
  ).toBeVisible();
  await fac.page.getByRole("button", { name: "Workshop", exact: true }).click();
  await fac.page
    .getByRole("button", {
      name: "Show certificate portal to students",
      exact: true,
    })
    .click();
  await expect(
    student.page.getByRole("heading", { name: "Completion verification pending" }),
  ).toBeVisible();
  await fac.page
    .getByRole("button", { name: "Mark workshop complete", exact: true })
    .click();
  await expect
    .poll(async () => Boolean((await base().get()).data()?.completedAt))
    .toBe(true);
  const closed = (await base().get()).data();
  expect(closed.currentActivity).toBeNull();
  expect(closed.networkingOpen).toBe(false);
  expect(closed.state.phase).toBe("locked");
  // Simulate an older completed session created before permanent-record protection.
  await base().update({learningArchiveRequired:null});
  await fac.page
    .getByRole("button", { name: "Reopen workshop", exact: true })
    .click();
  await expect
    .poll(async () => (await base().get()).data()?.completedAt)
    .toBeNull();
  expect((await base().get()).data().learningArchiveRequired).toBe(true);
  await expect
    .poll(
      () =>
        bizEvents.filter((e) => e.data?.["workshop.session.id"] === sid).length,
    )
    .toBeGreaterThan(10);
  for (const e of bizEvents.filter(
    (e) => e.data?.["workshop.session.id"] === sid,
  )) {
    expect(e.data["transaction.id"]).toBeTruthy();
    expect(e.data.trace_id).toMatch(/^[0-9a-f]{32}$/);
    expect(e.data.span_id).toMatch(/^[0-9a-f]{16}$/);
  }
  await fac.page.getByRole("button", { name: "Setup", exact: true }).click();
  await fac.page.getByRole("button", { name: "Delete", exact: true }).click();
  await fac.page.getByLabel("Type " + sid + " to confirm").fill("WRONG");
  await expect(
    fac.page.getByRole("button", { name: "Permanently delete session" }),
  ).toBeDisabled();
  await fac.page.getByLabel("Type " + sid + " to confirm").fill(sid);
  await fac.page
    .getByRole("button", { name: "Permanently delete session" })
    .click();
  await expect(fac.page.getByRole("status").filter({hasText:/Verify attendance and publish permanent learner results/})).toBeVisible();
  const learners=await base().collection('students').get();
  for(const learner of learners.docs)await db.doc(`learningLearners/${learner.id}/workshops/${sid}`).set({sid,uid:learner.id,status:'not-attended'});
  await fac.page.getByRole('button',{name:'Permanently delete session'}).click();
  await expect.poll(async () => (await base().get()).exists).toBe(false);
  await expect
    .poll(async () => (await base().collection("students").get()).empty)
    .toBe(true);
  await expect
    .poll(async () => (await base().collection("submissions").get()).empty)
    .toBe(true);
  // Keep the local collector alive until asynchronous deletion audits drain.
  let previousCount = -1;
  let stable = 0;
  await expect
    .poll(
      async () => {
        const snapshot = await db.collection("workshopTelemetry").get();
        const rows = snapshot.docs
          .map((d) => d.data())
          .filter((d) => d.payload.data["workshop.session.id"] === sid);
        const delivered = rows.every((d) => d.status === "delivered");
        stable = delivered && rows.length === previousCount ? stable + 1 : 0;
        previousCount = rows.length;
        return stable >= 3;
      },
      { timeout: 60000, intervals: [1000] },
    )
    .toBe(true);
  await student.context.close();
  await fac.context.close();
});
