// Questions a model answers with one tool call: the call it writes, what the tool returns, and its reply.
export interface Tool {
  q: string;
  call: string;
  res: string;
  reply: string;
}

export const TOOLS: Tool[] = [
  { q: 'What is the weather in Paris?', call: 'weather("Paris")', res: '18°C, sunny', reply: 'It is 18°C and sunny in Paris.' },
  { q: 'What is 23 times 17?', call: 'calc("23 * 17")', res: '391', reply: '23 times 17 is 391.' },
  { q: 'What time is it in Tokyo?', call: 'clock("Tokyo")', res: '14:05', reply: 'It is 14:05 in Tokyo.' },
  { q: 'How tall is Mount Everest?', call: 'search("Everest height")', res: '8,849 m', reply: 'Everest is 8,849 m tall.' },
  { q: 'How many kilometers is 5 miles?', call: 'convert(5, "mi", "km")', res: '8.05', reply: '5 miles is about 8.05 km.' },
  { q: 'What is cheese in French?', call: 'translate("cheese", "fr")', res: 'fromage', reply: 'Cheese in French is fromage.' },
  { q: 'What is 2,025 divided by 45?', call: 'calc("2025 / 45")', res: '45', reply: '2,025 divided by 45 is 45.' },
  { q: 'What weekday is 1 January 2030?', call: 'calendar("2030-01-01")', res: 'Tuesday', reply: '1 January 2030 is a Tuesday.' },
  { q: 'How many people live in Peru?', call: 'search("Peru population")', res: '34 million', reply: 'About 34 million people live in Peru.' },
  { q: 'What is the weather in Rome?', call: 'weather("Rome")', res: '22°C, cloudy', reply: 'It is 22°C and cloudy in Rome.' },
];
