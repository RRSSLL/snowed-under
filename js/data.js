// Data for "Snowed Under". Sources: the project's "Synonyms by Meaning" docs
// (Moby Thesaurus II for standard counts; DEA 2018 for cocaine slang; Green's Dictionary
// of Slang and Paul Dickson for slang totals by topic).
window.SNOW_DATA = {
  // Snow's 29 standard synonyms, in its 4 senses (colors match the approved design).
  senses: [
    { n: 1, pos: 'v.', gloss: 'To deceive or charm with glib talk (a <i>snow job</i>).', color: '#436C66',
      words: ['bamboozle', 'beguile', 'bluff', 'cajole', 'deceive', 'delude', 'diddle', 'dupe', 'gammon', 'gull', 'hoax', 'hornswaggle', 'humbug', 'pigeon', 'put something over', 'string along', 'take in', 'trick'] },
    { n: 2, pos: 'n.', gloss: 'A fall or cover of snow.', color: '#8B9576',
      words: ['snowfall', 'snowstorm', 'snow blanket', 'mantle of snow'] },
    { n: 3, pos: 'v.', gloss: 'To come down thickly, like snow.', color: '#DCC9A9',
      words: ['shower', 'rain', 'pour', 'avalanche'] },
    { n: 4, pos: 'n.', gloss: 'Speckled interference on a TV screen.', color: '#63291B',
      words: ['noise', 'picture noise', 'static'] }
  ],
  snow: { synonyms: 29, meanings: 4, cocaineSlang: 96, withSlang: 125 },

  // The 25 English words with the most standard (non-slang) synonyms. s = synonyms, m = meanings.
  top: [
    { w: 'cut', s: 1262, m: 19 }, { w: 'set', s: 1131, m: 19 }, { w: 'turn', s: 1069, m: 21 },
    { w: 'run', s: 964, m: 19 }, { w: 'break', s: 885, m: 22 }, { w: 'line', s: 864, m: 21 },
    { w: 'light', s: 805, m: 19 }, { w: 'pass', s: 798, m: 21 }, { w: 'clear', s: 777, m: 18 },
    { w: 'get', s: 772, m: 19 }, { w: 'right', s: 763, m: 21 }, { w: 'head', s: 746, m: 23 },
    { w: 'hold', s: 742, m: 19 }, { w: 'close', s: 721, m: 19 }, { w: 'cast', s: 704, m: 19 },
    { w: 'make', s: 699, m: 17 }, { w: 'mean', s: 680, m: 16 }, { w: 'upset', s: 675, m: 15 },
    { w: 'take', s: 670, m: 21 }, { w: 'measure', s: 668, m: 14 }, { w: 'charge', s: 665, m: 15 },
    { w: 'good', s: 665, m: 20 }, { w: 'open', s: 662, m: 29 }, { w: 'point', s: 653, m: 19 },
    { w: 'mark', s: 646, m: 21 }
  ],

  // The top 25 once slang is allowed. sl = a slang-topic word new to the list.
  slangTop: [
    { w: 'money', s: 3342, sl: true }, { w: 'woman', s: 2968, sl: true }, { w: 'drunk', s: 2964, sl: true },
    { w: 'fool', s: 2403, sl: true }, { w: 'man', s: 2183, sl: true }, { w: 'sex', s: 1903, sl: true },
    { w: 'penis', s: 1775, sl: true }, { w: 'homosexual', s: 1512, sl: true }, { w: 'cut', s: 1262 },
    { w: 'vagina', s: 1203, sl: true }, { w: 'prostitute', s: 1185, sl: true }, { w: 'set', s: 1131 },
    { w: 'turn', s: 1069 }, { w: 'policeman', s: 1034, sl: true }, { w: 'run', s: 964 },
    { w: 'masturbate', s: 945, sl: true }, { w: 'break', s: 885 }, { w: 'line', s: 864 },
    { w: 'die', s: 831, sl: true }, { w: 'light', s: 805 }, { w: 'pass', s: 798 },
    { w: 'clear', s: 777 }, { w: 'mad', s: 776, sl: true }, { w: 'buttocks', s: 775, sl: true },
    { w: 'get', s: 772 }
  ],

  // Page 8's comparison word: man, from Moby's standard entry (306 synonyms). It isn't in the
  // top 25, so it doesn't spoil Chapter II. Its 9 meanings, most synonyms first; the last group
  // (14) is "other / hard to place".
  compare: { w: 'man', meanings: 9, synonyms: 306, groups: [64, 42, 41, 38, 37, 26, 25, 10, 9], other: 14 },

  // Mild synonyms of buttocks for the afterword (from the slang doc's examples).
  buttocks: ['bottom', 'behind', 'backside', 'rear end', 'derriere', 'posterior', 'rump', 'tail end', 'hindquarters', 'haunches', 'hind end', 'seat', 'bum', 'booty', 'buns', 'caboose', 'keister', 'can', 'duff', 'trunk', 'junk in the trunk', 'badonkadonk', 'jacksie', 'bahookie', 'tush', 'tushie', 'tuchis', 'heinie', 'sit-upon', 'gluteus maximus'],

  // Slang pairs for the Chapter III quiz (all from the data docs).
  pairs: [
    { slang: 'spondulicks', word: 'money' },
    { slang: 'three sheets to the wind', word: 'drunk' },
    { slang: 'numpty', word: 'fool' },
    { slang: 'sheila', word: 'woman' },
    { slang: 'bloke', word: 'man' },
    { slang: "devil's dandruff", word: 'cocaine' }
  ]
};
