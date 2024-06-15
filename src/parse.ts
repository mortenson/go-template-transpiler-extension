import * as vscode from 'vscode';

// Parses out a document header in the format gotype: package.type
export const GOTYPE_REGEX = /gotype: (\S+)\.(\S+)/;

/* {{-?       - Open bracket
   [^}]*      - Whitespace, leading function name, etc.
   \s         - Start of current typing
   ([^\s}]*)  - Current word
   \.         - Trailing period, user wants autocomplete
*/
// Matches as many non-whitespace characters before the typed dot as possible,  without going past {{
export const AUTOCOMPLETE_REGEX = /{{-?[^}]*\s([^\s}]*)\./g;

/* {{-?       - Open bracket
   [^}]*      - Whitespace, leading function name, etc.
   \s         - Start of current typing
   ([^\s}]*)  - Current word
   $          - End of string
*/
// Matches as many non-whitespace characters before the hovered character as possible, without going past {{
const HOVER_BEFORE_REGEX = /{{-?[^}]*\s([^\s}]*)$/;

// ([a-zA-Z0-9\$]+) - Alphanumeric plus $
// Matches as many alphanumeric characters on/after the hovered character as possible
const HOVER_AFTER_REGEX = /^([a-zA-Z0-9$]+)/;

/*  {{-?        - Open bracket
    \s*         - Optional whitespace
    ([^\s}]*)   - Action
    \s*         - Optional whitespace
    ([^}]*)     - Action arguments, includes whitespace
    \s*         - Optional whitespace
    -?}}        - Closing bracket
*/
// Matches anything between {{ }} while trying to capture one group for the action (range, if, etc.) and another for
// the right hand side, ex: '{{ range $foo := .Bar }}' would result in ['range', '$foo := .Bar']
const GO_TEMPLATE_TAG_REGEX = /{{-?\s*([^\s}]*)\s*([^}]*)\s*-?}}/g;

const replaceVarWithScope = (replaceVar: string, scopeVarStack: string[]) => {
	if (replaceVar === '.') {
		return scopeVarStack[scopeVarStack.length - 1];
	} else {
		return replaceVar.replace(/^\./, scopeVarStack[scopeVarStack.length - 1] + '.');
	}
};

