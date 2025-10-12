import '../unit/setup'; // Must be first to mock vscode module
import * as assert from 'assert';
import { Position } from 'vscode';
import { assembleGoCode } from '../../parse';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('Transpiler Integration Tests', () => {
  const testDir = path.join(__dirname, '../../../example');

  // Helper to create a test Go module with types
  function createTestModule(moduleName: string, typeDefinitions: string): string {
    const moduleDir = fs.mkdtempSync(path.join(os.tmpdir(), `${moduleName}-`));

    // Create go.mod
    fs.writeFileSync(
      path.join(moduleDir, 'go.mod'),
      `module testmodule\n\ngo 1.21\n`
    );

    // Create types subdirectory and package
    const typesDir = path.join(moduleDir, moduleName);
    fs.mkdirSync(typesDir);

    // Create types.go with the type definitions in a separate package
    fs.writeFileSync(
      path.join(typesDir, 'types.go'),
      `package ${moduleName}\n\n${typeDefinitions}\n`
    );

    return moduleDir;
  }

  // Helper to verify transpiled code compiles
  function verifyGoCode(moduleDir: string, moduleName: string, transpiledCode: string): { success: boolean; error?: string } {
    const testFile = path.join(moduleDir, 'test.go');

    try {
      // Fix the import to use the correct module path and remove trailing dots (for gopls autocomplete)
      const fixedCode = transpiledCode
        .replace('package main', 'package main')
        .replace(`import . "main"`, `import . "testmodule/${moduleName}"`)
        .replace(/foo := (.+)\.\n/g, '_ = $1\n') // Remove trailing dot and use _ to avoid "declared and not used"
        .replace(/for (\w+), (\w+) :=/g, 'for _, _ =') // Replace for loop variables with _
        .replace(/\n\t(\w+) := /g, '\n\t_ = '); // Replace other variable declarations with _ assignments

      fs.writeFileSync(testFile, fixedCode);

      // Try to compile the code
      execSync('go build test.go', {
        cwd: moduleDir,
        stdio: 'pipe'
      });

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.stderr?.toString() || error.message
      };
    } finally {
      // Cleanup
      try {
        fs.unlinkSync(testFile);
        const testBinary = path.join(moduleDir, 'test');
        if (fs.existsSync(testBinary)) {
          fs.unlinkSync(testBinary);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  // Cleanup helper
  function cleanupModule(moduleDir: string) {
    try {
      fs.rmSync(moduleDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  it('should generate compilable code for simple field access', () => {
    const moduleName = 'types';
    const moduleDir = createTestModule(moduleName, `
type User struct {
	Name string
}
`);

    try {
      const template = `{{/* gotype: main.User */}}
<h1>{{.Name}}</h1>`;
      const position = new Position(1, 10);
      const result = assembleGoCode(template, position, 'main', 'User', '.Name');

      const compileResult = verifyGoCode(moduleDir, moduleName, result.fileContent);
      assert.ok(compileResult.success, `Compilation failed: ${compileResult.error}`);
    } finally {
      cleanupModule(moduleDir);
    }
  });
});
