#!/usr/bin/env node
import { Command } from 'commander';
import dotenv from 'dotenv';
import { getEnv, setEnv } from './settings';
import { agentRun } from './prCreateAgent';
import { createPullRequest, getGitMetadata } from './sendRequest';
import { confirmEditPrompt, confirmSubmitPr} from './prompts';
import { editPrDetails  } from './edit';


dotenv.config();

const program = new Command();

program
  .name('adonice')
  .description('CLI for PR automation and config management')
  .version('0.1.0');

// Config keys and labels
const configKeys = [    
  { key: 'OPENAI_API_KEY', label: 'OpenAI API Key' },
  { key: 'AZURE_PAT', label: 'Azure Personal Access Token' },
  { key: 'ORG_URL', label: 'Organization URL' },
  { key: 'TARGET_BRANCH', label: 'Default Target Branch' }
];

// Dynamically generate getter/setter commands
configKeys.forEach(({ key, label }) => {
  program
    .command(`get-${key.toLowerCase()}`)
    .description(`Get ${label}`)
    .action(() => {
      const value = getEnv(key as any);
      if (value) {
        console.log(`${key} = ${value}`);
      } else {
        console.log(`${key} is not set.`);
      }
    });

  program
    .command(`set-${key.toLowerCase()} <value>`)
    .description(`Set ${label}`)
    .action((value: string) => {
      setEnv(key as any, value);
    });
});

// Run agent command
program
  .command('run')
  .description('Run the PR agent')
  .option('-t, --target <branch>', 'Target branch (overrides config)')
  .option('-p, --prompt <input>', 'User input prompt for PR generation')
  .action(async (options) => {
    try {
        const key = getEnv('OPENAI_API_KEY');
        const pat = getEnv('AZURE_PAT');
        const org = getEnv('ORG_URL');
        const defaultBranch = getEnv('TARGET_BRANCH') ?? 'main';  
        let targetBranch = options.target ?? defaultBranch;
        const userInput = options.prompt ?? 'Generate PR';

        if (!key || !pat || !org) {
        let missing_requirements = '';
        if (!key) missing_requirements += 'OPENAI_API_KEY, ';
        if (!pat) missing_requirements += 'AZURE_PAT, ';
        if (!org) missing_requirements += 'ORG_URL, ';
        missing_requirements = missing_requirements.replace(/, $/, '');
        console.error(`❌ Missing required config: ${missing_requirements}`);
        console.error('\nVariables can be set with `adonice set-openai_api_key`, `adonice set-azure_pat`, and `adonice set-org_url` commands.');
        process.exit(1);
        }

        // Get metadata
        const gitMeta = getGitMetadata();
        if (!gitMeta) {
        console.error('❌ Could not retrieve Git metadata.');
        process.exit(1);
        }

        const { project, repositoryId, sourceBranch, targetBranch: genBranch } = gitMeta;
        if (!targetBranch) {
        targetBranch = genBranch;
        }

        // Run the agent
        const result = await agentRun(key, targetBranch, userInput, org, pat);

        // Parse the returned cleaned JSON string
        let Title: string = '';
        let Body: string = '';
        try {
            const parsed = JSON.parse(result);
            Title = parsed.Title;
            Body = parsed.Body;

            console.log('\n✅ Pull Request Generated:\n');
            console.log(`Title: ${Title}`);
            console.log(`Body:\n${Body}`);
        } catch (err) {
            console.error('❌ Failed to parse PR result:', err);
        }
        console.log(`Source Branch: ${sourceBranch}`);
        console.log(`Target Branch: ${targetBranch}`);
        console.log(`Organization URL: ${org}`);
        console.log(`Project: ${project}`)
        console.log(`Repository ID: ${repositoryId}`)

        let prData = {
            title: Title,
            body: Body,
            sourceBranch: sourceBranch,
            targetBranch: targetBranch,
            organizationUrl: org,
            project: project,
            repositoryId: repositoryId
        }

        // Ask if user wants to edit PR details
        const editChoice = await confirmEditPrompt();
        if (editChoice) {
          console.log('\n🛠 Opening editor for PR details...');
          prData = await editPrDetails(prData);
        }

        // Common submission logic for both edited and non-edited PRs
        const submitChoice = await confirmSubmitPr();
        if (submitChoice) {
            console.log('\n🚀 Submitting Pull Request...');
            
            try {
                const result = await createPullRequest({
                    pat,
                    orgUrl: prData.organizationUrl,
                    project: prData.project,
                    repositoryId: prData.repositoryId,
                    sourceBranch: prData.sourceBranch,
                    targetBranch: prData.targetBranch,
                    title: prData.title,
                    description: prData.body  
                });
                
                console.log('✅ Pull Request created successfully!');
                console.log(result);
            } catch (error) {
                console.error('❌ Failed to create Pull Request:', error);
            }
            } else {
            console.log('\n❌ PR submission cancelled.');
        }


    } catch (err) {
      console.error('❌ Failed to run agent:', err);
      process.exit(1);
    }
  });

// Process command line arguments
program.parse(process.argv);