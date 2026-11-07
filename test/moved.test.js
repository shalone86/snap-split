import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

const env = { HOME_URL: "https://angelio.org/regroup/", STORE_KEY: "regroup:v1", ASSETS: { fetch: async () => new Response("app page") } };
const get = (u) => worker.fetch(new Request(u), env, { waitUntil() {} });

test("the old address sends visitors (and their saved progress) to the new one", async () => {
  const r = await get("https://regroup.shalonely.com/");
  const html = await r.text();
  assert.match(html, /location\.replace/);
  assert.match(html, /"https:\/\/angelio\.org\/regroup\/"/);
  assert.match(html, /localStorage\.getItem\("regroup:v1"\)/);
  assert.match(html, /#migrate=/);
});

test("the new address is served normally", async () => {
  assert.equal(await (await get("https://angelio.org/")).text(), "app page");
});

test("without HOME_URL nothing changes", async () => {
  const r = await worker.fetch(new Request("https://anything.example/"), { ASSETS: env.ASSETS }, {});
  assert.equal(await r.text(), "app page");
});
