import {
  HistoricalData,
  HistoricalDataObj,
  MostActiveStockResponse,
} from "@/types/MarketTypes.ts";
import { OpenPositions } from "@/types/TradeTypes.ts";
import {
  getRecentOpenSeaTrades,
  getTradeDetailsOverPeriod,
} from "@/openInsider.ts";
// We can use this to toggle which url to use for action later
const ALPACA_BASE_URL_PAPER = "https://paper-api.alpaca.markets/v2";
const ALPACA_BASE_URL_REAL = "https://api.alpaca.markets/v2";
const ALPACA_BASE_URL_DATA = "https://data.alpaca.markets/v2";

// All alpaca requests need to go through this so we can add the headers, rather than fetches and headers all over the place this is a better on my brain
const sendAlpacaRequest = async (url: string, method: string, body: any) => {
  return await fetch(url, {
    method: method,
    body: body,
    headers: {
      "APCA-API-KEY-ID": Deno.env.get("ALPACA_API_KEY") ?? "",
      "APCA-API-SECRET-KEY": Deno.env.get("ALPACA_SECRET_KEY") ?? "",
      accept: "application/json",
    },
  });
};

const buyStock = async (
  symbol: string,
  qty: string,
  type = "market",
  time_in_force = "day",
) => {
  // need to determine selling characteristics, may want to use the auto orders but may not be on free account
  const response = await sendAlpacaRequest(
    `${ALPACA_BASE_URL_PAPER}/orders`,
    "POST",
    JSON.stringify({
      symbol: symbol,
      qty: qty,
      side: "buy",
      type: type,
      time_in_force: time_in_force,
    }),
  );
  return await response.json();
};

const sellStock = async (
  symbol: string,
  qty: string,
  type = "market",
  time_in_force = "day",
) => {
  // need to determine selling characteristics, may want to use the auto orders but may not be on free account
  const response = await sendAlpacaRequest(
    `${ALPACA_BASE_URL_PAPER}/orders`,
    "POST",
    JSON.stringify({
      symbol: symbol,
      qty: qty,
      side: "sell",
      type: type,
      time_in_force: time_in_force,
    }),
  );
  return await response.json();
};

const getAccount = async () => {
  const response = await sendAlpacaRequest(
    `${ALPACA_BASE_URL_PAPER}/account`,
    "GET",
    null,
  );
  return await response.json();
};

const getOpenPositions = async (): Promise<OpenPositions[]> => {
  const response = await sendAlpacaRequest(
    `${ALPACA_BASE_URL_PAPER}/positions`,
    "GET",
    null,
  );
  return await response.json();
};

const getAllOrders = async (status = "open") => {
  const response = await sendAlpacaRequest(
    `${ALPACA_BASE_URL_PAPER}/orders?status=${status}`,
    "GET",
    null,
  );
  return await response.json();
};

const getMostActiveStocks = async (
  by = "volume",
  top = 30,
): Promise<MostActiveStockResponse> => {
  // Sadly this endpoint is not upgraded
  const response = await sendAlpacaRequest(
    `https://data.alpaca.markets/v1beta1/screener/stocks/most-actives?by=${by}&top=${top}`,
    "GET",
    null,
  );
  return await response.json();
};

// This is kinda inneficient, but setDate/FullYear will modify the date object, so we need to create a new one each time there is probably a function to do this that I dont know about
// TODO to cut down on api calls we can make this request send multiple symbols at once grabbing the data in a huge object, could have performance issues in future depending on the size of the object we could get to
const getHistoricalDataYear = async (symbol: string) => {
  // console.log(symbol)
  // get the date of yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const lastYear = new Date();
  lastYear.setFullYear(lastYear.getFullYear() - 1);
  const response = await sendAlpacaRequest(
    `${ALPACA_BASE_URL_DATA}/stocks/bars?symbols=${symbol}&start=${lastYear.toISOString()}&end=${yesterday.toISOString()}&timeframe=1D&limit=1000`,
    "GET",
    null,
  );
  const resJson: HistoricalData = await response.json();
  // Some stocks are just returning empty bars objects.  Looks like it was only happening on really tiny penny stocks.
  // These stocks have data so it isnt lack of data but perhaps stocks that are too small dont have historical data?  Not sure but we need to handle empty bars
  try {
    resJson.bars[symbol].reverse();
  } catch (e) {
    console.log(
      "Error getting historical data for",
      symbol,
      " bars might be empty!",
    );
  }
  return resJson;
};

// Gather MA for 50 and 200 days at the same time returning tuple
// Assumes historical data is in order
const get50And200DayMA = (
  historicalData: HistoricalDataObj[],
): [number, number] => {
  let sum50 = 0;
  let sum200 = 0;
  for (let i = 0; i < 200; i++) {
    if (i < 50) sum50 += historicalData[i].c;
    sum200 += historicalData[i].c;
  }
  return [sum50 / 50, sum200 / 200];
};

