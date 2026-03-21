#!/usr/bin/env node
// Ralph-o-bot Credential Guard — PreToolUse hook.
// Scans file content being written or edited for credential patterns
// (API keys, tokens, passwords, private keys) and blocks the operation
// if a match is found. Best-effort — never fails the tool call on error.

'use strict';

const CREDENTIAL_PATTERNS = [
  // Generic API keys and tokens
  { name: 'Generic API key', pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["']?[A-Za-z0-9\-_.]{20,}["']?/i },
  { name: 'Generic secret', pattern: /(?:secret|private[_-]?key)\s*[:=]\s*["']?[A-Za-z0-9\-_.]{20,}["']?/i },
  { name: 'Generic token', pattern: /(?:auth[_-]?token|access[_-]?token|bearer)\s*[:=]\s*["']?[A-Za-z0-9\-_.]{20,}["']?/i },
  { name: 'Generic password', pattern: /(?:password|passwd|pwd)\s*[:=]\s*["']?[^\s"']{8,}["']?/i },

  // AWS
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'AWS Secret Key', pattern: /(?:aws_secret_access_key|aws_secret)\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}["']?/i },

  // GitHub
  { name: 'GitHub PAT (classic)', pattern: /ghp_[A-Za-z0-9]{36}/ },
  { name: 'GitHub PAT (fine-grained)', pattern: /github_pat_[A-Za-z0-9_]{82}/ },
  { name: 'GitHub OAuth token', pattern: /gho_[A-Za-z0-9]{36}/ },

  // Slack
  { name: 'Slack token', pattern: /xox[bpors]-[0-9]{10,}-[A-Za-z0-9-]+/ },

  // Stripe
  { name: 'Stripe key', pattern: /(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,}/ },

  // Private keys
  { name: 'Private key', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },

  // Atlassian / Jira
  { name: 'Atlassian API token', pattern: /(?:jira_api_token|atlassian[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9+/=]{24,}["']?/i },

  // Linear
  { name: 'Linear API key', pattern: /lin_api_[A-Za-z0-9]{40,}/ },

  // Database connection strings
  { name: 'Database connection string', pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s"']+:[^\s"']+@/i },
];

// Files that are expected to contain credentials — always allow writes to these
const ALLOWED_PATH_SUFFIXES = [
  '.env',
  '.env.local',
  '.env.example',
  '.env.development',
  '.env.test',
  '.clancy/.env',
];

function isAllowedPath(filePath) {
  if (!filePath) return false;
  return ALLOWED_PATH_SUFFIXES.some(suffix => filePath.endsWith(suffix));
}

function scanForCredentials(content) {
  if (!content || typeof content !== 'string') return [];
  const matches = [];
  for (const { name, pattern } of CREDENTIAL_PATTERNS) {
    if (pattern.test(content)) matches.push(name);
  }
  return matches;
}

function readInput() {
  if (process.argv[2]) return process.argv[2];
  try { return require('fs').readFileSync('/dev/stdin', 'utf8'); } catch { return '{}'; }
}

try {
  const input = JSON.parse(readInput());
  const toolName = input.tool_name || '';
  const toolInput = input.tool_input || {};

  if (!['Write', 'Edit', 'MultiEdit'].includes(toolName)) {
    process.exit(0);
  }

  const filePath = toolInput.file_path || '';

  if (isAllowedPath(filePath)) {
    process.exit(0);
  }

  let contentToScan = '';
  if (toolName === 'Write') {
    contentToScan = toolInput.content || '';
  } else if (toolName === 'Edit') {
    contentToScan = toolInput.new_string || '';
  } else if (toolName === 'MultiEdit') {
    contentToScan = (toolInput.edits || []).map(e => e.new_string || '').join('\n');
  }

  const found = scanForCredentials(contentToScan);

  if (found.length > 0) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `Credential guard: blocked writing to ${filePath || 'file'}. Detected: ${found.join(', ')}. Move credentials to .env instead.`,
      },
    }));
  }
} catch {
  // Best-effort — never block on error
}
