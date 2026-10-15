// Generates syntaxes/haproxy.tmLanguage.json. Run: node build/grammar.js
const fs = require('fs');
const path = require('path');

// HAProxy tokens contain '-' and '.', so plain \b would match inside e.g. "stats.infra.le-duc.it"
const B = String.raw`(?<![\w.-])`;
const E = String.raw`(?![\w.-])`;
// Stricter for free-standing words/numbers: skip path segments (/admin, HTTP/1.1) and host:port parts
const WB = String.raw`(?<![\w./:@$-])`;
const WE = String.raw`(?![\w./:@-])`;
const alt = (words) => words.map((w) => w.replace(/[.+*?^$()[\]{}|\\]/g, '\\$&')).join('|');
const word = (words) => `${WB}(?:${alt(words)})${WE}`;

const SECTIONS = [
    'global', 'defaults', 'frontend', 'backend', 'listen', 'peers', 'resolvers', 'userlist',
    'mailers', 'program', 'http-errors', 'ring', 'cache', 'log-forward', 'log-profile',
    'crt-store', 'traces', 'acme', 'fcgi-app',
];

const DIRECTIVES = [
    // global
    'ca-base', 'chroot', 'close-spread-time', 'cluster-secret', 'cpu-map', 'cpu-policy', 'cpu-set',
    'crt-base', 'daemon', 'default-path', 'description', 'dns-accept-family',
    'expose-deprecated-directives', 'expose-experimental-directives', 'external-check',
    'fd-hard-limit', 'force-cfg-parser-pause', 'gid', 'grace', 'group', 'guid-prefix',
    'h1-accept-payload-with-any-method', 'h1-case-adjust', 'h1-case-adjust-file',
    'h1-do-not-close-on-insecure-transfer-encoding', 'h2-workaround-bogus-websocket-clients',
    'hard-stop-after', 'insecure-fork-wanted', 'insecure-setuid-wanted', 'issuers-chain-path',
    'key-base', 'limited-quic', 'localpeer', 'log-send-hostname', 'log-tag', 'lua-load',
    'lua-load-per-thread', 'lua-prepend-path', 'master-worker', 'maxcompcpuusage', 'maxcomprate',
    'maxconn', 'maxconnrate', 'maxpipes', 'maxsessrate', 'maxsslconn', 'maxsslrate', 'maxzlibmem',
    'max-spread-checks', 'mworker-max-reloads', 'nbproc', 'nbthread', 'node', 'noepoll',
    'noevports', 'nogetaddrinfo', 'nokqueue', 'nopoll', 'noreuseport', 'nosplice',
    'no-memory-trimming', 'numa-cpu-mapping', 'pidfile', 'pp2-never-send-local', 'prealloc-fd',
    'presetenv', 'quick-exit', 'quiet', 'resetenv', 'set-dumpable', 'set-var', 'set-var-fmt',
    'setcap', 'setenv', 'shm-stats-file', 'shm-stats-file-max-objects', 'spread-checks',
    'stats-file', 'strict-limits', 'thread-group', 'thread-groups', 'thread-hard-limit', 'trace',
    'uid', 'ulimit-n', 'unix-bind', 'unsetenv', 'warn-blocked-traffic-after', 'zero-warning',
    'busy-polling', 'debug', 'anonkey',
    // proxies
    'backlog', 'bind', 'capture', 'compression', 'cookie', 'declare', 'default-server',
    'disabled', 'dispatch', 'enabled', 'errorfile', 'errorfiles', 'errorloc', 'errorloc302',
    'errorloc303', 'error-log-format', 'force-persist', 'fullconn', 'guid',
    'hash-balance-factor', 'hash-key', 'hash-preserve-affinity', 'hash-type', 'http-error',
    'http-send-name-header', 'id', 'ignore-persist', 'load-server-state-from-file', 'log-format',
    'log-format-sd', 'log-steps', 'max-keep-alive-queue', 'max-session-srv-conns', 'monitor',
    'monitor-uri', 'persist', 'rate-limit', 'redirect', 'retries', 'retry-on',
    'server-state-file-name', 'source', 'stick-table', 'transparent', 'unique-id-format',
    'unique-id-header', 'use-fcgi-app', 'clitcpka-cnt', 'clitcpka-idle', 'clitcpka-intvl',
    'srvtcpka-cnt', 'srvtcpka-idle', 'srvtcpka-intvl', 'server-state-base', 'server-state-file',
    // peers / resolvers / cache / ring / program / fcgi-app / crt-store / log-forward / acme
    'table', 'shards', 'default-bind', 'parse-resolv-conf', 'accepted_payload_size', 'hold',
    'resolve_retries', 'resolution_pool_size', 'total-max-size', 'max-object-size', 'max-age',
    'process-vary', 'max-secondary-entries', 'format', 'size', 'backing-file', 'maxlen', 'command',
    'docroot', 'index', 'path-info', 'pass-header', 'set-param', 'log-stderr', 'load',
    'dgram-bind', 'directory', 'account-key', 'contact', 'challenge', 'keytype', 'bits', 'curves',
    'map', 'provider-name', 'acme-vars',
];

