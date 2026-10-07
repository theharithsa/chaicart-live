import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../functions/package.json", import.meta.url),
);
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
import {
  executeWorkshopAction,
  workshopAction,
} from "../functions/workshop.js";
import { bingoBoard } from "../functions/bingo.js";
let app, db;
const admin = { uid: "enhance-admin", email: "enhance-admin@example.com" };
const captain = {
  uid: "enhance-captain",
  email: "enhance-captain@example.com",
};
const sid = "ENHANCE";
const base = () => db.doc(`sessions/${sid}`);
const action = (actor, data) =>
  executeWorkshopAction(db, actor, { sid, ...data });
before(async () => {
  app = initializeApp({ projectId: "demo-chaicart" }, "enhancements");
  db = getFirestore(app);
  await db.doc(`admins/${admin.email}`).set({ role: "facilitator" });
  await base().set({
    currentActivity: "cloud-or-not",
    state: { index: 0, phase: "locked" },
  });
  await base()
    .collection("staff")
    .doc(captain.email)
    .set({ role: "captain", region: "west" });
  await base()
    .collection("public")
    .doc("leaderboard")
    .set({
      scores: { "mumbai-1a": 1000, "mumbai-1b": 1000, "delhi-1a": 1000 },
    });
  await base()
    .collection("private")
    .doc("keys")
    .set({ QUIZ_KEYS: { "cloud-or-not": [{ answer: 0 }, { answer: 1 }] } });
  await base()
    .collection("private")
    .doc("activityKeys")
    .set({ timeline: ["a", "b", "c"] });
  for (const [uid, answer] of [
    ["a", 0],
    ["b", 0],
    ["c", 1],
  ]) {
    await base().collection("students").doc(uid).set({ teamId: "mumbai-1a" });
    await base()
      .collection("submissions")
      .doc(`cloud-or-not__${uid}`)
      .set({
        activity: "cloud-or-not",
        scope: "individual",
        uid,
        teamId: "mumbai-1a",
        answers: { 0: answer, 1: 1 },
      });
  }
});
after(async () => {
  await db.recursiveDelete(base());
  await db.doc(`admins/${admin.email}`).delete();
  await deleteApp(app);
});
test("Cloud or Not records individual results, aggregates +200, and concurrent reveal does not double-credit", async () => {
  await Promise.all([
    action(admin, { action: "scoreCloud", question: 0 }),
    action(admin, { action: "scoreCloud", question: 0 }),
  ]);
  assert.equal(
    (await base().collection("public").doc("leaderboard").get()).data().scores[
      "mumbai-1a"
    ],
    1200,
  );
  assert.equal(
    (await base().collection("quizResults").doc("a").get()).data().credits,
    100,
  );
  assert.equal(
    (await base().collection("quizResults").doc("c").get()).data().credits,
    0,
  );
  assert.equal(
    (await base().collection("quizResults").doc("c").get()).data().answers[0]
      .correct,
    false,
  );
});
test("Cloud question correction reverses personal and team scores and can be re-scored", async () => {
  await action(admin, { action: "undoCloud", question: 0 });
  assert.equal(
    (await base().collection("public").doc("leaderboard").get()).data().scores[
      "mumbai-1a"
    ],
    1000,
  );
  assert.equal(
    (await base().collection("quizResults").doc("a").get()).data().credits,
    0,
  );
  await action(admin, { action: "scoreCloud", question: 0 });
  assert.equal(
    (await base().collection("public").doc("leaderboard").get()).data().scores[
      "mumbai-1a"
    ],
    1200,
  );
  await base().update({ "state.index": 1 });
  await action(admin, { action: "scoreCloud", question: 1 });
  assert.equal(
    (await base().collection("quizResults").doc("a").get()).data().credits,
    200,
  );
  assert.equal(
    (await base().collection("public").doc("leaderboard").get()).data().scores[
      "mumbai-1a"
    ],
    1500,
  );
});
test("captain and facilitator can apply reviewed Architecture/Gallery exactly once", async () => {
  for (const activity of ["architecture", "gallery"]) {
    await base()
      .collection("reviews")
      .doc(`${activity}__mumbai-1b`)
      .set({ activity, teamId: "mumbai-1b", points: 50, status: "approved" });
    await Promise.all([
      action(captain, { action: "applyReview", activity, teamId: "mumbai-1b" }),
      action(admin, { action: "applyReview", activity, teamId: "mumbai-1b" }),
    ]);
  }
  assert.equal(
    (await base().collection("public").doc("leaderboard").get()).data().scores[
      "mumbai-1b"
    ],
    1100,
  );
});
test("incorrect Timeline is reviewable but cannot receive correct-order winner points", async () => {
  await base()
    .collection("submissions")
    .doc("timeline__mumbai-1b")
    .set({ values: { order: ["b", "a", "c"] } });
  await base()
    .collection("reviews")
    .doc("timeline__mumbai-1b")
    .set({ points: 50, status: "approved" });
  await assert.rejects(
    action(captain, {
      action: "applyReview",
      activity: "timeline",
      teamId: "mumbai-1b",
    }),
    /Incorrect Timeline/,
  );
});
test("valid claimed Bingo can be awarded; invalid claims are rejected", async () => {
  await base()
    .collection("reviews")
    .doc("bingo__mumbai-1b")
    .set({ points: 30, status: "approved" });
  await assert.rejects(
    action(captain, {
      action: "applyReview",
      activity: "bingo",
      teamId: "mumbai-1b",
    }),
    /No valid called/,
  );
  const marks = bingoBoard("mumbai-1b").slice(0, 5);
  await base()
    .collection("submissions")
    .doc("bingo__mumbai-1b")
    .set({ values: { marks } });
  await base().collection("public").doc("workshop").set({ bingoCalled: marks });
  await action(captain, {
    action: "applyReview",
    activity: "bingo",
    teamId: "mumbai-1b",
  });
  assert.equal(
    (await base().collection("public").doc("leaderboard").get()).data().scores[
      "mumbai-1b"
    ],
    1130,
  );
});
test("captain manual awards are regional, authenticated, reasoned and idempotent", async () => {
  const award = {
    action: "manualAward",
    activity: "shark-pitch",
    teamId: "mumbai-1b",
    delta: 100,
    reason: "Regional pitch winner",
    operationId: "12345678-1234-1234-1234-123456789012",
  };
  await Promise.all([action(captain, award), action(captain, award)]);
  assert.equal(
    (await base().collection("public").doc("leaderboard").get()).data().scores[
      "mumbai-1b"
    ],
    1230,
  );
  await assert.rejects(
    action(captain, { ...award, teamId: "delhi-1a" }),
    /assigned region/,
  );
  await assert.rejects(
    action({ uid: "student", email: "student@example.com" }, award),
    /Staff access/,
  );
  await assert.rejects(
    action(captain, { ...award, reason: "" }),
    /valid credits/,
  );
  await assert.rejects(
    action(captain, { action: "scoreCloud", question: 1 }),
    /Only facilitators/,
  );
  await assert.rejects(
    workshopAction.run({ data: { sid, ...award } }),
    /staff Google account/,
  );
});
test("delete requires facilitator and exact confirmation, and removes nested records", async () => {
  const deleteSid = "DELETE-TEST",
    ref = db.doc(`sessions/${deleteSid}`);
  await ref.set({ title: "Disposable test" });
  await ref
    .collection("staff")
    .doc(captain.email)
    .set({ role: "captain", region: "west" });
  await ref
    .collection("stationTokens")
    .doc("token")
    .collection("events")
    .doc("1")
    .set({ test: true });
  await assert.rejects(
    executeWorkshopAction(db, captain, {
      sid: deleteSid,
      action: "deleteSession",
      confirm: deleteSid,
    }),
    /Only facilitators/,
  );
  await assert.rejects(
    executeWorkshopAction(db, admin, {
      sid: deleteSid,
      action: "deleteSession",
      confirm: "WRONG",
    }),
    /confirm deletion/,
  );
  assert.equal((await ref.get()).exists, true);
  await executeWorkshopAction(db, admin, {
    sid: deleteSid,
    action: "deleteSession",
    confirm: deleteSid,
  });
  assert.equal((await ref.get()).exists, false);
  assert.equal(
    (
      await ref
        .collection("stationTokens")
        .doc("token")
        .collection("events")
        .doc("1")
        .get()
    ).exists,
    false,
  );
  assert.equal((await ref.collection("staff").get()).empty, true);
});

