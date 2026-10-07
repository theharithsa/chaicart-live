import { test } from 'node:test';
import assert from 'node:assert/strict';
import { telemetryIngest } from '../index.js';

test('GMU and Firebase telemetry origins still require authentication; other origins are denied', async () => {
  for (const [origin, expected] of [
    ['https://gmu.inspi.in', 401],
    ['https://chaicloud-workshop.web.app', 401],
    ['https://chaicloud-workshop.firebaseapp.com', 401],
    ['https://gmu.inspi.in.example.com', 403],
    ['http://gmu.inspi.in', 403],
  ]) {
    let status;
    const req = { method: 'POST', headers: { origin }, is: () => true };
    const res = {
      on() {},
      set() { return this; },
      status(value) { status = value; return this; },
      end() {},
    };
    await telemetryIngest(req, res);
    assert.equal(status, expected, origin);
  }
});
