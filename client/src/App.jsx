import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { items } from "../../server/models/menu.js";
import "./index.css";

const App = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [currentOrder, setCurrentOrder] = useState([]);
  const socketRef = useRef(null); //SocketRef
  const suppressWelcomeRef = useRef(false); // 🛡️ Flag to suppress welcome after payment

  useEffect(() => {
    const storedId = localStorage.getItem("deviceId");
    const deviceId = storedId || `device-${Date.now()}`;
    localStorage.setItem("deviceId", deviceId);

    socketRef.current = io(import.meta.env.VITE_BACKEND_URL, {
      query: { deviceId },
    });

    socketRef.current.on("botReply", ({ reply, type }) => {
      if (type === "welcome" && suppressWelcomeRef.current) {
        suppressWelcomeRef.current = false; // Reset after suppression
        return;
      }
      setMessages((prev) => [...prev, { sender: "bot", text: reply, type }]);
    });

    return () => socketRef.current.disconnect();
  }, []);

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { sender: "user", text: input }]);
    socketRef.current.emit("userMessage", { message: input });
    setInput("");
  };

  const verifyPayment = async (reference, deviceId) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/verify-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference, deviceId }),
        }
      );

      const data = await res.json();

      if (data.status === "success") {
        const receipt = data.receipt;
        const message = `✅ Payment successful!\n\nAmount: ₦${
          receipt.amount
        }\nRef: ${receipt.reference}\nPaid via: ${
          receipt.channel
        }\nDate: ${new Date(receipt.paid_at).toLocaleString()}`;

        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: message, type: "text" },
        ]);

        setCurrentOrder([]); //Clear current order after successful payment
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              sender: "bot",
              text: "🎉 Thank you for your order! Your meal is being prepared.\n\nWhat would you like to do next?",
              type: "postPaymentMenu",
            },
          ]);
        }, 2000);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: "❌ Payment failed or was cancelled.\n\nWould you like to:",
            type: "text",
            options: [
              { label: "🔁 Retry Payment", value: "99" },
              { label: "🏠 Return to Menu", value: "1" },
            ],
          },
        ]);
      }
    } catch (err) {
      console.error("Verification error:", err);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "⚠️ We couldn’t verify your payment. It might be a network issue or a delay from Paystack.\n\nWould you like to:",
          type: "text",
          options: [
            { label: "🔁 Retry Verification", value: `verify-${reference}` },
            { label: "📞 Contact Support", value: "support" },
            { label: "🏠 Return to Menu", value: "1" },
          ],
        },
      ]);
    }
  };

  const payWithPaystack = (email, amount, orderSummary) => {
    const paystack = new window.PaystackPop();

    paystack.newTransaction({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY, // ✅ Vite-style env
      email,
      amount: amount * 100, // Paystack expects amount in kobo
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
      onSuccess: (transaction) => {
        suppressWelcomeRef.current = true; // Suppress welcome
        const deviceId = localStorage.getItem("deviceId"); // ✅ Get deviceId
        setTimeout(() => {
          verifyPayment(transaction.reference, deviceId); // ✅ Pass it in
        }, 3000);
      },

      onCancel: () => {
        console.log("⚠️ Payment cancelled");
        socketRef.current.emit("userMessage", { message: "Payment-cancelled" });
      },
    });
  };
  const calculateOrderDetails = () => {
    let total = 0;
    const summary = currentOrder
      .map((item) => {
        const menuItem = items.find((i) => i.name === item.name);
        const price = parseInt(menuItem.price);
        const itemTotal = price * item.quantity;
        total += itemTotal;
        return `${item.name} x${item.quantity} – ₦${itemTotal}`;
      })
      .join("\n");

    return { total, summary };
  };

  const sendQuickMessage = (text) => {
    setMessages((prev) => [...prev, { sender: "user", text }]);

    // Handle retry verification
    if (text.startsWith("verify-")) {
      const ref = text.split("verify-")[1];
      verifyPayment(ref);
      return;
    }

    // Handle payment
    if (text === "99") {
      const { total, summary } = calculateOrderDetails();

      if (total === 0 || currentOrder.length === 0) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: "🛑 No order to checkout. Please add items from the menu first.",
            type: "text",
          },
        ]);
        return;
      }

      const email = `guest-${Date.now()}@niyisrestaurant.com`;
      payWithPaystack(email, total, summary);
      return;
    }

    // Handle valid menu item
    const selectedItem = items.find((item) => item.name === text);
    if (selectedItem) {
      setCurrentOrder((prev) => {
        const existing = prev.find((i) => i.name === selectedItem.name);
        if (existing) {
          return prev.map((i) =>
            i.name === selectedItem.name
              ? { ...i, quantity: i.quantity + 1 }
              : i
          );
        }
        return [...prev, { name: selectedItem.name, quantity: 1 }];
      });

      socketRef.current.emit("userMessage", { message: text });
      return;
    }

    //  Handle known commands
    const knownCommands = ["1", "menu", "98", "97", "0", "support"];
    if (knownCommands.includes(text)) {
      socketRef.current.emit("userMessage", { message: text });
      return;
    }

    // Handle unknown input
    setMessages((prev) => [
      ...prev,
      {
        sender: "bot",
        text: `🤔 I didn’t quite catch that. Try selecting from the menu or typing "1" to view options.`,
        type: "text",
      },
    ]);
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <section className="w-full max-w-md bg-gray-800 rounded-xl shadow-lg p-4 space-y-4">
        <h1 className="text-2xl font-extrabold text-center text-green-400 animate-pulse">
          Niyi’s Restaurant Chatbot
        </h1>

        {/* Message Display */}
        <div className="h-80 overflow-y-auto space-y-2 flex flex-col">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[80%] px-4 py-2 rounded-lg text-sm ${
                msg.sender === "bot"
                  ? "bg-green-700 text-white self-start"
                  : "bg-blue-600 text-white self-end"
              }`}
            >
              {msg.type === "menu" ? (
                <div className="grid grid-cols-2 gap-2">
                  {items.map((item, idx) => (
                    <button
                      key={idx}
                      className="bg-gray-700 hover:bg-gray-800 text-white px-3 py-2 rounded text-left"
                      onClick={() => sendQuickMessage(item.name)}
                    >
                      {item.name} – ₦{item.price}
                    </button>
                  ))}
                </div>
              ) : msg.type === "welcome" ? (
                <>
                  <p>{msg.text}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "View Menu", value: "menu" },
                      { label: "Checkout", value: "99" },
                      { label: "Order History", value: "98" },
                      { label: "Current Order", value: "97" },
                      { label: "Cancel Order", value: "0" },
                    ].map((btn, i) => (
                      <button
                        key={i}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded"
                        onClick={() => sendQuickMessage(btn.value)}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : msg.type === "postPaymentMenu" ? (
                <>
                  <p>{msg.text}</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      { label: "View Menu", value: "menu" },
                      { label: "Checkout", value: "99" },
                      { label: "Order History", value: "98" },
                      { label: "Current Order", value: "97" },
                      { label: "Cancel Order", value: "0" },
                    ].map((btn, i) => (
                      <button
                        key={i}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded"
                        onClick={() => sendQuickMessage(btn.value)}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : msg.type === "postAdd" ? (
                <>
                  <p>{msg.text}</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      { label: "Add Another Item", value: "1" },
                      { label: "View Current Order", value: "97" },
                      { label: "Cancel Order", value: "0" },
                      { label: "Checkout", value: "99" },
                    ].map((btn, i) => (
                      <button
                        key={i}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded"
                        onClick={() => sendQuickMessage(btn.value)}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <pre className="whitespace-pre-wrap">{msg.text}</pre>
              )}
            </div>
          ))}
        </div>

        {/* Input Field + Send Button */}
        <div className="flex gap-2">
          <input
            className="flex-1 bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
          />
          <button
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded font-semibold"
            onClick={sendMessage}
          >
            Send
          </button>
        </div>
      </section>
    </main>
  );
};

export default App;
