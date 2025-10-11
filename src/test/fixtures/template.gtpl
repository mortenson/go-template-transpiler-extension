{{/* gotype: testfixtures/types.User */}}
<div class="user">
  <h1>{{ .</h1>
  <h1>{{ .Name }}</h1>
  <p>{{ .Email }}</p>
  <p>Age: {{ .Age }}</p>
  {{ if .IsActive }}
    <span class="active">Active</span>
  {{ end }}
  {{ with .Profile }}
  <div class="profile">
    <p>{{ .Bio }}</p>
    <p>Root user: {{ $.Name }}</p>
  </div>
  {{ end }}
  {{ with .Posts }}
    <h2>Posts</h2>
    {{ range . }}
    <div class="post">
      <h2>{{ .Title }}</h2>
      <p>{{ .Content }}</p>
      <p>Tags: {{ range .Tags }}{{ . }} {{ end }}</p>
    </div>
    {{ end }}
  {{ end }}
</div>
