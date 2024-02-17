This is how you would use Alpaca javascript api in deno, Deno doesn't like this since it isnt ES6 Alpaca object is not defined:

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

Still need to make this a cron job