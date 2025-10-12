import './setup'; // Must be first to mock vscode module
import * as assert from 'assert';
import { Position } from 'vscode';
import { assembleGoCode, GOTYPE_REGEX } from '../../parse';

describe('Go Template Transpiler Tests', () => {
  describe('GOTYPE_REGEX', () => {
    it('should parse gotype header correctly', () => {
      const match = 'gotype: mypackage.MyType'.match(GOTYPE_REGEX);
      assert.strictEqual(match?.[1], 'mypackage');
      assert.strictEqual(match?.[2], 'MyType');
    });

    it('should handle nested package names', () => {
      const match = 'gotype: github.com/user/package.MyType'.match(GOTYPE_REGEX);
      assert.strictEqual(match?.[1], 'github.com/user/package');
      assert.strictEqual(match?.[2], 'MyType');
    });
  });

  describe('assembleGoCode', () => {
    it('should transpile simple field access', () => {
      const template = `{{/* gotype: main.User */}}
<h1>{{.Name}}</h1>`;
      const position = new Position(1, 10);
      const result = assembleGoCode(template, position, 'main', 'User', '.Name');

      const expected = `package main

import . "main"

func main() {

	foo := (User{}).Name.

}`;
      assert.strictEqual(result.fileContent, expected);
    });

    it('should transpile if statement', () => {
      const template = `{{/* gotype: main.User */}}
{{if .IsActive}}
  <p>Active</p>
{{end}}`;
      const position = new Position(1, 8);
      const result = assembleGoCode(template, position, 'main', 'User', '.IsActive');

      const expected = `package main

import . "main"

func main() {

	foo := (User{}).IsActive.

}`;
      assert.strictEqual(result.fileContent, expected);
    });

    it('should transpile if-else statement', () => {
      const template = `{{/* gotype: main.User */}}
{{if .IsAdmin}}
  <p>Admin</p>
{{else}}
  <p>User</p>
{{end}}`;
      const position = new Position(1, 8);
      const result = assembleGoCode(template, position, 'main', 'User', '.IsAdmin');

      const expected = `package main

import . "main"

func main() {

	foo := (User{}).IsAdmin.

}`;
      assert.strictEqual(result.fileContent, expected);
    });

    it('should transpile range over slice', () => {
      const template = `{{/* gotype: main.Page */}}
{{range .Items}}
  <li>{{.Name}}</li>
{{end}}`;
      const position = new Position(2, 11);
      const result = assembleGoCode(template, position, 'main', 'Page', '.Name');

      const expected = `package main

import . "main"

func main() {
	for _, depth_1_1 := range (Page{}).Items {
		foo := depth_1_1.Name.
	}
}`;
      assert.strictEqual(result.fileContent, expected);
    });

    it('should transpile range with index and value', () => {
      const template = `{{/* gotype: main.Page */}}
{{range $index, $item := .Products}}
  <p>{{$index}}: {{$item.Name}}</p>
{{end}}`;
      const position = new Position(2, 22);
      const result = assembleGoCode(template, position, 'main', 'Page', '$item.Name');

      const expected = `package main

import . "main"

func main() {
	for dollar_index, dollar_item := range (Page{}).Products {
		foo := dollar_item.Name.
	}
}`;
      assert.strictEqual(result.fileContent, expected);
    });

    it('should transpile with statement', () => {
      const template = `{{/* gotype: main.Post */}}
{{with .Author}}
  <p>{{.Name}}</p>
{{end}}`;
      const position = new Position(2, 9);
      const result = assembleGoCode(template, position, 'main', 'Post', '.Name');

      const expected = `package main

import . "main"

func main() {
	depth_1_1 := (Post{}).Author
	if (true) {
		foo := depth_1_1.Name.
	}
}`;
      assert.strictEqual(result.fileContent, expected);
    });

    it('should transpile nested range', () => {
      const template = `{{/* gotype: main.Blog */}}
{{range .Posts}}
  <h2>{{.Title}}</h2>
  {{range .Comments}}
    <p>{{.Text}}</p>
  {{end}}
{{end}}`;
      const position = new Position(4, 12);
      const result = assembleGoCode(template, position, 'main', 'Blog', '.Text');

      const expected = `package main

import . "main"

func main() {
	for _, depth_1_1 := range (Blog{}).Posts {
		for _, depth_2_1 := range depth_1_1.Comments {
			foo := depth_2_1.Text.
	}
		}
}`;
      assert.strictEqual(result.fileContent, expected);
    });

    it('should transpile variable assignment', () => {
      const template = `{{/* gotype: main.Page */}}
{{$total := .Total}}
<p>Total: {{$total}}</p>`;
      const position = new Position(2, 14);
      const result = assembleGoCode(template, position, 'main', 'Page', '$total');

      const expected = `package main

import . "main"

func main() {

	foo := dollar_total.

}`;
      assert.strictEqual(result.fileContent, expected);
    });

    it('should handle with statement with nested field access', () => {
      const template = `{{/* gotype: main.Post */}}
{{with .Author}}
  <p>{{.Profile.Bio}}</p>
{{end}}`;
      const position = new Position(2, 9);
      const result = assembleGoCode(template, position, 'main', 'Post', '.Profile.Bio');

      const expected = `package main

import . "main"

func main() {
	depth_1_1 := (Post{}).Author
	if (true) {
		foo := depth_1_1.Profile.Bio.
	}
}`;
      assert.strictEqual(result.fileContent, expected);
    });

    it('should handle nested with blocks', () => {
      const template = `{{/* gotype: main.Post */}}
{{with .Author}}
  {{with .Profile}}
    <p>{{.Bio}}</p>
  {{end}}
{{end}}`;
      const position = new Position(3, 12);
      const result = assembleGoCode(template, position, 'main', 'Post', '.Bio');

      const expected = `package main

import . "main"

func main() {
	depth_1_1 := (Post{}).Author
	if (true) {
		depth_2_1 := depth_1_1.Profile
		if (true) {
			foo := depth_2_1.Bio.
	}
		}
}`;
      assert.strictEqual(result.fileContent, expected);
    });

    it('should handle range with conditional', () => {
      const template = `{{/* gotype: main.Blog */}}
{{range .Comments}}
  {{if .Approved}}
    <p>{{.Text}}</p>
  {{end}}
{{end}}`;
      const position = new Position(3, 12);
      const result = assembleGoCode(template, position, 'main', 'Blog', '.Text');

      const expected = `package main

import . "main"

func main() {
	for _, depth_1_1 := range (Blog{}).Comments {
		if (true) {
			foo := depth_1_1.Text.
	}
		}
}`;
      assert.strictEqual(result.fileContent, expected);
    });

    it('should handle $ as root scope inside with block', () => {
      const template = `{{/* gotype: main.Config */}}
{{- with .User }}
some content
{{- end }}
{{- with $.Settings }}
{{- . }}
{{- end }}`;
      const position = new Position(5, 5);
      const result = assembleGoCode(template, position, 'main', 'Config', '.');

      const expected = `package main

import . "main"

func main() {
	depth_1_1 := (Config{}).User
	if (true) {
	}
	depth_1_2 := (Config{}).Settings
	if (true) {
		foo := depth_1_2..
	}
}`;
      assert.strictEqual(result.fileContent, expected);
    });

    it('should handle $.Field inside nested with blocks', () => {
      const template = `{{/* gotype: main.Post */}}
{{- with .Author }}
  {{- with .Profile }}
    {{- with $.Title }}
    test
    {{- end }}
  {{- end }}
{{- end }}`;
      const position = new Position(4, 8);
      const result = assembleGoCode(template, position, 'main', 'Post', '$.Title');

      const expected = `package main

import . "main"

func main() {
	depth_1_1 := (Post{}).Author
	if (true) {
		depth_2_1 := depth_1_1.Profile
		if (true) {
			depth_3_1 := (Post{}).Title
			if (true) {
				foo := (Post{}).Title.
	}
		}
			}
}`;
      assert.strictEqual(result.fileContent, expected);
    });

    it('should handle mixing . and $ references', () => {
      const template = `{{/* gotype: main.Page */}}
{{- with .Header }}
local: {{ .Title }}
root: {{ $.Footer }}
{{- end }}`;
      const position = new Position(3, 15);
      const result = assembleGoCode(template, position, 'main', 'Page', '$.Footer');

      const expected = `package main

import . "main"

func main() {
	depth_1_1 := (Page{}).Header
	if (true) {
		foo := (Page{}).Footer.
	}
}`;
      assert.strictEqual(result.fileContent, expected);
    });
  });
});
