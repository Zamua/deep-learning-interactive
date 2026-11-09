// Questions that take two tool calls, the second built on the first call's result.
export interface Task {
  q: string;
  calls: [string, string];
  res: [string, string];
  answer: string;
}

export const TASKS: Task[] = [
  { q: 'What is the weather in the capital of Peru?', calls: ['search("capital of Peru")', 'weather("Lima")'], res: ['Lima', '19°C, cloudy'], answer: 'It is 19°C and cloudy in Lima.' },
  { q: 'What time is it in the capital of Japan?', calls: ['search("capital of Japan")', 'clock("Tokyo")'], res: ['Tokyo', '14:05'], answer: 'It is 14:05 in Tokyo.' },
  { q: 'How tall is Mount Everest, in feet?', calls: ['search("Everest height")', 'convert(8849, "m", "ft")'], res: ['8,849 m', '29,032'], answer: 'About 29,032 feet.' },
  { q: 'What is cheese in the language of Brazil?', calls: ['search("language of Brazil")', 'translate("cheese", "pt")'], res: ['Portuguese', 'queijo'], answer: 'In Portuguese, cheese is queijo.' },
  { q: 'Is it warmer in Paris or in Rome?', calls: ['weather("Paris")', 'weather("Rome")'], res: ['18°C, sunny', '22°C, cloudy'], answer: 'Rome, at 22°C against 18°C.' },
  { q: 'What is the weather in the capital of Australia?', calls: ['search("capital of Australia")', 'weather("Canberra")'], res: ['Canberra', '12°C, windy'], answer: 'It is 12°C and windy in Canberra.' },
  { q: 'What is 23 times 17, plus 9?', calls: ['calc("23 * 17")', 'calc("391 + 9")'], res: ['391', '400'], answer: 'It is 400.' },
  { q: 'What weekday is 1 January 2030, and is it a holiday in France?', calls: ['calendar("2030-01-01")', 'holidays("FR", "2030-01-01")'], res: ['Tuesday', 'New Year\'s Day'], answer: 'A Tuesday, and a holiday: New Year\'s Day.' },
];
