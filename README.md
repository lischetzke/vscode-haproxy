# vscode-haproxy

Syntax highlighting for [HAProxy](https://www.haproxy.org/) configuration files in Visual Studio Code.

A pure TextMate grammar, with no runtime code, telemetry or dependencies. It works with any color theme because it uses standard scope names.

## Features

- **Sections and directives**: `global`, `defaults`, `frontend`, `backend`, `listen`, `peers`, `resolvers`, `log-profile`, `crt-store` and others, along with their directives (including the `tune.*`, `ssl-*` and `httpclient.*` families).
- **Rules**: actions after `http-request`, `http-response`, `http-after-response`, `tcp-request` and `tcp-response`, `http-check` and `tcp-check`.
- **Conditions**: `if` and `unless`, the logical operators `!`, `||` and `OR`, ACL names (in the same color where they are defined and where they are used), and anonymous ACLs like `{ ssl_fc }`.
- **Sample expressions**: fetches, converter chains (`req.hdr(host),lower,map(...)`), and variables (`var(txn.foo)`).
- **ACL matching**: flags (`-i`, `-f`, `-m beg`) and comparison operators (`eq`, `gt`, …).
- **Log-format**: `%ci`, `%{+Q}r`, `%[fetch]`, and named fields `%(name)[fetch]`, both inside and outside quotes.
- **Addresses**: IPv4 and IPv6 with CIDR and ports, `[::]:443`, and address families (`ipv4@`, `unix@`, `abns@`, …).
- **Other values**: numbers with units (`30s`, `100k`), environment variables (`"${VAR}"`, only inside double quotes, which matches HAProxy's own expansion rules), and conditional blocks (`.if` … `.endif`, which can also be folded).
- **Typos stand out**: a line whose first word isn't a known directive is left uncolored.

## Installation

Download the `.vsix` from [Releases](https://github.com/lischetzke/vscode-haproxy/releases), then install it:

```sh
code --install-extension haproxy-syntax-<version>.vsix
```

## File association

The language is detected automatically for:

- `haproxy.cfg`, `hapee-lb.cfg`, `haproxy*.cfg` and `*.haproxy`
- `*.cfg` and `*.conf` files in a `haproxy/` or `haproxy.d/` directory
- any file whose first line opens a section (`global`, `frontend`, `backend`, …)

For other files, such as split config fragments that begin with a comment, add an association in your workspace or user settings:

```json
"files.associations": {
    "**/conf.d/*.conf": "haproxy"
}
```

## Building from source

The grammar is generated from `build/grammar.js`, which holds the keyword lists and the rules. Edit that file rather than `syntaxes/haproxy.tmLanguage.json`.

```sh
node build/grammar.js
npx @vscode/vsce package
```

`samples/sample.haproxy` exercises most constructs, so you can use it to check the highlighting by eye.

## Known limitations

- Regular expressions inside ACL arguments (`-m reg ...`) are not highlighted.
- A comma in a free-form argument (for example `set-header X a,b`) may be highlighted as a converter separator.

## License

[AGPL-3.0](LICENSE)
