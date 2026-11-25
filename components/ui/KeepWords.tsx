import { Fragment } from 'react';

// Browsers break Thai with a dictionary, which splits compounds such as ตำแหน่ง|สมาชิก or แบบ|ทดสอบ, and
// leaves a word like "พอ" alone on the last line. Thai puts a space between phrases, so short copy here
// breaks only at its spaces, the way a person would break it by hand.

/** Longer than this, a phrase may still break inside, so it can never push past a narrow screen. */
const LONGEST_KEPT = 24;

/** Text that wraps only at its own spaces. */
export function KeepWords({ text }: { text: string }) {
  return (
    <>
      {text.split(' ').map((phrase, index) => (
        <Fragment key={index}>
          {index > 0 && ' '}
          {phrase.length <= LONGEST_KEPT ? (
            <span className="whitespace-nowrap">{phrase}</span>
          ) : (
            phrase
          )}
        </Fragment>
      ))}
    </>
  );
}

const TOKEN = /^\{\{(\w+)\}\}$/;

/** A copy template from th.ts with its values filled in, every phrase kept whole. */
export function Filled({ template, values }: { template: string; values: Record<string, string> }) {
  return (
    <>
      {template.split(/(\{\{\w+\}\})/).map((part, index) => {
        const name = TOKEN.exec(part)?.[1];
        const text = name === undefined ? part : (values[name] ?? part);
        return <KeepWords key={index} text={text} />;
      })}
    </>
  );
}
