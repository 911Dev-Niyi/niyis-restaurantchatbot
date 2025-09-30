export const items = [
{ id: '1', name: 'Jollof Rice', price: '1500'},    
{ id: '2', name: 'Grilled  Chicken', price: '2000'},
{ id: '3', name: 'Chapman Cocktail', price: '1600'},
{ id: '4', name: 'Fried Plantain', price: '800'},
{ id: '5', name: 'Eba with vegetable soup', price: '2000'},
{ id: '6', name: 'Scotch Whiskey', price: '1800'},
{ id: '7', name: 'Rice and stew', price: '1500'},
{ id: '8', name: 'Bread', price: '1000'},
{ id: '9', name: 'Nkwobi', price: '6500'},
{ id: '10', name: 'Amala with ewedu', price: '2200'},
];

export const getMenuText = () => 
    items.map(item => `${item.id} - ${item.name}  (₦${item.price})`).join('\n');

export const getWelcomeMessage = () => {
  return [
    "👋 Welcome to Niyi's Restaurant Chatbot!",
    "How can I help you today?",
    "",
    "📋 Available Commands:",
    "1️⃣  View our menu",
    "9️⃣9️⃣  Checkout",
    "9️⃣8️⃣  View order history",
    "9️⃣7️⃣  View current order",
    "0️⃣  Cancel order",
    "",
    "🍽️ Just type a dish name to start ordering!"
  ].join("\n");
};
