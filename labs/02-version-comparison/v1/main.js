import { createInvoice } from './invoice.js';
export async function checkout(items) {
  const invoice = createInvoice(items);
  const response = await fetch('https://example.invalid/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(invoice),
  });
  return response.json();
}