test('completed session cannot be deleted before permanent learner records are preserved',async()=>{const code='ARCHIVE-TEST',root=db.doc(`sessions/${code}`),history=db.doc(`learningLearners/archive-student/workshops/${code}`);await root.set({completedAt:new Date(),learningArchiveRequired:true});await root.collection('students').doc('archive-student').set({teamId:'mumbai-1a'});await assert.rejects(executeWorkshopAction(db,admin,{sid:code,action:'deleteSession',confirm:code}),/publish permanent learner results/);await root.update({completedAt:null});await assert.rejects(executeWorkshopAction(db,admin,{sid:code,action:'deleteSession',confirm:code}),/publish permanent learner results/);await history.set({status:'completed',personalCredits:100,teamCredits:1300});await executeWorkshopAction(db,admin,{sid:code,action:'deleteSession',confirm:code});assert.equal((await root.get()).exists,false);assert.equal((await history.get()).data().personalCredits,100);await db.recursiveDelete(history);});

test('completed session deletion respects completed learner erasure without recreating history',async()=>{const code='ERASE-ARCHIVE',uid='erased-student',root=db.doc(`sessions/${code}`),marker=db.doc(`learningPrivacy/${uid}`);await root.set({completedAt:new Date(),learningArchiveRequired:true});await root.collection('students').doc(uid).set({teamId:'mumbai-1a'});await marker.set({state:'erasing',blockedSessions:[code],erasedAt:new Date()});await assert.rejects(executeWorkshopAction(db,admin,{sid:code,action:'deleteSession',confirm:code}),/publish permanent learner results/);await marker.update({state:'erased'});await executeWorkshopAction(db,admin,{sid:code,action:'deleteSession',confirm:code});assert.equal((await root.get()).exists,false);assert.equal((await marker.get()).exists,true);assert.equal((await db.doc(`learningLearners/${uid}/workshops/${code}`).get()).exists,false);await marker.delete();});
