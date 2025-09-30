import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import { getSession } from "../utils/sessionManager.js";
import { saveOrder } from "../utils/orderStore.js"; // ✅ Add this

dotenv.config();
const router = express.Router();

router.post("/verify-payment", async (req, res) => {
  const { reference, deviceId } = req.body; // ✅ Include deviceId
  const session = getSession(deviceId);

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (!response.data || !response.data.data) {
      console.error("Unexpected Paystack response:", response.data);
      return res.status(500).json({ status: "error" });
    }

    const tx = response.data.data;

    if (tx.status === "success") {
     const order = {
  items: session.currentOrder,
  total: session.total,
  paidAt: new Date(),
  reference: tx.reference,
};

session.orders = session.orders || [];
session.orders.push(order);

// Save to file-based store BEFORE clearing
saveOrder(deviceId, {
  amount: tx.amount / 100,
  items: session.currentOrder.map((i) => i.name),
  reference: tx.reference,
  paid_at: tx.paid_at,
});

// clear the cart
session.currentOrder = [];
session.total = 0;


      res.json({
        status: "success",
        receipt: {
          amount: tx.amount / 100,
          reference: tx.reference,
          channel: tx.channel,
          paid_at: tx.paid_at,
        },
      });
    } else {
      res.json({ status: "failed" });
    }
  } catch (err) {
    console.error("Verification error", err.message);
    res.status(500).json({ status: "error" });
  }
});

export default router;
