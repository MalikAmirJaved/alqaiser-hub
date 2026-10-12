# ============================================================
# Shared document-total helpers
# ------------------------------------------------------------
# Every document type (PurchaseOrder, Quote, CustomerInvoice,
# SalesOrder) must add per-line tax into its stored total.
# This module is the single source of truth for that math so
# the backend cannot drift from the frontend formulas.
# ============================================================
from decimal import Decimal

HUNDRED = Decimal('100')


def dec(value):
    """Coerce anything numeric to Decimal (None/'' -> 0)."""
    if isinstance(value, Decimal):
        return value
    if value is None or value == '':
        return Decimal('0')
    return Decimal(str(value))


def line_net(qty, unit_price, discount=Decimal('0')):
    """Line amount after its own discount, before tax."""
    return dec(qty) * dec(unit_price) - dec(discount)


def line_tax(qty, unit_price, tax_rate=Decimal('0'), discount=Decimal('0')):
    """Per-line tax: applied to the line net (after line discount)."""
    return line_net(qty, unit_price, discount) * dec(tax_rate) / HUNDRED


def line_amount_with_tax(qty, unit_price, tax_rate=Decimal('0'), discount=Decimal('0')):
    """Net line amount (after its own discount) plus its per-line tax.

    Always returns Decimal, so callers can safely accumulate it into a
    Decimal document total regardless of what JSON sent us.
    """
    return line_net(qty, unit_price, discount) + line_tax(
        qty, unit_price, tax_rate, discount
    )


def document_total(
    subtotal,
    line_discount_total,
    line_tax_total,
    overall_discount_percent=Decimal('0'),
    overall_tax_percent=Decimal('0'),
):
    """Grand total for a document.

    Mirrors what the UI shows:

        subtotal
      - line discounts
      - overall discount %   (applied to subtotal)
      + line tax             (sum of per-line tax)
      + overall tax %        (applied to the discounted base)
    """
    subtotal = dec(subtotal)
    overall_discount = subtotal * dec(overall_discount_percent) / HUNDRED
    base = subtotal - dec(line_discount_total) - overall_discount
    overall_tax = base * dec(overall_tax_percent) / HUNDRED
    return base + dec(line_tax_total) + overall_tax


def overall_discount_amount(subtotal, overall_discount_percent):
    """Discount row shown in the document footers."""
    return dec(subtotal) * dec(overall_discount_percent) / HUNDRED


def overall_tax_amount(subtotal, line_discount_total, overall_discount_percent, overall_tax_percent):
    """Overall-tax row shown in the document footers."""
    base = dec(subtotal) - dec(line_discount_total) - overall_discount_amount(subtotal, overall_discount_percent)
    return base * dec(overall_tax_percent) / HUNDRED
