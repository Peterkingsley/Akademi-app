'use strict';

// Regenerate the public page after updating the mobile policy:
// node scripts/generate-public-privacy.cjs
// This is a development task; deployment serves the committed generated module.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, '..', 'akademi-frontend', 'src', 'screens', 'main', 'PrivacyDataScreen.tsx');
const source = fs.readFileSync(sourcePath, 'utf8');
const start = source.indexOf('const PrivacyPolicyContent:');
const end = source.indexOf('const TermsOfServiceContent:');
if (start < 0 || end <= start) throw new Error('Cannot locate the mobile privacy policy.');
const policySource = source.slice(start, end).replace(/\r\n/g, '\n');
const file = ts.createSourceFile('policy.tsx', policySource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const normalize = (text) => text.replace(/\s+/g, ' ').trim();
const linkEmails = (text) => escape(text).replace(/([a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1">$1</a>');

function providerTable(node) {
  const rows = [];
  function visit(child) {
    if (ts.isObjectLiteralExpression(child)) {
      const row = {};
      for (const property of child.properties) {
        if (ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer)) {
          row[property.name.getText(file)] = property.initializer.text;
        }
      }
      if (row.provider && row.purpose && row.data) rows.push(row);
    }
    ts.forEachChild(child, visit);
  }
  visit(node);
  if (!rows.length) throw new Error('No service provider disclosures found.');
  return '<div class="table-scroll" tabindex="0" role="region" aria-label="Service provider disclosures"><table><caption>Service providers and data shared</caption><thead><tr><th scope="col">Service provider</th><th scope="col">Purpose</th><th scope="col">Data shared</th></tr></thead><tbody>\n'
    + rows.map((row) => `<tr><th scope="row">${escape(row.provider)}</th><td>${escape(row.purpose)}</td><td>${escape(row.data)}</td></tr>`).join('\n')
    + '\n</tbody></table></div>';
}

function render(node) {
  if (ts.isJsxText(node)) return '';
  if (ts.isJsxSelfClosingElement(node)) {
    const name = node.tagName.getText(file);
    if (name === 'BulletItem') {
      const text = node.attributes.properties.find((property) => ts.isJsxAttribute(property) && property.name.getText(file) === 'text');
      if (!text?.initializer || !ts.isStringLiteral(text.initializer)) throw new Error('Unsupported policy bullet.');
      return `<li>${linkEmails(text.initializer.text)}</li>`;
    }
    if (name === 'View') return '<hr />';
    throw new Error(`Unsupported self-closing policy element: ${name}`);
  }
  if (!ts.isJsxElement(node)) throw new Error('Unsupported dynamic policy content.');
  const name = node.openingElement.tagName.getText(file);
  const attributes = node.openingElement.attributes.getText(file);
  if (name === 'View' && attributes.includes('styles.table')) return providerTable(node);
  if (name === 'View') return node.children.map(render).filter(Boolean).join('\n');
  if (name !== 'Text') throw new Error(`Unsupported policy element: ${name}`);
  if (node.children.some((child) => !ts.isJsxText(child))) throw new Error('Unsupported dynamic policy text.');
  const text = normalize(node.children.map((child) => child.text).join(' '));
  const tag = attributes.includes('styles.mainTitle') ? 'h1'
    : attributes.includes('styles.subSectionTitle') ? 'h3'
      : attributes.includes('styles.sectionTitle') ? 'h2' : 'p';
  const className = attributes.includes('styles.lastUpdated') ? ' class="updated"' : '';
  return `<${tag}${className}>${linkEmails(text)}</${tag}>`;
}

let rootElement;
function findReturn(node) {
  if (ts.isReturnStatement(node) && node.expression) {
    const expression = ts.isParenthesizedExpression(node.expression) ? node.expression.expression : node.expression;
    if (ts.isJsxElement(expression)) rootElement = expression;
  }
  if (!rootElement) ts.forEachChild(node, findReturn);
}
findReturn(file);
if (!rootElement) throw new Error('Cannot render the mobile privacy policy.');
const body = render(rootElement).replace(/(?:<li>.*?<\/li>\n?)+/g, (items) => `<ul>\n${items.trim()}\n</ul>\n`);
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="description" content="Akademi privacy policy: personal data, AI services, storage, retention, and privacy requests." />
<title>Privacy Policy | Akademi</title>
<style>
:root { color-scheme: light; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #202622; background: #f5f7f5; }
* { box-sizing: border-box; }
body { margin: 0; font-size: 16px; line-height: 1.75; }
main { max-width: 900px; margin: 40px auto; padding: clamp(22px, 5vw, 56px); border: 1px solid #dce4dd; border-radius: 18px; background: #fff; }
.brand { color: #23683e; font-size: 17px; font-weight: 750; letter-spacing: .04em; }
h1 { font-size: clamp(28px, 5vw, 40px); line-height: 1.2; margin: 18px 0; letter-spacing: -.035em; }
h2 { margin-top: 38px; font-size: 23px; line-height: 1.4; }
h3 { margin-top: 26px; font-size: 18px; line-height: 1.5; }
p, ul { margin: 14px 0; }
li { margin: 8px 0; }
ul { padding-left: 24px; }
.updated { color: #526358; font-size: 14px; margin: 3px 0; }
a { color: #1b6337; text-underline-offset: 3px; overflow-wrap: anywhere; }
a:focus-visible, .table-scroll:focus-visible { outline: 3px solid #327b4b; outline-offset: 4px; }
hr { border: 0; border-top: 1px solid #dce4dd; margin: 28px 0; }
.table-scroll { overflow-x: auto; margin: 20px 0; }
table { width: 100%; border-collapse: collapse; min-width: 560px; font-size: 14px; }
caption { text-align: left; font-weight: 700; padding-bottom: 10px; }
th, td { padding: 12px; border: 1px solid #dce4dd; text-align: left; vertical-align: top; }
thead th { background: #edf5ee; }
tbody th { font-weight: 650; }
footer { border-top: 1px solid #dce4dd; margin-top: 32px; padding-top: 18px; font-size: 14px; color: #526358; }
@media (max-width: 600px) { main { margin: 0; border: 0; border-radius: 0; } }
@media print { body { background: #fff; } main { max-width: none; margin: 0; border: 0; padding: 0; } }
</style>
</head>
<body><main>
<div class="brand">AKADEMI</div>
${body}
<footer>Akademi &middot; Privacy Policy</footer>
</main></body>
</html>
`;
const hash = crypto.createHash('sha256').update(policySource).digest('hex');
const output = '// Generated from the mobile PrivacyPolicyContent by scripts/generate-public-privacy.cjs.\n'
  + `export const privacyPolicySourceHash = '${hash}';\n`
  + 'export const privacyPolicyHtml = `' + html.replaceAll('`', '\\`').replaceAll('${', '\\${') + '`;\n';
const outputPath = path.join(root, 'src', 'modules', 'legal', 'privacy-policy.html.ts');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output);
console.log('Generated src/modules/legal/privacy-policy.html.ts from the mobile privacy policy.');
