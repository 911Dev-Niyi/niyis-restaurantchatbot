import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import paymentRoutes from "./routes/payment.js";
import { getOrders } from './utils/orderStore.js';
import { getSession, handleUserInput } from './utils/sessionManager.js';
import { getWelcomeMessage } from './models/menu.js';

const app = express();
app.use(cors());
app.use(express.json());

// Mount payment routes
app.use("/", paymentRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

io.on('connection', socket => {
  const deviceId = socket.handshake.query.deviceId;
  const session = getSession(deviceId);

  console.log(`✅ New connection from ${deviceId}`);

  socket.emit('botReply', { reply: getWelcomeMessage() });

  socket.on('userMessage', async ({ message }) => {
    console.log(`📩 Message from ${deviceId}: ${message}`);

    if (message === "98") {
      const orders = getOrders(deviceId);

      if (orders.length === 0) {
        socket.emit("botReply", {
          reply: "📭 No orders found yet. Try placing one from the menu!",
          type: "text",
        });
      } else {
        const history = orders
          .map((o, i) => {
            const date = new Date(o.paid_at).toLocaleString();
            return `#${i + 1} – ₦${o.amount} – Ref: ${o.reference} – ${date}`;
          })
          .join("\n");

        socket.emit("botReply", {
          reply: `📜 Your Order History:\n\n${history}`,
          type: "text",
        });
      }

      return;
    }

    const { reply, type } = await handleUserInput(session, message);
    socket.emit('botReply', { reply, type });
  });

  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${deviceId}`);
  });
});

try {
  server.listen(3000, () => {
    console.log('🚀 Server running on port 3000');
  });
} catch (err) {
  console.error("❌ Server failed to start:", err);
}
