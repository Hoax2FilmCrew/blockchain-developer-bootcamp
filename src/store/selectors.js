import { createSelector } from 'reselect'
import { get, groupBy, reject, maxBy, minBy } from 'lodash';
import moment from 'moment'
import { ethers } from 'ethers';

const GREEN = '#25CE8F'
const RED = '#F45353'


const account = state => get(state, 'provider.account')
const tokens = state => get(state, 'tokens.contracts')

const allOrders = state => get(state, 'exchange.allOrders.data', [])
const cancelledOrders = state => get(state, 'exchange.cancelledOrders.data', [])
const filledOrders = state => get(state, 'exchange.filledOrders.data', [])

const openOrders = state => {
  const all = allOrders(state)
  const filled = filledOrders(state)
  const cancelled = cancelledOrders(state)

  const openOrders = reject(all, (order) => {
    const orderFilled = filled.some((o) => o.id.toString() === order.id.toString())
    const orderCancelled = cancelled.some((o) => o.id.toString() === order.id.toString())
    return(orderFilled || orderCancelled)
  })

  return openOrders

}

//-----------------
//My open orders

export const myOpenOrdersSelector = createSelector(
  account,
  tokens,
  openOrders,
  (account, tokens, orders) => {
    if (!tokens[0] || !tokens[1]) { return }

    orders = orders.filter((o) => o.user === account)

    // Filter orders by selected tokens
    orders = orders.filter((o) => o.tokenGet === tokens[0].address || o.tokenGet === tokens[1].address)
    orders = orders.filter((o) => o.tokenGive === tokens[0].address || o.tokenGive === tokens[1].address)

    orders = decorateMyOpenOrders(orders, tokens)

    //sort descending
    orders = orders.sort((a,b) => b.timestamp - a.timestamp)

    return orders

    }
  )

const decorateMyOpenOrders = (orders, tokens) => {
  return(
    orders.map((order) => {
      order = decorateOrder(order, tokens)
      order = decorateMyOpenOrder(order, tokens)
      return(order)
    })
    )
}

const decorateMyOpenOrder = (order, tokens) => {
  let orderType = order.tokenGive === tokens[1].address ? 'buy' : 'sell'

  return({
    ...order,
    orderType,
    orderTypeClass: (orderType === 'buy' ? GREEN : RED)
  })

}


const decorateOrder = (order, tokens) => {
  let token0Amount, token1Amount

  // Note: DApp should be considered token0, mETH is considered token1
  // Example: Giving mETH in exchange for DApp
  if (order.tokenGive === tokens[0].address) {
    token0Amount = order.amountGive // The amount of DApp we are giving
    token1Amount = order.amountGet // The amount of mETH we want...
  } else {
    token0Amount = order.amountGet // The amount of DApp we want
    token1Amount = order.amountGive // The amount of mETH we are giving...
  }

  // Calculate token price to 5 decimal places
  const precision = 100000
  let tokenPrice = (token1Amount / token0Amount)
  tokenPrice = Math.round(tokenPrice * precision) / precision

  return ({
    ...order,
    token1Amount: ethers.utils.formatUnits(token1Amount, "ether"),
    token0Amount: ethers.utils.formatUnits(token0Amount, "ether"),
    tokenPrice,
    formattedTimestamp: moment.unix(order.timestamp).format('h:mm:ssa d MMM D')
  })
}

//----------------
//all filled orders

export const filledOrdersSelector = createSelector(
  filledOrders,
  tokens,
  (orders, tokens) => {
    if (!tokens[0] || !tokens[1]) { return }

    // Filter orders by selected tokens
    orders = orders.filter((o) => o.tokenGet === tokens[0].address || o.tokenGet === tokens[1].address)
    orders = orders.filter((o) => o.tokenGive === tokens[0].address || o.tokenGive === tokens[1].address)

    // sort orders by time ascending for price comparison
    orders = orders.sort((a, b) => a.timestamp - b.timestamp)

    //decorate the orders
    orders = decorateFilledOrders(orders, tokens)

    // sort orders by date descending for display
    orders = orders.sort((a, b) => b.timestamp - a.timestamp)

    return orders

  }
)

const decorateFilledOrders = (orders, tokens) => {
  
  let previousOrder = orders[0]

  return(
    orders.map((order) => {
    //decorate each individual order
      order = decorateOrder(order, tokens)
      order = decorateFilledOrder(order, previousOrder)
      previousOrder = order
      return order
    })
  )
}


