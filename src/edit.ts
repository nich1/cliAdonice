import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { spawn } from 'child_process';

interface PrData {
  title: string;
  body: string;
  sourceBranch: string;
  targetBranch: string;
  organizationUrl: string;
  project: string;
  repositoryId: string;
}

export async function editPrDetails(prData: PrData): Promise<PrData> {
  // Create temp file with timestamp to avoid conflicts
  const tempFile = join(tmpdir(), `pr-edit-${Date.now()}.json`);
  
  try {
    // Write formatted JSON to temp file
    const jsonContent = JSON.stringify(prData, null, 2);
    writeFileSync(tempFile, jsonContent, 'utf8');
    
    console.log(`\n📝 Opening ${tempFile} in your default editor...`);
    console.log('💡 Save and close the file when you\'re done editing.\n');
    
    // Determine editor based on platform and environment
    const editor = getDefaultEditor();
    
    // Open editor and wait for it to close
    await openEditor(editor, tempFile);
    
    // Read the edited content
    const editedContent = readFileSync(tempFile, 'utf8');
    
    // Parse and validate JSON
    let editedData: PrData;
    try {
      editedData = JSON.parse(editedContent);
    } catch (parseError) {
      console.error('❌ Invalid JSON format. Using original data.');
      return prData;
    }
    
    // Validate required fields
    if (!isValidPrData(editedData)) {
      console.error('❌ Missing required fields. Using original data.');
      return prData;
    }
    
    console.log('✅ PR details updated successfully!\n');
    return editedData;
    
  } catch (error) {
    console.error('❌ Error during editing:', error);
    return prData;
  } finally {
    // Clean up temp file
    try {
      unlinkSync(tempFile);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
  }
}

function getDefaultEditor(): string {
  // Check environment variable first
  if (process.env.EDITOR) {
    return process.env.EDITOR;
  }
  
  // Platform-specific defaults
  switch (process.platform) {
    case 'win32':
      return 'notepad';
    case 'darwin':
      return 'open -W -n'; // -W waits for app to close, -n opens new instance
    default:
      return 'nano'; // Linux/Unix default
  }
}

function openEditor(editor: string, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let command: string;
    let args: string[];
    
    if (process.platform === 'darwin' && editor === 'open -W -n') {
      command = 'open';
      args = ['-W', '-n', '-e', filePath]; // -e opens with TextEdit
    } else {
      const editorParts = editor.split(' ');
      command = editorParts[0];
      args = [...editorParts.slice(1), filePath];
    }
    
    const child = spawn(command, args, { 
      stdio: 'inherit',
      shell: process.platform === 'win32' 
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Editor exited with code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

function isValidPrData(data: any): data is PrData {
  return (
    typeof data === 'object' &&
    typeof data.title === 'string' &&
    typeof data.body === 'string' &&
    typeof data.sourceBranch === 'string' &&
    typeof data.targetBranch === 'string' &&
    typeof data.organizationUrl === 'string' &&
    typeof data.project === 'string' &&
    typeof data.repositoryId === 'string'
  );
}
