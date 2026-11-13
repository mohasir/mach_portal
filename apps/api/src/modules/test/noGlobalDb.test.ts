import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC_DIR = resolve(__dirname, '../..');
const MODULES_DIR = join(SRC_DIR, 'modules');
const DB_DIR = join(SRC_DIR, 'db');

// tenant.router.ts serves only authedProcedure (no request transaction, identity tables).
const ALLOWED = new Set(['tenant/tenant.router.ts']);

// Exports of the db module that reach the request pool.
const POOL_EXPORTS = new Set(['db', 'queryClient']);

function isDbModule(fileName: string, specifier: string): boolean {
  if (!specifier.startsWith('.')) return false;
  const target = resolve(dirname(fileName), specifier)
    .replace(/\.(ts|js|mts|mjs|cts|cjs)$/, '')
    .replace(/[\\/]index$/, '');
  return target === DB_DIR;
}

function stringArg(call: ts.CallExpression): string | undefined {
  const [arg] = call.arguments;
  return arg && ts.isStringLiteralLike(arg) ? arg.text : undefined;
}

function poolName(element: ts.ImportSpecifier | ts.ExportSpecifier): boolean {
  if (element.isTypeOnly) return false;
  return POOL_EXPORTS.has((element.propertyName ?? element.name).text);
}

// Every way a file can reach the db module's runtime value: named (also aliased), default and
// namespace imports, import-equals, re-exports, require() and dynamic import(). Type-only forms and
// imports of other names (authDb, types) pass.
function usesGlobalDb(source: string, fileName: string): boolean {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  let found = false;

  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      if (clause && !clause.isTypeOnly && isDbModule(fileName, node.moduleSpecifier.text)) {
        const bindings = clause.namedBindings;
        if (clause.name) found = true;
        else if (bindings && ts.isNamespaceImport(bindings)) found = true;
        else if (bindings && ts.isNamedImports(bindings)) found = bindings.elements.some(poolName);
      }
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const spec = node.moduleSpecifier;
      if (!node.isTypeOnly && ts.isStringLiteral(spec) && isDbModule(fileName, spec.text)) {
        const clause = node.exportClause;
        found = !clause || ts.isNamespaceExport(clause) || clause.elements.some(poolName);
      }
    } else if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly) {
      const ref = node.moduleReference;
      if (
        ts.isExternalModuleReference(ref) &&
        ts.isStringLiteral(ref.expression) &&
        isDbModule(fileName, ref.expression.text)
      ) {
        found = true;
      }
    } else if (ts.isCallExpression(node)) {
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const spec = stringArg(node);
      if ((isRequire || isDynamicImport) && spec && isDbModule(fileName, spec)) found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'test' ? [] : sourceFiles(path);
    return /\.(ts|tsx|mts|cts)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [path] : [];
  });
}

// Module code runs inside the request transaction (ctx.db); a query on the global pool would run
// without the tenant set and wait for a second connection while the request holds one.
describe('modules never use the global db', () => {
  it('only the allow-listed files reach the db module value', () => {
    const offenders = sourceFiles(MODULES_DIR)
      .filter((path) => !ALLOWED.has(relative(MODULES_DIR, path)))
      .filter((path) => usesGlobalDb(readFileSync(path, 'utf8'), path))
      .map((path) => relative(MODULES_DIR, path));
    expect(offenders).toEqual([]);
  });

  describe('detector', () => {
    const file = join(MODULES_DIR, 'x', 'x.service.ts');

    it.each([
      "import { db } from '../../db';",
      "import { db as pool } from '../../db';",
      "import { authDb, db } from '../../db';",
      "import { queryClient } from '../../db';",
      "import { type Executor, db } from '../../db';",
      "import * as dbm from '../../db';",
      "import dbDefault from '../../db';",
      "import dbm = require('../../db');",
      "const { db } = require('../../db');",
      "async function f() { const m = await import('../../db'); return m; }",
      "export { db } from '../../db';",
      "export { db as pool } from '../../db';",
      "export * from '../../db';",
      "export * as dbm from '../../db';",
      "import { db } from '../../db/index';",
      "import { db } from '../../db/index.js';",
      "import { db } from '../../db/index.ts';",
      "import { db } from '../../db.js';",
      "import { db } from '../../db/';",
    ])('flags %s', (source) => {
      expect(usesGlobalDb(source, file)).toBe(true);
    });

    it.each([
      "import type { Executor } from '../../db';",
      "import type * as dbm from '../../db';",
      "import { type Database, type Tx } from '../../db';",
      "import { authDb } from '../../db';",
      "import { authDb as auth } from '../../db/index.js';",
      "export type { Executor } from '../../db';",
      "export { authDb } from '../../db';",
      "import { db } from './db.something';",
      "import { db } from '../../db.something';",
      "import { db } from '../../db/schema';",
      "import { db } from 'db';",
      "import '../../db';",
    ])('passes %s', (source) => {
      expect(usesGlobalDb(source, file)).toBe(false);
    });
  });
});
