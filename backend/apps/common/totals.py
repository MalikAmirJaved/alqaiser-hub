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


def line_tax(qty, unit_price, tax_rate=Decimal('0')):
    """Per-line tax: applied to the gross line amount before discounts."""
    return dec(qty) * dec(unit_price) * dec(tax_rate) / HUNDRED


def line_amount_with_tax(qty, unit_price, tax_rate=Decimal('0'), discount=Decimal('0')):
    """Net line amount (after its own discount) plus its per-line tax.

    Always returns Decimal, so callers can safely accumulate it into a
    Decimal document total regardless of what JSON sent us.
    """
    return line_net(qty, unit_price, discount) + line_tax(
        qty, unit_price, tax_rate
    )


def document_total(
    subtotal,
    line_discount_total,
    line_tax_total,
    overall_discount_percent=Decimal('0'),
    overall_tax_percent=Decimal('0'),
):
    """Grand total for a document.

    Applies tax first, calculates the overall percentage discount from the
    tax-inclusive amount, then subtracts all discounts:

        subtotal
      + line tax             (sum of tax on gross line amounts)
      + overall tax %        (applied to subtotal)
      - overall discount %   (applied to the tax-inclusive amount)
      - line discounts
    """
    subtotal = dec(subtotal)
    overall_tax = overall_tax_amount(subtotal, overall_tax_percent)
    tax_inclusive_subtotal = subtotal + dec(line_tax_total) + overall_tax
    overall_discount = overall_discount_amount(
        subtotal, line_tax_total, overall_tax_percent, overall_discount_percent
    )
    return tax_inclusive_subtotal - dec(line_discount_total) - overall_discount


def overall_discount_amount(
    subtotal,
    line_tax_total,
    overall_tax_percent,
    overall_discount_percent,
):
    """Overall discount calculated from the tax-inclusive amount."""
    tax_inclusive_subtotal = (
        dec(subtotal)
        + dec(line_tax_total)
        + overall_tax_amount(subtotal, overall_tax_percent)
    )
    return tax_inclusive_subtotal * dec(overall_discount_percent) / HUNDRED


def overall_tax_amount(subtotal, overall_tax_percent):
    """Overall-tax amount applied before discounts."""
    return dec(subtotal) * dec(overall_tax_percent) / HUNDRED
