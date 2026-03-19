import { GITHUB_TOKEN, GITHUB_REPO } from './config.js'

const BASE = 'https://api.github.com'

async function req(path, opts = {}) {
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub API ${opts.method || 'GET'} ${path} → ${res.status}: ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

/** Resolve the authenticated user's login */
export async function getCurrentUser() {
  const data = await req('/user')
  return data.login
}

/** List open issues assigned to `assignee` with the given label */
export async function listIssues(label, assignee) {
  const params = new URLSearchParams({
    state: 'open',
    labels: label,
    assignee,
    per_page: '100'
  })
  return req(`/repos/${GITHUB_REPO}/issues?${params}`)
}

/** List all comments on an issue */
export async function listIssueComments(issueNumber) {
  return req(`/repos/${GITHUB_REPO}/issues/${issueNumber}/comments?per_page=100&direction=asc`)
}

/** List all comments on a PR */
export async function listPRComments(prNumber) {
  // PR review comments (inline) — not what we want for general conversation
  // Use issue comments endpoint — PRs are issues in GitHub's API
  return listIssueComments(prNumber)
}

/** List open PRs for a given issue number (via linked PRs heuristic) */
export async function listOpenPRs() {
  const params = new URLSearchParams({ state: 'open', per_page: '100' })
  return req(`/repos/${GITHUB_REPO}/pulls?${params}`)
}

/** Get a single PR */
export async function getPR(prNumber) {
  return req(`/repos/${GITHUB_REPO}/pulls/${prNumber}`)
}

/** Squash merge a PR */
export async function mergePR(prNumber, commitTitle) {
  return req(`/repos/${GITHUB_REPO}/pulls/${prNumber}/merge`, {
    method: 'PUT',
    body: {
      merge_method: 'squash',
      commit_title: commitTitle
    }
  })
}

/** Delete a branch by ref name */
export async function deleteBranch(branchName) {
  return req(`/repos/${GITHUB_REPO}/git/refs/heads/${branchName}`, {
    method: 'DELETE'
  })
}

/**
 * Find the open PR linked to a given issue.
 * GitHub doesn't have a direct API for this — we look at open PRs and check
 * their body for "Closes #N" or the PR's development section.
 */
export async function findPRForIssue(issueNumber) {
  const prs = await listOpenPRs()
  return prs.filter(pr => {
    const body = (pr.body || '').toLowerCase()
    return body.includes(`#${issueNumber}`) || body.includes(`closes #${issueNumber}`)
  })
}
