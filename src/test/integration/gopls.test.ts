import '../unit/setup'; // Must be first to mock vscode module
import * as assert from 'assert';
import { Position } from 'vscode';
import { assembleGoCode } from '../../parse';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('Gopls Integration Tests', () => {
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

  // Cleanup helper
  function cleanupModule(moduleDir: string) {
    try {
      fs.rmSync(moduleDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  it('should enable gopls to find field definitions', () => {
    const moduleName = 'types';
    const moduleDir = createTestModule(moduleName, `
type User struct {
	Name     string
	Email    string
	Age      int
	IsActive bool
}
`);

    try {
      const template = `{{/* gotype: main.User */}}
<h1>{{.Name}}</h1>`;
      const position = new Position(1, 10);
      const result = assembleGoCode(template, position, 'main', 'User', '.Name');

      // Fix imports and remove trailing dot for gopls
      const fixedCode = result.fileContent
        .replace(`import . "main"`, `import . "testmodule/${moduleName}"`)
        .replace(/foo := (.+)\.\n/g, 'foo := $1\n');

      const testFile = path.join(moduleDir, 'test.go');
      fs.writeFileSync(testFile, fixedCode);

      // Find position of Name field reference
      const lines = fixedCode.split('\n');
      let line = 0;
      let character = 0;
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/foo := \(User\{\}\)\.(\w+)/);
        if (match) {
          line = i;
          character = lines[i].indexOf(match[1]);
          break;
        }
      }

      // Use gopls to find the definition
      const output = execSync(
        `gopls definition "${testFile}:${line + 1}:${character + 1}"`,
        { cwd: moduleDir, encoding: 'utf-8' }
      );

      // Verify gopls found the field definition
      const expectedPath = fs.realpathSync(path.join(moduleDir, moduleName, 'types.go'));
      const expected = `${expectedPath}:5:2-6: defined here as field Name string`;
      assert.strictEqual(output.trim(), expected);
    } finally {
      cleanupModule(moduleDir);
    }
  });

  it('should enable gopls to validate the generated code', () => {
    const moduleName = 'types';
    const moduleDir = createTestModule(moduleName, `
type User struct {
	Name  string
	Email string
}
`);

    try {
      const template = `{{/* gotype: main.User */}}
<h1>{{.Email}}</h1>`;
      const position = new Position(1, 10);
      const result = assembleGoCode(template, position, 'main', 'User', '.Email');

      const fixedCode = result.fileContent
        .replace(`import . "main"`, `import . "testmodule/${moduleName}"`)
        .replace(/foo := (.+)\.\n/g, 'foo := $1\n');

      const testFile = path.join(moduleDir, 'test.go');
      fs.writeFileSync(testFile, fixedCode);

      // Use gopls check to validate the code
      let hasErrors = false;
      try {
        execSync(`gopls check "${testFile}"`, {
          cwd: moduleDir,
          encoding: 'utf-8',
          stdio: 'pipe'
        });
      } catch (error: any) {
        if (error.stdout && error.stdout.trim() !== '') {
          hasErrors = true;
        }
      }

      assert.ok(!hasErrors, 'Generated code should have no errors');
    } finally {
      cleanupModule(moduleDir);
    }
  });

  it('should enable gopls to find nested field definitions', () => {
    const moduleName = 'types';
    const moduleDir = createTestModule(moduleName, `
type Address struct {
	Street  string
	City    string
	ZipCode string
}

type User struct {
	Name    string
	Address Address
}
`);

    try {
      const template = `{{/* gotype: main.User */}}
<p>{{.Address.City}}</p>`;
      const position = new Position(1, 18);
      const result = assembleGoCode(template, position, 'main', 'User', '.Address.City');

      const fixedCode = result.fileContent
        .replace(`import . "main"`, `import . "testmodule/${moduleName}"`)
        .replace(/foo := (.+)\.\n/g, 'foo := $1\n');

      const testFile = path.join(moduleDir, 'test.go');
      fs.writeFileSync(testFile, fixedCode);

      // Find position of City field reference
      const lines = fixedCode.split('\n');
      let line = 0;
      let character = 0;
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/\.Address\.(\w+)/);
        if (match) {
          line = i;
          character = lines[i].indexOf(match[1]);
          break;
        }
      }

      // Use gopls to find the definition
      const output = execSync(
        `gopls definition "${testFile}:${line + 1}:${character + 1}"`,
        { cwd: moduleDir, encoding: 'utf-8' }
      );

      // Verify gopls found the nested field
      const expectedPath = fs.realpathSync(path.join(moduleDir, moduleName, 'types.go'));
      const expected = `${expectedPath}:6:2-6: defined here as field City string`;
      assert.strictEqual(output.trim(), expected);
    } finally {
      cleanupModule(moduleDir);
    }
  });
});
