import title from "title";

export function formatTitle(sentence: string): string {
  if (navigator.language?.toLowerCase() !== "en-us") {
    return sentence;
  }

  const words = sentence.split(/\s+/);
  const titledWords = title(sentence).split(/\s+/);

  return titledWords
    .map((word, i) => {
      const original = words[i];

      if (/[A-Z]/.test(original)) {
        return original;
      }

      return word;
    })
    .join("");
}
