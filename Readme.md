This is how you would use Alpaca javascript api in deno, Deno doesn't like this
since it isnt ES6 Alpaca object is not defined:

```
// import Alpaca from "npm:@alpacahq/alpaca-trade-api@3.0.1"

// const alpaca = new Alpaca({
//     keyId: 'MY SUPER SECRET ID',
//     secretKey: 'MY SUPER SECRET KEY', 
//     paper: true,
// })

// alpaca.getAccount().then((account) => {
// console.log('Current Account:', account)
// })
```

What I will be doing next with this project. I am going to tie into our trading
decision some self made indicators with openInsider. With OpenInsider we are
also going to be looking for option opportunities where large sale numbers come
through.

- Recent example of this: SNOW saw multiple sales ~230 from directors two weeks
  before earnings. the stock proceeded for fall drastically shortly after. Could
  that be a coincidence? Is this a possible indicator to assist DD? I want to
  explore this by scanning stocks for large sale/purchase numbers while the
  current stock price is within ~3-5% and test how monthlies would preform on
  this information.
