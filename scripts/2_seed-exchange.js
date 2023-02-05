
const config = require('../src/config.json')

const tokens = (n) => {
	return ethers.utils.parseUnits(n.toString(), 'ether')
}

const wait = (seconds) => {
    const milliseconds = seconds * 1000
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function main(){
	//fetch accounts from wallet  -  these are unlocked
    const accounts = await ethers.getSigners()

    //fetch network
    const { chainId } = await ethers.provider.getNetwork()
    console.log("Using chainId", chainId)

    //fetch deployed tokens
    const DApp = await ethers.getContractAt('Token', config[chainId].DApp.address)
    console.log(`Dapp Token fetched: ${DApp.address}\n`)

    const mETH = await ethers.getContractAt('Token', config[chainId].mETH.address)
    console.log(`mETH Token fetched: ${mETH.address}\n`)

    const mDAI = await ethers.getContractAt('Token', config[chainId].mDAI.address)
    console.log(`mDAI Token fetched: ${mDAI.address}\n`)

    const exchange = await ethers.getContractAt('Exchange', config[chainId].exchange.address)
    console.log(`Exchange fetched: ${exchange.address}\n`)

	//give tokens to account 1
    const sender = accounts[0]
    const receiver = accounts[1]
    let amount = tokens(10000)

    //user 1 transfers 10,000 mETH
    let transaction, result
    transaction = await mETH.connect(sender).transfer(receiver.address, amount)
    console.log(`Transferred ${amount} tokens from ${sender.address} to ${receiver.address}\n`)

    //set up exchange users
    const user1 = accounts[0]
    const user2 = accounts[1]
    amount = tokens(10000)

    //user 1 approves 10000 dapp
    transaction = await DApp.connect(user1).approve(exchange.address, amount)
    await transaction.wait()
    console.log(`Approved ${amount} tokens from ${user1.address}`)

    //user 1 deposits 10000 dapp
    transaction = await exchange.connect(user1).depositToken(DApp.address, amount)
    await transaction.wait()
    console.log(`Depopsited ${amount} Ether from ${user1.address}\n`)

    //user 2 approves mETH
    transaction = await mETH.connect(user2).approve(exchange.address, amount)
    await transaction.wait()
    console.log(`Approved ${amount} tokens from ${user2.address}`)

    //user 2 deposits mETH
    transaction = await exchange.connect(user2).depositToken(mETH.address, amount)
    await transaction.wait()
    console.log(`Depopsited ${amount} Ether from ${user2.address}\n`)

    //seed a canceled order
    let orderId
    transaction = await exchange.connect(user1).makeOrder(mETH.address, tokens(100), DApp.address, tokens(5))
    result = await transaction.wait()
    console.log(`Make order from ${user1.address}`)

    // User 1 cancels order
  	orderId = result.events[0].args.id
  	transaction = await exchange.connect(user1).cancelOrder(orderId)
  	result = await transaction.wait()
  	console.log(`Cancelled order from ${user1.address}\n`)

  	//wait 1 second
  	await wait(1)

  	//seed filled order
  	// User 1 makes order
  	transaction = await exchange.connect(user1).makeOrder(mETH.address, tokens(100), DApp.address, tokens(10))
  	result = await transaction.wait()
  	console.log(`Made order from ${user1.address}`)

  	// User 2 fills order
  	orderId = result.events[0].args.id
  	transaction = await exchange.connect(user2).fillOrder(orderId)
  	result = await transaction.wait()
  	console.log(`Filled order from ${user1.address}\n`)

  	// Wait 1 second
  	await wait(1)

  	// User 1 makes another order
  	transaction = await exchange.makeOrder(mETH.address, tokens(50), DApp.address, tokens(15))
  	result = await transaction.wait()
  	console.log(`Made order from ${user1.address}`)

  	// User 2 fills another order
  	orderId = result.events[0].args.id
  	transaction = await exchange.connect(user2).fillOrder(orderId)
  	result = await transaction.wait()
  	console.log(`Filled order from ${user1.address}\n`)

  	// Wait 1 second
  	await wait(1)

  	// User 1 makes final order
  	transaction = await exchange.connect(user1).makeOrder(mETH.address, tokens(200), DApp.address, tokens(20))
  	result = await transaction.wait()
  	console.log(`Made order from ${user1.address}`)

  	// User 2 fills final order
  	orderId = result.events[0].args.id
  	transaction = await exchange.connect(user2).fillOrder(orderId)
  	result = await transaction.wait()
  	console.log(`Filled order from ${user1.address}\n`)

  	// Wait 1 second
  	await wait(1)

  /////////////////////////////////////////////////////////////
  // Seed Open Orders
  //

  // User 1 makes 10 orders
  for(let i = 1; i <= 10; i++) {
    transaction = await exchange.connect(user1).makeOrder(mETH.address, tokens(10 * i), DApp.address, tokens(10))
    result = await transaction.wait()

    console.log(`Made order from ${user1.address}`)

    // Wait 1 second
    await wait(1)
  }

  // User 2 makes 10 orders
  for (let i = 1; i <= 10; i++) {
    transaction = await exchange.connect(user2).makeOrder(DApp.address, tokens(10), mETH.address, tokens(10 * i))
    result = await transaction.wait()

    console.log(`Made order from ${user2.address}`)

    // Wait 1 second
    await wait(1)
  }

}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

