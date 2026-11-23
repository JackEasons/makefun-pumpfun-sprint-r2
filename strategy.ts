// Tide — a two-tier fast launch sniper for the pump.fun replay sprint.
//
// The dev window is a slow bleed: the median launch falls roughly 17% within a hundred
// slots of a hot opening, and only about 6% of launches ever double. So this bot never
// sits on a runner hoping it comes back. It buys a launch only while its opening tape is
// still young, and it is out again within fifteen slots — on a stop, a take-profit, a
// creator sale, or time, whichever comes first.
//
// Two ways in, both sized by the tape rather than by hope:
//   Strict — a clean, busy opening: three to five separate buyers who are not the
//     creator, the creator's own buy small, real liquidity between 1 and 3 SOL behind
//     the curve, no creator sale, no outsized single sale, sales under half of buys,
//     flow not negative. The 3 SOL ceiling matters: past it the launch is already hot
//     and the 1%-of-reserve cap would size the buy far past the intended stake, so
//     those launches fall through to the guardrail tier instead. Sized at 0.3 SOL;
//     the harness's 1% cap trims that on most curves that qualify.
//   Guardrail — a looser opening (one to five buyers, creator buy under 2 SOL) at the
//     0.01 SOL minimum, so the run still clears the twenty-coin guardrail on a short
//     final window, where the strict tier alone would only reach about a dozen coins.
// A coin is bought at most once per run, whatever happens to it afterwards.
// Exits bank a hot opening's spike (+10%) rather than waiting out the fifteen slots
// for the bleed that usually follows.
//
// Deterministic by construction: no clock, no randomness, no environment reads. The only
// inputs are the batches the harness delivers.

import type { Batch, BotState, OrderInput } from './vendor/makefun-bot.ts';

/** Every knob the strategy turns, in lamports and slots unless the name says otherwise. */
export interface Params {
  /** SOL spent on a strict-tier buy. */
  strictStake: number;
  /** SOL spent on a guardrail-tier buy (the minimum round-trip size). */
  guardStake: number;
  /** Distinct non-creator buyers a strict opening needs. */
  strictMinBuyers: number;
  /** Most distinct non-creator buyers a strict opening tolerates. A launch
   * whose opening is already crowded has usually already had its move. */
  strictMaxBuyers: number;
  /** Largest total creator buy a strict opening tolerates. */
  strictMaxCreatorBuy: number;
  /** Least real SOL a curve must hold before either tier buys it. */
  minRealSol: number;
  /** Most real SOL a strict opening tolerates. Past it the launch is already
   * hot and the 1% cap would size the buy far past the intended stake. */
  strictMaxRealSol: number;
  /** Sales as a share of buys (bps) a strict opening tolerates. */
  strictMaxSellShareBps: number;
  /** A single sale bigger than this spoils a strict opening. */
  maxSingleSell: number;
  /** Fewest distinct non-creator buyers a guardrail opening needs. */
  guardMinBuyers: number;
  /** Most distinct non-creator buyers a guardrail opening tolerates. */
  guardMaxBuyers: number;
  /** Largest total creator buy a guardrail opening tolerates. */
  guardMaxCreatorBuy: number;
  /** A launch older than this (slots since its creation) is never bought. */
  maxAgeSlots: number;
  /** A position is sold once it has been held this many slots. */
  maxHoldSlots: number;
  /** A position is sold once its mark value falls this far below its cost (bps). */
  stopLossBps: number;
  /** A position is sold once its mark value rises this far above its cost (bps).
   * 0 disables it. Hot launches spike and then bleed, so banking the spike beats
   * waiting out the fifteen slots. */
  takeProfitBps: number;
  /** Slippage allowance on every order. */
  slippageBps: number;
  /** Slippage allowance on sell orders. Exits must execute even while the price is
   * falling away from the decision-time quote, so sells get a wide allowance; a
   * tight allowance would leave a stopped position bleeding through repeated
   * rejections. Buys keep the tight allowance above. */
  sellSlippageBps: number;
}

export const DEFAULT_PARAMS: Params = {
  strictStake: 300_000_000,
  guardStake: 10_000_000,
  strictMinBuyers: 3,
  strictMaxBuyers: 5,
  strictMaxCreatorBuy: 500_000_000,
  minRealSol: 1_000_000_000,
  strictMaxRealSol: 3_000_000_000,
  strictMaxSellShareBps: 5000,
  maxSingleSell: 500_000_000,
  guardMinBuyers: 1,
  guardMaxBuyers: 5,
  guardMaxCreatorBuy: 2_000_000_000,
  maxAgeSlots: 10,
  maxHoldSlots: 15,
  stopLossBps: 1200,
  takeProfitBps: 1000,
  slippageBps: 500,
  sellSlippageBps: 10000,
};

