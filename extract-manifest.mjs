#!/usr/bin/env node
// Static extractor: walks a directory of TypeScript MCP server source
// and emits an mcp-audit-compatible manifest (tools array with name,
// description, and a placeholder inputSchema if we can't resolve it).
//
// Handles two common MCP SDK patterns:
//   1. server.registerTool("name", { description, inputSchema, ... }, handler)
//   2. server.tool("name", "description", inputSchemaObj, handler)
//
// Usage: node extract-manifest.mjs <server-src-dir> <server-name> <out.json>

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import ts from 'typescript';

const [srcDir, serverName, outPath] = process.argv.slice(2);
if (!srcDir || !serverName || !outPath) {
  console.error('Usage: extract-manifest.mjs <src-dir> <server-name> <out.json>');
  process.exit(1);
}

function walk(target, out = []) {
  const s = statSync(target);
  if (s.isFile()) {
    if (extname(target) === '.ts' && !target.endsWith('.d.ts')) out.push(target);
    return out;
  }
  for (const entry of readdirSync(target)) {
    if (entry === 'node_modules' || entry === '__tests__' || entry.startsWith('.')) continue;
    const p = join(target, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (extname(p) === '.ts' && !p.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

function collapseStringExpr(node) {
  // Handle string literals and string concatenation chains
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    // Template literals with ${} — preserve heads and raw text but drop interpolations
    let s = node.head.text;
    for (const span of node.templateSpans) s += '${...}' + span.literal.text;
    return s;
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const l = collapseStringExpr(node.left);
    const r = collapseStringExpr(node.right);
    if (l != null && r != null) return l + r;
  }
  return null;
}

function extractFromFile(filePath) {
  const src = readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, true);
  const tools = [];

  // Build a local symbol table: const name = <initializer>
  const symbols = new Map();
  function collectSymbols(node) {
    if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name) && node.initializer) {
      symbols.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, collectSymbols);
  }
  collectSymbols(sf);

  function resolveExpr(node) {
    if (!node) return null;
    if (ts.isIdentifier(node) && symbols.has(node.text)) return symbols.get(node.text);
    // Resolve property access: OBJ.prop where OBJ is a known object literal
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const objInit = symbols.get(node.expression.text);
      if (objInit && ts.isObjectLiteralExpression(objInit)) {
        for (const prop of objInit.properties) {
          if (ts.isPropertyAssignment(prop)) {
            const propName = prop.name && ('text' in prop.name ? prop.name.text : null);
            if (propName === node.name.text) return prop.initializer;
          }
        }
      }
    }
    return node;
  }

  function readObjectField(obj, key) {
    if (!obj || !ts.isObjectLiteralExpression(obj)) return null;
    for (const prop of obj.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const propKey = prop.name && ('text' in prop.name ? prop.name.text : null);
      if (propKey === key) return prop.initializer;
    }
    return null;
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      // server.registerTool(name, { ... }, handler)
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'registerTool') {
        const nameExpr = resolveExpr(node.arguments[0]);
        const configExpr = resolveExpr(node.arguments[1]);
        const name = nameExpr ? collapseStringExpr(nameExpr) : null;
        const description = collapseStringExpr(resolveExpr(readObjectField(configExpr, 'description')));
        const title = collapseStringExpr(resolveExpr(readObjectField(configExpr, 'title')));
        if (name) tools.push({ name, title, description: description ?? '', inputSchema: { type: 'object' }, _source: filePath });
      }
      // server.tool(name, description, schema, handler)
      else if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'tool') {
        const nameExpr = resolveExpr(node.arguments[0]);
        const descExpr = resolveExpr(node.arguments[1]);
        const name = nameExpr ? collapseStringExpr(nameExpr) : null;
        const description = descExpr ? collapseStringExpr(descExpr) : null;
        if (name && description != null) tools.push({ name, description, inputSchema: { type: 'object' }, _source: filePath });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);

  // Fallback: the "ToolDefs" object-map pattern (Supabase-style).
  // A top-level const named like *toolDefs / *Tools / etc., assigned to an
  // object literal whose properties each have a nested `description` field,
  // is treated as a tool registry.
  const TOOL_REGISTRY_NAME = /(^tools$|tooldefs?$|tooldefinitions$|toolregistry$)/i;
  for (const [symName, init] of symbols) {
    if (!TOOL_REGISTRY_NAME.test(symName)) continue;
    let obj = init;
    // Unwrap `as const` / `satisfies X` assertion wrappers
    while (obj && (ts.isAsExpression(obj) || ts.isSatisfiesExpression(obj) || ts.isParenthesizedExpression(obj))) {
      obj = obj.expression;
    }
    if (!obj || !ts.isObjectLiteralExpression(obj)) continue;
    for (const prop of obj.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const name = prop.name && ('text' in prop.name ? prop.name.text : null);
      if (!name) continue;
      const descNode = readObjectField(prop.initializer, 'description');
      const description = collapseStringExpr(resolveExpr(descNode));
      if (description != null) {
        tools.push({ name, description, inputSchema: { type: 'object' }, _source: filePath });
      }
    }
  }

  return tools;
}

const files = walk(srcDir);
const allTools = [];
for (const f of files) {
  try { allTools.push(...extractFromFile(f)); }
  catch (e) { console.error(`[warn] ${f}: ${e.message}`); }
}

// Dedup by name (later definitions win)
const byName = new Map();
for (const t of allTools) byName.set(t.name, t);
const tools = [...byName.values()].map(({ _source, ...rest }) => rest);

const manifest = {
  server: { name: serverName, source: srcDir },
  tools,
  resources: [],
  prompts: [],
};

writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log(`✓ ${serverName}: extracted ${tools.length} tools → ${outPath}`);