export const assembleGoCode = (docText: string, pathPosition: vscode.Position, packageName: string, typeName: string, currentPath: string) => {
  // The depth is used for cosmetic purposes (how many tabs to add), and to determine when "global" scope should be changed.
	let depth = 0;
  // The scope stack tracks the current meaning of leading dots within ranges.
  // Personally I just tend not to use range without := but this is nice to have.
	let scopeVarStack: string[] = [`(${typeName}{})`];
  // When the scope last changed, aka when scopeVarStack should be popped later on.
	let lastScopeChangeAtDepth = 0;
  // Attempt to minimally convert template code into Go code, mostly to track variables within ranges.
  // Note: An earlier version of this tried to just convert the current line into Go code, but nested ranges made
  // tracking variable scope hard ($foo = $bar, $bar = .Foo, ...) so letting Go handle it seems better.
	const prefixCode: string[] = [];
	docText.split('\n', pathPosition.line + 1).forEach((line, lineNum) => {
    // You can have multiple tags on one line, common for things like class names.
		if (lineNum === pathPosition.line) {
			line = line.slice(0, pathPosition.character);
		}
		Array.from(line.matchAll(GO_TEMPLATE_TAG_REGEX)).forEach(match => {
			const [, tag, partsStr] = match;
			const parts = partsStr.replace(/\s\s+/g, ' ').trim().split(' ');
			const tabs = '\t'.repeat(depth + 1);
			switch (tag) {
				case 'range':
					depth++;
					if (parts.length === 1) {
						const scopeVar = `depth_${depth}`;
						lastScopeChangeAtDepth = depth;
						prefixCode.push(`${tabs}for _, ${scopeVar} := range ${replaceVarWithScope(parts[0], scopeVarStack)} {`);
						scopeVarStack.push(scopeVar);
					} else if (parts.length === 3) {
						prefixCode.push(`${tabs}for _, ${parts[0]} := range ${replaceVarWithScope(parts[2], scopeVarStack)} {`);
					} else if (parts.length === 4) {
						prefixCode.push(`${tabs}for ${parts[0]} ${parts[1]} := range ${replaceVarWithScope(parts[3], scopeVarStack)} {`);
					}
					break;
				case 'if':
				case 'block':
				case 'with':
				case 'define':
					depth++;
          // Seems stupid, but without these loose opening tags I could end up with incorrect nesting levels due to {{ end }}
					prefixCode.push(`${tabs}if (true) {`);
					break;
				case 'end':
					depth--;
					prefixCode.push(`${'\t'.repeat(depth + 1)}}`);
          // Time to pop.
					if (depth < lastScopeChangeAtDepth) {
						lastScopeChangeAtDepth = depth;
						scopeVarStack.pop();
            // Haven't run into this but an empty stack would be pretty bad.
						if (scopeVarStack.length === 0) {
							scopeVarStack = [`(${typeName}{})`];
						}
					}
					if (depth < 0) {
						depth = 0;
						console.error('unreachable case, nesting level depth less than 0');
					}
					break;
			}
		});
	});
	const prefixCodeStr = prefixCode.join('\n').replace(/\$/g, 'dollar_');
  const suffixCode: string[] = [];
  // Pretty gross up but ensures that we have enough closing brackets since we end parsing the template "early".
	for (let i = 0; i < (prefixCodeStr.match(/{/g)||[]).length - (prefixCodeStr.match(/}/g)||[]).length; ++i) {
		suffixCode.push(`${'\t'.repeat(i + 1)}}`);
	}
	let rhs = '';
	if (currentPath === '') {
		rhs = `${scopeVarStack.pop()}`;
	} else if (currentPath === '$') {
		rhs = `${typeName}{}`;
	} else if (currentPath.slice(0, 2) === '$.') {
		rhs = `${typeName}{}.` + currentPath.slice(2);
	} else if (currentPath[0] === '.') {
		rhs = `${scopeVarStack.pop()}${currentPath}`;
	} else {
		rhs = `${currentPath}`;
	}
	const codeLine = `${'\t'.repeat(depth + 1)}foo := ${rhs.replace(/^\$/, 'dollar_')}.`;

	const fileContent = `package main

import . "${packageName}"

func main() {
${prefixCodeStr}
${codeLine}
${suffixCode.join('\n')}
}`;
	console.log(fileContent);
	return {
		fileContent: fileContent,
		currentPathPosition: new vscode.Position(5 + (prefixCodeStr.match(/\n/g)||[]).length + 1, codeLine.length),
	};
};

// 
export const assembleGoCodeForHover = (document: vscode.TextDocument, position: vscode.Position) => {
	const docText = document.getText();
	const matches = docText.match(GOTYPE_REGEX);
	if (matches?.length !== 3) {
		return null;
	}
	const [, packageName, typeName] = matches;

	const line = document.lineAt(position).text;
	let currentPath = '';
	// Special case - hovering gotype line, probably I guess
	let offset = 0;
	if (line.slice(0, position.character).match(GOTYPE_REGEX)) {
		currentPath = `${typeName}{}`;
		offset = 3;
	} else {
		const lineBeforeMatch = line.slice(0, position.character).match(HOVER_BEFORE_REGEX);
		const lineAfterMatch = line.slice(position.character).match(HOVER_AFTER_REGEX);
		if (!lineBeforeMatch || !lineAfterMatch) {
			return null;
		}
		const beforePath = lineBeforeMatch.length === 2 ? lineBeforeMatch[1] : '';
		const afterPath = lineAfterMatch.length === 2 ? lineAfterMatch[1] : '';
		currentPath = beforePath + afterPath;
		offset = 2;
	}
	const goCode = assembleGoCode(docText, position, packageName, typeName, currentPath);
	// Trailing dot or brackets breaks hover
	goCode.currentPathPosition = new vscode.Position(goCode.currentPathPosition.line, goCode.currentPathPosition.character - offset);
	return goCode;
};
