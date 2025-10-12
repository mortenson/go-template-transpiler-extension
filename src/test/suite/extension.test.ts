import * as assert from 'assert';
import * as vscode from 'vscode';
import { extractFieldLabels, getBaseFields, openFixture, getCompletionsAt } from './helpers';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Starting extension tests...');

	suite('Extension Lifecycle', () => {
		test('Extension should be present', () => {
			const extension = vscode.extensions.getExtension('mortenson.go-template-transpiler-extension');
			assert.ok(extension, 'Extension should be installed');
		});

		test('Extension should activate on .gtpl files', async () => {
			await openFixture('template.gtpl');

			const extension = vscode.extensions.getExtension('mortenson.go-template-transpiler-extension');
			assert.ok(extension?.isActive, 'Extension should be active after opening .gtpl file');
		});
	});

	suite('Completion Provider', () => {
		test('Should return User field completions', async () => {
			const doc = await openFixture('template.gtpl');
			const completions = await getCompletionsAt(doc, 2, 11); // Line 3: <h1>{{ . - after the dot

			const fieldLabels = extractFieldLabels(completions);
			const baseFields = getBaseFields(fieldLabels);
			const expected = ['Age', 'Email', 'IsActive', 'Name', 'Posts', 'Profile'];

			assert.deepStrictEqual(baseFields, expected);
		});

		test('Should return User fields for $ root scope', async () => {
			const doc = await openFixture('template.gtpl');
			const completions = await getCompletionsAt(doc, 12, 27); // Line 13: {{ $.Name }} - after $.

			const fieldLabels = extractFieldLabels(completions);
			const baseFields = getBaseFields(fieldLabels);
			const expected = ['Age', 'Email', 'IsActive', 'Name', 'Posts', 'Profile'];

			assert.deepStrictEqual(baseFields, expected);
		});

		test('Should handle templates without gotype comment gracefully', async () => {
			const doc = await openFixture('no-gotype.gtpl');
			const completions = await getCompletionsAt(doc, 0, 7);

			const fieldLabels = extractFieldLabels(completions);

			assert.strictEqual(fieldLabels.length, 0);
		});
	});

	suite('Hover Provider', () => {
		test('Should return field type information', async () => {
			const doc = await openFixture('template.gtpl');
			const position = new vscode.Position(3, 11); // Line 4: {{ .Name }} - on 'N' of Name

			const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
				'vscode.executeHoverProvider',
				doc.uri,
				position
			);

			const hoverText = hovers.map(h => h.contents.map(c => typeof c === 'string' ? c : c.value).join('\n')).join('\n');

			const expected = `\`\`\`go
field Name string
\`\`\`

---

Full name of the user


---

[\`(types.User).Name\` on pkg.go.dev](https://pkg.go.dev/testfixtures/types#User.Name)`;

			assert.strictEqual(hoverText, expected);
		});
	});

	suite('Definition Provider', () => {
		test('Should point to types.go', async () => {
			const doc = await openFixture('template.gtpl');
			const position = new vscode.Position(4, 10); // Line 5: {{ .Email }} - on 'E' of Email

			const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
				'vscode.executeDefinitionProvider',
				doc.uri,
				position
			);

			const defPath = definitions[0].uri.fsPath;
			const defLine = definitions[0].range.start.line;

			assert.ok(defPath.endsWith('types/types.go'));
			assert.strictEqual(defLine, 5); // Email field is on line 6 (0-indexed = 5)
		});
	});
});
