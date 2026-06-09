from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum, Avg, Count, F
from django.utils import timezone

from .models import SalesForecast, StockForecast


def _quantize(value):
    """Coerce Decimal/float into a float rounded to 2 decimals (JSON safe)."""
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(round(value, 2))
    try:
        return float(round(float(value), 2))
    except (TypeError, ValueError):
        return 0.0


def _date_bucket(forecast_date, granularity):
    """Group a date into a string bucket depending on granularity."""
    if granularity == "daily":
        return forecast_date.isoformat()
    if granularity == "weekly":
        # ISO year-week label e.g. 2026-W23
        iso = forecast_date.isocalendar()
        return f"{iso[0]}-W{iso[1]:02d}"
    # monthly default
    return forecast_date.strftime("%Y-%m")


def build_sales_analytics(queryset, granularity="daily", top_n=8):
    """
    Build the analytics payload powering the forecast dashboard charts.

    Returns a dict with:
        - timeline:   list[{ date, predicted, lower, upper, count }] (time series)
        - top_skus:   list[{ sku, predicted, confidence_avg, share }] (top variants)
        - method_mix: list[{ name, value }] (forecast method distribution)
        - confidence: list[{ bucket, count }] (confidence histogram)
        - totals:     dict with aggregate numbers
    """
    # Annotate SKU from the related variant, then fetch required fields
    rows = list(
        queryset.annotate(sku=F("variant__sku")).values(
            "forecast_date",
            "predicted_quantity",
            "lower_bound",
            "upper_bound",
            "confidence",
            "method_used",
            "sku",
        )
    )

    # --- timeline ---------------------------------------------------------
    tl_acc = defaultdict(
        lambda: {
            "predicted": Decimal("0"),
            "lower": Decimal("0"),
            "upper": Decimal("0"),
            "count": 0,
        }
    )
    for r in rows:
        bucket = _date_bucket(r["forecast_date"], granularity)
        agg = tl_acc[bucket]
        agg["predicted"] += r["predicted_quantity"] or Decimal("0")
        if r["lower_bound"] is not None:
            agg["lower"] += r["lower_bound"]
        if r["upper_bound"] is not None:
            agg["upper"] += r["upper_bound"]
        agg["count"] += 1

    timeline = [
        {
            "date": bucket,
            "predicted": _quantize(agg["predicted"]),
            "lower": _quantize(agg["lower"]),
            "upper": _quantize(agg["upper"]),
            "count": agg["count"],
        }
        for bucket, agg in sorted(tl_acc.items())
    ]

    # --- top SKUs ---------------------------------------------------------
    sku_acc = defaultdict(
        lambda: {"predicted": Decimal("0"), "confidence_sum": 0.0, "count": 0}
    )
    for r in rows:
        sku = r["sku"] or "UNKNOWN"
        agg = sku_acc[sku]
        agg["predicted"] += r["predicted_quantity"] or Decimal("0")
        agg["confidence_sum"] += float(r["confidence"] or 0.0)
        agg["count"] += 1

    total_predicted = sum((a["predicted"] for a in sku_acc.values()), Decimal("0"))
    sku_sorted = sorted(
        sku_acc.items(), key=lambda kv: kv[1]["predicted"], reverse=True
    )[:top_n]
    top_skus = []
    for sku, agg in sku_sorted:
        share = (
            float(agg["predicted"] / total_predicted) * 100.0 if total_predicted else 0.0
        )
        top_skus.append(
            {
                "sku": sku,
                "predicted": _quantize(agg["predicted"]),
                "confidence_avg": round(agg["confidence_sum"] / agg["count"], 3)
                if agg["count"]
                else 0.0,
                "share": round(share, 2),
            }
        )

    # --- method mix -------------------------------------------------------
    method_acc = defaultdict(lambda: Decimal("0"))
    for r in rows:
        method_acc[r["method_used"] or "UNKNOWN"] += r["predicted_quantity"] or Decimal(
            "0"
        )
    method_mix = [
        {"name": k, "value": _quantize(v)}
        for k, v in sorted(method_acc.items(), key=lambda kv: kv[1], reverse=True)
    ]

    # --- confidence histogram --------------------------------------------
    conf_buckets = [
        ("0-20%", 0.0, 0.2),
        ("20-40%", 0.2, 0.4),
        ("40-60%", 0.4, 0.6),
        ("60-80%", 0.6, 0.8),
        ("80-100%", 0.8, 1.01),
    ]
    conf_counts = [0] * len(conf_buckets)
    for r in rows:
        c = float(r["confidence"] or 0.0)
        for i, (_, lo, hi) in enumerate(conf_buckets):
            if lo <= c < hi:
                conf_counts[i] += 1
                break
    confidence = [
        {"bucket": b[0], "count": conf_counts[i]} for i, b in enumerate(conf_buckets)
    ]

    # --- totals -----------------------------------------------------------
    totals_qs = queryset.aggregate(
        s=Sum("predicted_quantity"),
        lo=Sum("lower_bound"),
        hi=Sum("upper_bound"),
        avg=Avg("confidence"),
        n=Count("id"),
    )
    distinct_skus = queryset.values("variant").distinct().count()
    forecast_dates = list(
        queryset.values_list("forecast_date", flat=True).order_by("forecast_date")
    )
    if forecast_dates:
        date_start = forecast_dates[0].isoformat()
        date_end = forecast_dates[-1].isoformat()
    else:
        today = timezone.now().date()
        date_start = today.isoformat()
        date_end = today.isoformat()

    totals = {
        "predicted_total": _quantize(totals_qs.get("s") or 0),
        "lower_total": _quantize(totals_qs.get("lo") or 0),
        "upper_total": _quantize(totals_qs.get("hi") or 0),
        "confidence_avg": round(float(totals_qs.get("avg") or 0.0), 3),
        "records": totals_qs.get("n") or 0,
        "skus": distinct_skus,
        "date_start": date_start,
        "date_end": date_end,
    }

    return {
        "timeline": timeline,
        "top_skus": top_skus,
        "method_mix": method_mix,
        "confidence": confidence,
        "totals": totals,
        "granularity": granularity,
    }


