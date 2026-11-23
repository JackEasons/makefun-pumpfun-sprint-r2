# Tide — Pump.fun Replay Sprint

[![Winner Takes All — $5 Pump.fun Replay Sprint](https://make.fun/badge/u-tidy-owl-94-9499-winner-takes-all-5-pump-fun-b82c82d3.svg)](https://make.fun/bounty/u-tidy-owl-94-9499-winner-takes-all-5-pump-fun-b82c82d3)
[![Rank](https://make.fun/badge/u-tidy-owl-94-9499-winner-takes-all-5-pump-fun-b82c82d3/JackEasons/makefun-pumpfun-sprint-r2/rank.svg)](https://make.fun/bounty/u-tidy-owl-94-9499-winner-takes-all-5-pump-fun-b82c82d3)
[![Reward](https://make.fun/badge/u-tidy-owl-94-9499-winner-takes-all-5-pump-fun-b82c82d3/JackEasons/makefun-pumpfun-sprint-r2/reward.svg)](https://make.fun/bounty/u-tidy-owl-94-9499-winner-takes-all-5-pump-fun-b82c82d3)

Tide is my entry for the [Winner Takes All — $5 Pump.fun Replay Sprint](https://make.fun/bounty/u-tidy-owl-94-9499-winner-takes-all-5-pump-fun-b82c82d3) on [make.fun](https://make.fun). It trades 10 SOL of paper money on a six-hour replay of pump.fun bonding-curve activity, and the best net PnL takes the whole pot.

## How it trades

The dev window is a slow bleed — most launches fade within a hundred slots — so Tide never holds a runner. It is a two-tier fast launch sniper: it buys a launch only while its opening tape is still young, then exits within fifteen slots on a stop, a creator sale, or time, whichever comes first.

- **Strict tier (0.3 SOL):** three to five distinct non-creator buyers, creator buy at most 0.5 SOL, real liquidity between 1 and 3 SOL, no creator sale, no outsized single sale, sales under half of buys, net flow not negative. Launches already hotter than 3 SOL of real liquidity fall through to the guardrail tier instead of being chased at size.
- **Guardrail tier (0.01 SOL):** one to five buyers and creator buy under 2 SOL, at the minimum round-trip size, so the run still clears the twenty-coin guardrail on a short final window.
- **Exits:** −12% stop loss, +10% take-profit, creator sells while held, or fifteen slots held. A coin is never bought twice.

On the dev window it grades −0.155 SOL with 300 round trips, a 16% win rate and 1.7% maximum drawdown — a smaller loss and drawdown than the earlier version of the same design, with a wide guardrail margin.

## Run it

```sh
node main.ts
```

No dependencies, no build step: Node 22 runs the TypeScript as it is. The bot reads batches on stdin and writes one reply of orders per batch on stdout; the vendored shim in `vendor/` owns that wire.

## Files

- `main.ts` — entrypoint: builds the strategy and hands it to the harness shim.
- `strategy.ts` — the Tide strategy: tape tracking, the two entry tiers, and the exits.
- `vendor/makefun-bot.ts` — the kit's bot shim (vendored, unchanged).

## Referral

Trying make.fun yourself? Sign up through my referral link: https://make.fun/r/gbg9q3ye
