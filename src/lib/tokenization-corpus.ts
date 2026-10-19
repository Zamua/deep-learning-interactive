/** The chapter's training text: short, repetitive, original, with a few numbers in it. */
export const CORPUS = `The keeper of the old lighthouse kept a log, and every night he wrote the same few things in it: the time the lamp was lit, the wind, the weather, and the ships that passed. On the first night of 1901 he wrote: lamp lit at 4:52, wind from the north, cold and clear, three ships passed. On the second night he wrote: lamp lit at 4:53, wind from the north, cold and clear, two ships passed. The nights were long in the winter and short in the summer, and the lamp was lit a little earlier or a little later as the year turned.

He liked the log because it was the same every night. The sea was never the same. Some nights the water was flat and the light lay on it like a road; other nights the waves were higher than the rocks and the wind took the sound of the bell away. The keeper wrote it all down in the same small hand: the wind, the water, the weather, the ships.

In 1911 his daughter took over the light, and she kept the log the way her father had. Lamp lit at 4:51, wind from the west, rain, four ships passed. She added one thing he had never written: the names of the ships, when she could read them. The Northern Star. The Mary Ellen. The Western Light. By 1921 the log filled eleven books, and the keepers had written the word wind more than ten thousand times.

Today the lighthouse runs by itself. A machine lights the lamp at the right time each night, and nobody writes anything down. The eleven books sit on a shelf in the town library, and anyone can read them: thousands of nights, each one a few lines long, each one almost the same as the night before.`;

/** New text in the same style, never seen in training: how well do the merges generalize? */
export const HELDOUT = `The new keeper lit the lamp at 4:50 and wrote it in the log: wind from the south, warm, rain in the night, two ships passed. She read the old books by the light of the lamp and liked the way every night looked the same on the page, even when the sea was wild and the wind was loud.`;

/** A tiny corpus for stepping through BPE by hand. */
export const TINY = 'the hat, the cat, that hat, the bat';
