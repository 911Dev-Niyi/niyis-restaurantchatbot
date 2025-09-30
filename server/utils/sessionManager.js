import axios from "axios";
import dotenv from "dotenv";
import { getMenuText, getWelcomeMessage, items } from "../models/menu.js";

dotenv.config();

const sessions = {};

export const getSession = (deviceId) => {
  if (!sessions[deviceId]) {
    sessions[deviceId] = {
      currentOrder: [],
      history: [],
      orders: [], 
    };
  }
  return sessions[deviceId];
};

export const handleUserInput = async (session, message) => {
  const trimmed = message.trim().toLowerCase();
  const knownCommands = [
    "hello",
    "hi",
    "good evening",
    "good morning",
    "1",
    "menu",
    "99",
    "98",
    "97",
    "0",
    "Payment-confirmed",
    "Payment-failed",
    "Payment-cancelled",
    "Payment-verification-error",
  ];
  const isMenuItem = items.find((i) => i.name.toLowerCase() === trimmed);

  if (!knownCommands.includes(trimmed) && !isMenuItem) {
    return {
      reply: `🤔 I didn’t quite catch that. Try selecting from the menu or typing "1" to view options.`,
      type: "text",
    };
  }

  // A. Greeting
  if (["hello", "hi", "good evening", "good morning"].includes(trimmed)) {
    return {
      reply: getWelcomeMessage(),
      type: "welcome",
    };
  }

  // B. View Menu
  if (trimmed === "1" || trimmed === "menu") {
    return {
      reply: getMenuText(),
      type: "menu",
    };
  }

  // C. Checkout
  if (trimmed === "99") {
    if (!session.currentOrder.length) {
      return {
        reply: "No order to checkout.",
        type: "text",
      };
    }
    console.log("🧾 Checkout triggered with cart:", session.currentOrder);

    let total = 0;
    const orderSummary = session.currentOrder
      .map((orderItem) => {
        const menuItem = items.find(
          (i) => i.name.toLowerCase() === orderItem.name.toLowerCase()
        );
        const price = menuItem ? parseInt(menuItem.price) : 0;
        const itemTotal = price * orderItem.quantity;
        total += itemTotal;
        return `${orderItem.name} x${orderItem.quantity} – ₦${itemTotal}`;
      })
      .join("\n");

    try {
      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email: `guest-${Date.now()}@niyisrestaurant.com`,
          amount: total * 100,
          currency: "NGN",
          metadata: {
            custom_fields: [
              {
                display_name: "Order Summary",
                variable_name: "order_summary",
                value: orderSummary,
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const paymentUrl = response.data.data.authorization_url;

      session.history.push([...session.currentOrder]);
      session.currentOrder = [];

      return {
        reply: `Order placed successfully!\n\n💳 Click [here](${paymentUrl}) to pay with Paystack.`,
        type: "text",
      };
    } catch (err) {
      console.error("Paystack error:", err.message);
      return {
        reply: "Something went wrong while initializing payment.",
        type: "text",
      };
    }
  }

  // D. Order History
  if (trimmed === "98") {
    if (!session.orders || session.orders.length === 0) {
      return { reply: "🕵️ No past orders found.", type: "text" };
    }

    const history = session.orders
      .map((order, i) => {
        const items = order.items
          .map((i) => `${i.name} x${i.quantity}`)
          .join(", ");
        return `#${i + 1} - ₦${order.total} – ${items} – Ref: ${
          order.reference
        }`;
      })
      .join("\n\n");
    return { reply: `📜 Your Order History:\n\n${history}`, type: "text" };
  }
  // E. Current Order
  if (trimmed === "97") {
    if (!session.currentOrder.length) {
      return {
        reply: "No current order. Start by typing a dish name.",
        type: "text",
      };
    }

    let total = 0;
    const summary = session.currentOrder
      .map((orderItem) => {
        const menuItem = items.find(
          (i) => i.name.toLowerCase() === orderItem.name.toLowerCase()
        );
        const price = menuItem ? parseInt(menuItem.price) : 0;
        const itemTotal = price * orderItem.quantity;
        total += itemTotal;
        return `${orderItem.name} x${orderItem.quantity} – ₦${itemTotal}`;
      })
      .join("\n");

    return {
      reply: `Current Order:\n${summary}\n\nTotal: ₦${total}`,
      type: "text",
    };
  }

  // F. Cancel Order
  if (trimmed === "0") {
    session.currentOrder = [];
    return {
      reply: "Your current order has been cancelled.",
      type: "text",
    };
  }

  // G. Add Item
  const menuItem = items.find((i) => i.name.toLowerCase() === trimmed);
  if (!menuItem) {
    return {
      reply: `Sorry, "${message}" is not on the menu.`,
      type: "text",
    };
  }

  const existingItem = session.currentOrder.find(
    (i) => i.name.toLowerCase() === trimmed
  );
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    session.currentOrder.push({ name: menuItem.name, quantity: 1 });
  }

  return {
    reply: `Item "${menuItem.name}" added to your order.`,
    type: "postAdd",
  };
};
