import { input, password, confirm, select, checkbox } from '@inquirer/prompts';
import { AbortPromptError } from '@inquirer/core';
import type { Key } from 'node:readline';

export { AbortPromptError } from '@inquirer/core';

export function isEscBack(err: unknown): boolean {
  return err instanceof AbortPromptError;
}

type KeypressHandler = (str: string, key: Key) => void;

function createEscHandler(): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();

  const onKeypress: KeypressHandler = (_str: string, key: Key) => {
    if (key && key.name === 'escape') {
      controller.abort();
    }
  };

  if (process.stdin.isTTY) {
    process.stdin.on('keypress', onKeypress);
  }

  const cleanup = () => {
    if (process.stdin.isTTY) {
      process.stdin.removeListener('keypress', onKeypress);
    }
  };

  return { signal: controller.signal, cleanup };
}

export async function promptInput(message: string, defaultValue?: string, validate?: (input: string) => string | true): Promise<string> {
  const { signal, cleanup } = createEscHandler();
  try {
    return await input({
      message,
      default: defaultValue,
      validate,
    }, { signal });
  } finally {
    cleanup();
  }
}

export async function promptPassword(message: string): Promise<string> {
  const { signal, cleanup } = createEscHandler();
  try {
    return await password({
      message,
      mask: '*',
    }, { signal });
  } finally {
    cleanup();
  }
}

export async function promptConfirm(message: string, defaultValue = true): Promise<boolean> {
  const { signal, cleanup } = createEscHandler();
  try {
    return await confirm({
      message,
      default: defaultValue,
    }, { signal });
  } finally {
    cleanup();
  }
}

export async function promptSelect<T extends string>(
  message: string,
  choices: { name: string; value: T; description?: string }[],
): Promise<T> {
  const { signal, cleanup } = createEscHandler();
  try {
    return await select({
      message,
      choices,
    }, { signal });
  } finally {
    cleanup();
  }
}

export async function promptCheckbox<T extends string>(
  message: string,
  choices: { name: string; value: T; checked?: boolean }[],
): Promise<T[]> {
  const { signal, cleanup } = createEscHandler();
  try {
    return await checkbox({
      message,
      choices,
    }, { signal });
  } finally {
    cleanup();
  }
}