// Directive families with open-ended names
const DIRECTIVE_PREFIXES = String.raw`(?:tune|httpclient|ocsp-update|profiling|harden|limits)\.[\w.-]+|ssl-[\w-]+|(?:51degrees|wurfl|deviceatlas)-[\w-]+`;

const FETCHES = [
    // only names usable without parens and not clashing with option words (status, method, ...);
    // fetches in fetch position (acl <name> X, { X ...}, %[X]) are matched positionally anyway
    'src', 'src_port', 'src_is_local', 'dst', 'dst_port', 'dst_is_local', 'path', 'pathq', 'url',
    'urlp', 'url_ip', 'url_port', 'query', 'base', 'base32', 'baseq', 'always_true',
    'always_false', 'date', 'now', 'rand', 'uuid', 'ulid', 'hostname', 'nbproc', 'nbsrv',
    'connslots', 'stopping', 'wait_end', 'cpu_calls', 'lat_ns_avg', 'be_id', 'be_name', 'be_conn',
    'be_sess_rate', 'fe_id', 'fe_name', 'fe_conn', 'fe_req_rate', 'fe_sess_rate', 'srv_id',
    'srv_name', 'srv_conn', 'srv_is_up', 'so_id', 'so_name', 'cook', 'cook_cnt', 'cook_val',
    'scook', 'hdr_cnt', 'hdr_ip', 'hdr_val', 'shdr', 'http_auth', 'http_auth_group',
    'http_first_req', 'payload', 'payload_lv', 'pid', 'uptime', 'last_rule_file',
    'last_rule_line',
];

// Fetch families: ssl_fc_sni, req.hdr, sc0_http_req_rate, path_beg, ...
// No be_/fe_/srv_ family: proxy names (guid be_x.srv, table be_x) commonly use those prefixes
const FETCH_FAMILIES = String.raw`(?:ssl_(?:fc|c|f|bc|s)|fc|bc|src|dst|sc\d?|path|url|hdr|cook|req|res|capture|quic|http|jwt|ocsp)[._][\w.]+|(?:txn|sess|ssl)\.[\w.]+`;

