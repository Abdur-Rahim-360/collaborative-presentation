// server.js

const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const { Low } = require('lowdb')
const { JSONFile } = require('lowdb/node')
const { nanoid } = require('nanoid')
const path = require('path')

// Path to your JSON file
const adapter = new JSONFile('db.json')
// Provide default data for an empty DB
const defaultData = { presentations: {} }
// Initialize LowDB with adapter and defaults
const db = new Low(adapter, defaultData)

async function initDB() {
  await db.read()
  // Apply defaults if file was empty
  db.data ||= defaultData
  await db.write()
}

// Kick off initialization
initDB()

// Set up Express + HTTP server + Socket.io
const app = express()
const server = http.createServer(app)
const io = new Server(server)

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')))

// Handle socket connections
io.on('connection', (socket) => {
  console.log('✅ A user connected:', socket.id)

  // User joins a presentation
  socket.on('join', async ({ nickname, presentationId }) => {
    await db.read()

    // Use provided ID or generate a new one
    const presId = presentationId || nanoid()
    socket.join(presId)

    // Initialize presentation if first time
    if (!db.data.presentations[presId]) {
      db.data.presentations[presId] = {
        slides: [],
        users: {},
        currentSlide: 0
      }
    }

    // Track this user
    db.data.presentations[presId].users[socket.id] = nickname
    await db.write()

    // Send updated presentation state to everyone in the room
    io.to(presId).emit('update', db.data.presentations[presId])
  })

  // Add a new slide
  socket.on('addSlide', async ({ presentationId, content }) => {
    await db.read()
    const pres = db.data.presentations[presentationId]
    if (pres) {
      pres.slides.push({ content })
      await db.write()
      io.to(presentationId).emit('update', pres)
    }
  })

  // Edit an existing slide
  socket.on('editSlide', async ({ presentationId, index, content }) => {
    await db.read()
    const pres = db.data.presentations[presentationId]
    if (pres && pres.slides[index]) {
      pres.slides[index].content = content
      await db.write()
      io.to(presentationId).emit('update', pres)
    }
  })

  // Change the visible slide index
  socket.on('changeSlide', async ({ presentationId, index }) => {
    await db.read()
    const pres = db.data.presentations[presentationId]
    if (pres) {
      pres.currentSlide = index
      await db.write()
      io.to(presentationId).emit('update', pres)
    }
  })

  // Clean up when a user disconnects
  socket.on('disconnect', async () => {
    await db.read()
    for (const presId in db.data.presentations) {
      const users = db.data.presentations[presId].users
      if (users[socket.id]) {
        delete users[socket.id]
        await db.write()
        io.to(presId).emit('update', db.data.presentations[presId])
      }
    }
    console.log('❌ A user disconnected:', socket.id)
  })
})

// Start listening
const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`)
})
