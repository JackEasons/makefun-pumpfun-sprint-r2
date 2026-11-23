// Tide — entrypoint for the pump.fun replay sprint.
//
// The harness speaks agent-fun/replay/v2: it sends a hello first, then one batch per
// slot, and expects one reply of orders per batch. The vendored shim owns that wire —
// stdin/stdout, client ids, reply limits — so all this file does is build the strategy
// with its default parameters and hand each batch's decisions to the shim.

import { runBot } from './vendor/makefun-bot.ts';
import { createStrategy, DEFAULT_PARAMS } from './strategy.ts';

const tide = createStrategy(DEFAULT_PARAMS);

await runBot({
  onBatch: (state, batch) => tide.onBatch(state, batch),
});
