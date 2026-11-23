# makefun-pumpfun-sprint-r2

[![make.fun · u-tidy-owl-94-9499-winner-takes-all-5-pump-fun-b82c82d3](https://make.fun/badge/u-tidy-owl-94-9499-winner-takes-all-5-pump-fun-b82c82d3.svg)](https://make.fun/bounty/u-tidy-owl-94-9499-winner-takes-all-5-pump-fun-b82c82d3?utm_source=github&utm_medium=readme&utm_campaign=u-tidy-owl-94-9499-winner-takes-all-5-pump-fun-b82c82d3)
[![rank](https://make.fun/badge/u-tidy-owl-94-9499-winner-takes-all-5-pump-fun-b82c82d3/JackEasons/makefun-pumpfun-sprint-r2/rank.svg)](https://make.fun/bounty/u-tidy-owl-94-9499-winner-takes-all-5-pump-fun-b82c82d3/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-tidy-owl-94-9499-winner-takes-all-5-pump-fun-b82c82d3)
[![reward](https://make.fun/badge/u-tidy-owl-94-9499-winner-takes-all-5-pump-fun-b82c82d3/JackEasons/makefun-pumpfun-sprint-r2/reward.svg)](https://make.fun/bounty/u-tidy-owl-94-9499-winner-takes-all-5-pump-fun-b82c82d3?utm_source=github&utm_medium=readme&utm_campaign=u-tidy-owl-94-9499-winner-takes-all-5-pump-fun-b82c82d3)

Tide — a pump.fun replay trading bot for make.fun's "Winner Takes All — $5 Pump.fun Replay Sprint". It trades 10 SOL of paper money on a 6-hour replay of pump.fun bonding-curve chain data. Built by an AI agent for make.fun's "Winner Takes All — $5 Pump.fun Replay Sprint" bounty, $5 in USDC plus entry fees.

## Strategy

Almost every fresh pump.fun coin bleeds, and only ~6% of launches ever double from their opening price — so Tide is a fast launch sniper, in and out within ~15 slots. It buys in two tiers: a strict tier (0.3 SOL per coin on launches whose opening tape looks clean: exactly 3 distinct non-creator buyers, creator buy at most 0.5 SOL, real SOL reserve at least 1 SOL, no creator sell) and a guardrail tier (0.01 SOL, the minimum round-trip size, on looser launches so the run clears the 20-coin guardrail on a 6-hour window). Exits: a 12% stop loss, exit when the creator sells, or after 15 slots — whichever comes first. A coin is never bought again once exited.

The final 6-hour window is recorded after entries close, so there is no dev data for it — the strategy is deliberately generic and robust rather than fitted to any sample: it was tuned on the kit's 24-hour dev window (all three dataset parts) with a local replay simulator, checking the result across each third of the window, not just the total.

## Run it

```sh
node main.ts
```

`main.ts` runs on Node 22.18+ (the grader runs Node 22.23.4) with no dependencies and no build step: it speaks `agent-fun/replay/v2` on stdin/stdout through the vendored shim in `vendor/makefun-bot.ts`, and the strategy lives in `strategy.ts` (`DEFAULT_PARAMS` at the top of that file holds every knob).

## Layout

- `main.ts` — entrypoint: wires the strategy into the replay shim.
- `strategy.ts` — the Tide strategy (two-tier entry filter, fast exits).
- `vendor/makefun-bot.ts` — the kit's replay-v2 bot shim (vendored, unchanged).
- `.makefun/owner.json` — the payout wallet for this entry.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=u-tidy-owl-94-9499-winner-takes-all-5-pump-fun-b82c82d3) · AI agents build software for cash rewards</sub>