/** Everything the opening tape of one mint has shown so far. */
interface Tape {
  /** The wallet that created the curve. */
  creator: string;
  /** Slot of the CreateEvent, or -1 when the mint was first seen through a trade. */
  born: number;
  /** Distinct wallets (other than the creator) that have bought. */
  buyers: Set<string>;
  /** SOL the creator has spent buying, in lamports. */
  creatorBuy: bigint;
  /** SOL all buys have spent, in lamports. */
  buyVol: bigint;
  /** SOL all sells have taken out, in lamports. */
  sellVol: bigint;
  /** Whether the creator has sold anything. */
  creatorSold: boolean;
  /** Largest single sale, in lamports. */
  biggestSell: bigint;
  /** Whether the curve has completed. */
  complete: boolean;
}

/** A position this strategy opened, keyed by what its buy fill reported. */
interface Opened {
  /** Slot of the batch the buy was decided on. */
  decidedSlot: number;
}

const BPS = 10_000n;

function freshTape(creator: string, born: number): Tape {
  return {
    creator,
    born,
    buyers: new Set<string>(),
    creatorBuy: 0n,
    buyVol: 0n,
    sellVol: 0n,
    creatorSold: false,
    biggestSell: 0n,
    complete: false,
  };
}

/** Fold one trade into its mint's tape. Amounts arrive as u64 decimal strings. */
function noteTrade(tape: Tape, ev: {
  is_buy: boolean;
  user: string;
  sol_amount: string;
}): void {
  const sol = BigInt(ev.sol_amount);
  if (ev.is_buy) {
    tape.buyVol += sol;
    if (ev.user === tape.creator) {
      tape.creatorBuy += sol;
    } else {
      tape.buyers.add(ev.user);
    }
  } else {
    tape.sellVol += sol;
    if (ev.user === tape.creator) tape.creatorSold = true;
    if (sol > tape.biggestSell) tape.biggestSell = sol;
  }
}

/** The strict tier: a busy, clean opening with real liquidity behind it. */
function passesStrict(tape: Tape, realSol: bigint, p: Params): boolean {
  if (tape.complete) return false;
  if (tape.buyers.size < p.strictMinBuyers) return false;
  if (tape.buyers.size > p.strictMaxBuyers) return false;
  if (tape.creatorBuy > BigInt(p.strictMaxCreatorBuy)) return false;
  if (realSol < BigInt(p.minRealSol)) return false;
  if (realSol > BigInt(p.strictMaxRealSol)) return false;
  if (tape.creatorSold) return false;
  if (tape.biggestSell > BigInt(p.maxSingleSell)) return false;
  if (tape.sellVol * BPS > tape.buyVol * BigInt(p.strictMaxSellShareBps)) return false;
  if (tape.sellVol > tape.buyVol) return false;
  return true;
}

/** The guardrail tier: a looser opening, bought at the minimum size. */
function passesGuardrail(tape: Tape, realSol: bigint, p: Params): boolean {
  if (tape.complete) return false;
  if (tape.buyers.size < p.guardMinBuyers) return false;
  if (tape.buyers.size > p.guardMaxBuyers) return false;
  if (tape.creatorBuy > BigInt(p.guardMaxCreatorBuy)) return false;
  if (realSol < BigInt(p.minRealSol)) return false;
  return true;
}

/** Mark value of a token balance at the curve's latest virtual reserves. */
function markValue(tokens: bigint, virtualTokens: bigint, virtualQuote: bigint): bigint {
  if (virtualTokens === 0n) return 0n;
  return (tokens * virtualQuote) / virtualTokens;
}

