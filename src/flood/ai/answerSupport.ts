/** Checks support references, not semantic truth. Drafts still need human review. */
export function checkAnswerSupport(text: string, outputs: string[]): void {
  text = text.replace(/[\u2010-\u2015]/g, '-');
  const records = outputs.map(output => JSON.parse(output));
  const allowed = new Set(records.flatMap(record => (record.citations ?? []).map((c: {id: string}) => c.id)));
  const cited = [...text.matchAll(/\[([^\[\]]+)\]/g)].map(match => match[1]);
  if (!records.length || !cited.length || cited.some(id => !allowed.has(id))) throw new Error('Answer lacks retrieved evidence or cites an unknown source.');
  // Normalize numeric formatting/date separators, but do not invent conversions.
  const numbers = (s: string) => (s.replace(/[\u2010-\u2015]/g, '-').replace(/(?<=\d),(?=\d{3}\b)/g, '').replace(/(?<=\d)-(?=\d)/g, ' ').match(/-?\d+(?:\.\d+)?/g) ?? []).map(n => String(Number(n)));
  const supported = new Set(numbers(outputs.join(' ')));
  if (numbers(text.replace(/\[[^\]]*\]/g, '')).some(number => !supported.has(number))) throw new Error('Answer contains a number absent from retrieved evidence.');
}
