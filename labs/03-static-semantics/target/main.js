function double(value) {
  return value * 2;
}
const input = 21;
const result = double(input);
export const invoice = { total: result, currency: 'CNY' };
export function readDynamic(object, key) {
  return object[key];
}
export async function submit() {
  const response = await fetch('https://example.invalid/api/invoice', {
    method: 'POST',
    body: JSON.stringify(invoice),
  });
  return response.json();
}
