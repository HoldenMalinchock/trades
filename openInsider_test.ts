import { assert, assertEquals } from "jsr:@std/assert";
import {
  getRecentOpenSeaTrades,
  getTradeDetailsOverPeriod,
} from "./openInsider.ts";

// These tests hit openinsider.com directly. We deliberately do not assert on
// specific values (priceAvg, dataPoints, etc.) because the underlying data
// shifts over time — a director files a new Form 4 and our snapshot is wrong.
// Instead we assert the shape of the response so we catch parser regressions
// (HTML structure changes, removed columns, broken splits, etc.) without
// chasing the data.
//
// Ticker choice: RIVN was the example in the original commented test block
// and has had consistent insider activity. If openinsider stops listing it
// the empty-result branch below still keeps the test honest.

const TEST_TICKER = "RIVN";

Deno.test("getRecentOpenSeaTrades returns an array of OpenSeaTrade-shaped rows", async () => {
  const trades = await getRecentOpenSeaTrades(TEST_TICKER);

  assert(Array.isArray(trades), "expected an array of trades");

  // Empty results are valid — the ticker may have no recent insider activity.
  // The shape check below only runs when there is data to inspect.
  for (const trade of trades) {
    assertEquals(typeof trade.tradeDate, "string", "tradeDate should be a string");
    assertEquals(typeof trade.tradeType, "string", "tradeType should be a string");
    assertEquals(typeof trade.stockPrice, "string", "stockPrice should be a string");
    assertEquals(typeof trade.delta, "string", "delta should be a string");
    assertEquals(typeof trade.value, "string", "value should be a string");

    // tradeType only ever takes two values when the parse succeeded. If we
    // ever start seeing other strings here the splitter is misaligned.
    assert(
      trade.tradeType === "Purchase" || trade.tradeType === "Sale",
      `unexpected tradeType: ${trade.tradeType}`,
    );

    // tradeDate is sliced as YYYY-MM-DD from the source row.
    assert(
      /^\d{4}-\d{2}-\d{2}$/.test(trade.tradeDate),
      `tradeDate not in YYYY-MM-DD form: ${trade.tradeDate}`,
    );
  }
});

Deno.test("getTradeDetailsOverPeriod returns Sale and Purchase summaries with the expected fields", async () => {
  const trades = await getRecentOpenSeaTrades(TEST_TICKER);
  const details = getTradeDetailsOverPeriod(trades, 6);

  const expectedKeys = [
    "priceAvg",
    "highPrice",
    "deltaAvg",
    "highDelta",
    "valueAvg",
    "highValue",
    "dataPoints",
  ] as const;

  for (const side of ["Sale", "Purchase"] as const) {
    const summary = details[side];
    assert(summary, `expected ${side} block on the response`);

    for (const key of expectedKeys) {
      // typeof NaN and typeof -Infinity are both "number", so an empty
      // dataset still satisfies the shape check — which is what we want.
      // We're verifying the parser produced the right *structure*, not that
      // the numbers are sensible.
      assertEquals(
        typeof summary[key],
        "number",
        `${side}.${key} should be a number, got ${typeof summary[key]}`,
      );
    }

    assert(
      Number.isInteger(summary.dataPoints) && summary.dataPoints >= 0,
      `${side}.dataPoints should be a non-negative integer, got ${summary.dataPoints}`,
    );
  }
});
