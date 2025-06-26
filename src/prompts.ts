import inquirer from 'inquirer';

export async function confirmEditPrompt(): Promise<boolean> {
  const questions = [
    {
      type: 'list' as const,
      name: 'edit',
      message: '🛠 Edit PR details before submitting?',
      choices: [
        { name: 'Yes', value: true },
        { name: 'No', value: false }
      ],
      default: 1, // default to 'No'
    }
  ];

  const answers = await inquirer.prompt(questions);
  return answers.edit;
}

export async function confirmSubmitPr(): Promise<boolean> {
  const questions = [
    {
      type: 'list' as const,
      name: 'submit',
      message: '🚀 Submit Pull Request?',
      choices: [
        { name: 'Yes', value: true },
        { name: 'No', value: false }
      ],
      default: 1, // default to 'No'
    }
  ];

  const answers = await inquirer.prompt(questions);
  return answers.submit;
}