import * as vscode from 'vscode';
import * as tmp from 'tmp';
import * as fs from 'fs';

import {AUTOCOMPLETE_REGEX, GOTYPE_REGEX, assembleGoCode, assembleGoCodeForHover} from './parse';

tmp.setGracefulCleanup();

export async function activate(context: vscode.ExtensionContext) {
  const definitionProvider = vscode.languages.registerDefinitionProvider(
    {language: 'gotmpl_hack', scheme: 'file'},
    {
      async provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
        const goCode = assembleGoCodeForHover(document, position);
        if (!goCode) {
          return [];
        }
        const tmpFile = tmp.fileSync({ postfix: '.go' });
        fs.writeFileSync(tmpFile.name, goCode.fileContent);
        const results: vscode.Definition | vscode.DefinitionLink[] = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', vscode.Uri.file(tmpFile.name), goCode.currentPathPosition);
        tmpFile.removeCallback();
        return ((Array.isArray(results) ? results : [results]).filter(result => {
          if ('targetUri' in result) {
            return !result.targetUri.path.includes('/tmp');
          } else {
            return !result.uri.path.includes('/tmp');
          }
        // Dunno why this cast is needed.
        }) as vscode.DefinitionLink[]);
      },
    }
  );

  const hoverProvider = vscode.languages.registerHoverProvider(
    {language: 'gotmpl_hack', scheme: 'file'},
    {
      async provideHover(document: vscode.TextDocument, position: vscode.Position) {
        const goCode = assembleGoCodeForHover(document, position);
        if (!goCode) {
          return;
        }
        const tmpFile = tmp.fileSync({ postfix: '.go' });
        fs.writeFileSync(tmpFile.name, goCode.fileContent);
        const results: vscode.Hover[] = await vscode.commands.executeCommand('vscode.executeHoverProvider', vscode.Uri.file(tmpFile.name), goCode.currentPathPosition);
        tmpFile.removeCallback();
        if (results.length) {
          return new vscode.Hover(results[0].contents);
        }
      },
    }
  );

  const completionProvider = vscode.languages.registerCompletionItemProvider(
    {language: 'gotmpl_hack', scheme: 'file'},
    {
      async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const docText = document.getText();
        const matches = docText.match(GOTYPE_REGEX);
        if (matches?.length !== 3) {
          return;
        }
        const [, packageName, typeName] = matches;

        const linePrefixMatches = Array.from(document.lineAt(position).text.slice(0, position.character).matchAll(AUTOCOMPLETE_REGEX));
        if (!linePrefixMatches) {
          return;
        }
        const currentPath = linePrefixMatches.length ? linePrefixMatches[linePrefixMatches.length - 1][1] : '';
        const goCode = assembleGoCode(docText, position, packageName, typeName, currentPath);
        const tmpFile = tmp.fileSync({ postfix: '.go' });
        fs.writeFileSync(tmpFile.name, goCode.fileContent);
        const results: vscode.CompletionList = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', vscode.Uri.file(tmpFile.name), goCode.currentPathPosition);
        tmpFile.removeCallback();
        const retVal: vscode.CompletionItem[] = [];
        results.items.forEach(item => {
          if (item.kind === vscode.CompletionItemKind.Field) {
            retVal.push(new vscode.CompletionItem(item.label, item.kind));
          }
        });
        return retVal;
      }
    },
    '.'
  );

  context.subscriptions.push(definitionProvider);
  context.subscriptions.push(hoverProvider);
  context.subscriptions.push(completionProvider);
}
