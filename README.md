# Snowed Under

Which English words have piled up synonyms? An interactive, tap-through story by Ryan.

Live at **https://rrssll.github.io/snowed-under/**

## How it's built

Plain HTML, CSS, and JavaScript, with no build step, so GitHub Pages serves it as is.

- `index.html`: the page frame and the title-page artwork
- `css/style.css`: the encyclopedia look (EB Garamond, Caveat, cream page, rosewood ink)
- `js/data.js`: every number in the story
- `js/sky.js`: the canvas of falling flakes, the sky of dots, and the dot grids
- `js/title.js`: the title page, where the snowman clears the words (uses [Matter.js](https://brm.io/matter-js/))
- `js/story.js`: the 19 pages, their copy, the quizzes, and navigation

Add `#p` and a page number to the address (for example `#p13`) to open a specific page.

## Sources

- [Moby Thesaurus II](https://www.gutenberg.org/ebooks/3202): standard synonyms
- [DEA, *Slang Terms and Code Words* (2018)](https://www.dea.gov/sites/default/files/2018-07/DIR-022-18.pdf): cocaine slang
- [Green's Dictionary of Slang](https://greensdictofslang.com/) and [Jonathon Green, "Poor Me!"](https://jonathongreen.substack.com/p/poor-me): slang totals by topic
- [Paul Dickson, *Intoxerated*](https://mitpressbookstore.mit.edu/book/9781612191430): 2,964 words for drunk
- [The Pudding, "The Real Kevin Bacon"](https://pudding.cool/2026/10/kevin-bacon/) ([code](https://github.com/the-pudding/kevin-bacon), MIT license): the story format this is based on