const OPTIONS = [
    // bind / server
    'accept-netscaler-cip', 'accept-proxy', 'addr', 'agent-addr', 'agent-check', 'agent-inter',
    'agent-port', 'agent-send', 'allow-0rtt', 'backup', 'ca-file', 'ca-ignore-err', 'ca-sign-file',
    'ca-verify-file', 'ciphers', 'ciphersuites', 'client-sigalgs', 'check', 'check-proto',
    'check-reuse-pool', 'check-send-proxy', 'check-sni', 'check-ssl', 'check-via-socks4',
    'crl-file', 'crt', 'crt-ignore-err', 'crt-list', 'curves', 'defer-accept', 'disabled',
    'downinter', 'ecdhe', 'enabled', 'error-limit', 'expose-fd', 'fall', 'force-sslv3',
    'force-tlsv10', 'force-tlsv11', 'force-tlsv12', 'force-tlsv13', 'generate-certificates',
    'gid', 'group', 'guid', 'id', 'idle-ping', 'init-addr', 'init-state', 'inter', 'interface',
    'level', 'log-bufsize', 'log-proto', 'maxconn', 'maxqueue', 'max-reuse', 'minconn', 'mode',
    'name', 'namespace', 'nbconn', 'nice', 'no-alpn', 'no-ca-names', 'no-check', 'no-check-ssl',
    'no-send-proxy', 'no-ssl', 'no-sslv3', 'no-tls-tickets', 'no-tlsv10', 'no-tlsv11',
    'no-tlsv12', 'no-tlsv13', 'no-verifyhost', 'observe', 'on-error', 'on-marked-down',
    'on-marked-up', 'pool-conn-name', 'pool-low-conn', 'pool-max-conn', 'pool-purge-delay', 'port',
    'prefer-client-ciphers', 'proto', 'proxy-v2-options', 'quic-cc-algo', 'quic-force-retry',
    'quic-socket', 'redir', 'resolve-net', 'resolve-opts', 'resolve-prefer', 'resolvers', 'rise',
    'send-proxy', 'send-proxy-v2', 'send-proxy-v2-ssl', 'send-proxy-v2-ssl-cn',
    'set-proxy-v2-tlv-fmt', 'severity-output', 'shard', 'sigalgs', 'slowstart', 'sni', 'socks4',
    'ssl', 'ssl-max-ver', 'ssl-min-ver', 'ssl-reuse', 'strict-sni', 'tcp-ut', 'tfo', 'thread',
    'tls-ticket-keys', 'track', 'transparent', 'uid', 'user', 'usesrc', 'v4v6', 'v6only',
    'verify', 'verifyhost', 'weight', 'ws', 'process', 'acme', 'ocsp-update', 'key', 'ocsp',
    'issuer', 'sctl', 'alias',
    // rule actions arguments
    'status', 'content-type', 'hdr', 'lf-file', 'lf-string', 'file', 'string', 'errorfile',
    'errorfiles', 'default-errorfiles', 'location', 'prefix', 'scheme', 'code', 'drop-query',
    'append-slash', 'set-cookie', 'clear-cookie', 'keep-query', 'ignore-empty', 'set-cookie-fmt',
    'deny_status', 'realm', 'len', 'expire', 'size', 'type', 'nopurge', 'srvkey', 'write-to',
    'recv-only', 'format', 'profile', 'sample', 'meth', 'uri', 'uri-lf', 'ver', 'body', 'body-lf',
    'comment', 'min-recv', 'ok-status', 'error-status', 'tout-status', 'on-success', 'linger',
    'timeout', 'socket', 'from', 'to', 'mailers', 'myhostname', 'header', 'request', 'response',
    'cookie', 'insert', 'rewrite', 'indirect', 'nocache', 'postonly', 'preserve', 'httponly',
    'secure', 'domain', 'maxidle', 'maxlife', 'dynamic', 'attr', 'algo', 'offload', 'tcp',
];

const CONSTANTS = [
    'true', 'false', 'on', 'off', 'none', 'required', 'optional', 'all', 'any', 'error',
    'emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'silent',
    'GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'CONNECT', 'TRACE',
    'ipv4', 'ipv6', 'admin', 'operator',
];

const FACILITIES = [
    'kern', 'user', 'mail', 'daemon', 'auth', 'syslog', 'lpr', 'news', 'uucp', 'cron', 'auth2',
    'ftp', 'ntp', 'audit', 'cron2', 'local0', 'local1', 'local2', 'local3', 'local4', 'local5',
    'local6', 'local7', 'stdout', 'stderr', 'raw', 'rfc3164', 'rfc5424', 'short', 'priority',
    'timed', 'iso', 'local',
];

