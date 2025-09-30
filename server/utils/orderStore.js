import fs from "fs";
const filePath = "./orders.json";

// Safely read the file and return parsed data
const readData = () => {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "{}"); // Create file if missing
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("❌ Failed to read orders.json:", err);
    return {}; // Return empty object on failure
  }
};

// Save a new order for a device
export const saveOrder = (deviceId, order) => {
  const data = readData();

  if (!data[deviceId]) {
    data[deviceId] = [];
  }

  data[deviceId].push(order);

  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("❌ Failed to write to orders.json:", err);
  }
};

// Get all orders for a device
export const getOrders = (deviceId) => {
  const data = readData();
  return data[deviceId] || [];
};
