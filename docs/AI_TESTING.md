# AI testing

Two ways for an AI (or a person who isn't the designer) to test Shattered Reef without the designer's own bias.

## 1. Play it in text mode

`scripts/agent-play.ts` runs the real game (the same `Game` class the browser uses) with no graphics. You type
commands; it answers in plain text. Nothing is faked: walking, fighting, gathering, quests and saving all go through
the game's own code.

You need Node 22 and a copy of the repository:

```
npm ci
npx vite-node scripts/agent-play.ts -- --save run.json
```

Type `help` for the commands. The main loop is: `look` (numbered list of what's nearby, your health and quest),
`do N` (walk to thing N and use it: talk, chop, mine, fish, attack, cook...), `wait S`, `pack`, `skills`, `quests`.

With `--save run.json` the game is kept between runs, so you can also send one command at a time:

```
echo "look" | npx vite-node scripts/agent-play.ts -- --save run.json
echo "do 3" | npx vite-node scripts/agent-play.ts -- --save run.json
```

Not in text mode yet: the bounty board, the timing-bar bonus (it's optional in the game too), steering the ship by
hand (use `board`, then `do N` on sea targets, then `land`).

### Test brief (copy this to the AI)

> You are testing a new game as a first-time player. Play Shattered Reef in text mode for at least 150 commands.
> Start a new save. Follow the quest you're given, and also explore, fight and train as you see fit.
> Then report:
> 1. What you did, in order, in about ten lines.
> 2. Anything confusing: instructions you couldn't follow, places you couldn't find, things that didn't do what
>    the text said.
> 3. Anything that felt slow, grindy or pointless, and roughly how many commands or game minutes it took.
> 4. Anything that felt unfair: deaths, damage spikes, enemies too strong for where they are.
> 5. Bugs: errors, stuck states, things that should have happened and didn't. Quote the output.
> 6. Your levels, quests and coins at the end (`skills`, `quests`, `status`).
> Be specific and blunt. Don't praise; the designer wants problems.

Note: an AI plays like an efficient min-maxer and can't tell you whether something is fun. Use it for clarity,
pacing, bugs and difficulty spikes, and compare its notes with the numbers in the reports below.

## 2. Read the automatic playtest reports

`reports/playtest/` is written by a GitHub Action (`.github/workflows/playtest.yml`) after every change to the game
on `main`, and every Monday. A scripted new player (`scripts/playtest.ts`) plays an hour of game time on three
different seeds; the skill probe (`scripts/probe-skills.ts`) measures XP per hour at every gathering spot.

Each `seed-N.txt` shows: levels reached, quests and stages, deaths, kills, food eaten, coins, gear; where the bot got
blocked (needed an item it couldn't get); a quest timeline; when each level came; the most common messages; and the
last 80 lines of its log.

What to look for: quests stuck on the same stage, long gaps in the level timeline, repeated "blocked" lines, deaths,
the same warning message many times, and big differences between seeds.
