import { test } from "node:test";
import assert from "node:assert/strict";
import {
  businessEvent,
  setBusinessActor,
  installInteractionEvents,
} from "../src/lib/rum-business.js";
test("native RUM BizEvents are distinct from user.events and exclude survey free text", () => {
  let sent;
  globalThis.window = {
    dynatrace: {
      sendBizEvent(type, fields) {
        sent = { type, fields };
      },
      sendEvent() {
        assert.fail("wrong API");
      },
    },
  };
  setBusinessActor({ uid: "student", email: "student@example.test" });
  assert.equal(
    businessEvent("survey.submitted", {
      "survey.stage": "post",
      "survey.ratings": { c0: 2, c1: 4, learned: "PRIVATE" },
      "survey.nps": 9,
      body: "PRIVATE",
      token: "PRIVATE",
    }),
    true,
  );
  assert.equal(sent.type, "com.chaicart.rum.workshop.survey.submitted");
  assert.equal(sent.fields["event.authority"], "client-observed");
  assert.equal(sent.fields["user.email"], "student@example.test");
  assert.equal(sent.fields["survey.rating.c1"], 4);
  assert.ok(!JSON.stringify(sent).includes("PRIVATE"));
  setBusinessActor(null);
  businessEvent("identity.signed_out");
  assert.equal(sent.fields["user.email"], undefined);
  delete globalThis.window;
});
test("absent or broken business-event agents cannot break a submission", () => {
  delete globalThis.window;
  assert.equal(businessEvent("work.submitted"), false);
  globalThis.window = {
    dynatrace: {
      sendBizEvent() {
        throw new Error("agent failure");
      },
    },
  };
  assert.equal(businessEvent("work.submitted"), false);
  delete globalThis.window;
});
test("interaction listeners install once and send no button text or input values", () => {
  const listeners = {};
  let count = 0,
    sent;
  globalThis.document = {
    addEventListener(name, fn) {
      count++;
      listeners[name] = fn;
    },
  };
  globalThis.location = { hash: "#/play?s=PRIVATE" };
  globalThis.window = {
    dynatrace: {
      sendBizEvent(type, fields) {
        sent = fields;
      },
    },
  };
  installInteractionEvents();
  installInteractionEvents();
  assert.equal(count, 2);
  listeners.click({
    target: {
      closest() {
        return {
          tagName: "BUTTON",
          id: "submit",
          textContent: "PRIVATE",
          value: "PRIVATE",
        };
      },
    },
  });
  assert.equal(sent.page, "#/play");
  assert.equal(sent["ui.control"], "button");
  assert.ok(!JSON.stringify(sent).includes("PRIVATE"));
  delete globalThis.document;
  delete globalThis.location;
  delete globalThis.window;
});
