import * as vscode from 'vscode';
import * as path from 'path';

const fixturesPath = path.join(__dirname, '../../../src/test/fixtures');

export async function openFixture(fixtureName: string): Promise<vscode.TextDocument> {
	// Set workspace folder to fixtures directory so gopls can find the testfixtures module
	const fixturesUri = vscode.Uri.file(fixturesPath);
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders[0]?.uri.fsPath !== fixturesPath) {
		await vscode.workspace.updateWorkspaceFolders(0, 0, { uri: fixturesUri });
	}

	const templatePath = path.join(fixturesPath, fixtureName);
	const doc = await vscode.workspace.openTextDocument(templatePath);
	await vscode.window.showTextDocument(doc);
	await new Promise(resolve => setTimeout(resolve, 1000));
	return doc;
}

export async function getCompletionsAt(doc: vscode.TextDocument, line: number, char: number): Promise<vscode.CompletionList> {
	const position = new vscode.Position(line, char);
	return await vscode.commands.executeCommand<vscode.CompletionList>(
		'vscode.executeCompletionItemProvider',
		doc.uri,
		position
	);
}

export function extractFieldLabels(completions: vscode.CompletionList): string[] {
	return completions.items
		.filter(item => item.kind === vscode.CompletionItemKind.Field)
		.map(item => typeof item.label === 'string' ? item.label : item.label.label);
}

export function getBaseFields(fieldLabels: string[]): string[] {
	return fieldLabels.filter(f => !f.includes('.')).sort();
}
