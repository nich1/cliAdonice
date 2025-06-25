import { execSync } from 'child_process';
import OpenAI from "openai";

export async function generatePR(key: string, targetBranch: string, org: string, pat: string, userInput: string): Promise<string> {

  const openai = new OpenAI({
    apiKey: key,
  });

  const root = process.cwd();
  if (!root) {
    console.error('❌ No workspace folder open');
    return JSON.stringify({ Title: 'Error', Body: 'No workspace folder is open in VS Code.' });
  }

  // Detect git branch
  let branch = 'unknown';
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root, encoding: 'utf8' }).trim();
    if (!branch) { // Even if execSync doesn't throw, it might return empty string
      return 'Failed to detect current Git branch. Please ensure you are in a Git repository.';
    }
  } catch (e) {
    const errorMessage = (e as Error).message.includes('not a git repository') ?
                         'The current workspace is not a Git repository.' :
                         `Error detecting Git branch: ${(e as Error).message}`;
    return `Git Error: ${errorMessage}` ;
  }

  // Get git diff
  let diff = '';
  try {
    diff = execSync(`git diff origin/${targetBranch}...HEAD`, { cwd: root, encoding: 'utf8' });
    if (!diff) {
      diff = 'No changes detected.';
    }
  } catch (e) {
    const errorMessage = (e as Error).message.includes('bad object') ?
                         `The target branch 'origin/${targetBranch}' does not exist or is not reachable.` :
                         `Error getting Git diff: ${(e as Error).message}`;
    return `${errorMessage}`;
  }
  // Compose prompt for OpenAI
  const prPrompt = `
  Current branch: ${branch}
  Changes:
  ${diff}

  User input: ${userInput}`;

  // System prompt
  const systemPrompt = `
  You are an Azure DevOps pull request assistant.

  Create a new pull request draft that is concise and professional based on the provided changes.

  You will ONLY and ALWAYS respond in the following exact JSON format — with NO markdown, code blocks, or explanations.
  DO NOT wrap the JSON in triple backticks or markdown code fences.

  Respond ONLY with this format:
  {
    "Title": "...",
    "Body": "..."
  }
  NEVER give a response that is not of that format
  `;

  // API call to OpenAI
  try {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{role: 'system', content: systemPrompt}, {role: 'user', content: prPrompt }],
    max_tokens: 300,
  });

  let prDraft = completion.choices[0].message?.content?.trim();
  if (!prDraft) {
    return "Agent did not return a PR draft.";
  }

  // Clean up the response by removing any code block markers if agent doesn't follow format
  prDraft = prDraft.replace(/```json|```/g, '').trim();

  // Try to parse JSON from agent response
  let parsed;
  try {
    parsed = JSON.parse(prDraft);
  } catch (e) {
    return `Failed to parse JSON from agent response: ${e}`;
  }

  return JSON.stringify(parsed);
} catch (error) {
  return `Agent error: ${error}`;
}
}

export async function agentRun(key: string, targetBranch: string, input: string, org: string, pat: string): Promise<string> {
  input = input.trim();
  let response = generatePR(key, targetBranch, input, org, pat)
  const normalResponse: string = await response;

  const cleaned = normalResponse.replace(/```json|```/g, '').trim();
  return cleaned;
}
