# InsightCart AI — API Documentation

Base URL: `http://localhost:5000/api`

## Authentication

All protected routes require a JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

Tokens are obtained via `/api/auth/login` or `/api/auth/register`.

---

## Auth Routes

### POST /auth/register
Register a new user.
```json
{ "name": "Jane Smith", "email": "jane@example.com", "password": "Pass@123" }
```
**Response:** `{ token, user }`

### POST /auth/login
Login with email and password.
```json
{ "email": "jane@example.com", "password": "Pass@123" }
```
**Response:** `{ token, user }`

### GET /auth/me
Get current user profile. **[Protected]**

### PUT /auth/me
Update name or avatar. **[Protected]**

---

## Product Routes

### GET /products
List products with filtering and pagination.

**Query params:**
- `q` — Full-text search
- `category` — Filter by category
- `minPrice`, `maxPrice` — Price range
- `sort` — Field to sort by (default: `trendScore`)
- `order` — `asc` or `desc` (default: `desc`)
- `page`, `limit` — Pagination (default: page=1, limit=20)

**Response:** `{ products[], pagination: { total, page, limit, pages } }`

### GET /products/categories
List all distinct categories.

### GET /products/trending
Top 12 trending products sorted by `trendScore`.

### GET /products/:id
Get single product by ID.

### POST /products **[Admin]**
Create a new product.
```json
{
  "name": "Product Name",
  "description": "...",
  "price": 99.99,
  "category": "Electronics",
  "brand": "BrandX",
  "imageUrl": "https://...",
  "stock": 50,
  "tags": ["wireless", "audio"]
}
```

### PUT /products/:id **[Admin]**
Update a product.

### DELETE /products/:id **[Admin]**
Soft-delete (deactivate) a product.

---

## Cart Routes **[Protected]**

### GET /cart
Get current user's cart with populated product details and cart total.

### POST /cart
Add item to cart (or increment quantity if already present).
```json
{ "productId": "<id>", "quantity": 1 }
```

### PUT /cart/:itemId
Update quantity of a cart item.
```json
{ "quantity": 3 }
```

### DELETE /cart/:itemId
Remove a specific item from cart.

### DELETE /cart
Clear entire cart.

---

## Order Routes **[Protected]**

### POST /orders
Place an order from the current cart. Decrements stock, clears cart.
```json
{
  "shippingAddress": { "street": "123 Main", "city": "NYC", "state": "NY", "zip": "10001", "country": "US" },
  "paymentMethod": "card",
  "notes": "Leave at door"
}
```
**Response:** `{ order }` — order is created with `paymentStatus: "pending"`

### GET /orders
Get orders for the current user. Admins see all orders.

**Query params:** `page`, `limit`

### GET /orders/:id
Get single order (owners and admins only).

### PATCH /orders/:id/status **[Admin]**
Update order status.
```json
{ "status": "shipped" }
```

---

## Payment Routes **[Protected]**

### POST /payments/process
Simulate payment for a pending order.
```json
{
  "orderId": "<id>",
  "cardNumber": "4111 1111 1111 1111",
  "expiryDate": "12/26",
  "cvv": "123",
  "cardHolder": "Jane Smith"
}
```
**Success:** `{ success: true, paymentRef: "PAY-XXXXXXXXXXXX", order }`
**Failure:** `{ success: false, error: "Payment declined...", code: "PAYMENT_DECLINED" }`

Payments succeed 95% of the time (configurable via `PAYMENT_SUCCESS_RATE` env var).

### POST /payments/refund **[Admin or Owner]**
Issue a refund for a paid order.
```json
{ "orderId": "<id>", "reason": "Customer request" }
```

---

## Behavior Routes

### POST /behavior/events
Ingest one or more behavior events. Accepts a single object or array. Auth optional (anonymous tracking supported via `sessionId`).

**Single event:**
```json
{
  "sessionId": "sess_abc123",
  "eventType": "view",
  "productId": "<id>",
  "category": "Electronics",
  "dwellMs": null,
  "query": null,
  "metadata": {}
}
```

**Batch (array):**
```json
[
  { "sessionId": "...", "eventType": "view", "productId": "..." },
  { "sessionId": "...", "eventType": "dwell", "dwellMs": 12000 }
]
```

**Event types:**
| Type | Description | Key Fields |
|------|-------------|------------|
| `view` | Product viewed | `productId`, `category` |
| `click` | Element clicked | `productId`, `category` |
| `search` | Search query submitted | `query` |
| `add_to_cart` | Product added to cart | `productId`, `category` |
| `remove_from_cart` | Product removed from cart | `productId` |
| `purchase` | Product purchased | `productId`, `category` |
| `dwell` | Time spent on page | `dwellMs`, `productId` |
| `page_visit` | Page loaded | `metadata.page` |

### GET /behavior/profile **[Protected]**
Get the current user's aggregated behavior profile including category affinities, recent searches, and recommendation cache.

---

## Recommendation Routes

### GET /recommendations
Get personalized recommendations. Auth optional.

- **Authenticated:** Returns AI-personalized products based on behavior profile.
- **Guest:** Returns trending products.

**Query params:** `limit` (default: 10, max: 20)

**Response:**
```json
{
  "recommendations": [
    { ...productFields, "recommendReason": "Based on your interest in Electronics" }
  ],
  "personalized": true
}
```

---

## Admin Routes **[Admin Only]**

### GET /admin/stats
Platform overview statistics.
```json
{
  "stats": {
    "totalUsers": 150,
    "totalProducts": 45,
    "totalOrders": 320,
    "totalRevenue": 48250.00,
    "avgOrderValue": 150.78,
    "ordersByStatus": { "pending": 12, "processing": 8, ... }
  }
}
```

### GET /admin/analytics
Full behavioral analytics including:
- Event type distribution (last 7 days)
- Top 10 viewed products
- Top 20 search queries (last 30 days)
- Activity by hour of day (heatmap data)
- Conversion funnel (views → cart → purchase, last 30 days)

### POST /admin/recompute-trends
Manually trigger trending score recomputation for all products (normally scheduled automatically).

### GET /admin/users
List all users. Query params: `page`, `limit`, `role`.

### PATCH /admin/users/:id
Toggle user active status or change role.
```json
{ "isActive": false }
{ "role": "admin" }
```

### GET /admin/orders
List all orders with user details. Query params: `status`, `page`, `limit`.

### GET /admin/products
List all products including inactive ones. Query params: `page`, `limit`.

---

## Error Format

All errors follow:
```json
{ "success": false, "error": "Human-readable error message" }
```

Common HTTP status codes:
- `400` — Bad request / validation error
- `401` — Unauthorized (missing or invalid token)
- `403` — Forbidden (insufficient permissions)
- `404` — Resource not found
- `402` — Payment declined
- `500` — Internal server error