// TODO fix type
const containsBarData = (bars: Object) => {
  if (Object.keys(bars).length === 0) {
    return false;
  }
  return true;
};

// Creating the stucture for the process to run
// First we get our account data and our open positions
const account = await getAccount();
const openPositions = await getOpenPositions();

const buyLogic = () => {
  // Analyze the buying opportunities
  // Logic is currently checking top 10 volume stocks for the day and buying 3% of our account value if the stock is below the 50 and 200 day moving averages
  // More complex logic could be being below the MA by a certain %, or being below the MA for a certain amount of time this might make more interesting information
  // Day 1 issues im seeing is that we are buying stocks that are dogshit, and are penny stocks that are in massive pump and dump states.
  // We need to have a market cap requirement or dollar amount requirement to prevent this
  // Adding new logic for insider trading, if there is a recent insider trade we will buy the stock
  // If we have insider information then we are going use this info to determine if we buy the stock, otherwise we will use the MA
  getMostActiveStocks().then(async (stocks) => {
    stocks.most_actives.forEach(async (stock) => {
      // Then we will get the historical data and preform buying logic for the stock
      // TODO we should make this store all the historical data in a single object for the stocks we grab to make this happen only once
      const stockHistoricalData = await getHistoricalDataYear(stock.symbol);
      if (!containsBarData(stockHistoricalData.bars)) {
        console.log("No historical bars for", stock.symbol);
        return;
      } // If we don't have enough data we dont want to buy the stock we want to be sure that we have enough data
      else if (stockHistoricalData.bars[stock.symbol].length < 200) {
        console.log("Not enough data for", stock.symbol);
        return;
      }
      const [MA50, MA200] = get50And200DayMA(
        stockHistoricalData.bars[stock.symbol],
      );
      const closingPrice = stockHistoricalData.bars[stock.symbol][0].c;
      const insiderInfo = await getRecentOpenSeaTrades(stock.symbol);
      const insiderTradeHistory = getTradeDetailsOverPeriod(insiderInfo, 6);

      // We need to avoid getting swept into penny stocks and small cap companies, for now we will look for stocks valued higher than $7 per share since historical data doesnt show market cap data
      if (closingPrice < 10) {
        console.log(
          "Stock price is too low, penny stock territory",
          stock.symbol,
        );
        console.info("INVESTIGATE ", stock.symbol.toUpperCase());
      } else if (!isNaN(insiderTradeHistory.Purchase.priceAvg)) {
        if (
          (closingPrice < insiderTradeHistory.Purchase.priceAvg &&
            insiderTradeHistory.Purchase.dataPoints >= 3 &&
            insiderTradeHistory.Purchase.deltaAvg > 3) ||
          insiderTradeHistory.Purchase.highDelta > 20
        ) {
          console.log(
            "We should buy, insiders are buying for better prices",
            stock.symbol,
          );
          // We will buy 3% of our account balance rounded up if we don't have open positions in the stock
          // Will this be affected by open Orders?
          const stockPosition = openPositions.find(
            (position: any) => position.symbol === stock.symbol,
          );
          if (stockPosition) {
            console.log("We already have a position, not buying", stock.symbol);
          } else {
            const buyAmount = Math.ceil((account.equity * 0.03) / closingPrice);
            console.log(`Buying ${buyAmount} of ${stock.symbol}`);
            buyStock(stock.symbol, buyAmount.toString()).then((res) => {
              console.log(res);
            });
          }
        }
      } else if (closingPrice < MA50 && closingPrice < MA200) {
        // BUY
        console.log(
          "We should buy, price is below 50 and 200 MA",
          stock.symbol,
        );
        // We will buy 3% of our account balance rounded up if we don't have open positions in the stock
        // Will this be affected by open Orders?
        const stockPosition = openPositions.find(
          (position: any) => position.symbol === stock.symbol,
        );
        if (stockPosition) {
          console.log("We already have a position, not buying", stock.symbol);
        } else {
          const buyAmount = Math.ceil((account.equity * 0.03) / closingPrice);
          console.log(`Buying ${buyAmount} of ${stock.symbol}`);
          buyStock(stock.symbol, buyAmount.toString()).then((res) => {
            console.log(res);
          });
        }
      } else {
        console.log(
          "ignoring buy option, price is above averages and insider data is either not good or unavailable",
          stock.symbol,
        );
      }
    });
  });
};

// Exit thresholds. Pulled out so they're easy to tune in one place rather than
// scattered through the branches below.
const STOP_LOSS_PCT = -0.08; // cut a position once it's down 8%
const TAKE_PROFIT_PCT = 0.2; // lock in gains once a position is up 20%
const MA_STRETCH_MULT = 1.08; // sell when price runs 8% above both MAs
const MA200_BREAK_BUFFER = 0.98; // 2% buffer below MA200 before calling the thesis broken

