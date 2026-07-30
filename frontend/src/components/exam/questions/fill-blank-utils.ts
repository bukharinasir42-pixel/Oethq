export const FILL_BLANK_TOKEN = "[blank]";

const BLANK_TOKEN_PATTERN = /\[blank\]|_{3,}/i;

export function hasFillBlankPlaceholder(content: string) {
  return BLANK_TOKEN_PATTERN.test(content);
}

export function splitFillBlankContent(content: string) {
  const match = content.match(BLANK_TOKEN_PATTERN);

  if (!match || match.index === undefined) {
    return {
      before: content.trim(),
      after: "",
      hasPlaceholder: false
    };
  }

  return {
    before: content.slice(0, match.index),
    after: content.slice(match.index + match[0].length),
    hasPlaceholder: true
  };
}

export const FILL_BLANK_PROMPT_HINT =
  "Place the cursor in the sentence, then click Add answer space to insert the blank.";
