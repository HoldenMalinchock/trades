import { DOMParser } from 'https://deno.land/x/deno_dom/deno-dom-wasm.ts';
import { isDate } from "https://deno.land/x/deno_validator@v0.0.5/mod.ts";


const url = "http://openinsider.com/screener?s=SNOW&isofficer=1&iscob=1&isceo=1&ispres=1&iscoo=1&iscfo=1&isgc=1&isvp=1&isdirector=1&cnt=35&page=1"

const response = await fetch(url)
const html = await response.text()
const document = new DOMParser().parseFromString(html, 'text/html');

document?.querySelectorAll('tr').forEach((el) => {
    // We can parse what we need from this and be fine for now, we can make it more complex later if we find that there are issues
    const splitTableRowText = el.textContent.split(" ")
    // console.log(splitTableRowText)
    // We need to say if it isnt a Date, or DDate or DMDate then return we can think of better ways to do this in the future
    if(splitTableRowText.length < 4 || (!isDate(splitTableRowText[0], {}) && !isDate(splitTableRowText[0].slice(1), {}) && !isDate(splitTableRowText[0].slice(2), {}))) return
    
    // Now we correctly have only objects which contain the the data we want
    const tradeDate = splitTableRowText[1].slice(-10)
    console.log(splitTableRowText)
    const _ = (splitTableRowText.findIndex((el) => el === "-") + 1)

    const tradeType = splitTableRowText[_].split("$")[0]
    const stockPrice = splitTableRowText[_].split("$")[1].split(/[+-]/)[0]
    // When looking at delta it can be either be positive negative or 0, positive is on purchase negative on sell and 0 for either
    const delta = splitTableRowText[_].split("$")[1].split(/[+-]/)[2]
    const value = splitTableRowText[_].split("$")[2]

    console.log(tradeDate)
    console.log(tradeType)
    console.log(stockPrice)
    console.log(delta)
    console.log(value)
})

// console.log(html)
// http://openinsider.com/screener?s=SNOW&o=&pl=&ph=&ll=&lh=&fd=730&fdr=&td=0&tdr=&fdlyl=&fdlyh=&daysago=&xp=1&xs=1&vl=&vh=&ocl=&och=&sic1=-1&sicl=100&sich=9999&isofficer=1&iscob=1&isceo=1&ispres=1&iscoo=1&iscfo=1&isgc=1&isvp=1&isdirector=1&grp=0&nfl=&nfh=&nil=&nih=&nol=&noh=&v2l=&v2h=&oc2l=&oc2h=&sortcol=0&cnt=100&page=1