const sellLogic = () => {
  getOpenPositions().then((positions) => {
    if (positions.length === 0) {
      console.log("No open positions to sell");
      return;
    }
    positions.forEach(async (position) => {
      const stockHistoricalData = await getHistoricalDataYear(position.symbol);
      if (!containsBarData(stockHistoricalData.bars)) {
        console.log("No historical bars for", position.symbol);
        return;
      }
      const bars = stockHistoricalData.bars[position.symbol];

      const [MA50, MA200] = get50And200DayMA(bars);
      // current_price comes back as a decimal string like "12.95" — parseInt
      // silently drops the cents and pushes every comparison off by up to a dollar.
      const currentPrice = parseFloat(position.current_price);
      const entryPrice = parseFloat(position.avg_entry_price);
      // unrealized_plpc is already a decimal fraction from Alpaca (0.07 = +7%)
      const unrealizedPct = parseFloat(position.unrealized_plpc);

      // Mirror the insider read we do on the buy side. We treat clustered
      // insider sales as a smart-money distribution signal.
      const insiderInfo = await getRecentOpenSeaTrades(position.symbol);
      const insiderTradeHistory = getTradeDetailsOverPeriod(insiderInfo, 6);
      const insiderDistribution = !isNaN(insiderTradeHistory.Sale.priceAvg) &&
        insiderTradeHistory.Sale.dataPoints >= 3 &&
        insiderTradeHistory.Sale.deltaAvg > 5;

      // Each branch below is an independent reason to exit. They're ordered
      // capital-preservation first, then profit-taking, then signal-driven.
      // First match wins so we don't double-fire sells.

      // 1. Hard stop loss. Without this a thesis-break trade can ride to -50%.
      if (unrealizedPct <= STOP_LOSS_PCT) {
        console.log(
          `SELL ${position.symbol}: stop loss (${
            (unrealizedPct * 100).toFixed(
              2,
            )
          }%)`,
        );
        sellStock(position.symbol, position.qty).then((res) =>
          console.log(res)
        );
        return;
      }

      // 2. Take profit. A 20% gain on a mean-reversion entry is a good exit;
      //    if it keeps running we can re-enter on the next dip.
      if (unrealizedPct >= TAKE_PROFIT_PCT) {
        console.log(
          `SELL ${position.symbol}: take profit (${
            (
              unrealizedPct * 100
            ).toFixed(2)
          }%)`,
        );
        sellStock(position.symbol, position.qty).then((res) =>
          console.log(res)
        );
        return;
      }

      // 3. Long-term trend break. We only buy when price is below both MAs,
      //    so if a position has since climbed above MA200 and then fallen
      //    back through it, the recovery thesis is no longer intact —
      //    exit regardless of P/L. The 2% buffer keeps us from chopping
      //    on a bar that closes right on the MA.
      if (entryPrice < MA200 && currentPrice < MA200 * MA200_BREAK_BUFFER) {
        console.log(
          `SELL ${position.symbol}: lost MA200, mean-reversion thesis broken`,
        );
        sellStock(position.symbol, position.qty).then((res) =>
          console.log(res)
        );
        return;
      }

      // 4. Insider distribution while we're holding green. Mirrors the
      //    insider purchase trigger on the buy side. We only act on this
      //    when we're already in profit so we don't bail out of a position
      //    that's still working through its drawdown.
      if (insiderDistribution && unrealizedPct > 0) {
        console.log(
          `SELL ${position.symbol}: insider sales clustering ` +
            `(${insiderTradeHistory.Sale.dataPoints} filings, ` +
            `avg delta ${insiderTradeHistory.Sale.deltaAvg}%)`,
        );
        sellStock(position.symbol, position.qty).then((res) =>
          console.log(res)
        );
        return;
      }

      // 5. Mean-reversion target reached. Original exit, tightened from 10%
      //    to 8% since the earlier signals now catch the strongest runs.
      if (
        currentPrice > MA50 * MA_STRETCH_MULT &&
        currentPrice > MA200 * MA_STRETCH_MULT
      ) {
        console.log(
          `SELL ${position.symbol}: stretched above both MAs ` +
            `(price ${currentPrice}, MA50 ${MA50.toFixed(2)}, MA200 ${
              MA200.toFixed(
                2,
              )
            })`,
        );
        sellStock(position.symbol, position.qty).then((res) =>
          console.log(res)
        );
        return;
      }

      console.log(
        `HOLD ${position.symbol}: P/L ${
          (unrealizedPct * 100).toFixed(
            2,
          )
        }%, no exit signal`,
      );
    });
  });
};

// Run a cron job at 11am utc monday through friday
Deno.cron("Do Buy and Sell Actions", "0 16 * * 1-5", () => {
  buyLogic();
  sellLogic();
});
