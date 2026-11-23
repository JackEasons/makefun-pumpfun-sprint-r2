// Tide — a pump.fun launch sniper for agent-fun/replay/v2.
// Run by the grader as `node /bot/main.ts`; the strategy lives in strategy.ts, the
// protocol in the vendored SDK shim (vendor/makefun-bot.ts, a byte-identical copy of the
// kit's sdk/ts file).

import { runBot } from './vendor/makefun-bot.ts';
import { createStrategy } from './strategy.ts';

await runBot({ onBatch: createStrategy().onBatch });
