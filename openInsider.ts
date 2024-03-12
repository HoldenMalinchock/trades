import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { isDate } from "https://deno.land/x/deno_validator@v0.0.5/mod.ts";

interface OpenSeaTrade {
  tradeDate: string;
  tradeType: string;
  stockPrice: string;
  delta: string;
  value: string;
}

export const getRecentOpenSeaTrades = async (ticker: string) => {
  const url =
    `http://openinsider.com/screener?s=${ticker}&isofficer=1&iscob=1&isceo=1&ispres=1&iscoo=1&iscfo=1&isgc=1&isvp=1&isdirector=1&cnt=35&page=1`;

  const response = await fetch(url);
  const html = await response.text();
  const document = new DOMParser().parseFromString(html, "text/html");

  // Trades will be a list of objects which is a list of trades
  const trades: OpenSeaTrade[] = [];

  document?.querySelectorAll("tr").forEach((el) => {
    // We can parse what we need from this and be fine for now, we can make it more complex later if we find that there are issues
    const splitTableRowText = el.textContent.split(" ");
    // console.log(splitTableRowText)
    // We need to say if it isnt a Date, or DDate or DMDate then return we can think of better ways to do this in the future
    if (
      splitTableRowText.length < 4 ||
      (!isDate(splitTableRowText[0], {}) &&
        !isDate(splitTableRowText[0].slice(1), {}) &&
        !isDate(splitTableRowText[0].slice(2), {}))
    ) return;

    // Now we correctly have only objects which contain the the data we want
    const tradeDate = splitTableRowText[1].slice(-10);
    const _ = splitTableRowText.findIndex((el) => el === "-") + 1;

    const tradeType = splitTableRowText[_].split("$")[0].split("+")[0];
    const stockPrice = splitTableRowText[_].split("$")[1].split(/[+-]/)[0];
    // When looking at delta it can be either be positive negative or 0, positive is on purchase negative on sell and 0 for either
    const delta = splitTableRowText[_].split("$")[1].split(/[+-]/)[2];
    const value = splitTableRowText[_].split("$")[2];

    // What we are intereseted in is trying to return some generic data about a stock so we can parse and use it with our trading information
    trades.push({
      tradeDate: tradeDate,
      tradeType: tradeType,
      stockPrice: stockPrice,
      delta: delta,
      value: value,
    });
  });
  return trades;
};

const average = (values: number[]) => {
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) /
    100;
};

// Can we do something with delta's here to try to get a better understanding of what kind of volume we are working with
// Small delta purchase and sales isnt exactly what I am looking for
const getAverageTradeValues6Month = (trades: OpenSeaTrade[]) => {
  const sells: number[] = [];
  const buys: number[] = [];
  const buyDeltas = [];
  const sellDeltas = [];
  trades.forEach((trade) => {
    // Check if trade date of trade is within the last 6 months
    const tradeDate = new Date(trade.tradeDate);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    if (tradeDate < sixMonthsAgo) return;

    if (trade.tradeType === "Purchase") {
      buys.push(parseFloat(trade.stockPrice));
    } else if (trade.tradeType === "Sale") {
      sells.push(parseFloat(trade.stockPrice));
    }
  });

  // We want to make this return object useful and give us lots of information about the sales and purchases, this will help us make more informed decisions on the backend
  return {
    Sale: {
      priceAvg: average(sells),
      deltaAvg: average(sellDeltas),
      highDelta: Math.max(...sellDeltas),
      valueAvg: average(sells),
      highValue: Math.max(...sells),
    },
    Purchase: {
      priceAvg: average(buys),
      deltaAvg: average(sellDeltas),
      highDelta: Math.max(...sellDeltas),
      valueAvg: average(sells),
      highValue: Math.max(...sells),
    },
  };
};

const t = await getRecentOpenSeaTrades("SNOW");
// console.log(t)
console.log(
  "Average Sell / Buy Prices in last 6 months",
  getAverageTradeValues6Month(t),
);
