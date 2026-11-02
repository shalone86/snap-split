import { test } from "node:test";
import assert from "node:assert/strict";
import { spoken } from "../public/js/kit/speech.js";

test("spoken text reads math and drops emoji and html", () => {
  assert.equal(spoken("<b>3</b> + 2 = ? 🎉"), "3 plus 2 equals what?");
  assert.equal(spoken("7 − 4 = 3"), "7 minus 4 equals 3");
  assert.equal(spoken("2 × 3 ÷ 6"), "2 times 3 divided by 6");
});

// Add your app's own tests (pure logic: levels, question generators…) in test/app.test.js.
