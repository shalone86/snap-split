import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS, PER_LEVEL, makeLevel, choicesFor, sentence } from "../public/js/problems.js";

test("problems stay inside each level's numbers", () => {
  for (const L of LEVELS) {
    for (let seed = 1; seed <= 200; seed++) {
      const ps = makeLevel(L, seed);
      assert.equal(ps.length, PER_LEVEL);
      ps.forEach((p, i) => {
        const tag = `${L.id} #${i} ${JSON.stringify(p)}`;
        assert.ok(p.answer >= 1 && p.answer <= L.max, tag);
        if (p.type === "join") { assert.ok(p.a >= 1 && p.b >= 1, tag); assert.equal(p.a + p.b, p.answer, tag); }
        if (p.type === "split") { assert.ok(p.take >= 1 && p.take < p.whole && p.whole <= L.max, tag); assert.equal(p.whole - p.take, p.answer, tag); }
        if (L.type !== "mix") assert.equal(p.type, L.type, tag);
        if (L.max === 10 && i < 2) assert.ok(p.answer <= 10, tag);
      });
      if (L.type === "mix") assert.deepEqual(new Set(ps.map((p) => p.type)), new Set(["join", "split"]));
    }
  }
});

test("three different choices, including the answer", () => {
  for (let max of [5, 10]) for (let a = 1; a <= max; a++) {
    const c = choicesFor(a, max);
    assert.equal(c.length, 3);
    assert.equal(new Set(c).size, 3);
    assert.ok(c.includes(a));
    assert.ok(c.every((x) => x >= 1 && x <= max));
  }
});

test("number sentences", () => {
  assert.equal(sentence({ type: "join", a: 3, b: 2, answer: 5 }), "3 + 2 = 5");
  assert.equal(sentence({ type: "split", whole: 5, take: 2, answer: 3 }), "5 − 2 = 3");
});