def build_stock_summary(queryset):
    """
    Build the stock forecast summary powering the stock projection panel.

    Returns a dict with:
        - by_warehouse: list[{ name, projected, reorder }]
        - top_reorder: list[{ sku, warehouse, required, projected }]
        - totals: dict
    """
    rows = list(
        queryset.annotate(
            sku=F("variant__sku"), warehouse_name=F("warehouse__warehouse_name")
        ).values(
            "projected_closing_stock",
            "required_purchase_qty",
            "forecast_date",
            "sku",
            "warehouse_name",
        )
    )

    wh_acc = defaultdict(lambda: {"projected": Decimal("0"), "reorder": Decimal("0")})
    for r in rows:
        wh = r["warehouse_name"] or "Unknown"
        wh_acc[wh]["projected"] += r["projected_closing_stock"] or Decimal("0")
        wh_acc[wh]["reorder"] += r["required_purchase_qty"] or Decimal("0")

    by_warehouse = [
        {
            "name": k,
            "projected": _quantize(v["projected"]),
            "reorder": _quantize(v["reorder"]),
        }
        for k, v in sorted(wh_acc.items(), key=lambda kv: kv[1]["reorder"], reverse=True)
    ]

    # Top reorder items
    top_reorder = sorted(
        [
            {
                "sku": r["sku"] or "UNKNOWN",
                "warehouse": r["warehouse_name"] or "Unknown",
                "projected": _quantize(r["projected_closing_stock"]),
                "required": _quantize(r["required_purchase_qty"]),
            }
            for r in rows
        ],
        key=lambda x: x["required"],
        reverse=True,
    )[:8]

    total_reorder = sum((v["reorder"] for v in wh_acc.values()), Decimal("0"))
    total_projected = sum((v["projected"] for v in wh_acc.values()), Decimal("0"))

    return {
        "by_warehouse": by_warehouse,
        "top_reorder": top_reorder,
        "totals": {
            "reorder_total": _quantize(total_reorder),
            "projected_total": _quantize(total_projected),
            "warehouses": len(wh_acc),
            "items": len(rows),
        },
    }