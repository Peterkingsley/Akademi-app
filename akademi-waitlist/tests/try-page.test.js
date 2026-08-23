const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("the public try route contains the focused interactive product shell", () => {
  const html = read("try/index.html");
  assert.match(html, /Don't take our word for it\./);
  assert.match(html, /Try a question\./);
  assert.match(html, /id="demoScreen"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /viewport-fit=cover/);
});

test("the mobile layout preserves the visible phone frame", () => {
  const styles = read("try/styles.css");
  const mobileRules = styles.slice(styles.indexOf("@media (max-width: 600px)"));
  assert.match(mobileRules, /\.phone-shell\s*\{[\s\S]*?border:\s*1px solid/);
  assert.match(mobileRules, /\.phone-shell\s*\{[\s\S]*?border-radius:\s*38px/);
  assert.match(mobileRules, /\.phone-sensor\s*\{\s*display:\s*block/);
  assert.doesNotMatch(mobileRules, /\.phone-shell\s*\{[^}]*border:\s*0/);
});

test("the browser journey covers material, reasoning, retry, continue, and conversion calls", () => {
  const script = read("try/script.js");
  [
    "/demo/exam-prep/materials",
    "/demo/exam-prep/sessions",
    "/submit",
    "/retry",
    "/next",
    "Why do you think this is the answer?",
    "Yes, give me another",
    "No, continue",
    "Join the waitlist",
  ].forEach((contract) => assert.ok(script.includes(contract), `missing ${contract}`));
});

test("all requested funnel analytics hooks are present", () => {
  const script = read("try/script.js");
  [
    "try_page_viewed",
    "demo_material_selected",
    "demo_question_answered",
    "demo_reasoning_submitted",
    "demo_feedback_viewed",
    "demo_retry_yes",
    "demo_retry_no",
    "demo_completed",
    "demo_conversion_clicked",
  ].forEach((event) => assert.ok(script.includes(event), `missing ${event}`));
});

test("API content is inserted as text rather than unsafe HTML", () => {
  const script = read("try/script.js");
  assert.doesNotMatch(script, /\.innerHTML\s*=/);
  assert.match(script, /textContent/);
  assert.match(script, /role", "radiogroup/);
  assert.match(script, /aria-checked/);
});

test("direct try redirects to the canonical route and nested paths rewrite to the demo document", () => {
  const redirects = read("_redirects");
  assert.match(redirects, /^\/try\s+\/try\/\s+301/m);
  assert.match(redirects, /^\/try\/\*\s+\/try\/index\.html\s+200/m);
});

test("the landing hero leads with Try Akademi and preserves the waitlist", () => {
  const html = read("index.html");
  const tryPosition = html.indexOf('<a class="button primary" href="/try/">Try Akademi</a>');
  const waitlistPosition = html.indexOf('<a class="button secondary" href="#waitlist">Join the waitlist</a>');
  assert.ok(tryPosition >= 0);
  assert.ok(waitlistPosition > tryPosition);
  assert.match(html, /id="waitlistForm"/);
});
