import { test } from "node:test";
import assert from "node:assert/strict";
import { authInput } from "../src/lib/auth-input";

const signup = { register: true, name: "Rini", email: "rini@example.test", password: "a-long-test-password" };
test("registration requires a nonblank name", () => {
  for (const name of ["", "   "]) {
    const result = authInput.safeParse({ ...signup, name });
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.error.issues[0].message, "Enter your full name.");
  }
});
test("authentication normalizes email and trims names", () => {
  const data = authInput.parse({ ...signup, email: " RINI@example.test ", name: " Rini " });
  assert.equal(data.email, "rini@example.test");
  assert(data.register);
  assert.equal(data.name, "Rini");
});
test("registration enforces password length without restricting existing sign-in passwords", () => {
  assert.equal(authInput.safeParse({ ...signup, password: "short" }).success, false);
  assert.equal(authInput.safeParse({ register: false, email: signup.email, password: "short" }).success, true);
});

test('workspace choice cannot grant another role or clinical specialty', async()=>{
 const {matchesPortal}=await import('../src/lib/auth-input');
 assert.equal(matchesPortal({role:'patient'},'psychologist'),false);
 assert.equal(matchesPortal({role:'practitioner',specialty:'physiotherapist'},'psychologist'),false);
 assert.equal(matchesPortal({role:'practitioner',specialty:'psychologist'},'psychologist'),true);
 assert.equal(matchesPortal({role:'practitioner',specialty:'physiotherapist'},'physiotherapist'),true);
 assert.equal(matchesPortal({role:'admin'},'admin'),true);
 assert.equal(matchesPortal({role:'admin'},'patient'),false);
 assert.equal(matchesPortal({role:'patient'}),true);
});