const decorateFilledOrder = (order, previousOrder) => {
  return({
    ...order,
    tokenPriceClass: tokenPriceClass(order.tokenPrice, order.id, previousOrder)
  })

}

const tokenPriceClass = (tokenPrice, orderId, previousOrder) => {

  if (previousOrder.id === orderId) {
    return GREEN
  }

  if (previousOrder.tokenPrice <= tokenPrice) {
    return GREEN
  } else {
    return RED
  }
}




// ------------------------------------------------------------------------------
// ORDER BOOK

export const orderBookSelector = createSelector(
  openOrders,
  tokens,
  (orders, tokens) => {
    if (!tokens[0] || !tokens[1]) { return }

    // Filter orders by selected tokens
    orders = orders.filter((o) => o.tokenGet === tokens[0].address || o.tokenGet === tokens[1].address)
    orders = orders.filter((o) => o.tokenGive === tokens[0].address || o.tokenGive === tokens[1].address)

    // Decorate orders
    orders = decorateOrderBookOrders(orders, tokens)

    // Group orders by "orderType"
    orders = groupBy(orders, 'orderType')

    // Fetch buy orders
    const buyOrders = get(orders, 'buy', [])

    // Sort buy orders by token price
     orders = {
        ...orders,
        buyOrders: buyOrders.sort((a, b) => b.tokenPrice - a.tokenPrice)
      }

    // Fetch sell orders
    const sellOrders = get(orders, 'sell', [])

    // Sort sell orders by token price
    orders = {
      ...orders,
      sellOrders: sellOrders.sort((a, b) => b.tokenPrice - a.tokenPrice)
    }

    return orders
  }
)

const decorateOrderBookOrders = (orders, tokens) => {
  return(
    orders.map((order) => {
      order = decorateOrder(order, tokens)
      order = decorateOrderBookOrder(order, tokens)
      return(order)
    })
  )
}

const decorateOrderBookOrder = (order, tokens) => {
  const orderType = order.tokenGive === tokens[1].address ? 'buy' : 'sell'

  return({
    ...order,
    orderType,
    orderTypeClass: (orderType === 'buy' ? GREEN : RED),
    orderFillAction: (orderType === 'buy' ? 'sell' : 'buy')
  })
}


// ------------------------------------
//Price Chart

export const priceChartSelector = createSelector(
  filledOrders,
  tokens,
  (orders, tokens) => {
    if (!tokens[0] || !tokens[1]) { return }

    // Filter orders by selected tokens
    orders = orders.filter((o) => o.tokenGet === tokens[0].address || o.tokenGet === tokens[1].address)
    orders = orders.filter((o) => o.tokenGive === tokens[0].address || o.tokenGive === tokens[1].address)

    //sort orders by date ascending to compare history
    orders = orders.sort((a, b) => a.timestamp - b.timestamp)

    // decorate orders
    orders = orders.map((o) => decorateOrder(o, tokens))
    //get last 2 orders from final price
    let secondLastOrder, lastOrder
    [secondLastOrder, lastOrder] = orders.slice(orders.length - 2, orders.length)

    const lastPrice = get(lastOrder, 'tokenPrice', 0)
    const secondLastPrice = get(secondLastOrder, 'tokenPrice', 0)

    return({
      lastPrice,
      lastPriceChange: (lastPrice >= secondLastPrice ? '+' : '-'),
      series: [{
        data: buildGraphData(orders)
      }]
    })

  }
)


const buildGraphData = (orders) => {
    //group orders by hour
    orders = groupBy(orders, (o) => moment.unix(o.timestamp).startOf('hour').format())
    //get each hour data exists
    const hours = Object.keys(orders)
    //build graph series
    const graphData = hours.map((hour) => {
      //fetch all orders from current hour
      const group = orders[hour]

      //calculate prices. O, H, L, C
     const open = group[0]
     const high = maxBy(group, 'tokenPrice')
     const low = minBy(group, 'tokenPrice')
     const close = group[group.length - 1]

      return({
        x: new Date(hour),
        y: [open.tokenPrice, high.tokenPrice, low.tokenPrice, close.tokenPrice]
      })
    })

    return graphData
}


