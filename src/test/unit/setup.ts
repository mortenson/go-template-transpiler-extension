// Mock vscode module for unit testing
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id: string) {
  if (id === 'vscode') {
    return {
      Position: class Position {
        line: number;
        character: number;

        constructor(line: number, character: number) {
          this.line = line;
          this.character = character;
        }

        isAfter(other: any): boolean {
          return this.line > other.line || (this.line === other.line && this.character > other.character);
        }

        isAfterOrEqual(other: any): boolean {
          return this.line > other.line || (this.line === other.line && this.character >= other.character);
        }

        isBefore(other: any): boolean {
          return this.line < other.line || (this.line === other.line && this.character < other.character);
        }

        isBeforeOrEqual(other: any): boolean {
          return this.line < other.line || (this.line === other.line && this.character <= other.character);
        }

        isEqual(other: any): boolean {
          return this.line === other.line && this.character === other.character;
        }

        compareTo(other: any): number {
          if (this.line < other.line) return -1;
          if (this.line > other.line) return 1;
          if (this.character < other.character) return -1;
          if (this.character > other.character) return 1;
          return 0;
        }

        translate(lineDeltaOrChange?: any, characterDelta?: number): any {
          if (typeof lineDeltaOrChange === 'object') {
            return new Position(
              this.line + (lineDeltaOrChange.lineDelta || 0),
              this.character + (lineDeltaOrChange.characterDelta || 0)
            );
          }
          return new Position(
            this.line + (lineDeltaOrChange || 0),
            this.character + (characterDelta || 0)
          );
        }

        with(lineOrChange?: any, character?: number): any {
          if (typeof lineOrChange === 'object') {
            return new Position(
              lineOrChange.line !== undefined ? lineOrChange.line : this.line,
              lineOrChange.character !== undefined ? lineOrChange.character : this.character
            );
          }
          return new Position(
            lineOrChange !== undefined ? lineOrChange : this.line,
            character !== undefined ? character : this.character
          );
        }
      }
    };
  }
  return originalRequire.apply(this, arguments);
};
