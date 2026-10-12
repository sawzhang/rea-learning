import { createInvoice } from './invoice.js';
export async function checkout(items) {
  const invoice = createInvoice(items);
  const response = await fetch('https://example.invalid/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(invoice),
  });
  return response.json();
}
