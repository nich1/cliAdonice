import fetch from 'node-fetch';
import {execSync} from 'child_process'
import {getEnv} from './settings';

interface CreatePRParams {
  pat: string;
  orgUrl: string;
  project: string;
  repositoryId: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
}


export function getGitMetadata(): {
  project: string;
  repositoryId: string;
  sourceBranch: string;
  targetBranch: string;
} | null {
  const root = process.cwd();
  if (!root) {
    console.error('❌ No workspace folder open');
    return null;
  }

  try {
    console.log('🔍 Running Git commands in:', root);

    const remoteUrl = execSync('git remote get-url origin', { cwd: root, encoding: 'utf8' }).trim();
    const match = remoteUrl.match(/dev\.azure\.com\/[^\/]+\/([^\/]+)\/_git\/([^\/]+)/);
    if (!match || match.length < 3) {
      console.error('❌ Could not parse project and repository from remote URL');
      return null;
    }

    // Extract project and repository ID from the remote URL
    const project = match[1];
    const repositoryId = match[2];

    const sourceBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root, encoding: 'utf8' }).trim();
    const remoteInfo = execSync('git remote show origin', { cwd: root, encoding: 'utf8' });

    // If target branch is saved, default to that
    const savedTargetBranch = getEnv('TARGET_BRANCH');
    const targetBranchMatch = remoteInfo.match(/HEAD branch: (.+)/);
    const targetBranch = savedTargetBranch ?? targetBranchMatch?.[1] ?? 'development';


    return { project, repositoryId, sourceBranch, targetBranch };
  } catch (err) {
    console.error('❌ Error getting Git metadata:', err);
    return null;
  }
}



export async function createPullRequest(params: CreatePRParams): Promise<string> {
  const {
    pat,
    orgUrl,
    project,
    repositoryId,
    sourceBranch,
    targetBranch,
    title,
    description,
  } = params;
  

  const url = `${orgUrl}/${project}/_apis/git/repositories/${repositoryId}/pullrequests?api-version=7.1-preview.1`;

  const payload = {
    sourceRefName: `refs/heads/${sourceBranch}`,
    targetRefName: `refs/heads/${targetBranch}`,
    title,
    description,
    repositoryId,
  };

  // Create a basic auth header using PAT
  const authHeader = 'Basic ' + Buffer.from(`:${pat}`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`❌ Failed to create PR: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data._links?.web?.href ?? data.url; // Return the user-friendly PR link
}