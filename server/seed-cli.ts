import { config } from './config'
import { db } from './db'
import { seedDatabase } from './seed'

// npm run seed            seeds an empty database (does nothing if the menu already exists)
// npm run seed -- --reset wipes menu, accounts and orders, then seeds again
const reset = process.argv.includes('--reset')

if (reset) {
  seedDatabase({ reset: true })
  console.log(`Database reset and seeded: ${config.databasePath}`)
} else {
  seedDatabase()
  console.log(`Database checked and any missing seed data added: ${config.databasePath}`)
  console.log('Use "npm run seed -- --reset" to wipe it and start over.')
}

const items = (db.prepare('SELECT COUNT(*) AS n FROM items').get() as { n: number }).n
const unconfirmed = (db.prepare('SELECT COUNT(*) AS n FROM items WHERE price_unconfirmed = 1').get() as { n: number }).n
console.log(`Menu: ${items} items, ${unconfirmed} with placeholder prices.`)
