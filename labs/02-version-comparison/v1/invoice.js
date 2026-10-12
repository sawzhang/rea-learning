export function createInvoice(items) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return { currency: 'CNY', total, items };
}