/** The strategy itself: per-mint tapes, open positions, and coins never to touch again. */
export function createStrategy(params: Params): {
  onBatch(state: BotState, batch: Batch): OrderInput[];
} {
  const p: Params = { ...params };
  /** Opening tapes by mint, in first-seen order. */
  const tapes = new Map<string, Tape>();
  /** Positions this strategy holds, by mint. */
  const open = new Map<string, Opened>();
  /** Coins already bought once this run — never bought again. */
  const done = new Set<string>();
  /** Counter for client ids; the shim would assign its own, but explicit ids let the
   * strategy match fills back to the orders that caused them. */
  let nextId = 1;

  /** Settle the fills that resolved since the last batch. */
  function settleFills(batch: Batch): void {
    for (const fill of batch.fills) {
      if (fill.side === 'buy' && fill.status === 'filled') {
        open.set(fill.mint, { decidedSlot: fill.decided_slot });
      } else if (fill.side === 'sell' && fill.status === 'filled') {
        open.delete(fill.mint);
      }
    }
  }

  /** Take this batch's events into the tapes. */
  function ingest(batch: Batch): void {
    for (const ev of batch.events) {
      if (ev.event === 'CreateEvent') {
        if (!tapes.has(ev.mint)) tapes.set(ev.mint, freshTape(ev.creator, ev.slot));
      } else if (ev.event === 'TradeEvent') {
        let tape = tapes.get(ev.mint);
        if (tape === undefined) {
          tape = freshTape(ev.creator, -1);
          tapes.set(ev.mint, tape);
        }
        noteTrade(tape, ev);
      } else if (ev.event === 'CompleteEvent') {
        const tape = tapes.get(ev.mint);
        if (tape !== undefined) tape.complete = true;
      }
    }
  }

  /** Drop open records the account no longer holds (harness closes settle as fills). */
  function reconcile(state: BotState): void {
    for (const mint of [...open.keys()]) {
      if (!state.positions.has(mint)) open.delete(mint);
    }
  }

  /** True when an order of this side on this mint is still waiting for its fill. */
  function hasPending(state: BotState, mint: string, side: 'buy' | 'sell'): boolean {
    for (const pending of state.pending.values()) {
      if (pending.order.mint === mint && pending.order.side === side) return true;
    }
    return false;
  }

  /** One batch of decisions: exits first, then entries, in tape order. */
  function onBatch(state: BotState, batch: Batch): OrderInput[] {
    settleFills(batch);
    ingest(batch);
    reconcile(state);

    const orders: OrderInput[] = [];
    const txFee = state.txFeeLamports();

    // --- Exits: time, creator sale, or stop — whichever comes first. ---
    for (const [mint, entry] of open) {
      if (hasPending(state, mint, 'sell')) continue;
      const held = state.positions.get(mint);
      if (held === undefined) continue;
      const tape = tapes.get(mint);
      // The hold clock runs from the launch itself, not from the buy: the design is
      // in and out within fifteen slots of the launch, so a late entry gets a short
      // stay. A tape whose birth is unknown falls back to the buy's decision slot.
      const heldSince = tape !== undefined && tape.born >= 0 ? tape.born : entry.decidedSlot;
      const heldSlots = batch.slot - heldSince;

      let leave = false;
      if (heldSlots >= p.maxHoldSlots) leave = true;
      if (!leave && tape !== undefined && tape.creatorSold) leave = true;
      if (!leave) {
        const curve = state.curves.get(mint);
        if (curve !== undefined) {
          const value = markValue(held.token_amount, curve.virtual_token_reserves, curve.virtual_quote_reserves);
          if (value * BPS < held.cost_lamports * (BPS - BigInt(p.stopLossBps))) leave = true;
          if (!leave && p.takeProfitBps > 0 && value * BPS >= held.cost_lamports * (BPS + BigInt(p.takeProfitBps))) leave = true;
        }
      }
      if (!leave) continue;
      orders.push({
        side: 'sell',
        client_id: `s${nextId++}`,
        mint,
        token_amount: held.token_amount.toString(),
        max_slippage_bps: p.sellSlippageBps,
      });
    }

    // --- Entries: strict tier first, guardrail tier second, tape order. ---
    let seats = state.hello.caps.max_open_positions - state.committedPositionCount();
    let spareCash = state.freeCashLamports();
    for (const [mint, tape] of tapes) {
      if (orders.length >= state.hello.caps.max_orders_per_batch) break;
      if (seats <= 0) break;
      if (done.has(mint) || open.has(mint)) continue;
      if (hasPending(state, mint, 'buy')) continue;
      if (tape.born < 0) continue;
      if (batch.slot - tape.born > p.maxAgeSlots) continue;
      const curve = state.curves.get(mint);
      if (curve === undefined || curve.complete) continue;
      const realSol = curve.real_quote_reserves;

      let stake: number | null = null;
      if (passesStrict(tape, realSol, p)) {
        stake = p.strictStake;
      } else if (passesGuardrail(tape, realSol, p)) {
        stake = p.guardStake;
      }
      if (stake === null) continue;

      // The harness caps each reply's buys on a mint at 1% of its real reserve.
      const cap = state.maxBuyLamports(mint);
      let spend = BigInt(stake);
      if (spend > cap) spend = cap;
      if (spend <= 0n) continue;
      if (spend + txFee > spareCash) continue;

      orders.push({
        side: 'buy',
        client_id: `b${nextId++}`,
        mint,
        quote_lamports: spend.toString(),
        max_slippage_bps: p.slippageBps,
      });
      done.add(mint);
      seats -= 1;
      spareCash -= spend + txFee;
    }

    return orders;
  }

  return { onBatch };
}
