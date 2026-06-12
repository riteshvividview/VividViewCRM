/**
 * Indian currency formatting utilities.
 * Used across Invoice, Payroll, and CRM (deal values).
 */

/**
 * Format a number as Indian currency string: ₹1,50,000
 */
export function formatINR(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Convert a number to Indian words (for invoice/payslip PDF).
 * e.g. 118000 → "One Lakh Eighteen Thousand"
 */
export function amountToWords(amount: number): string {
  if (amount === 0) return 'Zero';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
  ];

  function convertLessThanThousand(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100)
      return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    return (
      ones[Math.floor(n / 100)] +
      ' Hundred' +
      (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '')
    );
  }

  const crore = Math.floor(amount / 10_000_000);
  const lakh = Math.floor((amount % 10_000_000) / 100_000);
  const thousand = Math.floor((amount % 100_000) / 1_000);
  const remainder = amount % 1_000;

  const parts: string[] = [];
  if (crore > 0) parts.push(convertLessThanThousand(crore) + ' Crore');
  if (lakh > 0) parts.push(convertLessThanThousand(lakh) + ' Lakh');
  if (thousand > 0) parts.push(convertLessThanThousand(thousand) + ' Thousand');
  if (remainder > 0) parts.push(convertLessThanThousand(remainder));

  return parts.join(' ');
}

/**
 * Round to 2 decimal places (standard for currency).
 */
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