const MATCH_METHODS = ['beg', 'dir', 'dom', 'end', 'found', 'int', 'ip', 'len', 'reg', 'str', 'sub', 'bool'];

const s = (name) => ({ name: `${name}.haproxy` });

const grammar = {
    $schema: 'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
    name: 'HAProxy',
    scopeName: 'source.haproxy',
    patterns: [
        { include: '#comment' },
        { include: '#preprocessor' },
        { include: '#section' },
        { include: '#directive' },
        { include: '#arguments' },
    ],
    repository: {
        comment: {
            match: String.raw`(?<!\\)#.*$`,
            name: 'comment.line.number-sign.haproxy',
        },

        preprocessor: {
            patterns: [
                {
                    begin: String.raw`^\s*(\.(?:if|elif))${E}`,
                    beginCaptures: { 1: s('keyword.control.directive.conditional') },
                    end: '(?=$|#)',
                    patterns: [
                        {
                            match: String.raw`${B}(defined|feature|streq|strneq|strstr|version_atleast|version_before|enabled)(?=\()`,
                            name: 'support.function.builtin.haproxy',
                        },
                        { match: String.raw`&&|\|\||!`, name: 'keyword.operator.logical.haproxy' },
                        { include: '#string-double' },
                        { include: '#string-single' },
                        { include: '#env-var' },
                        { include: '#number' },
                    ],
                },
                {
                    match: String.raw`^\s*(\.(?:else|endif))${E}`,
                    captures: { 1: s('keyword.control.directive.conditional') },
                },
                {
                    begin: String.raw`^\s*(\.(?:diag|notice|warning|alert|line|outdent))${E}`,
                    beginCaptures: { 1: s('keyword.control.directive') },
                    end: '(?=$|#)',
                    patterns: [{ include: '#string-double' }, { include: '#string-single' }, { include: '#env-var' }],
                },
            ],
        },

        section: {
            match: String.raw`^\s*(${alt(SECTIONS)})${E}(?:\s+(?!from\s|#)([^\s#]+))?(?:\s+(from)\s+([^\s#]+))?`,
            captures: {
                1: s('keyword.control.section'),
                2: s('entity.name.section'),
                3: s('keyword.other'),
                4: s('entity.name.section'),
            },
        },

        directive: {
            patterns: [
                {
                    match: String.raw`^\s*(?:(no|default)\s+)?(option)\s+([\w-]+)`,
                    captures: { 1: s('storage.modifier'), 2: s('keyword.other.directive'), 3: s('support.constant.option') },
                },
                {
                    match: String.raw`^\s*(timeout)\s+([\w-]+)`,
                    captures: { 1: s('keyword.other.directive'), 2: s('support.constant.option') },
                },
                {
                    match: String.raw`^\s*(http-request|http-response|http-after-response|http-check|tcp-check|quic-initial)\s+([a-zA-Z][\w.-]*)`,
                    captures: { 1: s('keyword.other.directive'), 2: s('support.function.action') },
                },
                {
                    match: String.raw`^\s*(tcp-request|tcp-response)\s+(connection|session|content|inspect-delay)${E}(?:\s+([a-zA-Z][\w.-]*))?`,
                    captures: { 1: s('keyword.other.directive'), 2: s('keyword.other.directive'), 3: s('support.function.action') },
                },
                {
                    match: String.raw`^\s*(stats|stick|email-alert|capture)\s+([\w-]+)`,
                    captures: { 1: s('keyword.other.directive'), 2: s('support.constant.option') },
                },
                {
                    match: String.raw`^\s*(acl)\s+([^\s#]+)(?:\s+([a-zA-Z][\w.]*)(?![\w.(-]))?`,
                    captures: { 1: s('keyword.other.directive'), 2: s('entity.name.tag.acl'), 3: s('support.variable.fetch') },
                },
                {
                    match: String.raw`^\s*(use_backend|default_backend)\s+(?!%)([^\s#]+)`,
                    captures: { 1: s('keyword.other.directive'), 2: s('entity.name.type.backend') },
                },
                {
                    match: String.raw`^\s*(use_backend|default_backend)${E}`,
                    captures: { 1: s('keyword.other.directive') },
                },
                {
                    match: String.raw`^\s*(server|server-template|use-server|peer|mailer|nameserver|user|group)\s+([^\s#]+)`,
                    captures: { 1: s('keyword.other.directive'), 2: s('entity.name.variable.server') },
                },
                {
                    match: String.raw`^\s*(use-service|filter)\s+([\w.-]+)`,
                    captures: { 1: s('keyword.other.directive'), 2: s('support.function.action') },
                },
                {
                    match: String.raw`^\s*(mode|balance|http-reuse)\s+([\w-]+)`,
                    captures: { 1: s('keyword.other.directive'), 2: s('constant.language') },
                },
                {
                    match: String.raw`^\s*(on)\s+([\w-]+)(?:\s+(format|sd|drop))?`,
                    captures: { 1: s('keyword.other.directive'), 2: s('constant.language'), 3: s('keyword.other.directive') },
                },
                {
                    begin: String.raw`^\s*(?:(no|default)\s+)?(log)${E}`,
                    beginCaptures: { 1: s('storage.modifier'), 2: s('keyword.other.directive') },
                    end: '(?=$|#)',
                    patterns: [
                        { match: word(FACILITIES), name: 'constant.language.facility.haproxy' },
                        { include: '#arguments' },
                    ],
                },
                {
                    match: String.raw`^\s*(?:(no)\s+)?(${alt(DIRECTIVES)}|${DIRECTIVE_PREFIXES})${E}`,
                    captures: { 1: s('storage.modifier'), 2: s('keyword.other.directive') },
                },
            ],
        },

        arguments: {
            patterns: [
                { include: '#comment' },
                { include: '#string-double' },
                { include: '#string-single' },
                { include: '#log-format-sample' },
                { include: '#escape' },
                { include: '#condition' },
                {
                    match: String.raw`${B}(store)\s+([^\s#]+)`,
                    captures: { 1: s('entity.other.attribute-name.option'), 2: s('support.type.data-type') },
                },
                {
                    match: String.raw`${B}(alpn|npn|check-alpn)\s+([^\s#]+)`,
                    captures: { 1: s('entity.other.attribute-name.option'), 2: s('string.unquoted.protocol-list') },
                },
                {
                    match: String.raw`${B}(table|peers)\s+([a-zA-Z_][\w.-]*)`,
                    captures: { 1: s('entity.other.attribute-name.option'), 2: s('entity.name.type.table') },
                },
                {
                    match: String.raw`(?<=\s)(-m)\s+(${alt(MATCH_METHODS)})${E}`,
                    captures: { 1: s('constant.language.flag'), 2: s('constant.language.match-method') },
                },
                {
                    match: String.raw`(?<=\s)-[a-zA-Z][\w-]*${E}|(?<=\s)--(?=\s)`,
                    name: 'constant.language.flag.haproxy',
                },
                {
                    match: String.raw`${B}(?:eq|ne|gt|ge|lt|le)${E}`,
                    name: 'keyword.operator.comparison.haproxy',
                },
                { include: '#address' },
                { include: '#fetch-call' },
                { include: '#converter' },
                { include: '#var-name' },
                { include: '#fetch-bare' },
                {
                    match: String.raw`${B}(?:SSLv3|TLSv1(?:\.[0-3])?)${E}`,
                    name: 'constant.language.tls-version.haproxy',
                },
                { match: word(CONSTANTS), name: 'constant.language.haproxy' },
                { match: word(OPTIONS), name: 'entity.other.attribute-name.option.haproxy' },
                { include: '#number' },
            ],
        },

        // if/unless to end of line: bare words outside { } are ACL names
        condition: {
            begin: String.raw`${B}(if|unless)${E}`,
            beginCaptures: { 1: s('keyword.control.conditional') },
            end: '(?=$|#)',
            patterns: [
                { include: '#anonymous-acl' },
                {
                    match: String.raw`${B}(?:or|OR)${E}|\|\||!`,
                    name: 'keyword.operator.logical.haproxy',
                },
                {
                    match: String.raw`${B}[a-zA-Z_][\w.-]*${E}`,
                    name: 'entity.name.tag.acl.haproxy',
                },
            ],
        },

        // "}" must be space-separated, so regex quantifiers like {32} inside don't close it
        'anonymous-acl': {
            name: 'meta.acl.anonymous.haproxy',
            begin: String.raw`\{(?=\s)`,
            beginCaptures: { 0: s('punctuation.section.braces.begin') },
            end: String.raw`(?<=\s)\}|(?=$)`,
            endCaptures: { 0: s('punctuation.section.braces.end') },
            patterns: [
                {
                    // first token is always a fetch
                    match: String.raw`(?<=\{\s)\s*([a-zA-Z][\w.]*)(?![\w.(-])`,
                    captures: { 1: s('support.variable.fetch') },
                },
                { include: '#arguments' },
            ],
        },

        'string-double': {
            name: 'string.quoted.double.haproxy',
            begin: '"',
            end: '"|(?=$)',
            beginCaptures: { 0: s('punctuation.definition.string.begin') },
            endCaptures: { 0: s('punctuation.definition.string.end') },
            patterns: [{ include: '#escape' }, { include: '#env-var' }, { include: '#log-format' }],
        },

        // no escapes or env expansion inside single quotes, but log-format is parsed after unquoting
        'string-single': {
            name: 'string.quoted.single.haproxy',
            begin: "'",
            end: "'|(?=$)",
            beginCaptures: { 0: s('punctuation.definition.string.begin') },
            endCaptures: { 0: s('punctuation.definition.string.end') },
            patterns: [{ include: '#log-format' }],
        },

        escape: {
            match: String.raw`\\.`,
            name: 'constant.character.escape.haproxy',
        },

        'env-var': {
            match: String.raw`\$\{[A-Za-z_][\w]*(?:[^}]*)\}|\$[A-Za-z_]\w*`,
            name: 'variable.other.environment.haproxy',
        },

        'log-format': {
            patterns: [
                { match: '%%', name: 'constant.character.escape.haproxy' },
                { include: '#log-format-sample' },
                {
                    match: String.raw`(%)(\{[^}]*\})?(\([^)]*\))?([A-Za-z]+)`,
                    captures: {
                        1: s('punctuation.definition.placeholder'),
                        2: s('storage.modifier.log-format-flags'),
                        3: s('entity.name.tag.log-field'),
                        4: s('constant.other.placeholder'),
                    },
                },
            ],
        },

        'log-format-sample': {
            name: 'meta.embedded.sample.haproxy',
            begin: String.raw`(%)(\{[^}]*\})?(\([^)]*\))?(\[)`,
            beginCaptures: {
                1: s('punctuation.section.embedded.begin'),
                2: s('storage.modifier.log-format-flags'),
                3: s('entity.name.tag.log-field'),
                4: s('punctuation.section.embedded.begin'),
            },
            end: String.raw`\]|(?=$)`,
            endCaptures: { 0: s('punctuation.section.embedded.end') },
            patterns: [
                { include: '#fetch-call' },
                { include: '#converter' },
                {
                    match: String.raw`(?<=\[)[a-zA-Z][\w.]*(?![\w.(])`,
                    name: 'support.variable.fetch.haproxy',
                },
                { include: '#string-double' },
                { include: '#string-single' },
                { include: '#number' },
            ],
        },

        'fetch-call': {
            name: 'meta.function-call.haproxy',
            begin: String.raw`${B}([a-zA-Z][\w.]*)(\()`,
            beginCaptures: { 1: s('support.variable.fetch'), 2: s('punctuation.definition.arguments.begin') },
            end: String.raw`\)|(?=$)`,
            endCaptures: { 0: s('punctuation.definition.arguments.end') },
            patterns: [{ include: '#call-args' }],
        },

        converter: {
            patterns: [
                {
                    name: 'meta.function-call.haproxy',
                    begin: String.raw`(?<=[\w)\]])(,)([a-zA-Z][\w.]*)(\()`,
                    beginCaptures: {
                        1: s('punctuation.separator.converter'),
                        2: s('support.function.converter'),
                        3: s('punctuation.definition.arguments.begin'),
                    },
                    end: String.raw`\)|(?=$)`,
                    endCaptures: { 0: s('punctuation.definition.arguments.end') },
                    patterns: [{ include: '#call-args' }],
                },
                {
                    match: String.raw`(?<=[\w)\]])(,)([a-zA-Z][\w.]*)(?![\w.(])`,
                    captures: { 1: s('punctuation.separator.converter'), 2: s('support.function.converter') },
                },
            ],
        },

        'call-args': {
            patterns: [
                { include: '#var-name' },
                { include: '#string-double' },
                { include: '#string-single' },
                { include: '#log-format-sample' },
                { include: '#fetch-call' },
                { include: '#number' },
                { match: ',', name: 'punctuation.separator.arguments.haproxy' },
            ],
        },

        'var-name': {
            match: String.raw`(?<=\()(proc|sess|txn|req|res|check)(\.)([\w.-]+)`,
            captures: {
                1: s('storage.modifier.scope'),
                2: s('punctuation.accessor'),
                3: s('variable.other.haproxy'),
            },
        },

        'fetch-bare': {
            match: String.raw`${WB}(?:${alt(FETCHES)}|${FETCH_FAMILIES})${WE}`,
            name: 'support.variable.fetch.haproxy',
        },

        address: {
            patterns: [
                {
                    match: String.raw`${B}(?:ipv4|ipv6|unix|abns|abnsz|fd|sockpair|udp|udp4|udp6|quic4|quic6|quic|tcp|tcp4|tcp6|rhttp|uxdg|uxst|mptcp|mptcp4|mptcp6)@`,
                    name: 'storage.modifier.address-family.haproxy',
                },
                {
                    match: String.raw`(?<![\w.:-])\d{1,3}(?:\.\d{1,3}){3}(?:/\d{1,2})?(?::\d+(?:-\d+)?)?(?![\w.-])`,
                    name: 'constant.numeric.ip-address.haproxy',
                },
                {
                    // trailing :port is ambiguous for bare IPv6 (HAProxy takes the last colon), so it's part of the token
                    match: String.raw`(?<![\w.:-])(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){0,6}(?:[0-9a-fA-F]{1,4})?::(?:[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})*)?)(?:/\d{1,3})?(?::\d+(?:-\d+)?)?(?![\w.-])`,
                    name: 'constant.numeric.ip-address.haproxy',
                },
                {
                    match: String.raw`(?<=[\s@,"])(?:\*|\[[0-9a-fA-F:.]+\])?:\d+(?:-\d+)?(?![\w.-])`,
                    name: 'constant.numeric.ip-address.haproxy',
                },
            ],
        },

        number: {
            match: String.raw`${WB}\d+(?:\.\d+)?(?:us|ms|s|m|h|d|k|K|M|G|g)?${WE}`,
            name: 'constant.numeric.haproxy',
        },
    },
};

const out = path.join(__dirname, '..', 'syntaxes', 'haproxy.tmLanguage.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(grammar, null, 4) + '\n');
console.log(`wrote ${out}`);
