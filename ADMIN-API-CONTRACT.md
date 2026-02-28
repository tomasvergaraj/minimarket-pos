# Admin API Contract v1 (MiniMarket POS)

Base URL: `/api`

Admin authorization (temporal): header `X-User-Role: admin`

## Standard Shapes

Success:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

List success with pagination:

```json
{
  "success": true,
  "data": [],
  "error": null,
  "meta": {
    "total": 120,
    "skip": 0,
    "limit": 50,
    "has_more": true
  }
}
```

Error:

```json
{
  "detail": {
    "code": "FORBIDDEN",
    "message": "Admin role required"
  }
}
```

## 1) GET `/dashboard/stats`

Returns dashboard KPIs for current UTC day.

Example response:

```json
{
  "success": true,
  "data": {
    "ventas_hoy": 42,
    "ingresos_hoy": 215340.5,
    "ticket_promedio": 5127.16,
    "cajas_abiertas": 2,
    "productos_bajo_stock": 8,
    "ventas_anuladas": 1,
    "top_5_productos": [
      {
        "product_id": "uuid",
        "product_name": "Coca Cola 1.5L",
        "quantity_sold": 16,
        "revenue": 25584.0
      }
    ]
  },
  "error": null
}
```

## 2) GET `/sales/`

Query params:
- `date_from` (YYYY-MM-DD, optional)
- `date_to` (YYYY-MM-DD, optional)
- `register_id` (optional)
- `status` (`completed|voided`, optional)
- `skip` (default `0`)
- `limit` (default `50`, max `200`)

Example response:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "sale_number": 105,
      "cash_session_id": "uuid",
      "register_id": "uuid",
      "seller_id": "uuid",
      "subtotal": 11990,
      "tax_amount": 1914,
      "total": 11990,
      "payment_method": "cash",
      "cash_amount": 12000,
      "card_amount": 0,
      "change_amount": 10,
      "status": "completed",
      "created_at": "2026-02-15T14:05:10.120000",
      "items": []
    }
  ],
  "error": null,
  "meta": {
    "total": 1,
    "skip": 0,
    "limit": 50,
    "has_more": false
  }
}
```

## 3) GET `/cash/sessions`

Query params:
- `register_id` (optional)
- `status` (`open|closed`, optional)
- `date_from` (YYYY-MM-DD, optional)
- `date_to` (YYYY-MM-DD, optional)
- `skip` (default `0`)
- `limit` (default `50`, max `200`)

Example response:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "register_id": "uuid",
      "user_id": "uuid",
      "status": "closed",
      "opening_amount": 50000,
      "closing_amount": 90500,
      "total_cash_sales": 30500,
      "total_card_sales": 41000,
      "total_sales_count": 27,
      "expected_cash": 80500,
      "difference": 10000,
      "opened_at": "2026-02-15T08:00:00",
      "closed_at": "2026-02-15T16:00:00"
    }
  ],
  "error": null,
  "meta": {
    "total": 1,
    "skip": 0,
    "limit": 50,
    "has_more": false
  }
}
```

## 4) PUT `/users/{user_id}`

Body (all fields optional):

```json
{
  "username": "admin.main",
  "pin": "1234",
  "full_name": "Administrador Principal",
  "role": "admin",
  "is_active": true
}
```

Success:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "admin.main",
    "full_name": "Administrador Principal",
    "role": "admin",
    "is_active": true,
    "created_at": "2026-02-15T10:00:00"
  },
  "error": null
}
```

Domain errors:
- `404 USER_NOT_FOUND`
- `409 USERNAME_TAKEN`

## 5) PUT `/config`

Body:

```json
{
  "store_name": "MiniMarket Central",
  "store_rut": "76.123.456-7",
  "store_address": "Av. Principal 123, Santiago"
}
```

Success:

```json
{
  "success": true,
  "data": {
    "store_name": "MiniMarket Central",
    "store_rut": "76.123.456-7",
    "store_address": "Av. Principal 123, Santiago"
  },
  "error": null
}
```

## Error Codes (current)

- `FORBIDDEN` -> missing admin role (`X-User-Role`)
- `USER_NOT_FOUND` -> target user does not exist
- `USERNAME_TAKEN` -> duplicate username on update
